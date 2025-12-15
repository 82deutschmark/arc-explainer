/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-11
 * PURPOSE: Utility to discover new OpenRouter models and generate TypeScript configuration
 *          snippets for adding them to server/config/models.ts
 * SRP/DRY check: Pass - Focused utility for OpenRouter model discovery and config generation
 */

import { MODELS } from '../config/models.js';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/models';

type OpenRouterModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  created?: string | number;
  created_at?: string | number;
  released?: string | number;
  released_at?: string | number;
  release_date?: string;
  supported_parameters?: string[];
  architecture?: {
    input_modalities?: string[];
  };
};

/**
 * Fetch the full OpenRouter catalog
 */
async function fetchOpenRouterCatalog(): Promise<OpenRouterModel[]> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  const resp = await fetch(OPENROUTER_ENDPOINT, { headers });
  if (!resp.ok) {
    const info = await resp.text().catch(() => '');
    throw new Error(`OpenRouter API error: ${resp.status} ${info}`);
  }

  const payload = (await resp.json()) as { data?: OpenRouterModel[] };
  return payload.data ?? [];
}

/**
 * Determine color based on model characteristics
 */
function pickColor(slug: string, hasReasoning: boolean): string {
  if (slug.includes('grok')) return 'bg-gray-500';
  if (slug.includes('claude')) return 'bg-indigo-500';
  if (slug.includes('gemini')) return 'bg-teal-500';
  if (slug.includes('deepseek')) return 'bg-cyan-600';
  if (slug.includes('mistral')) return 'bg-purple-500';
  if (slug.includes('llama')) return 'bg-orange-500';
  if (hasReasoning) return 'bg-blue-600';
  return 'bg-slate-500';
}

/**
 * Determine response speed estimate
 */
function estimateSpeed(
  slug: string,
  hasReasoning: boolean
): { speed: 'fast' | 'moderate' | 'slow'; estimate: string } {
  if (hasReasoning) {
    if (slug.includes('mini')) return { speed: 'moderate', estimate: '30-90 sec' };
    return { speed: 'slow', estimate: '2-5 min' };
  }
  if (slug.includes('mini') || slug.includes('nano') || slug.includes('lite')) {
    return { speed: 'fast', estimate: '<30 sec' };
  }
  return { speed: 'moderate', estimate: '30-60 sec' };
}

/**
 * Convert price per token string to USD per million tokens
 */
function computePricePerMillion(perTokenString?: string): number | null {
  if (!perTokenString) return null;
  const value = Number(perTokenString);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1_000_000 * 100) / 100;
}

/**
 * Format price for display
 */
function formatUsdPerMillion(perMillion: number): string {
  const fixed = perMillion.toFixed(2);
  const trimmed = fixed.replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `$${trimmed}`;
}

function formatPrice(perMillion: number | null): string {
  if (perMillion === null) return 'TBD';
  return `${formatUsdPerMillion(perMillion)}`;
}

function parseDateLike(value: unknown): Date | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const dt = new Date(ms);
    return Number.isFinite(dt.getTime()) ? dt : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      const ms = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000;
      const dt = new Date(ms);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }

    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      const dt = new Date(parsed);
      return Number.isFinite(dt.getTime()) ? dt : null;
    }
  }

  return null;
}

