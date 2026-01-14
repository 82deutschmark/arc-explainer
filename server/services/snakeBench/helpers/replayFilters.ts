/**
 * Author: Gemini 3 Flash High
 * Date: 2025-12-27 (updated 2026-01-13 by Cascade)
 * PURPOSE: Filter replays by minimum rounds and availability for UI presentation.
 *          Avoids surfacing short diagnostic matches; ensures greatest hits are playable.
 *          Supports both dynamic DB-driven ranking and fallback to curated list.
 *          NOTE: Primary filtering now done via is_culled column in DB (games < 10 rounds culled).
 *          This MIN_ROUNDS filter is a secondary defense for edge cases.
 * SRP/DRY check: Pass — isolated replay filtering logic, single responsibility.
 */

import type { SnakeBenchGameSummary, WormArenaGreatestHitGame } from '../../../../shared/types.js';
import { CURATED_WORM_ARENA_HALL_OF_FAME } from '../../snakeBenchHallOfFame.ts';
import { repositoryService } from '../../../repositories/RepositoryService.ts';
import { logger } from '../../../utils/logger.ts';

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
    logger.info(
      `getWormArenaGreatestHitsFiltered: no dynamic results, using curated hall of fame`,
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
