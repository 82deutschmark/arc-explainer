/*
 * Author: Codex (GPT-5)
 * Date: 2025-12-10
 * PURPOSE: Fetch the OpenRouter catalog and report any slugs not present in our
 *          local OpenRouter roster (server/config/models.ts). No side effects.
 * SRP/DRY check: Pass — discovery only.
 */

import { computeNewSlugs, fetchOpenRouterModels, getLocalOpenRouterSlugs } from './openrouter-utils';

async function main() {
  const local = getLocalOpenRouterSlugs();
  console.log(`Local OpenRouter roster: ${local.size} models`);

  const remote = await fetchOpenRouterModels();
  console.log(`Fetched ${remote.length} models from OpenRouter`);

  const newSlugs = computeNewSlugs(remote);
  if (newSlugs.length === 0) {
    console.log('No new OpenRouter models found.');
    return;
  }

  console.log(`New models (${newSlugs.length}):`);
  newSlugs.forEach((slug) => console.log(` - ${slug}`));
}

main().catch((err) => {
  console.error(`Discovery failed: ${(err as Error).message}`);
  process.exit(1);
});
