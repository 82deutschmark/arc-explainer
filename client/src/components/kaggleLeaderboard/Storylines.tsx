/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: Renders the leaderboard drama computed in storyData.ts: a strip of headline facts
 *          (the leader's reign and margin, how far the gold line moved this week, how many
 *          teams joined, what standing still costs) and a grid of story cards (rocketing up,
 *          sinking, grinding up, biggest jumps, new faces, on the bubble), each a short ranked
 *          list with Kaggle profile links. Our team is highlighted wherever it appears.
 *
 *          Styled with neutral theme tokens so it sits on both the leaderboard page and the
 *          arc3 landing page (which sets its own accent through --primary).
 * SRP/DRY check: Pass - display only; every figure comes from storyData.ts.
 */

import { useMemo } from 'react';
import { fmt, type BoardModel } from './boardData';
import { computeHeadlines, computeStories } from './storyData';
import { TeamName } from './TeamName';

function Fact({ value, label }: { value: React.ReactNode; label: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l-2 border-border pl-3">
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="text-xs leading-snug text-muted-foreground">{label}</div>
    </div>
  );
}

export function HeadlineFacts({ model }: { model: BoardModel }) {
  const h = useMemo(() => computeHeadlines(model), [model]);
  const days = h.leader.since ? Math.max(0, Math.floor((Date.parse(model.latest.fetched) - Date.parse(h.leader.since)) / 864e5)) : null;
  const goldMove = h.goldWeekAgo != null ? h.goldNow - h.goldWeekAgo : null;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
      <Fact
        value={<TeamName row={h.leader.row} className="block truncate" />}
        label={
          <>
            leads by {fmt(h.leader.leadBy)} points
            {days != null && <>, #1 for {days === 0 ? 'under a day' : `${days} day${days === 1 ? '' : 's'}`}</>}
          </>
        }
      />
      {goldMove != null && (
        <Fact value={`${goldMove >= 0 ? '+' : ''}${fmt(goldMove)}`} label={`gold line this week, now ${fmt(h.goldNow)}`} />
      )}
      {h.newTeamsWeek != null && <Fact value={`+${h.newTeamsWeek.toLocaleString()}`} label="new teams this week" />}
      {h.standStill != null && (
        <Fact value={`▼ ${h.standStill}`} label="places lost in a week by a typical top-300 team whose score did not move" />
      )}
    </div>
  );
}

export function StoryGrid({ model }: { model: BoardModel }) {
  const stories = useMemo(() => computeStories(model), [model]);
  const ourId = model.latest.ourTeamId;
  return (
    <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
      {stories.map((s) => (
        <div key={s.key} className="min-w-0">
          <h3 className="text-sm font-semibold">{s.title}</h3>
          <p className="mb-2 text-xs leading-snug text-muted-foreground">{s.blurb}</p>
          <ol className="text-sm">
            {s.items.map((it, i) => (
              <li
                key={it.row[1]}
                className={`flex items-baseline gap-2 border-t border-border py-1.5 ${it.row[1] === ourId ? 'font-semibold text-primary' : ''}`}
              >
                <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <TeamName row={it.row} className="block truncate" />
                  {it.detail && <span className="block truncate text-xs font-normal text-muted-foreground">{it.detail}</span>}
                </span>
                <span className="shrink-0 font-mono text-xs">{it.value}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
