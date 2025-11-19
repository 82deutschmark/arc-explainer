/**
 * AnalysisResults.tsx
 *
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-12
 * PURPOSE: Displays analysis results with paginated summaries and lazy detail loading.
 * Extracted from PuzzleExaminer lines 891-993 to follow SRP.
 * Handles server-side filtered counts while keeping UI responsive as the list grows.
 *
 * SRP/DRY check: Pass - Single responsibility (results display), coordinates pagination + lazy detail hydration
 * DaisyUI: Pass - Uses DaisyUI card, btn-group, alert components
 */

import React, { useMemo } from 'react';
import { Brain, Filter, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AnalysisResultListCard } from './AnalysisResultListCard';
import type { CorrectnessFilter } from '@/hooks/useFilteredResults';
import type { ExplanationData } from '@/types/puzzle';
import type { ModelConfig } from '@shared/types';
import type { ARCTask } from '@shared/types';

interface AnalysisResultsProps {
  results: ExplanationData[];
  counts: { all: number; correct: number; incorrect: number };
  total: number;
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
  total,
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
  loadFullResult
}: AnalysisResultsProps) {
  const highlightId = typeof highlightedExplanationId === 'number' && Number.isFinite(highlightedExplanationId)
    ? highlightedExplanationId
    : null;

  const highlightAlreadyPresent = highlightId !== null
    ? results.some(result => result.id === highlightId)
    : false;

  const mergedResults = useMemo(() => {
    if (highlightId !== null && highlightedExplanation && !highlightAlreadyPresent) {
      return [highlightedExplanation, ...results];
    }
    return results;
  }, [highlightId, highlightedExplanation, highlightAlreadyPresent, results]);

  const visibleCount = results.length;
  const totalForFilter = ensureNumber(filteredTotal);
  const pinnedHighlight = highlightId !== null && highlightedExplanation && !highlightAlreadyPresent;

  const renderCounts = {
    all: ensureNumber(counts.all ?? total),
    correct: ensureNumber(counts.correct),
    incorrect: ensureNumber(counts.incorrect)
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

  return (
    <div className="card bg-base-100 shadow">
      <div className="card-body pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="card-title flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              Analysis Results ({renderCounts.all})
            </h2>

            <div className="hidden sm:flex flex-col items-end text-xs text-base-content/70">
              <span className="font-semibold">
                {renderCounts.correct} correct | {renderCounts.incorrect} incorrect
              </span>
              <span className="opacity-70">{renderCounts.all} total runs</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-base-content/60">
              <Filter className="h-4 w-4 opacity-60" />
              <span>Filter by correctness</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 w-full">
              <button
                className={`btn btn-lg px-6 text-lg font-semibold uppercase tracking-wide border-2 ${
                  correctnessFilter === 'correct'
                    ? 'btn-success text-white border-success shadow-md'
                    : 'btn-outline text-green-700 border-green-500 bg-green-50/60'
                }`}
                onClick={() => onFilterChange('correct')}
              >
                <CheckCircle className="h-5 w-5 mr-2" />
                Correct ({renderCounts.correct})
              </button>
              <button
                className={`btn btn-lg px-6 text-lg font-semibold uppercase tracking-wide border-2 ${
                  correctnessFilter === 'incorrect'
                    ? 'btn-error text-white border-error shadow-md'
                    : 'btn-outline text-red-700 border-red-500 bg-red-50/60'
                }`}
                onClick={() => onFilterChange('incorrect')}
              >
                <XCircle className="h-5 w-5 mr-2" />
                Incorrect ({renderCounts.incorrect})
              </button>
              <button
                className={`btn btn-sm ml-1 ${
                  correctnessFilter === 'all'
                    ? 'btn-ghost border border-base-300 font-semibold'
                    : 'btn-ghost text-base-content/70'
                }`}
                onClick={() => onFilterChange('all')}
              >
                All ({renderCounts.all})
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-base-content/70">
          <p>
            Showing {visibleCount} of {totalForFilter} explanation{totalForFilter === 1 ? '' : 's'}
            {pinnedHighlight ? ' (+1 pinned highlight)' : ''}.
          </p>
          {isFetching && !isLoadingInitial && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </div>
          )}
        </div>
      </div>

      <div className="card-body pt-2">
        {isAnalyzing && (
          <div role="alert" className="alert alert-info mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <div>
              <p className="text-xs font-medium">Analysis in progress…</p>
              {currentModel && (
                <p className="text-[10px] opacity-80">
                  Running {currentModel.name}
                  {currentModel.responseTime && (
                    <span className="ml-2">(Expected: {currentModel.responseTime.estimate})</span>
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {isLoadingInitial && (
          <div className="flex items-center justify-center py-10 text-sm text-base-content/60">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
                <button
                  type="button"
                  className={`btn btn-sm ${isFetchingMore ? 'btn-disabled' : 'btn-outline'}`}
                  onClick={() => {
                    if (!isFetchingMore) {
                      onLoadMore();
                    }
                  }}
                  disabled={isFetchingMore}
                >
                  {isFetchingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </span>
                  ) : (
                    'Load more explanations'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {!isLoadingInitial && mergedResults.length === 0 && !isAnalyzing && (
          <div className="text-center py-8 opacity-60">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No {correctnessFilter === 'correct' ? 'correct' : correctnessFilter === 'incorrect' ? 'incorrect' : ''} results found.</p>
            <p className="text-sm mt-1">
              Try adjusting the filter or run a new analysis to populate this list.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
