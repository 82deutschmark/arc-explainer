/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-26 - Added streaming fields like Saturn's hook, API key fallback support
 * PURPOSE: React hook for Poetiq solver progress tracking via WebSocket.
 *          Manages solver state, progress updates, and result handling.
 *          Uses same WebSocket connection pattern as Saturn and Grover solvers.
 *          Supports fallback to server API key when user key is missing/invalid.
 * 
 * SRP/DRY check: Pass - Single responsibility for Poetiq progress orchestration.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface PoetiqOptions {
  // BYO (Bring Your Own) API key - optional, falls back to server env vars
  apiKey?: string;
  provider?: 'gemini' | 'openrouter';
  
  // Model configuration
  model?: string;
  numExperts?: number;      // 1, 2, 4, or 8 (default: 2)
  maxIterations?: number;   // default: 10
  temperature?: number;     // default: 1.0
  reasoningEffort?: 'low' | 'medium' | 'high'; // Optional reasoning effort
}

export interface PoetiqProgressState {
  status: 'idle' | 'running' | 'completed' | 'error';
  phase?: string;
  iteration?: number;
  totalIterations?: number;
  message?: string;
  
  // Result fields
  result?: {
    success: boolean;
    isPredictionCorrect: boolean;
    accuracy?: number;
    iterationCount?: number;
    bestTrainScore?: number;
    generatedCode?: string;
    elapsedMs?: number;
    trainResults?: any[];
  };
  
  // Config
  config?: {
    model: string;
    maxIterations: number;
    numExperts: number;
    temperature: number;
  };
  
  // Streaming fields (like Saturn)
  streamingText?: string;
  streamingReasoning?: string;
  streamingCode?: string;
  logLines?: string[];
  
  // Fallback indicator
  usingFallback?: boolean;
}

const initialState: PoetiqProgressState = {
  status: 'idle',
  logLines: [],
};

/**
 * Hook for managing Poetiq solver progress
 */
export function usePoetiqProgress(taskId: string | undefined) {
  const [state, setState] = useState<PoetiqProgressState>(initialState);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Connect to WebSocket for progress updates
  // Uses same URL pattern as Saturn/Grover: /api/poetiq/progress?sessionId=...
  const connectWebSocket = useCallback((sid: string) => {
    // Close any existing connection first
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore cleanup errors
      }
      wsRef.current = null;
    }

    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const isDev = import.meta.env.DEV;
    const wsHost = isDev ? 'localhost:5000' : location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/api/poetiq/progress?sessionId=${encodeURIComponent(sid)}`;
    
    console.log('[Poetiq WS] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[Poetiq WS] Connected successfully');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        // Server sends { type: 'progress' | 'snapshot', data: {...} }
        const data = payload?.data;
        if (!data) return;
        
        setState(prev => {
          // Accumulate log lines
          const newLogLines = [...(prev.logLines || [])];
          if (data.message && data.message !== prev.message) {
            newLogLines.push(`[${new Date().toLocaleTimeString()}] ${data.message}`);
          }
          
          // Update streaming fields if present
          // Note: Poetiq sends full reasoning/code block for the current step
          const streamingReasoning = (prev.streamingReasoning || '') + (data.reasoning || '');
          const streamingCode = data.code || prev.streamingCode;
          
          // Track latest iteration result details if available
          const currentResult = prev.result || {
            success: false,
            isPredictionCorrect: false
          };
          
          // If we have new training results, update them
          if (data.trainResults) {
            currentResult.trainResults = data.trainResults;
          }
          
          return {
            ...prev,
            phase: data.phase || prev.phase,
            iteration: data.iteration ?? prev.iteration,
            totalIterations: data.totalIterations ?? prev.totalIterations,
            message: data.message || prev.message,
            status: data.status === 'completed' ? 'completed' 
                  : data.status === 'error' ? 'error' 
                  : 'running',
            result: data.result || currentResult,
            config: data.config || prev.config,
            usingFallback: data.usingFallback ?? prev.usingFallback,
            logLines: newLogLines,
            streamingReasoning,
            streamingCode,
            streamingText: data.message || prev.streamingText,
          };
        });

        if (data.status === 'completed' || data.status === 'error') {
          ws.close();
        }
      } catch (err) {
        console.error('[Poetiq WS] Parse error:', err);
      }
    };

    ws.onerror = (err) => {
      console.error('[Poetiq WS] Error:', err);
    };

    ws.onclose = (evt) => {
      console.log('[Poetiq WS] Connection closed:', evt.reason || 'No reason provided');
      wsRef.current = null;
    };
  }, []);

  // Start the solver
  const start = useCallback(async (options: PoetiqOptions = {}) => {
    if (!taskId) return;

    // Defaults: OpenRouter Gemini proxy, 2 experts (Gemini-3-b config)
    const provider = options.provider || 'openrouter';
    const model = options.model || (provider === 'openrouter' 
      ? 'openrouter/google/gemini-3-pro-preview' 
      : 'gemini/gemini-3-pro-preview');
    const numExperts = options.numExperts || 2;
    const maxIterations = options.maxIterations || 10;
    const temperature = options.temperature || 1.0;

    setState({
      status: 'running',
      phase: 'starting',
      message: `Initializing Poetiq solver with ${numExperts} expert(s)...`,
      config: {
        model,
        maxIterations,
        numExperts,
        temperature,
      },
    });

    try {
      const res = await apiRequest('POST', `/api/poetiq/solve/${taskId}`, {
        apiKey: options.apiKey,
        provider,
        model,
        numExperts,
        maxIterations,
        temperature,
      });
      const response = await res.json();

      if (response.success && response.data?.sessionId) {
        const sid = response.data.sessionId;
        setSessionId(sid);
        connectWebSocket(sid);
        
        // Also start polling as backup
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await apiRequest('GET', `/api/poetiq/status/${sid}`);
            const status = await statusRes.json();
            if (status.success && status.data?.snapshot) {
              const snap = status.data.snapshot;
              if (snap.status === 'completed' || snap.status === 'error') {
                setState(prev => ({
                  ...prev,
                  status: snap.status,
                  result: snap.result,
                  message: snap.message,
                }));
                if (pollingRef.current) {
                  clearInterval(pollingRef.current);
                  pollingRef.current = null;
                }
              }
            }
          } catch (err) {
            console.error('[Poetiq] Polling error:', err);
          }
        }, 5000);
      } else {
        setState({
          status: 'error',
          message: response.message || 'Failed to start solver',
        });
      }
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [taskId, connectWebSocket]);

  // Cancel the solver (not implemented yet)
  const cancel = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    setState({
      status: 'idle',
      message: 'Cancelled',
    });
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState(initialState);
    setSessionId(null);
  }, []);

  return {
    state,
    sessionId,
    start,
    cancel,
    reset,
  };
}
