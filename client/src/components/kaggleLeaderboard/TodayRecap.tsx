/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-08
 * PURPOSE: "Today so far" -- the board now against where it stood at the end of the
 *          previous UTC day: biggest point gains, biggest climbers, teams that moved into
 *          the gold zone, and new teams in the top 500. Uses the start-of-day rank and score
 *          the snapshot script attaches to every row. Lists adapt to their card width
 *          and place full team names above movement figures to prevent clipping.
 * SRP/DRY check: Pass - reads BoardModel only; one List used for all four columns.
 */

import { fmt, type BoardModel } from './boardData';
import type { KaggleBoardRow } from '@shared/types';
import { TeamName } from './TeamName';

function List({ title, rows, value, ourId }: { title: string; rows: KaggleBoardRow[]; value: (r: KaggleBoardRow) => string; ourId: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nobody yet.</div>
      ) : (
        <ol className="text-sm">
          {rows.map((r) => (
            <li key={r[1]} className={`flex flex-col gap-1 border-b py-2 ${r[1] === ourId ? 'font-semibold text-primary' : ''}`}>
              <TeamName row={r} className="min-w-0 leading-snug [overflow-wrap:anywhere]" />
              <span className="font-mono text-xs tabular-nums">{value(r)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function TodayRecap({ model }: { model: BoardModel }) {
  const { rows, medalRanks, ourTeamId } = model.latest;
  const gold = medalRanks.gold;
  const known = rows.filter((r) => r[7] != null && r[8] != null);
  const gain = (r: KaggleBoardRow) => r[4] - (r[8] as number);
  const climb = (r: KaggleBoardRow) => (r[7] as number) - r[0];

  return (
    <div className="grid gap-x-6 gap-y-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
      <List
        title="Biggest point gains"
        ourId={ourTeamId}
        rows={known.filter((r) => gain(r) > 0.005).sort((a, b) => gain(b) - gain(a)).slice(0, 6)}
        value={(r) => `+${fmt(gain(r))} → ${fmt(r[4])}`}
      />
      <List
        title="Biggest climbers"
        ourId={ourTeamId}
        rows={known.filter((r) => climb(r) > 0).sort((a, b) => climb(b) - climb(a)).slice(0, 6)}
        value={(r) => `▲ ${climb(r)} → #${r[0]}`}
      />
      <List
        title="Into the gold zone"
        ourId={ourTeamId}
        rows={known.filter((r) => (r[7] as number) > gold && r[0] <= gold)}
        value={(r) => `#${r[7]} → #${r[0]}`}
      />
      <List
        title="Top 500, prior rank unknown"
        ourId={ourTeamId}
        rows={rows.filter((r) => r[7] == null && r[0] <= 500).slice(0, 6)}
        value={(r) => `#${r[0]} · ${fmt(r[4])}`}
      />
    </div>
  );
}
