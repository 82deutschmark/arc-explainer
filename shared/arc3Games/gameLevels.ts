/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: One game, cut into levels. For each level of the live build: its pictures (engine
 *          render first, then human captures), the rules that START on it, the notes from
 *          play about it, ARC's baseline actions, and what each of Boss's runs did there.
 *
 *          Three readers, one cut. The game page renders these levels as its body
 *          (client/src/components/arc3/gamePage/), the private dataset serialises them for the
 *          arc-3 training repo (server/services/arc3/arc3GameDataset.ts), and the markdown
 *          export at /arc3/games.md prints them (server/services/arc3/arc3GameMechanicsDoc.ts).
 *          Before this file the page and the markdown each grouped the rules by level on their
 *          own; now a rule, picture or note lands on the same level everywhere.
 *
 *          LEVEL COUNT is the live build's (the game file's `levelCount`, else ARC's baseline
 *          list). Anything filed under a higher level comes from an older build -- ft09 keeps
 *          two preview-era shots of levels 8 and 9 from a 9-level build -- and is not a level
 *          of the game the rules and runs describe, so it is left out here. `extraScreenshots`
 *          hands those back so the page can still show them, labelled as what they are.
 *
 *          No statistics. The only numbers are the ones ARC and the scorecards report.
 * SRP/DRY check: Pass -- level grouping only, pure functions over the registry types and the
 *          committed scorecard runs. Rating math stays in humanDifficulty.ts.
 */

import type { Arc3GameMetadata, LevelScreenshot, MechanicPoint, PlayerObservation } from './types';
import type { HumanPlayGameBaseline, HumanPlayRun } from './humanDifficulty';

/** Order of rules inside a level: how you move, what you are after, then everything else. */
export const MECHANIC_CATEGORY_ORDER: readonly MechanicPoint['category'][] = [
  'controls',
  'goal',
  'pieces',
  'hazards',
  'budget',
  'feedback',
  'other',
];

function categoryRank(point: MechanicPoint): number {
  const index = MECHANIC_CATEGORY_ORDER.indexOf(point.category);
  return index === -1 ? MECHANIC_CATEGORY_ORDER.length : index;
}

/** What one run did on one level. */
export interface LevelRun {
  run: HumanPlayRun;
  actions: number;
  /** False when the run ended on this level. */
  cleared: boolean;
}

export interface GameLevel {
  /** 1-based. */
  level: number;
  /** ARC's own baseline action count for this level, when ARC publishes one. */
  arcBaselineActions: number | null;
  /** Engine renders first, then human captures, each in registry order. */
  images: LevelScreenshot[];
  /** Rules that start on this level (no introducedOnLevel = level 1), by category. */
  newRules: MechanicPoint[];
  /** Notes from play tied to this level. */
  observations: PlayerObservation[];
  /** Runs that reached this level, in the order given (pass them in play order). */
  runs: LevelRun[];
}

export interface GameLevels {
  levelCount: number;
  levels: GameLevel[];
  /** Notes from play not tied to a level of the live build. */
  observationsAnyLevel: PlayerObservation[];
  /** Screenshots filed under a level the live build does not have (older builds). */
  extraScreenshots: LevelScreenshot[];
}

export function screenshotKind(shot: LevelScreenshot): 'engine' | 'human' {
  return shot.kind ?? 'engine';
}

/** The live build's level count; falls back to the highest level anything mentions. */
export function liveLevelCount(game: Arc3GameMetadata, baseline: HumanPlayGameBaseline | null): number {
  if (game.levelCount) return game.levelCount;
  if (baseline?.levelCount) return baseline.levelCount;
  return Math.max(
    1,
    ...(game.mechanicsBreakdown ?? []).map((r) => r.introducedOnLevel ?? 1),
    ...(game.levelScreenshots ?? []).map((s) => s.level),
  );
}

/**
 * What a run did on one level (0-based index), or null if it never got there. A run reached
 * every level it cleared, plus the one it was on when it ended if it spent actions there.
 * levelActions is zero-padded to the level count past that point.
 */
export function runOnLevel(run: HumanPlayRun, index: number): LevelRun | null {
  const actions = run.levelActions[index] ?? 0;
  if (index < run.levelsCompleted) return { run, actions, cleared: true };
  if (index === run.levelsCompleted && actions > 0) return { run, actions, cleared: false };
  return null;
}

/**
 * The one run a page quotes per level: the fewest-action win if there is one, otherwise the
 * run that got furthest (fewest actions breaks a tie). Null with no runs.
 */
export function pickHeadlineRun(runs: readonly HumanPlayRun[]): HumanPlayRun | null {
  const wins = runs.filter((r) => r.state === 'WIN');
  const pool = wins.length > 0 ? wins : runs;
  if (pool.length === 0) return null;
  return pool.reduce((best, run) => {
    if (wins.length === 0 && run.levelsCompleted !== best.levelsCompleted) {
      return run.levelsCompleted > best.levelsCompleted ? run : best;
    }
    return run.actions < best.actions ? run : best;
  });
}

export function buildGameLevels(
  game: Arc3GameMetadata,
  runs: readonly HumanPlayRun[],
  baseline: HumanPlayGameBaseline | null,
): GameLevels {
  const levelCount = liveLevelCount(game, baseline);
  const rules = game.mechanicsBreakdown ?? [];
  const shots = game.levelScreenshots ?? [];
  const notes = game.playerObservations ?? [];

  const levels: GameLevel[] = [];
  for (let level = 1; level <= levelCount; level += 1) {
    const index = level - 1;
    const here = shots.filter((s) => s.level === level);
    levels.push({
      level,
      arcBaselineActions: baseline?.baselineActions[index] ?? null,
      images: [
        ...here.filter((s) => screenshotKind(s) === 'engine'),
        ...here.filter((s) => screenshotKind(s) === 'human'),
      ],
      // Array sort is stable, so rules of one category keep the order they were written in.
      newRules: rules
        .filter((r) => (r.introducedOnLevel ?? 1) === level)
        .sort((a, b) => categoryRank(a) - categoryRank(b)),
      observations: notes.filter((n) => n.level === level),
      runs: runs.map((run) => runOnLevel(run, index)).filter((r): r is LevelRun => r !== null),
    });
  }

  return {
    levelCount,
    levels,
    // A note on a level the live build lacks has nowhere else to go, so it is kept here.
    observationsAnyLevel: notes.filter((n) => typeof n.level !== 'number' || n.level < 1 || n.level > levelCount),
    extraScreenshots: shots.filter((s) => s.level > levelCount),
  };
}
