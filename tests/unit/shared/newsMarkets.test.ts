/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-09
 * PURPOSE: The newspaper's market digest (shared/newsMarkets.ts) on a small hand-built board:
 *          one-day comparisons from trails and the score-change feed, the leader change, gold-line
 *          movers, newcomers, the bubble, and the evidence rule that leaves an unsupported earlier
 *          rank unknown instead of guessing it.
 * SRP/DRY check: Pass — exercises the production pure functions only.
 */
import { describe, expect, it } from 'vitest';
import { buildMarketBoard, daysToClose, marketClimb, marketGain, snapshotAt, trailObservation } from '../../../shared/newsMarkets';
import type { KaggleBoardEvent, KaggleBoardHistory, KaggleBoardLatest, KaggleBoardRow } from '../../../shared/types';

const NOW = '2026-10-09T23:54:00Z';
const DAY_AGO = '2026-10-08T23:51:00Z';
const row = (rank: number, id: string, name: string, score: number, members = `${id}-member`): KaggleBoardRow => [rank, id, name, '2026-10-09 12:00:00', score, 5, members, null, null];

function board() {
  // 1 Chen (was 2nd), 2 Tufa (was 1st), 3 Climber (jumped from 391st), 4 Newcomer, 5 Quiet (gold line at 5), 6 Bubble, 7 Gap (unsupported).
  const latest: KaggleBoardLatest = {
    fetched: NOW, teams: 1000, ourTeamId: 'none', medalRanks: { gold: 5, silver: 50, bronze: 100 },
    rows: [row(1, 'chen', 'Yi-Chia Chen', 59.17), row(2, 'tufa', 'Tufa Labs', 56.52), row(3, 'climber', 'SparseTech', 37.98),
      row(4, 'new', 'Ryo Takaki', 33.31), row(5, 'quiet', 'Quiet Team', 33.0), row(6, 'bubble', 'Bubble Team', 32.9), row(7, 'gap', 'Gap Team', 32.5)],
  };
  const history: KaggleBoardHistory = {
    snaps: [
      { t: '2026-10-04T18:30:00Z', teams: 900, top: 50, gold: 30, silver: 25, bronze: 20 },
      { t: DAY_AGO, teams: 950, top: 55.89, gold: 32.5, silver: 26, bronze: 21 },
      { t: NOW, teams: 1000, top: 59.17, gold: 33.0, silver: 27, bronze: 22 },
    ],
    trails: {
      chen: { name: 'Yi-Chia Chen', pts: [['2026-10-04T18:30:00Z', 55.77, 2], ['2026-10-09T03:51:00Z', 59.17, 1]] },
      tufa: { name: 'Tufa Labs', pts: [['2026-10-04T18:30:00Z', 55.89, 1], ['2026-10-09T03:51:00Z', 55.89, 2], ['2026-10-09T10:00:00Z', 56.52, 2]] },
      quiet: { name: 'Quiet Team', pts: [['2026-10-05T00:00:00Z', 33.0, 3], ['2026-10-09T03:51:00Z', 33.0, 4], ['2026-10-09T12:00:00Z', 33.0, 5]] },
      bubble: { name: 'Bubble Team', pts: [['2026-10-05T00:00:00Z', 32.9, 4], ['2026-10-09T03:51:00Z', 32.9, 5], ['2026-10-09T12:00:00Z', 32.9, 6]] },
      // Last seen in the trail long ago, then a score jump after a long silence: it may have left the top 300.
      gap: { name: 'Gap Team', pts: [['2026-10-05T00:00:00Z', 30.1, 290], ['2026-10-09T20:00:00Z', 32.5, 7]] },
    },
  };
  const events: KaggleBoardEvent[] = [
    { t: '2026-10-09T03:51:00Z', id: 'chen', name: 'Yi-Chia Chen', from: 55.77, to: 59.17, rankFrom: 2, rankTo: 1 },
    { t: '2026-10-09T10:00:00Z', id: 'tufa', name: 'Tufa Labs', from: 55.89, to: 56.52, rankFrom: 2, rankTo: 2 },
    { t: '2026-10-09T15:00:00Z', id: 'climber', name: 'SparseTech', from: 29.33, to: 37.98, rankFrom: 391, rankTo: 3 },
    { t: '2026-10-09T16:00:00Z', id: 'new', name: 'Ryo Takaki', from: null, to: 33.31, rankFrom: null, rankTo: 4 },
    { t: '2026-10-09T20:00:00Z', id: 'gap', name: 'Gap Team', from: 30.1, to: 32.5, rankFrom: 600, rankTo: 7 },
    // Before the window: ignored.
    { t: '2026-10-07T10:00:00Z', id: 'quiet', name: 'Quiet Team', from: 31, to: 33, rankFrom: 40, rankTo: 3 },
  ];
  return buildMarketBoard('arc-3', latest, history, events, ['gap', 'missing'])!;
}

