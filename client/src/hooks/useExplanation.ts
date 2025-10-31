/**
 * useExplanation Hook
 * @author Cascade
 * 
 * Custom hook for fetching explanation data and checking if a puzzle has been explained.
 * This hook integrates with the Railway PostgreSQL database via the API endpoints.
 */

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ExplanationData } from '@/types/puzzle'; // Import the global type
import type { CorrectnessFilter } from '@/hooks/useFilteredResults';

interface ExplanationStatus {
  hasExplanation: boolean;
}

// This is the raw data structure from the backend API, using snake_case
interface RawExplanationData {
  id: number;
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  alienMeaning: string;
  confidence: number;
  helpful_votes: number | null;
  not_helpful_votes: number | null;
  createdAt: string;
}

/**
 * Check if a puzzle has an associated explanation
 */
export function useHasExplanation(puzzleId: string | null) {
  return useQuery({
    queryKey: ['explanation-status', puzzleId],
    queryFn: async () => {
      if (!puzzleId) return { hasExplanation: false };
      const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/has-explanation`);
      const json = await response.json();
      return json.data as ExplanationStatus;
    },
    enabled: !!puzzleId,
  });
}

/**
 * Fetch all explanations for a given puzzle.
 */
export function useExplanations(puzzleId: string | null) {
  return useQuery<ExplanationData[], Error>({
    queryKey: ['explanations', puzzleId],
    queryFn: async () => {
      if (!puzzleId) return [];
      try {
        const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/explanations`);
        if (!response.ok) {
          if (response.status === 404) {
            return [];
          }
          throw new Error(`Failed to fetch explanations: ${response.statusText}`);
        }
        const json = await response.json();
        const rawData: RawExplanationData[] = Array.isArray(json.data) ? json.data : [];

        // Transform snake_case from the API to camelCase for our app
        return rawData.map(raw => ({
          ...raw,
          helpfulVotes: raw.helpful_votes,
          notHelpfulVotes: raw.not_helpful_votes,
          explanationId: raw.id, // Ensure explanationId is mapped
          // Map conversation chaining field
          providerResponseId: (raw as any).providerResponseId,
          // Map prompt transparency fields (what was actually sent to AI)
          systemPromptUsed: (raw as any).system_prompt_used,
          userPromptUsed: (raw as any).user_prompt_used,
          promptTemplateId: (raw as any).prompt_template_id,
          // Map multi-test database field names to frontend field names
          multiplePredictedOutputs: (raw as any).multiplePredictedOutputs,
          multiTestResults: (raw as any).multiTestResults,
          multiTestAllCorrect: (raw as any).multiTestAllCorrect,
          multiTestAverageAccuracy: (raw as any).multiTestAverageAccuracy,
          hasMultiplePredictions: (raw as any).hasMultiplePredictions,
          isPredictionCorrect: (raw as any).isPredictionCorrect,
          // Map Grover iterative solver fields
          groverIterations: (raw as any).groverIterations,
          groverBestProgram: (raw as any).groverBestProgram,
          iterationCount: (raw as any).iterationCount,
        }));
      } catch (error) {
        console.error("Error fetching explanations:", error);
        return []; // Return empty array on error
      }
    },
    enabled: !!puzzleId,
  });
}

/**
 * Fetch a single explanation by its ID.
 */
export async function fetchExplanationById(explanationId: number): Promise<ExplanationData | null> {
  const response = await apiRequest('GET', `/api/explanations/${explanationId}`);
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch explanation ${explanationId}`);
  }

  const payload = await response.json();
  if (payload?.success && payload.data) {
    return payload.data as ExplanationData;
  }

  return null;
}

export function useExplanationById(
  explanationId: number | null,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? explanationId !== null;

  return useQuery<ExplanationData | null, Error>({
    queryKey: ['explanation-by-id', explanationId],
    enabled,
    queryFn: async () => {
      if (explanationId === null) {
        return null;
      }
      return fetchExplanationById(explanationId);
    },
  });
}

/**
 * Combined hook that provides explanation data for a puzzle.
 */
export function usePuzzleWithExplanation(puzzleId: string | null) {
  const {
    data: explanations,
    isLoading,
    error,
    refetch
  } = useExplanations(puzzleId);

  return {
    explanations: explanations || [],
    isLoading,
    error,
    refetchExplanations: refetch,
    hasExplanation: (explanations?.length || 0) > 0,
  };
}

const DEFAULT_PAGE_SIZE = 12;

type ExplanationSummaryResponse = {
  items: ExplanationData[];
  total: number;
  filteredTotal: number;
  counts: {
    all: number;
    correct: number;
    incorrect: number;
  };
  hasMore: boolean;
  nextOffset: number | null;
};

const EMPTY_SUMMARY: ExplanationSummaryResponse = {
  items: [],
  total: 0,
  filteredTotal: 0,
  counts: { all: 0, correct: 0, incorrect: 0 },
  hasMore: false,
  nextOffset: null,
};

export function usePaginatedExplanationSummaries(
  puzzleId: string | null,
  options?: { pageSize?: number; correctness?: CorrectnessFilter; enabled?: boolean }
) {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const correctness = options?.correctness ?? 'all';
  const enabled = (options?.enabled ?? true) && !!puzzleId;

  const query = useInfiniteQuery<ExplanationSummaryResponse, Error>({
    queryKey: ['explanation-summaries', puzzleId, correctness, pageSize],
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (!puzzleId) {
        return EMPTY_SUMMARY;
      }

      const offset = typeof pageParam === 'number' && Number.isFinite(pageParam) ? pageParam : 0;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });

      if (correctness !== 'all') {
        params.set('correctness', correctness);
      }

      const response = await apiRequest('GET', `/api/puzzle/${puzzleId}/explanations/summary?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch explanation summaries: ${response.statusText}`);
      }

      const json = await response.json();
      const payload = json?.data as ExplanationSummaryResponse | undefined;
      if (!payload) {
        return EMPTY_SUMMARY;
      }

      return payload;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage) {
        return undefined;
      }
      return lastPage.hasMore ? lastPage.nextOffset ?? undefined : undefined;
    },
  });

  const summaries = query.data?.pages.flatMap(page => page.items) ?? [];
  const counts = query.data?.pages[0]?.counts ?? EMPTY_SUMMARY.counts;
  const total = query.data?.pages[0]?.total ?? 0;
  const filteredTotal = query.data?.pages[0]?.filteredTotal ?? 0;
  const lastPage = query.data?.pages ? query.data.pages[query.data.pages.length - 1] : undefined;
  const hasMore = lastPage?.hasMore ?? false;
  const nextOffset = lastPage?.nextOffset ?? null;
  const isInitialLoading = !query.data && query.isLoading;

  return {
    ...query,
    summaries,
    counts,
    total,
    filteredTotal,
    hasMore,
    nextOffset,
    isInitialLoading,
  };
}
