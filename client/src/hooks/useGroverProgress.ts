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
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  reasoningVerbosity?: 'low' | 'medium' | 'high';
  reasoningSummaryType?: 'auto' | 'detailed';
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
  streamingStatus?: 'idle' | 'starting' | 'in_progress' | 'completed' | 'failed';
  streamingText?: string;
  streamingReasoning?: string;
  streamingMessage?: string;
  streamingTokenUsage?: {
    input?: number;
    output?: number;
    reasoning?: number;
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
  const sseRef = useRef<EventSource | null>(null);
  const streamingEnabled = import.meta.env.VITE_ENABLE_SSE_STREAMING === 'true';

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  const closeEventSource = useCallback(() => {
    if (sseRef.current) {
      try { sseRef.current.close(); } catch {}
      sseRef.current = null;
    }
  }, []);


  const start = useCallback(async (options?: GroverOptions) => {
    if (!taskId) return;

    closeSocket();
    closeEventSource();

    // Reset state
    setState({
      status: 'running',
      phase: 'initializing',
      iteration: 0,
      totalIterations: options?.maxIterations || 5,
      iterations: [],
      logLines: [],
      streamingStatus: streamingEnabled ? 'starting' : 'idle',
      streamingText: undefined,
      streamingReasoning: undefined,
      streamingMessage: undefined,
    });
    setSessionId(null);

    const modelKey = options?.modelKey || 'grover-gpt-5-nano';

    // SSE STREAMING PATH (when VITE_ENABLE_SSE_STREAMING === 'true')
    if (streamingEnabled) {
      const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) || '';
      const apiUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      const query = new URLSearchParams();
      query.set('temperature', String(options?.temperature ?? 0.2));
      query.set('maxIterations', String(options?.maxIterations ?? 5));
      if (options?.previousResponseId) query.set('previousResponseId', options.previousResponseId);
      if (options?.reasoningEffort) query.set('reasoningEffort', options.reasoningEffort);
      if (options?.reasoningVerbosity) query.set('reasoningVerbosity', options.reasoningVerbosity);
      if (options?.reasoningSummaryType) query.set('reasoningSummaryType', options.reasoningSummaryType);

      const streamUrl = `${apiUrl}/api/stream/grover/${taskId}/${encodeURIComponent(modelKey)}${
        query.toString() ? `?${query.toString()}` : ''
      }`;

      const eventSource = new EventSource(streamUrl);
      sseRef.current = eventSource;

      eventSource.addEventListener('stream.init', (evt) => {
        try {
          const payload = JSON.parse((evt as MessageEvent<string>).data) as {
            sessionId: string;
            taskId: string;
            modelKey: string;
            createdAt: string;
          };
          setSessionId(payload.sessionId);
          setState((prev) => {
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            nextLogs.push(`🔬 Grover Iterative Solver initialized`);
            nextLogs.push(`Session: ${payload.sessionId}`);
            nextLogs.push(`Task: ${payload.taskId}`);
            nextLogs.push(`Model: ${payload.modelKey}`);
            nextLogs.push(`Started at: ${new Date(payload.createdAt).toLocaleTimeString()}`);
            nextLogs.push('---');

            return {
              ...prev,
              streamingStatus: 'in_progress',
              status: 'running',
              logLines: nextLogs,
            };
          });
        } catch (error) {
          console.error('[GroverStream] Failed to parse init payload:', error);
        }
      });

      eventSource.addEventListener('stream.status', (evt) => {
        try {
          const status = JSON.parse((evt as MessageEvent<string>).data) as {
            state?: string;
            phase?: string;
            message?: string;
            iteration?: number;
            totalIterations?: number;
            progress?: number;
          };
          setState((prev) => {
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            if (status.message && typeof status.message === 'string') {
              nextLogs.push(status.message);
              if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
            }

            return {
              ...prev,
              streamingStatus: status.state === 'in_progress' ? 'in_progress' : (status.state === 'failed' ? 'failed' : prev.streamingStatus),
              streamingPhase: status.phase ?? prev.phase,
              streamingMessage: status.message ?? prev.streamingMessage,
              status: status.state === 'failed' ? 'error' : prev.status,
              phase: status.phase ?? prev.phase,
              iteration: status.iteration ?? prev.iteration,
              totalIterations: status.totalIterations ?? prev.totalIterations,
              progress: status.progress ?? prev.progress,
              logLines: nextLogs,
            };
          });
        } catch (error) {
          console.error('[GroverStream] Failed to parse status payload:', error);
        }
      });

      eventSource.addEventListener('stream.chunk', (evt) => {
        try {
          const chunk = JSON.parse((evt as MessageEvent<string>).data) as {
            type?: string;
            delta?: string;
            content?: string;
            metadata?: { iteration?: number; phase?: string };
          };
          setState((prev) => {
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            const chunkText = chunk.delta ?? chunk.content;
            if (chunk.type === 'text' && chunkText) {
              const lines = chunkText.split('\n').filter(line => line.trim());
              lines.forEach(line => {
                nextLogs.push(line);
              });
              if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
            }

            return {
              ...prev,
              streamingText:
                chunk.type === 'text'
                  ? (prev.streamingText ?? '') + (chunk.delta ?? chunk.content ?? '')
                  : prev.streamingText,
              streamingReasoning:
                chunk.type === 'reasoning'
                  ? (prev.streamingReasoning ?? '') + (chunk.delta ?? chunk.content ?? '')
                  : prev.streamingReasoning,
              logLines: nextLogs,
            };
          });
        } catch (error) {
          console.error('[GroverStream] Failed to parse chunk payload:', error);
        }
      });

      eventSource.addEventListener('stream.complete', (evt) => {
        try {
          const summary = JSON.parse((evt as MessageEvent<string>).data) as {
            responseSummary?: { analysis?: any };
            metadata?: {
              tokenUsage?: { input?: number; output?: number; reasoning?: number };
              bestScore?: number;
              iterations?: any[];
              bestProgram?: string;
            };
            status?: string;
          };
          setState((prev) => {
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            nextLogs.push('---');
            nextLogs.push(`✅ Grover analysis complete`);
            if (summary.metadata?.bestScore !== undefined) {
              nextLogs.push(`Best score: ${summary.metadata.bestScore.toFixed(1)}/10`);
            }

            return {
              ...prev,
              status: 'completed',
              streamingStatus: 'completed',
              result: summary.responseSummary?.analysis ?? summary,
              iterations: summary.metadata?.iterations ?? prev.iterations,
              bestProgram: summary.metadata?.bestProgram ?? prev.bestProgram,
              bestScore: summary.metadata?.bestScore ?? prev.bestScore,
              streamingTokenUsage: summary.metadata?.tokenUsage,
              logLines: nextLogs,
            };
          });
        } catch (error) {
          console.error('[GroverStream] Failed to parse completion payload:', error);
          setState((prev) => ({
            ...prev,
            status: 'error',
            streamingStatus: 'failed',
            streamingMessage: 'Streaming completion parse error',
          }));
        } finally {
          closeEventSource();
        }
      });

      eventSource.addEventListener('stream.error', (evt) => {
        try {
          const payload = JSON.parse((evt as MessageEvent<string>).data) as {
            message?: string;
            code?: string;
          };
          setState((prev) => {
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            const errorMsg = payload.message ?? 'Streaming error';
            nextLogs.push(`❌ ERROR: ${errorMsg}`);
            if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);

            return {
              ...prev,
              status: 'error',
              streamingStatus: 'failed',
              streamingMessage: errorMsg,
              logLines: nextLogs,
            };
          });
        } catch (error) {
          console.error('[GroverStream] Failed to parse error payload:', error);
        } finally {
          closeEventSource();
        }
      });

      eventSource.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          streamingStatus: 'failed',
          streamingMessage: 'Streaming connection lost',
        }));
        closeEventSource();
      };

      return; // Exit early - SSE path complete
    }

    // LEGACY WEBSOCKET PATH (when streaming is disabled)
    const wireOptions = {
      temperature: options?.temperature ?? 0.2,
      maxIterations: options?.maxIterations ?? 5,
      ...(options?.previousResponseId && { previousResponseId: options.previousResponseId }),
      ...(options?.reasoningEffort && { reasoningEffort: options.reasoningEffort }),
      ...(options?.reasoningVerbosity && { reasoningVerbosity: options.reasoningVerbosity }),
      ...(options?.reasoningSummaryType && { reasoningSummaryType: options.reasoningSummaryType }),
    };
    
    try {
      const res = await apiRequest('POST', `/api/puzzle/grover/${taskId}/${modelKey}`, wireOptions);
      const json = await res.json();
      const sid = json?.data?.sessionId as string | undefined;
      if (!sid) {
        throw new Error('Grover session did not return a sessionId');
      }
      setSessionId(sid);

      // CRITICAL: Hydrate from snapshot immediately for instant progress display
      try {
        console.log('[GROVER] Fetching snapshot for sessionId:', sid);
        const snapshotRes = await apiRequest('GET', `/api/grover/status/${sid}`);
        const snapshotJson = await snapshotRes.json();
        const snapshot = snapshotJson?.data?.snapshot;
        if (snapshot && typeof snapshot === 'object') {
          console.log('[GROVER] Hydrating from snapshot after start:', snapshot);
          setState(prev => ({
            ...prev,
            ...snapshot,
            status: snapshot.status || prev.status,
            iteration: typeof snapshot.iteration === 'number' ? snapshot.iteration : prev.iteration,
            totalIterations: snapshot.totalIterations || prev.totalIterations,
            logLines: Array.isArray(snapshot.logLines) ? 
              [...snapshot.logLines, `[${new Date().toLocaleTimeString()}] Initial state loaded`] : 
              [`[${new Date().toLocaleTimeString()}] Initial state loaded`],
            iterations: Array.isArray(snapshot.iterations) ? snapshot.iterations : prev.iterations
          }));
        } else {
          console.warn('[GROVER] Snapshot empty after start:', snapshotJson);
        }
      } catch (snapshotErr) {
        console.error('[GROVER] Snapshot fetch failed:', snapshotErr);
      }

      // Open WebSocket (Grover uses same progress endpoint as Saturn)
      const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const isDev = import.meta.env.DEV;
      const wsHost = isDev ? 'localhost:5000' : location.host;
      const wsUrl = `${wsProtocol}://${wsHost}/api/grover/progress?sessionId=${encodeURIComponent(sid)}`;
      
      const sock = new WebSocket(wsUrl);
      wsRef.current = sock;

      sock.onopen = () => {
        console.log('[GROVER] WebSocket CONNECTED to:', wsUrl);
        setState(prev => ({
          ...prev,
          logLines: [...(prev.logLines || []), `[${new Date().toLocaleTimeString()}] WebSocket connected successfully`]
        }));
      };

      sock.onmessage = (evt) => {
        console.log('[GROVER] Received message:', evt.data.substring(0, 200));
        try {
          const payload = JSON.parse(evt.data);
          const data = payload?.data;
          if (!data) {
            console.warn('[GROVER] Message has no data, skipping');
            return;
          }

          setState((prev) => {
            console.log('[GROVER] Updating state - prev status:', prev.status, 'new phase:', data.phase);
            // Accumulate ALL log messages
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            const msg: string | undefined = typeof data.message === 'string' ? data.message : undefined;
            
            // Capture ALL messages - ALWAYS ADD (no deduplication check)
            // Each message has a unique timestamp, so duplicates are fine
            if (msg) {
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

            // CRITICAL FIX: Don't spread status from log-only messages
            // Only update status when explicitly changed (not for type: 'log' or phase: 'log')
            const isLogOnly = data.type === 'log' || data.phase === 'log';
            
            // If we're getting progress phases, clear error status
            const isProgressPhase = ['prompt_ready', 'waiting_llm', 'response_received', 'programs_extracted', 'execution', 'iteration_complete'].includes(data.phase);
            
            const newState = isLogOnly ? {
              ...prev,
              message: data.message || prev.message,
              logLines: nextLogs,
              iterations: nextIterations
            } : { 
              ...prev, 
              ...data,
              // If receiving progress phase, force status to running
              status: isProgressPhase ? 'running' : (data.status || prev.status),
              logLines: nextLogs,
              iterations: nextIterations
            };
            console.log('[GROVER] New state created - logs:', newState.logLines?.length, 'status:', newState.status);
            return newState;
          });
        } catch (error) {
          console.error('[GROVER] WebSocket parse error:', error);
        }
      };

      sock.onerror = (evt: Event) => {
        console.error('[GROVER] WebSocket ERROR - Failed to connect or unexpected error');
        console.error('  URL attempted:', wsUrl);
        console.error('  Event:', evt);
        setState((prev) => {
          if (prev.status !== 'running') return prev;
          const nextLogs = [...(prev.logLines ?? []), `WebSocket connection error: ${evt.type}`];
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

  // Poll snapshot on mount if sessionId exists (page reload mid-run)
  useEffect(() => {
    if (!sessionId) return;
    
    // Only fetch if state is empty/idle (page was reloaded)
    if (state.status !== 'idle' && state.iterations && state.iterations.length > 0) return;
    
    const fetchSnapshot = async () => {
      try {
        console.log('[GROVER] Fetching snapshot for sessionId:', sessionId);
        const snapshotRes = await apiRequest('GET', `/api/grover/status/${sessionId}`);
        const snapshotJson = await snapshotRes.json();
        const snapshot = snapshotJson?.data?.snapshot;
        if (snapshot && typeof snapshot === 'object') {
          console.log('[GROVER] Hydrating from snapshot:', snapshot);
          setState(prev => ({
            ...prev,
            ...snapshot,
            status: snapshot.status || prev.status,
            iteration: typeof snapshot.iteration === 'number' ? snapshot.iteration : prev.iteration,
            totalIterations: snapshot.totalIterations || prev.totalIterations,
            logLines: Array.isArray(snapshot.logLines) ? 
              [...snapshot.logLines, `[${new Date().toLocaleTimeString()}] State hydrated from snapshot`] : 
              [`[${new Date().toLocaleTimeString()}] State hydrated from snapshot`],
            iterations: Array.isArray(snapshot.iterations) ? snapshot.iterations : prev.iterations
          }));
        } else {
          console.warn('[GROVER] Snapshot is empty or invalid:', snapshotJson);
          setState(prev => ({
            ...prev,
            logLines: [...(prev.logLines || []), `[${new Date().toLocaleTimeString()}] Warning: Snapshot was empty, waiting for WebSocket updates...`]
          }));
        }
      } catch (snapshotErr) {
        console.error('[GROVER] Failed to fetch snapshot:', snapshotErr);
        setState(prev => ({
          ...prev,
          logLines: [...(prev.logLines || []), `[${new Date().toLocaleTimeString()}] Error fetching snapshot: ${snapshotErr}`]
        }));
      }
    };
    
    fetchSnapshot();
  }, [sessionId]); // Only depend on sessionId, not state
  const cancel = useCallback(async () => {
    if (!sessionId) {
      console.warn('[Grover] Cannot cancel: no active session');
      return;
    }

    try {
      await apiRequest('POST', `/api/stream/cancel/${sessionId}`);

      closeSocket();
      closeEventSource();

      setState(prev => ({
        ...prev,
        status: 'error',
        streamingStatus: 'failed',
        streamingMessage: 'Cancelled by user',
        message: 'Analysis cancelled by user',
        logLines: [...(prev.logLines || []), `[${new Date().toLocaleTimeString()}] ⚠️ Cancelled by user`]
      }));
    } catch (error) {
      console.error('[Grover] Cancel failed:', error);
    }
  }, [sessionId, closeSocket, closeEventSource]);

  useEffect(() => {
    return () => {
      closeSocket();
    };
  }, [closeSocket]);

  return { sessionId, state, start, cancel };
}
