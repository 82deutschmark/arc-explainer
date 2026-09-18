/*
 * Author: Claude Opus 5
 * Date: 2026-09-16 (date cutoff removed 2026-09-18)
 * PURPOSE: The two human difficulty ratings on a public ARC-AGI-3 game page, plus the
 *          action numbers shown at the top of the page. Everything here is a pure function
 *          over plain data; the only data this file reads is the committed
 *          humanPlay.generated.json (built by scripts/arc3/pull_human_scorecards.py), and
 *          every function that uses it takes the data as a parameter with that file as the
 *          default, so tests pass their own.
 *
 *          NO DATE CUTOFF. Until 2026-09-18 anything published or played before 2026-06-18
 *          was left out. Boss had that removed: the top-10 board is read exactly as ARC
 *          Prize shows it, every row. What the cut was really for -- keeping his runs on a
 *          game's original build and AI-played scorecards out of his own numbers -- is done
 *          by the generator's build-hash and "human" tag checks, not by a date.
 *
 *          RATING 1 -- TOP 10 (top10Difficulty). Input: the ARC Prize human top-10 board for
 *          one game. Every row with end state WIN counts. The rating is the relative action spread of those rows,
 *          (most - fewest) / fewest:
 *            - fewer than 3 wins        -> 'unknown' (TOP10_MIN_WINS; two rows are too few to call)
 *            - spread < 0.20            -> 'easy'   (the top players land on nearly the same count)
 *            - spread < 0.50            -> 'medium'
 *            - spread >= 0.50           -> 'hard'   (the slowest winner took 1.5x the fastest or more)
 *          Separately, computeTop10Stats reports relativeSpread as null below 2 wins
 *          (one row has no spread), which also yields 'unknown'; lowering TOP10_MIN_WINS
 *          below 2 would change nothing for that reason.
 *          Resets play no part. The old "2 or more resets in the top 10 = hard" rule is
 *          gone: on tu93 five of the all-time top 10 tie at 185 actions, so the spread is
 *          narrow, and the reset rule alone was calling it hard.
 *          Why these cuts, from all 25 live boards fetched 18 Sep 2026 (every row, no date
 *          cut): all 25 games have 10 winning rows. Their spreads, sorted:
 *          cd82 0.03, sb26 0.04, ar25 0.06, ft09 0.08, ls20 0.09, dc22 0.13, tu93 0.15,
 *          g50t 0.18 | bp35 0.23, ka59 0.24, vc33 0.24, sc25 0.31, wa30 0.31, re86 0.32,
 *          s5i5 0.35, cn04 0.38, lf52 0.43 | r11l 0.81, m0r0 0.89, tn36 1.04, sp80 1.07,
 *          tr87 1.20, lp85 1.37, sk48 1.48, su15 1.74. The one big gap is 0.43 -> 0.81, and
 *          the 0.50 hard cut sits in it. 0.20 sits in the gap 0.18 -> 0.23. That gives
 *          8 easy, 9 medium, 8 hard. (The 16 Sep calibration, done with the old date cut,
 *          put both cuts in the same two gaps.) No 'very-hard': the games above 0.81 have
 *          no clear gap between them to split on.
 *          Every row on all 25 boards scored 100, so score cannot rank anything; it is reported (min/max) so the
 *          page can say that plainly.
 *
 *          RATING 2 -- BOSS (ownerDifficulty). Calibrated to one player's own scorecards
 *          (Boss -- arcprize.org account "Mark"), so it reads "harder or easier than usual for this
 *          player", not an absolute scale. Runs are the generator's kept runs: actions > 0,
 *          tagged human, on the live build.
 *            1. Order the player's runs on a game by card open time, then position in the
 *               card (runs inside a card are in play order).
 *            2. If he has a WIN: effort = (actions of his best win -- fewest actions
 *               among his WIN runs -- plus the actions of every non-WIN run that came before
 *               his FIRST win) / ARC's baseline total for the game. Best win and first win
 *               can be different runs; the first win only decides which failed attempts
 *               count.
 *            3. His calibration is the median effort over every game he has a win on
 *               (a game with no win has no effort number, so it cannot sit in the median).
 *               Fewer than 3 won games -> no calibration, and won games rate 'unknown'.
 *            4. ratio = effort / median:  <= 0.8 'easy', < 1.25 'medium', < 2 'hard',
 *               >= 2 'very-hard'. 0.8 is 1/1.25, so easy and hard sit the same distance
 *               either side of his usual.
 *            5. No win: the actions he has put in so far divided by the baseline
 *               total is a floor on what a win will cost him, so the rating is that floor's
 *               band from step 4, raised to at least 'hard'. A game he never won
 *               is never rated below 'hard'.
 *            6. No run at all -> 'unknown' (the page says "not played yet").
 *          Calibration on the 16 Sep pull (15 won games): median effort 0.82 (ka59).
 *
 *          TOP-10 STATS (computeTop10Stats) feed the page strip and the first rating: rows
 *          on the board, wins, score min/max, fewest / median / most actions and the
 *          relative spread, all over the winning rows.
 *
 * SRP/DRY check: Pass -- no rating logic existed in shared/ before this; the old reset
 *          rule in server/scripts/compute-arc3-difficulty.ts now calls top10Difficulty()
 *          instead of carrying its own. The leaderboard service
 *          (server/services/arc3/arcPrizeLeaderboardService.ts) calls computeTop10Stats(). The row type is declared here, not imported from the
 *          server, so shared/ never depends on server/.
 */

