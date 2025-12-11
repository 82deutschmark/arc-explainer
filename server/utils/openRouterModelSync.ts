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
function formatPrice(perMillion: number | null): string {
  if (perMillion === null) return 'TBD';
  return `$${(perMillion / 1_000_000).toFixed(4)}`;
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

  const inputStr = inputPrice ? `'$${(inputPrice / 1_000_000).toFixed(4)}'` : 'TBD';
  const outputStr = outputPrice ? `'$${(outputPrice / 1_000_000).toFixed(4)}'` : 'TBD';

  const color = pickColor(slug, hasReasoning);
  const speedInfo = estimateSpeed(slug, hasReasoning);
  const isPremium = hasReasoning || (inputPrice && inputPrice > 1000);

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
    contextWindow: ${contextLength}${
    inputPrice && outputPrice ? `,\n    releaseDate: "${new Date().toISOString().split('T')[0]}"` : ''
  }
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

    console.log(`📊 OpenRouter Catalog Status:`);
    console.log(`   Total models on OpenRouter: ${totalRemote}`);
    console.log(`   Models in our config: ${totalInConfig}`);
    console.log(`   New models found: ${newModels.length}\n`);

    if (newModels.length === 0) {
      console.log('✓ No new models to add.');
      return;
    }

    console.log('New OpenRouter models:\n');
    newModels.forEach((m) => {
      const inputPrice = computePricePerMillion(m.pricing?.prompt);
      const outputPrice = computePricePerMillion(m.pricing?.completion);

      console.log(`📦 ${m.id}`);
      console.log(`   Name: ${m.name || '(unnamed)'}`);
      if (inputPrice || outputPrice) {
        console.log(
          `   Pricing: In: ${formatPrice(inputPrice)}/M | Out: ${formatPrice(outputPrice)}/M`
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
    console.log(
      '\n✏️  Copy the snippets above and add them to server/config/models.ts in the appropriate section.'
    );
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
