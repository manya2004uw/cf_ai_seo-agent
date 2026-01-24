import { Hono } from 'hono';
import { cors } from 'hono/cors';

interface Bindings {
  AI: any;
  VECTORIZE: VectorizeIndex;
  DB: D1Database;
  CACHE: KVNamespace;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', message: 'SEO Agent is running' });
});

// SEO Analysis Function (replaces Workflow)
async function analyzeSeoMultiStep(url: string, env: Bindings) {
  // Step 1: Scrape the URL
  const response = await fetch(url);
  const html = await response.text();
  
  const pageData = {
    html,
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    headings: extractHeadings(html),
    images: extractImages(html),
    links: extractLinks(html)
  };

  // Step 2: Generate embeddings and query RAG
  const queryText = `SEO analysis for: ${pageData.title}. Meta: ${pageData.metaDescription}`;
  
  const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: queryText
  });

  const ragResults = await env.VECTORIZE.query(embedding.data[0], {
    topK: 10,
    returnMetadata: true
  });

  const ragContext = ragResults.matches
    .map((m) => m.metadata?.text || '')
    .filter(Boolean)
    .join('\n\n');

  // Step 3: Analyze with Llama 3.3
  const prompt = `Analyze this website for SEO:

URL: ${url}
Title: ${pageData.title}
Meta Description: ${pageData.metaDescription}
Number of Headings: ${pageData.headings.length}
Number of Images: ${pageData.images.length}
Number of Links: ${pageData.links.length}

SEO Best Practices Reference:
${ragContext}

Provide a JSON response with:
1. score (0-100)
2. issues (array of strings)
3. recommendations (array of strings with priority: High/Medium/Low)

Respond ONLY with valid JSON, no markdown.`;

  const aiResponse = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages: [
      { role: 'system', content: 'You are an expert SEO auditor. Always respond with valid JSON only.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2048
  });

  let analysis;
  try {
    const responseText = aiResponse.response.replace(/```json|```/g, '').trim();
    analysis = JSON.parse(responseText);
  } catch (e) {
    analysis = {
      score: 50,
      issues: ['Could not parse AI response'],
      recommendations: ['Please try again']
    };
  }

  // Step 4: Save to D1
  await env.DB.prepare(
    `INSERT INTO seo_analyses (url, analysis_data, score, recommendations)
     VALUES (?, ?, ?, ?)`
  ).bind(
    url,
    JSON.stringify(pageData),
    analysis.score,
    JSON.stringify(analysis.recommendations)
  ).run();

  // Step 5: Cache results
  await env.CACHE.put(
    `analysis:${url}`,
    JSON.stringify({ pageData, analysis }),
    { expirationTtl: 3600 }
  );

  return { pageData, analysis };
}

// Start SEO analysis
app.post('/api/analyze', async (c) => {
  try {
    const body = await c.req.json();
    const { url } = body;
    
    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Check cache first
    const cached = await c.env.CACHE.get(`analysis:${url}`);
    if (cached) {
      return c.json({ 
        cached: true, 
        data: JSON.parse(cached),
        message: 'Retrieved from cache'
      });
    }

    // Run analysis
    const result = await analyzeSeoMultiStep(url, c.env);

    return c.json({ 
      cached: false,
      data: result,
      message: 'Analysis complete'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// Chat endpoint for conversational SEO advice
app.post('/api/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { message, sessionId } = body;

    // Get relevant SEO knowledge from Vectorize
    const queryEmbedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: message
    });

    const ragResults = await c.env.VECTORIZE.query(queryEmbedding.data[0], {
      topK: 5,
      returnMetadata: true
    });

    // Build context from RAG results
    const ragContext = ragResults.matches
      .map((m) => m.metadata?.text || '')
      .filter(Boolean)
      .join('\n\n');

    // Get user history from D1
    const history = await c.env.DB.prepare(
      'SELECT context FROM user_sessions WHERE session_id = ?'
    ).bind(sessionId).first();

    // Generate response with Llama 3.3
    const response = await c.env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        {
          role: 'system',
          content: `You are an expert SEO consultant. Use this knowledge base to provide accurate advice:\n\n${ragContext}\n\nPrevious context: ${history?.context || 'None'}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1024
    });

    // Update session memory
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO user_sessions (session_id, context, last_active) VALUES (?, ?, CURRENT_TIMESTAMP)'
    ).bind(sessionId, JSON.stringify({ lastMessage: message })).run();

    return c.json({
      response: response.response,
      sources: ragResults.matches.map((m) => m.metadata?.source || 'Unknown').filter(Boolean)
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

// Get analysis history
app.get('/api/history', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM seo_analyses ORDER BY created_at DESC LIMIT 10'
  ).all();

  return c.json(results);
});

// Helper functions
function extractTitle(html: string): string {
  const match = html.match(/<title>(.*?)<\/title>/i);
  return match ? match[1] : 'No title found';
}

function extractMetaDescription(html: string): string {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  return match ? match[1] : 'No meta description';
}

function extractHeadings(html: string): string[] {
  const regex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
  const matches = html.match(regex) || [];
  return matches.map(h => h.replace(/<[^>]*>/g, ''));
}

function extractImages(html: string): string[] {
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(regex)];
  return matches.map(m => m[1]);
}

function extractLinks(html: string): string[] {
  const regex = /<a[^>]+href=["']([^"']+)["']/gi;
  const matches = [...html.matchAll(regex)];
  return matches.map(m => m[1]);
}

export default app;