import type { DifficultyRating } from './types';
import humanPlayJson from './humanPlay.generated.json';

// ---------------------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------------------

/** Boss's player name, as the generator labels his scorecard runs. */
export const OWNER_PLAYER = 'Boss';

export const TOP10_MIN_WINS = 3;
export const TOP10_EASY_BELOW = 0.2;
export const TOP10_HARD_AT = 0.5;

export const OWNER_MIN_WON_GAMES = 3;
export const OWNER_EASY_AT_OR_BELOW = 0.8;
export const OWNER_HARD_AT = 1.25;
export const OWNER_VERY_HARD_AT = 2;

// ---------------------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------------------

/** Median of a list; the mean of the two middle values when the count is even. Null when empty. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const RATING_ORDER: readonly DifficultyRating[] = ['easy', 'medium', 'hard', 'very-hard'];

function atLeast(rating: DifficultyRating, floor: DifficultyRating): DifficultyRating {
  return RATING_ORDER.indexOf(rating) >= RATING_ORDER.indexOf(floor) ? rating : floor;
}

// ---------------------------------------------------------------------------------------
// Top 10
// ---------------------------------------------------------------------------------------

/**
 * The fields of one ARC Prize human leaderboard row that the stats need. The server's
 * HumanLeaderboardEntry has these fields, so its rows can be passed straight in.
 */
export interface Top10RowInput {
  score: number;
  actions: number;
  resets: number;
  endState: string;
  publishedAt: string | null;
}

export interface Top10Stats {
  /** Rows on the board (normally 10). */
  totalRows: number;
  /** Rows that are wins. Every number below is over these rows only. */
  wins: number;
  /** Lowest and highest score among wins; equal to each other when all are 100. Null with no wins. */
  scoreMin: number | null;
  scoreMax: number | null;
  fewestActions: number | null;
  /** Mean of the two middle counts when there is an even number of wins, so it can end in .5. */
  medianActions: number | null;
  mostActions: number | null;
  /** (most - fewest) / fewest. Null with fewer than 2 wins (one row has no spread) or when fewest is 0. */
  relativeSpread: number | null;
}

export function computeTop10Stats(rows: readonly Top10RowInput[]): Top10Stats {
  const wins = rows.filter((row) => row.endState === 'WIN');
  const actions = wins.map((row) => row.actions);
  const scores = wins.map((row) => row.score);
  const fewest = actions.length > 0 ? Math.min(...actions) : null;
  const most = actions.length > 0 ? Math.max(...actions) : null;
  return {
    totalRows: rows.length,
    wins: wins.length,
    scoreMin: scores.length > 0 ? Math.min(...scores) : null,
    scoreMax: scores.length > 0 ? Math.max(...scores) : null,
    fewestActions: fewest,
    medianActions: median(actions),
    mostActions: most,
    relativeSpread: wins.length >= 2 && fewest !== null && most !== null && fewest > 0 ? (most - fewest) / fewest : null,
  };
}

/** Top-10 human rating from the action spread of the winning rows. See the file header for the cuts. */
export function top10Difficulty(stats: Top10Stats): DifficultyRating {
  if (stats.wins < TOP10_MIN_WINS || stats.relativeSpread === null) return 'unknown';
  if (stats.relativeSpread < TOP10_EASY_BELOW) return 'easy';
  if (stats.relativeSpread < TOP10_HARD_AT) return 'medium';
  return 'hard';
}