function deriveReleaseDateFromSlug(slug: string): string | null {
  const isoDay = slug.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) return `${isoDay[1]}-${isoDay[2]}-${isoDay[3]}`;

  const yyyymmdd = slug.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (yyyymmdd) return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;

  const yyyymm = slug.match(/\b(\d{4})-(\d{2})\b/);
  if (yyyymm) return `${yyyymm[1]}-${yyyymm[2]}`;

  const dashYYMM = slug.match(/-(\d{2})(\d{2})(?:\b|$)/);
  if (dashYYMM) {
    const year = 2000 + Number(dashYYMM[1]);
    const month = Number(dashYYMM[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  return null;
}

function getReleaseDate(model: OpenRouterModel): string | null {
  const candidates: unknown[] = [
    model.release_date,
    model.released_at,
    model.released,
    model.created_at,
    model.created,
  ];

  for (const candidate of candidates) {
    const dt = parseDateLike(candidate);
    if (dt) return dt.toISOString().slice(0, 10);
  }

  return deriveReleaseDateFromSlug(model.id);
}

/**
 * Discover new OpenRouter models not in our config
 * @param maxInputCostPerM - Maximum input cost in USD per million tokens (filter out expensive models)
 * @param maxOutputCostPerM - Maximum output cost in USD per million tokens
 */
export async function discoverNewModels(
  maxInputCostPerM?: number,
  maxOutputCostPerM?: number
): Promise<{
  totalRemote: number;
  totalInConfig: number;
  newModels: OpenRouterModel[];
  filteredOut: number;
}> {
  const remote = await fetchOpenRouterCatalog();

  const configSlugs = new Set(
    MODELS.filter((m) => m.modelType === 'openrouter')
      .map((m) => m.apiModelName || m.key)
      .filter(Boolean) as string[]
  );

  let newModels = remote.filter((m) => m.id && !configSlugs.has(m.id));

  let filteredOut = 0;
  if (maxInputCostPerM !== undefined || maxOutputCostPerM !== undefined) {
    const filtered = newModels.filter((m) => {
      const inputPrice = computePricePerMillion(m.pricing?.prompt);
      const outputPrice = computePricePerMillion(m.pricing?.completion);

      if (maxInputCostPerM !== undefined && inputPrice && inputPrice > maxInputCostPerM) {
        return false;
      }
      if (maxOutputCostPerM !== undefined && outputPrice && outputPrice > maxOutputCostPerM) {
        return false;
      }
      return true;
    });

    filteredOut = newModels.length - filtered.length;
    newModels = filtered;
  }

  return {
    totalRemote: remote.length,
    totalInConfig: configSlugs.size,
    newModels,
    filteredOut,
  };
}

/**
 * Generate TypeScript model configuration for a new OpenRouter model
 */
export function generateModelConfig(model: OpenRouterModel): string {
  const slug = model.id;
  const name = model.name || slug;
  const contextLength = model.context_length || 'TODO';
  const hasReasoning =
    (model.supported_parameters || []).includes('reasoning') ||
    (model.supported_parameters || []).includes('include_reasoning');
  const hasVision =
    (model.architecture?.input_modalities || []).some((m) => m.toLowerCase() === 'image');

  const inputPrice = computePricePerMillion(model.pricing?.prompt);
  const outputPrice = computePricePerMillion(model.pricing?.completion);

  const inputStr = inputPrice !== null ? `'${formatUsdPerMillion(inputPrice)}'` : 'TBD';
  const outputStr = outputPrice !== null ? `'${formatUsdPerMillion(outputPrice)}'` : 'TBD';

  const color = pickColor(slug, hasReasoning);
  const speedInfo = estimateSpeed(slug, hasReasoning);
  const isPremium = hasReasoning || (inputPrice && inputPrice > 1000);
  const releaseDate = getReleaseDate(model);

  const config = `  {
    key: '${slug}',
    name: '${name}',
    color: '${color}',
    premium: ${isPremium},
    cost: { input: ${inputStr}, output: ${outputStr} },
    supportsTemperature: true,${hasVision ? '\n    supportsVision: true,' : ''}
    provider: 'OpenRouter',
    responseTime: { speed: '${speedInfo.speed}', estimate: '${speedInfo.estimate}' },${
    hasReasoning ? '\n    isReasoning: true,' : '\n    isReasoning: false,'
  }
    apiModelName: '${slug}',
    modelType: 'openrouter',
    contextWindow: ${contextLength}${releaseDate ? `,\n    releaseDate: "${releaseDate}"` : ''}
  },`;

  return config;
}

/**
 * Generate a full TypeScript snippet with provided models
 */
export function generateConfigSnippet(models: OpenRouterModel[]): string {
  if (models.length === 0) {
    return '// No new OpenRouter models found';
  }

  const configLines = models.map(generateModelConfig);

  return `// New OpenRouter models discovered on ${new Date().toISOString()}
// Add these to the MODELS array in server/config/models.ts:

${configLines.join('\n')}`;
}

/**
 * CLI entry point
 */
export async function main() {
  try {
    console.log('Discovering new OpenRouter models...\n');

    const { totalRemote, totalInConfig, newModels } = await discoverNewModels();

    console.log('OpenRouter Catalog Status:');
    console.log(`   Total models on OpenRouter: ${totalRemote}`);
    console.log(`   Models in our config: ${totalInConfig}`);
    console.log(`   New models found: ${newModels.length}\n`);

    if (newModels.length === 0) {
      console.log('No new models to add.');
      return;
    }

    console.log('New OpenRouter models:\n');
    newModels.forEach((m) => {
      const inputPrice = computePricePerMillion(m.pricing?.prompt);
      const outputPrice = computePricePerMillion(m.pricing?.completion);

      console.log(`${m.id}`);
      console.log(`   Name: ${m.name || '(unnamed)'}`);
      if (inputPrice || outputPrice) {
        console.log(
          `   Pricing (USD per 1M tokens): In: ${formatPrice(inputPrice)} | Out: ${formatPrice(outputPrice)}`
        );
      }
      if (m.context_length) {
        console.log(`   Context: ${m.context_length.toLocaleString()} tokens`);
      }
      console.log('');
    });

    console.log('Generated TypeScript snippets:\n');
    console.log('='.repeat(80));
    const snippet = generateConfigSnippet(newModels);
    console.log(snippet);
    console.log('='.repeat(80));
    console.log('\nCopy the snippets above and add them to server/config/models.ts in the appropriate section.');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
