/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: Worm Arena Matches page - showcases curated "Greatest Hits" matches
 *          prominently, with advanced search filters in a collapsible section
 *          for users who want to explore specific matchups.
 * SRP/DRY check: Pass - page composition only.
 */

import React from 'react';
import { useLocation } from 'wouter';

import WormArenaHeader from '@/components/WormArenaHeader';
import WormArenaGreatestHits from '@/components/WormArenaGreatestHits';
import useWormArenaStats from '@/hooks/useWormArenaStats';
import { apiRequest } from '@/lib/queryClient';

import type {
  SnakeBenchMatchSearchResponse,
  SnakeBenchMatchSearchResultLabel,
  SnakeBenchMatchSearchSortBy,
  SnakeBenchMatchSearchSortDir,
  SnakeBenchMatchSearchRow,
} from '@shared/types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type MatchFilters = {
  model: string;
  opponent: string;
  result: SnakeBenchMatchSearchResultLabel | 'any';
  minRounds: string;
  from: string;
  to: string;
  sortBy: SnakeBenchMatchSearchSortBy;
  sortDir: SnakeBenchMatchSearchSortDir;
  limit: number;
};

const LONG_MATCH_PRESETS: Array<{ label: string; minRounds: string }> = [
  { label: '30+ rounds', minRounds: '30' },
  { label: '50+ rounds', minRounds: '50' },
  { label: '75+ rounds', minRounds: '75' },
  { label: '100+ rounds', minRounds: '100' },
];

function parseQueryParam(location: string, key: string): string | null {
  try {
    const browserQuery =
      typeof window !== 'undefined' && window.location && typeof window.location.search === 'string'
        ? window.location.search
        : '';
    const queryFromLocation = location.split('?')[1] ?? '';
    const rawQuery = (browserQuery.startsWith('?') ? browserQuery.slice(1) : browserQuery) || queryFromLocation;
    if (!rawQuery) return null;
    const params = new URLSearchParams(rawQuery);
    const raw = params.get(key);
    return raw && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return null;
  }
}

function formatResult(result: SnakeBenchMatchSearchResultLabel) {
  if (result === 'won') return 'won';
  if (result === 'lost') return 'lost';
  return 'tied';
}

