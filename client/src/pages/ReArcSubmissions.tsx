/**
 * ReArcSubmissions.tsx
 *
 * Author: Cascade (OpenAI Assistant)
 * Date: 2026-01-14
 * PURPOSE: Displays RE-ARC evaluation submissions with ISO-relative dataset timestamps for provenance.
 *          Supports sorting by score/recency plus table vs efficiency visualization.
 * SRP/DRY check: Pass — reused leaderboard query; only enriched presentation logic.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ArrowLeft, Clock, Loader2, Table as TableIcon, ScatterChart as ScatterIcon, HelpCircle } from 'lucide-react';
import { EfficiencyPlot } from '@/components/rearc/EfficiencyPlot';
import { formatTimestampWithRelative } from '@/utils/timestampDisplay';

interface LeaderboardEntry {
  rank: number;
  id: number;
  solverName: string;
  score: number;
  solvedPairs: number;
  totalPairs: number;
  tasksSolved: number;
  evaluatedAt: string;
  verificationCount: number;
  datasetSeedId: string;
  generatedAt: string;
  elapsedMs: number;
}

interface LeaderboardResponse {
  submissions: LeaderboardEntry[];
  totalCount: number;
}

type SortOption = 'score' | 'latest' | 'verified';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderGeneratedAt(timestamp: string): string {
  return formatTimestampWithRelative(timestamp).combined;
}

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}


export default function ReArcSubmissions() {
  const [sort, setSort] = useState<SortOption>('score');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'table' | 'plot'>('plot');
  const pageSize = 25;

  const { data, isLoading, error } = useQuery<LeaderboardResponse>({
    queryKey: ['rearc-leaderboard', sort, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/rearc/leaderboard?sort=${sort}&limit=${pageSize}&offset=${page * pageSize}`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch leaderboard');
      }
      return res.json();
    },
  });

  const totalPages = data ? Math.ceil(data.totalCount / pageSize) : 0;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/re-arc">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to RE-ARC Bench
          </Button>
        </Link>

        <h1 className="text-3xl font-bold">RE-ARC Submissions</h1>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* View Toggle */}
            <div className="flex gap-1 border border-border rounded-md p-1">
                <Button
                  variant={view === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('table')}
                  className="gap-2"
                >
                  <TableIcon className="h-4 w-4" />
                  Table
                </Button>
                <Button
                  variant={view === 'plot' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('plot')}
                  className="gap-2"
                >
                  <ScatterIcon className="h-4 w-4" />
                  Efficiency
                </Button>
              </div>

            {/* Sort Controls - only show in table view */}
            {view === 'table' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Sort by:</span>
                <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(0); }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">
                      Highest Score
                    </SelectItem>
                    <SelectItem value="latest">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Most Recent
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {data && (
              <span className="text-sm text-muted-foreground ml-auto">
                {data.totalCount} {data.totalCount === 1 ? 'submission' : 'submissions'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submissions Content */}
      <Card>
        <CardHeader>
          <CardTitle>{view === 'table' ? 'Submissions' : 'Efficiency Analysis'}</CardTitle>
          <CardDescription>
            {view === 'table'
              ? 'Recorded evaluation results'
              : 'Score vs elapsed time visualization'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-destructive">
              Failed to load submissions. Please try again.
            </div>
          )}

          {data && data.submissions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No evaluations recorded yet.</p>
            </div>
          )}

          {data && data.submissions.length > 0 && (
            <>
              {view === 'table' ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Solver</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                        <TableHead className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 cursor-help">
                                  Time
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                <p>Elapsed time between dataset generation and evaluation. Provides an upper bound on solving time.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        <TableHead className="text-right">Evaluated</TableHead>
                        <TableHead className="text-right">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 cursor-help">
                                  Dataset Generated
                                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                <p>UTC timestamp derived from the XOR-encoded task IDs. Screenshots of this column prove which dataset a solver used.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.submissions.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-center">
                            {entry.rank}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{entry.solverName}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-semibold">
                              {(entry.score * 100).toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground font-mono text-sm">
                            {formatElapsedTime(entry.elapsedMs)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {formatDate(entry.evaluatedAt)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground font-mono text-xs whitespace-pre-wrap">
                            {renderGeneratedAt(entry.generatedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground px-4">
                        Page {page + 1} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <EfficiencyPlot
                  data={data.submissions.map(entry => ({
                    solverName: entry.solverName,
                    score: entry.score,
                    elapsedMs: entry.elapsedMs,
                    tasksSolved: entry.tasksSolved,
                    solvedPairs: entry.solvedPairs,
                    totalPairs: entry.totalPairs,
                  }))}
                />
              )}

              {/* Elapsed Time Description */}
              <div className="mt-6 pt-4 border-t border-border space-y-1 text-xs text-muted-foreground">
                <p>
                  <span className="font-semibold">Elapsed time:</span> Time between dataset generation and evaluation. Provides an upper bound on solving time.
                </p>
                <p>
                  <span className="font-semibold">Dataset generated:</span> UTC timestamp recovered from task IDs. Copy this when sharing screenshots so others can re-run the same dataset.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Disclaimer Section */}
      <Card className="mt-6 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardHeader>
          <CardTitle className="text-lg">About These Submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-foreground mb-2">Limitations</p>
            <p className="text-muted-foreground mb-2">
              Submissions are <span className="font-semibold">self-reported and unverified</span>. Direct comparison between submissions is not reliable, not fair, and not legitimate.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-2">Why</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li><span className="font-semibold">No verification:</span> Results are self-reported. Solvers could make honest mistakes or misrepresent results.</li>
              <li><span className="font-semibold">Unfair comparison:</span> Solvers have different computational resources, optimization budgets, and techniques.</li>
              <li><span className="font-semibold">No legitimacy guarantees:</span> There's no way to verify that results are honest or that solving methods are legitimate.</li>
            </ul>
          </div>

          <p className="text-muted-foreground">
            <span className="font-semibold">Don't use this data to draw conclusions about solver quality.</span> Verify claims independently.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
