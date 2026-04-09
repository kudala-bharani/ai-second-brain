import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────────────────
// OpenRouter client
// Drop-in OpenAI-compatible client that routes to free models.
// Get a free API key at https://openrouter.ai/keys
// ─────────────────────────────────────────────────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "Missing OPENROUTER_API_KEY. Get a free key at https://openrouter.ai/keys",
    );
  }
  if (!_client) {
    _client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        // OpenRouter recommends sending these so your app appears in their dashboard
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "AI Second Brain",
      },
    });
  }
  return _client;
}

/**
 * Proxy so all existing call-sites (`openai.chat.completions.create(...)`)
 * continue to work without any changes.
 */
export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// HuggingFace Inference API — free sentence-transformer embeddings
//
// Model : BAAI/bge-small-en-v1.5  →  384-dimensional vectors
// Docs  : https://huggingface.co/BAAI/bge-small-en-v1.5
//
// • Works without an API key on the shared free inference tier.
// • Add HUGGINGFACE_API_KEY to .env.local for better reliability/rate limits.
//   Get a free token at https://huggingface.co/settings/tokens
//
// IMPORTANT: the Supabase `memories` table must use vector(384).
//   If you previously ran schema.sql with vector(1536) run the migration:
//   supabase/migration_to_free_stack.sql
// ─────────────────────────────────────────────────────────────────────────────

const HF_MODEL = "BAAI/bge-small-en-v1.5";
const HF_ROUTER_URLS = [
  `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`,
  `https://router.huggingface.co/hf-inference/pipeline/feature-extraction/${HF_MODEL}`,
];

// How many times to retry on 503 "model loading" cold-start responses
const HF_MAX_RETRIES = 4;
const HF_RETRY_DELAY_MS = 4000; // wait 4 s between retries

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.replace(/\n/g, " ").trim();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!process.env.HUGGINGFACE_API_KEY) {
    throw new Error(
      "Missing HUGGINGFACE_API_KEY. HuggingFace now requires requests via router.huggingface.co with a token. " +
        "Create one at https://huggingface.co/settings/tokens and add it to .env.local.",
    );
  }
  headers["Authorization"] = `Bearer ${process.env.HUGGINGFACE_API_KEY}`;

  const body = JSON.stringify({
    inputs: input,
    options: {
      wait_for_model: true, // tells HF to wait instead of returning 503
      use_cache: true,
    },
  });

  let lastError = "";

  for (let attempt = 1; attempt <= HF_MAX_RETRIES; attempt++) {
    console.log(
      `[embedding] attempt ${attempt}/${HF_MAX_RETRIES} — model: ${HF_MODEL}`,
    );

    let response: Response | null = null;
    let lastNetworkError = "";
    let lastUrlTried = "";

    for (const url of HF_ROUTER_URLS) {
      lastUrlTried = url;
      try {
        response = await fetch(url, {
          method: "POST",
          headers,
          body,
        });
      } catch (err) {
        lastNetworkError = err instanceof Error ? err.message : String(err);
        response = null;
        continue;
      }

      // Some models/providers may not support one route shape; try next one.
      if (response.status === 404) {
        response = null;
        continue;
      }
      break;
    }

    if (!response) {
      lastError = `network failure: ${lastNetworkError} (last URL: ${lastUrlTried})`;
      if (attempt < HF_MAX_RETRIES) {
        await sleep(HF_RETRY_DELAY_MS);
        continue;
      }
      throw new Error(
        `No HuggingFace endpoint reachable for embeddings. Last error: ${lastNetworkError}. Last URL: ${lastUrlTried}`,
      );
    }

    // 503 = model still loading on HuggingFace's side — retry after a pause
    if (response.status === 503) {
      const raw = await response.text().catch(() => "");
      console.warn(
        `[embedding] HuggingFace returned 503 (model loading) on attempt ${attempt}. Retrying in ${HF_RETRY_DELAY_MS / 1000}s…`,
        raw,
      );
      lastError = `503 model loading: ${raw}`;
      if (attempt < HF_MAX_RETRIES) await sleep(HF_RETRY_DELAY_MS);
      continue;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      console.error(
        `[embedding] HuggingFace error (HTTP ${response.status}):`,
        errText,
      );
      throw new Error(
        `Embedding failed (HTTP ${response.status}): ${errText}. ` +
          `Check the HuggingFace endpoint/model and optionally set HUGGINGFACE_API_KEY in .env.local. Last URL: ${lastUrlTried}`,
      );
    }

    const data: unknown = await response.json();
    console.log(
      "[embedding] success, response type:",
      typeof data,
      Array.isArray(data) ? `array[${(data as unknown[]).length}]` : "",
    );

    // feature-extraction pipeline returns:
    //   [[f32, f32, ...]]  for a single string input  (2-D, take [0])
    //   [f32, f32, ...]    flat array in some versions (1-D, use directly)
    if (Array.isArray(data)) {
      const first = (data as unknown[])[0];
      if (Array.isArray(first) && typeof first[0] === "number") {
        console.log(
          `[embedding] 2-D response, dims: ${(first as number[]).length}`,
        );
        const vector = first as number[];
        if (vector.length !== 384) {
          throw new Error(
            `Embedding dims mismatch: expected 384, got ${vector.length}. Ensure model is ${HF_MODEL}.`,
          );
        }
        return vector; // 2-D case
      }
      if (typeof (data as unknown[])[0] === "number") {
        console.log(
          `[embedding] 1-D response, dims: ${(data as number[]).length}`,
        );
        const vector = data as number[];
        if (vector.length !== 384) {
          throw new Error(
            `Embedding dims mismatch: expected 384, got ${vector.length}. Ensure model is ${HF_MODEL}.`,
          );
        }
        return vector; // 1-D case
      }
    }

    throw new Error(
      `Unexpected embedding response shape from HuggingFace: ${JSON.stringify(data).slice(0, 300)}`,
    );
  }

  // All retries exhausted
  throw new Error(
    `HuggingFace model failed to load after ${HF_MAX_RETRIES} attempts (${lastError}). ` +
      `The free inference tier may be overloaded — try again in a minute, or add HUGGINGFACE_API_KEY to .env.local.`,
  );
}
