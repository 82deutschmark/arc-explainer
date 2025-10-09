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
  promptPreview?: string;
  conversationChain?: string | null;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  executionSummary?: {
    total: number;
    successful: number;
    failed: number;
    scores: number[];
  };
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
    setSessionId(null);

    const wireOptions = {
      temperature: options?.temperature ?? 0.2,
      maxIterations: options?.maxIterations ?? 5,
      ...(options?.previousResponseId && { previousResponseId: options.previousResponseId })
    };

    const modelKey = options?.modelKey || 'grover-gpt-5-nano';
    
    try {
      const res = await apiRequest('POST', `/api/puzzle/grover/${taskId}/${modelKey}`, wireOptions);
      const json = await res.json();
      const sid = json?.data?.sessionId as string | undefined;
      if (!sid) {
        throw new Error('Grover session did not return a sessionId');
      }
      setSessionId(sid);

      // Open WebSocket (Grover uses same progress endpoint as Saturn)
      const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const isDev = import.meta.env.DEV;
      const wsHost = isDev ? 'localhost:5000' : location.host;
      const wsUrl = `${wsProtocol}://${wsHost}/api/grover/progress?sessionId=${encodeURIComponent(sid)}`;
      
      const sock = new WebSocket(wsUrl);
      wsRef.current = sock;

      sock.onopen = () => {
        console.log('[GROVER] WebSocket CONNECTED to:', wsUrl);
      };

      sock.onmessage = (evt) => {
        console.log('[GROVER] Received message:', evt.data.substring(0, 200));
        try {
          const payload = JSON.parse(evt.data);
          const data = payload?.data;
          if (!data) return;

          setState((prev) => {
            // Accumulate ALL log messages
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            const msg: string | undefined = typeof data.message === 'string' ? data.message : undefined;
            
            // Capture ALL messages (not just specific phases)
            if (msg && !nextLogs.includes(msg)) {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] ${msg}`);
              if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
            }

            // CRITICAL: Show prompt payload when sent
            if (data.promptPreview && data.phase === 'prompt_ready') {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] ━━━━━━━━━━ PROMPT PAYLOAD (${data.promptLength || data.promptPreview.length} chars) ━━━━━━━━━━`);
              nextLogs.push(data.promptPreview);
              nextLogs.push(`[${timestamp}] ━━━━━━━━━━ END PROMPT ━━━━━━━━━━`);
              if (data.conversationChain) {
                nextLogs.push(`[${timestamp}] 🔗 Conversation Chain: ${data.conversationChain}`);
              }
            }

            // Show token usage when response received
            if (data.tokenUsage && data.phase === 'response_received') {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] 📊 Token Usage: Input=${data.tokenUsage.input} Output=${data.tokenUsage.output} Total=${data.tokenUsage.total}`);
              if (data.responseId) {
                nextLogs.push(`[${timestamp}] 🆔 Response ID: ${data.responseId}`);
              }
            }

            // Show programs extracted
            if (data.programsExtracted && Array.isArray(data.programsExtracted)) {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] 📝 Extracted ${data.programsExtracted.length} programs:`);
              data.programsExtracted.forEach((prog: any, idx: number) => {
                nextLogs.push(`[${timestamp}]   Program ${idx + 1}: ${prog.lines} lines`);
              });
            }

            // Show execution summary
            if (data.executionSummary) {
              const timestamp = new Date().toLocaleTimeString();
              const sum = data.executionSummary;
              nextLogs.push(`[${timestamp}] 🐍 Execution Results: ${sum.successful}/${sum.total} successful, ${sum.failed} failed`);
              if (sum.scores && sum.scores.length > 0) {
                const scores = sum.scores.map((s: number) => s.toFixed(1)).join(', ');
                nextLogs.push(`[${timestamp}]    Scores: [${scores}]`);
              }
            }

            // Also capture phase changes as log entries
            if (data.phase && data.phase !== prev.phase && data.phase !== 'prompt_ready' && data.phase !== 'response_received') {
              const phaseMsg = `Phase: ${data.phase}`;
              if (!nextLogs.includes(phaseMsg)) {
                const timestamp = new Date().toLocaleTimeString();
                nextLogs.push(`[${timestamp}] ${phaseMsg}`);
              }
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

      sock.onerror = (event) => {
        console.error('[GROVER] WebSocket error:', event);
        setState((prev) => {
          if (prev.status !== 'running') return prev;
          const nextLogs = [...(prev.logLines ?? []), 'WebSocket connection error'];
          return {
            ...prev,
            status: 'error',
            phase: 'connection_error',
            message: 'WebSocket connection failed',
            logLines: nextLogs.slice(-500)
          };
        });
      };

      sock.onclose = (evt) => {
        console.log('[GROVER] WebSocket CLOSED - Code:', evt.code, 'Reason:', evt.reason || 'none');
        setState((prev) => {
          if (prev.status !== 'running') return prev;
          const reason = evt.reason || 'Grover progress connection closed unexpectedly';
          const nextLogs = [...(prev.logLines ?? []), reason];
          return {
            ...prev,
            status: 'error',
            phase: 'connection_closed',
            message: reason,
            logLines: nextLogs.slice(-500)
          };
        });
      };
    } catch (error) {
      console.error('[GROVER] Failed to start analysis:', error);
      setState((prev) => {
        const message = error instanceof Error ? error.message : String(error);
        const nextLogs = [...(prev.logLines ?? []), message];
        return {
          ...prev,
          status: 'error',
          phase: 'request_failed',
          message,
          logLines: nextLogs.slice(-500)
        };
      });
    }

  }, [taskId, closeSocket]);

  useEffect(() => {
    return () => {
      closeSocket();
    };
  }, [closeSocket]);

  return { sessionId, state, start };
}
