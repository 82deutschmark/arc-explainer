/*
Author: Claude Opus 5
Date: 2026-09-16
PURPOSE: Lock the two human difficulty ratings and the top-10 stats in
         shared/arc3Games/humanDifficulty.ts, rule by rule: the 2026-06-18 recency cut, no
         reset rule on the top-10 rating (tu93 is the case that motivated removing it), the
         spread cuts at 0.20 and 0.50, and the owner rating's calibration (best win plus
         failed attempts before the first win, against his own median; never below 'hard'
         without a recent win; 'unknown' with no run). Also checks the committed
         humanPlay.generated.json keeps its own promises (25 games, only recent live-build
         runs with actions, no user id), without pinning numbers that change as the owner
         keeps playing.
SRP/DRY check: Pass -- tests only the pure functions and the generated file's invariants;
         the network pull (scripts/arc3/pull_human_scorecards.py) and the leaderboard
         fetch are not exercised here.
*/

import { describe, it, expect } from 'vitest';
import {
  HUMAN_DATA_CUTOFF,
  HUMAN_PLAY_DATA,
  computeOwnerCalibration,
  computeTop10Stats,
  getOwnerGameRating,
  isOnOrAfterCutoff,
  median,
  ownerDifficulty,
  summarizeOwnerGame,
  top10Difficulty,
  type HumanPlayData,
  type HumanPlayRun,
  type OwnerCalibration,
  type Top10RowInput,
  type Top10Stats,
} from '../../../shared/arc3Games/humanDifficulty';
import { getPublicDemoGameIdsInOrder } from '../../../shared/arc3Games';

const RECENT = '2026-08-01T12:00:00.123456Z';
const OLD = '2026-04-22T12:33:10.747043Z';

function row(actions: number, over: Partial<Top10RowInput> = {}): Top10RowInput {
  return { score: 100, actions, resets: 0, endState: 'WIN', publishedAt: RECENT, ...over };
}

function statsWithSpread(fewest: number, most: number, wins = 3): Top10Stats {
  const middle = Array.from({ length: Math.max(0, wins - 2) }, () => row(fewest));
  return computeTop10Stats([row(fewest), ...middle, row(most)]);
}

describe('isOnOrAfterCutoff', () => {
  it('counts a row published exactly at the cutoff as recent', () => {
    expect(isOnOrAfterCutoff(HUMAN_DATA_CUTOFF)).toBe(true);
    expect(isOnOrAfterCutoff('2026-06-17T23:59:59.999999Z')).toBe(false);
  });

  it('treats a missing or unparseable date as old', () => {
    expect(isOnOrAfterCutoff(null)).toBe(false);
    expect(isOnOrAfterCutoff('')).toBe(false);
    expect(isOnOrAfterCutoff('not a date')).toBe(false);
  });
});

describe('median', () => {
  it('takes the middle value, or the mean of the two middle values', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([416, 470, 416, 458])).toBe(437);
    expect(median([259, 266])).toBe(262.5);
    expect(median([])).toBeNull();
  });
});

describe('computeTop10Stats', () => {
  it('keeps old rows in the count but out of every number', () => {
    const stats = computeTop10Stats([
      row(10, { publishedAt: OLD }),
      row(100),
      row(120),
      row(150),
      row(900, { publishedAt: null }),
    ]);
    expect(stats.totalRows).toBe(5);
    expect(stats.recentRows).toBe(3);
    expect(stats.recentWins).toBe(3);
    expect(stats.fewestActions).toBe(100);
    expect(stats.medianActions).toBe(120);
    expect(stats.mostActions).toBe(150);
    expect(stats.relativeSpread).toBeCloseTo(0.5);
    expect(stats.cutoff).toBe(HUMAN_DATA_CUTOFF);
  });

  it('counts a recent non-win as kept but leaves it out of the action numbers', () => {
    const stats = computeTop10Stats([row(100), row(110), row(40, { endState: 'GAME_OVER', score: 12 })]);
    expect(stats.recentRows).toBe(3);
    expect(stats.recentWins).toBe(2);
    expect(stats.fewestActions).toBe(100);
    expect(stats.scoreMin).toBe(100);
  });

  it('reports the score range so "all 100" can be said plainly, and shows when it is not', () => {
    expect(computeTop10Stats([row(1), row(2), row(3)])).toMatchObject({ scoreMin: 100, scoreMax: 100 });
    expect(computeTop10Stats([row(1), row(2, { score: 91.5 })])).toMatchObject({ scoreMin: 91.5, scoreMax: 100 });
  });

  it('has no spread with a single recent win', () => {
    expect(computeTop10Stats([row(253), row(200, { publishedAt: OLD })])).toMatchObject({
      recentWins: 1,
      fewestActions: 253,
      mostActions: 253,
      relativeSpread: null,
    });
  });

  it('returns nulls, not zeros, when no recent row is a win', () => {
    const stats = computeTop10Stats([row(100, { publishedAt: OLD }), row(50, { endState: 'GAME_OVER' })]);
    expect(stats).toMatchObject({
      recentRows: 1,
      recentWins: 0,
      scoreMin: null,
      scoreMax: null,
      fewestActions: null,
      medianActions: null,
      mostActions: null,
      relativeSpread: null,
    });
  });
});

