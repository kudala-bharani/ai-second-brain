import { NextResponse } from "next/server";
import { EMBEDDING_MODEL, generateEmbedding } from "@/lib/embeddings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const vector = await generateEmbedding("Check local embedding model");
    return NextResponse.json(
      { ok: true, model: EMBEDDING_MODEL, dimensions: vector.length },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch (error) {
    console.error("[embedding] diagnostic failed:", error);
    return NextResponse.json(
      { ok: false, error: "Embedding model unavailable." },
      { status: 503 },
    );
  }
}
