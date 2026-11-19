# 🧠 AI Second Brain

> 🚀 A production-ready RAG-based AI system that enables users to store, retrieve, and query personal knowledge using semantic search and LLMs.

🔗 **Live Demo:** https://ai-second-brain-beige.vercel.app/

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?style=flat-square&logo=supabase)
![OpenRouter](https://img.shields.io/badge/OpenRouter-LLM%20Gateway-8b5cf6?style=flat-square)
![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-Embeddings-f59e0b?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square&logo=tailwind-css)

---

## ✨ Features

| Feature                     | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| 🔐 **Authentication**       | Email/password sign-up & login via Supabase Auth                             |
| 📝 **Add + Edit Memories**  | Create, update, and delete memories with automatic re-embedding              |
| 🏷️ **Tagging**              | Add tags to memories and filter your notes by tag/search                     |
| 🔍 **Vector Search**        | Semantic retrieval using local BGE embeddings + pgvector cosine similarity |
| 🤖 **RAG Q&A**              | Ask questions and get answers constrained to your stored notes               |
| 📌 **Source Evidence**      | Answers include source notes and evidence snippets with term highlighting    |
| 🕘 **Question History**     | Recent queries are saved locally with one-click rerun                        |
| 👤 **Multi-user Isolation** | RLS policies ensure each user only accesses their own memories               |
| 🛡️ **Provider Resilience**  | OpenRouter model fallback + graceful provider-down response behavior         |

---

## 🏗️ Architecture

```text
User -> Next.js Frontend (React)
          |
          +-- POST /api/memories
          |      -> Local BGE embedding (BAAI/bge-small-en-v1.5)
          |      -> Supabase insert/update (content + tags + vector)
          |
          +-- POST /api/query
                 -> Question embedding (local BGE)
                 -> Supabase RPC: match_memories
                 -> Prompt assembly with retrieved notes
                 -> OpenRouter LLM completion (fallback model order)
                 -> Answer + cited sources + evidence snippets
```

### Tech Stack

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| **Frontend**     | Next.js 14 (App Router), React 18, Tailwind CSS |
| **Backend**      | Next.js API Routes                              |
| **Auth**         | Supabase Auth (email/password)                  |
| **Database**     | Supabase PostgreSQL                             |
| **Vector Store** | Supabase pgvector (cosine similarity)           |
| **Embeddings**   | ONNX Runtime, `BAAI/bge-small-en-v1.5` (384 dims) |
| **LLM Gateway**  | OpenRouter                                      |
| **Deployment**   | Vercel                                          |

### Data Model (Current)

```sql
Table: public.memories
┌─────────────┬──────────────────┬───────────────────────────────────────────────┐
│ Column      │ Type             │ Notes                                         │
├─────────────┼──────────────────┼───────────────────────────────────────────────┤
│ id          │ uuid             │ Primary key (gen_random_uuid)                 │
│ user_id     │ uuid             │ FK -> auth.users (CASCADE DELETE)             │
│ title       │ text             │ Optional memory title                          │
│ content     │ text             │ Full note content                              │
│ tags        │ text[]           │ Optional tags (default '{}')                  │
│ embedding   │ vector(384)      │ BGE embedding output                           │
│ created_at  │ timestamptz      │ Auto-set on insert                             │
└─────────────┴──────────────────┴───────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- A **Supabase** project ([free tier](https://supabase.com) works)
- An **OpenRouter** API key

---

### 1) Clone & Install

```bash
git clone https://github.com/kudala-bharani/ai-second-brain.git
cd ai-second-brain
npm install
```

---

### 2) Configure Environment Variables

Copy `.env.local.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Where to get them:

| Variable                        | Location                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Dashboard -> Project Settings -> API                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard -> Project Settings -> API (`anon` key)               |
| `OPENROUTER_API_KEY`            | [openrouter.ai/keys](https://openrouter.ai/keys)                         |

---

### 3) Set Up Database

In Supabase SQL editor, run:

1. `supabase/schema.sql`
2. `supabase/migration_feature_upgrade.sql` (required for latest memory editing/tags/security updates)

`migration_feature_upgrade.sql` includes:

- `tags` column on `memories`
- `UPDATE` RLS policy for own memories
- Hardened `match_memories` (bound to `auth.uid()`)

---

### 4) Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔁 RAG Flow (Current)

### Adding/Editing a Memory

```text
1. User enters title/content/tags
2. API embeds title+content with the local BGE model
3. API writes memory + embedding + tags to Supabase
4. UI refreshes memory list
```

### Asking a Question

```text
1. User submits question
2. API embeds the question
3. Supabase RPC returns top semantic matches
4. API builds grounded prompt from matched notes
5. OpenRouter generates answer (with fallback model order)
6. API returns answer + related source notes + evidence snippets
```

---

## ⚙️ Configuration Notes

- Embeddings use the existing **384-dimensional BGE model** locally, with CLS pooling and L2 normalization. The checked-in [ONNX export](https://huggingface.co/Xenova/bge-small-en-v1.5/tree/ea104dacec62c0de699686887e3f920caeb4f3e3) is pinned to that model.
- Query history/settings are currently stored in browser localStorage.
- Free model availability can vary; fallback behavior is built in.

---

## 🧪 Useful API Endpoints

| Route                      | Purpose                                   |
| -------------------------- | ----------------------------------------- |
| `GET /api/test-embedding`  | Check that the local embedding model loads |
| `GET /api/memories`        | Fetch user memories                       |
| `POST /api/memories`       | Create memory (title/content/tags)        |
| `PATCH /api/memories/:id`  | Edit memory + re-embed                    |
| `DELETE /api/memories/:id` | Delete memory                             |
| `POST /api/query`          | Ask grounded question                     |

---

## 🚢 Deployment (Vercel)

Set these environment variables in Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_APP_URL`

---

## 📧 Email Verification Setup

After deploying to Vercel, you need to configure Supabase email verification to work with your production domain.

### Quick Setup:

1. **Get your Vercel URL** (e.g., `https://your-app-name.vercel.app`)

2. **Update Supabase Dashboard:**
   - Go to **Authentication** → **URL Configuration**
   - Set **Site URL** to your production URL
   - Add to **Redirect URLs**:
     ```
     http://localhost:3000/auth/callback
     https://your-app-name.vercel.app/auth/callback
     ```

3. **Update Vercel Environment Variable:**
   - Add `NEXT_PUBLIC_APP_URL=https://your-app-name.vercel.app`

4. **Test:** Sign up with a new email and verify the link redirects correctly

📖 **Detailed guide:** See [SUPABASE_EMAIL_SETUP.md](./SUPABASE_EMAIL_SETUP.md) for complete instructions, troubleshooting, and multi-environment setup.

---

## 🔒 Security

- RLS on `memories` enforces per-user data isolation
- Server-side user checks in API routes via `supabase.auth.getUser()`
- Provider keys remain server-side
- `.env.local` is gitignored and should never be committed

---

## 📄 License

MIT

---

<div align="center">
Built with Next.js, Supabase, OpenRouter, and ONNX Runtime.
</div>
