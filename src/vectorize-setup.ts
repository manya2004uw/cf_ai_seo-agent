// Run this script once to populate your Vectorize index with SEO knowledge

const SEO_KNOWLEDGE_BASE = [
  {
    category: 'title-tags',
    text: 'Title tags should be 50-60 characters long. They appear in search results and browser tabs. Include your primary keyword near the beginning. Make them compelling to improve click-through rates.',
    source: 'SEO Best Practices'
  },
  {
    category: 'meta-description',
    text: 'Meta descriptions should be 150-160 characters. While not a direct ranking factor, they influence click-through rates. Include a call-to-action and primary keywords naturally.',
    source: 'SEO Best Practices'
  },
  {
    category: 'headings',
    text: 'Use H1 tags for main page titles (only one per page). H2-H6 for subheadings in hierarchical order. Include keywords naturally. Proper heading structure improves readability and SEO.',
    source: 'SEO Best Practices'
  },
  {
    category: 'content',
    text: 'Content should be at least 300 words for standard pages, 1000+ for cornerstone content. Focus on quality over quantity. Answer user intent comprehensively. Update regularly.',
    source: 'Content Guidelines'
  },
  {
    category: 'images',
    text: 'All images should have descriptive alt text for accessibility and SEO. Compress images to reduce page load time. Use descriptive file names. Consider using WebP format for better compression.',
    source: 'Image Optimization'
  },
  {
    category: 'internal-linking',
    text: 'Internal links help distribute page authority and improve crawlability. Use descriptive anchor text. Link to relevant content. Aim for 2-5 internal links per page.',
    source: 'Link Building'
  },
  {
    category: 'page-speed',
    text: 'Page load time is a ranking factor. Aim for under 3 seconds. Minimize HTTP requests, enable compression, leverage browser caching, optimize images, and minimize CSS/JS.',
    source: 'Performance Optimization'
  },
  {
    category: 'mobile-optimization',
    text: 'Mobile-first indexing means Google primarily uses mobile version for ranking. Ensure responsive design, fast mobile load times, and touch-friendly navigation.',
    source: 'Mobile SEO'
  },
  {
    category: 'schema-markup',
    text: 'Structured data helps search engines understand your content. Implement relevant schema types (Article, Product, FAQ, etc.). Validate with Google\'s Rich Results Test.',
    source: 'Technical SEO'
  },
  {
    category: 'url-structure',
    text: 'URLs should be short, descriptive, and include keywords. Use hyphens to separate words. Avoid special characters and dynamic parameters when possible. Keep structure logical.',
    source: 'Technical SEO'
  },
  {
    category: 'external-links',
    text: 'Link to authoritative external sources to add credibility. Open external links in new tabs. Use nofollow for untrusted or sponsored content. Monitor broken links regularly.',
    source: 'Link Building'
  },
  {
    category: 'keyword-optimization',
    text: 'Use primary keywords in title, H1, first paragraph, and naturally throughout content. Include LSI keywords and synonyms. Avoid keyword stuffing. Target long-tail variations.',
    source: 'Keyword Strategy'
  },
  {
    category: 'core-web-vitals',
    text: 'Core Web Vitals are ranking factors: LCP (Largest Contentful Paint) under 2.5s, FID (First Input Delay) under 100ms, CLS (Cumulative Layout Shift) under 0.1.',
    source: 'Performance Metrics'
  },
  {
    category: 'security',
    text: 'HTTPS is a ranking signal. Ensure SSL certificate is properly configured. Secure all resources. Update security protocols regularly.',
    source: 'Technical SEO'
  },
  {
    category: 'sitemap',
    text: 'XML sitemaps help search engines discover and crawl pages. Submit to Google Search Console. Update regularly. Include only canonical URLs. Keep under 50MB/50,000 URLs.',
    source: 'Technical SEO'
  }
];

export async function populateVectorize(env: any) {
  console.log('Starting Vectorize population...');
  
  for (const item of SEO_KNOWLEDGE_BASE) {
    // Generate embedding
    const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: item.text
    });

    // Insert into Vectorize
    await env.VECTORIZE.insert([
      {
        id: crypto.randomUUID(),
        values: embedding.data[0],
        metadata: {
          category: item.category,
          text: item.text,
          source: item.source
        }
      }
    ]);

    console.log(`✓ Added: ${item.category}`);
  }

  console.log('Vectorize population complete!');
}

// Export for use in setup script
export { SEO_KNOWLEDGE_BASE };