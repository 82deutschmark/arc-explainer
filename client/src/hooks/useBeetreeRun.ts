/**
 * Author: Cascade
 * Date: 2025-12-01
 * PURPOSE: React hook for managing Beetree ensemble solver runs with SSE streaming
 * SRP/DRY check: Pass - Centralizes Beetree run logic and state management
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface BeetreeRunOptions {
  taskId: string;
  testIndex: number;
  mode: 'testing' | 'production';
  runTimestamp: string;
}

export interface BeetreeProgress {
  stage: string;
  status: string;
  outcome?: string;
  event?: string;
  predictions?: number[][][];
  costSoFar?: number;
  tokensUsed?: {
    input: number;
    output: number;
    reasoning: number;
    total: number;
  };
  timestamp: number;
}

export interface BeetreeCost {
  total_cost: number;
  by_model: Array<{
    model_name: string;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cost: number;
    calls?: number;
  }>;
  by_stage: Array<{
    stage: string;
    cost: number;
    duration_ms: number;
  }>;
  total_tokens: {
    input: number;
    output: number;
    reasoning: number;
  };
}

export interface BeetreeResults {
  taskId: string;
  testIndex: number;
  mode: string;
  runTimestamp: string;
  predictions: number[][][];
  costBreakdown: BeetreeCost;
  verboseLog: string;
  consensus: {
    strength: number;
    diversity_score: number;
    agreement_count: number;
  };
  orchestration: {
    total_stages: number;
    completed_stages: number;
    current_stage: string;
    stage_results: Array<{
      stage: string;
      status: string;
      duration_ms: number;
      models_completed: number;
      models_total: number;
    }>;
  };
}

export interface BeetreeRunState {
  run: string | null;
  status: 'idle' | 'starting' | 'running' | 'completed' | 'error' | 'cancelled';
  progress: BeetreeProgress[];
  results: BeetreeResults | null;
  cost: BeetreeCost | null;
  error: string | null;
  isLoading: boolean;
  isConnected: boolean;
}

export const useBeetreeRun = () => {
  // State
  const [state, setState] = useState<BeetreeRunState>({
    run: null,
    status: 'idle',
    progress: [],
    results: null,
    cost: null,
    error: null,
    isLoading: false,
    isConnected: false
  });

  // Refs for SSE connection
  const eventSourceRef = useRef<EventSource | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Generate unique session ID
  const generateSessionId = useCallback(() => {
    return `beetree_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Handle SSE events
  const handleSSEEvent = useCallback((event: MessageEvent, fallbackType?: string) => {
    try {
      const parsed = event.data ? JSON.parse(event.data) : {};
      const eventType = (parsed?.type as string) || fallbackType || 'message';
      const data = { ...parsed, type: eventType };
      
      setState(prev => {
        switch (eventType) {
          case 'stream.init':
            return {
              ...prev,
              run: data.sessionId || prev.run,
              status: prev.status === 'starting' ? 'running' : prev.status,
              isConnected: true
            };

          case 'stream_start':
            return {
              ...prev,
              status: 'running',
              isConnected: true,
              progress: []
            };

          case 'puzzle_validated':
            return {
              ...prev,
              progress: [...prev.progress, {
                stage: 'Validation',
                status: 'Validated',
                outcome: 'success',
                timestamp: Date.now()
              }]
            };

          case 'solver_start':
            return {
              ...prev,
              progress: [...prev.progress, {
                stage: data.stage || 'Starting',
                status: 'Running',
                timestamp: Date.now()
              }]
            };

          case 'solver_progress':
            const newProgress: BeetreeProgress = {
              stage: data.stage || 'Processing',
              status: data.status || 'In Progress',
              outcome: data.outcome,
              event: data.event,
              predictions: data.predictions,
              costSoFar: data.costSoFar,
              tokensUsed: data.tokensUsed,
              timestamp: Date.now()
            };
            
            // Update cost if costSoFar is provided
            let updatedCost = prev.cost;
            if (data.costSoFar && prev.cost) {
              updatedCost = {
                ...prev.cost,
                total_cost: data.costSoFar,
                total_tokens: data.tokensUsed || prev.cost.total_tokens
              };
            }
            
            return {
              ...prev,
              progress: [...prev.progress, newProgress],
              cost: updatedCost
            };

          case 'solver_log':
            return {
              ...prev,
              progress: [...prev.progress, {
                stage: 'Log',
                status: data.level || 'info',
                event: data.message,
                timestamp: Date.now()
              }]
            };

          case 'solver_complete':
            return {
              ...prev,
              status: 'completed',
              results: data.result,
              cost: data.result?.costBreakdown || prev.cost,
              progress: [...prev.progress, {
                stage: 'Complete',
                status: 'Success',
                outcome: 'success',
                timestamp: Date.now()
              }]
            };

          case 'solver_error':
          case 'stream_error':
            return {
              ...prev,
              status: 'error',
              error: data.message || 'Unknown error occurred',
              progress: [...prev.progress, {
                stage: 'Error',
                status: 'Error',
                event: data.message,
                timestamp: Date.now()
              }]
            };

          case 'stream_cancelled':
            return {
              ...prev,
              status: 'cancelled',
              progress: [...prev.progress, {
                stage: 'Cancelled',
                status: 'Cancelled',
                timestamp: Date.now()
              }]
            };

          case 'stream_complete':
          case 'stream.end':
            return {
              ...prev,
              isConnected: false,
              status: prev.status === 'error' ? prev.status : 'completed'
            };

          default:
            return prev;
        }
      });
    } catch (error) {
      console.error('Error parsing SSE event:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Failed to process server event'
      }));
    }
  }, []);

  const registerSSEListeners = useCallback((eventSource: EventSource) => {
    const beetreeEvents = [
      'stream.init',
      'stream_start',
      'puzzle_validated',
      'solver_start',
      'solver_progress',
      'solver_log',
      'solver_complete',
      'solver_error',
      'stream_error',
      'stream_cancelled',
      'stream_complete',
      'stream.end'
    ];

    beetreeEvents.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => handleSSEEvent(event as MessageEvent, eventType));
    });

    // Fallback handler for unnamed events
    eventSource.addEventListener('message', (event) => handleSSEEvent(event as MessageEvent));
  }, [handleSSEEvent]);

  // Start analysis
  const startAnalysis = useCallback(async (options: BeetreeRunOptions) => {
    try {
      setState(prev => ({
        ...prev,
        status: 'starting',
        isLoading: true,
        error: null,
        results: null,
        progress: []
      }));

      const sessionId = generateSessionId();
      sessionIdRef.current = sessionId;

      // Start the analysis
      const response = await fetch('/api/beetree/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options,
          sessionId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start analysis: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to start analysis');
      }

      // Use server-provided sessionId for SSE connection
      const serverSessionId = result.sessionId || sessionId;
      const normalizedSessionId = serverSessionId.replace(/^beetree[-_]+/i, '');
      sessionIdRef.current = normalizedSessionId;
      console.log(`[useBeetreeRun] Server session ID: ${serverSessionId}`);
      if (normalizedSessionId !== serverSessionId) {
        console.log(`[useBeetreeRun] Normalized session ID for SSE: ${normalizedSessionId}`);
      }

      // Set up SSE connection using the server's sessionId
      const sseUrl = `/api/stream/analyze/beetree-${normalizedSessionId}`;
      console.log(`[useBeetreeRun] Connecting to SSE URL: ${sseUrl}`);
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      registerSSEListeners(eventSource);
      eventSource.onerror = () => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          status: prev.status === 'running' ? 'error' : prev.status,
          error: prev.error || 'Connection lost'
        }));
        eventSource.close();
      };

      eventSource.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true
        }));
      };

      setState(prev => ({
        ...prev,
        run: normalizedSessionId,
        status: 'running',
        isLoading: false
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start analysis',
        isLoading: false
      }));
    }
  }, [generateSessionId, registerSSEListeners]);

  // Cancel analysis
  const cancelAnalysis = useCallback(async () => {
    try {
      if (sessionIdRef.current) {
        await fetch(`/api/beetree/cancel/${sessionIdRef.current}`, {
          method: 'POST'
        });
      }
    } catch (error) {
      console.error('Failed to cancel analysis:', error);
    } finally {
      closeConnection();
      setState(prev => ({
        ...prev,
        status: 'cancelled',
        isLoading: false
      }));
    }
  }, []);

  // Close SSE connection
  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    sessionIdRef.current = null;
    setState(prev => ({
      ...prev,
      isConnected: false
    }));
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    closeConnection();
    setState({
      run: null,
      status: 'idle',
      progress: [],
      results: null,
      cost: null,
      error: null,
      isLoading: false,
      isConnected: false
    });
  }, [closeConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeConnection();
    };
  }, [closeConnection]);

  return {
    run: state.run,
    status: state.status,
    progress: state.progress,
    results: state.results,
    cost: state.cost,
    error: state.error,
    isLoading: state.isLoading,
    isConnected: state.isConnected,
    startAnalysis,
    cancelAnalysis,
    clearResults
  };
};
