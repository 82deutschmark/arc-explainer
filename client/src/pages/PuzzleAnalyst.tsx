/**
 * Author: Claude Code (Haiku 4.5)
 * Date: 2025-12-21
 * PURPOSE: High-density, futuristic grid page for analyzing existing puzzle explanations.
 *          Read-only interface focused on browsing and comparing hundreds of explanations
 *          for a single puzzle. No model selection or prompt controls.
 * SRP/DRY check: Pass - Page handles layout/orchestration; ExplanationGridRow handles row rendering;
 *                reuses TinyGrid, AnalysisResultCard, and existing API hooks.
 */

import React, { useState, useMemo } from 'react';
import { useParams } from 'wouter';
import { Loader2, AlertCircle } from 'lucide-react';
import { getPuzzleName } from '@shared/utils/puzzleNames';
import { usePaginatedExplanationSummaries } from '@/hooks/useExplanation';
import { usePuzzle } from '@/hooks/usePuzzle';

// UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import ExplanationGridRow from '@/components/puzzle/ExplanationGridRow';

// Types
import type { ExplanationData } from '@/types/puzzle';

export default function PuzzleAnalyst() {
  const { taskId } = useParams<{ taskId: string }>();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Fetch puzzle metadata
  const { data: puzzle, isLoading: isPuzzleLoading } = usePuzzle(taskId);

  // Fetch all explanations with high page size
  const {
    summaries,
    isInitialLoading,
    error,
    total,
  } = usePaginatedExplanationSummaries(taskId, {
    pageSize: 1000,
    correctness: 'all',
  });

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
      <div className="min-h-screen bg-gray-950 p-6">
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
      <div className="min-h-screen bg-gray-950 p-6">
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
      <div className="min-h-screen bg-gray-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">
              {taskId}
              {puzzleName && ` — ${puzzleName}`}
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900/50 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-3xl font-bold text-gray-100 mb-1">
            {taskId}
            {puzzleName && ` — ${puzzleName}`}
          </h1>
          <p className="text-sm text-gray-400">
            Analyzing {total} explanation{total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Grid Container */}
        <div className="space-y-px bg-gray-900/30 rounded-lg border border-gray-800 overflow-hidden">
          {/* Column Headers */}
          <div className="hidden md:grid md:grid-cols-[80px_1fr_120px_100px_140px_80px_100px_50px] gap-2 px-4 py-3 bg-gray-900/70 border-b border-gray-800 sticky top-[89px] z-30 text-xs font-semibold text-gray-300 uppercase tracking-wider">
            <div>Grid</div>
            <div>Model</div>
            <div>Status</div>
            <div>Cost</div>
            <div>Created</div>
            <div>Tokens</div>
            <div>Reasoning</div>
            <div></div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-800">
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
        <div className="mt-6 text-xs text-gray-500 text-center">
          Showing {summaries.length} of {total} explanations
        </div>
      </div>
    </div>
  );
}
