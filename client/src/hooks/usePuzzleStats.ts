/**
 * Author: gpt-5-codex
 * Date: 2025-02-15T00:00:00Z  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Fetches holistic puzzle statistics from `/api/puzzles/stats` and
 *          provides aggregate totals, analyzed coverage, backlog counts, and
 *          dataset/source breakdowns for UI consumers like PuzzleBrowser.
 * SRP/DRY check: Pass — new hook composes existing API helper without
 *                 duplicating aggregation logic elsewhere.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PuzzlePerformanceSnapshot {
  wrongCount: number;
  avgAccuracy: number;
  avgConfidence: number;
  totalExplanations: number;
  negativeFeedback: number;
  totalFeedback: number;
  latestAnalysis: string | null;
  worstExplanationId: number | null;
  compositeScore: number;
  avgCost?: number | null;
  avgProcessingTime?: number | null;
  avgReasoningTokens?: number | null;
  avgInputTokens?: number | null;
  avgOutputTokens?: number | null;
  avgTotalTokens?: number | null;
  multiTestCount?: number | null;
  singleTestCount?: number | null;
  lowestNonZeroConfidence?: number | null;
  modelsAttempted?: string[];
  reasoningEfforts?: string[];
}

export interface PuzzleStatsRecord {
  id: string;
  source?: string;
  hasExplanation?: boolean;
  performanceData?: PuzzlePerformanceSnapshot;
}

export interface DatasetBreakdownEntry {
  total: number;
  analyzed: number;
  backlog: number;
  coverage: number; // 0-1 ratio
}

export interface PuzzleStatsSummary {
  totalPuzzles: number;
  analyzedPuzzles: number;
  analyzedCoverage: number; // 0-1 ratio
  backlogPuzzles: number;
  datasetBreakdown: Record<string, DatasetBreakdownEntry>;
}

interface PuzzleStatsApiResponse {
  puzzles: PuzzleStatsRecord[];
  total: number;
}

const DEFAULT_SUMMARY: PuzzleStatsSummary = {
  totalPuzzles: 0,
  analyzedPuzzles: 0,
  analyzedCoverage: 0,
  backlogPuzzles: 0,
  datasetBreakdown: {}
};

export function usePuzzleStats() {
  const queryResult = useQuery<PuzzleStatsApiResponse>({
    queryKey: ['puzzle-stats', { limit: 4000 }],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzles/stats?limit=4000&includeRichMetrics=true');
      const payload = await response.json();
      if (!payload?.data) {
        throw new Error('Malformed puzzle stats response');
      }
      return payload.data as PuzzleStatsApiResponse;
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2
  });

  const summary = useMemo<PuzzleStatsSummary>(() => {
    if (!queryResult.data?.puzzles) {
      return DEFAULT_SUMMARY;
    }

    const puzzles = queryResult.data.puzzles;
    const totalPuzzles = queryResult.data.total ?? puzzles.length;
    let analyzedPuzzles = 0;

    const datasetBreakdownEntries = puzzles.reduce<Record<string, DatasetBreakdownEntry>>((acc, puzzle) => {
      const source = puzzle.source || 'Unknown';
      if (!acc[source]) {
        acc[source] = {
          total: 0,
          analyzed: 0,
          backlog: 0,
          coverage: 0
        };
      }

      acc[source].total += 1;
      const isAnalyzed = Boolean(puzzle.hasExplanation) || (puzzle.performanceData?.totalExplanations ?? 0) > 0;
      if (isAnalyzed) {
        acc[source].analyzed += 1;
        analyzedPuzzles += 1;
      }

      return acc;
    }, {});

    const backlogPuzzles = Math.max(totalPuzzles - analyzedPuzzles, 0);

    Object.values(datasetBreakdownEntries).forEach((entry) => {
      entry.backlog = Math.max(entry.total - entry.analyzed, 0);
      entry.coverage = entry.total > 0 ? entry.analyzed / entry.total : 0;
    });

    const analyzedCoverage = totalPuzzles > 0 ? analyzedPuzzles / totalPuzzles : 0;

    return {
      totalPuzzles,
      analyzedPuzzles,
      analyzedCoverage,
      backlogPuzzles,
      datasetBreakdown: datasetBreakdownEntries
    };
  }, [queryResult.data]);

  return {
    ...queryResult,
    summary
  };
}
