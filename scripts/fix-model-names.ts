/**
 * fix-model-names.ts
 * 
 * A one-time script to iterate through all explanations in the database and correct
 * any model names that do not match the canonical keys defined in the main model config.
 * 
 * @author Cascade
 */

import 'dotenv/config';
import { repositoryService } from '../server/repositories/RepositoryService.js';
import { MODELS } from '../server/config/models.js';
import type { ModelConfig } from '../shared/types.js';

console.log('Starting model name cleanup script...');

async function main() {
  // Initialize DB connection
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

    // Handle specific aliases like 'grok-4' first
    if (name.includes('grok-4')) {
      return 'grok-4-0709'; // Canonical key for all Grok 4 variations
    }

    const sortedModels = [...MODELS].sort((a, b) => b.key.length - a.key.length);

    // Exact match on key or name
    const exactMatch = sortedModels.find(m => m.key === name || m.name === name);
    if (exactMatch) return exactMatch.key;

    // Partial match for mapping short names to full keys
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
        console.log(`Fixing model name: ID ${exp.id}, From '${exp.modelName}' -> To '${canonicalKey}'`);
        await repositoryService.explanations.updateExplanationModelName(exp.id, canonicalKey);
        updatedCount++;
      }
    }
  }

  console.log(`
Cleanup summary:
- Checked: ${explanations.length} explanations
- Updated: ${updatedCount} explanations`);

  console.log('✅ Model name cleanup script finished.');
}

main().catch(error => {
  console.error('💥 An unexpected error occurred:', error);
  process.exit(1);
});
