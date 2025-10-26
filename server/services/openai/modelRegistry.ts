/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Centralizes OpenAI model key normalization and capability lookups so the
 *          OpenAIService can reason about model families without duplicating logic.
 * SRP/DRY check: Pass — isolates alias handling that is reused by payload builders and response parsers.
 */

import { getApiModelName } from "../../config/models/index.js";

export const MODEL_ALIASES: Record<string, string> = {
  "gpt-5": "gpt-5-2025-08-07",
  "gpt-5-mini": "gpt-5-mini-2025-08-07",
  "gpt-5-nano": "gpt-5-nano-2025-08-07",
};

export function normalizeModelKey(modelKey: string): string {
  if (typeof modelKey !== "string" || modelKey.length === 0) {
    return modelKey;
  }

  const trimmedKey = modelKey.trim();
  const slashIndex = trimmedKey.indexOf("/");
  const providerStrippedKey = slashIndex > -1 ? trimmedKey.slice(slashIndex + 1) : trimmedKey;

  const aliasResolved = MODEL_ALIASES[providerStrippedKey];
  if (aliasResolved) {
    return aliasResolved;
  }

  const apiModelName = getApiModelName(providerStrippedKey);
  if (apiModelName) {
    return apiModelName;
  }

  return providerStrippedKey;
}
