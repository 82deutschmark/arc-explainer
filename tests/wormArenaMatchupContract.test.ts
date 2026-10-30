/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-29
 * PURPOSE: Verify matchup suggestions preserve the leaderboard's ranked model summaries,
 *          shared API contract and previously-played-pair exclusion in both scoring modes.
 * SRP/DRY check: Pass — exercises the existing pure selector and shared DTOs without a
 *          database, external match runner or duplicated ranking/scoring implementation.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { SnakeBenchTrueSkillLeaderboardEntry, WormArenaSuggestMatchupsResponse } from '../shared/types';
import type { snakeBenchService } from '../server/services/snakeBenchService';
import { suggestMatchups } from '../server/services/snakeBench/helpers/matchupSuggestions';

type SuggestionPayload = Pick<WormArenaSuggestMatchupsResponse, 'mode' | 'matchups' | 'totalCandidates'>;

function leaderboardEntry(modelSlug: string, displayScore: number): SnakeBenchTrueSkillLeaderboardEntry {
  return { modelSlug, displayScore, mu: 30, sigma: 3, exposed: 21, gamesPlayed: 12,
    wins: 8, losses: 3, ties: 1, applesEaten: 24, topScore: 6, winRate: 2 / 3, totalCost: 0.25 };
}

describe('Worm Arena matchup API contract', () => {
  it.each(['ladder', 'entertainment'] as const)('preserves actual rank and display score in %s suggestions', async mode => {
    const first = leaderboardEntry('model-a', 1234);
    const second = leaderboardEntry('model-b', 1178);
    const board = [leaderboardEntry('unapproved', 1300), first, second];
    const payload: SuggestionPayload = await suggestMatchups(mode, 20, 3, board, new Map(), new Set(['model-a', 'model-b']));

    expectTypeOf<Awaited<ReturnType<typeof snakeBenchService.suggestMatchups>>>().toEqualTypeOf<SuggestionPayload>();
    expect(payload.totalCandidates).toBe(1);
    expect(payload.matchups).toHaveLength(1);
    expect(payload.matchups[0].modelA).toEqual({ modelSlug: first.modelSlug, rank: 2,
      displayScore: first.displayScore, mu: first.mu, sigma: first.sigma, exposed: first.exposed,
      gamesPlayed: first.gamesPlayed, wins: first.wins, losses: first.losses, winRate: first.winRate });
    expect(payload.matchups[0].modelB).toMatchObject({ modelSlug: second.modelSlug, rank: 3, displayScore: second.displayScore });
    expect(payload.matchups[0].history).toEqual({ matchesPlayed: 0, lastPlayedAt: null });
  });

  it('excludes pairs whose normalized models have already played', async () => {
    const board = [leaderboardEntry('model-a:free', 1234), leaderboardEntry('model-b', 1178)];
    const history = new Map([['model-a|||model-b', { matchesPlayed: 1, lastPlayedAt: '2026-10-29T12:00:00Z' }]]);
    const payload = await suggestMatchups('ladder', 20, 3, board, history, new Set(board.map(row => row.modelSlug)));
    expect(payload).toEqual({ mode: 'ladder', matchups: [], totalCandidates: 0 });
  });
});
