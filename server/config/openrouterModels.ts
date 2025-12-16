/*
 * Author: Codex (GPT-5.1 Codex CLI)
 * Date: 2025-12-17
 * PURPOSE: Build OpenRouter ModelConfig entries from the openrouter-catalog.json source of truth.
 *          Keeps OpenRouter model metadata synchronized with the published catalog and applies
 *          a small set of overrides for known behavior flags (streaming/structured output).
 * SRP/DRY check: Pass - isolates OpenRouter catalog loading and mapping logic.
 */

import fs from 'fs';
import path from 'path';
import type { ModelConfig } from '@shared/types.js';

type OpenRouterCatalogModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  created?: number;
  release_date?: string;
  created_at?: string;
  canonical_slug?: string;
  supported_parameters?: string[];
  architecture?: {
    input_modalities?: string[];
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number | null;
  };
};

const OPENROUTER_MODEL_KEYS: string[] = [
  'allenai/olmo-3-32b-think:free',
  'allenai/olmo-3-7b-think',
  'allenai/olmo-3.1-32b-think:free',
  'amazon/nova-2-lite-v1:free',
  'amazon/nova-premier-v1',
  'anthropic/claude-haiku-4.5',
  'anthropic/claude-opus-4.5',
  'arcee-ai/trinity-mini:free',
  'deepseek/deepseek-chat-v3.1',
  'deepseek/deepseek-v3.1-terminus',
  'deepseek/deepseek-v3.2',
  'google/gemini-2.5-flash-lite-preview-09-2025',
  'google/gemini-2.5-flash-preview-09-2025',
  'google/gemini-3-pro-preview',
  'google/gemma-3n-e2b-it:free',
  'kwaipilot/kat-coder-pro:free',
  'meta-llama/llama-3.3-70b-instruct',
  'minimax/minimax-m2',
  'mistralai/codestral-2508',
  'mistralai/devstral-2512',
  'mistralai/devstral-2512:free',
  'mistralai/ministral-14b-2512',
  'mistralai/ministral-3b-2512',
  'mistralai/ministral-8b-2512',
  'mistralai/mistral-large-2512',
  'mistralai/mistral-small-creative',
  'moonshotai/kimi-k2-thinking',
  'nex-agi/deepseek-v3.1-nex-n1:free',
  'nousresearch/hermes-4-70b',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nvidia/nemotron-nano-9b-v2',
  'openai/gpt-5-mini',
  'openai/gpt-5-nano',
  'openai/gpt-5.1',
  'openai/gpt-5.2',
  'openai/gpt-oss-120b',
  'openrouter/gpt-5.1-codex-mini',
  'qwen/qwen-plus-2025-07-28:thinking',
  'qwen/qwen3-coder',
  'x-ai/grok-3',
  'x-ai/grok-3-mini',
  'x-ai/grok-4.1-fast',
  'x-ai/grok-code-fast-1',
  'xiaomi/mimo-v2-flash:free',
  'z-ai/glm-4.6',
  'z-ai/glm-4.6v',
];

const OPENROUTER_ID_ALIASES: Record<string, string> = {
  'openrouter/gpt-5.1-codex-mini': 'openai/gpt-5.1-codex-mini'
};

const STRUCTURED_OUTPUT_FALSE = new Set<string>([
  'google/gemini-3-pro-preview',
  'qwen/qwen-plus-2025-07-28:thinking',
  'x-ai/grok-code-fast-1'
]);

const STREAMING_FALSE = new Set<string>(['google/gemini-3-pro-preview']);

function loadCatalog(): OpenRouterCatalogModel[] {
  // Only load catalog in Node.js environment (server-side)
  if (typeof process === 'undefined') {
    return [];
  }
  const catalogFilePath = path.resolve(process.cwd(), 'server', 'config', 'openrouter-catalog.json');
  const raw = fs.readFileSync(catalogFilePath, 'utf-8');
  const parsed = JSON.parse(raw) as { models?: OpenRouterCatalogModel[] };
  return parsed.models ?? [];
}

function computePricePerMillion(perTokenString?: string): number | null {
  if (!perTokenString) return null;
  const value = Number(perTokenString);
  if (!Number.isFinite(value) || value < 0) return null;
  const perMillion = value * 1_000_000;
  return Math.round(perMillion * 100) / 100;
}

function formatUsd(perMillion: number | null): string {
  if (perMillion === null) return 'TBD';
  const fixed = perMillion.toFixed(2);
  // Trim trailing zeros but keep at least one decimal if needed
  const trimmed = fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `$${trimmed}`;
}

function pickColor(slug: string, hasReasoning: boolean): string {
  if (slug.includes('grok')) return 'bg-gray-600';
  if (slug.includes('claude')) return 'bg-indigo-500';
  if (slug.includes('gemini')) return 'bg-teal-500';
  if (slug.includes('deepseek')) return 'bg-cyan-600';
  if (slug.includes('mistral') || slug.includes('ministral') || slug.includes('devstral')) return 'bg-purple-500';
  if (slug.includes('llama')) return 'bg-orange-500';
  if (slug.includes('glm') || slug.includes('nova') || slug.includes('gemma')) return 'bg-sky-500';
  if (slug.includes('kimi')) return 'bg-slate-700';
  if (hasReasoning) return 'bg-blue-600';
  return 'bg-slate-500';
}

