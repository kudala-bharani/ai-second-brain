-- ============================================================
-- Migration: feature upgrade (tags + editable memories + safer RPC)
-- ============================================================

-- 1) Add tags to memories
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

-- 2) Allow owners to update their own memories
CREATE POLICY "update_own_memories"
  ON public.memories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3) Harden match_memories so caller cannot query other users
DROP FUNCTION IF EXISTS public.match_memories(vector(384), float, int, uuid);
DROP FUNCTION IF EXISTS public.match_memories(vector(384), float, int);

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding   vector(384),
  match_threshold   float,
  match_count       int
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
  FROM public.memories m
  WHERE m.user_id = auth.uid()
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_memories(vector(384), float, int)
  TO authenticated;
