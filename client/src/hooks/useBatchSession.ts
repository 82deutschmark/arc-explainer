/**
 * useBatchSession.ts
 * 
 * Consolidated custom hook for batch analysis session state management.
 * Replaces and improves upon useBatchAnalysis with better organization and state handling.
 * Focuses on session lifecycle, progress tracking, and result management.
 * 
 * @author Claude Code (Phase 4 refactor)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface BatchSessionConfig {
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

export interface BatchProgress {
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
  startTime?: number;
  endTime?: number;
}

export interface BatchResult {
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

export interface BatchSessionState {
  sessionId: string | null;
  progress: BatchProgress | null;
  results: BatchResult[];
  error: string | null;
  isLoading: boolean;
  startupStatus: string | null;
}

export function useBatchSession() {
  // Core session state
  const [state, setState] = useState<BatchSessionState>({
    sessionId: null,
    progress: null,
    results: [],
    error: null,
    isLoading: false,
    startupStatus: null
  });

  // Polling intervals
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);
  const resultsPollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Update state helper
  const updateState = useCallback((updates: Partial<BatchSessionState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Start progress polling
  const startProgressPolling = useCallback((sessionId: string) => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }

    pollingInterval.current = setInterval(async () => {
      try {
        const response = await apiRequest('GET', `/api/model/batch-status/${sessionId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data?.data) {
            updateState({ progress: data.data });
            
            // Stop polling if session is complete
            if (['completed', 'cancelled', 'error'].includes(data.data.status)) {
              if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
                pollingInterval.current = null;
              }
            }
          }
        } else {
          console.error(`Failed to fetch batch status: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error polling batch status:', error);
      }
    }, 2000);
  }, [updateState]);

  // Start results polling
  const startResultsPolling = useCallback((sessionId: string) => {
    if (resultsPollingInterval.current) {
      clearInterval(resultsPollingInterval.current);
    }

    resultsPollingInterval.current = setInterval(async () => {
      try {
        const response = await apiRequest('GET', `/api/model/batch-results/${sessionId}?limit=100`);
        
        if (response.ok) {
          const data = await response.json();
          const newResults = data.data?.results || data.data || [];
          updateState({ results: newResults });
        } else {
          console.error(`Failed to fetch batch results: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error('Error polling batch results:', error);
      }
    }, 2000);
  }, [updateState]);

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

  // Session lifecycle methods
  const createSession = useCallback(async (config: BatchSessionConfig) => {
    updateState({ 
      isLoading: true, 
      error: null, 
      startupStatus: '🔄 Initializing batch analysis session...' 
    });

    try {
      updateState({ startupStatus: '📡 Sending API request to server...' });

      const response = await apiRequest('POST', '/api/model/batch-analyze', config);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || errorData.message || 'Failed to start batch analysis');
      }

      const data = await response.json();
      const newSessionId = data.data?.sessionId || data.sessionId;
      
      if (!newSessionId) {
        throw new Error('No session ID returned from API');
      }

      updateState({ 
        sessionId: newSessionId, 
        results: [],
        startupStatus: '🚀 Starting puzzle processing pipeline...' 
      });
      
      // Start monitoring
      startProgressPolling(newSessionId);
      startResultsPolling(newSessionId);
      
      updateState({ 
        startupStatus: '✅ Batch analysis fully initialized - monitoring active' 
      });
      
      setTimeout(() => updateState({ startupStatus: null }), 3000);

      return { success: true, sessionId: newSessionId };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      updateState({ 
        error: errorMessage, 
        startupStatus: `❌ Failed: ${errorMessage}` 
      });
      
      setTimeout(() => updateState({ startupStatus: null }), 5000);
      return { success: false, error: errorMessage };
      
    } finally {
      updateState({ isLoading: false });
    }
  }, [startProgressPolling, startResultsPolling, updateState]);

  // Session control methods
  const controlSession = useCallback(async (action: 'pause' | 'resume' | 'cancel') => {
    if (!state.sessionId) {
      return { success: false, error: 'No active session' };
    }

    try {
      const response = await apiRequest('POST', `/api/model/batch-control/${state.sessionId}`, {
        action
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || `Failed to ${action} analysis`);
      }

      // Handle specific actions
      if (action === 'resume') {
        startProgressPolling(state.sessionId);
        startResultsPolling(state.sessionId);
      } else if (action === 'cancel') {
        stopPolling();
      }

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${action} analysis`;
      updateState({ error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [state.sessionId, startProgressPolling, startResultsPolling, stopPolling, updateState]);

  // Convenience methods for session control
  const pauseSession = useCallback(() => controlSession('pause'), [controlSession]);
  const resumeSession = useCallback(() => controlSession('resume'), [controlSession]);
  const cancelSession = useCallback(() => controlSession('cancel'), [controlSession]);

  // Clear session (reset to initial state)
  const clearSession = useCallback(() => {
    stopPolling();
    setState({
      sessionId: null,
      progress: null,
      results: [],
      error: null,
      isLoading: false,
      startupStatus: null
    });
  }, [stopPolling]);

  // Get detailed results with pagination
  const getDetailedResults = useCallback(async (options?: {
    limit?: number;
    offset?: number;
    status?: string;
  }) => {
    if (!state.sessionId) {
      return { success: false, error: 'No active session' };
    }

    try {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.status) params.append('status', options.status);

      const response = await apiRequest('GET', `/api/model/batch-results/${state.sessionId}?${params.toString()}`);

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
  }, [state.sessionId]);

  // Manual refresh functions
  const refreshProgress = useCallback(() => {
    if (state.sessionId) {
      startProgressPolling(state.sessionId);
    }
  }, [state.sessionId, startProgressPolling]);

  const refreshResults = useCallback(() => {
    if (state.sessionId) {
      startResultsPolling(state.sessionId);
    }
  }, [state.sessionId, startResultsPolling]);

  // Computed properties
  const computedState = {
    isRunning: state.progress?.status === 'running',
    isCompleted: state.progress?.status === 'completed',
    isPaused: state.progress?.status === 'paused',
    isCancelled: state.progress?.status === 'cancelled',
    hasError: state.progress?.status === 'error' || !!state.error,
    progressPercentage: state.progress?.progress?.percentage || 0,
    hasActiveSession: !!state.sessionId,
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // Core state
    ...state,
    
    // Computed state
    ...computedState,
    
    // Session lifecycle
    createSession,
    clearSession,
    
    // Session control
    pauseSession,
    resumeSession,
    cancelSession,
    
    // Data access
    getDetailedResults,
    refreshProgress,
    refreshResults,
    
    // Legacy compatibility (for gradual migration)
    startAnalysis: createSession,
    pauseAnalysis: pauseSession,
    resumeAnalysis: resumeSession,
    cancelAnalysis: cancelSession
  };
}