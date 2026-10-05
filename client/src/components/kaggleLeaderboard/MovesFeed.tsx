/**
 * Author: Claude Opus 5.5
 * Date: 2026-10-05
 * PURPOSE: "Recent moves" -- every score change the snapshot job recorded, newest first,
 *          with the rank change and a tag when a team crossed into a medal zone. Our own
 *          moves are highlighted. A "Top 50 only" switch and paging keep it scannable.
 * SRP/DRY check: Pass - reads BoardModel only; uses shadcn Badge, Button, Checkbox.
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { fmt, whenText, type BoardModel } from './boardData';
import type { KaggleBoardEvent } from '@shared/types';
import { TeamName } from './TeamName';

const FIRST_PAGE = 30;

function zoneTag(e: KaggleBoardEvent, cuts: BoardModel['latest']['medalRanks']): string | null {
  if (e.rankFrom == null) return null;
  for (const m of ['gold', 'silver', 'bronze'] as const) {
    if (e.rankFrom > cuts[m] && e.rankTo <= cuts[m]) return `into ${m} zone`;
  }
  return null;
}

export function MovesFeed({ model }: { model: BoardModel }) {
  const [topOnly, setTopOnly] = useState(false);
  const [shown, setShown] = useState(FIRST_PAGE);
  const ourId = model.latest.ourTeamId;
  const events = model.events.filter((e) => !topOnly || e.rankTo <= 50 || e.id === ourId).slice().reverse();

  return (
    <>
      <label className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={topOnly} onCheckedChange={(v) => { setTopOnly(v === true); setShown(FIRST_PAGE); }} />
        Top 50 only
      </label>
      {events.length === 0 && <p className="text-sm text-muted-foreground">No moves recorded yet.</p>}
      <div>
        {events.slice(0, shown).map((e, i) => {
          const tag = zoneTag(e, model.latest.medalRanks);
          const gain = e.from == null ? null : e.to - e.from;
          return (
            <div
              key={`${e.t}-${e.id}-${i}`}
              className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b px-1 py-1.5 text-sm ${e.id === ourId ? 'bg-primary/10' : ''}`}
            >
              <span className="min-w-[88px] text-xs text-muted-foreground">{whenText(e.t)}</span>
              <TeamName row={model.byId.get(e.id)} name={e.name} className="font-semibold" />
              <span className="font-mono text-xs tabular-nums">
                {e.from == null ? `new at ${fmt(e.to)}` : `${fmt(e.from)} → ${fmt(e.to)} (${gain! >= 0 ? '+' : ''}${fmt(gain!)})`}
              </span>
              <span className="font-mono text-xs tabular-nums">
                {e.rankFrom == null || e.rankFrom === e.rankTo ? `#${e.rankTo}` : `#${e.rankFrom} → #${e.rankTo}`}
              </span>
              {tag && <Badge variant="outline" className="text-[11px] font-normal">{tag}</Badge>}
            </div>
          );
        })}
      </div>
      {events.length > shown && (
        <div className="mt-3 text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 60)}>Show more</Button>
        </div>
      )}
    </>
  );
}
