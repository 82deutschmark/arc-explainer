/**
 * useEligibleExplanations.ts
 * 
 * Author: Cascade using Sonnet 4
 * Date: 2025-10-06
 * PURPOSE: Hook to fetch explanations eligible for PuzzleDiscussion (conversation chaining)
 * Filters server-side for: <30 days old, reasoning models, has provider_response_id
 * SRP/DRY check: Pass - Single responsibility for fetching eligible explanations
 */

import { useQuery } from '@tanstack/react-query';

export interface EligibleExplanation {
  id: number;
  puzzleId: string;
  modelName: string;
  provider: 'openai' | 'xai' | 'unknown';
  createdAt: string;
  hoursOld: number;
  hasProviderResponseId: boolean;
  confidence: number;
  isCorrect: boolean;
}

interface EligibleExplanationsResponse {
  explanations: EligibleExplanation[];
  total: number;
  limit: number;
  offset: number;
}

export function useEligibleExplanations(limit: number = 20, offset: number = 0) {
  return useQuery<EligibleExplanationsResponse>({
    queryKey: ['eligible-explanations', limit, offset],
    queryFn: async () => {
      const response = await fetch(`/api/discussion/eligible?limit=${limit}&offset=${offset}`);
      if (!response.ok) {
        throw new Error('Failed to fetch eligible explanations');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - data changes infrequently
  });
}
