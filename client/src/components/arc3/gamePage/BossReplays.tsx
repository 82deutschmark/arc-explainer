/*
Author: Claude Opus 5.5 High
Date: 2026-11-01
PURPOSE: Boss's replays of one game, on that game's page, right under the plain-English summary
         and the action counts. The site's point is his guide to the reasoning plus his replay
         to watch; until now the replay was buried in the sources list, and on some games absent
         even though the run was in our data.
SRP/DRY check: Pass - reads getOwnerReplays, the one ranking of his runs; the hub's table uses it too.
*/
import { arcPrizeReplayUrl, getOwnerReplays, OWNER_PLAYER, type HumanPlayRun } from '@shared/arc3Games/humanDifficulty';
import { plural } from './humanLeaderboard';

/** "Won, 561 actions" or "5 of 7 levels, 335 actions". Shared with the hub's table. */
export function replayOutcome(run: HumanPlayRun): string {
  const result = run.state === 'WIN' ? 'Won' : `${run.levelsCompleted} of ${run.levelCount} levels`;
  return `${result}, ${plural(run.actions, 'action')}`;
}

export function BossReplays({ gameId }: { gameId: string }) {
  const replays = getOwnerReplays(gameId).filter((run) => run.levelsCompleted > 0);
  if (!replays.length) return null;
  return (
    <div className="mt-4 border-t pt-4">
      <h3 className="text-sm font-semibold mb-2">Watch {OWNER_PLAYER} play it</h3>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {replays.map((run) => (
          <li key={run.guid}>
            <a href={arcPrizeReplayUrl(run.guid)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {replayOutcome(run)} ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
