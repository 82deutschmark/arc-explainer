/**
 * Author: Cascade (OpenAI GPT-4.1)
 * Date: 2025-10-26
 * PURPOSE: FeedbackExplorer page centralizes researcher workflows for inspecting
 * user feedback quality signals, combining summary statistics, filters, and
 * drilldowns into individual feedback items.
 * SRP/DRY check: Pass — Reuses existing feedback hooks, summary, and viewer components.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { useFeedback, useFeedbackStats } from '@/hooks/useFeedback';
import { FeedbackSummary } from '@/components/feedback/FeedbackSummary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { DetailedFeedback, FeedbackFilters } from '@shared/types';
import {
  Filter,
  RefreshCw,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';

const LIMIT_OPTIONS = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const PAGE_SIZE = 50;
const ALL_TYPES_VALUE = 'ALL_TYPES';
type FeedbackTypeOption = 'helpful' | 'not_helpful' | 'solution_explanation';
type SelectFeedbackType = typeof ALL_TYPES_VALUE | FeedbackTypeOption;

const feedbackTypeMeta: Record<FeedbackTypeOption, {
  label: string;
  icon: React.ReactNode;
  badgeVariant: 'default' | 'destructive' | 'secondary';
}> = {
  helpful: {
    label: 'Helpful',
    icon: <ThumbsUp className="h-3 w-3" />,
    badgeVariant: 'default' as const,
  },
  not_helpful: {
    label: 'Not Helpful',
    icon: <ThumbsDown className="h-3 w-3" />,
    badgeVariant: 'destructive' as const,
  },
  solution_explanation: {
    label: 'Solution Explanation',
    icon: <Lightbulb className="h-3 w-3" />,
    badgeVariant: 'secondary' as const,
  },
};

interface FilterState {
  puzzleId: string;
  modelName: string;
  feedbackType: SelectFeedbackType;
  fromDate?: string;
  toDate?: string;
  limit: number;
}

function buildQueryFilters(filters: FilterState): FeedbackFilters {
  const query: FeedbackFilters = {
    limit: filters.limit,
  };

  if (filters.puzzleId.trim()) {
    query.puzzleId = filters.puzzleId.trim();
  }

  if (filters.modelName.trim()) {
    query.modelName = filters.modelName.trim();
  }

  if (filters.feedbackType && filters.feedbackType !== ALL_TYPES_VALUE) {
    query.feedbackType = filters.feedbackType;
  }

  if (filters.fromDate && filters.fromDate.trim()) {
    const from = new Date(filters.fromDate);
    if (!Number.isNaN(from.getTime())) {
      query.fromDate = from;
    }
  }

  if (filters.toDate && filters.toDate.trim()) {
    const to = new Date(filters.toDate);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      query.toDate = to;
    }
  }

  return query;
}

export default function FeedbackExplorer() {
  React.useEffect(() => {
    document.title = 'Feedback Explorer';
  }, []);
  const [filters, setFilters] = useState<FilterState>({
    puzzleId: '',
    modelName: '',
    feedbackType: ALL_TYPES_VALUE,
    limit: 250,
  });
  const [page, setPage] = useState(1);

  const queryFilters = useMemo(() => buildQueryFilters(filters), [filters]);

  const {
    data: feedback,
    isLoading: isFeedbackLoading,
    error: feedbackError,
    refetch: refetchFeedback,
  } = useFeedback(queryFilters);

  const {
    data: stats,
    isLoading: isStatsLoading,
  } = useFeedbackStats();

  const totalFeedback = feedback?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalFeedback / PAGE_SIZE));
  const paginatedFeedback = useMemo(() => {
    if (!feedback || feedback.length === 0) {
      return [] as DetailedFeedback[];
    }
    const start = (page - 1) * PAGE_SIZE;
    return feedback.slice(start, start + PAGE_SIZE);
  }, [feedback, page]);

  const uniqueModels = useMemo(() => {
    if (!feedback) return [] as string[];
    return Array.from(new Set(feedback.map((item) => item.modelName))).sort();
  }, [feedback]);

  const uniquePuzzles = useMemo(() => {
    if (!feedback) return [] as string[];
    return Array.from(new Set(feedback.map((item) => item.puzzleId))).sort();
  }, [feedback]);

  const hasActiveFilters = Boolean(
    filters.puzzleId.trim() ||
      filters.modelName.trim() ||
      filters.feedbackType !== ALL_TYPES_VALUE ||
      filters.fromDate ||
      filters.toDate
  );

  const dateRangeInvalid =
    filters.fromDate && filters.toDate && filters.fromDate > filters.toDate;

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters((prev) => ({
      puzzleId: '',
      modelName: '',
      feedbackType: ALL_TYPES_VALUE,
      fromDate: undefined,
      toDate: undefined,
      limit: prev.limit,
    }));
    setPage(1);
  };

  const resetAll = () => {
    setFilters({
      puzzleId: '',
      modelName: '',
      feedbackType: ALL_TYPES_VALUE,
      limit: 250,
      fromDate: undefined,
      toDate: undefined,
    });
    setPage(1);
  };

  const exportCsv = () => {
    if (!feedback || feedback.length === 0) {
      return;
    }

    const header = ['id', 'puzzleId', 'modelName', 'feedbackType', 'comment', 'createdAt', 'confidence', 'patternDescription'];
    const rows = feedback.map((item) => [
      item.id,
      item.puzzleId,
      item.modelName,
      item.feedbackType,
      item.comment ? item.comment.replace(/"/g, '""') : '',
      item.createdAt,
      item.confidence,
      item.patternDescription ? item.patternDescription.replace(/"/g, '""') : '',
    ]);

    const csv = [header.join(','), ...rows.map((row) => row.map((value) => `"${String(value ?? '')}"`).join(','))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderTypeBadge = (type: DetailedFeedback['feedbackType']) => {
    const meta = feedbackTypeMeta[type];
    if (!meta) {
      return null;
    }
    return (
      <Badge variant={meta.badgeVariant} className="flex items-center gap-1 text-xs">
        {meta.icon}
        {meta.label}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Feedback Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Investigate how researchers rated explanation quality across puzzles and models.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={String(filters.limit)}
            onValueChange={(value) => handleFilterChange('limit', parseInt(value, 10))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  Fetch {option.toLocaleString()} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchFeedback()}
            disabled={isFeedbackLoading}
            className="flex items-center gap-2"
          >
            {isFeedbackLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!feedback || feedback.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </header>

      <section>
        {isStatsLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading feedback statistics…
              </div>
            </CardContent>
          </Card>
        ) : stats ? (
          <FeedbackSummary stats={stats} showModelBreakdown showDailyTrends className="" />
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No feedback statistics available yet.
            </CardContent>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="puzzleId">Puzzle ID</Label>
              <Input
                id="puzzleId"
                placeholder="e.g., 9aec4887"
                value={filters.puzzleId}
                onChange={(event) => handleFilterChange('puzzleId', event.target.value)}
              />
              {uniquePuzzles.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Recent: {uniquePuzzles.slice(0, 5).join(', ')}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelName">Model Name</Label>
              <Input
                id="modelName"
                placeholder="e.g., openai/gpt-4o"
                value={filters.modelName}
                onChange={(event) => handleFilterChange('modelName', event.target.value)}
              />
              {uniqueModels.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Recent: {uniqueModels.slice(0, 5).join(', ')}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedbackType">Feedback Type</Label>
              <Select
                value={filters.feedbackType}
                onValueChange={(value) => handleFilterChange('feedbackType', value as FilterState['feedbackType'])}
              >
                <SelectTrigger id="feedbackType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES_VALUE}>All types</SelectItem>
                  <SelectItem value="helpful">Helpful</SelectItem>
                  <SelectItem value="not_helpful">Not Helpful</SelectItem>
                  <SelectItem value="solution_explanation">Solution Explanation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From</Label>
                <Input
                  id="fromDate"
                  type="date"
                  value={filters.fromDate ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    handleFilterChange('fromDate', nextValue ? nextValue : undefined);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To</Label>
                <Input
                  id="toDate"
                  type="date"
                  value={filters.toDate ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    handleFilterChange('toDate', nextValue ? nextValue : undefined);
                  }}
                />
              </div>
            </div>
          </div>

          {dateRangeInvalid && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>"From" date must be before the "To" date.</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearFilters} disabled={!hasActiveFilters}>
              Clear active filters
            </Button>
            <Button variant="ghost" size="sm" onClick={resetAll}>
              Reset to defaults
            </Button>

            {filters.puzzleId.trim() && (
              <Badge
                variant="outline"
                className="flex items-center gap-1 text-xs"
              >
                Puzzle: {filters.puzzleId.trim()}
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleFilterChange('puzzleId', '')}
                >
                  ×
                </button>
              </Badge>
            )}

            {filters.modelName.trim() && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                Model: {filters.modelName.trim()}
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleFilterChange('modelName', '')}
                >
                  ×
                </button>
              </Badge>
            )}

            {filters.feedbackType !== ALL_TYPES_VALUE && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                Type: {feedbackTypeMeta[filters.feedbackType]?.label || filters.feedbackType}
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleFilterChange('feedbackType', ALL_TYPES_VALUE)}
                >
                  ×
                </button>
              </Badge>
            )}

            {filters.fromDate && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                From: {filters.fromDate}
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleFilterChange('fromDate', '')}
                >
                  ×
                </button>
              </Badge>
            )}

            {filters.toDate && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                To: {filters.toDate}
                <button
                  type="button"
                  className="ml-1 text-muted-foreground hover:text-foreground"
                  onClick={() => handleFilterChange('toDate', '')}
                >
                  ×
                </button>
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>Feedback ({totalFeedback.toLocaleString()} items)</span>
            <span className="text-sm text-muted-foreground">
              Showing {paginatedFeedback.length.toLocaleString()} of {totalFeedback.toLocaleString()} (page {page} / {totalPages})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {feedbackError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load feedback: {feedbackError instanceof Error ? feedbackError.message : 'Unknown error'}
              </AlertDescription>
            </Alert>
          ) : isFeedbackLoading ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading feedback…
            </div>
          ) : paginatedFeedback.length === 0 ? (
            <div className="text-sm text-muted-foreground">No feedback matched the current filters.</div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Recorded</TableHead>
                    <TableHead className="w-[120px]">Puzzle</TableHead>
                    <TableHead className="w-[160px]">Model</TableHead>
                    <TableHead className="w-[180px]">Type</TableHead>
                    <TableHead>Comment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFeedback.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="text-sm text-muted-foreground">
                        <div>{new Date(item.createdAt).toLocaleString()}</div>
                        <div className="text-xs">{formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</div>
                      </TableCell>
                      <TableCell className="space-y-1 text-sm">
                        <div className="font-medium">{item.puzzleId}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Link
                            href={`/task/${item.puzzleId}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            View puzzle <ArrowUpRight className="h-3 w-3" />
                          </Link>
                          {item.explanationId && (
                            <Link
                              href={`/task/${item.puzzleId}?highlight=${item.explanationId}`}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                            >
                              Explanation <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{item.modelName}</div>
                        <div className="text-xs text-muted-foreground">Confidence {Math.round(item.confidence)}%</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {renderTypeBadge(item.feedbackType)}
                          <Badge variant="outline" className="text-xs">
                            Explanation #{item.explanationId ?? '—'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className={cn('text-sm leading-relaxed', item.comment ? '' : 'text-muted-foreground')}> 
                          {item.comment ? item.comment : 'No comment provided.'}
                        </p>
                        {item.patternDescription && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {item.patternDescription}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">
                Page {page} of {totalPages} · {totalFeedback.toLocaleString()} total items
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
