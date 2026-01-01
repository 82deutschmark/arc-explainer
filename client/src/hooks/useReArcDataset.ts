/**
 * Author: Cascade (ChatGPT)
 * Date: 2025-12-31
 * PURPOSE: TanStack Query hook for loading the RE-ARC dataset plus derived helpers
 *          (sorted entries and dataset summary) to power the visual dataset viewer.
 * SRP/DRY check: Pass — isolates RE-ARC dataset fetching/caching logic away from UI.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ARCTask } from '@shared/types';
import { apiRequest } from '@/lib/queryClient';

interface ReArcDatasetSummary {
  totalTasks: number;
  totalTrainPairs: number;
  totalTestInputs: number;
  maxTrainExamples: number;
  maxTestExamples: number;
  datasetPath: string;
}

interface ReArcDatasetResponse {
  dataset: Record<string, ARCTask>;
  summary: ReArcDatasetSummary;
}

interface APIResponse<T> {
  success: boolean;
  data: T;
}

interface DatasetEntry {
  taskId: string;
  task: ARCTask;
}

export function useReArcDataset() {
  const query = useQuery<APIResponse<ReArcDatasetResponse>>({
    queryKey: ['/api/rearc/tasks'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/rearc/tasks');
      return await response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes — dataset rarely changes
  });

  const dataset = query.data?.success ? query.data.data.dataset : undefined;
  const summary = query.data?.success ? query.data.data.summary : undefined;

  const entries: DatasetEntry[] = useMemo(() => {
    if (!dataset) {
      return [];
    }

    return Object.entries(dataset)
      .map(([taskId, task]) => ({ taskId, task }))
      .sort((a, b) => a.taskId.localeCompare(b.taskId));
  }, [dataset]);

  return {
    dataset,
    summary,
    entries,
    isLoading: query.isLoading,
    isError: Boolean(query.error),
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
