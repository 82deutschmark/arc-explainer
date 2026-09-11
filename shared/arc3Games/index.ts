/*
 * Author: Claude Haiku 4.5 (original); extended by Claude Sonnet 5, 2026-09-11
 * Date: 2025-12-27 (last extended 2026-09-11)
 * PURPOSE: Central registry aggregating all Arc3 games and providing helper functions.
 *          This index maintains backward compatibility by re-exporting all types
 *          and providing the ARC3_GAMES registry. Extended 2026-09-11 to cover the
 *          full 25-game ARC-AGI-3 public demo set (see
 *          docs/2026-09-11-arc3-25-game-names-plan.md and the two companion analysis
 *          docs it links) -- as66 is kept for its historical preview-era spoiler content
 *          even though it's no longer part of the public demo set (see as66.ts notes).
 * SRP/DRY check: Pass - Single responsibility for game registry aggregation.
 */

import { ls20 } from './ls20';
import { as66 } from './as66';
import { ft09 } from './ft09';
import { lp85 } from './lp85';
import { sp80 } from './sp80';
import { vc33 } from './vc33';
import { sk48 } from './sk48';
import { tr87 } from './tr87';
import { bp35 } from './bp35';
import { wa30 } from './wa30';
import { cn04 } from './cn04';
import { dc22 } from './dc22';
import { lf52 } from './lf52';
import { ar25 } from './ar25';
import { cd82 } from './cd82';
import { g50t } from './g50t';
import { ka59 } from './ka59';
import { m0r0 } from './m0r0';
import { r11l } from './r11l';
import { re86 } from './re86';
import { s5i5 } from './s5i5';
import { sb26 } from './sb26';
import { sc25 } from './sc25';
import { su15 } from './su15';
import { tn36 } from './tn36';
import { tu93 } from './tu93';

// Re-export all types for backward compatibility
export * from './types';
export type { Arc3GameMetadata, DifficultyRating, GameCategory, ActionMapping, GameHint, GameResource, LevelScreenshot } from './types';

/**
 * Complete database of ARC-AGI-3 game metadata and spoilers.
 *
 * The original 6 revealed games from the preview:
 * - Preview set (public from start): ls20, as66, ft09
 * - Evaluation set (held back): lp85, sp80, vc33
 *
 * as66 has since been withdrawn from the public demo set (confirmed 2026-09-11 against
 * arcprize.org's live task list, the astraHarnessGap.ts extract, and the ARCEngine
 * download batch -- see as66.ts's notes); it's kept here as historical content.
 *
 * The other 19 entries below cover the rest of the current 25-game public demo set.
 */
export const ARC3_GAMES: Record<string, any> = {
  ls20,
  as66,
  ft09,
  lp85,
  sp80,
  vc33,
  sk48,
  tr87,
  bp35,
  wa30,
  cn04,
  dc22,
  lf52,
  ar25,
  cd82,
  g50t,
  ka59,
  m0r0,
  r11l,
  re86,
  s5i5,
  sb26,
  sc25,
  su15,
  tn36,
  tu93,
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
