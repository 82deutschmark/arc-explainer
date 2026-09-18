/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: The ARC Prize human top-10 board as the game page receives it from
 *          /api/arc3/leaderboard/:gameId, plus the two little formatters every game-page
 *          component uses for dates and counts. Moved out of client/src/pages/Arc3GameSpoiler.tsx
 *          (where they were defined 2026-09-16) when the page was split into components.
 *          2026-09-18: the 90-day recency cut is gone; the board mirrors arcprize.org exactly.
 * SRP/DRY check: Pass -- types and formatting only; the numbers are computed on the server
 *          (arcPrizeLeaderboardService.ts) and in shared/arc3Games/humanDifficulty.ts.
 */

import type { Top10Stats } from '@shared/arc3Games/humanDifficulty';

/** Mirrors HumanLeaderboardEntry in server/services/arc3/arcPrizeLeaderboardService.ts. */
export interface HumanLeaderboardEntry {
  userName: string;
  score: number;
  actions: number;
  resets: number;
  endState: string;
  publishedAt: string | null;
}

/** Mirrors HumanLeaderboard in server/services/arc3/arcPrizeLeaderboardService.ts. */
export interface HumanLeaderboard {
  gameId: string;
  /** Every row the board returned, in ARC Prize's own order. */
  entries: HumanLeaderboardEntry[];
  /** Fewest actions among wins. Same number as stats.fewestActions. */
  fewestActions: number | null;
  /** Computed on the server from the winning rows. */
  stats: Top10Stats;
  fetchedAt: string;
}

/** A calendar day in UTC ("18 Jun 2026"). */
export function formatDay(iso: string | null): string {
  if (!iso) return 'no date';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'no date';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
