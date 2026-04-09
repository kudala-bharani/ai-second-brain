-- ============================================================
-- AI Second Brain — Supabase Database Schema
-- ============================================================
-- Run this entire file in your Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================
--
-- Embedding model : BAAI/bge-small-en-v1.5  (HuggingFace, free)
-- Vector dims     : 384
-- LLM             : OpenRouter free models (Llama 3.1, Mistral, etc.)
-- ============================================================


-- ------------------------------------------------------------
-- 0. Extensions
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;


-- ------------------------------------------------------------
-- 1. Memories Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memories (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT,
  content     TEXT        NOT NULL,
  tags        TEXT[]      NOT NULL DEFAULT '{}',
  embedding   vector(384),           -- BAAI/bge-small-en-v1.5 = 384 dimensions
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for fast user-scoped queries
CREATE INDEX IF NOT EXISTS memories_user_id_idx
  ON public.memories (user_id);

-- IVFFlat index for approximate nearest-neighbour cosine search
-- Tune `lists` once you have > 1 000 rows:  lists ≈ sqrt(row_count)
CREATE INDEX IF NOT EXISTS memories_embedding_idx
  ON public.memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ------------------------------------------------------------
-- 2. Row-Level Security
-- ------------------------------------------------------------
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Each authenticated user sees only their own rows
CREATE POLICY "select_own_memories"
  ON public.memories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_memories"
  ON public.memories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_memories"
  ON public.memories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "update_own_memories"
  ON public.memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ------------------------------------------------------------
-- 3. Vector Similarity Search Function
-- ------------------------------------------------------------
-- Returns memories for a specific user ordered by cosine similarity.
-- Called from the Next.js API route via supabase.rpc('match_memories', {...})
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding   vector(384),     -- must match table column dimensions
  match_threshold   float,           -- minimum similarity score (0–1), e.g. 0.45
  match_count       int              -- max rows to return, e.g. 5
)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  title       text,
  content     text,
  tags        text[],
  created_at  timestamptz,
  similarity  float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id,
    m.user_id,
    m.title,
    m.content,
    m.tags,
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM  public.memories m
  WHERE m.user_id = auth.uid()
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ------------------------------------------------------------
-- 4. Grant execution rights on the RPC function
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.match_memories(vector(384), float, int)
  TO authenticated;

-- ------------------------------------------------------------
-- 5. Query History Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.query_history (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL,
  answer      TEXT        NOT NULL,
  sources     JSONB       NOT NULL DEFAULT '[]'::jsonb,
  meta        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  settings    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS query_history_user_id_created_at_idx
  ON public.query_history (user_id, created_at DESC);

ALTER TABLE public.query_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_query_history"
  ON public.query_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_own_query_history"
  ON public.query_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
