/*
Author: Claude Opus 5
Date: 2026-09-02
PURPOSE: The unlisted answer key for the 50 hand-authored ARC-AGI-3 tasks. One row per
         task: what it actually is, what each control does, what wins it, and the
         structural facts derived from its source -- the action list it advertises, whether
         its ACTION6 is a spatial click or a plain button, its board geometry, its level
         count and its triage verdict.

         WHY IT EXISTS. Auditing the synthetic set previously meant playing a task blind
         until you worked out what it was, or asking the person who wrote it. Neither
         scales past a handful, and the second one does not survive the author being
         asleep. Everything here is derived from the game sources by
         scripts/arc3/mechanic_digest.py, so it cannot drift the way a chat message does.

         UNLISTED, NOT PRIVATE. Nothing links here, it carries noindex, and robots.txt
         disallows both this route and its API. That is the whole of the protection: the
         route and the endpoint are public like everything else on this site, and anyone
         with the URL can read it. It is kept out of sight because the play surface exists
         to collect blind first contact and a findable answer key would poison the sample,
         not because the contents are sensitive.

         The counts at the top are the reason to look at it as a SET rather than a list:
         seven tasks take a real xy-click, two take ACTION6 as a plain button, and 26
         advertise ACTION6 while reading nothing from it -- which means a player is offered
         a click that the engine accepts and the game ignores. That last number is invisible
         from inside any single task.
SRP/DRY check: Pass -- presentation only. Extraction lives in the Python digest, prose in
         mechanics-notes.json, serving in server/routes/arc3Mirror.ts. Reuses shadcn Card,
         Badge and Input rather than restyling any of them.
*/

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Loader2, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { Arc3MechanicEntry } from '@shared/arc3Mechanics';

type ClickFilter = 'all' | 'xy-click' | 'button' | 'inert';

/** The one-line summary of the set, computed rather than written down so it cannot go
 *  stale against the data underneath it. */
function useTotals(games: Arc3MechanicEntry[]) {
  return useMemo(() => ({
    total: games.length,
    xy: games.filter((g) => g.action6 === 'xy-click').length,
    button: games.filter((g) => g.action6 === 'button').length,
    inert: games.filter((g) => g.action6Inert).length,
  }), [games]);
}

function ActionList({ entry }: { entry: Arc3MechanicEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {[1, 2, 3, 4, 5, 6, 7].map((n) => {
        const offered = entry.availableActions.includes(n);
        const used = entry.actionsReferenced.includes(n);
        // Offered but unused is the case worth seeing: the console will let the player
        // spend a move on it and the game will not look at it.
        const tone = !offered ? 'opacity-25'
          : used ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
          : 'bg-amber-50 text-amber-800 border-amber-300';
        return (
          <span key={n}
                title={!offered ? 'not offered' : used ? 'offered and used' : 'offered but never read'}
                className={`inline-flex h-5 w-5 items-center justify-center rounded border text-[10px] font-mono ${tone}`}>
            {n}
          </span>
        );
      })}
    </div>
  );
}

export default function Arc3MechanicGuide() {
  usePageMeta({
    title: 'ARC-AGI-3 mechanic guide (spoilers)',
    description: 'Unlisted reference: what each hand-authored ARC-AGI-3 task is and how it is controlled.',
    noindex: true,
  });

  const [q, setQ] = useState('');
  const [clickFilter, setClickFilter] = useState<ClickFilter>('all');

  const { data, isLoading, error } = useQuery<{ data: { games: Arc3MechanicEntry[] } }>({
    queryKey: ['/api/arc3-mirror/mechanics'],
    staleTime: 60 * 60 * 1000,
  });

  const games = data?.data?.games ?? [];
  const totals = useTotals(games);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return games.filter((g) => {
      if (clickFilter === 'xy-click' && g.action6 !== 'xy-click') return false;
      if (clickFilter === 'button' && g.action6 !== 'button') return false;
      if (clickFilter === 'inert' && !g.action6Inert) return false;
      if (!needle) return true;
      return [g.gameId, g.mechanic, g.controls, g.goal]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [games, q, clickFilter]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">ARC-AGI-3 mechanic guide</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          What each of the {totals.total} hand-authored tasks actually is. Everything except the
          prose is derived from the game sources by{' '}
          <code className="text-xs">scripts/arc3/mechanic_digest.py</code>, so it is re-derivable
          rather than remembered.
        </p>
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>Complete spoilers, and unlisted rather than private.</strong> Nothing links
            here and search engines are asked to skip it, but the page and its API are public
            like the rest of the site. Do not hand the URL to anyone you want a blind first
            play from.
          </span>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {([
          ['all', totals.total, 'tasks'],
          ['xy-click', totals.xy, 'take a real xy-click'],
          ['button', totals.button, 'ACTION6 as a plain button'],
          ['inert', totals.inert, 'offer ACTION6, read nothing'],
        ] as const).map(([key, n, label]) => (
          <button key={key} onClick={() => setClickFilter(key as ClickFilter)}
                  className={`text-left rounded-md border px-3 py-2 transition-colors ${
                    clickFilter === key ? 'border-foreground bg-muted' : 'hover:bg-muted/50'}`}>
            <div className="text-xl font-semibold tabular-nums">{n}</div>
            <div className="text-[11px] leading-tight text-muted-foreground">{label}</div>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8"
               placeholder="Search a task id, or a mechanic — sokoban, click, dark, timing…" />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the guide…
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600 py-8">The guide could not be loaded.</p>
      )}

      <div className="space-y-3">
        {shown.map((g) => (
          <Card key={g.gameId} className="overflow-hidden">
            <CardContent className="p-4 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/arc3/play/${g.gameId}`}
                      className="font-mono text-sm font-medium hover:underline inline-flex items-center gap-1">
                  {g.gameId} <ExternalLink className="w-3 h-3" />
                </Link>
                {g.action6 === 'xy-click' && (
                  <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">xy-click</Badge>
                )}
                {g.action6 === 'button' && (
                  <Badge variant="outline">ACTION6 = plain button</Badge>
                )}
                {g.action6Inert && (
                  <Badge variant="outline" className="text-amber-800 border-amber-300">
                    offers ACTION6, ignores it
                  </Badge>
                )}
                {g.triage?.status && g.triage.status !== 'queued' && (
                  <Badge variant="outline" className="text-muted-foreground">{g.triage.status}</Badge>
                )}
                <span className="ml-auto flex items-center gap-3">
                  <ActionList entry={g} />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {g.levels ?? '?'} levels
                  </span>
                </span>
              </div>

              <p className="text-[13.5px] leading-relaxed">{g.mechanic}</p>
              <div className="grid sm:grid-cols-2 gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <p><span className="font-medium text-foreground">Controls. </span>{g.controls}</p>
                <p><span className="font-medium text-foreground">Wins when. </span>{g.goal}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && shown.length === 0 && (
          <p className="text-sm text-muted-foreground py-8">Nothing matches that.</p>
        )}
      </div>
    </div>
  );
}
