export default {
  async fetch(request, env) {
    const knowledge = [
      { category: 'title-tags', text: 'Title tags should be 50-60 characters long. Include your primary keyword near the beginning.', source: 'SEO Best Practices' },
      { category: 'meta-description', text: 'Meta descriptions should be 150-160 characters. Include a call-to-action and primary keywords naturally.', source: 'SEO Best Practices' },
      { category: 'headings', text: 'Use H1 tags for main page titles (only one per page). H2-H6 for subheadings in hierarchical order.', source: 'SEO Best Practices' },
      { category: 'content', text: 'Content should be at least 300 words for standard pages, 1000+ for cornerstone content.', source: 'Content Guidelines' },
      { category: 'images', text: 'All images should have descriptive alt text. Compress images to reduce page load time.', source: 'Image Optimization' },
    ];

    try {
      for (const item of knowledge) {
        const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: item.text });
        await env.VECTORIZE.insert([{
          id: crypto.randomUUID(),
          values: embedding.data[0],
          metadata: item
        }]);
      }
      return new Response('✅ Vectorize populated successfully!');
    } catch (error) {
      return new Response('❌ Error: ' + error.message, { status: 500 });
    }
  }
};