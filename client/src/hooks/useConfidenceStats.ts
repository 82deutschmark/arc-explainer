/**
 * useConfidenceStats Hook
 * 
 * This hook fetches confidence statistics from the API, providing data for the 
 * Confidence Leaderboard. It returns the stats, loading state, and any errors.
 */

import { useState, useEffect } from 'react';
import type { ConfidenceStats } from '@shared/types';

export function useConfidenceStats() {
  const [confidenceStats, setConfidenceStats] = useState<ConfidenceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchConfidenceStats() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/puzzle/confidence-stats');
        const result = await response.json();

        if (result.success) {
          setConfidenceStats(result.data);
        } else {
          setError(result.message || 'Failed to fetch confidence stats');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchConfidenceStats();
  }, []);

  return { confidenceStats, isLoading, error };
}
