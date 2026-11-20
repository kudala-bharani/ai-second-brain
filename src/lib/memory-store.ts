import "server-only";

import { generateEmbedding } from "@/lib/embeddings";
import type { createClient } from "@/lib/supabase/server";
import type { Memory } from "@/types";

export type MemoryClient = ReturnType<typeof createClient>;
export const MEMORY_COLUMNS = "id, user_id, title, content, tags, created_at";

interface MemoryDraft {
  title: string | null;
  content: string;
  tags: string[];
}

export class MemoryStoreError extends Error {
  constructor(
    readonly kind: "embedding" | "database",
    cause?: unknown,
  ) {
    super(kind === "embedding" ? "Failed to embed memory" : "Memory write failed", {
      cause,
    });
    this.name = "MemoryStoreError";
  }
}

async function embedMemory({ title, content }: MemoryDraft, allowUnindexed = false) {
  try {
    return JSON.stringify(await generateEmbedding(title ? `${title}\n\n${content}` : content));
  } catch (error) {
    if (allowUnindexed) {
      console.warn("[memory-store] saving without an embedding");
      return null;
    }
    throw new MemoryStoreError("embedding", error);
  }
}

function ownedMemory(data: Memory | null, userId: string): Memory {
  if (!data || data.user_id !== userId) {
    throw new MemoryStoreError("database");
  }
  return data;
}

export async function createMemory(
  client: MemoryClient,
  userId: string,
  draft: MemoryDraft,
  options?: { id?: string; allowUnindexed?: boolean },
): Promise<Memory | null> {
  const { data, error } = await client
    .from("memories")
    .insert({
      ...draft,
      ...(options?.id ? { id: options.id } : {}),
      user_id: userId,
      embedding: await embedMemory(draft, options?.allowUnindexed),
    })
    .select(MEMORY_COLUMNS)
    .single();

  if (options?.id && error?.code === "23505") return null;
  if (error) throw new MemoryStoreError("database", error);
  return ownedMemory(data, userId);
}

export async function updateMemory(
  client: MemoryClient,
  userId: string,
  id: string,
  draft: MemoryDraft,
  expected?: Pick<MemoryDraft, "title" | "content">,
): Promise<Memory | null> {
  const { title, content, tags } = draft;
  let query = client
    .from("memories")
    .update({
      title,
      content,
      // A chat edit only changes the text. Preserve any concurrent tag edit.
      ...(expected ? {} : { tags }),
      // An optimistic chat edit can be retrieved by text until it is indexed again.
      embedding: await embedMemory(draft, !!expected),
    })
    .eq("id", id)
    .eq("user_id", userId);

  if (expected) {
    query = query.eq("content", expected.content);
    query = expected.title === null
      ? query.is("title", null)
      : query.eq("title", expected.title);
  }

  const { data, error } = await query.select(MEMORY_COLUMNS).maybeSingle();
  if (error) throw new MemoryStoreError("database", error);
  return data ? ownedMemory(data, userId) : null;
}
