/**
 * Author: Cascade
 * Date: 2026-01-21
 * PURPOSE: Pure helper that merges pinned Worm Arena "Greatest Hits" entries
 *          with API results, ensuring pinned metadata wins on ID collisions and
 *          the combined list is sorted by recency so new matches surface first.
 * SRP/DRY check: Pass — isolates merge/sort logic for reuse + test coverage.
 */

import type { WormArenaGreatestHitGame } from '@shared/types';

export interface MergeWormArenaGreatestHitsOptions {
  pinnedGames?: WormArenaGreatestHitGame[];
  apiGames?: WormArenaGreatestHitGame[];
}

export function mergeWormArenaGreatestHits({
  pinnedGames = [],
  apiGames = [],
}: MergeWormArenaGreatestHitsOptions): WormArenaGreatestHitGame[] {
  const deduped = new Map<string, WormArenaGreatestHitGame>();

  const append = (game: WormArenaGreatestHitGame) => {
    const gameId = (game?.gameId ?? '').trim();
    if (!gameId || deduped.has(gameId)) {
      return;
    }
    deduped.set(gameId, game);
  };

  for (const game of pinnedGames) {
    append(game);
  }
  for (const game of apiGames) {
    append(game);
  }

  return Array.from(deduped.values()).sort((a, b) => parseTimestamp(b.startedAt) - parseTimestamp(a.startedAt));
}

function parseTimestamp(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
