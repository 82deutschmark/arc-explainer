import React from 'react';
import { useLocation } from 'wouter';

import WormArenaHeader from '@/components/WormArenaHeader';
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

function parseQueryParam(location: string, key: string): string | null {
  try {
    const query = location.split('?')[1] ?? '';
    if (!query) return null;
    const params = new URLSearchParams(query);
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

  const [model, setModel] = React.useState<string>(defaultModelFromQuery ?? '');
  const [opponent, setOpponent] = React.useState<string>('');
  const [result, setResult] = React.useState<SnakeBenchMatchSearchResultLabel | 'any'>('any');
  const [minRounds, setMinRounds] = React.useState<string>('');
  const [from, setFrom] = React.useState<string>('');
  const [to, setTo] = React.useState<string>('');

  const [sortBy, setSortBy] = React.useState<SnakeBenchMatchSearchSortBy>('startedAt');
  const [sortDir, setSortDir] = React.useState<SnakeBenchMatchSearchSortDir>('desc');

  const [limit, setLimit] = React.useState<number>(50);
  const [offset, setOffset] = React.useState<number>(0);

  const [rows, setRows] = React.useState<SnakeBenchMatchSearchRow[]>([]);
  const [total, setTotal] = React.useState<number>(0);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const availableModels = React.useMemo(() => {
    const models = leaderboard.map((e) => e.modelSlug).filter(Boolean);
    return Array.from(new Set(models));
  }, [leaderboard]);

  React.useEffect(() => {
    if (!model && availableModels.length > 0) {
      setModel(availableModels[0]);
    }
  }, [availableModels, model]);

  const fetchMatches = React.useCallback(async () => {
    const trimmedModel = model.trim();
    if (!trimmedModel) return;

    const params = new URLSearchParams();
    params.set('model', trimmedModel);
    if (opponent.trim()) params.set('opponent', opponent.trim());
    if (result !== 'any') params.set('result', result);

    const minRoundsNum = Number(minRounds);
    if (minRounds.trim().length > 0 && Number.isFinite(minRoundsNum)) {
      params.set('minRounds', String(Math.max(0, Math.floor(minRoundsNum))));
    }

    if (from.trim()) params.set('from', from.trim());
    if (to.trim()) params.set('to', to.trim());

    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    setIsLoading(true);
    setError(null);

    try {
      const res = await apiRequest('GET', `/api/snakebench/matches?${params.toString()}`);
      const json = (await res.json()) as SnakeBenchMatchSearchResponse;
      if (!json.success) {
        throw new Error(json.error || 'Failed to load matches');
      }
      setRows(json.rows ?? []);
      setTotal(json.total ?? 0);
    } catch (e: any) {
      setError(e?.message || 'Failed to load matches');
      setRows([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    from,
    limit,
    minRounds,
    model,
    offset,
    opponent,
    result,
    sortBy,
    sortDir,
    to,
  ]);

  React.useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  const handlePrev = () => {
    setOffset((prev) => Math.max(0, prev - limit));
  };

  const handleNext = () => {
    setOffset((prev) => prev + limit);
  };

  const handleApply = () => {
    setOffset(0);
    void fetchMatches();
  };

  const rangeLabel = React.useMemo(() => {
    if (total <= 0) return '0 results';
    const start = Math.min(total, offset + 1);
    const end = Math.min(total, offset + rows.length);
    return `${start}-${end} of ${total}`;
  }, [offset, rows.length, total]);

  return (
    <div className="worm-page">
      <WormArenaHeader
        totalGames={total}
        links={[
          { label: 'Replay', href: '/worm-arena' },
          { label: 'Live', href: '/worm-arena/live' },
          { label: 'Matches', href: '/worm-arena/matches', active: true },
          { label: 'Stats & Placement', href: '/worm-arena/stats' },
        ]}
        showMatchupLabel={false}
        subtitle="Browse matches by model"
      />

      <main className="p-6 max-w-7xl mx-auto space-y-6">
        <Card className="worm-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-worm-ink">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Model (required)</div>
                <Select value={model} onValueChange={setModel}>
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
                <Input className="worm-input" value={opponent} onChange={(e) => setOpponent(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Result</div>
                <Select value={result} onValueChange={(v) => setResult(v as any)}>
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
                  value={minRounds}
                  onChange={(e) => setMinRounds(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">From (ISO or ms)</div>
                <Input className="worm-input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">To (ISO or ms)</div>
                <Input className="worm-input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Sort</div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
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
                  <Select value={sortDir} onValueChange={(v) => setSortDir(v as any)}>
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
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
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
              <Button onClick={handleApply} disabled={!model || isLoading}>
                Apply
              </Button>
              <div className="text-sm text-muted-foreground">{isLoading ? 'Loading...' : rangeLabel}</div>
              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="worm-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold text-worm-ink">Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm text-muted-foreground">{rangeLabel}</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handlePrev} disabled={!canPrev || isLoading}>
                  Prev
                </Button>
                <Button variant="outline" onClick={handleNext} disabled={!canNext || isLoading}>
                  Next
                </Button>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">startedAt</TableHead>
                  <TableHead>opponent</TableHead>
                  <TableHead>result</TableHead>
                  <TableHead className="text-right">score</TableHead>
                  <TableHead className="text-right">rounds</TableHead>
                  <TableHead className="text-right">cost</TableHead>
                  <TableHead className="text-right">delta</TableHead>
                  <TableHead>open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const replayHref = `/worm-arena?matchId=${encodeURIComponent(r.gameId)}`;
                  const scoreLabel = `${r.myScore}-${r.opponentScore}`;
                  return (
                    <TableRow key={r.gameId}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {r.startedAt ? new Date(r.startedAt).toLocaleString() : ''}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.opponent}</TableCell>
                      <TableCell className="text-xs">{formatResult(r.result)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{scoreLabel}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.roundsPlayed}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.totalCost.toFixed(4)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.scoreDelta}</TableCell>
                      <TableCell>
                        <a className="underline text-xs" href={replayHref}>
                          Replay
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-sm text-muted-foreground">
                      No matches found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
