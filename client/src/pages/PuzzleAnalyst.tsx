/**
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Tighten the Puzzle Analyst layout so the dense grid matches the reference art direction.
 *          Adds sticky offsets to respect the global AppHeader height and prevent overlay on rows.
 * SRP/DRY check: Pass - this file orchestrates layout only and reuses ExplanationGridRow for details.
 */

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { usePaginatedExplanationSummaries } from '@/hooks/useExplanation';
import { usePuzzle } from '@/hooks/usePuzzle';

// UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import ExplanationGridRow from '@/components/puzzle/ExplanationGridRow';

export default function PuzzleAnalyst() {
  const { taskId } = useParams<{ taskId: string }>();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const headerRef = useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // AppHeader uses h-12, so reserve 48px for the global nav when sticking content.
  const appHeaderHeight = 48;

  // Measure the PuzzleAnalyst header so column headers stick below it.
  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      if (!headerRef.current) {
        return;
      }
      const measuredHeight = headerRef.current.getBoundingClientRect().height;
      setHeaderHeight(Math.ceil(measuredHeight));
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  const columnHeaderTop = appHeaderHeight + headerHeight;

  // Fetch puzzle metadata
  const { data: puzzle, isLoading: isPuzzleLoading } = usePuzzle(taskId);

  // Fetch all explanations with high page size
  const {
    summaries,
    isInitialLoading,
    error,
    total,
    counts,
  } = usePaginatedExplanationSummaries(taskId, {
    pageSize: 1000,
    correctness: 'all',
  });

  // Keep a simple summary of totals for the header badges.
  const summaryStats = counts ?? { all: 0, correct: 0, incorrect: 0 };

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
      <div
        ref={headerRef}
        className="sticky z-40 border-b border-gray-800 bg-black/95 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.9)] backdrop-blur-sm"
        style={{ top: appHeaderHeight }}
      >
        <div className="max-w-7xl mx-auto px-6 py-3">
          <h1 className="text-3xl font-semibold text-gray-100 leading-tight">
            {taskId}
            {puzzleName && ` - ${puzzleName}`}
          </h1>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gray-400 mt-1">
            Analyzing {total} explanation{total !== 1 ? 's' : ''}
          </p>
          {/* Summary badges keep the header informative at a glance. */}
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold uppercase text-gray-300">
            <span className="rounded-full border border-gray-800 px-3 py-1 bg-white/5">
              All {summaryStats.all}
            </span>
            <span className="rounded-full border border-gray-800 px-3 py-1 bg-emerald-500/10 text-emerald-200">
              Correct {summaryStats.correct}
            </span>
            <span className="rounded-full border border-gray-800 px-3 py-1 bg-rose-500/10 text-rose-200">
              Incorrect {summaryStats.incorrect}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="space-y-px border border-gray-800/80 rounded-2xl bg-black/80 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.95)] overflow-hidden">
          {/* Column headers align with ExplanationGridRow widths so every value lines up. */}
          <div
            className="hidden md:grid grid-cols-[72px_minmax(200px,1fr)_110px_90px_110px_110px_90px_48px] gap-3 px-4 py-3 bg-black/70 border-b border-gray-800 sticky z-30 text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400"
            style={{ top: columnHeaderTop }}
          >
            <div>Grid</div>
            <div>Model</div>
            <div>Status</div>
            <div>Cost</div>
            <div>Created</div>
            <div>Tokens</div>
            <div>Latency</div>
            <div></div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-900/50">
            {summaries.map((explanation, idx) => (
              <ExplanationGridRow
                key={explanation.id}
                explanation={explanation}
                isExpanded={expandedRows.has(explanation.id)}
                onToggleExpand={() => handleToggleRow(explanation.id)}
                isAlternate={idx % 2 === 1}
              />
            ))}
          </div>
        </div>

        {/* Footer Stats */}
        <div className="mt-5 text-[11px] uppercase tracking-[0.35em] text-gray-500">
          Showing {summaries.length} of {total} explanations
        </div>
      </div>
    </div>
  );
}
