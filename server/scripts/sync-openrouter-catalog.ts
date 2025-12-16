/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-16
 * PURPOSE: Automatically fetch the latest OpenRouter catalog and update server/config/openrouter-catalog.json.
 *          Intelligently auto-adds newly discovered models to OPENROUTER_MODEL_KEYS in openrouterModels.ts,
 *          skipping models that are expensive (>$2/M) or preview/beta versions.
 *          Can be run via: npm run sync-openrouter-catalog
 * SRP/DRY check: Pass - Single responsibility for catalog synchronization and model discovery
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(__dirname, '../config/openrouter-catalog.json');
const MODELS_KEYS_PATH = path.resolve(__dirname, '../config/openrouterModels.ts');
const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

const MAX_INPUT_COST_PER_M = 2.0; // USD
const MAX_OUTPUT_COST_PER_M = 2.0; // USD

type OpenRouterCatalogModel = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: Record<string, string>;
  created?: number;
  release_date?: string;
  supported_parameters?: string[];
  architecture?: Record<string, unknown>;
  top_provider?: Record<string, unknown>;
  [key: string]: unknown;
};

type CatalogPayload = {
  models?: OpenRouterCatalogModel[];
  data?: OpenRouterCatalogModel[];
  [key: string]: unknown;
};

/**
 * Fetch the latest OpenRouter catalog from the official API
 */
async function fetchLatestCatalog(): Promise<OpenRouterCatalogModel[]> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };

  if (process.env.OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  console.log(`[Sync] Fetching OpenRouter catalog from ${OPENROUTER_API}...`);
  const resp = await fetch(OPENROUTER_API, { headers });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '(no error text)');
    throw new Error(`OpenRouter API error: ${resp.status} ${text}`);
  }

  const payload = (await resp.json()) as CatalogPayload;
  const models = (payload.data ?? payload.models ?? []) as OpenRouterCatalogModel[];

  if (!Array.isArray(models)) {
    throw new Error('Invalid catalog response: expected array of models');
  }

  return models;
}

/**
 * Load the current local catalog
 */
