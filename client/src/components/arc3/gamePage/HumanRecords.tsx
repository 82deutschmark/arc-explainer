/*
 * Author: Claude Opus 5 (moved; original code by Claude Opus 5, 2026-09-16)
 * Date: 2026-09-18
 * PURPOSE: The ARC Prize human top-10 board for one game: fewest / median / most actions over
 *          recent wins, and the full table with old rows greyed out. Now the body of a fold-out
 *          (the card and title moved to the page's FoldOut), plus a one-line summary for it.
 *          Moved out of client/src/pages/Arc3GameSpoiler.tsx when the game page was
 *          rebuilt level by level (docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md).
 * SRP/DRY check: Pass -- one component, same code as before the move; rating math stays in
 *          shared/arc3Games/humanDifficulty.ts.
 */

import { ExternalLink } from 'lucide-react';
import { arcPrizeLeaderboardUrl } from '@shared/arc3Games';
import { CUTOFF_DAY, formatDay, plural, type HumanLeaderboard } from './humanLeaderboard';

/**
 * What people actually did on this game, from the official ARC Prize human leaderboard.
 *
 * The interesting number is the ACTION COUNT, not the score: every row on every board
 * scored 100 when this was written, and what separates players is how many moves they
 * needed. Only rows published on or after the cutoff count toward the numbers; older
 * rows stay in the table, greyed out with their date, so nothing is hidden.
 *
 * Renders nothing at all when the endpoint has nothing for this game -- it is somebody
 * else's service and the write-up must not depend on it being up. The board is fetched
 * once by the page and passed in.
 */
export function HumanRecordsBody({ gameId, board }: { gameId: string; board: HumanLeaderboard | undefined }) {
  if (!board || board.entries.length === 0) return null;

  const { stats } = board;
  const hasRecentWins = stats.recentWins > 0;
  const recentNonWins = stats.recentRows - stats.recentWins;

  let scoreLine: string | null = null;
  if (hasRecentWins && stats.scoreMin !== null && stats.scoreMax !== null) {
    if (stats.scoreMin === stats.scoreMax) {
      scoreLine =
        stats.scoreMin === 100
          ? 'Every recent winning score is 100, so score does not separate anyone here. Action counts do.'
          : `Every recent winning score is ${stats.scoreMin}.`;
    } else {
      scoreLine = `Recent winning scores run from ${stats.scoreMin} to ${stats.scoreMax}.`;
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        From the official ARC Prize human leaderboard. The numbers count only wins published on or
        after {CUTOFF_DAY}.
      </p>
      {hasRecentWins ? (
        <div className="flex flex-wrap gap-8">
          <div>
            <div className="text-3xl font-bold tabular-nums">{stats.fewestActions ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">fewest actions</div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums">{stats.medianActions ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">median actions</div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums">{stats.mostActions ?? '—'}</div>
            <div className="text-xs text-muted-foreground mt-0.5">most actions</div>
          </div>
          <div>
            <div className="text-3xl font-bold tabular-nums text-muted-foreground">{stats.recentWins}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              recent {stats.recentWins === 1 ? 'win' : 'wins'} counted
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm">
          No row on this board is a win published on or after {CUTOFF_DAY}, so there are no recent
          action counts to show.
        </p>
      )}

      <div className="space-y-1 text-sm">
        {scoreLine && <p>{scoreLine}</p>}
        <p className="text-muted-foreground">
          {stats.recentRows} of {stats.totalRows} rows are from the last 90 days (published on or after{' '}
          {CUTOFF_DAY}). Older rows are greyed out below and left out of the top-10 numbers and rating.
          {recentNonWins > 0 &&
            ` ${plural(recentNonWins, 'recent row')} did not end in a win and ${recentNonWins === 1 ? 'is' : 'are'} not counted either.`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b">
              <th className="py-2 pr-4 font-medium">#</th>
              <th className="py-2 pr-4 font-medium">Player</th>
              <th className="py-2 pr-4 font-medium text-right">Score</th>
              <th className="py-2 pr-4 font-medium text-right">Actions</th>
              <th className="py-2 pr-4 font-medium text-right">Resets</th>
              <th className="py-2 font-medium text-right">Published</th>
            </tr>
          </thead>
          <tbody>
            {board.entries.map((entry, index) => (
              <tr
                key={`${entry.userName}-${index}`}
                className={`border-b last:border-0 ${entry.recent ? '' : 'text-muted-foreground opacity-60'}`}
                title={entry.recent ? undefined : `Published before ${CUTOFF_DAY}: not counted`}
              >
                <td className="py-2 pr-4 text-muted-foreground tabular-nums">{index + 1}</td>
                <td className="py-2 pr-4">{entry.userName}</td>
                <td className="py-2 pr-4 text-right tabular-nums">{entry.score}</td>
                <td className={`py-2 pr-4 text-right tabular-nums ${entry.recent ? 'font-semibold' : ''}`}>
                  {entry.actions}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">{entry.resets}</td>
                <td className="py-2 text-right tabular-nums whitespace-nowrap">
                  {formatDay(entry.publishedAt)}
                  {!entry.recent && <span className="ml-1 text-xs">(old)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <a
        href={arcPrizeLeaderboardUrl(gameId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-sm text-primary hover:underline"
      >
        Full leaderboard on arcprize.org
        <ExternalLink className="h-3 w-3 ml-1" />
      </a>
    </div>
  );
}

/**
 * One line for the collapsed fold-out, so the headline number shows without opening it.
 * Null when there is no board to fold away.
 */
export function humanRecordsSummary(board: HumanLeaderboard | undefined): string | null {
  if (!board || board.entries.length === 0) return null;
  const { stats } = board;
  if (stats.recentWins === 0) return `${plural(board.entries.length, 'row')}, no wins since ${CUTOFF_DAY}`;
  return `fewest ${stats.fewestActions} actions, median ${stats.medianActions}, over ${plural(stats.recentWins, 'recent win')}`;
}
