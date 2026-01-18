/**
 * Author: ChatGPT
 * Date: 2026-01-01
 * Updated: 2026-01-01 - Fixed deep linking with ?highlight= parameter to properly scroll and highlight rows
 * PURPOSE: Task Examiner with correctness filtering and side-by-side Task Efficiency Leaderboard.
 *          When filtering to "correct", the layout elegantly splits into two columns: results on left,
 *          leaderboard on right. Smooth transitions make the UI feel reactive and polished.
 *          Deep linking with ?highlight=<id> now properly auto-expands rows and scrolls with visual feedback.
 * SRP/DRY check: Pass - orchestrates layout and filtering, delegates rows/leaderboard to components.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { AlertCircle, CheckCircle, Filter, XCircle, ArrowUpRight } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { usePaginatedExplanationSummaries } from '@/hooks/useExplanation';
import { usePuzzle } from '@/hooks/usePuzzle';
import type { CorrectnessFilter } from '@/hooks/useFilteredResults';

// UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import ExplanationGridRow from '@/components/puzzle/ExplanationGridRow';
import { TaskEfficiencyLeaderboard } from '@/components/puzzle/TaskEfficiencyLeaderboard';
import { cn } from '@/lib/utils';

export default function PuzzleAnalyst() {
  const { taskId } = useParams<{ taskId: string }>();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Support #correct hash in URL to auto-filter
  const [correctnessFilter, setCorrectnessFilter] = useState<CorrectnessFilter>(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'correct') return 'correct';
    if (hash === 'incorrect') return 'incorrect';
    return 'all';
  });
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  // Fetch puzzle metadata
  const { task, isLoadingTask: isPuzzleLoading } = usePuzzle(taskId);

  // Fetch all explanations with high page size
  const {
    summaries,
    isInitialLoading,
    error,
    total,
    counts,
  } = usePaginatedExplanationSummaries(taskId, {
    pageSize: 1000,
    correctness: correctnessFilter,
  });

  // Keep a simple summary of totals for the header badges.
  const summaryStats = counts ?? { all: 0, correct: 0, incorrect: 0 };
  // Provide expected outputs so AnalysisResultCard can render grids and mismatches.
  const testCases = task?.test ?? [];

  // Handle highlight query parameter for deep linking - auto-expand and scroll
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightParam = params.get('highlight');
    const parsedHighlight = highlightParam ? Number.parseInt(highlightParam, 10) : NaN;

    if (Number.isFinite(parsedHighlight)) {
      setHighlightedId(parsedHighlight);
      setExpandedRows((prev) => new Set([...prev, parsedHighlight]));
    } else {
      setHighlightedId(null);
    }
  }, []);

  // Scroll to highlighted row once summaries are loaded and add visual feedback
  useEffect(() => {
    if (highlightedId !== null && summaries.length > 0) {
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(`explanation-row-${highlightedId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add visual ring highlight (same as PuzzleExaminer for consistency)
          element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50');
          setTimeout(() => {
            element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50');
          }, 3000);
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [highlightedId, summaries]);

  const handleToggleRow = (explanationId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(explanationId)) {
        next.delete(explanationId);
      } else {
        next.add(explanationId);
      }
      return next;
    });
  };

  const puzzleName = useMemo(() => {
    return getPuzzleName(taskId);
  }, [taskId]);

  // Loading state
  if (isInitialLoading || isPuzzleLoading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <Skeleton className="h-8 w-48 mb-2 bg-gray-800" />
            <Skeleton className="h-4 w-64 bg-gray-800" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <Alert className="bg-red-950/30 border border-red-900/50">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-300">
              Failed to load explanations: {error.message}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Empty state
  if (!summaries || summaries.length === 0) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
            {taskId}
            {puzzleName && ` - ${puzzleName}`}
            </h1>
            <p className="text-gray-400">Puzzle Analysis</p>
          </div>
          <Alert className="bg-gray-900/50 border border-gray-800">
            <AlertCircle className="h-4 w-4 text-gray-400" />
            <AlertDescription className="text-gray-300">
              No explanations found for this puzzle. Run some analyses to get started.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-50">
      <div className="border-b border-gray-800 bg-black">
        <div className="max-w-7xl mx-auto px-4 py-2 relative">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold text-gray-100 leading-tight">
              {taskId}
              {puzzleName && ` - ${puzzleName}`}
            </h1>
            <a href={`/puzzle/${taskId}`}>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-100 hover:bg-gray-800/50 flex items-center gap-1"
              >
                Puzzle Examiner
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 mt-1">
            Analyzing {total} explanation{total !== 1 ? 's' : ''}
          </p>
          {/* Correctness filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-300">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-gray-500">
              <Filter className="h-4 w-4 opacity-70" />
              <span>Filter</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900/70 px-3 py-1 text-gray-100 transition-colors',
                correctnessFilter === 'all' && 'border-gray-600 bg-gray-800 text-white shadow-inner'
              )}
              onClick={() => setCorrectnessFilter('all')}
            >
              All ({summaryStats.all})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'flex items-center gap-2 rounded-full border border-emerald-900/70 bg-emerald-950/40 px-3 py-1 text-emerald-100 transition-colors',
                correctnessFilter === 'correct' && 'border-emerald-400 bg-emerald-900/70 text-emerald-50 shadow-inner'
              )}
              onClick={() => setCorrectnessFilter('correct')}
            >
              <CheckCircle className="h-4 w-4" />
              Correct ({summaryStats.correct})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'flex items-center gap-2 rounded-full border border-rose-900/70 bg-rose-950/40 px-3 py-1 text-rose-100 transition-colors',
                correctnessFilter === 'incorrect' && 'border-rose-400 bg-rose-900/70 text-rose-50 shadow-inner'
              )}
              onClick={() => setCorrectnessFilter('incorrect')}
            >
              <XCircle className="h-4 w-4" />
              Incorrect ({summaryStats.incorrect})
            </Button>
          </div>
        </div>
      </div>

      {/* Side-by-side layout: grid left, leaderboard right when filtering to correct */}
      <div className={cn(
        'mx-auto px-4 pt-1 pb-3 transition-all duration-300 ease-out',
        correctnessFilter === 'correct' ? 'max-w-[1800px]' : 'max-w-7xl'
      )}>
        <div className={cn(
          'grid gap-6 transition-all duration-300 ease-out',
          correctnessFilter === 'correct' && summaries.length > 0
            ? 'lg:grid-cols-2'
            : 'grid-cols-1'
        )}>
          {/* Left: Results grid */}
          <div className="space-y-px border border-gray-800/80 rounded-xl bg-black shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] overflow-hidden transition-all duration-300">
          {/* Column headers align with ExplanationGridRow widths so every value lines up. */}
          <div
            className="hidden md:grid grid-cols-[60px_minmax(220px,1fr)_110px_90px_100px_100px_92px_44px] gap-3 px-3 py-1.5 bg-black border-b border-gray-800 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-500"
          >
            <div>Grid</div>
            <div>Model</div>
            <div>Status</div>
            <div>Cost</div>
            <div>Date</div>
            <div>Tokens T/I/O/R</div>
            <div>Time</div>
            <div></div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-900/50">
            {summaries.map((explanation, idx) => (
              <div key={explanation.id} id={`explanation-row-${explanation.id}`}>
                <ExplanationGridRow
                  explanation={explanation}
                  testCases={testCases}
                  isExpanded={expandedRows.has(explanation.id)}
                  onToggleExpand={() => handleToggleRow(explanation.id)}
                  isAlternate={idx % 2 === 1}
                />
              </div>
            ))}
          </div>
          </div>

          {/* Right: Task Efficiency Leaderboard (appears elegantly when filtering to correct) */}
          <div className={cn(
            'transition-all duration-300 ease-out lg:sticky lg:top-4 lg:self-start',
            correctnessFilter === 'correct' && summaries.length > 0
              ? 'opacity-100 translate-x-0'
              : 'hidden lg:hidden'
          )}>
            {correctnessFilter === 'correct' && summaries.length > 0 && (
              <TaskEfficiencyLeaderboard
                explanations={summaries}
                taskId={taskId}
                onSelectExplanation={(id) => {
                  // Expand the selected row
                  setExpandedRows((prev) => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                  });
                  // Scroll to the row
                  const element = document.getElementById(`explanation-row-${id}`);
                  element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
              />
            )}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-4 text-xs uppercase tracking-[0.22em] text-gray-500">
          Showing {summaries.length} of {total} explanations
        </div>
      </div>
    </div>
  );
}
