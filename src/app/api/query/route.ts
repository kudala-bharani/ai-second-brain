export const dynamic = "force-dynamic";

// OpenRouter's free router selects from the models currently available.
const LLM_MODELS = (process.env.OPENROUTER_MODELS ?? "openrouter/free")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/embeddings";
import { openai } from "@/lib/openai";
import type { MemoryMatch, QueryControls, QueryResult } from "@/types";

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

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function extractEvidenceSnippet(content: string, terms: string[]): string {
  if (!content) return "";
  const lower = content.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    idx = lower.indexOf(term);
    if (idx !== -1) break;
  }
  if (idx === -1) return content.slice(0, 220).trim();
  const start = Math.max(0, idx - 70);
  const end = Math.min(content.length, idx + 180);
  return content.slice(start, end).trim();
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
    let body: { question?: string; controls?: QueryControls };
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

    const controls = body.controls ?? {};
    const strictness = clamp(controls.strictness ?? 0.45, 0.1, 0.95);
    const maxSources = Math.round(clamp(controls.maxSources ?? MATCH_COUNT, 1, 10));
    const runtimeModels =
      controls.modelOrder && controls.modelOrder.length > 0
        ? controls.modelOrder.map((m) => m.trim()).filter(Boolean)
        : LLM_MODELS;

    // ── 3. Generate embedding for the question ───────────────────────────────
    const startTime = Date.now();
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
        match_threshold: strictness,
        match_count: maxSources,
      }
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
    let modelUsed: string | undefined;
    try {
      let lastError: unknown = null;
      answer = "";

      for (const model of runtimeModels) {
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
          modelUsed = model;
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

      const terms = question
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length >= 4)
        .slice(0, 8);
      usedSources = usedSources.map((s) => ({
        ...s,
        evidence_terms: terms,
        evidence_snippet: extractEvidenceSnippet(s.content, terms),
      }));
    } catch (err) {
      console.error("[query] LLM call failed:", err);
      const result: QueryResult = {
        answer: buildProviderFallbackAnswer(sources),
        sources: sources.slice(0, Math.min(3, sources.length)).map((s) => ({
          ...s,
          evidence_snippet: s.content.slice(0, 220),
        })),
        meta: {
          retrievalCount: sources.length,
          strictness,
          maxSources,
          durationMs: Date.now() - startTime,
        },
      };

      await supabase.from("query_history").insert({
        user_id: user.id,
        question,
        answer: result.answer,
        sources: result.sources,
        meta: result.meta ?? {},
        settings: {
          strictness,
          maxSources,
          modelOrder: runtimeModels,
        },
      });

      return NextResponse.json({ data: result });
    }

    // ── 8. Return answer + sources ───────────────────────────────────────────
    const result: QueryResult = {
      answer,
      sources: usedSources,
      meta: {
        modelUsed,
        retrievalCount: sources.length,
        strictness,
        maxSources,
        durationMs: Date.now() - startTime,
      },
    };

    // Persist query history (best effort, non-blocking for user flow).
    await supabase.from("query_history").insert({
      user_id: user.id,
      question,
      answer: result.answer,
      sources: result.sources,
      meta: result.meta ?? {},
      settings: {
        strictness,
        maxSources,
        modelOrder: runtimeModels,
      },
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[query] unexpected error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
