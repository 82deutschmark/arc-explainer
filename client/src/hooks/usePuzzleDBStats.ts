/**
 * usePuzzleDBStats Hook
 * 
 * Hook for fetching puzzle database statistics showing individual puzzles
 * with their explanation counts and binary accuracy metrics.
 * Uses existing /api/puzzle/worst-performing endpoint with different filters.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface PuzzleDBStats {
  puzzleId: string;
  wrongCount: number;
  avgAccuracy: number;
  avgConfidence: number;
  totalExplanations: number;
  negativeFeedback: number;
  totalFeedback: number;
  latestAnalysis: string;
  worstExplanationId: number;
  compositeScore: number;
}

interface PuzzleDBFilters {
  limit?: number;
  sortBy?: 'composite' | 'accuracy' | 'confidence' | 'feedback';
  minAccuracy?: number;
  maxAccuracy?: number;
  zeroAccuracyOnly?: boolean;
  includeRichMetrics?: boolean;
  showZeroExplanationsOnly?: boolean;
}

export function usePuzzleDBStats(filters: PuzzleDBFilters = {}) {
  return useQuery({
    queryKey: ['puzzle-db-stats', filters],
    queryFn: async (): Promise<PuzzleDBStats[]> => {
      const params = new URLSearchParams();
      
      // Set defaults
      params.append('limit', (filters.limit || 100).toString());
      params.append('sortBy', filters.sortBy || 'composite');
      
      // Apply filters
      if (filters.minAccuracy !== undefined) {
        params.append('minAccuracy', filters.minAccuracy.toString());
      }
      if (filters.maxAccuracy !== undefined) {
        params.append('maxAccuracy', filters.maxAccuracy.toString());
      }
      if (filters.zeroAccuracyOnly) {
        params.append('zeroAccuracyOnly', 'true');
      }
      if (filters.includeRichMetrics) {
        params.append('includeRichMetrics', 'true');
      }

      const response = await apiRequest(`/api/puzzle/worst-performing?${params.toString()}`);
      return response.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Separate hook for getting all puzzles with explanation counts
export function useAllPuzzleStats() {
  return useQuery({
    queryKey: ['all-puzzle-stats'],
    queryFn: async (): Promise<PuzzleDBStats[]> => {
      const params = new URLSearchParams();
      params.append('limit', '1000'); // Get more puzzles
      params.append('sortBy', 'composite');
      params.append('includeRichMetrics', 'true');
      
      const response = await apiRequest(`/api/puzzle/worst-performing?${params.toString()}`);
      return response.data;
    },
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // 10 minutes for this larger dataset
  });
}