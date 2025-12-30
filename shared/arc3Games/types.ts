/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: TypeScript interfaces and types for Arc3 game metadata.
 *          Extracted from monolithic arc3Games.ts for modularity.
 * SRP/DRY check: Pass - Single responsibility for type definitions.
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

  /** Detailed explanation of the game mechanics (full spoiler) */
  mechanicsExplanation?: string;

  /** Category: preview (public from start) or evaluation (held back) */
  category: GameCategory;

  /** Difficulty rating based on community experience */
  difficulty: DifficultyRating;

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

  /** Whether this game has been fully documented */
  isFullyDocumented: boolean;

  /** Additional notes */
  notes?: string;
}
