/**
 * fix-model-names.ts
 * 
 * A one-time script to iterate through all explanations in the database and correct
 * any model names that do not match the canonical keys defined in the main model config.
 * 
 * @author Cascade
 */

import 'dotenv/config';
import { RepositoryService } from '../server/repositories/RepositoryService.js';
import { MODELS } from '../server/config/models.js';
import type { ModelConfig } from '../shared/types.js';

console.log('Starting model name cleanup script...');

async function main() {
  const isDryRun = !process.argv.includes('--execute');

  if (isDryRun) {
    console.log('\n[INFO] Running in --dry-run mode. No changes will be made to the database.\n');
  } else {
    console.log('\n[WARNING] Running in --execute mode. Changes WILL be made to the database.\n');
  }

  const repositoryService = new RepositoryService();
  const repoInitialized = await repositoryService.initialize();
  if (!repoInitialized) {
    console.error('💥 [FATAL] Database initialization failed. Aborting script.');
    return;
  }
  console.log('✅ Database connection successful.');

  const explanations = await repositoryService.explanations.getAllExplanationsForCleanup();
  console.log(`Found ${explanations.length} explanations to check.`);

  let updatedCount = 0;
  const modelKeySet = new Set(MODELS.map((m: ModelConfig) => m.key));

  const getCanonicalKey = (name: string | null): string | null => {
    if (!name) return null;

    // Grok model migrations: All direct xAI models -> OpenRouter x-ai/ namespace
    if (name === 'grok-4-0709' || name.includes('grok-4')) {
      return 'x-ai/grok-4';
    }
    if (name === 'grok-3' && !name.includes('mini')) {
      return 'x-ai/grok-3';
    }
    if (name === 'grok-3-mini' && !name.includes('fast')) {
      return 'x-ai/grok-3-mini';
    }
    if (name === 'grok-3-mini-fast') {
      return 'x-ai/grok-3-mini-fast';
    }
    if (name === 'grok-code-fast-1') {
      return 'x-ai/grok-code-fast-1';
    }

    const sortedModels = [...MODELS].sort((a, b) => b.key.length - a.key.length);

    const exactMatch = sortedModels.find(m => m.key === name || m.name === name);
    if (exactMatch) return exactMatch.key;

    for (const model of sortedModels) {
      if (model.key.startsWith(name)) {
        return model.key;
      }
    }

    return null;
  };

  for (const exp of explanations) {
    if (!exp.modelName || !modelKeySet.has(exp.modelName)) {
      const canonicalKey = getCanonicalKey(exp.modelName);
      if (canonicalKey && canonicalKey !== exp.modelName) {
        console.log(`[FIX] ID ${exp.id}: '${exp.modelName}' -> '${canonicalKey}'`);
        if (!isDryRun) {
          await repositoryService.explanations.updateExplanationModelName(exp.id, canonicalKey);
        }
        updatedCount++;
      }
    }
  }

  console.log(`\nCleanup summary:\n- Checked: ${explanations.length} explanations\n- Found ${updatedCount} potential updates.`);
  if (!isDryRun) {
      console.log(`- Applied: ${updatedCount} updates.`);
  }

  console.log('✅ Model name cleanup script finished.');
  process.exit(0);
}

main().catch(error => {
  console.error('💥 An unexpected error occurred:', error);
  process.exit(1);
});