describe('market digest', () => {
  it('compares with the snapshot a day earlier and finds the leader change', () => {
    const digest = board();
    expect(digest.since).toBe(DAY_AGO);
    expect(digest.teamsThen).toBe(950);
    expect(digest.lines.gold).toEqual({ rank: 5, now: 33.0, then: 32.5, weekAgo: null });
    expect(digest.leader.row.name).toBe('Yi-Chia Chen');
    expect(digest.leader.previous?.name).toBe('Tufa Labs');
    expect(digest.leader.leadBy).toBeCloseTo(2.65);
    expect(digest.leader.heldSince).toBe('2026-10-09T03:51:00Z');
    expect(marketGain(digest.leader.row)).toBeCloseTo(3.4);
  });

  it('lists gainers, climbers, newcomers, gold-line changes and the bubble', () => {
    const digest = board();
    expect(digest.gainers.map(item => item.teamId)).toEqual(['climber', 'chen', 'gap', 'tufa']);
    // Gap Team's climb counts from its rank just before its move (600th), since its trail cannot be trusted.
    expect(digest.climbers.map(item => item.teamId)).toEqual(['gap', 'climber', 'chen']);
    expect(marketClimb(digest.climbers[1])).toBe(388);
    expect(digest.newcomers.map(item => item.teamId)).toEqual(['new']);
    expect(digest.newcomerCount).toBe(1);
    expect(digest.intoGold.map(item => item.teamId)).toEqual(['climber']);
    expect(digest.outOfGold.map(item => item.teamId)).toEqual(['bubble']);
    expect(digest.bubble.map(item => item.teamId)).toEqual(['bubble', 'gap']);
    expect(digest.improved).toBe(4);
    expect(digest.watch.map(item => item.teamId)).toEqual(['gap']);
  });

  it('keeps an earlier rank unknown when the history cannot support it', () => {
    const digest = board();
    const gap = digest.watch[0];
    // The trail is not trusted across the silent jump; the feed gives the rank just before the move.
    expect(trailObservation({ name: 'Gap Team', pts: [['2026-10-05T00:00:00Z', 30.1, 290], ['2026-10-09T20:00:00Z', 32.5, 7]] }, 7, Date.parse(DAY_AGO))).toBeNull();
    expect(gap.rankThen).toBe(600);
    expect(gap.scoreThen).toBe(30.1);
    // An unchanged team with a continuous trail keeps its exact earlier rank.
    const quiet = digest.standings.find(item => item.teamId === 'quiet')!;
    expect([quiet.rankThen, quiet.scoreThen, marketGain(quiet)]).toEqual([3, 33.0, 0]);
  });

  it('reports nothing it cannot date', () => {
    expect(snapshotAt([{ t: '2026-10-08T20:00:00Z', teams: 1, top: 1, gold: 1, silver: 1, bronze: 1 }], Date.parse(DAY_AGO))).toBeNull();
    const latest: KaggleBoardLatest = { fetched: NOW, teams: 2, ourTeamId: 'x', medalRanks: { gold: 1, silver: 1, bronze: 2 }, rows: [row(1, 'a', 'A', 2), row(2, 'b', 'B', 1)] };
    const digest = buildMarketBoard('arc-2', latest, { snaps: [], trails: {} }, [], [])!;
    expect(digest.since).toBeNull();
    expect(digest.standings.every(item => item.rankThen === null && item.scoreThen === null)).toBe(true);
    expect([digest.gainers, digest.climbers, digest.newcomers, digest.intoGold, digest.outOfGold]).toEqual([[], [], [], [], []]);
    expect(daysToClose(digest)).toBe(25);
  });
});
