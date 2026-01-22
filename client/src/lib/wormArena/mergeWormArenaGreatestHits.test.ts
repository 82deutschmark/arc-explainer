/**
 * Author: Cascade
 * Date: 2026-01-21
 * PURPOSE: Vitest coverage for mergeWormArenaGreatestHits helper ensuring pinned
 *          metadata stays authoritative, API games still surface, and recency
 *          ordering behaves even when timestamps are missing.
 * SRP/DRY check: Pass — tests focus solely on the merge helper behaviour.
 */

import { describe, expect, it } from 'vitest';
import type { WormArenaGreatestHitGame } from '@shared/types';
import { mergeWormArenaGreatestHits } from './mergeWormArenaGreatestHits';

const baseGame: WormArenaGreatestHitGame = {
  gameId: 'base',
  startedAt: '2026-01-01T00:00:00.000Z',
  modelA: 'model/a',
  modelB: 'model/b',
  roundsPlayed: 40,
  maxRounds: 150,
  totalCost: 0.1,
  maxFinalScore: 10,
  scoreDelta: 1,
  boardWidth: 10,
  boardHeight: 10,
  highlightReason: 'base highlight',
};

function game(partial: Partial<WormArenaGreatestHitGame>): WormArenaGreatestHitGame {
  return {
    ...baseGame,
    ...partial,
  };
}

describe('mergeWormArenaGreatestHits', () => {
  it('prefers pinned metadata when IDs overlap', () => {
    const pinned = [game({ gameId: 'overlap', highlightReason: 'pinned' })];
    const api = [game({ gameId: 'overlap', highlightReason: 'api', modelA: 'other/a' })];

    const merged = mergeWormArenaGreatestHits({ pinnedGames: pinned, apiGames: api });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.highlightReason).toBe('pinned');
    expect(merged[0]?.modelA).toBe('model/a');
  });

  it('includes API-only games and sorts newest-first by startedAt', () => {
    const pinned = [
      game({ gameId: 'pinned', startedAt: '2026-01-10T00:00:00.000Z' }),
    ];
    const api = [
      game({ gameId: 'latest-api', startedAt: '2026-01-20T00:00:00.000Z' }),
      game({ gameId: 'older-api', startedAt: '2026-01-15T00:00:00.000Z' }),
    ];

    const merged = mergeWormArenaGreatestHits({ pinnedGames: pinned, apiGames: api });

    expect(merged.map((g) => g.gameId)).toEqual(['latest-api', 'older-api', 'pinned']);
  });

  it('pushes entries without valid timestamps to the end', () => {
    const api = [
      game({ gameId: 'with-date', startedAt: '2026-01-05T00:00:00.000Z' }),
      game({ gameId: 'missing-date', startedAt: '' }),
    ];

    const merged = mergeWormArenaGreatestHits({ pinnedGames: [], apiGames: api });

    expect(merged.map((g) => g.gameId)).toEqual(['with-date', 'missing-date']);
  });
});
