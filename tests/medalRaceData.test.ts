/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Guard medal-race presentation against clipped leaders, hidden cutoff neighbors,
 *          tied scores, sparse captures and degenerate axes. Small fixtures exercise chart
 *          boundaries only; production continues to read the real Kaggle snapshot.
 * SRP/DRY check: Pass — tests the isolated presentation helpers used by MedalRaceChart.
 */
import { describe, expect, test } from 'vitest';
import type { KaggleBoardLatest, KaggleBoardRow } from '../shared/types';
import { medalBoundary, medalRaceWindow, nearestRankIndex, rankTickValues } from '../client/src/components/kaggleLeaderboard/medalRaceData';

function row(rank: number, score: number): KaggleBoardRow {
  return [rank, `team-${rank}`, `Team ${rank}`, '2026-10-07T18:00:00Z', score, 1, '', null, null];
}

function snapshot(rows: KaggleBoardRow[], ranks = { gold: 17, silver: 197, bronze: 395 }): KaggleBoardLatest {
  return { fetched: '2026-10-07T18:00:00Z', teams: rows.length, medalRanks: ranks, ourTeamId: 'team-14', rows };
}

describe('medal-race rank views', () => {
  const board = snapshot(Array.from({ length: 500 }, (_, i) => row(i + 1, i === 0 ? 90 : 40 - i / 20)));

  test('gold focus contains both sides of the boundary without flattening the race beneath the leader', () => {
    const view = medalRaceWindow(board, 'gold')!;
    expect(view.shown.map((r) => r[0])).toContain(17);
    expect(view.shown.map((r) => r[0])).toContain(18);
    expect(view.shown[0][0]).toBeGreaterThan(1);
    expect(view.shown.length).toBeLessThan(40);
    expect(view.scoreMax).toBeLessThan(board.rows[0][4]);
    // Omitted ranks remain available for honest range disclosure and the full view.
    expect(view.rows).toHaveLength(500);
  });

  test.each(['medals', 'all'] as const)('%s view keeps the genuine leader score inside the axis', (mode) => {
    const view = medalRaceWindow(board, mode)!;
    expect(view.shown[0][4]).toBe(90);
    expect(view.scoreMax).toBeGreaterThan(90);
    expect(view.scoreMax).toBeGreaterThan(view.scoreMin);
    expect(view.shown.every((r) => r[4] >= view.scoreMin && r[4] <= view.scoreMax)).toBe(true);
    if (mode === 'all') expect(view.shown).toHaveLength(500);
    else {
      expect(view.shown.some((r) => r[0] === 396)).toBe(true);
      expect(view.shown.length).toBeLessThan(500);
    }
  });

  test('empty or unusable scores produce an empty state', () => {
    expect(medalRaceWindow(snapshot([]), 'all')).toBeNull();
    expect(medalRaceWindow(snapshot([row(0, 1), row(1, NaN), row(Infinity, 2)]), 'gold')).toBeNull();
  });

  test.each([[row(1, 0)], [row(1, 20), row(2, 20)], [row(1, -5)]])('flat and single-team snapshots keep finite, nonzero axes: %j', (...rows) => {
    for (const mode of ['gold', 'medals', 'all'] as const) {
      const view = medalRaceWindow(snapshot(rows), mode)!;
      expect(view.rankMax).toBeGreaterThan(view.rankMin);
      expect(view.scoreMax).toBeGreaterThan(view.scoreMin);
      expect([view.rankMin, view.rankMax, view.scoreMin, view.scoreMax].every(Number.isFinite)).toBe(true);
    }
  });

  test('a sparse, unsorted snapshot retains observed ranks without mutating the input', () => {
    const rows = [row(100, 1), row(12, 5), row(2, 9)];
    const original = rows.slice();
    const view = medalRaceWindow(snapshot(rows), 'gold')!;
    expect(rows).toEqual(original);
    expect(view.rows.map((r) => r[0])).toEqual([2, 12, 100]);
    expect(view.shown.map((r) => r[0])).toEqual([12]);
    expect(medalBoundary(view.rows, 17)).toEqual({ cutoff: null, outside: null, gap: null });
  });
});

test('cutoff gaps respect equal scores and require both exact adjacent ranks', () => {
  const tied = [row(17, 34.74), row(18, 34.74)];
  expect(medalBoundary(tied, 17).gap).toBe(0);
  expect(medalBoundary([row(16, 35), row(18, 34.43)], 17).gap).toBeNull();
  expect(medalBoundary([row(17, 34.74), row(19, 34)], 17).outside).toBeNull();
  expect(medalBoundary([row(17, 34.74), row(18, 34.43)], 17).gap).toBeCloseTo(0.31);
});

test('pointer snapping selects real observed ranks and stays inside the board', () => {
  const rows = [row(2, 40), row(12, 30), row(100, 20)];
  expect(nearestRankIndex([], 17)).toBe(-1);
  expect(nearestRankIndex(rows, -1)).toBe(0);
  expect(nearestRankIndex(rows, 17)).toBe(1);
  expect(nearestRankIndex(rows, 90)).toBe(2);
  expect(nearestRankIndex(rows, 500)).toBe(2);
  expect(rankTickValues(1, 1, 4)).toEqual([1]);
  expect(rankTickValues(1, 2, 7)).toEqual([1, 2]);
  expect(rankTickValues(1, 3957, 4)).toEqual([1, 1320, 2638, 3957]);
});