export default function WormArenaMatches() {
  const [location] = useLocation();

  const { leaderboard } = useWormArenaStats();
  const defaultModelFromQuery = parseQueryParam(location, 'model');

  const initialDraft = React.useMemo<MatchFilters>(
    () => ({
      model: defaultModelFromQuery ?? '',
      opponent: '',
      result: 'any',
      minRounds: '50',
      from: '',
      to: '',
      sortBy: 'rounds',
      sortDir: 'desc',
      limit: 50,
    }),
    [defaultModelFromQuery],
  );

  const draftRef = React.useRef<MatchFilters>(initialDraft);
  const [draftFilters, setDraftFilters] = React.useState<MatchFilters>(initialDraft);

  const [appliedFilters, setAppliedFilters] = React.useState<MatchFilters | null>(null);
  const [offset, setOffset] = React.useState<number>(0);
  const [rows, setRows] = React.useState<SnakeBenchMatchSearchRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const latestRequestId = React.useRef<number>(0);

  const effectiveLimit = appliedFilters?.limit ?? draftFilters.limit;

  const availableModels = React.useMemo(() => {
    const models = leaderboard.map((entry) => entry.modelSlug).filter(Boolean);
    return Array.from(new Set(models));
  }, [leaderboard]);

  const updateDraft = React.useCallback((patch: Partial<MatchFilters>) => {
    setDraftFilters((prev) => {
      const next = { ...prev, ...patch };
      draftRef.current = next;
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (draftFilters.model || availableModels.length === 0) return;
    updateDraft({ model: availableModels[0] });
  }, [availableModels, draftFilters.model, updateDraft]);

  React.useEffect(() => {
    if (appliedFilters || !draftFilters.model.trim()) return;
    setAppliedFilters({ ...draftRef.current, model: draftRef.current.model.trim() });
  }, [appliedFilters, draftFilters.model]);

  React.useEffect(() => {
    if (!appliedFilters) return;
    const trimmedModel = appliedFilters.model.trim();
    if (!trimmedModel) return;

    const params = new URLSearchParams();
    params.set('model', trimmedModel);
    if (appliedFilters.opponent.trim()) params.set('opponent', appliedFilters.opponent.trim());
    if (appliedFilters.result !== 'any') params.set('result', appliedFilters.result);

    const minRoundsNum = Number(appliedFilters.minRounds);
    if (appliedFilters.minRounds.trim().length > 0 && Number.isFinite(minRoundsNum)) {
      params.set('minRounds', String(Math.max(0, Math.floor(minRoundsNum))));
    }

    if (appliedFilters.from.trim()) params.set('from', appliedFilters.from.trim());
    if (appliedFilters.to.trim()) params.set('to', appliedFilters.to.trim());

    params.set('sortBy', appliedFilters.sortBy);
    params.set('sortDir', appliedFilters.sortDir);
    params.set('limit', String(appliedFilters.limit));
    params.set('offset', String(offset));

    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiRequest('GET', `/api/snakebench/matches?${params.toString()}`);
        const json = (await res.json()) as SnakeBenchMatchSearchResponse;
        if (latestRequestId.current !== requestId) return;
        if (!json.success) {
          throw new Error(json.error || 'Failed to load matches');
        }
        setRows(json.rows ?? []);
        setTotal(json.total ?? 0);
      } catch (e: any) {
        if (latestRequestId.current !== requestId) return;
        setError(e?.message || 'Failed to load matches');
        setRows([]);
        setTotal(0);
      } finally {
        if (latestRequestId.current === requestId) {
          setIsLoading(false);
        }
      }
    };

    void load();
  }, [appliedFilters, offset]);

  const canPrev = offset > 0;
  const canNext = offset + effectiveLimit < total;

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - effectiveLimit));
  };

  const handleNext = () => {
    setOffset((prev) => prev + effectiveLimit);
  };

  const handleApply = () => {
    const trimmedModel = draftRef.current.model.trim();
    if (!trimmedModel) return;
    setOffset(0);
    setAppliedFilters({ ...draftRef.current, model: trimmedModel });
  };

  const rangeLabel = React.useMemo(() => {
    if (total <= 0) return '0 results';
    const start = Math.min(total, offset + 1);
    const end = Math.min(total, offset + rows.length);
    return `${start}-${end} of ${total}`;
  }, [offset, rows.length, total]);

  const activePreset = draftFilters.minRounds.trim();

  return (
    <div className="worm-page">
      <WormArenaHeader
        compact
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Matches', href: '/worm-arena/matches', active: true },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
          { label: 'Skill Analysis', href: '/worm-arena/skill-analysis' },
        ]}
        showMatchupLabel={false}
        subtitle="Greatest Hits"
      />

      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Greatest Hits - prominently featured at top */}
        <WormArenaGreatestHits />

        {/* Advanced Search - collapsible for power users */}
        <Card className="worm-card">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="search" className="border-b-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-worm-ink">Advanced Search</span>
                  <span className="text-sm worm-muted">Find specific matchups by model, opponent, rounds, cost</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Model (required)</div>
                      <Select value={draftFilters.model} onValueChange={(value) => updateDraft({ model: value })}>
                        <SelectTrigger className="worm-input">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.map((m) => (
                            <SelectItem key={m} value={m}>
                              {m}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Opponent contains</div>
                      <Input
                        className="worm-input"
                        value={draftFilters.opponent}
                        onChange={(e) => updateDraft({ opponent: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Result</div>
                      <Select value={draftFilters.result} onValueChange={(value) => updateDraft({ result: value as any })}>
                        <SelectTrigger className="worm-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">any</SelectItem>
                          <SelectItem value="won">won</SelectItem>
                          <SelectItem value="lost">lost</SelectItem>
                          <SelectItem value="tied">tied</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Min rounds</div>
                      <Input
                        className="worm-input"
                        value={draftFilters.minRounds}
                        onChange={(e) => updateDraft({ minRounds: e.target.value })}
                        inputMode="numeric"
                        placeholder="e.g. 50"
                      />
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {LONG_MATCH_PRESETS.map((preset) => {
                          const active = preset.minRounds === activePreset;
                          return (
                            <Button
                              key={preset.minRounds}
                              type="button"
                              size="sm"
                              variant={active ? 'default' : 'outline'}
                              className="text-xs px-2 py-1 h-auto"
                              onClick={() => updateDraft({ minRounds: preset.minRounds })}
                            >
                              {preset.label}
                            </Button>
                          );
                        })}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs px-2 py-1 h-auto"
                          onClick={() => updateDraft({ minRounds: '' })}
                          disabled={!draftFilters.minRounds.trim()}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">From (ISO or ms)</div>
                      <Input
                        className="worm-input"
                        value={draftFilters.from}
                        onChange={(e) => updateDraft({ from: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">To (ISO or ms)</div>
                      <Input
                        className="worm-input"
                        value={draftFilters.to}
                        onChange={(e) => updateDraft({ to: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Sort</div>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={draftFilters.sortBy} onValueChange={(value) => updateDraft({ sortBy: value as any })}>
                          <SelectTrigger className="worm-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="startedAt">startedAt</SelectItem>
                            <SelectItem value="rounds">rounds</SelectItem>
                            <SelectItem value="totalCost">totalCost</SelectItem>
                            <SelectItem value="maxFinalScore">maxFinalScore</SelectItem>
                            <SelectItem value="scoreDelta">scoreDelta</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={draftFilters.sortDir} onValueChange={(value) => updateDraft({ sortDir: value as any })}>
                          <SelectTrigger className="worm-input">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="desc">desc</SelectItem>
                            <SelectItem value="asc">asc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground">Page size</div>
                      <Select
                        value={String(draftFilters.limit)}
                        onValueChange={(value) => updateDraft({ limit: Number(value) })}
                      >
                        <SelectTrigger className="worm-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleApply} disabled={!draftFilters.model || isLoading}>
                      Search
                    </Button>
                    <div className="text-sm text-muted-foreground">{isLoading ? 'Loading...' : rangeLabel}</div>
                    {error && <div className="text-sm text-red-600">{error}</div>}
                  </div>

                  {/* Search results table */}
                  {appliedFilters && (
                    <div className="mt-4 pt-4 border-t worm-border">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="text-sm font-semibold text-worm-ink">Search Results</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs worm-muted">{rangeLabel}</span>
                          <Button variant="outline" size="sm" onClick={handlePrev} disabled={!canPrev || isLoading}>
                            Prev
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleNext} disabled={!canNext || isLoading}>
                            Next
                          </Button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="whitespace-nowrap text-xs">Date</TableHead>
                              <TableHead className="text-xs">Opponent</TableHead>
                              <TableHead className="text-xs">Result</TableHead>
                              <TableHead className="text-right text-xs">Score</TableHead>
                              <TableHead className="text-right text-xs">Rounds</TableHead>
                              <TableHead className="text-right text-xs">Cost</TableHead>
                              <TableHead className="text-xs">Replay</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((r) => {
                              const replayHref = `/worm-arena?matchId=${encodeURIComponent(r.gameId)}`;
                              const scoreLabel = `${r.myScore}-${r.opponentScore}`;
                              return (
                                <TableRow key={r.gameId}>
                                  <TableCell className="whitespace-nowrap text-xs">
                                    {r.startedAt ? new Date(r.startedAt).toLocaleDateString() : ''}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs max-w-[200px] truncate" title={r.opponent}>
                                    {r.opponent}
                                  </TableCell>
                                  <TableCell className="text-xs">{formatResult(r.result)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{scoreLabel}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">{r.roundsPlayed}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">${r.totalCost.toFixed(2)}</TableCell>
                                  <TableCell>
                                    <a className="underline text-xs text-worm-ink hover:text-worm-green" href={replayHref}>
                                      View
                                    </a>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {rows.length === 0 && !isLoading && (
                              <TableRow>
                                <TableCell colSpan={7} className="text-sm text-muted-foreground">
                                  No matches found.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </main>
    </div>
  );
}
