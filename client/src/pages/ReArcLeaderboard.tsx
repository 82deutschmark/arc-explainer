/**
 * ReArcLeaderboard.tsx
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-30
 * PURPOSE: Leaderboard page for RE-ARC submissions.
 *          Shows ranked list of solver submissions with scores and verification counts.
 *          Supports sorting by score, latest, or most verified.
 * SRP/DRY check: Pass - Single responsibility: RE-ARC leaderboard display
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
import { Trophy, ArrowLeft, Medal, Clock, Loader2, Table as TableIcon, ScatterChart as ScatterIcon, HelpCircle } from 'lucide-react';
import { EfficiencyPlot } from '@/components/rearc/EfficiencyPlot';

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

function getRankIcon(rank: number) {
  if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-muted-foreground">{rank}</span>;
}

export default function ReArcLeaderboard() {
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

        <div className="flex items-center gap-3 mb-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          <h1 className="text-3xl font-bold">RE-ARC Leaderboard</h1>
        </div>
        <p className="text-muted-foreground">
          Community-verified ARC solver rankings
        </p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">View:</span>
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
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Sort by:</span>
              <Select value={sort} onValueChange={(v) => { setSort(v as SortOption); setPage(0); }}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      Highest Score
                    </div>
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

            {data && (
              <span className="text-sm text-muted-foreground ml-auto">
                {data.totalCount} {data.totalCount === 1 ? 'submission' : 'submissions'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard Content */}
      <Card>
        <CardHeader>
          <CardTitle>{view === 'table' ? 'Rankings' : 'Efficiency Analysis'}</CardTitle>
          <CardDescription>
            {view === 'table'
              ? 'Submit your own solution to join the leaderboard'
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
              Failed to load leaderboard. Please try again.
            </div>
          )}

          {data && data.submissions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No submissions yet. Be the first!</p>
              <Link href="/re-arc">
                <Button className="mt-4">Submit Your Solution</Button>
              </Link>
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
                        <TableHead className="text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.submissions.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center justify-center">
                              {getRankIcon(entry.rank)}
                            </div>
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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
