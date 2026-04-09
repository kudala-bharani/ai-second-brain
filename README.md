# 🧠 AI Second Brain

> A full-stack RAG-powered personal knowledge base. Store your notes, ask questions, and get AI answers grounded **exclusively** in your own data.

## Upgrade Notes (Current)

- Unified Q&A panel (question input + answer + sources in one section)
- Runtime query controls in UI:
  - strictness slider
  - max source count
  - model order override (comma-separated OpenRouter models)
- Source evidence snippets with term highlighting
- Editable memories (`PATCH /api/memories/:id`) with automatic re-embedding
- Memory tags support + tag/date/text filtering
- Local persistent query settings and recent question history with rerun

### Required migration for these features

Run:

- `supabase/migration_feature_upgrade.sql`

This adds:

- `tags` column on `memories`
- update policy for editing memories
- hardened `match_memories` function bound to `auth.uid()`

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=flat-square&logo=supabase)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=flat-square&logo=openai)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwind-css)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Authentication** | Email/password sign-up & login via Supabase Auth |
| 📝 **Add Memory** | Paste or type notes with an optional title |
| 🔍 **Vector Search** | Embeddings via `text-embedding-3-small` + pgvector cosine similarity |
| 🤖 **RAG Queries** | Ask questions — GPT-4o-mini answers **only** from your stored notes |
| 📋 **Memory List** | Browse, search, preview, and delete your stored notes |
| 🏷️ **Source Attribution** | Every answer shows which notes it was grounded in |
| 👤 **Multi-user** | Row-Level Security ensures complete data isolation |

---

## 🏗️ Architecture

```
User → Next.js Frontend (React)
           │
           ├─ POST /api/memories  → OpenAI Embeddings → Supabase (pgvector)
           │
           └─ POST /api/query
                  │
                  ├─ 1. Embed question   (OpenAI text-embedding-3-small)
                  ├─ 2. Vector search    (Supabase RPC: match_memories)
                  ├─ 3. Build context    (top-5 relevant notes)
                  └─ 4. Generate answer  (GPT-4o-mini, grounded prompt)
```

### Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS |
| **Backend** | Next.js API Routes (Edge-compatible) |
| **Auth** | Supabase Auth (email/password) |
| **Database** | Supabase PostgreSQL |
| **Vector Store** | Supabase pgvector (IVFFlat index, cosine similarity) |
| **Embeddings** | OpenAI `text-embedding-3-small` (1536 dims) |
| **LLM** | OpenAI `gpt-4o-mini` |
| **Deployment** | Vercel |

### Data Model

```sql
Table: public.memories
┌─────────────┬──────────────────┬──────────────────────────────────────┐
│ Column      │ Type             │ Notes                                │
├─────────────┼──────────────────┼──────────────────────────────────────┤
│ id          │ uuid             │ Primary key (gen_random_uuid)        │
│ user_id     │ uuid             │ FK → auth.users (CASCADE DELETE)     │
│ title       │ text             │ Optional note title                  │
│ content     │ text             │ Full note content                    │
│ embedding   │ vector(1536)     │ OpenAI text-embedding-3-small output │
│ created_at  │ timestamptz      │ Auto-set on insert                   │
└─────────────┴──────────────────┴──────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm** / **pnpm** / **yarn**
- A **Supabase** project ([free tier](https://supabase.com) works fine)
- An **OpenAI** API key with access to `text-embedding-3-small` and `gpt-4o-mini`

---

### 1. Clone & Install

```bash
git clone https://github.com/your-username/ai-second-brain.git
cd ai-second-brain
npm install
```

---

### 2. Configure Environment Variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
OPENAI_API_KEY=sk-your-openai-api-key
```

**Where to find these values:**

