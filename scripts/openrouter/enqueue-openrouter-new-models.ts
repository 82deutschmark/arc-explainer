/*
 * Author: Codex (GPT-5)
 * Date: 2025-12-10
 * PURPOSE: Discover new OpenRouter slugs (not in server/config/models.ts) and
 *          enqueue WormArena gauntlet batches for them.
 * SRP/DRY check: Pass — discovery + enqueue only.
 */

import { computeNewSlugs, fetchOpenRouterModels, getLocalOpenRouterSlugs } from './openrouter-utils';

const DEFAULT_GAUNTLET_ENDPOINT =
  'https://arc-explainer-staging.up.railway.app/api/snakebench/run-batch';
const DEFAULT_GAUNTLET_MODEL = 'openai/gpt-5.1-codex-mini';
const DEFAULT_COUNT = 9;

async function enqueueGauntlet(modelSlug: string): Promise<void> {
  const endpoint = process.env.WORM_ARENA_API ?? DEFAULT_GAUNTLET_ENDPOINT;
  const modelA = process.env.WORM_ARENA_GAUNTLET_MODEL ?? DEFAULT_GAUNTLET_MODEL;
  const count = Number(process.env.WORM_ARENA_GAUNTLET_COUNT ?? DEFAULT_COUNT);

  const body = { modelA, modelB: modelSlug, count };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gauntlet enqueue failed for ${modelSlug}: ${res.status} ${res.statusText} ${text}`);
  }
}

async function main() {
  const local = getLocalOpenRouterSlugs();
  console.log(`Local OpenRouter roster: ${local.size} models`);

  const remote = await fetchOpenRouterModels();
  console.log(`Fetched ${remote.length} models from OpenRouter`);

  const newSlugs = computeNewSlugs(remote);
  if (newSlugs.length === 0) {
    console.log('No new OpenRouter models found; nothing enqueued.');
    return;
  }

  console.log(`New models (${newSlugs.length}):`);
  newSlugs.forEach((slug) => console.log(` - ${slug}`));

  console.log(`Enqueuing WormArena gauntlet batches (count=${DEFAULT_COUNT})...`);
  for (const slug of newSlugs) {
    try {
      await enqueueGauntlet(slug);
      console.log(` Enqueued: ${slug}`);
    } catch (err) {
      console.error(` Failed to enqueue ${slug}: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(`Enqueue run failed: ${(err as Error).message}`);
  process.exit(1);
});
