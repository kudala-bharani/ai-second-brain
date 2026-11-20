import { NextRequest, NextResponse } from "next/server";
import { runChatTurn } from "@/lib/chat-turn";
import { createClient } from "@/lib/supabase/server";
import type { ChatMemoryMode, ChatReference, QueryControls } from "@/types";

export const dynamic = "force-dynamic";

const DEFAULT_MODELS = (process.env.OPENROUTER_MODELS ?? "openrouter/free")
  .split(",")
  .map((model) => model.trim())
  .filter(Boolean);
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function parseReference(value: unknown): ChatReference | undefined {
  if (!value || typeof value !== "object" || !("question" in value)
    || typeof value.question !== "string") return undefined;
  const sourceIds = "sourceIds" in value && Array.isArray(value.sourceIds)
    ? value.sourceIds.slice(0, 5).filter((id): id is string => typeof id === "string" && UUID.test(id))
    : [];
  const historyId = "historyId" in value && typeof value.historyId === "string" && UUID.test(value.historyId)
    ? value.historyId : undefined;
  return {
    question: value.question.slice(0, 2000),
    sourceIds: [...new Set(sourceIds)],
    ...(historyId ? { historyId } : {}),
  };
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const client = createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    let body: { question?: unknown; controls?: QueryControls; memoryMode?: unknown; reference?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }

    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (question.length < 3 || question.length > 2000) {
      return NextResponse.json({ error: "Enter a message between 3 and 2,000 characters." }, { status: 400 });
    }

    const strictness = boundedNumber(body.controls?.strictness, 0.45, 0.1, 0.95);
    const maxSources = Math.round(boundedNumber(body.controls?.maxSources, 5, 1, 10));
    const requestedModels = Array.isArray(body.controls?.modelOrder) ? body.controls.modelOrder : [];
    const modelOrder = [...new Set(requestedModels.filter((model) => DEFAULT_MODELS.includes(model)))];
    const models = [...new Set([...modelOrder, ...DEFAULT_MODELS, "openrouter/free"])];
    const memoryMode: ChatMemoryMode = body.memoryMode === "auto" || body.memoryMode === "manual"
      ? body.memoryMode : "read-only";
    const result = await runChatTurn(client, user.id, {
      message: question,
      mode: memoryMode,
      reference: parseReference(body.reference),
      strictness,
      maxSources,
      models,
    });

    const pending = result.meta?.pendingContactUpdate;
    try {
      const insert = client.from("query_history").insert({
        user_id: user.id,
        question,
        answer: result.answer,
        sources: result.sources,
        meta: result.meta ?? {},
        settings: { strictness, maxSources, modelOrder: models, memoryMode },
      });
      if (pending) {
        const { data, error } = await insert.select("id").single();
        if (error || typeof data?.id !== "string" || !UUID.test(data.id)) throw new Error("Missing history ID");
        result.historyId = data.id;
      } else {
        const { error } = await insert;
        if (error) throw error;
      }
    } catch {
      console.warn("[query] could not save history");
      if (result.meta?.pendingContactUpdate) {
        delete result.meta.pendingContactUpdate;
        // Replace the clarification and preserve any separate notebook answer.
        const [, ...rest] = result.answer.split("\n\n");
        result.answer = ["I couldn’t keep this correction open. Send the full update with the new value in one message.", ...rest].join("\n\n");
      }
    }
    return NextResponse.json({ data: result });
  } catch {
    console.error("[query] chat turn failed");
    return NextResponse.json({ error: "Something went wrong while processing your message. Try again." }, { status: 500 });
  }
}
