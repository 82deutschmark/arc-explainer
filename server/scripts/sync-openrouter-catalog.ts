/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-16
 * PURPOSE: Auto-sync OpenRouter catalog and add new models.
 *          Only checks top 10 newest. Filters only expensive models (>$2/M).
 * SRP/DRY check: Pass
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = path.resolve(__dirname, '../config/openrouter-catalog.json');
const MODELS_KEYS_PATH = path.resolve(__dirname, '../config/openrouterModels.ts');
const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

const MAX_INPUT_COST_PER_M = 2.0;
const MAX_OUTPUT_COST_PER_M = 2.0;
const TOP_N_MODELS = 10;

type Model = {
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

async function fetchLatestCatalog(): Promise<Model[]> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (process.env.OPENROUTER_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  console.log(`[Sync] Fetching OpenRouter catalog...`);
  const resp = await fetch(OPENROUTER_API, { headers });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`OpenRouter API error: ${resp.status} ${text}`);
  }

  const payload = (await resp.json()) as any;
  const models = (payload.data ?? payload.models ?? []) as Model[];
  return models;
}

function loadLocalCatalog(): Model[] {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  const raw = fs.readFileSync(CATALOG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as any;
  return (parsed.models ?? []) as Model[];
}

function saveCatalog(models: Model[]): void {
  const json = JSON.stringify({ models }, null, 2);
  fs.writeFileSync(CATALOG_PATH, json, 'utf-8');
  console.log(`[Sync] Saved ${models.length} models to catalog`);
}

function loadCurrentModelKeys(): string[] {
  const content = fs.readFileSync(MODELS_KEYS_PATH, 'utf-8');
  const match = content.match(/const OPENROUTER_MODEL_KEYS: string\[\] = \[([\s\S]*?)\];/);
  if (!match) throw new Error('Could not parse OPENROUTER_MODEL_KEYS');

  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .map(line => line.replace(/[',]/g, '').trim())
    .filter(line => line.length > 0);
}

function saveModelKeys(keys: string[]): void {
  const content = fs.readFileSync(MODELS_KEYS_PATH, 'utf-8');
  const arrayStr = keys.map(k => `  '${k}',`).join('\n');
  const newArray = `const OPENROUTER_MODEL_KEYS: string[] = [\n${arrayStr}\n];`;
  const updated = content.replace(
    /const OPENROUTER_MODEL_KEYS: string\[\] = \[[\s\S]*?\];/,
    newArray
  );
  fs.writeFileSync(MODELS_KEYS_PATH, updated, 'utf-8');
  console.log(`[Sync] Updated OPENROUTER_MODEL_KEYS with ${keys.length} models`);
}

function isTooExpensive(model: Model): boolean {
  const input = model.pricing?.prompt ? Number(model.pricing.prompt) * 1_000_000 : 0;
  const output = model.pricing?.completion ? Number(model.pricing.completion) * 1_000_000 : 0;
  return input > MAX_INPUT_COST_PER_M || output > MAX_OUTPUT_COST_PER_M;
}

function findAutoAddCandidates(
  remoteTopN: Model[],
  local: Model[],
  currentKeys: Set<string>
): { models: Model[]; expensive: string[] } {
  const localIds = new Set(local.map(m => m.id));
  const newModels = remoteTopN.filter(m => m.id && !localIds.has(m.id) && !currentKeys.has(m.id));

  const candidates: Model[] = [];
  const expensive: string[] = [];

  for (const model of newModels) {
    if (isTooExpensive(model)) {
      const inp = model.pricing?.prompt ? (Number(model.pricing.prompt) * 1_000_000).toFixed(2) : 'unknown';
      const out = model.pricing?.completion ? (Number(model.pricing.completion) * 1_000_000).toFixed(2) : 'unknown';
      expensive.push(`${model.id} (in: $${inp}/M, out: $${out}/M)`);
      continue;
    }

    candidates.push(model);
  }

  return { models: candidates, expensive };
}

export async function syncOpenRouterCatalog(autoAdd = true): Promise<any> {
  try {
    const remote = await fetchLatestCatalog();
    const remoteTopN = remote.slice(0, TOP_N_MODELS);
    const local = loadLocalCatalog();
    const currentKeys = new Set(loadCurrentModelKeys());

    const { models: candidates, expensive } = findAutoAddCandidates(remoteTopN, local, currentKeys);

    console.log(`\n[Sync] Status:`);
    console.log(`   Total remote: ${remote.length} | Checking top: ${remoteTopN.length}`);
    console.log(`   Config entries: ${currentKeys.size}`);
    console.log(`   New candidates: ${candidates.length} | Expensive: ${expensive.length}\n`);

    if (candidates.length > 0) {
      console.log(`[Sync] New models to add:`);
      candidates.forEach(m => {
        const inp = m.pricing?.prompt ? (Number(m.pricing.prompt) * 1_000_000).toFixed(2) : 'TBD';
        const out = m.pricing?.completion ? (Number(m.pricing.completion) * 1_000_000).toFixed(2) : 'TBD';
        console.log(`   - ${m.id} (${m.name || 'unnamed'}) [in: $${inp}, out: $${out}]`);
      });
      console.log('');
    }

    saveCatalog(remote);

    let autoAddedList: string[] = [];
    if (autoAdd && candidates.length > 0) {
      console.log(`[Sync] Auto-adding ${candidates.length} new model(s)...`);
      const newKeys = [...currentKeys, ...candidates.map(m => m.id!)];
      saveModelKeys(Array.from(newKeys).sort());
      autoAddedList = candidates.map(m => m.id!);
      candidates.forEach(m => console.log(`   ✓ ${m.id}`));
      console.log('');
    }

    return {
      success: true,
      message: `Catalog checked. Found ${candidates.length} new model(s).`,
      stats: {
        totalRemote: remote.length,
        topNChecked: remoteTopN.length,
        newModels: candidates.map(m => m.id!),
        autoAdded: autoAddedList,
        expensive,
        updatedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Sync] Error: ${msg}`);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncOpenRouterCatalog(true)
    .then(result => {
      console.log(`\n[Sync] ✓ ${result.message}`);
      if (result.stats.autoAdded.length > 0) {
        console.log(`[Sync] Auto-added: ${result.stats.autoAdded.join(', ')}`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error(`\n[Sync] ✗ Failed:`, error);
      process.exit(1);
    });
}
