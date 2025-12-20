/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Coordinate persistence across ingest queue + game index manager.
 *          Fire-and-forget enqueuing; warnings on failures, no exceptions.
 * SRP/DRY check: Pass — isolated persistence coordination, prevents data loss.
 */

import type { SnakeBenchRunMatchResult } from '../../../shared/types.js';
import { snakeBenchIngestQueue } from '../../snakeBenchIngestQueue.ts';
import { GameIndexManager } from './gameIndexManager.ts';
import { logger } from '../../../utils/logger.ts';

export class PersistenceCoordinator {
  constructor(private readonly gameIndexManager: GameIndexManager) {}

  /**
   * Enqueue match results for async persistence.
   * Updates both ingest queue (DB) and game index (filesystem).
   * Non-blocking; warnings on failure, does not throw.
   */
  async enqueueMatch(
    result: SnakeBenchRunMatchResult,
    width: number,
    height: number,
    numApples: number,
    models: { modelA: string; modelB: string }
  ): Promise<void> {
    // Fire-and-forget persistence via the ingest queue
    try {
      snakeBenchIngestQueue.enqueue({
        result,
        width,
        height,
        numApples,
        gameType: 'arc-explainer',
      });
    } catch (persistErr) {
      const msg = persistErr instanceof Error ? persistErr.message : String(persistErr);
      logger.warn(
        `PersistenceCoordinator.enqueueMatch: failed to enqueue DB persistence: ${msg}`,
        'snakebench-service'
      );
    }

    // Fire-and-forget filesystem index update
    try {
      await this.gameIndexManager.upsertGameEntry(result.completedGamePath, result.gameId, models);
    } catch (indexErr) {
      const msg = indexErr instanceof Error ? indexErr.message : String(indexErr);
      logger.warn(
        `PersistenceCoordinator.enqueueMatch: failed to update game index: ${msg}`,
        'snakebench-service'
      );
    }
  }
}
