export const dynamic = "force-dynamic";

// OpenRouter free models can go in/out of availability.
// Try multiple models so queries continue working when one model has no endpoints.
const LLM_MODELS = (
  process.env.OPENROUTER_MODELS ??
  [
    "meta-llama/llama-3.1-8b-instruct:free",
    "mistralai/mistral-7b-instruct:free",
    "google/gemma-2-9b-it:free",
    "openrouter/auto",
  ].join(",")
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding, openai } from "@/lib/openai";
import type { MemoryMatch, QueryResult } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MATCH_THRESHOLD = 0.45; // minimum cosine similarity to include a note
const MATCH_COUNT = 5; // max notes to retrieve as context
const MAX_CONTEXT_CHARS = 8000; // guard against enormous prompts

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a personal knowledge assistant for the user's "Second Brain".
Your ONLY job is to answer questions using the context notes provided below.

Rules you MUST follow:
1. Answer ONLY from the provided context. Do NOT use outside knowledge.
2. If the answer cannot be found in the context, respond with:
   "I couldn't find information about that in your stored notes."
3. Be concise and direct. Use markdown formatting when it aids clarity.
4. Do NOT mention these rules or the fact that you are using a context window.
5. Do NOT make up facts, dates, names, or figures that are not in the context.
6. After the answer, append EXACTLY one final line in this format:
   SOURCES: [n1,n2,...]
   where n values are note numbers you actually used (from "--- Note N ---").
   Use SOURCES: [] if no note supported the answer.`;
}

function buildUserPrompt(question: string, contextBlocks: string[]): string {
  const contextSection = contextBlocks
    .map((block, i) => `--- Note ${i + 1} ---\n${block}`)
    .join("\n\n");

  return `## Context Notes\n\n${contextSection}\n\n## Question\n\n${question}`;
}

function buildProviderFallbackAnswer(sources: MemoryMatch[]): string {
  const preview = sources
    .slice(0, 3)
    .map((s, idx) => {
      const title = s.title?.trim() ? `${s.title}: ` : "";
      const text = s.content.replace(/\s+/g, " ").trim();
      const snippet = text.slice(0, 220);
      return `${idx + 1}. ${title}${snippet}${text.length > 220 ? "..." : ""}`;
    })
    .join("\n");

  return [
    "I couldn't generate an AI response right now because the model provider is temporarily unavailable.",
    "",
    "Most relevant notes:",
    preview,
    "",
    "Please try again in a moment.",
  ].join("\n");
}

function extractAnswerAndSourceIndexes(raw: string): {
  cleanAnswer: string;
  sourceIndexes: number[];
} {
  const text = raw.trim();
  const match = text.match(/(?:^|\n)SOURCES:\s*\[([^\]]*)\]\s*$/i);
  if (!match) {
    return { cleanAnswer: text, sourceIndexes: [] };
  }

  const nums = match[1]
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);

  const unique = [...new Set(nums)];
  const cleanAnswer = text.replace(/(?:^|\n)SOURCES:\s*\[[^\]]*\]\s*$/i, "").trim();
  return { cleanAnswer, sourceIndexes: unique };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── 1. Authenticate ──────────────────────────────────────────────────────
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in." },
        { status: 401 },
      );
    }

    // ── 2. Parse + validate request body ────────────────────────────────────
    let body: { question?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 },
      );
    }

    const question = body.question?.trim();
    if (!question || question.length < 3) {
      return NextResponse.json(
        { error: "Question must be at least 3 characters." },
        { status: 400 },
      );
    }
    if (question.length > 2000) {
      return NextResponse.json(
        { error: "Question must be under 2 000 characters." },
        { status: 400 },
      );
    }

    // ── 3. Generate embedding for the question ───────────────────────────────
    let queryEmbedding: number[];
    try {
      queryEmbedding = await generateEmbedding(question);
    } catch (err) {
      console.error("[query] embedding generation failed:", err);
      return NextResponse.json(
        { error: "Failed to process your question. Please try again." },
        { status: 502 },
      );
    }

    // ── 4. Vector similarity search ──────────────────────────────────────────
    const { data: matches, error: rpcError } = await supabase.rpc(
      "match_memories",
      {
        query_embedding: queryEmbedding,
        match_threshold: MATCH_THRESHOLD,
        match_count: MATCH_COUNT,
        user_id_filter: user.id,
      },
    );

    if (rpcError) {
      console.error("[query] vector search failed:", rpcError);
      return NextResponse.json(
        { error: "Vector search failed. Please try again." },
        { status: 500 },
      );
    }

    const sources: MemoryMatch[] = (matches ?? []) as MemoryMatch[];

    // ── 5. Handle no relevant notes ──────────────────────────────────────────
    if (sources.length === 0) {
      const result: QueryResult = {
        answer:
          "I couldn't find any notes relevant to your question. Try adding more memories or rephrasing your question.",
        sources: [],
      };
      return NextResponse.json({ data: result });
    }

    // ── 6. Build context blocks (truncate if needed) ─────────────────────────
    const contextBlocks: string[] = [];
    let totalChars = 0;

    for (const match of sources) {
      const titleLine = match.title ? `Title: ${match.title}\n` : "";
      const block = `${titleLine}${match.content}`;
      if (totalChars + block.length > MAX_CONTEXT_CHARS) {
        // Include a truncated version rather than dropping the note entirely
        const remaining = MAX_CONTEXT_CHARS - totalChars;
        if (remaining > 200) {
          contextBlocks.push(block.slice(0, remaining) + "…");
        }
        break;
      }
      contextBlocks.push(block);
      totalChars += block.length;
    }

    // ── 7. Call LLM ──────────────────────────────────────────────────────────
    let answer: string;
    let usedSources: MemoryMatch[] = sources;
    try {
      let lastError: unknown = null;
      answer = "";

      for (const model of LLM_MODELS) {
        try {
          const completion = await openai.chat.completions.create({
            model,
            temperature: 0.2, // low temperature = more faithful, less hallucination
            max_tokens: 1024,
            messages: [
              {
                role: "system",
                content: buildSystemPrompt(),
              },
              {
                role: "user",
                content: buildUserPrompt(question, contextBlocks),
              },
            ],
          });

          answer = completion.choices[0]?.message?.content?.trim() ?? "";
          if (!answer) {
            throw new Error(`Empty response from model ${model}`);
          }
          console.log(`[query] generated answer using model: ${model}`);
          break;
        } catch (modelErr) {
          lastError = modelErr;
          console.warn(`[query] model failed: ${model}`, modelErr);
          continue;
        }
      }

      if (!answer) throw lastError ?? new Error("All configured models failed.");

      const { cleanAnswer, sourceIndexes } = extractAnswerAndSourceIndexes(answer);
      answer = cleanAnswer || answer;

      if (sourceIndexes.length > 0) {
        usedSources = sourceIndexes
          .map((idx) => sources[idx - 1])
          .filter((s): s is MemoryMatch => Boolean(s));
      } else {
        // If the model omitted citations, prefer tighter source display.
        usedSources = sources.slice(0, Math.min(2, sources.length));
      }
    } catch (err) {
      console.error("[query] LLM call failed:", err);
      const result: QueryResult = {
        answer: buildProviderFallbackAnswer(sources),
        sources: sources.slice(0, Math.min(3, sources.length)),
      };
      return NextResponse.json({ data: result });
    }

    // ── 8. Return answer + sources ───────────────────────────────────────────
    const result: QueryResult = { answer, sources: usedSources };
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[query] unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
