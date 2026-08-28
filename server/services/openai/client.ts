/**
 * Author: gpt-5-codex / Claude Opus 5
 * Date: 2025-10-16T00:00:00Z / 2026-08-28
 * PURPOSE: Exposes a lazily-constructed, OpenAI-SDK-compatible singleton so service code
 *          can import it without duplicating construction details.
 *
 *          2026-08-28: the client used to be constructed at module load from
 *          OPENAI_API_KEY, so importing anything that transitively reached this file
 *          threw "Missing credentials" and took down the whole server at boot — even
 *          for the vast majority of routes that never call a model. Construction is now
 *          deferred to first use, so a missing key can only fail the specific request
 *          that needs it.
 *
 *          Credentials resolve in this order, preferring OpenRouter:
 *            1. OPENROUTER_API_KEY  -> https://openrouter.ai/api/v1
 *            2. OPENAI_API_KEY      -> the SDK default base URL
 *          OPENAI_BASE_URL overrides the base URL in either case.
 *
 *          NOTE for callers: both current consumers (services/openai.ts and
 *          wormArena/WormArenaReportService.ts) use the OpenAI *Responses* API
 *          (`client.responses.*`). OpenRouter is Chat-Completions-compatible and its
 *          Responses support is not guaranteed, so routing those two paths through
 *          OpenRouter may require porting them to `chat.completions`. That port is
 *          deliberately not done here; this change only stops a missing key from
 *          breaking startup.
 * SRP/DRY check: Pass — still the single place the client is wired; call sites are
 *          unchanged because the lazy proxy preserves the `openAIClient.x.y()` shape.
 */

import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let client: OpenAI | null = null;

function resolveClient(): OpenAI {
  if (client) return client;

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  const explicitBaseUrl = process.env.OPENAI_BASE_URL;

  if (openRouterKey) {
    client = new OpenAI({
      apiKey: openRouterKey,
      baseURL: explicitBaseUrl || OPENROUTER_BASE_URL,
    });
    return client;
  }

  if (openAiKey) {
    client = new OpenAI({
      apiKey: openAiKey,
      ...(explicitBaseUrl ? { baseURL: explicitBaseUrl } : {}),
    });
    return client;
  }

  throw new Error(
    "No model credentials configured. Set OPENROUTER_API_KEY (preferred) or " +
    "OPENAI_API_KEY. This is only required for routes that call a model; the rest " +
    "of the server runs without it."
  );
}

/**
 * Lazy proxy. Property access constructs the real client on first touch, so importing
 * this module is free and only an actual call can fail on missing credentials.
 */
export const openAIClient = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    const value = Reflect.get(resolveClient(), prop, receiver);
    return typeof value === "function" ? value.bind(resolveClient()) : value;
  },
  has(_target, prop) {
    return Reflect.has(resolveClient(), prop);
  },
});

/** True when a model call can succeed. Lets callers degrade instead of throwing. */
export function hasModelCredentials(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
}
