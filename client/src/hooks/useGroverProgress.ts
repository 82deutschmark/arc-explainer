/**
 * client/src/hooks/useGroverProgress.ts
 * 
 * Author: Sonnet 4.5
 * Date: 2025-10-09
 * PURPOSE: Hook for managing Grover iterative solver analysis sessions.
 * Starts backend job, streams real-time iteration progress via WebSocket.
 * Shows code generation, execution results, and grading scores per iteration.
 * 
 * SRP/DRY check: Pass - Single responsibility (Grover progress management)
 * shadcn/ui: Pass - Hook only, no UI components
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface GroverOptions {
  modelKey?: string;
  temperature?: number;
  maxIterations?: number;
  previousResponseId?: string;
}

export interface GroverIteration {
  iteration: number;
  programs: string[];
  executionResults: {
    programIdx: number;
    score: number;
    code: string;
    error?: string;
  }[];
  best: {
    programIdx: number;
    score: number;
    code: string;
  };
  timestamp: number;
}

export interface GroverProgressState {
  status: 'idle' | 'running' | 'completed' | 'error';
  phase?: string;
  iteration?: number;
  totalIterations?: number;
  progress?: number;
  message?: string;
  result?: any;
  iterations?: GroverIteration[];
  bestProgram?: string;
  bestScore?: number;
  logLines?: string[];
}

export function useGroverProgress(taskId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<GroverProgressState>({ 
    status: 'idle',
    iterations: [],
    logLines: []
  });
  const wsRef = useRef<WebSocket | null>(null);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  const start = useCallback(async (options?: GroverOptions) => {
    if (!taskId) return;
    
    // Reset state
    setState({ 
      status: 'running', 
      phase: 'initializing',
      iteration: 0,
      totalIterations: options?.maxIterations || 5,
      iterations: [],
      logLines: []
    });
    closeSocket();

    const wireOptions = {
      temperature: options?.temperature ?? 0.2,
      maxIterations: options?.maxIterations ?? 5,
      ...(options?.previousResponseId && { previousResponseId: options.previousResponseId })
    };

    const modelKey = options?.modelKey || 'grover-gpt-5-nano';
    
    const res = await apiRequest('POST', `/api/puzzle/grover/${taskId}/${modelKey}`, wireOptions);
    const json = await res.json();
    const sid = json?.data?.sessionId as string;
    setSessionId(sid);

    // Open WebSocket (Grover uses same progress endpoint as Saturn)
    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const isDev = import.meta.env.DEV;
    const wsHost = isDev ? 'localhost:5000' : location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/api/grover/progress?sessionId=${encodeURIComponent(sid)}`;
    
    const sock = new WebSocket(wsUrl);
    wsRef.current = sock;

    sock.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const data = payload?.data;
        if (!data) return;

        setState((prev) => {
          // Accumulate log lines
          let nextLogs = prev.logLines ? [...prev.logLines] : [];
          const msg: string | undefined = typeof data.message === 'string' ? data.message : undefined;
          const phase = data.phase;
          const status = data.status;
          
          if (msg && (phase === 'log' || status === 'error' || status === 'completed' || phase === 'iteration')) {
            nextLogs.push(msg);
            if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
          }

          // Accumulate iterations
          let nextIterations = prev.iterations || [];
          if (data.iterations && Array.isArray(data.iterations)) {
            nextIterations = data.iterations;
          }

          return { 
            ...prev, 
            ...data,
            logLines: nextLogs,
            iterations: nextIterations
          };
        });
      } catch (error) {
        console.error('[GROVER] WebSocket parse error:', error);
      }
    };

    sock.onclose = () => {
      console.log('[GROVER] WebSocket closed');
    };

  }, [taskId, closeSocket]);

  useEffect(() => {
    return () => {
      closeSocket();
    };
  }, [closeSocket]);

  return { sessionId, state, start };
}