// ---------------------------------------------------------------------------------------
// Human play data (humanPlay.generated.json)
// ---------------------------------------------------------------------------------------

/** One kept scorecard run. Field meanings match arcprize.org's scorecard detail. */
export interface HumanPlayRun {
  /** arcprize.org user name. */
  player: string;
  gameId: string;
  /** Build hash, always the live one (the generator drops the rest). */
  build: string;
  cardId: string;
  /** Play session id. Several runs in one card can share it; use runIndex to tell them apart. */
  guid: string;
  /** Position in the card's runs[] for this game; runs in a card are in play order. */
  runIndex: number;
  /** 'WIN' | 'GAME_OVER' | 'NOT_FINISHED' as arcprize.org reports it. */
  state: string;
  levelsCompleted: number;
  levelCount: number;
  actions: number;
  resets: number;
  /** ARC-AGI-3 efficiency score for the run (0-100), not a count of levels cleared. */
  score: number;
  levelActions: number[];
  levelBaselineActions: number[];
  /** Card open time (ISO). */
  openAt: string;
}

/** ARC's own baseline for one game on its live build, from metadata.json `baseline_actions`. */
export interface HumanPlayGameBaseline {
  build: string;
  levelCount: number;
  baselineActions: number[];
  baselineTotal: number;
}

export interface HumanPlayPull {
  player: string;
  pulledAt: string;
  cardsListed: number;
  listCap: number;
  oldestListedPublishedAt: string | null;
  runsSeen: number;
  runsKept: number;
  dropped: {
    zeroActions: number;
    notHumanTag: number;
    notPublicGame: number;
    wrongBuild: number;
  };
}

export interface HumanPlayData {
  games: Record<string, HumanPlayGameBaseline>;
  pulls: HumanPlayPull[];
  runs: HumanPlayRun[];
}

/** The committed data. Typed through `unknown` because a JSON import types `state` and the like as plain string/number, not this interface. */
export const HUMAN_PLAY_DATA: HumanPlayData = humanPlayJson as unknown as HumanPlayData;

/** ARC's baseline actions for a game on its live build, or null for a game not in the data. */
export function getArcBaseline(gameId: string, data: HumanPlayData = HUMAN_PLAY_DATA): HumanPlayGameBaseline | null {
  return data.games[gameId] ?? null;
}

/** One player's kept runs on one game, in play order. */
export function getPlayerRuns(player: string, gameId: string, data: HumanPlayData = HUMAN_PLAY_DATA): HumanPlayRun[] {
  return orderRuns(data.runs.filter((run) => run.player === player && run.gameId === gameId));
}

/** Play order: card open time, then card id (only matters if two cards share a time), then position inside the card. */
export function orderRuns(runs: readonly HumanPlayRun[]): HumanPlayRun[] {
  return [...runs].sort(
    (a, b) =>
      Date.parse(a.openAt) - Date.parse(b.openAt) ||
      a.cardId.localeCompare(b.cardId) ||
      a.runIndex - b.runIndex,
  );
}

// ---------------------------------------------------------------------------------------
// Boss's rating ("owner" in identifiers)
// ---------------------------------------------------------------------------------------

export interface OwnerGameSummary {
  gameId: string;
  player: string;
  /** Kept runs on this game (every one has actions > 0). */
  runs: number;
  won: boolean;
  /** Fewest-actions WIN run, or null when he has not won it. */
  bestWin: HumanPlayRun | null;
  /** Chronologically first WIN run, or null. */
  firstWin: HumanPlayRun | null;
  /** Non-WIN runs played before the first win. With no win: every run (all of them failed or unfinished). */
  failedBeforeFirstWin: number;
  failedActionsBeforeFirstWin: number;
  /** Won: best win actions + failed actions before the first win. Not won: all actions so far. */
  actionsSpent: number;
  baselineTotal: number;
  /** actionsSpent / baselineTotal. For a game not won, a floor on what a win would cost. Null if the baseline is not positive. */
  effort: number | null;
}

/**
 * Summary of one player's runs on one game against ARC's baseline total. Null when
 * there are no runs. `runs` must all be the same player and game.
 */
