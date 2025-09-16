/**
 * useEloComparison.ts
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-16
 * PURPOSE: Hook for fetching explanation comparison pairs from Elo system
 * SRP and DRY check: Pass - Single responsibility (Elo comparison data), reuses existing query patterns
 *
 * INTEGRATION:
 * - Follows established hook patterns from useAnalysisResults and usePuzzle
 * - Uses TanStack Query for caching and state management
 * - Integrates with backend /api/elo/comparison endpoints
 * - Manages session IDs for user tracking and duplicate prevention
 */

import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import type { PuzzleData, ExplanationData } from '@/types/puzzle';

// Types from backend
interface EloRating {
  id: number;
  explanationId: number;
  currentRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  lastUpdated: string;
  createdAt: string;
}

interface ComparisonResponse {
  puzzleId: string;
  puzzle: PuzzleData;
  explanationA: ExplanationData & { eloRating: EloRating };
  explanationB: ExplanationData & { eloRating: EloRating };
  sessionId: string;
}

/**
 * Hook for fetching explanation comparison pairs
 */
export function useEloComparison(puzzleId?: string) {
  // Generate and persist session ID for this user session
  const [sessionId, setSessionId] = useState<string>(() => {
    // Try to get existing session from localStorage
    const stored = localStorage.getItem('elo-session-id');
    if (stored) return stored;

    // Generate new session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('elo-session-id', newSessionId);
    return newSessionId;
  });

  // Fetch comparison pair
  const {
    data: comparisonData,
    isLoading,
    error,
    refetch,
    isRefetching
  } = useQuery<ComparisonResponse>({
    queryKey: ['elo-comparison', puzzleId, sessionId],
    queryFn: async () => {
      const endpoint = puzzleId
        ? `/api/elo/comparison/${puzzleId}`
        : '/api/elo/comparison';

      const params = new URLSearchParams();
      if (sessionId) params.append('sessionId', sessionId);

      const url = params.toString() ? `${endpoint}?${params}` : endpoint;

      const response = await apiRequest(url);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch comparison');
      }

      return response.data;
    },
    retry: 2,
    staleTime: 0, // Always fetch fresh comparisons
    refetchOnWindowFocus: false,
    refetchOnMount: true
  });

  // Update session ID if backend provides a new one
  useEffect(() => {
    if (comparisonData?.sessionId && comparisonData.sessionId !== sessionId) {
      setSessionId(comparisonData.sessionId);
      localStorage.setItem('elo-session-id', comparisonData.sessionId);
    }
  }, [comparisonData?.sessionId, sessionId]);

  return {
    comparisonData,
    isLoading: isLoading || isRefetching,
    error,
    refetch,
    sessionId
  };
}

/**
 * Hook for fetching Elo leaderboard data
 */
export function useEloLeaderboard(limit: number = 50) {
  return useQuery({
    queryKey: ['elo-leaderboard', limit],
    queryFn: async () => {
      const response = await apiRequest(`/api/elo/leaderboard?limit=${limit}`);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch leaderboard');
      }

      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook for fetching model-level Elo statistics
 */
export function useEloModelStats() {
  return useQuery({
    queryKey: ['elo-model-stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/elo/models');

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch model stats');
      }

      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
}

/**
 * Hook for fetching system-wide Elo statistics
 */
export function useEloSystemStats() {
  return useQuery({
    queryKey: ['elo-system-stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/elo/stats');

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch system stats');
      }

      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false
  });
}