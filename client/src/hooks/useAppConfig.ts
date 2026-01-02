/**
 * Author: Claude Sonnet 4
 * Date: 2026-01-01
 * PURPOSE: Hook to fetch and cache global application configuration from the server.
 *          Most importantly, exposes whether BYOK (Bring Your Own Key) is required.
 *          In production, ALL API calls require user-provided keys.
 * SRP/DRY check: Pass - single responsibility for app config fetching.
 */

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface AppConfig {
  requiresUserApiKey: boolean;
  isProduction: boolean;
  environment: string;
}

async function fetchAppConfig(): Promise<AppConfig> {
  const response = await apiRequest('GET', '/api/config');
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error?.message || 'Failed to fetch app config');
  }
  
  return data.data as AppConfig;
}

/**
 * Hook to get global app configuration including BYOK requirement.
 * Caches config for 5 minutes since it rarely changes during a session.
 */
export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: fetchAppConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

/**
 * Convenience hook that returns just the BYOK requirement flag.
 * Returns true if API keys are required (production mode).
 * Returns false while loading or on error (fail-open for UX, server will still enforce).
 */
export function useRequiresUserApiKey(): boolean {
  const { data } = useAppConfig();
  return data?.requiresUserApiKey ?? false;
}
