/*
 * Author: Codex (GPT-5)
 * Date: 2025-12-10
 * PURPOSE: Shared helpers for OpenRouter discovery against our local model roster.
 * SRP/DRY check: Pass — pure utility module reused by discovery/enqueue scripts.
 */

import { MODELS } from '../../server/config/models';

export type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
};

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/models';

export function getLocalOpenRouterSlugs(): Set<string> {
  const slugs = MODELS.filter((m) => m.modelType === 'openrouter')
    .map((m) => m.apiModelName || m.key)
    .filter((v): v is string => Boolean(v));
  return new Set(slugs);
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(OPENROUTER_ENDPOINT, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter request failed: ${res.status} ${res.statusText} ${text}`);
  }
  const json = (await res.json()) as { data?: OpenRouterModel[] };
  return json.data ?? [];
}

export function computeNewSlugs(remoteModels: OpenRouterModel[]): string[] {
  const local = getLocalOpenRouterSlugs();
  const remoteSlugs = remoteModels.map((m) => m.id).filter(Boolean);
  return remoteSlugs.filter((slug) => !local.has(slug));
}