function estimateSpeed(slug: string, hasReasoning: boolean): { speed: 'fast' | 'moderate' | 'slow'; estimate: string } {
  if (hasReasoning) {
    if (slug.includes('mini') || slug.includes('nano') || slug.includes(':free')) {
      return { speed: 'moderate', estimate: '30-90 sec' };
    }
    return { speed: 'slow', estimate: '2-5 min' };
  }
  if (slug.includes('mini') || slug.includes('nano') || slug.includes('lite') || slug.includes('flash') || slug.includes(':free')) {
    return { speed: 'fast', estimate: '<30 sec' };
  }
  return { speed: 'moderate', estimate: '30-60 sec' };
}

function detectPremium(slug: string, inputPerM: number | null, isReasoning: boolean): boolean {
  const slugLower = slug.toLowerCase();
  if (slugLower.includes(':free') || (inputPerM ?? 0) === 0) return false;
  if (slugLower.includes('mini') || slugLower.includes('nano') || slugLower.includes('lite') || slugLower.includes('flash') || slugLower.includes('chat')) {
    return false;
  }
  if (
    slugLower.includes('claude') ||
    slugLower.includes('gpt-5') ||
    slugLower.includes('gpt-oss') ||
    slugLower.includes('grok') ||
    slugLower.includes('nova-premier') ||
    slugLower.includes('kimi-k2') ||
    slugLower.includes('deepseek-v3.2')
  ) {
    return true;
  }
  return isReasoning;
}

function parseReleaseDate(model: OpenRouterCatalogModel): string | undefined {
  const candidates = [
    model.release_date,
    model.created_at,
    typeof model.created === 'number' ? new Date(model.created * 1000).toISOString() : undefined,
    model.canonical_slug
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const isoCandidate = candidate.trim();
    const matchIso = isoCandidate.match(/\\d{4}-\\d{2}-\\d{2}/);
    if (matchIso) return matchIso[0].slice(0, 7);
    const matchYm = isoCandidate.match(/(\\d{4})-(\\d{2})/);
    if (matchIso === null && matchYm) return `${matchYm[1]}-${matchYm[2]}`;
  }
  return undefined;
}

function detectReasoning(model: OpenRouterCatalogModel, slug: string): boolean {
  if ((model.supported_parameters ?? []).some(p => p === 'reasoning' || p === 'include_reasoning')) {
    return true;
  }
  const slugLower = slug.toLowerCase();
  if (/reason|think|grok|deepseek|claude|gpt-5|gpt5|gpt-oss|kimi-k2|terminus/.test(slugLower)) {
    return true;
  }
  if (slugLower.includes('gemini-3') || slugLower.includes('gemini-2.5') || slugLower.includes('nova-premier') || slugLower.includes('glm-4.6')) {
    return true;
  }
  return false;
}

function buildModelConfig(slug: string, model: OpenRouterCatalogModel, apiModelName: string): ModelConfig {
  const inputPerM = computePricePerMillion(model.pricing?.prompt);
  const outputPerM = computePricePerMillion(model.pricing?.completion);
  const isReasoning = detectReasoning(model, slug);
  const override: Partial<ModelConfig> = {
    supportsStructuredOutput: STRUCTURED_OUTPUT_FALSE.has(slug) ? false : undefined,
    supportsStreaming: STREAMING_FALSE.has(slug) ? false : undefined
  };

  const responseTime = estimateSpeed(slug, override.isReasoning ?? isReasoning);
  const color = pickColor(slug, override.isReasoning ?? isReasoning);
  const releaseDate = parseReleaseDate(model);

  const supportsStructuredOutput = override.supportsStructuredOutput ?? true;
  const supportsStreaming = override.supportsStreaming ?? true;

  const supportsVision = (model.architecture?.input_modalities ?? []).some(modality =>
    modality.toLowerCase() === 'image' || modality.toLowerCase() === 'video'
  );

  const contextWindow = model.top_provider?.context_length ?? model.context_length;
  const maxOutputTokens = model.top_provider?.max_completion_tokens ?? undefined;

  const premium = detectPremium(slug, inputPerM, override.isReasoning ?? isReasoning);

  return {
    key: slug,
    name: model.name || slug,
    color,
    premium,
    cost: { input: formatUsd(inputPerM), output: formatUsd(outputPerM) },
    supportsTemperature: true,
    provider: 'OpenRouter',
    responseTime,
    isReasoning: override.isReasoning ?? isReasoning,
    apiModelName,
    modelType: 'openrouter',
    contextWindow,
    maxOutputTokens: maxOutputTokens ?? undefined,
    releaseDate,
    supportsStructuredOutput,
    supportsVision,
    supportsStreaming
  };
}

export function buildOpenRouterModels(): ModelConfig[] {
  const catalog = loadCatalog();
  const catalogById = new Map<string, OpenRouterCatalogModel>();
  for (const entry of catalog) {
    if (entry.id) {
      catalogById.set(entry.id, entry);
    }
  }

  const missing: string[] = [];
  const models: ModelConfig[] = [];

  for (const slug of OPENROUTER_MODEL_KEYS) {
    const catalogId = OPENROUTER_ID_ALIASES[slug] ?? slug;
    const entry = catalogById.get(catalogId);
    if (!entry) {
      missing.push(slug);
      continue;
    }
    models.push(buildModelConfig(slug, entry, catalogId));
  }

  if (missing.length) {
    throw new Error(`Missing OpenRouter catalog entries for: ${missing.join(', ')}`);
  }

  return models;
}

export { OPENROUTER_MODEL_KEYS };
