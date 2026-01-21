/**
 * Author: Cascade
 * Date: 2026-01-19
 * PURPOSE: Filter replay candidates and orchestrate Worm Arena greatest-hits fallbacks.
 *          Ensures only long-enough, replayable games are returned and adds a local
 *          replay-based fallback between DB results and the curated hall of fame list.
 * SRP/DRY check: Pass — verified helper remains focused on filtering + fallback wiring.
 */

import type { SnakeBenchGameSummary, WormArenaGreatestHitGame } from '../../../../shared/types.js';
import { CURATED_WORM_ARENA_HALL_OF_FAME } from '../../snakeBenchHallOfFame.ts';
import { repositoryService } from '../../../repositories/RepositoryService.ts';
import { logger } from '../../../utils/logger.ts';
import { buildLocalGreatestHits } from './localGreatestHitsBuilder.ts';

const MIN_ROUNDS = 10;

/**
 * Apply a conservative minimum-rounds filter for Worm Arena replays.
 * Very short diagnostic matches (< 10 rounds) are culled in DB; this is a secondary filter.
 * If no games meet threshold, returns all games sorted by longest first.
 */
export function filterReplayableGames(games: SnakeBenchGameSummary[]): SnakeBenchGameSummary[] {
  if (!Array.isArray(games) || games.length === 0) return [];

  const filtered = games.filter((g) => {
    const rounds = Number.isFinite(g.roundsPlayed) ? Number(g.roundsPlayed) : 0;
    return rounds >= MIN_ROUNDS;
  });

  if (filtered.length > 0) {
    return filtered;
  }

  // Fallback: no games meet threshold; return original list sorted by longest first
  return [...games].sort((a, b) => (b.roundsPlayed ?? 0) - (a.roundsPlayed ?? 0));
}

/**
 * Get greatest hits with dynamic ranking fallback to curated list.
 * Strategy: First attempt DB-driven dynamic ranking, then fall back to curated list.
 * A game is playable if its replay asset exists (local file or remote URL).
 */
export async function getWormArenaGreatestHitsFiltered(
  limitPerDimension: number,
  replayChecker: (gameId: string) => Promise<boolean>
): Promise<WormArenaGreatestHitGame[]> {
  const raw = Number(limitPerDimension);
  const safeLimit = Number.isFinite(raw) ? Math.max(1, Math.min(raw, 20)) : 5;

  const playable: WormArenaGreatestHitGame[] = [];
  let candidateGames: WormArenaGreatestHitGame[] = [];

  // Strategy 1: Try dynamic ranking from database
  try {
    const dynamicResults = await repositoryService.curation.getWormArenaGreatestHits(limitPerDimension);
    if (dynamicResults && Array.isArray(dynamicResults) && dynamicResults.length > 0) {
      logger.info(
        `getWormArenaGreatestHitsFiltered: using dynamic DB ranking (${dynamicResults.length} results)`,
        'snakebench-service'
      );
      candidateGames = dynamicResults;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(
      `getWormArenaGreatestHitsFiltered: DB dynamic ranking failed, falling back to curated list: ${msg}`,
      'snakebench-service'
    );
  }

  // Strategy 2: Fall back to curated list if DB didn't produce results
  if (candidateGames.length === 0) {
    try {
      const localResults = await buildLocalGreatestHits(limitPerDimension);
      if (localResults.length > 0) {
        logger.info(
          `getWormArenaGreatestHitsFiltered: using local completed-games fallback (${localResults.length} results)`,
          'snakebench-service'
        );
        candidateGames = localResults;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(
        `getWormArenaGreatestHitsFiltered: local fallback failed (${msg})`,
        'snakebench-service'
      );
    }
  }

  if (candidateGames.length === 0) {
    logger.info(
      `getWormArenaGreatestHitsFiltered: no dynamic/local results, using curated hall of fame`,
      'snakebench-service'
    );
    candidateGames = CURATED_WORM_ARENA_HALL_OF_FAME;
  }

  // Filter to only playable games (with available replay assets)
  for (const game of candidateGames) {
    if (playable.length >= safeLimit) break;

    const available = await replayChecker(game.gameId);
    if (available) {
      playable.push(game);
      continue;
    }

    logger.warn(
      `getWormArenaGreatestHitsFiltered: game ${game.gameId} has no available replay asset`,
      'snakebench-service'
    );
  }

  return playable;
}
