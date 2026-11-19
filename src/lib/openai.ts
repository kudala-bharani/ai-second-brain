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
