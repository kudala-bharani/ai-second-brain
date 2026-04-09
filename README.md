# AI Second Brain

A full-stack RAG-powered personal knowledge base. Store notes, edit and tag them, then ask questions and get answers grounded in your own data.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=flat-square&logo=supabase)
![OpenRouter](https://img.shields.io/badge/OpenRouter-free%20models-8b5cf6?style=flat-square)
![HuggingFace](https://img.shields.io/badge/HuggingFace-Embeddings-f59e0b?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)

## Current Stack

- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS
- Auth + DB + Vector store: Supabase + pgvector
- Embeddings: HuggingFace (`BAAI/bge-small-en-v1.5`, 384 dimensions)
- Generation: OpenRouter (model fallback list)

## Features

- Email/password auth with Supabase
- Add, edit, delete memories
- Tag memories and filter by search/tag
- Embedding-based retrieval with pgvector
- Unified Ask + Response panel
- Source evidence snippets with highlighted matched terms
- Recent question history with rerun
- Graceful provider fallback when model endpoints are unavailable

## Architecture

```text
User -> Next.js UI
         |
         +-- POST /api/memories
         |      -> HuggingFace embedding
         |      -> Supabase insert/update
         |
         +-- POST /api/query
                -> HuggingFace question embedding
                -> Supabase RPC: match_memories
                -> OpenRouter chat completion (fallback models)
                -> Answer + cited sources + evidence snippets
```

## Quick Start

### 1) Install

```bash
git clone https://github.com/kudala-bharani/ai-second-brain.git
cd ai-second-brain
npm install
```

### 2) Configure environment

Copy `.env.local.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
HUGGINGFACE_API_KEY=hf_your_token
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3) Set up Supabase schema

Run in Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/migration_feature_upgrade.sql` (required for latest features)

`migration_feature_upgrade.sql` adds:
- `tags` column on `memories`
- update policy for editing memories
- hardened `match_memories` bound to `auth.uid()`

### 4) Run locally

```bash
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Important Notes

- Embeddings are **384-dim**. Keep DB schema and RPC signatures aligned to 384.
- Free OpenRouter models can be temporarily unavailable; the app uses model fallback and provider-down fallback messaging.
- `.env.local` is gitignored and should never be committed.

## Useful Endpoints

- `GET /api/test-embedding`: provider diagnostics (useful in development)
- `POST /api/memories`: create memory (title/content/tags)
- `PATCH /api/memories/:id`: edit memory + re-embedding
- `DELETE /api/memories/:id`: delete memory
- `POST /api/query`: ask question against stored notes

## Deployment (Vercel)

Set these environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `HUGGINGFACE_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## License

MIT (see `LICENSE` if present).