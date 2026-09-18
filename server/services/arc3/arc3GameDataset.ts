/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: Builds the machine-readable game dataset: one JSON document per public ARC-AGI-3
 *          game, organised level by level, built from the shared/arc3Games registry and
 *          humanPlay.generated.json. Served (token-gated) by server/routes/arc3Dataset.ts
 *          so the arc-3 training repo can fetch it; see
 *          docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md.
 *
 *          SINGLE SOURCE OF TRUTH. Every field is read from the same objects the game pages
 *          and /arc3/games.md render. Nothing is copied into this file and nothing is written
 *          to disk, so a correction to a game file is in the dataset on the next request and
 *          arc-3 never holds a second hand-edited copy.
 *
 *          THE LEVEL IS THE UNIT. Each level carries its pictures, the rules that START on
 *          that level (`newRules`), Boss's notes about it, and what each of Boss's runs did
 *          there. The rules in force on level N are the `newRules` of levels 1..N; they are
 *          not repeated per level, so there is one copy of each rule.
 *
 *          WHAT IS LEFT OUT, ON PURPOSE.
 *            - as66: withdrawn from the public set, and test-only in the arc-3 harness, so it
 *              must never reach a training corpus. Only the live public ids are exported.
 *            - The game code. It lives in ARC's engine package; each rule cites its lines
 *              (`source`, e.g. "dc22.py:10663-10708") against the `build` given here.
 *            - Frame-by-frame replays. arc-3 has those; each run carries its `guid`, the key
 *              into that corpus, and the arcprize.org replay URL.
 *            - Ratings and derived statistics. Only the numbers ARC and the scorecards report.
 * SRP/DRY check: Pass -- serialising only; HTTP lives in routes/arc3Dataset.ts and the level
 *          cut in shared/arc3Games/gameLevels.ts (shared with the page and the markdown).
 *          Reuses getPublicDemoGameIdsInOrder (the as66 exclusion), getArcBaseline /
 *          getPlayerRuns / OWNER_PLAYER (scorecard data), and SITE_ORIGIN from the markdown
 *          export rather than restating any of them.
 */

import {
  getGameById,
  getPublicDemoGameIdsInOrder,
  type ActionMapping,
  type Arc3GameMetadata,
  type LevelScreenshot,
  type MechanicPoint,
  type PlayerObservation,
} from '../../../shared/arc3Games';
import { getArcBaseline, getPlayerRuns, OWNER_PLAYER } from '../../../shared/arc3Games/humanDifficulty';
import { buildGameLevels, screenshotKind, type LevelRun } from '../../../shared/arc3Games/gameLevels';
import { SITE_ORIGIN } from './arc3GameMechanicsDoc';

/** Bumped whenever a field is renamed or removed; additions keep the version. */
export const ARC3_GAME_DATASET_SCHEMA = 'arc-explainer/arc3-game/v1';

export interface Arc3DatasetRule {
  category: MechanicPoint['category'];
  text: string;
  /** "file.py:lines" in ARC's engine package for `build`; null when it was confirmed by play, not read. */
  source: string | null;
}

export interface Arc3DatasetImage {
  /** 'engine' = the level's opening frame; 'human' = a mid-play screenshot. */
  kind: 'engine' | 'human';
  url: string;
  caption: string | null;
  notes: string | null;
}

export interface Arc3DatasetObservation {
  player: string;
  date: string;
  saw: string;
  did: string | null;
  expected: string | null;
  happened: string;
  inCode: string | null;
}

/** One of Boss's runs, as far as it got on one level. */
export interface Arc3DatasetLevelRun {
  guid: string;
  actions: number;
  /** False when the run ended on this level. */
  cleared: boolean;
}

export interface Arc3DatasetLevel {
  level: number;
  /** ARC's own baseline action count for this level, when ARC publishes one. */
  arcBaselineActions: number | null;
  images: Arc3DatasetImage[];
  /** Rules that start on this level. Rules in force = newRules of levels 1..this one. */
  newRules: Arc3DatasetRule[];
  observations: Arc3DatasetObservation[];
  /** Boss's runs that reached this level, in play order. */
  runs: Arc3DatasetLevelRun[];
}

export interface Arc3DatasetRun {
  player: string;
  guid: string;
  replayUrl: string;
  openedAt: string;
  /**
   * 'WIN' | 'GAME_OVER' | 'NOT_FINISHED', as arcprize.org reports it. Filter on WIN for
   * demonstrations: some NOT_FINISHED runs are a few actions of looking around, then quitting.
   */
  state: string;
  levelsCompleted: number;
  actions: number;
}