| Variable | Location |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key |
| `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

---

### 3. Set Up the Database

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor → New Query**
3. Copy the entire contents of `supabase/schema.sql`
4. Paste it into the editor and click **Run**

This will:
- Enable the `vector` extension (pgvector)
- Create the `memories` table with a `vector(1536)` column
- Create an IVFFlat cosine index for fast similarity search
- Enable Row-Level Security (RLS) with per-user isolation policies
- Create the `match_memories` RPC function used for vector search

> **Note:** If you get an error about `vector` extension not being available, go to  
> **Database → Extensions** and enable **vector** manually first.

---

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

---

## 📁 Project Structure

```
ai-second-brain/
├── supabase/
│   └── schema.sql              # Full DB schema + RLS + RPC function
│
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout (metadata, fonts)
│   │   ├── page.tsx            # Root redirect (→ /dashboard or /auth/login)
│   │   ├── globals.css         # Tailwind base + custom design system
│   │   │
│   │   ├── auth/
│   │   │   ├── login/page.tsx  # Login form
│   │   │   └── signup/page.tsx # Signup form with password strength meter
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Main dashboard (client component)
│   │   │
│   │   └── api/
│   │       ├── memories/
│   │       │   ├── route.ts        # GET (list) + POST (create + embed)
│   │       │   └── [id]/route.ts   # DELETE
│   │       └── query/
│   │           └── route.ts        # POST — full RAG pipeline
│   │
│   ├── components/
│   │   ├── Header.tsx          # Sticky nav with user menu + logout
│   │   ├── AddMemory.tsx       # Note creation form
│   │   ├── AskQuestion.tsx     # Question input with loading steps
│   │   ├── AIResponse.tsx      # Answer + source cards + markdown renderer
│   │   └── MemoryList.tsx      # Searchable list of notes with delete
│   │
│   ├── lib/
│   │   ├── openai.ts           # OpenAI client + generateEmbedding()
│   │   └── supabase/
│   │       ├── client.ts       # Browser Supabase client
│   │       └── server.ts       # Server Supabase client (SSR cookies)
│   │
│   └── types/
│       └── index.ts            # Shared TypeScript interfaces
│
├── middleware.ts                # Auth guard — redirects unauthenticated users
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── .env.local.example
```

---

## 🔁 RAG Pipeline (Step by Step)

### Adding a Memory

```
1. User fills in title (optional) + content
2. POST /api/memories
3. Server generates embedding: OpenAI text-embedding-3-small(content)
4. INSERT INTO memories (user_id, title, content, embedding)
5. Memory card appears instantly in the UI
```

### Asking a Question

```
1. User types a question
2. POST /api/query { question }
3. Server embeds the question
4. Supabase RPC: match_memories(query_embedding, threshold=0.45, limit=5)
   └─ Returns top-5 notes by cosine similarity
5. Build context: join note titles + content
6. Send to GPT-4o-mini with strict system prompt:
   "Answer ONLY from the provided context. If not found, say you don't know."
7. Return { answer, sources[] } to the client
8. UI renders answer + collapsible source cards with similarity scores
```

---

## 🎨 UI Design System

The app uses a custom dark theme built on Tailwind CSS:

| Token | Value | Usage |
|---|---|---|
| `surface-900` | `#0f0f18` | Page background |
| `surface-800` | `#16161f` | Card backgrounds |
| `surface-700` | `#1c1c28` | Input backgrounds |
| `brand-500` | `#6366f1` | Primary accent (indigo) |
| `brand-400` | `#818cf8` | Links, icons |

Custom utilities: `.card`, `.btn`, `.btn-primary`, `.input`, `.textarea`, `.label`, `.badge-*`, `.prose-answer`

---

## 🚢 Deployment (Vercel)

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/ai-second-brain)

### Manual Deploy

1. Push your code to GitHub
2. Import the repository at [vercel.com/new](https://vercel.com/new)
3. Add the three environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
4. Click **Deploy**

> The `OPENAI_API_KEY` is a **server-only** variable — it is never exposed to the browser.

---

## 🔒 Security

- **Row-Level Security (RLS)** is enabled on `memories` — users can only SELECT, INSERT, and DELETE their own rows
- **Server-side auth checks** on every API route via `supabase.auth.getUser()`
- **Middleware** protects all non-auth routes
- `OPENAI_API_KEY` is accessed only in server-side API routes
- No user data is sent to OpenAI beyond what's needed for embeddings/generation

---

## ⚙️ Configuration

| Setting | File | Default | Description |
|---|---|---|---|
| `MATCH_THRESHOLD` | `api/query/route.ts` | `0.45` | Min cosine similarity to include a note |
| `MATCH_COUNT` | `api/query/route.ts` | `5` | Max notes retrieved as context |
| `MAX_CONTEXT_CHARS` | `api/query/route.ts` | `8000` | Max characters sent to the LLM |
| `LLM model` | `api/query/route.ts` | `gpt-4o-mini` | Change to `gpt-4o` for better quality |
| `temperature` | `api/query/route.ts` | `0.2` | Lower = more faithful to context |
| `MAX_CONTENT_LENGTH` | `components/AddMemory.tsx` | `10000` | Max characters per note |

---

## 🛠️ Local Development Tips

### Supabase Auth Email Confirmation

By default, Supabase requires email confirmation. For local development, disable it:

1. Go to **Supabase Dashboard → Authentication → Providers → Email**
2. Turn off **"Confirm email"**

### Viewing Stored Embeddings

```sql
-- In Supabase SQL Editor
SELECT id, title, LEFT(content, 80) as preview, created_at
FROM memories
ORDER BY created_at DESC;
```

### Testing Vector Search

```sql
-- Test the match_memories function directly
SELECT * FROM match_memories(
  '[0.1, 0.2, ...]'::vector(1536),  -- replace with a real embedding
  0.4,
  5,
  'your-user-uuid'::uuid
);
```

---

## 📝 Environment Variables Reference

| Variable | Required | Public | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Supabase project REST URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | Supabase anonymous/public key |
| `OPENAI_API_KEY` | ✅ | ❌ | OpenAI API key (server-only) |

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ using **Next.js**, **Supabase**, and **OpenAI**

</div>