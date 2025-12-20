/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-12-19
 * PURPOSE: Hook for managing matchId/gameId URL query parameters in Worm Arena.
 *          Handles both reading and writing the matchId to the URL.
 * SRP/DRY check: Pass - URL parameter management only.
 */

import React from 'react';
import { useLocation } from 'wouter';

export interface UseQueryParamMatchIdResult {
  /** Current matchId from URL (null if not present) */
  matchId: string | null;
  /** Update the URL with a new matchId */
  setMatchIdInUrl: (id: string) => void;
}

/**
 * Hook to read and write matchId/gameId from URL query parameters.
 * Supports both ?matchId= and ?gameId= for backwards compatibility.
 *
 * @returns Object with current matchId and setter function
 */
export function useQueryParamMatchId(): UseQueryParamMatchIdResult {
  const [location, setLocation] = useLocation();

  // Parse matchId from URL query string
  const matchId = React.useMemo(() => {
    try {
      const query = (() => {
        // Prefer window.location.search for accuracy (wouter location may lag)
        if (typeof window !== 'undefined' && typeof window.location?.search === 'string') {
          const raw = window.location.search;
          return raw.startsWith('?') ? raw.slice(1) : raw;
        }

        // Fallback to wouter location
        const idx = location.indexOf('?');
        return idx >= 0 ? location.slice(idx + 1) : '';
      })();

      if (!query) return null;

      const params = new URLSearchParams(query);
      // Support both matchId and gameId for backwards compatibility
      const raw = params.get('matchId') ?? params.get('gameId');
      const trimmed = raw?.trim();
      return trimmed && trimmed.length > 0 ? trimmed : null;
    } catch {
      return null;
    }
  }, [location]);

  // Update URL with new matchId
  const setMatchIdInUrl = React.useCallback(
    (id: string) => {
      const trimmed = id.trim();
      if (!trimmed) {
        setLocation('/worm-arena');
        return;
      }

      const encoded = encodeURIComponent(trimmed);
      setLocation(`/worm-arena?matchId=${encoded}`);
    },
    [setLocation],
  );

  return { matchId, setMatchIdInUrl };
}

export default useQueryParamMatchId;