export interface Arc3GameDataset {
  schema: typeof ARC3_GAME_DATASET_SCHEMA;
  gameId: string;
  informalName: string | null;
  officialTitle: string;
  /** Build hash the rule citations and runs refer to. Null when we have no scorecard data. */
  build: string | null;
  category: Arc3GameMetadata['category'];
  levelCount: number;
  pageUrl: string;
  description: string;
  plainEnglish: string;
  controls: ActionMapping[];
  levels: Arc3DatasetLevel[];
  /** Notes from play that are not tied to one level. */
  observationsAnyLevel: Arc3DatasetObservation[];
  /** Boss's kept runs on the live build, in play order. */
  runs: Arc3DatasetRun[];
  /** Free-text maintainer notes and dated corrections, verbatim. */
  notes: string | null;
}

export interface Arc3GameDatasetBundle {
  schema: typeof ARC3_GAME_DATASET_SCHEMA;
  generatedAt: string;
  games: Arc3GameDataset[];
}

function toRule(point: MechanicPoint): Arc3DatasetRule {
  return { category: point.category, text: point.text, source: point.source ?? null };
}

function toImage(shot: LevelScreenshot): Arc3DatasetImage {
  return {
    kind: screenshotKind(shot),
    url: new URL(shot.imageUrl, SITE_ORIGIN).toString(),
    caption: shot.caption ?? null,
    notes: shot.notes ?? null,
  };
}

function toObservation(note: PlayerObservation): Arc3DatasetObservation {
  return {
    player: note.player,
    date: note.date,
    saw: note.saw,
    did: note.did ?? null,
    expected: note.expected ?? null,
    happened: note.happened,
    inCode: note.inCode ?? null,
  };
}

function toLevelRun(entry: LevelRun): Arc3DatasetLevelRun {
  return { guid: entry.run.guid, actions: entry.actions, cleared: entry.cleared };
}

/** Null for an id that is not in the live public set (unknown ids and as66 alike). */
export function buildArc3GameDataset(gameId: string): Arc3GameDataset | null {
  if (!getPublicDemoGameIdsInOrder().includes(gameId)) return null;
  const game = getGameById(gameId) as Arc3GameMetadata | undefined;
  if (!game) return null;

  const baseline = getArcBaseline(gameId);
  const runs = getPlayerRuns(OWNER_PLAYER, gameId);
  // The level cut is shared with the game page and /arc3/games.md (shared/arc3Games/gameLevels.ts),
  // including the rule that levels past the live build's count (ft09's preview-era 8 and 9) stay out.
  const cut = buildGameLevels(game, runs, baseline);
  const levels: Arc3DatasetLevel[] = cut.levels.map((level) => ({
    level: level.level,
    arcBaselineActions: level.arcBaselineActions,
    images: level.images.map(toImage),
    newRules: level.newRules.map(toRule),
    observations: level.observations.map(toObservation),
    runs: level.runs.map(toLevelRun),
  }));

  return {
    schema: ARC3_GAME_DATASET_SCHEMA,
    gameId: game.gameId,
    informalName: game.informalName ?? null,
    officialTitle: game.officialTitle,
    build: baseline?.build ?? null,
    category: game.category,
    levelCount: cut.levelCount,
    pageUrl: `${SITE_ORIGIN}/arc3/games/${game.gameId}`,
    description: game.description,
    plainEnglish: game.simpleExplanation,
    controls: game.actionMappings,
    levels,
    observationsAnyLevel: cut.observationsAnyLevel.map(toObservation),
    runs: runs.map((run) => ({
      player: run.player,
      guid: run.guid,
      replayUrl: `https://arcprize.org/replay/${run.guid}`,
      openedAt: run.openAt,
      state: run.state,
      levelsCompleted: run.levelsCompleted,
      actions: run.actions,
    })),
    notes: game.notes ?? null,
  };
}

/** Every live public game, in ARC's own order (alphabetical by id). */
export function buildArc3GameDatasetBundle(): Arc3GameDatasetBundle {
  const games = getPublicDemoGameIdsInOrder()
    .map((id) => buildArc3GameDataset(id))
    .filter((g): g is Arc3GameDataset => g !== null);
  return { schema: ARC3_GAME_DATASET_SCHEMA, generatedAt: new Date().toISOString(), games };
}
