/*
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-09
 * PURPOSE: TypeScript interfaces and types for Arc3 game metadata, including embedded replay videos.
 *          Extended to describe featured MP4 assets rendered on spoiler pages.
 * SRP/DRY check: Pass - Centralizes shared typing for ARC3 metadata consumers.
 */

/**
 * Difficulty ratings based on community experience
 */
export type DifficultyRating = 'easy' | 'medium' | 'hard' | 'very-hard' | 'unknown';

/**
 * Game category - whether it was in original preview or evaluation set
 */
export type GameCategory = 'preview' | 'evaluation';

/**
 * Action mapping for a game - what each ACTION does
 */
export interface ActionMapping {
  action: 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6' | 'ACTION7';
  description: string;
  /** Common mapping like "Up", "Down", "Left", "Right", "Click", etc. */
  commonName?: string;
  /** Additional notes about how this action behaves */
  notes?: string;
}

/**
 * Featured replay video for a given game
 */
export interface GameVideo {
  /** Public URL (relative to /public) pointing to the MP4 asset */
  src: string;
  /** Short caption or credit line displayed under the video */
  caption?: string;
  /** Optional poster image shown before playback */
  poster?: string;
}

/**
 * A single hint or strategy tip
 */
export interface GameHint {
  id: string;
  title: string;
  content: string;
  /** Spoiler level: 1 = mild hint, 2 = moderate spoiler, 3 = full solution */
  spoilerLevel: 1 | 2 | 3;
  /** Who contributed this hint */
  contributor?: string;
  /** Date added */
  dateAdded?: string;
}

/**
 * External resource related to a game
 */
export interface GameResource {
  title: string;
  url: string;
  type: 'article' | 'video' | 'github' | 'discussion' | 'paper' | 'replay';
  description?: string;
}

/**
 * Screenshot of a specific game level
 */
export interface LevelScreenshot {
  /** Level number (1-based) */
  level: number;
  /** Image URL relative to public folder (e.g., '/ft09-lvl8.png') */
  imageUrl: string;
  /** Optional caption or description */
  caption?: string;
  /** Optional notes about this specific level */
  notes?: string;
}

/**
 * Complete metadata for an ARC-AGI-3 game
 */
export interface Arc3GameMetadata {
  /** Official game ID (e.g., "ls20") */
  gameId: string;

  /** Official title from the ARC3 API */
  officialTitle: string;

  /** Informal community name (e.g., "locksmith" for ls20) */
  informalName?: string;

  /** Brief description of the game objective (may contain spoilers) */
  description: string;

  /**
   * Plain-language explanation of the core mechanic, one or two sentences, no jargon.
   * Not a "kids' version" in tone -- just the same claim as `mechanicsExplanation` with
   * the source-line citations and precise field names stripped out. Required so every
   * game in the registry has one; the source of truth for correctness is still
   * `mechanicsExplanation`, this just has to agree with it.
   */
  simpleExplanation: string;

  /** Detailed explanation of the game mechanics (full spoiler) */
  mechanicsExplanation?: string;

  /** Category: preview (public from start) or evaluation (held back) */
  category: GameCategory;

  /**
   * Difficulty for human players, derived from the ARC Prize human leaderboard's action
   * counts (relative spread across the top 10, plus whether any of them needed a reset).
   * See server/scripts/compute-arc3-difficulty.ts.
   */
  humanDifficulty: DifficultyRating;

  /**
   * Difficulty for AI agents, from a snapshot of our own competition run data (the
   * arc3_game_scores table in the ARC3/Arena Railway Postgres DB): average
   * levels-completed-of-levels-total across recorded runs, ranked against the other 24
   * public games and split into quartiles (bottom 7 = 'very-hard', matching how this
   * rating gets talked about -- "one of the seven hardest"). Not live -- a dated
   * snapshot, re-run by hand. 'unknown' where we have no run data (as66, withdrawn from
   * the public set before this snapshot). See
   * server/scripts/compute-arc3-ai-difficulty.ts.
   */
  aiDifficulty: DifficultyRating;

  /** Win score required to complete the game */
  winScore?: number;

  /** Maximum actions allowed */
  maxActions?: number;

  /** Number of levels in the game (if applicable) */
  levelCount?: number;

  /** Mapping of what each ACTION does in this game */
  actionMappings: ActionMapping[];

  /** Hints and strategies (spoilers) */
  hints: GameHint[];

  /** External resources (articles, videos, replays, etc.) */
  resources: GameResource[];

  /** Level screenshots organized by level number */
  levelScreenshots?: LevelScreenshot[];

  /** Tags for categorization */
  tags: string[];

  /** Screenshot or thumbnail URL (relative to public folder) */
  thumbnailUrl?: string;

  /** Featured replay clip embedded on the spoiler page */
  video?: GameVideo;

  /** Whether this game has been fully documented */
  isFullyDocumented: boolean;

  /** Whether this game is archived (from the preview period) */
  isArchived?: boolean;

  /** Additional notes */
  notes?: string;
}
