/**
 * Author: GPT-6.1 Sol / Codex
 * Date: 2026-10-07
 * PURPOSE: Compact competitor cards for the live leaders, familiar contenders and pinned
 *          team. Reads current names and facts from BoardModel, reuses Kaggle profile links
 *          and the visitor watchlist, and draws only observed score history without filling
 *          gaps to the present for teams no longer covered by the top-300 collector.
 *          A discreet text link opens the separate competition-scoped news notebook.
 * SRP/DRY check: Pass — presentation only; no duplicate data fetching or stored standings.
 */

import { Star } from 'lucide-react';
import { Link } from 'wouter';
import { KAGGLE_COMPETITIONS } from '@shared/kaggleCompetitions';
import { competitorPath } from '@shared/news';
import { Card } from '@/components/ui/card';
import { fmt, MEDAL_COLOR, type BoardModel } from './boardData';
import { TeamName } from './TeamName';

const DAY = 864e5;

function ScoreTrail({ model, id }: { model: BoardModel; id: string }) {
  const end = Date.parse(model.latest.fetched);
  const start = end - 14 * DAY;
  const points = (model.history.trails[id]?.pts ?? []).filter((p) => Date.parse(p[0]) >= start);
  const last = points.at(-1);
  if (points.length < 2 || !last) {
    return <p className="flex h-[68px] items-center text-xs text-muted-foreground">Limited score history in the past 14 days.</p>;
  }
  const min = Math.min(...points.map((p) => p[1]));
  const max = Math.max(...points.map((p) => p[1]));
  const x = (t: string) => 4 + ((Date.parse(t) - start) / (end - start)) * 272;
  const y = (v: number) => max === min ? 24 : 38 - ((v - min) / (max - min)) * 28;
  // Step only through actual observations; no line is extended to the current score.
  const path = points.map((p, i) => `${i ? `H${x(p[0])} V` : `M${x(p[0])} `}${y(p[1])}`).join(' ');
  const olderChange = end - Date.parse(last[0]) > DAY;
  const date = new Date(last[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return (
    <div className="h-[68px]">
      <svg viewBox="0 0 280 44" className="h-11 w-full" role="img" aria-label={`Observed scores over the past 14 days, ${fmt(min)} to ${fmt(max)} points${olderChange ? `; last recorded change ${date} UTC` : ''}`}>
        <line x1="4" x2="276" y1="40" y2="40" stroke="currentColor" opacity="0.15" />
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(last[0])} cy={y(last[1])} r="3" fill="currentColor" />
      </svg>
      <div className="flex justify-between gap-2 text-[10px] text-muted-foreground">
        <span>{olderChange ? `Last recorded change ${date} UTC` : '14-day score trail'}</span>
        <span>{fmt(min)}–{fmt(max)} pts</span>
      </div>
    </div>
  );
}

export function FeaturedTeams({ model, watched, onToggleWatch }: {
  model: BoardModel;
  watched: string[];
  onToggleWatch: (id: string) => void;
}) {
  const competitionKey = Object.entries(KAGGLE_COMPETITIONS).find(([, competition]) => competition.slug === model.competition.slug)?.[0];
  const ids = [...new Set([
    ...model.latest.rows.slice(0, 3).map((r) => r[1]),
    ...model.competition.featuredTeamIds,
    ...model.competition.pinnedTeamIds,
  ])];
  const rows = ids.map((id) => model.byId.get(id)).filter((r) => r != null).sort((a, b) => a[0] - b[0]);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const [rank, id, , submitted, score, submissions] = row;
        const medal = model.medalOf(rank);
        const pinned = model.competition.pinnedTeamIds.includes(id);
        const starred = watched.includes(id);
        const climb = row[7] == null ? null : row[7] - rank;
        const gain = row[8] == null ? null : score - row[8];
        const tracked = !!model.history.trails[id];
        return (
          <Card key={id} className="overflow-hidden rounded-lg border shadow-none" style={{ borderTop: `3px solid ${medal ? MEDAL_COLOR[medal] : 'var(--muted-foreground)'}` }}>
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>{rank <= 3 ? 'Board leader' : 'Featured contender'}{pinned ? ' · Pinned' : ''}</span>
              <span>{medal ? `${medal} zone` : 'Public board'}</span>
            </div>
            <div className="space-y-3 p-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="min-w-0 text-base font-semibold leading-snug"><TeamName row={row} /></h3>
                <button type="button" disabled={!tracked || pinned} onClick={() => onToggleWatch(id)} aria-label={`${pinned ? 'Pinned team:' : starred ? 'Stop watching' : 'Watch'} ${row[2]}`} title={pinned ? 'Pinned team' : tracked ? (starred ? 'Stop watching' : 'Add to watchlist') : 'No saved score history yet'} className="shrink-0 rounded p-1 hover:bg-muted disabled:opacity-25">
                  <Star className="h-4 w-4" style={{ color: starred ? MEDAL_COLOR.gold : 'var(--muted-foreground)', fill: starred ? MEDAL_COLOR.gold : 'none' }} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div><div className="text-[10px] uppercase text-muted-foreground">Rank</div><div className="font-mono text-2xl font-semibold tabular-nums">#{rank}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">{model.competition.scoreLabel}</div><div className="font-mono text-2xl font-semibold tabular-nums">{fmt(score)}</div></div>
                <div><div className="text-[10px] uppercase text-muted-foreground">Submissions</div><div className="font-mono text-2xl font-semibold tabular-nums">{submissions}</div></div>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-y py-2 text-xs">
                <span>{climb == null ? 'Rank change unavailable' : climb === 0 ? 'Rank unchanged today' : `${climb > 0 ? '↑' : '↓'} ${Math.abs(climb)} ${Math.abs(climb) === 1 ? 'place' : 'places'} today`}</span>
                <span className="font-mono tabular-nums">{gain == null ? 'Score change unavailable' : `${gain > 0 ? '+' : ''}${fmt(gain)} pts today`}</span>
              </div>
              <ScoreTrail model={model} id={id} />
              <p className="text-[10px] text-muted-foreground">Last submission: {submitted ? `${submitted.slice(0, 16).replace('T', ' ')} UTC` : 'unavailable'}</p>
              {competitionKey && <Link href={competitorPath(`${competitionKey}-${id}`)} className="text-[10px] text-muted-foreground underline underline-offset-2">Competitor notebook →</Link>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
