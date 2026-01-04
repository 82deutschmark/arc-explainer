/**
 * Author: Cascade/Claude Opus 4.5
 * Date: 2026-01-03
 * PURPOSE: Hook for fetching and monitoring OpenRouter credits.
 *          Polls the /api/arc3-openrouter/credits endpoint with user's API key.
 *          BYOK: Key is passed per-request, never stored.
 * SRP/DRY check: Pass - single responsibility: credits monitoring.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface OpenRouterCredits {
  label: string;
  usage: number;        // Amount used in USD
  limit: number | null; // Credit limit (null = unlimited)
  remaining: number | null;  // Remaining credits (null = unlimited)
  isFreeTier: boolean;
  rateLimit: { requests: number; interval: string } | null;
  timestamp: number;
}

export interface UseOpenRouterCreditsOptions {
  /** API key to check credits for */
  apiKey: string;
  /** Polling interval in ms (default: 30000 = 30s) */
  pollInterval?: number;
  /** Whether to enable polling (default: true when apiKey provided) */
  enabled?: boolean;
}

export interface UseOpenRouterCreditsResult {
  credits: OpenRouterCredits | null;
  isLoading: boolean;
  error: string | null;
  /** Manually trigger a refresh */
  refetch: () => Promise<void>;
  /** Last successful fetch timestamp */
  lastUpdated: number | null;
}

/**
 * Hook to fetch and monitor OpenRouter credits for a given API key.
 * Polls periodically when enabled and key is provided.
 */
export function useOpenRouterCredits({
  apiKey,
  pollInterval = 30000, // 30 seconds default
  enabled = true,
}: UseOpenRouterCreditsOptions): UseOpenRouterCreditsResult {
  const [credits, setCredits] = useState<OpenRouterCredits | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  // Track if component is mounted
  const mountedRef = useRef(true);
  
  const fetchCredits = useCallback(async () => {
    if (!apiKey || !apiKey.trim()) {
      setCredits(null);
      setError(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest('POST', '/api/arc3-openrouter/credits', {
        apiKey: apiKey.trim(),
      });
      
      const data = await response.json();
      
      if (!mountedRef.current) return;
      
      if (data.success && data.data) {
        setCredits(data.data);
        setLastUpdated(Date.now());
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch credits');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [apiKey]);
  
  // Initial fetch when key changes
  useEffect(() => {
    if (enabled && apiKey && apiKey.trim()) {
      fetchCredits();
    } else {
      setCredits(null);
      setError(null);
    }
  }, [apiKey, enabled, fetchCredits]);
  
  // Polling
  useEffect(() => {
    if (!enabled || !apiKey || !apiKey.trim() || pollInterval <= 0) {
      return;
    }
    
    const intervalId = setInterval(() => {
      fetchCredits();
    }, pollInterval);
    
    return () => clearInterval(intervalId);
  }, [apiKey, pollInterval, enabled, fetchCredits]);
  
  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return {
    credits,
    isLoading,
    error,
    refetch: fetchCredits,
    lastUpdated,
  };
}

/**
 * Format credits as currency string.
 * @param amount Amount in USD
 * @returns Formatted string like "$2.47" or "unlimited"
 */
export function formatCredits(amount: number | null): string {
  if (amount === null) {
    return 'unlimited';
  }
  return `$${amount.toFixed(2)}`;
}
