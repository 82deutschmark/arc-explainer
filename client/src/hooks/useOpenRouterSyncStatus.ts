/**
 * useOpenRouterSyncStatus.ts
 *
 * Author: Claude Haiku 4.5
 * Date: 2025-12-24
 * PURPOSE: Fetch OpenRouter catalog sync status (last sync time, new models count)
 *          for displaying sync status banner in app header
 * SRP/DRY check: Pass - isolated hook, single responsibility for sync status
 */

import { useQuery } from '@tanstack/react-query';
import type { OpenRouterSyncStatus } from '@shared/types';

const fetchSyncStatus = async (): Promise<OpenRouterSyncStatus> => {
  const response = await fetch('/api/models/openrouter/sync-status');
  if (!response.ok) {
    throw new Error('Failed to fetch OpenRouter sync status');
  }
  const data = await response.json();
  return data;
};

export const useOpenRouterSyncStatus = () => {
  return useQuery<OpenRouterSyncStatus, Error>({
    queryKey: ['openrouter-sync-status'],
    queryFn: fetchSyncStatus,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - sync happens during builds
    refetchOnWindowFocus: true, // Refresh when user returns to window
    retry: 1, // Single retry on failure
  });
};
