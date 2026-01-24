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

  // Step 3: Rule-based analysis (reliable and deterministic)
  const analysis = {
    score: calculateSeoScore(pageData),
    issues: findSeoIssues(pageData),
    recommendations: generateRecommendations(pageData),
    ragContext: ragContext.substring(0, 500) // Include some RAG context for display
  };

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

// Populate Vectorize (run once)
app.get('/api/populate-vectorize', async (c) => {
  const knowledge = [
    { category: 'title-tags', text: 'Title tags should be 50-60 characters long. Include your primary keyword near the beginning.', source: 'SEO Best Practices' },
    { category: 'meta-description', text: 'Meta descriptions should be 150-160 characters. Include a call-to-action and primary keywords naturally.', source: 'SEO Best Practices' },
    { category: 'headings', text: 'Use H1 tags for main page titles (only one per page). H2-H6 for subheadings in hierarchical order.', source: 'SEO Best Practices' },
    { category: 'content', text: 'Content should be at least 300 words for standard pages, 1000+ for cornerstone content.', source: 'Content Guidelines' },
    { category: 'images', text: 'All images should have descriptive alt text. Compress images to reduce page load time.', source: 'Image Optimization' },
    { category: 'internal-linking', text: 'Internal links help distribute page authority. Use descriptive anchor text.', source: 'Link Building' },
    { category: 'page-speed', text: 'Page load time is a ranking factor. Aim for under 3 seconds.', source: 'Performance Optimization' },
    { category: 'mobile-optimization', text: 'Mobile-first indexing means Google primarily uses mobile version for ranking.', source: 'Mobile SEO' },
  ];

  try {
    for (const item of knowledge) {
      const embedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: item.text });
      await c.env.VECTORIZE.insert([{
        id: crypto.randomUUID(),
        values: embedding.data[0],
        metadata: item
      }]);
    }
    return c.json({ success: true, message: 'Vectorize populated!' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
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

// SEO Analysis Helper Functions
function calculateSeoScore(pageData: any): number {
  let score = 100;
  
  // Title evaluation
  if (!pageData.title || pageData.title === 'No title found') {
    score -= 20;
  } else if (pageData.title.length < 30) {
    score -= 10;
  } else if (pageData.title.length > 60) {
    score -= 10;
  }
  
  // Meta description evaluation
  if (!pageData.metaDescription || pageData.metaDescription === 'No meta description') {
    score -= 20;
  } else if (pageData.metaDescription.length < 120) {
    score -= 10;
  } else if (pageData.metaDescription.length > 160) {
    score -= 10;
  }
  
  // Headings evaluation
  if (pageData.headings.length === 0) {
    score -= 15;
  } else if (pageData.headings.length < 3) {
    score -= 5;
  }
  
  // Images evaluation
  if (pageData.images.length > 20) {
    score -= 10; // Too many images might slow down the page
  }
  
  // Links evaluation
  if (pageData.links.length < 3) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

function findSeoIssues(pageData: any): string[] {
  const issues = [];
  
  // Title issues
  if (!pageData.title || pageData.title === 'No title found') {
    issues.push('❌ Missing title tag - critical for SEO');
  } else if (pageData.title.length < 30) {
    issues.push(`⚠️ Title tag is too short (${pageData.title.length} characters) - should be 50-60 characters`);
  } else if (pageData.title.length > 60) {
    issues.push(`⚠️ Title tag is too long (${pageData.title.length} characters) - may be truncated in search results`);
  }
  
  // Meta description issues
  if (!pageData.metaDescription || pageData.metaDescription === 'No meta description') {
    issues.push('❌ Missing meta description - important for click-through rates');
  } else if (pageData.metaDescription.length < 120) {
    issues.push(`⚠️ Meta description is too short (${pageData.metaDescription.length} characters) - should be 150-160 characters`);
  } else if (pageData.metaDescription.length > 160) {
    issues.push(`⚠️ Meta description is too long (${pageData.metaDescription.length} characters) - will be truncated`);
  }
  
  // Heading issues
  if (pageData.headings.length === 0) {
    issues.push('❌ No heading tags (H1-H6) found - critical for content structure');
  } else if (pageData.headings.length < 3) {
    issues.push('⚠️ Low number of headings - consider adding more subheadings for better structure');
  }
  
  // Image issues
  if (pageData.images.length === 0) {
    issues.push('ℹ️ No images found - visual content can improve engagement');
  } else if (pageData.images.length > 20) {
    issues.push(`⚠️ High number of images (${pageData.images.length}) - ensure optimization to prevent slow load times`);
  }
  
  // Link issues
  if (pageData.links.length < 3) {
    issues.push('⚠️ Low number of internal links - improve site structure with more linking');
  }
  
  return issues;
}

function generateRecommendations(pageData: any): Array<{ text: string; priority: string }> {
  const recommendations = [];
  
  // Title recommendations
  if (!pageData.title || pageData.title === 'No title found' || pageData.title.length < 50) {
    recommendations.push({ 
      text: '📝 Add a descriptive, keyword-rich title tag (50-60 characters)', 
      priority: 'High' 
    });
  }
  
  // Meta description recommendations
  if (!pageData.metaDescription || pageData.metaDescription === 'No meta description') {
    recommendations.push({ 
      text: '📝 Create a compelling meta description (150-160 characters) with a call-to-action', 
      priority: 'High' 
    });
  }
  
  // Heading recommendations
  if (pageData.headings.length === 0) {
    recommendations.push({ 
      text: '🏗️ Implement proper heading structure (H1 for title, H2-H6 for sections)', 
      priority: 'High' 
    });
  }
  
  // Universal recommendations
  recommendations.push({ 
    text: '🖼️ Ensure all images have descriptive alt text for accessibility and SEO', 
    priority: 'Medium' 
  });
  
  recommendations.push({ 
    text: '⚡ Optimize page load speed - compress images, minify CSS/JS, use CDN', 
    priority: 'Medium' 
  });
  
  recommendations.push({ 
    text: '🔗 Add 3-5 internal links to relevant pages to improve site structure', 
    priority: 'Medium' 
  });
  
  recommendations.push({ 
    text: '📱 Verify mobile responsiveness - Google uses mobile-first indexing', 
    priority: 'Medium' 
  });
  
  recommendations.push({ 
    text: '🔒 Ensure HTTPS is properly configured across the entire site', 
    priority: 'Low' 
  });
  
  recommendations.push({ 
    text: '🗺️ Submit XML sitemap to Google Search Console for better indexing', 
    priority: 'Low' 
  });
  
  return recommendations;
}

export default app;