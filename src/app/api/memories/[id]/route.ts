import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
