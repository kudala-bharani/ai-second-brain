-- ============================================================
-- Migration: OpenAI (1536-dim) → Free Stack (384-dim)
-- ============================================================
-- Run this in Supabase SQL Editor ONLY if you previously ran
-- the original schema.sql that used vector(1536).
--
-- If you are setting up for the first time, run schema.sql
-- instead — you do NOT need this file.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Drop the old vector index (required before altering type)
-- ------------------------------------------------------------
DROP INDEX IF EXISTS public.memories_embedding_idx;


-- ------------------------------------------------------------
-- 2. Clear any existing embeddings (they are 1536-dim and
--    incompatible with the new 384-dim column)
-- ------------------------------------------------------------
UPDATE public.memories SET embedding = NULL;


-- ------------------------------------------------------------
-- 3. Change the embedding column to 384 dimensions
--    (BAAI/bge-small-en-v1.5 via HuggingFace free API)
-- ------------------------------------------------------------
ALTER TABLE public.memories
  ALTER COLUMN embedding TYPE vector(384)
  USING NULL;  -- cast via NULL since old values were wiped above


-- ------------------------------------------------------------
-- 4. Recreate the IVFFlat index for 384-dim cosine search
-- ------------------------------------------------------------
CREATE INDEX memories_embedding_idx
  ON public.memories
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);


-- ------------------------------------------------------------
-- 5. Drop the old match_memories function (1536-dim signature)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.match_memories(vector(1536), float, int, uuid);

-- Also drop the generic overload in case it was created that way
DROP FUNCTION IF EXISTS public.match_memories(vector, float, int, uuid);


-- ------------------------------------------------------------
-- 6. Recreate match_memories with 384-dim signature
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding   vector(384),
  match_threshold   float,
  match_count       int,
  user_id_filter    uuid
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
-- 7. Re-grant execute rights
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.match_memories(vector(384), float, int, uuid)
  TO authenticated;


-- ------------------------------------------------------------
-- Done!
-- Your memories table now uses 384-dim embeddings.
-- Re-save any existing notes so they get fresh embeddings.
-- ------------------------------------------------------------
