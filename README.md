# Research-to-Deck Generator

RAG over academic papers (via the Semantic Scholar API) → synthesized findings → a branded, cited PPTX deck, triggered through a Next.js API and processed by a background worker.

## Architecture

```
POST /api/generate {topic}
        │
        ▼
   BullMQ queue (Redis)
        │
        ▼
   worker (src/worker) ── Semantic Scholar (search + PDF fetch)
        │                       │
        │                       ▼
        │                 chunk + embed (Voyage AI) → pgvector
        │
        ├── multi-query RAG + rerank (Voyage AI)
        ├── synthesis → slide plan JSON (Claude)
        └── assembleDeck() → subprocess → scripts/generate_deck.py (python-pptx)
                                                    │
                                                    ▼
                                           generated/<jobId>.pptx

GET /api/status/[jobId]   → job status, paper count, download link when complete
GET /api/download/[jobId] → streams the .pptx
```

The worker (`src/worker/index.ts`) is a **separate long-running Node process**, not a Next.js route — BullMQ needs a persistent consumer, which Vercel's serverless functions cannot provide. See **Deployment** below.

## What's built and verified

- Next.js API routes (`generate`, `status/[jobId]`, `download/[jobId]`) — typechecked, built, and smoke-tested live (200/202/400/404 all confirmed).
- BullMQ job enqueue — confirmed a real job lands in Redis (`bull:deck-generation:<jobId>`).
- Postgres + pgvector schema — migrated and verified (`papers`, `chunks` with an `ivfflat` cosine index, `jobs`).
- `scripts/generate_deck.py` — ran against sample data; produced a real 4-slide `.pptx` with title/content/notes/citations/sources slide, verified by reading the file back.
- Semantic Scholar search — reaches the real API (confirmed via a live request); see the rate-limit note below.
- Full pipeline **has not** been run end-to-end with real `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`, since those require your credentials.

## Setup

### 1. Local infrastructure (no external accounts needed)

```bash
docker compose up -d       # Postgres+pgvector on :5432, Redis on :6379
cp .env.example .env       # fill in the two required keys below
npm install
npm run db:migrate
```

### 2. Required API keys — you need to obtain these

| Env var | Where to get it | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com | Used for query expansion and slide synthesis. |
| `VOYAGE_API_KEY` | dash.voyageai.com | Used for embeddings (`voyage-3`) and reranking (`rerank-2`). Chosen because it's Anthropic's recommended embedding partner — swap `src/lib/embeddings.ts` if you'd rather use OpenAI or a local model. |

### 3. Strongly recommended

| Env var | Why |
|---|---|
| `SEMANTIC_SCHOLAR_API_KEY` | The unauthenticated endpoint hit a `429 Too Many Requests` during testing from this sandbox in under 20 seconds. Pulling 50 papers per topic reliably will need a key — apply at semanticscholar.org/product/api. Code already sends it as `x-api-key` when set; works without one, just don't count on it. |

### 4. Run it

```bash
npm run dev       # Next.js on :3000
npm run worker    # separate terminal — BullMQ consumer
```

Open http://localhost:3000, enter a topic, watch status poll through `ingesting → retrieving → synthesizing → assembling → complete`.

## Known gaps — decisions that need you, not a guess

1. **Branding** — `branding/brand.json` is a placeholder (colors, fonts, no logo). Swap in the real deep-research.intelliforge.tech brand kit when you have it; `generate_deck.py` reads it directly, no code change needed for color/font swaps.
2. **Storage** — generated `.pptx` files write to local disk (`generated/`, or `DECK_OUTPUT_DIR`). This only works when the API and worker share a filesystem. Before deploying with the worker and API on separate hosts (see below), `assembleDeck()` and the download route need to write/read from object storage instead — I didn't pick a provider (S3 / R2 / Supabase Storage) since that's an account you'll need to provision.
3. **Deployment topology** — see below. BullMQ-on-Vercel doesn't work; this needs a decision on where the worker runs.

## Deployment

**The brief asked for "Next.js API route → deploy to Vercel," but BullMQ requires a persistent worker process, which Vercel serverless functions cannot host.** I didn't paper over this — here's the actual split:

- **Next.js app (API + UI)** → Vercel, as intended. Set `DATABASE_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` as Vercel env vars.
- **Worker** (`npm run worker`) → needs a host that keeps a process running: Railway, Fly.io, Render, or a small persistent VM all work. A `Dockerfile` isn't included yet — say the word and I'll add one once you've picked a target.
- **Postgres** → needs pgvector support: Supabase, Neon (pgvector-enabled), or a self-hosted instance. Give me a connection string and I'll point `DATABASE_URL` at it.
- **Redis** → Upstash or Redis Cloud both work with BullMQ. Give me a connection string for `REDIS_URL`.

None of this is provisioned yet — I didn't want to create paid external resources without you choosing the providers. Tell me which you want for worker hosting / Postgres / Redis / object storage and I'll wire up the actual deployment.

## Project layout

```
src/app/api/          Next.js route handlers
src/lib/               shared modules: db, embeddings (Voyage), rag, synthesize (Claude),
                        semanticScholar, chunk, deck (Python subprocess bridge), queue
src/worker/             standalone BullMQ consumer + job orchestration
scripts/generate_deck.py   python-pptx deck assembly (no network calls)
db/schema.sql           Postgres + pgvector schema
branding/brand.json      placeholder brand config
docker-compose.yml       local Postgres+pgvector and Redis
```