describe('top10Difficulty', () => {
  it('is unknown with fewer than 3 recent wins, however wide the spread', () => {
    expect(top10Difficulty(computeTop10Stats([row(57), row(99)]))).toBe('unknown');
    expect(top10Difficulty(computeTop10Stats([row(57, { publishedAt: OLD }), row(58), row(500)]))).toBe('unknown');
  });

  it('cuts at a relative spread of 0.20 and 0.50', () => {
    expect(top10Difficulty(statsWithSpread(1000, 1199))).toBe('easy');
    expect(top10Difficulty(statsWithSpread(1000, 1200))).toBe('medium');
    expect(top10Difficulty(statsWithSpread(1000, 1499))).toBe('medium');
    expect(top10Difficulty(statsWithSpread(1000, 1500))).toBe('hard');
  });

  it('ignores resets entirely', () => {
    const clean = computeTop10Stats([row(100), row(105), row(110)]);
    const resetHeavy = computeTop10Stats([row(100, { resets: 5 }), row(105, { resets: 3 }), row(110, { resets: 9 })]);
    expect(top10Difficulty(resetHeavy)).toBe(top10Difficulty(clean));
    expect(top10Difficulty(resetHeavy)).toBe('easy');
  });

  it('rates tu93 easy from its 16 Sep 2026 board, where the reset rule had called it hard', () => {
    // tu93's live top 10 as fetched on 16 Sep 2026 (user names left out): every row scores
    // 100, five tie at 185, and four rows used resets -- which the old rule read as hard.
    // Four rows were published on or after the cutoff: 185, 192, 193 and 212.
    const tu93: Top10RowInput[] = [
      row(185, { publishedAt: '2026-04-22T12:33:10.747043Z' }),
      row(185, { publishedAt: '2026-05-03T09:16:26.541947Z' }),
      row(185, { publishedAt: '2026-06-01T10:06:22.981336Z' }),
      row(185, { publishedAt: '2026-06-13T04:26:30.359336Z' }),
      row(185, { publishedAt: '2026-08-03T22:16:52.160301Z' }),
      row(192, { publishedAt: '2026-09-05T09:15:38.65534Z', resets: 1 }),
      row(193, { publishedAt: '2026-05-19T09:16:13.371099Z', resets: 1 }),
      row(193, { publishedAt: '2026-06-23T01:15:34.659894Z' }),
      row(203, { publishedAt: '2026-06-16T21:32:06.339689Z', resets: 1 }),
      row(212, { publishedAt: '2026-07-13T14:13:14.683812Z', resets: 3 }),
    ];
    const stats = computeTop10Stats(tu93);
    expect(stats.recentRows).toBe(4);
    expect(stats.fewestActions).toBe(185);
    expect(stats.medianActions).toBe(192.5);
    expect(stats.mostActions).toBe(212);
    expect(stats.relativeSpread).toBeCloseTo(27 / 185);
    expect(top10Difficulty(stats)).toBe('easy');
  });
});

// ---------------------------------------------------------------------------------------
// Owner
// ---------------------------------------------------------------------------------------

let runSeq = 0;
function run(gameId: string, state: string, actions: number, openAt: string, over: Partial<HumanPlayRun> = {}): HumanPlayRun {
  runSeq += 1;
  return {
    player: 'Mark',
    gameId,
    build: 'b',
    cardId: `card-${openAt}`,
    guid: `guid-${runSeq}`,
    runIndex: 0,
    state,
    levelsCompleted: state === 'WIN' ? 5 : 1,
    levelCount: 5,
    actions,
    resets: 0,
    score: state === 'WIN' ? 100 : 5,
    levelActions: [],
    levelBaselineActions: [],
    openAt,
    ...over,
  };
}

function calibrationAt(medianEffort: number | null): OwnerCalibration {
  return { player: 'Mark', medianEffort, gamesWon: medianEffort === null ? 0 : 5, gamesPlayed: 5 };
}

