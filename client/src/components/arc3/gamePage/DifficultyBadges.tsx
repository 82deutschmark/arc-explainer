/*
 * Author: Claude Opus 5 (moved; original code by Claude Opus 5, 2026-09-16)
 * Date: 2026-09-18
 * PURPOSE: The difficulty badges on a game page -- Human (top 10), Human (Boss) and AI -- and
 *          the exact rule behind each, shown as its tooltip.
 *          Moved out of client/src/pages/Arc3GameSpoiler.tsx unchanged when the game page was
 *          rebuilt level by level (docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md).
 * SRP/DRY check: Pass -- one component, same code as before the move; rating math stays in
 *          shared/arc3Games/humanDifficulty.ts.
 */

import type { User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DifficultyRating } from '@shared/arc3Games';
import {
  top10Difficulty,
  OWNER_PLAYER,
  OWNER_EASY_AT_OR_BELOW,
  OWNER_HARD_AT,
  OWNER_VERY_HARD_AT,
  OWNER_MIN_WON_GAMES,
  TOP10_MIN_RECENT_WINS,
  TOP10_EASY_BELOW,
  TOP10_HARD_AT,
  type OwnerGameRating,
} from '@shared/arc3Games/humanDifficulty';
import { CUTOFF_DAY, plural, type HumanLeaderboard } from './humanLeaderboard';

const DIFFICULTY_STYLES: Record<DifficultyRating, string> = {
  easy: 'bg-green-50 text-green-700 border-green-300',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-300',
  hard: 'bg-orange-50 text-orange-700 border-orange-300',
  'very-hard': 'bg-red-50 text-red-700 border-red-300',
  unknown: 'bg-gray-50 text-gray-500 border-gray-300',
};

const DIFFICULTY_LABELS: Record<DifficultyRating, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  'very-hard': 'Very Hard',
  unknown: 'Unknown',
};

/**
 * Separate difficulty signals, deliberately kept apart rather than averaged into one
 * badge: the top-10 rating comes from the ARC Prize human leaderboard, the owner rating
 * from his own scorecards, and aiDifficulty from a dated snapshot of our own competition
 * run data. They disagree often enough (su15 is hard on the top-10 spread and medium for
 * the owner) that collapsing them into one number would hide the more interesting fact.
 *
 * `label` replaces the rating word (e.g. "Not played yet"); `note` is added after it in
 * brackets (e.g. "not won yet").
 */
export function DifficultyBadge({
  icon: Icon,
  prefix,
  difficulty,
  title,
  label,
  note,
}: {
  icon: typeof User;
  prefix: string;
  difficulty: DifficultyRating;
  title: string;
  label?: string;
  note?: string;
}) {
  return (
    <Badge variant="outline" className={DIFFICULTY_STYLES[difficulty]} title={title}>
      <Icon className="h-3 w-3 mr-1" />
      {prefix}: {label ?? DIFFICULTY_LABELS[difficulty]}
      {note ? ` (${note})` : ''}
    </Badge>
  );
}

/** Rating, bracketed note and the exact tooltip for the "Human (top 10)" badge. */
export function describeTop10Rating(
  board: HumanLeaderboard | undefined,
  boardFailed: boolean,
): { rating: DifficultyRating; note?: string; title: string } {
  const rule =
    `From the ARC Prize human top-10 board for this game. Only rows that won and were published on or after ` +
    `${CUTOFF_DAY} count. Spread = (most actions - fewest actions) / fewest actions across those rows: ` +
    `under ${TOP10_EASY_BELOW.toFixed(2)} is easy, under ${TOP10_HARD_AT.toFixed(2)} is medium, ` +
    `${TOP10_HARD_AT.toFixed(2)} or more is hard. Fewer than ${TOP10_MIN_RECENT_WINS} recent wins gives unknown. ` +
    `Resets and scores are not used.`;
  if (!board) {
    return {
      rating: 'unknown',
      title: `${rule} The leaderboard ${boardFailed ? 'could not be loaded' : 'is still loading'}, so there is no rating yet.`,
    };
  }
  const { stats } = board;
  const rating = top10Difficulty(stats);
  const spread = stats.relativeSpread !== null ? `, spread ${stats.relativeSpread.toFixed(2)}` : '';
  return {
    rating,
    note: rating === 'unknown' ? plural(stats.recentWins, 'recent win') : undefined,
    title: `${rule} This game: ${plural(stats.recentWins, 'recent win')}${spread}.`,
  };
}

/** Rating, label, bracketed note and the exact tooltip for the owner's badge. */
export function describeOwnerRating(owner: OwnerGameRating): {
  rating: DifficultyRating;
  label?: string;
  note?: string;
  title: string;
} {
  const { summary, calibration } = owner;
  const medianEffort = calibration.medianEffort;
  const rule =
    `From ${OWNER_PLAYER}'s own arcprize.org scorecards: runs with at least one action, opened on or after ` +
    `${CUTOFF_DAY}, on the current game build. Effort = actions on his best win, plus actions on every run ` +
    `that did not win before his first win, divided by ARC's baseline total for the game. ` +
    (medianEffort !== null
      ? `That is compared with his median effort over the ${calibration.gamesWon} games he has won (${medianEffort.toFixed(2)}): `
      : `That is compared with his median effort over the games he has won (he needs ${OWNER_MIN_WON_GAMES} or more; he has ${calibration.gamesWon}, so there is no median yet): `) +
    `${OWNER_EASY_AT_OR_BELOW}x his median or less is easy, under ${OWNER_HARD_AT}x is medium, ` +
    `under ${OWNER_VERY_HARD_AT}x is hard, ${OWNER_VERY_HARD_AT}x or more is very hard. ` +
    `A game he has not won yet is rated at least hard, because his actions so far are only a floor.`;

  if (!summary) {
    return {
      rating: 'unknown',
      label: 'Not played yet',
      title: `${rule} This game: no runs yet.`,
    };
  }
  if (!summary.won) {
    return {
      rating: owner.rating,
      note: 'not won yet',
      title:
        `${rule} This game: not won yet, ${summary.actionsSpent} actions over ${plural(summary.recentRuns, 'run')} so far. ` +
        `The rating says the game is unfinished for him, not how hard a win turned out to be.`,
    };
  }
  const ratio = medianEffort !== null && medianEffort > 0 && summary.effort !== null ? summary.effort / medianEffort : null;
  return {
    rating: owner.rating,
    title:
      `${rule} This game: effort ${summary.effort !== null ? summary.effort.toFixed(2) : 'n/a'}` +
      (ratio !== null ? `, ${ratio.toFixed(2)}x his median.` : '.'),
  };
}
