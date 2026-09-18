/*
 * Author: Claude Opus 5 (moved; original code by Claude Opus 5, 2026-09-16)
 * Date: 2026-09-18
 * PURPOSE: The four action counts at the top of a game page: ARC's baseline, the fewest and
 *          median actions among recent top-10 wins, and Boss's own count.
 *          Now sits inside the "In plain English" card, so its own border became a top rule
 *          and the numbers a size smaller. Moved out of client/src/pages/Arc3GameSpoiler.tsx when the game page was
 *          rebuilt level by level (docs/plans/2026-09-18-arc3-game-page-glowup-and-dataset-prd.md).
 * SRP/DRY check: Pass -- one component, same code as before the move; rating math stays in
 *          shared/arc3Games/humanDifficulty.ts.
 */

import React from 'react';
import { getPlayerRuns, OWNER_PLAYER, type OwnerGameRating } from '@shared/arc3Games/humanDifficulty';
import { formatDay, plural, type HumanLeaderboard } from './humanLeaderboard';

/** One number in the action strip: the number big, what it is small underneath. */
function StatCell({
  value,
  label,
  detail,
  title,
}: {
  value: React.ReactNode;
  label: string;
  detail?: string;
  title: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-xs font-medium text-muted-foreground mt-2">{label}</div>
      {detail && <div className="text-xs text-muted-foreground/80 mt-0.5">{detail}</div>}
    </div>
  );
}

/**
 * The action counts, right under the title on every game page: ARC's baseline, the fewest
 * and median actions among top-10 wins, and Boss's own count.
 *
 * The baseline and Boss's numbers come from the committed humanPlay data, so they
 * always render. The two top-10 numbers come from the leaderboard route; when that is
 * loading or down, those two cells say so and the rest of the strip still shows.
 */
export function ActionCountStrip({
  gameId,
  owner,
  board,
  boardFailed,
}: {
  gameId: string;
  owner: OwnerGameRating;
  board: HumanLeaderboard | undefined;
  boardFailed: boolean;
}) {
  const { baseline, summary } = owner;
  const stats = board?.stats;
  const boardMissingDetail = boardFailed ? 'leaderboard unavailable' : 'loading leaderboard';

  let fewestDetail: string;
  let medianDetail: string;
  if (!stats) {
    fewestDetail = boardMissingDetail;
    medianDetail = boardMissingDetail;
  } else if (stats.wins === 0) {
    fewestDetail = 'no wins on the board';
    medianDetail = 'no wins on the board';
  } else {
    fewestDetail = `best of ${plural(stats.wins, 'win')}`;
    medianDetail =
      stats.wins === 1 ? 'only 1 win' : `${stats.fewestActions}–${stats.mostActions} across ${stats.wins} wins`;
  }

  let ownerValue: React.ReactNode = '—';
  let ownerLabel = `${OWNER_PLAYER}'s actions`;
  let ownerDetail = 'not played yet';
  let ownerTitle = `${OWNER_PLAYER} has no run on the current build of this game.`;
  if (summary?.won && summary.bestWin) {
    const best = summary.bestWin;
    ownerValue = best.actions;
    ownerLabel = `${OWNER_PLAYER}'s best win`;
    ownerDetail =
      summary.failedBeforeFirstWin > 0
        ? `WIN, after ${plural(summary.failedBeforeFirstWin, 'run')} that did not win`
        : 'WIN';
    ownerTitle =
      `${OWNER_PLAYER}'s fewest-action winning run on the current build: ` +
      `${best.actions} actions, ${best.levelsCompleted} of ${best.levelCount} levels, played ${formatDay(best.openAt)}.` +
      (summary.failedBeforeFirstWin > 0
        ? ` Before his first win he spent ${summary.failedActionsBeforeFirstWin} actions on ${plural(summary.failedBeforeFirstWin, 'run')} that did not win.`
        : '');
  } else if (summary) {
    const runs = getPlayerRuns(OWNER_PLAYER, gameId);
    const mostLevels = runs.reduce((most, run) => Math.max(most, run.levelsCompleted), 0);
    const levelCount = baseline?.levelCount ?? runs[0]?.levelCount;
    ownerValue = summary.actionsSpent;
    ownerLabel = `${OWNER_PLAYER}'s actions so far`;
    ownerDetail = `not won yet, ${plural(summary.runs, 'run')}`;
    ownerTitle =
      `${OWNER_PLAYER} has not won this game on the current build. ` +
      `${summary.actionsSpent} actions over ${plural(summary.runs, 'run')} so far` +
      (levelCount ? `; his furthest run cleared ${mostLevels} of ${levelCount} levels.` : '.');
  }

  return (
    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-4 border-t pt-4">
      <StatCell
        value={baseline?.baselineTotal ?? '—'}
        label="ARC baseline actions"
        detail={baseline ? `${baseline.levelCount} levels added up` : 'no baseline for this game'}
        title={
          baseline
            ? `ARC's own per-level action baseline for the current build (${baseline.build}), from the game's metadata.json. Per level: ${baseline.baselineActions.join(', ')}.`
            : 'No ARC baseline is recorded for this game.'
        }
      />
      <StatCell
        value={stats?.fewestActions ?? '—'}
        label="Fewest human actions (top 10)"
        detail={fewestDetail}
        title="Fewest actions among the ARC Prize top-10 rows that won."
      />
      <StatCell
        value={stats?.medianActions ?? '—'}
        label="Top-10 median actions"
        detail={medianDetail}
        title="Median actions among the ARC Prize top-10 rows that won. With an even count it is the average of the middle two, so it can end in .5."
      />
      <StatCell value={ownerValue} label={ownerLabel} detail={ownerDetail} title={ownerTitle} />
    </div>
  );
}
