/**
 * Author: GPT-5
 * Date: 2026-01-10
 * PURPOSE: Sync OpenRouter entries in public.models to the curated library list,
 *          deactivating stale slugs and collapsing :free variants to canonical slugs.
 * SRP/DRY check: Pass - single-purpose DB sync for OpenRouter models.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MODELS } from '../config/models.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';
import { canonicalizeOpenRouterSlug } from '../utils/openRouterSlugCanonicalizer.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type CuratedModel = {
  modelSlug: string;
  name: string;
  provider: string;
  isActive: boolean;
  testStatus?: string;
};

function buildCuratedOpenRouterModels(): CuratedModel[] {
  const bySlug = new Map<string, CuratedModel>();

  for (const model of MODELS) {
    if (model.provider !== 'OpenRouter') continue;
    const raw = (model.apiModelName || model.key || '').trim();
    if (!raw) continue;

    const canonicalSlug = canonicalizeOpenRouterSlug(raw);
    if (!canonicalSlug) continue;

    const entry: CuratedModel = {
      modelSlug: canonicalSlug,
      name: model.name || canonicalSlug,
      provider: 'OpenRouter',
      isActive: true,
      testStatus: 'ranked',
    };

    const existing = bySlug.get(canonicalSlug);
    if (!existing) {
      bySlug.set(canonicalSlug, entry);
      continue;
    }

    const preferCurrent = raw === canonicalSlug;
    const existingIsCanonical = existing.modelSlug === canonicalSlug;
    if (preferCurrent && !existingIsCanonical) {
      bySlug.set(canonicalSlug, entry);
    }
  }

  return Array.from(bySlug.values()).sort((a, b) => a.modelSlug.localeCompare(b.modelSlug));
}

async function main() {
  const ok = await repositoryService.initialize();
  if (!ok) {
    throw new Error('Database not initialized; cannot sync OpenRouter models.');
  }

  const curated = buildCuratedOpenRouterModels();
  const allowedSlugs = curated.map((m) => m.modelSlug);

  logger.info(`Syncing ${curated.length} curated OpenRouter models into public.models...`, 'openrouter-sync');
  const upsertResult = await repositoryService.gameWrite.upsertModels(curated);

  logger.info('Deactivating stale OpenRouter models not in curated list...', 'openrouter-sync');
  const deactivated = await repositoryService.gameWrite.deactivateOpenRouterModelsNotIn(allowedSlugs);

  logger.info(
    `OpenRouter DB sync complete. Inserted: ${upsertResult.inserted}, Updated: ${upsertResult.updated}, Deactivated: ${deactivated}.`,
    'openrouter-sync'
  );
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error(`OpenRouter DB sync failed: ${message}`, 'openrouter-sync');
  process.exit(1);
});