describe('summarizeOwnerGame', () => {
  it('is null with no runs', () => {
    expect(summarizeOwnerGame([], 100)).toBeNull();
  });

  it('adds failed attempts before the first win to the best win, in play order across and inside cards', () => {
    // Shaped like the owner's s5i5 on 16 Sep: an unfinished card, then one card holding a
    // GAME_OVER attempt and then the win (same guid, told apart by runIndex).
    const runs = [
      run('s5i5', 'WIN', 507, '2026-09-16T17:44:57Z', { cardId: 'c2', guid: 'g', runIndex: 2 }),
      run('s5i5', 'GAME_OVER', 831, '2026-09-16T17:44:57Z', { cardId: 'c2', guid: 'g', runIndex: 1 }),
      run('s5i5', 'NOT_FINISHED', 34, '2026-09-16T17:44:02Z', { cardId: 'c1' }),
    ];
    const summary = summarizeOwnerGame(runs, 638)!;
    expect(summary.won).toBe(true);
    expect(summary.bestWin?.actions).toBe(507);
    expect(summary.failedBeforeFirstWin).toBe(2);
    expect(summary.failedActionsBeforeFirstWin).toBe(865);
    expect(summary.actionsSpent).toBe(507 + 865);
    expect(summary.effort).toBeCloseTo(1372 / 638);
  });

  it('does not count a failed attempt that came after the first win', () => {
    const runs = [
      run('g1', 'WIN', 300, '2026-09-10T00:00:00Z', { cardId: 'c', runIndex: 0 }),
      run('g1', 'GAME_OVER', 900, '2026-09-10T00:00:00Z', { cardId: 'c', runIndex: 1 }),
    ];
    expect(summarizeOwnerGame(runs, 300)!.actionsSpent).toBe(300);
  });

  it('uses the fewest-actions win as best, and the first win only as the cut for failures', () => {
    const runs = [
      run('g50t', 'NOT_FINISHED', 100, '2026-09-01T00:00:00Z'),
      run('g50t', 'WIN', 600, '2026-09-02T00:00:00Z'),
      run('g50t', 'GAME_OVER', 250, '2026-09-03T00:00:00Z'),
      run('g50t', 'WIN', 400, '2026-09-04T00:00:00Z'),
    ];
    const summary = summarizeOwnerGame(runs, 500)!;
    expect(summary.firstWin?.actions).toBe(600);
    expect(summary.bestWin?.actions).toBe(400);
    expect(summary.failedBeforeFirstWin).toBe(1);
    expect(summary.actionsSpent).toBe(500);
    expect(summary.effort).toBe(1);
  });

  it('with no win, counts every attempt as actions spent so far', () => {
    const runs = [run('tn36', 'NOT_FINISHED', 51, '2026-09-02T00:00:00Z'), run('tn36', 'GAME_OVER', 335, '2026-09-14T00:00:00Z')];
    const summary = summarizeOwnerGame(runs, 317)!;
    expect(summary.won).toBe(false);
    expect(summary.bestWin).toBeNull();
    expect(summary.failedBeforeFirstWin).toBe(2);
    expect(summary.actionsSpent).toBe(386);
  });
});

describe('computeOwnerCalibration', () => {
  it('takes the median effort over won games only', () => {
    const summaries = [
      summarizeOwnerGame([run('a', 'WIN', 50, RECENT)], 100),
      summarizeOwnerGame([run('b', 'WIN', 80, RECENT)], 100),
      summarizeOwnerGame([run('c', 'WIN', 200, RECENT)], 100),
      summarizeOwnerGame([run('d', 'GAME_OVER', 5000, RECENT)], 100),
      null,
    ];
    expect(computeOwnerCalibration('Mark', summaries)).toEqual({
      player: 'Mark',
      medianEffort: 0.8,
      gamesWon: 3,
      gamesPlayed: 4,
    });
  });

  it('has no median with fewer than 3 won games', () => {
    const summaries = [summarizeOwnerGame([run('a', 'WIN', 50, RECENT)], 100), summarizeOwnerGame([run('b', 'WIN', 80, RECENT)], 100)];
    expect(computeOwnerCalibration('Mark', summaries).medianEffort).toBeNull();
  });
});

