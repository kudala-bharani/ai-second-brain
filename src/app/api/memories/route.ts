import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/openai";
import type { Memory } from "@/types";

// Force dynamic rendering — API routes must not be statically evaluated at build time
export const dynamic = "force-dynamic";

// ─── GET /api/memories ────────────────────────────────────────────────────────
// Returns all memories for the currently authenticated user, newest first.

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("memories")
      .select("id, user_id, title, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/memories] Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch memories." },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data as Memory[] });
  } catch (err) {
    console.error("[GET /api/memories] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}

// ─── POST /api/memories ───────────────────────────────────────────────────────
// Creates a new memory: generates an embedding and stores everything in Supabase.
//
// Request body:
//   { title?: string; content: string }

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse + validate body ──────────────────────────────────────────────────
    let body: { title?: string; content?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 },
      );
    }

    const content = body.content?.trim();
    const title = body.title?.trim() || null;

    if (!content || content.length === 0) {
      return NextResponse.json(
        { error: "Content is required and cannot be empty." },
        { status: 400 },
      );
    }

    if (content.length > 10_000) {
      return NextResponse.json(
        { error: "Content exceeds the maximum length of 10 000 characters." },
        { status: 400 },
      );
    }

    // ── Generate embedding ────────────────────────────────────────────────────
    // We embed "title + content" so the title influences similarity matching.
    const textToEmbed = title ? `${title}\n\n${content}` : content;

    let embedding: number[];
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (embeddingError) {
      const detail =
        embeddingError instanceof Error
          ? embeddingError.message
          : String(embeddingError);
      console.error("[POST /api/memories] Embedding error:", detail);
      return NextResponse.json(
        {
          error: `Embedding failed: ${detail}`,
        },
        { status: 502 },
      );
    }

    // ── Persist to Supabase ───────────────────────────────────────────────────
    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: user.id,
        title,
        content,
        embedding: JSON.stringify(embedding), // pgvector accepts a JSON array string
      })
      .select("id, user_id, title, content, created_at")
      .single();

    if (error) {
      console.error("[POST /api/memories] Supabase insert error:", error);
      return NextResponse.json(
        { error: "Failed to save memory." },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: data as Memory }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/memories] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
