/**
 * SnakeBench backfill script
 *THIS SCRIPT NEEDS DOCUMENTATION!
 * Resets model aggregates/ratings to baseline and re-ingests all
 * completed SnakeBench replay JSONs in chronological order, matching
 * Greg's pipeline (aggregates + TrueSkill/Elo).
 */

import path from 'path';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';

async function main() {
  const ok = await repositoryService.initialize();
  if (!ok) {
    throw new Error('Database not initialized; cannot run SnakeBench backfill.');
  }

  const completedDir = path.join(process.cwd(), 'external', 'SnakeBench', 'backend', 'completed_games');

  logger.info('Resetting SnakeBench model aggregates/ratings to baseline...', 'snakebench-backfill');
  await repositoryService.gameWrite.resetModelRatings();

  logger.info('Replaying completed games for aggregates + ratings...', 'snakebench-backfill');
  await repositoryService.gameWrite.backfillFromDirectory(completedDir);

  logger.info('SnakeBench backfill completed.', 'snakebench-backfill');
}

main().catch((err) => {
  logger.error(`SnakeBench backfill failed: ${err instanceof Error ? err.message : String(err)}`, 'snakebench-backfill');
  process.exit(1);
});
