/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-07
 * PURPOSE: React hook for managing batch analysis sessions with pause/resume capabilities.
 *          Provides real-time status updates and session management.
 *
 * SRP and DRY check: Pass - Single responsibility: batch analysis state management
 * shadcn/ui: Pass - Uses React Query for state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

interface BatchStartRequest {
  modelName: string;
  dataset: 'arc1' | 'arc2';
  puzzleIds?: string[];
  resume?: boolean;
  promptId?: string;
  temperature?: number;
  systemPromptMode?: string;
}

interface ActivityLogEntry {
  timestamp: Date | string;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  puzzleId?: string;
}

interface BatchPuzzleResult {
  puzzleId: string;
  status: 'pending' | 'analyzing' | 'success' | 'failed' | 'skipped';
  correct?: boolean;
  error?: string;
  processingTimeMs?: number;
  analysisId?: number;
}

interface BatchProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  percentage: number;
}

interface BatchStatus {
  sessionId: string;
  modelName: string;
  dataset: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: BatchProgress;
  results: BatchPuzzleResult[];
  activityLog: ActivityLogEntry[];
  startedAt: string;
  completedAt?: string;
  isPaused: boolean;
}

/**
 * Hook for starting a batch analysis session
 */
export function useStartBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: BatchStartRequest) => {
      const response = await fetch('/api/batch/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error('Failed to start batch analysis');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to start batch analysis');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-sessions'] });
    }
  });
}

/**
 * Hook for getting batch status with auto-refresh
 */
export function useBatchStatus(sessionId: string | null, autoRefresh: boolean = true) {
  return useQuery({
    queryKey: ['batch-status', sessionId],
    queryFn: async () => {
      if (!sessionId) {
        throw new Error('No session ID provided');
      }

      const response = await fetch(`/api/batch/status/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch status');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch batch status');
      }

      return result.data as BatchStatus;
    },
    enabled: !!sessionId,
    refetchInterval: autoRefresh ? 2000 : false, // Refresh every 2 seconds when enabled
    refetchIntervalInBackground: true
  });
}

/**
 * Hook for pausing a batch session
 */
export function usePauseBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/batch/pause/${sessionId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to pause batch');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to pause batch');
      }

      return result.data;
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['batch-status', sessionId] });
    }
  });
}

/**
 * Hook for resuming a batch session
 */
export function useResumeBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/batch/resume/${sessionId}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to resume batch');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to resume batch');
      }

      return result.data;
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['batch-status', sessionId] });
    }
  });
}

/**
 * Hook for getting batch results
 */
export function useBatchResults(sessionId: string | null) {
  return useQuery({
    queryKey: ['batch-results', sessionId],
    queryFn: async () => {
      if (!sessionId) {
        throw new Error('No session ID provided');
      }

      const response = await fetch(`/api/batch/results/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch batch results');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch batch results');
      }

      return result.data;
    },
    enabled: !!sessionId
  });
}

/**
 * Hook for listing all batch sessions
 */
export function useBatchSessions() {
  return useQuery({
    queryKey: ['batch-sessions'],
    queryFn: async () => {
      const response = await fetch('/api/batch/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch batch sessions');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to fetch batch sessions');
      }

      return result.data;
    }
  });
}

/**
 * Combined hook for full batch analysis workflow
 */
export function useBatchAnalysis() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const startBatch = useStartBatch();
  const { data: status, isLoading: statusLoading } = useBatchStatus(sessionId, autoRefresh);
  const pauseBatch = usePauseBatch();
  const resumeBatch = useResumeBatch();
  const { data: results } = useBatchResults(sessionId);

  // Stop auto-refresh when batch is completed or failed
  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'failed') {
      setAutoRefresh(false);
    }
  }, [status?.status]);

  // Console logging for debugging
  useEffect(() => {
    if (status) {
      console.log('[BATCH]', {
        progress: `${status.progress.completed}/${status.progress.total}`,
        successful: status.progress.successful,
        failed: status.progress.failed,
        status: status.status,
        percentage: `${status.progress.percentage}%`
      });

      // Log current puzzle being analyzed
      const currentPuzzle = status.results.find(r => r.status === 'analyzing');
      if (currentPuzzle) {
        console.log('[BATCH] ⚡ Currently analyzing:', currentPuzzle.puzzleId);
      }

      // Log last activity entry
      if (status.activityLog && status.activityLog.length > 0) {
        const lastActivity = status.activityLog[status.activityLog.length - 1];
        console.log('[BATCH] Latest:', lastActivity.message);
      }
    }
  }, [status]);

  const handleStart = async (request: BatchStartRequest) => {
    const result = await startBatch.mutateAsync(request);
    setSessionId(result.sessionId);
    setAutoRefresh(true);
    return result;
  };

  const handlePause = async () => {
    if (sessionId) {
      await pauseBatch.mutateAsync(sessionId);
    }
  };

  const handleResume = async () => {
    if (sessionId) {
      await resumeBatch.mutateAsync(sessionId);
      setAutoRefresh(true);
    }
  };

  const handleCancel = () => {
    setSessionId(null);
    setAutoRefresh(false);
  };

  return {
    sessionId,
    status,
    results,
    isLoading: statusLoading || startBatch.isPending,
    isPaused: status?.isPaused ?? false,
    isRunning: status?.status === 'running' || status?.status === 'paused',
    handleStart,
    handlePause,
    handleResume,
    handleCancel
  };
}
