# 🚀 AI SEO Agent - Cloudflare Native

> **Cloudflare AI Application Challenge Submission**

A sophisticated SEO analysis agent built entirely on Cloudflare's AI infrastructure, featuring RAG (Retrieval-Augmented Generation), multi-step workflows, and conversational AI.

## 🌐 Live Demo

- **Frontend:** https://seo-agent-6xv.pages.dev
- **API:** https://seo-agent.mchugh18.workers.dev/api/health

Try analyzing any website to get instant SEO insights powered by AI!

## 🎯 Features

- **🤖 RAG-Powered Analysis**: Uses Vectorize to query SEO best practices knowledge base
- **⚡ Llama 3.3 Integration**: Advanced AI analysis with Workers AI
- **🔄 Cloudflare Workflows**: Multi-step orchestration for complex SEO audits
- **💬 Chat Interface**: Conversational SEO assistant with memory
- **💾 D1 Database**: Persistent storage for analysis history
- **⚡ KV Caching**: Fast response times for repeated analyses
- **📱 Responsive UI**: Beautiful Cloudflare Pages frontend

## 🏗️ Architecture

```
User Input → Worker API → Workflow (Scrape → RAG Query → AI Analysis) → D1 Storage → Cache
                ↓
          Vectorize (SEO Knowledge Base)
                ↓
          Llama 3.3 (AI Analysis)
```

## 📋 Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI installed globally

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd cloudflare-seo-agent
npm install
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create Infrastructure

```bash
# Create D1 Database
npm run setup:db

# Create Vectorize Index
npm run setup:vectorize

# Create KV Namespace
npm run setup:kv
```

### 4. Update wrangler.toml

After running the setup commands, update `wrangler.toml` with the IDs returned:

```toml
[[d1_databases]]
database_id = "your-database-id-here"

[[kv_namespaces]]
id = "your-kv-id-here"
```

### 5. Populate Vectorize with SEO Knowledge

Create a setup script `scripts/populate.ts`:

```typescript
import { populateVectorize } from '../src/vectorize-setup';

export default {
  async fetch(request, env, ctx) {
    await populateVectorize(env);
    return new Response('Vectorize populated!');
  }
};
```

Deploy and run:
```bash
wrangler deploy --name setup-vectorize --compatibility-date=2024-01-01
curl https://setup-vectorize.your-subdomain.workers.dev
```

### 6. Deploy

```bash
npm run deploy
```

### 7. Deploy Frontend (Pages)

```bash
wrangler pages deploy public --project-name=seo-agent
```

## 🔧 Development

```bash
# Start local dev server
npm run dev

# Watch logs
npm run tail
```

## 📊 API Endpoints

### POST /api/analyze
Analyze a website URL

**Request:**
```json
{
  "url": "https://example.com",
  "sessionId": "unique-session-id"
}
```

**Response:**
```json
{
  "workflowId": "uuid",
  "status": "started",
  "message": "SEO analysis in progress"
}
```

### GET /api/analyze/:workflowId
Check analysis status

### POST /api/chat
Chat with the SEO assistant

**Request:**
```json
{
  "message": "How do I optimize my meta descriptions?",
  "sessionId": "unique-session-id",
  "context": "optional-workflow-id"
}
```

### GET /api/history
Get recent analyses

## 🎨 Customization

### Add More SEO Knowledge

Edit `src/vectorize-setup.ts` and add entries to `SEO_KNOWLEDGE_BASE`:

```typescript
{
  category: 'new-category',
  text: 'Your SEO knowledge here',
  source: 'Source Name'
}
```

### Modify Workflow Steps

Edit `src/workflow.ts` to add/remove analysis steps.

### Customize UI

Edit `public/index.html` - uses Tailwind CSS.

## 🧪 Testing

Test individual components:

```bash
# Test scraping
curl -X POST http://localhost:8787/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","sessionId":"test-123"}'

# Test chat
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is SEO?","sessionId":"test-123"}'
```

## 📈 Why This Stands Out

1. **RAG Implementation**: Uses Vectorize for intelligent context retrieval
2. **Workflows**: Demonstrates understanding of Cloudflare's newest features
3. **Full-Stack**: Complete application with API, database, and UI
4. **Production-Ready**: Includes caching, error handling, and memory management
5. **Agentic Design**: Multi-step autonomous analysis process

## 🏆 Cloudflare Features Used

- ✅ Workers AI (Llama 3.3)
- ✅ Workflows
- ✅ Vectorize (RAG)
- ✅ D1 Database
- ✅ KV Storage
- ✅ Pages
- ✅ Hono Framework

## 📝 Project Structure

```
cloudflare-seo-agent/
├── src/
│   ├── worker.ts           # Main API Worker
│   ├── workflow.ts         # SEO Analysis Workflow
│   └── vectorize-setup.ts  # RAG Knowledge Base
├── public/
│   └── index.html          # Chat Interface
├── schema.sql              # D1 Database Schema
├── wrangler.toml          # Configuration
├── package.json
├── tsconfig.json
└── README.md
```

## 🔒 Security Notes

- No API keys stored in code (uses Cloudflare bindings)
- CORS enabled for frontend
- Input validation on all endpoints
- Rate limiting via Cloudflare (configure in dashboard)

## 📚 Resources

- [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Vectorize Documentation](https://developers.cloudflare.com/vectorize/)
- [Workflows Guide](https://developers.cloudflare.com/workflows/)
- [D1 Database](https://developers.cloudflare.com/d1/)

## 🤝 Contributing

This is a demo project for Cloudflare application. Feel free to fork and extend!

## 📄 License

MIT

---