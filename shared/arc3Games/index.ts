/*
 * Author: Claude Haiku 4.5
 * Date: 2025-12-27
 * PURPOSE: Central registry aggregating all Arc3 games and providing helper functions.
 *          This index maintains backward compatibility by re-exporting all types
 *          and providing the ARC3_GAMES registry.
 * SRP/DRY check: Pass - Single responsibility for game registry aggregation.
 */

import { ls20 } from './ls20';
import { as66 } from './as66';
import { ft09 } from './ft09';
import { lp85 } from './lp85';
import { sp80 } from './sp80';
import { vc33 } from './vc33';

// Re-export all types for backward compatibility
export * from './types';
export type { Arc3GameMetadata, DifficultyRating, GameCategory, ActionMapping, GameHint, GameResource, LevelScreenshot } from './types';

/**
 * Complete database of ARC-AGI-3 game metadata and spoilers.
 *
 * The 6 revealed games from the preview:
 * - Preview set (public from start): ls20, as66, ft09
 * - Evaluation set (held back): lp85, sp80, vc33
 */
export const ARC3_GAMES: Record<string, any> = {
  ls20,
  as66,
  ft09,
  lp85,
  sp80,
  vc33,
};

/**
 * Get all games as an array, sorted by category and then by gameId
 */
export function getAllGames() {
  return Object.values(ARC3_GAMES).sort((a, b) => {
    // Preview games first
    if (a.category !== b.category) {
      return a.category === 'preview' ? -1 : 1;
    }
    return a.gameId.localeCompare(b.gameId);
  });
}

/**
 * Get games by category
 */
export function getGamesByCategory(category: 'preview' | 'evaluation') {
  return getAllGames().filter(game => game.category === category);
}

/**
 * Get a specific game by ID
 */
export function getGameById(gameId: string) {
  return ARC3_GAMES[gameId];
}

/**
 * Check if a game exists in our database
 */
export function hasGameMetadata(gameId: string): boolean {
  return gameId in ARC3_GAMES;
}
