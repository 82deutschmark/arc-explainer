/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-19
 * PURPOSE: Filter replays by minimum rounds and availability for UI presentation.
 *          Avoids surfacing short diagnostic matches; ensures greatest hits are playable.
 * SRP/DRY check: Pass — isolated replay filtering logic, single responsibility.
 */

import type { SnakeBenchGameSummary, WormArenaGreatestHitGame } from '../../../shared/types.js';
import { CURATED_WORM_ARENA_HALL_OF_FAME } from '../../snakeBenchHallOfFame.ts';
import { logger } from '../../../utils/logger.ts';

const MIN_ROUNDS = 20;

/**
 * Apply a conservative minimum-rounds filter for Worm Arena replays.
 * Very short diagnostic matches (< 20 rounds) are still stored, but we avoid surfacing them.
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
 * Filter curated greatest hits down to only playable games.
 * A game is playable if its replay asset exists (local file or remote URL).
 * Checks up to limitPerDimension games.
 */
export async function getWormArenaGreatestHitsFiltered(
  limitPerDimension: number,
  replayChecker: (gameId: string) => Promise<boolean>
): Promise<WormArenaGreatestHitGame[]> {
  const raw = Number(limitPerDimension);
  const safeLimit = Number.isFinite(raw)
    ? Math.max(1, Math.min(raw, CURATED_WORM_ARENA_HALL_OF_FAME.length))
    : 5;

  const playable: WormArenaGreatestHitGame[] = [];

  for (const game of CURATED_WORM_ARENA_HALL_OF_FAME) {
    if (playable.length >= safeLimit) break;

    const available = await replayChecker(game.gameId);
    if (available) {
      playable.push(game);
      continue;
    }

    logger.warn(
      `getWormArenaGreatestHitsFiltered: curated game ${game.gameId} has no available replay asset`,
      'snakebench-service'
    );
  }

  return playable;
}