describe('ownerDifficulty', () => {
  const calibration = calibrationAt(0.8);

  it('is unknown with no recent run ("not played yet")', () => {
    expect(ownerDifficulty([], 100, calibration)).toBe('unknown');
  });

  it('rates a won game by its effort against his own median', () => {
    // baseline 1000, median effort 0.8 -> his usual game costs 800 actions.
    expect(ownerDifficulty([run('x', 'WIN', 640, RECENT)], 1000, calibration)).toBe('easy'); // ratio 0.80
    expect(ownerDifficulty([run('x', 'WIN', 641, RECENT)], 1000, calibration)).toBe('medium');
    expect(ownerDifficulty([run('x', 'WIN', 800, RECENT)], 1000, calibration)).toBe('medium'); // his median
    expect(ownerDifficulty([run('x', 'WIN', 1000, RECENT)], 1000, calibration)).toBe('hard'); // ratio 1.25
    expect(ownerDifficulty([run('x', 'WIN', 1599, RECENT)], 1000, calibration)).toBe('hard');
    expect(ownerDifficulty([run('x', 'WIN', 1600, RECENT)], 1000, calibration)).toBe('very-hard'); // ratio 2
  });

  it('lets failed attempts before the win push a cheap win up a tier', () => {
    const win = run('x', 'WIN', 600, '2026-09-02T00:00:00Z');
    expect(ownerDifficulty([win], 1000, calibration)).toBe('easy');
    expect(ownerDifficulty([run('x', 'GAME_OVER', 500, '2026-09-01T00:00:00Z'), win], 1000, calibration)).toBe('hard');
  });

  it('never rates a game he has not won below hard, however little he played it', () => {
    expect(ownerDifficulty([run('x', 'NOT_FINISHED', 6, RECENT)], 1000, calibration)).toBe('hard');
  });

  it('rates an unwon game very-hard once the actions already spent reach twice his usual', () => {
    expect(ownerDifficulty([run('x', 'GAME_OVER', 1599, RECENT)], 1000, calibration)).toBe('hard');
    expect(ownerDifficulty([run('x', 'GAME_OVER', 1600, RECENT)], 1000, calibration)).toBe('very-hard');
  });

  it('without a calibration, rates wins unknown and unwon games hard', () => {
    const none = calibrationAt(null);
    expect(ownerDifficulty([run('x', 'WIN', 100, RECENT)], 1000, none)).toBe('unknown');
    expect(ownerDifficulty([run('x', 'GAME_OVER', 100, RECENT)], 1000, none)).toBe('hard');
  });
});

describe('getOwnerGameRating', () => {
  it('reads a custom data set end to end', () => {
    const data: HumanPlayData = {
      cutoff: HUMAN_DATA_CUTOFF,
      games: {
        a: { build: 'b', levelCount: 1, baselineActions: [100], baselineTotal: 100 },
        b: { build: 'b', levelCount: 1, baselineActions: [100], baselineTotal: 100 },
        c: { build: 'b', levelCount: 1, baselineActions: [100], baselineTotal: 100 },
        d: { build: 'b', levelCount: 1, baselineActions: [100], baselineTotal: 100 },
      },
      pulls: [],
      runs: [run('a', 'WIN', 60, RECENT), run('b', 'WIN', 100, RECENT), run('c', 'WIN', 250, RECENT)],
    };
    expect(getOwnerGameRating('a', 'Mark', data)).toMatchObject({ rating: 'easy', calibration: { medianEffort: 1 } });
    expect(getOwnerGameRating('c', 'Mark', data).rating).toBe('very-hard');
    expect(getOwnerGameRating('d', 'Mark', data)).toMatchObject({ rating: 'unknown', summary: null });
    expect(getOwnerGameRating('zz99', 'Mark', data)).toMatchObject({ rating: 'unknown', baseline: null });
    expect(getOwnerGameRating('a', 'Someone else', data).rating).toBe('unknown');
  });
});

describe('humanPlay.generated.json', () => {
  it('has ARC baselines for exactly the 25 public games', () => {
    expect(Object.keys(HUMAN_PLAY_DATA.games).sort()).toEqual([...getPublicDemoGameIdsInOrder()].sort());
    for (const baseline of Object.values(HUMAN_PLAY_DATA.games)) {
      expect(baseline.baselineActions.length).toBe(baseline.levelCount);
      expect(baseline.baselineTotal).toBe(baseline.baselineActions.reduce((a, b) => a + b, 0));
    }
  });

  it('only holds recent runs with actions, on the live build, and no user id', () => {
    expect(HUMAN_PLAY_DATA.cutoff).toBe(HUMAN_DATA_CUTOFF);
    for (const r of HUMAN_PLAY_DATA.runs) {
      expect(r.actions).toBeGreaterThan(0);
      expect(isOnOrAfterCutoff(r.openAt)).toBe(true);
      expect(r.build).toBe(HUMAN_PLAY_DATA.games[r.gameId].build);
      expect(r.levelBaselineActions).toEqual(HUMAN_PLAY_DATA.games[r.gameId].baselineActions);
      expect(Object.keys(r).sort()).toEqual(
        [
          'actions', 'build', 'cardId', 'gameId', 'guid', 'levelActions', 'levelBaselineActions', 'levelCount',
          'levelsCompleted', 'openAt', 'player', 'resets', 'runIndex', 'score', 'state',
        ].sort(),
      );
    }
    expect(JSON.stringify(HUMAN_PLAY_DATA)).not.toMatch(/user_?id|cookie/i);
  });
});
