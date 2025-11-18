/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: React hook to fetch ARC contributor data from the API.
 * Provides list of notable human contributors to the ARC-AGI challenge for trading card display.
 * SRP/DRY check: Pass - Single responsibility for fetching contributor data
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ArcContributorsResponse } from '@shared/types/contributor';

interface UseContributorsOptions {
  category?: string;
  yearStart?: number;
  limit?: number;
}

export function useArcContributors(options?: UseContributorsOptions) {
  const queryParams = new URLSearchParams();

  if (options?.category) {
    queryParams.append('category', options.category);
  }
  if (options?.yearStart) {
    queryParams.append('yearStart', options.yearStart.toString());
  }
  if (options?.limit) {
    queryParams.append('limit', options.limit.toString());
  }

  const queryString = queryParams.toString();
  const endpoint = `/api/contributors${queryString ? `?${queryString}` : ''}`;

  return useQuery<ArcContributorsResponse>({
    queryKey: ['arc-contributors', options],
    queryFn: async () => {
      const response = await apiRequest('GET', endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch contributors: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - contributors data doesn't change often
  });
}

export interface ContributorStats {
  total: number;
  categoryCounts: Record<string, number>;
  latestYear: number;
}

/**
 * Hook to fetch contributor statistics
 */
export function useContributorStats() {
  return useQuery<ContributorStats>({
    queryKey: ['contributor-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/contributors/stats');
      if (!response.ok) {
        throw new Error(`Failed to fetch contributor stats: ${response.statusText}`);
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
