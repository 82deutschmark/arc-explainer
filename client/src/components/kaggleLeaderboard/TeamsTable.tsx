/**
 * Author: GPT-6 / Codex
 * Date: 2026-10-07
 * PURPOSE: "All teams" -- the whole board, searchable by team or member name, with a
 *          "moved today" filter, medal dots on rank, a heavier rule under each medal cut
 *          line, today's rank change, Kaggle profile links on team and member names, and a star to add a team to the watch chart. The featured team
 *          is highlighted and pinned to the top of an unfiltered view. Paged so four
 *          thousand rows do not render at once.
 * SRP/DRY check: Pass - reads BoardModel; uses shadcn Table, Input, Checkbox, Button.
 *          The starred list belongs to useWatchlist and is passed in.
 */

import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { MEDAL_COLOR, fmt, type BoardModel } from './boardData';
import { MemberLinks, TeamName } from './TeamName';

const PAGE = 100;

interface Props {
  model: BoardModel;
  watched: string[];
  onToggleWatch: (id: string) => void;
}

export function TeamsTable({ model, watched, onToggleWatch }: Props) {
  const [query, setQuery] = useState('');
  const [moversOnly, setMoversOnly] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const { latest, history } = model;
  const cutColor = useMemo(() => {
    const m = latest.medalRanks;
    return new Map([[m.gold, MEDAL_COLOR.gold], [m.silver, MEDAL_COLOR.silver], [m.bronze, MEDAL_COLOR.bronze]]);
  }, [latest]);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      latest.rows.filter(
        (r) =>
          (!q || r[2].toLowerCase().includes(q) || r[6].toLowerCase().includes(q)) &&
          (!moversOnly || (r[7] != null && r[7] !== r[0])),
      ),
    [latest, q, moversOnly],
  );
  const page = rows.slice(0, shown);
  // Keep pinned teams first without duplicating their ranked rows.
  if (!q && !moversOnly) {
    for (const row of [...model.pinnedRows].reverse()) {
      const index = page.indexOf(row);
      if (index >= 0) page.splice(index, 1);
      page.unshift(row);
    }
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          placeholder="Search team or member…"
          aria-label="Search teams"
          className="h-8 max-w-sm flex-1"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={moversOnly} onCheckedChange={(v) => { setMoversOnly(v === true); setShown(PAGE); }} />
          Moved today
        </label>
        <span className="text-xs text-muted-foreground">{rows.length.toLocaleString()} teams</span>
      </div>
      <Table className="text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="text-right">Rank</TableHead>
            <TableHead className="text-right">Today</TableHead>
            <TableHead>Team</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Subs</TableHead>
            <TableHead className="hidden md:table-cell">Last submission</TableHead>
            <TableHead className="hidden lg:table-cell">Members</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.map((r) => {
            const medal = model.medalOf(r[0]);
            const delta = r[7] != null ? r[7] - r[0] : 0;
            const isOurs = model.competition.pinnedTeamIds.includes(r[1]);
            const tracked = !!history.trails[r[1]];
            const starred = watched.includes(r[1]);
            const edge = cutColor.get(r[0]);
            return (
              <TableRow
                key={r[1]}
                className={isOurs ? 'bg-primary/10 font-semibold hover:bg-primary/15' : undefined}
                style={edge ? { borderBottom: `2px solid ${edge}` } : undefined}
              >
                <TableCell className="py-1.5 pr-0">
                  <button
                    type="button"
                    disabled={!tracked || isOurs}
                    onClick={() => onToggleWatch(r[1])}
                    title={isOurs ? 'Pinned team' : tracked ? (starred ? 'Stop watching' : 'Watch this team') : 'Only the top 300 and the pinned team are tracked over time'}
                    aria-label={isOurs ? `Pinned team: ${r[2]}` : starred ? `Stop watching ${r[2]}` : `Watch ${r[2]}`}
                    className="disabled:opacity-25"
                  >
                    <Star className="h-4 w-4" style={starred ? { fill: MEDAL_COLOR.gold, color: MEDAL_COLOR.gold } : { color: 'var(--muted-foreground)' }} />
                  </button>
                </TableCell>
                <TableCell className="py-1.5 text-right font-mono tabular-nums">
                  {medal && <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: MEDAL_COLOR[medal] }} />}
                  {r[0]}
                </TableCell>
                <TableCell className={`py-1.5 text-right font-mono text-xs tabular-nums ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {delta ? `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}` : ''}
                </TableCell>
                <TableCell className="max-w-[280px] truncate py-1.5"><TeamName row={r} /></TableCell>
                <TableCell className="py-1.5 text-right font-mono tabular-nums">{fmt(r[4])}</TableCell>
                <TableCell className="py-1.5 text-right font-mono tabular-nums">{r[5]}</TableCell>
                <TableCell className="hidden whitespace-nowrap py-1.5 text-muted-foreground md:table-cell">{r[3].slice(0, 16).replace('T', ' ')}</TableCell>
                <TableCell className="hidden max-w-[240px] truncate py-1.5 text-muted-foreground lg:table-cell" >
                  <MemberLinks row={r} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length > shown && (
        <div className="mt-3 text-center">
          <Button variant="outline" size="sm" onClick={() => setShown((n) => n + 200)}>
            Show more ({(rows.length - shown).toLocaleString()} left)
          </Button>
        </div>
      )}
    </>
  );
}