function loadLocalCatalog(): OpenRouterCatalogModel[] {
  if (!fs.existsSync(CATALOG_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as CatalogPayload;
  return (parsed.models ?? []) as OpenRouterCatalogModel[];
}

/**
 * Save catalog to file with formatting
 */
function saveCatalog(models: OpenRouterCatalogModel[]): void {
  const payload: CatalogPayload = { models };
  const json = JSON.stringify(payload, null, 2);
  fs.writeFileSync(CATALOG_PATH, json, 'utf-8');
  console.log(`[Sync] Saved ${models.length} models to ${CATALOG_PATH}`);
}

/**
 * Load current OPENROUTER_MODEL_KEYS array from openrouterModels.ts
 */
function loadCurrentModelKeys(): string[] {
  const content = fs.readFileSync(MODELS_KEYS_PATH, 'utf-8');
  // Extract the array between OPENROUTER_MODEL_KEYS: string[] = [ and ];
  const match = content.match(/const OPENROUTER_MODEL_KEYS: string\[\] = \[([\s\S]*?)\];/);
  if (!match) {
    throw new Error('Could not parse OPENROUTER_MODEL_KEYS from openrouterModels.ts');
  }

  const arrayContent = match[1];
  const keys = arrayContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .map(line => line.replace(/[',]/g, '').trim())
    .filter(line => line.length > 0);

  return keys;
}

/**
 * Save updated OPENROUTER_MODEL_KEYS to openrouterModels.ts
 */
function saveModelKeys(keys: string[]): void {
  const content = fs.readFileSync(MODELS_KEYS_PATH, 'utf-8');

  // Build new array with proper formatting
  const arrayStr = keys.map(k => `  '${k}',`).join('\n');
  const newArray = `const OPENROUTER_MODEL_KEYS: string[] = [\n${arrayStr}\n];`;

  // Replace the old array
  const updated = content.replace(
    /const OPENROUTER_MODEL_KEYS: string\[\] = \[[\s\S]*?\];/,
    newArray
  );

  fs.writeFileSync(MODELS_KEYS_PATH, updated, 'utf-8');
  console.log(`[Sync] Updated OPENROUTER_MODEL_KEYS with ${keys.length} models`);
}

/**
 * Check if a model is too expensive
 */
function isTooExpensive(model: OpenRouterCatalogModel): boolean {
  const inputPrice = model.pricing?.prompt ? Number(model.pricing.prompt) * 1_000_000 : 0;
  const outputPrice = model.pricing?.completion ? Number(model.pricing.completion) * 1_000_000 : 0;

  return inputPrice > MAX_INPUT_COST_PER_M || outputPrice > MAX_OUTPUT_COST_PER_M;
}

/**
 * Check if a model should be skipped (preview, beta, sandbox, etc)
 */
function shouldSkipModel(slug: string): boolean {
  const lower = slug.toLowerCase();
  return (
    lower.includes('preview') ||
    lower.includes('beta') ||
    lower.includes('sandbox') ||
    lower.includes('dev-')
  );
}

/**
 * Find newly added models that should be auto-added
 */
function findAutoAddCandidates(
  remote: OpenRouterCatalogModel[],
  local: OpenRouterCatalogModel[],
  currentKeys: Set<string>
): { models: OpenRouterCatalogModel[]; expensive: string[]; skipped: string[] } {
  const localIds = new Set(local.map(m => m.id));
  const newModels = remote.filter(m => m.id && !localIds.has(m.id) && !currentKeys.has(m.id));

  const candidates: OpenRouterCatalogModel[] = [];
  const expensive: string[] = [];
  const skipped: string[] = [];

  for (const model of newModels) {
    if (shouldSkipModel(model.id!)) {
      skipped.push(`${model.id} (preview/beta/sandbox)`);
      continue;
    }

    if (isTooExpensive(model)) {
      const inputPrice = model.pricing?.prompt ? (Number(model.pricing.prompt) * 1_000_000).toFixed(2) : 'unknown';
      const outputPrice = model.pricing?.completion ? (Number(model.pricing.completion) * 1_000_000).toFixed(2) : 'unknown';
      expensive.push(`${model.id} (input: $${inputPrice}/M, output: $${outputPrice}/M)`);
      continue;
    }

    candidates.push(model);
  }

  return { models: candidates, expensive, skipped };
}

/**
 * Find removed models
 */
function findRemovedModels(
  remote: OpenRouterCatalogModel[],
  local: OpenRouterCatalogModel[]
): string[] {
  const remoteIds = new Set(remote.map(m => m.id));
  return local.filter(m => m.id && !remoteIds.has(m.id)).map(m => m.id!);
}

/**
 * Main sync operation with auto-add capability
 */
export async function syncOpenRouterCatalog(autoAdd = true): Promise<{
  success: boolean;
  message: string;
  stats: {
    totalModels: number;
    newModels: string[];
    autoAdded: string[];
    skipped: string[];
    expensive: string[];
    removedModels: string[];
    updatedAt: string;
  };
}> {
  try {
    const remote = await fetchLatestCatalog();
    const local = loadLocalCatalog();
    const currentKeys = new Set(loadCurrentModelKeys());

    const removedModels = findRemovedModels(remote, local);
    const { models: candidates, expensive, skipped } = findAutoAddCandidates(remote, local, currentKeys);

    console.log(`\n[Sync] Catalog comparison:`);
    console.log(`   Remote catalog: ${remote.length} models`);
    console.log(`   Local catalog:  ${local.length} models`);
    console.log(`   Candidates for auto-add: ${candidates.length}`);
    if (expensive.length > 0) console.log(`   Expensive (skipped): ${expensive.length}`);
    if (skipped.length > 0) console.log(`   Preview/beta (skipped): ${skipped.length}`);
    console.log(`   Deprecated models removed: ${removedModels.length}\n`);

    if (expensive.length > 0) {
      console.log(`[Sync] Expensive models (>${MAX_INPUT_COST_PER_M}/M input or >${MAX_OUTPUT_COST_PER_M}/M output):`);
      expensive.slice(0, 5).forEach(m => console.log(`   - ${m}`));
      if (expensive.length > 5) console.log(`   ... and ${expensive.length - 5} more`);
      console.log('');
    }

    if (skipped.length > 0) {
      console.log(`[Sync] Skipped preview/beta/sandbox models:`);
      skipped.slice(0, 5).forEach(m => console.log(`   - ${m}`));
      if (skipped.length > 5) console.log(`   ... and ${skipped.length - 5} more`);
      console.log('');
    }

    // Save updated catalog
    saveCatalog(remote);

    let autoAddedList: string[] = [];
    if (autoAdd && candidates.length > 0) {
      console.log(`[Sync] Auto-adding ${candidates.length} new model(s)...`);
      const newKeys = [...currentKeys, ...candidates.map(m => m.id!)];
      saveModelKeys(Array.from(newKeys).sort());
      autoAddedList = candidates.map(m => m.id!);

      candidates.forEach(m => {
        console.log(`   ✓ ${m.id} (${m.name || 'unnamed'})`);
      });
      console.log('');
    }

    return {
      success: true,
      message: `Catalog synced. Found ${candidates.length} new model(s) ready to add.`,
      stats: {
        totalModels: remote.length,
        newModels: candidates.map(m => m.id!),
        autoAdded: autoAddedList,
        skipped,
        expensive,
        removedModels,
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Sync] Error: ${message}`);
    throw error;
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  syncOpenRouterCatalog(true)
    .then(result => {
      console.log(`\n[Sync] ✓ ${result.message}`);
      if (result.stats.autoAdded.length > 0) {
        console.log(`[Sync] Auto-added models: ${result.stats.autoAdded.join(', ')}`);
        console.log('[Sync] Run "npm run build" to apply changes.');
      }
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n[Sync] ✗ Failed:`, error);
      process.exit(1);
    });
}

export { syncOpenRouterCatalog };
