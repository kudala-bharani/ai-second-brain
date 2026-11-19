import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createMemory, MEMORY_COLUMNS, MemoryStoreError } from "@/lib/memory-store";
import type { Memory } from "@/types";

// Force dynamic rendering — API routes must not be statically evaluated at build time
export const dynamic = "force-dynamic";

// ─── GET /api/memories ────────────────────────────────────────────────────────
// Returns all memories for the currently authenticated user, newest first.

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim();
    const tag = params.get("tag")?.trim();
    const startDate = params.get("startDate")?.trim();
    const endDate = params.get("endDate")?.trim();

    let query = supabase
      .from("memories")
      .select(MEMORY_COLUMNS)
      .eq("user_id", user.id);

    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }
    if (tag) {
      query = query.contains("tags", [tag]);
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

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
    let body: { title?: string; content?: string; tags?: string[] };
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
    const tags = (body.tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

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

    const data = await createMemory(supabase, user.id, { title, content, tags });
    if (!data) {
      return NextResponse.json(
        { error: "Failed to save memory." },
        { status: 500 },
      );
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    if (err instanceof MemoryStoreError) {
      console.error("[POST /api/memories] Save error:", err);
      return err.kind === "embedding"
        ? NextResponse.json({ error: "Failed to embed memory." }, { status: 502 })
        : NextResponse.json({ error: "Failed to save memory." }, { status: 500 });
    }
    console.error("[POST /api/memories] Unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