export function summarizeOwnerGame(runs: readonly HumanPlayRun[], baselineTotal: number): OwnerGameSummary | null {
  if (runs.length === 0) return null;
  const ordered = orderRuns(runs);
  const firstWinIndex = ordered.findIndex((run) => run.state === 'WIN');
  const won = firstWinIndex !== -1;
  const wins = ordered.filter((run) => run.state === 'WIN');
  const bestWin = won ? wins.reduce((best, run) => (run.actions < best.actions ? run : best)) : null;
  const failedBefore = (won ? ordered.slice(0, firstWinIndex) : ordered).filter((run) => run.state !== 'WIN');
  const failedActions = failedBefore.reduce((sum, run) => sum + run.actions, 0);
  const actionsSpent = bestWin ? bestWin.actions + failedActions : failedActions;
  return {
    gameId: ordered[0].gameId,
    player: ordered[0].player,
    runs: ordered.length,
    won,
    bestWin,
    firstWin: won ? ordered[firstWinIndex] : null,
    failedBeforeFirstWin: failedBefore.length,
    failedActionsBeforeFirstWin: failedActions,
    actionsSpent,
    baselineTotal,
    effort: baselineTotal > 0 ? actionsSpent / baselineTotal : null,
  };
}

export interface OwnerCalibration {
  player: string;
  /** Median effort over games he has a win on. Null with fewer than OWNER_MIN_WON_GAMES. */
  medianEffort: number | null;
  /** Games with a win (the ones in the median). */
  gamesWon: number;
  /** Games with any run. */
  gamesPlayed: number;
}

export function computeOwnerCalibration(player: string, summaries: readonly (OwnerGameSummary | null)[]): OwnerCalibration {
  const played = summaries.filter((s): s is OwnerGameSummary => s !== null);
  const efforts = played.filter((s) => s.won && s.effort !== null).map((s) => s.effort as number);
  return {
    player,
    medianEffort: efforts.length >= OWNER_MIN_WON_GAMES ? median(efforts) : null,
    gamesWon: efforts.length,
    gamesPlayed: played.length,
  };
}

function ownerBand(ratio: number): DifficultyRating {
  if (ratio <= OWNER_EASY_AT_OR_BELOW) return 'easy';
  if (ratio < OWNER_HARD_AT) return 'medium';
  if (ratio < OWNER_VERY_HARD_AT) return 'hard';
  return 'very-hard';
}

/**
 * Boss's rating for one game: `runs` are that player's kept runs on the game (any order),
 * `baselineTotal` is ARC's baseline total for it, `calibration` is from
 * computeOwnerCalibration over all his games. Rules in the file header.
 */
export function ownerDifficulty(
  runs: readonly HumanPlayRun[],
  baselineTotal: number,
  calibration: OwnerCalibration,
): DifficultyRating {
  const summary = summarizeOwnerGame(runs, baselineTotal);
  if (!summary || summary.effort === null) return 'unknown';
  const medianEffort = calibration.medianEffort;
  if (summary.won) {
    if (medianEffort === null || medianEffort <= 0) return 'unknown';
    return ownerBand(summary.effort / medianEffort);
  }
  if (medianEffort === null || medianEffort <= 0) return 'hard';
  return atLeast(ownerBand(summary.effort / medianEffort), 'hard');
}

/** Calibration for one player over every game in the data. */
export function getOwnerCalibration(player: string = OWNER_PLAYER, data: HumanPlayData = HUMAN_PLAY_DATA): OwnerCalibration {
  const summaries = Object.entries(data.games).map(([gameId, baseline]) =>
    summarizeOwnerGame(getPlayerRuns(player, gameId, data), baseline.baselineTotal),
  );
  return computeOwnerCalibration(player, summaries);
}

export interface OwnerGameRating {
  gameId: string;
  rating: DifficultyRating;
  /** Null when he has no run on this game ("not played yet"). */
  summary: OwnerGameSummary | null;
  calibration: OwnerCalibration;
  /** ARC's baseline for the game, or null for a game not in the data. */
  baseline: HumanPlayGameBaseline | null;
}

/** Everything the game page needs for Boss's badge and his action count, in one call. */
export function getOwnerGameRating(
  gameId: string,
  player: string = OWNER_PLAYER,
  data: HumanPlayData = HUMAN_PLAY_DATA,
): OwnerGameRating {
  const baseline = getArcBaseline(gameId, data);
  const calibration = getOwnerCalibration(player, data);
  if (!baseline) return { gameId, rating: 'unknown', summary: null, calibration, baseline: null };
  const runs = getPlayerRuns(player, gameId, data);
  return {
    gameId,
    rating: ownerDifficulty(runs, baseline.baselineTotal, calibration),
    summary: summarizeOwnerGame(runs, baseline.baselineTotal),
    calibration,
    baseline,
  };
}
