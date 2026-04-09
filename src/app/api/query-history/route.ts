import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { QueryHistoryItem, QueryResult } from "@/types";

export const dynamic = "force-dynamic";

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
      .from("query_history")
      .select("id, question, answer, sources, meta, settings, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: "Failed to fetch query history" }, { status: 500 });
    }

    const history: QueryHistoryItem[] = (data ?? []).map((row) => ({
      id: row.id as string,
      question: row.question as string,
      createdAt: row.created_at as string,
      settingsSnapshot: (row.settings as QueryHistoryItem["settingsSnapshot"]) ?? {},
      result: {
        answer: row.answer as string,
        sources: (row.sources as QueryResult["sources"]) ?? [],
        meta: (row.meta as QueryResult["meta"]) ?? {},
      },
    }));

    return NextResponse.json({ data: history });
  } catch (err) {
    console.error("[GET /api/query-history] Unexpected error:", err);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
