/**
 * Author: Cascade
 * Date: 2026-01-19
 * PURPOSE: SnakeBench backfill CLI entrypoint.
 *          Resets model aggregates/ratings then replays every completed
 *          local game from the resolved completed-games directory to
 *          regenerate aggregates and TrueSkill/Elo consistently.
 * SRP/DRY check: Pass — script only orchestrates repo init + directory backfill.
 */

import path from 'path';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';
import { getCompletedGamesAbsolutePath } from '../services/snakeBench/utils/constants.ts';

async function main() {
  const ok = await repositoryService.initialize();
  if (!ok) {
    throw new Error('Database not initialized; cannot run SnakeBench backfill.');
  }

  const completedDir = getCompletedGamesAbsolutePath(process.cwd());

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
