/**
 * useConfidenceStats Hook  THIS IS USELESS AND DOESNT UNDERSTAND THAT CONFIDENCE IS NOT TRUSTWORTHINESS!!
 * A better use would be if it normalized confidence!  Some models return it as 0.85 when they mean 85%, and 1 when they mean 100% and it is up to us to normalize it!!
 * Realize that if a model returns 0.95, it means 95% confidence, not 0.95% confidence!
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
