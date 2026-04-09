import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/openai";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: "Memory ID is required" },
        { status: 400 },
      );
    }

    // Delete the memory — RLS ensures users can only delete their own rows
    const { error: deleteError, count } = await supabase
      .from("memories")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("[DELETE /api/memories/:id] Supabase error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete memory" },
        { status: 500 },
      );
    }

    if (count === 0) {
      return NextResponse.json(
        { error: "Memory not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: { id, deleted: true } }, { status: 200 });
  } catch (error) {
    console.error("[DELETE /api/memories/:id] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Memory ID is required" }, { status: 400 });
    }

    let body: { title?: string; content?: string; tags?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const title = body.title?.trim() || null;
    const content = body.content?.trim();
    const tags = (body.tags ?? [])
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);

    if (!content) {
      return NextResponse.json({ error: "Content is required." }, { status: 400 });
    }

    const textToEmbed = title ? `${title}\n\n${content}` : content;
    let embedding: number[];
    try {
      embedding = await generateEmbedding(textToEmbed);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Embedding failed: ${detail}` }, { status: 502 });
    }

    const { data, error } = await supabase
      .from("memories")
      .update({
        title,
        content,
        tags,
        embedding: JSON.stringify(embedding),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, user_id, title, content, tags, created_at")
      .single();

    if (error) {
      console.error("[PATCH /api/memories/:id] Supabase error:", error);
      return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("[PATCH /api/memories/:id] Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
