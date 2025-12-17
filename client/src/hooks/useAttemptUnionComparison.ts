/**
 * Author: Cascade
 * Date: 2025-12-17
 * PURPOSE: Dedicated hook for fetching attempt-union comparison results (2 attempts of the same base model)
 *          using /api/metrics/compare via the shared compareService.
 *
 *          This hook centralizes:
 *          - when/why we fetch (auto-fetch on dataset + attempt-model changes)
 *          - where attemptUnionStats live in the response
 *          - how to derive the union puzzle IDs used by the UI
 *
 * SRP/DRY check: Pass - One responsibility: fetch + extract union comparison view-model.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchMetricsCompare } from '@/services/metrics/compareService';
import { ModelComparisonResult } from '@/pages/AnalyticsOverview';
import { parseAttemptModelName } from '@/utils/modelComparison';

export interface AttemptUnionComparisonInput {
  dataset: string | null;
  attemptModelNames: [string, string] | null;
}

export interface AttemptUnionComparisonOutput {
  comparisonResult: ModelComparisonResult | null;
  unionMetrics: ModelComparisonResult['summary']['attemptUnionStats'][number] | null;
  unionPuzzleIds: string[];
  loading: boolean;
  error: string | null;
}

const computeBaseModelName = (attemptModelNames: [string, string]): string | null => {
  // Prefer parsing the canonical base model name from the attempt suffix.
  const parsed = parseAttemptModelName(attemptModelNames[0]);
  if (parsed?.baseModelName) {
    return parsed.baseModelName;
  }

  // Fallback: if the naming pattern is not the standard -attemptN suffix,
  // we cannot reliably infer a base model name.
  return null;
};

const computeUnionPuzzleIds = (comparisonResult: ModelComparisonResult): string[] => {
  // IMPORTANT: This preserves the existing union page behavior:
  // a puzzle is included if either attempt is puzzle-level 'correct' in details.
  // This is NOT the same as "puzzles fully solved" for multi-test-pair tasks.
  const unionIds: string[] = [];

  for (const detail of comparisonResult.details ?? []) {
    if (detail.model1Result === 'correct' || detail.model2Result === 'correct') {
      unionIds.push(detail.puzzleId);
    }
  }

  return unionIds;
};

/**
 * Fetches and derives attempt-union stats for the currently selected dataset + attempt pair.
 */
export const useAttemptUnionComparison = (
  input: AttemptUnionComparisonInput,
): AttemptUnionComparisonOutput => {
  const enabled = Boolean(input.dataset && input.attemptModelNames?.length === 2);

  const dataset = input.dataset;
  const attemptModelNames = input.attemptModelNames;

  const baseModelName = useMemo(() => {
    if (!attemptModelNames) return null;
    return computeBaseModelName(attemptModelNames);
  }, [attemptModelNames]);

  const query = useQuery({
    queryKey: ['attempt-union-compare', dataset, attemptModelNames?.[0], attemptModelNames?.[1]],
    enabled,
    queryFn: async () => {
      if (!dataset || !attemptModelNames) {
        throw new Error('Missing dataset or attempt model names');
      }

      // We request exactly two models: model1 and model2.
      const comparisonResult = await fetchMetricsCompare({
        dataset,
        modelNames: [attemptModelNames[0], attemptModelNames[1]],
      });

      const attemptUnionStats = comparisonResult.summary?.attemptUnionStats ?? [];
      if (!Array.isArray(attemptUnionStats) || attemptUnionStats.length === 0) {
        throw new Error('Server did not return attempt-union stats for this comparison');
      }

      // Prefer the stat entry matching the inferred base model name.
      const unionMetrics = baseModelName
        ? attemptUnionStats.find((stat) => stat.baseModelName === baseModelName) ?? null
        : attemptUnionStats[0] ?? null;

      if (!unionMetrics) {
        throw new Error('Server did not return attempt-union stats for this attempt pair');
      }

      return {
        comparisonResult,
        unionMetrics,
        unionPuzzleIds: computeUnionPuzzleIds(comparisonResult),
      };
    },
    // This is relatively expensive and should remain stable once fetched.
    staleTime: 10 * 60 * 1000,
  });

  return {
    comparisonResult: query.data?.comparisonResult ?? null,
    unionMetrics: query.data?.unionMetrics ?? null,
    unionPuzzleIds: query.data?.unionPuzzleIds ?? [],
    // Use isFetching so the UI can reflect transitions when the dataset/model pair changes.
    loading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
  };
};
