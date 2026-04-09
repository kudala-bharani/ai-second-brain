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

-- No UPDATE policy intentionally — memories are immutable once saved


-- ------------------------------------------------------------
-- 3. Vector Similarity Search Function
-- ------------------------------------------------------------
-- Returns memories for a specific user ordered by cosine similarity.
-- Called from the Next.js API route via supabase.rpc('match_memories', {...})
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding   vector(384),     -- must match table column dimensions
  match_threshold   float,           -- minimum similarity score (0–1), e.g. 0.45
  match_count       int,             -- max rows to return, e.g. 5
  user_id_filter    uuid             -- restrict results to this user
)
RETURNS TABLE (
  id          uuid,
  user_id     uuid,
  title       text,
  content     text,
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
    m.created_at,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM  public.memories m
  WHERE m.user_id = user_id_filter
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;


-- ------------------------------------------------------------
-- 4. Grant execution rights on the RPC function
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.match_memories(vector(384), float, int, uuid)
  TO authenticated;
