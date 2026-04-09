export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Check env vars (mask the actual values)
  results.env = {
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY
      ? `set (starts with: ${process.env.HUGGINGFACE_API_KEY.slice(0, 6)}...)`
      : "MISSING",
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY
      ? `set (starts with: ${process.env.OPENROUTER_API_KEY.slice(0, 8)}...)`
      : "MISSING",
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `set (${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 30)}...)`
      : "MISSING",
  };

  // 2. Try HuggingFace embedding
  const HF_URLS = [
    "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5",
    "https://router.huggingface.co/hf-inference/pipeline/feature-extraction/BAAI/bge-small-en-v1.5",
  ];

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!process.env.HUGGINGFACE_API_KEY) {
      results.huggingface = {
        error:
          "HUGGINGFACE_API_KEY is missing. router.huggingface.co requires a token.",
      };
    } else {
      headers["Authorization"] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;

      let response: Response | null = null;
      let networkError = "";
      let usedUrl = "";

      for (const url of HF_URLS) {
        usedUrl = url;
        try {
          response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({
              inputs: "hello world",
              options: { wait_for_model: true },
            }),
          });
        } catch (err) {
          networkError = err instanceof Error ? err.message : String(err);
          response = null;
          continue;
        }

        if (response.status === 404) {
          response = null;
          continue;
        }
        break;
      }

      if (!response) {
        throw new Error(
          `No HuggingFace endpoint could be tested. Last network error: ${networkError}. Last URL: ${usedUrl}`,
        );
      }

      const rawText = await response.text();

      if (!response.ok) {
        results.huggingface = {
          status: response.status,
          error: rawText.slice(0, 500),
          url: usedUrl,
        };
      } else {
        // Parse and check shape
        const data = JSON.parse(rawText);
        let dims = 0;
        if (Array.isArray(data) && Array.isArray(data[0])) {
          dims = (data[0] as number[]).length;
        } else if (Array.isArray(data) && typeof data[0] === "number") {
          dims = (data as number[]).length;
        }
        results.huggingface = {
          status: response.status,
          ok: true,
          endpoint: "router.huggingface.co (token)",
          url: usedUrl,
          dims,
          responseShape: Array.isArray(data)
            ? Array.isArray(data[0])
              ? `2D array [1][${dims}]`
              : `1D array [${dims}]`
            : typeof data,
        };
      }
    }
  } catch (err) {
    results.huggingface = {
      error: err instanceof Error ? err.message : String(err),
      cause:
        err instanceof Error && (err as NodeJS.ErrnoException).cause
          ? String((err as NodeJS.ErrnoException).cause)
          : undefined,
    };
  }

  // 3. Try OpenRouter (just a ping to check auth)
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      },
    });
    results.openrouter = {
      status: response.status,
      ok: response.ok,
      message: response.ok ? "reachable and authenticated" : await response.text().then(t => t.slice(0, 200)),
    };
  } catch (err) {
    results.openrouter = {
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results, { status: 200 });
}
