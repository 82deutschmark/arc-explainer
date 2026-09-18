/*
 * Author: Claude Opus 5
 * Date: 2026-09-18
 * PURPOSE: The ARC Prize human top-10 board as the game page receives it from
 *          /api/arc3/leaderboard/:gameId, plus the two little formatters every game-page
 *          component uses for dates and counts. Moved out of client/src/pages/Arc3GameSpoiler.tsx
 *          (where they were defined 2026-09-16) when the page was split into components.
 * SRP/DRY check: Pass -- types and formatting only; the numbers are computed on the server
 *          (arcPrizeLeaderboardService.ts) and in shared/arc3Games/humanDifficulty.ts.
 */

import { HUMAN_DATA_CUTOFF, type Top10Stats } from '@shared/arc3Games/humanDifficulty';

/** Mirrors HumanLeaderboardEntry in server/services/arc3/arcPrizeLeaderboardService.ts. */
export interface HumanLeaderboardEntry {
  userName: string;
  score: number;
  actions: number;
  resets: number;
  endState: string;
  publishedAt: string | null;
  /** Published on or after HUMAN_DATA_CUTOFF. False = an old row: greyed out, not in `stats`. */
  recent: boolean;
}

/** Mirrors HumanLeaderboard in server/services/arc3/arcPrizeLeaderboardService.ts. */
export interface HumanLeaderboard {
  gameId: string;
  /** Every row the board returned, best first, old rows included. */
  entries: HumanLeaderboardEntry[];
  /** Fewest actions among recent wins. Same number as stats.fewestActions. */
  fewestActions: number | null;
  recentCutoff: string;
  /** Computed on the server from recent winning rows only. */
  stats: Top10Stats;
  fetchedAt: string;
}

/** A calendar day in UTC ("18 Jun 2026"), the same way the cutoff is defined. */
export function formatDay(iso: string | null): string {
  if (!iso) return 'no date';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'no date';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export const CUTOFF_DAY = formatDay(HUMAN_DATA_CUTOFF);

export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
