/**
 * useBatchAnalysis.ts
 * 
 * Custom hook for managing batch analysis operations
 * Handles API communication, state management, and progress tracking
 * 
 * @author Claude Code Assistant
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface BatchConfig {
  modelKey: string;
  dataset: string;
  promptId?: string;
  customPrompt?: string;
  temperature?: number;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  batchSize?: number;
}

interface BatchProgress {
  sessionId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';
  progress: {
    total: number;
    completed: number;
    successful: number;
    failed: number;
    percentage: number;
  };
  stats: {
    averageProcessingTime: number;
    overallAccuracy: number;
    eta: number;
  };
}

interface BatchResult {
  id: number;
  session_id: string;
  puzzle_id: string;
  status: 'pending' | 'completed' | 'failed';
  explanation_id?: number;
  processing_time_ms?: number;
  accuracy_score?: number;
  is_correct?: boolean;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export function useBatchAnalysis() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const resultsPollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Start progress polling
  const startPolling = useCallback((id: string) => {
    // Clear any existing polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    // Poll for progress updates every 2 seconds
    pollingInterval.current = setInterval(async () => {
      try {
        console.log(`🔄 Polling batch status for session: ${id}`);
        const response = await apiRequest('GET', `/api/model/batch-status/${id}`);
        console.log(`📡 Batch status response:`, { 
          ok: response.ok, 
          status: response.status,
          statusText: response.statusText 
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`📊 Batch progress data received:`, data);
          
          // Validate response structure
          if (data && data.data) {
            setProgress(data.data);
            console.log(`✅ Progress state updated:`, data.data.status, `${data.data.progress?.percentage || 0}%`);
            
            // Stop polling if session is complete
            if (['completed', 'cancelled', 'error'].includes(data.data.status)) {
              console.log(`🏁 Session ${data.data.status}, stopping progress polling`);
              if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
              }
            }
          } else {
            console.warn('⚠️ Invalid batch status response structure:', data);
          }
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch batch status: ${response.status} ${response.statusText}`, errorText);
        }
      } catch (error) {
        console.error('💥 Error polling batch status:', error);
      }
    }, 2000);
  }, []);

  // Start results polling
  const startResultsPolling = useCallback((id: string) => {
    // Clear any existing polling
    if (resultsPollingInterval.current) {
      clearInterval(resultsPollingInterval.current);
    }

    // Poll for results updates every 5 seconds
    resultsPollingInterval.current = setInterval(async () => {
      try {
        console.log(`📝 Polling batch results for session: ${id}`);
        const response = await apiRequest('GET', `/api/model/batch-results/${id}?limit=50&status=completed`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`📋 Batch results data received:`, data);
          const results = data.data?.results || data.data || [];
          console.log(`✅ Setting ${results.length} results`);
          setResults(results);
        } else {
          const errorText = await response.text();
          console.error(`❌ Failed to fetch batch results: ${response.status} ${response.statusText}`, errorText);
        }
      } catch (error) {
        console.error('💥 Error polling batch results:', error);
      }
    }, 5000);
  }, []);

  // Stop all polling
  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
    if (resultsPollingInterval.current) {
      clearInterval(resultsPollingInterval.current);
      resultsPollingInterval.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Start batch analysis
  const startAnalysis = useCallback(async (config: BatchConfig) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Starting batch analysis with config:', config);

      const response = await apiRequest('POST', '/api/model/batch-analyze', config);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start batch analysis');
      }

      const data = await response.json();
      const newSessionId = data.data.sessionId;

      console.log('Batch analysis started:', newSessionId);

      setSessionId(newSessionId);
      setResults([]);
      
      // Start polling for progress and results
      startPolling(newSessionId);
      startResultsPolling(newSessionId);

      return { success: true, sessionId: newSessionId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error starting batch analysis:', errorMessage);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  }, [startPolling, startResultsPolling]);

  // Pause analysis
  const pauseAnalysis = useCallback(async () => {
    if (!sessionId) return { success: false, error: 'No active session' };

    try {
      const response = await apiRequest('POST', `/api/model/batch-control/${sessionId}`, {
        action: 'pause'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to pause analysis');
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pause analysis';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [sessionId]);

  // Resume analysis
  const resumeAnalysis = useCallback(async () => {
    if (!sessionId) return { success: false, error: 'No active session' };

    try {
      const response = await apiRequest('POST', `/api/model/batch-control/${sessionId}`, {
        action: 'resume'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume analysis');
      }

      // Restart polling if needed
      startPolling(sessionId);
      startResultsPolling(sessionId);

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resume analysis';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [sessionId, startPolling, startResultsPolling]);

  // Cancel analysis
  const cancelAnalysis = useCallback(async () => {
    if (!sessionId) return { success: false, error: 'No active session' };

    try {
      const response = await apiRequest('POST', `/api/model/batch-control/${sessionId}`, {
        action: 'cancel'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel analysis');
      }

      stopPolling();
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel analysis';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [sessionId, stopPolling]);

  // Clear session (reset to initial state)
  const clearSession = useCallback(() => {
    stopPolling();
    setSessionId(null);
    setProgress(null);
    setResults([]);
    setError(null);
  }, [stopPolling]);

  // Get detailed results
  const getDetailedResults = useCallback(async (limit?: number, offset?: number, status?: string) => {
    if (!sessionId) return { success: false, error: 'No active session' };

    try {
      const params = new URLSearchParams();
      if (limit) params.append('limit', limit.toString());
      if (offset) params.append('offset', offset.toString());
      if (status) params.append('status', status);

      const response = await apiRequest('GET', `/api/model/batch-results/${sessionId}?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch results');
      }

      const data = await response.json();
      return { success: true, data: data.data };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch results';
      return { success: false, error: errorMessage };
    }
  }, [sessionId]);

  // Computed properties
  const isRunning = progress?.status === 'running';
  const isCompleted = progress?.status === 'completed';
  const isPaused = progress?.status === 'paused';
  const isCancelled = progress?.status === 'cancelled';
  const hasError = progress?.status === 'error' || !!error;

  // Progress percentage for UI
  const progressPercentage = progress?.progress?.percentage || 0;

  return {
    // State
    sessionId,
    progress,
    results,
    error,
    isLoading,

    // Computed
    isRunning,
    isCompleted,
    isPaused,
    isCancelled,
    hasError,
    progressPercentage,

    // Actions
    startAnalysis,
    pauseAnalysis,
    resumeAnalysis,
    cancelAnalysis,
    clearSession,
    getDetailedResults,

    // Manual refresh functions
    refreshProgress: sessionId ? () => startPolling(sessionId) : () => {},
    refreshResults: sessionId ? () => startResultsPolling(sessionId) : () => {}
  };
}