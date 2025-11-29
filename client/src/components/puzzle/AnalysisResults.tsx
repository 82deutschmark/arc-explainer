/**
 * AnalysisResults.tsx
 *
 * Displays analysis results with paginated summaries and lazy detail loading.
 * Rebuilt around shadcn/ui Card, Button, and Alert components so the entire
 * surface matches the rest of the design system.
 * shadcn/ui: Pass - Uses Card, Button, Alert primitives
 */

import React, { useMemo } from 'react';
import { Brain, Filter, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AnalysisResultListCard } from './AnalysisResultListCard';
import type { CorrectnessFilter } from '@/hooks/useFilteredResults';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';
import type { ARCTask } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface AnalysisResultsProps {
  results: ExplanationData[];
  counts: { all: number; correct: number; incorrect: number };
  filteredTotal: number;
  correctnessFilter: CorrectnessFilter;
  onFilterChange: (filter: CorrectnessFilter) => void;
  models: ModelConfig[] | undefined;
  task: ARCTask;
  isAnalyzing: boolean;
  currentModel: ModelConfig | null;
  highlightedExplanationId?: number | null;
  highlightedExplanation?: ExplanationData | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingInitial?: boolean;
  isFetchingMore?: boolean;
  isFetching?: boolean;
  loadFullResult: (explanationId: number) => Promise<ExplanationData | null>;
}

const ensureNumber = (value: number | undefined | null): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value;
};

export function AnalysisResults({
  results,
  counts,
  filteredTotal,
  correctnessFilter,
  onFilterChange,
  models,
  task,
  isAnalyzing,
  currentModel,
  highlightedExplanationId,
  highlightedExplanation,
  hasMore = false,
  onLoadMore,
  isLoadingInitial = false,
  isFetchingMore = false,
  isFetching = false,
  loadFullResult,
}: AnalysisResultsProps) {
  const highlightId =
    typeof highlightedExplanationId === 'number' && Number.isFinite(highlightedExplanationId)
      ? highlightedExplanationId
      : null;

  const highlightAlreadyPresent = highlightId !== null ? results.some(result => result.id === highlightId) : false;

  const mergedResults = useMemo(() => {
    if (highlightId !== null && highlightedExplanation && !highlightAlreadyPresent) {
      return [highlightedExplanation, ...results];
    }
    return results;
  }, [highlightId, highlightedExplanation, highlightAlreadyPresent, results]);

  const totalForFilter = ensureNumber(filteredTotal);
  const pinnedHighlight = highlightId !== null && highlightedExplanation && !highlightAlreadyPresent;

  const renderCounts = {
    all: ensureNumber(counts.all),
    correct: ensureNumber(counts.correct),
    incorrect: ensureNumber(counts.incorrect),
  };

  const modelsByKey = useMemo(() => {
    if (!models) {
      return new Map<string, ModelConfig>();
    }
    return new Map(models.map(model => [model.key, model]));
  }, [models]);

  const isEmpty = !isAnalyzing && totalForFilter === 0;

  if (isEmpty && !isLoadingInitial) {
    return null;
  }

  const filterButtonClass = (target: CorrectnessFilter, activeClasses: string, inactiveClasses: string) =>
    cn(
      'inline-flex items-center justify-center gap-2 rounded-full border px-6 py-2 text-sm font-semibold transition-colors',
      correctnessFilter === target ? activeClasses : inactiveClasses,
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Analysis Results ({renderCounts.all})
            </CardTitle>

            <div className="hidden flex-col items-end text-xs text-muted-foreground sm:flex">
              <span className="font-semibold">
                {renderCounts.correct} correct | {renderCounts.incorrect} incorrect
              </span>
              <span className="opacity-70">{renderCounts.all} total runs</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <Filter className="h-4 w-4 opacity-60" />
              <span>Filter by correctness</span>
            </div>
            <div className="flex w-full flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={filterButtonClass(
                  'correct',
                  'bg-emerald-600 text-white border-emerald-600 shadow',
                  'border-emerald-200 bg-emerald-50 text-emerald-700',
                )}
                onClick={() => onFilterChange('correct')}
              >
                <CheckCircle className="h-4 w-4" />
                Correct ({renderCounts.correct})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className={filterButtonClass(
                  'incorrect',
                  'bg-rose-600 text-white border-rose-600 shadow',
                  'border-rose-200 bg-rose-50 text-rose-700',
                )}
                onClick={() => onFilterChange('incorrect')}
              >
                <XCircle className="h-4 w-4" />
                Incorrect ({renderCounts.incorrect})
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'border border-transparent text-muted-foreground',
                  correctnessFilter === 'all' && 'border-foreground/20 font-semibold text-foreground',
                )}
                onClick={() => onFilterChange('all')}
              >
                All ({renderCounts.all})
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground">
          <p>
            Showing {results.length} of {totalForFilter} explanation{totalForFilter === 1 ? '' : 's'}
            {pinnedHighlight ? ' (+1 pinned highlight)' : ''}.
          </p>
          {isFetching && !isLoadingInitial && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </div>
          )}
        </div>

        {isAnalyzing && (
          <Alert className="bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Analysis in progress…</AlertTitle>
            <AlertDescription className="text-xs">
              {currentModel ? (
                <>
                  Running {currentModel.name}
                  {currentModel.responseTime && (
                    <span className="ml-2">(Expected: {currentModel.responseTime.estimate})</span>
                  )}
                </>
              ) : (
                'Queued with current solver'
              )}
            </AlertDescription>
          </Alert>
        )}

        {isLoadingInitial && (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading explanations…
          </div>
        )}

        {!isLoadingInitial && mergedResults.length > 0 && (
          <div className="space-y-3">
            {mergedResults.map(result => {
              const key = `${result.id ?? result.modelName}-${result.createdAt ?? 'unknown'}`;
              const modelConfig = result.modelName ? modelsByKey.get(result.modelName) : undefined;
              const shouldHighlight = highlightId !== null && result.id === highlightId;

              return (
                <AnalysisResultListCard
                  key={key}
                  modelKey={result.modelName}
                  result={result}
                  model={modelConfig}
                  testCases={task.test}
                  eloMode={false}
                  initiallyExpanded={shouldHighlight || correctnessFilter === 'correct'}
                  highlighted={shouldHighlight}
                  loadFullResult={typeof result.id === 'number' ? () => loadFullResult(result.id as number) : undefined}
                />
              );
            })}

            {hasMore && onLoadMore && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFetchingMore}
                  onClick={() => {
                    if (!isFetchingMore) {
                      onLoadMore();
                    }
                  }}
                >
                  {isFetchingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    'Load more explanations'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {!isLoadingInitial && mergedResults.length === 0 && !isAnalyzing && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Filter className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p>No {correctnessFilter === 'correct' ? 'correct' : correctnessFilter === 'incorrect' ? 'incorrect' : ''} results found.</p>
            <p className="mt-1 text-xs">Try adjusting the filter or run a new analysis to populate this list.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
