/**
 * Author: gpt-5-codex
 * Date: 2025-10-17T00:00:00Z  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: React hook that manages Grover iterative solver progress using the restored
 * Responses API streaming contract. Mirrors the Saturn streaming lifecycle while
 * preserving the legacy WebSocket fallback for environments where streaming is disabled.
 * SRP/DRY check: Pass — single responsibility for Grover progress orchestration.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { isStreamingEnabled } from '@shared/config/streaming';

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
  promptLength?: number;
  promptModel?: string;
  promptGeneratedAt?: string;
  conversationChain?: string | null;
  promptError?: string;
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
  streamingPhase?: string;
  streamingMessage?: string;
  streamingText?: string;
  streamingReasoning?: string;
  streamingJson?: string;
  streamingRefusal?: string;
  streamingAnnotations?: Array<{
    annotation: unknown;
    metadata?: Record<string, unknown>;
    timestamp?: number;
  }>;
  streamingTokenUsage?: {
    input?: number;
    output?: number;
    reasoning?: number;
  };
}

interface GroverStreamStatusPayload {
  state?: GroverProgressState['streamingStatus'];
  phase?: string;
  message?: string;
  iteration?: number;
  totalIterations?: number;
  progress?: number;
  promptPreview?: string;
  promptLength?: number;
  promptModel?: string;
  promptId?: string;
  promptGeneratedAt?: string;
  conversationChain?: string | null;
  promptError?: string;
}

export function useGroverProgress(taskId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<GroverProgressState>({
    status: 'idle',
    iterations: [],
    logLines: [],
    streamingStatus: 'idle',
    streamingAnnotations: [],
  });
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const promptLoggedRef = useRef<string | null>(null);
  const streamingEnabled = import.meta.env.DEV ? true : isStreamingEnabled();

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore cleanup errors
      } finally {
        wsRef.current = null;
      }
    }
  }, []);

  const closeEventSource = useCallback(() => {
    if (sseRef.current) {
      try {
        sseRef.current.close();
      } catch {
        // Ignore cleanup errors
      } finally {
        sseRef.current = null;
      }
    }
  }, []);

  const openWebSocket = useCallback(
    (sid: string) => {
      closeSocket();

      const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const isDev = import.meta.env.DEV;
      const wsHost = isDev ? 'localhost:5000' : location.host;
      const wsUrl = `${wsProtocol}://${wsHost}/api/grover/progress?sessionId=${encodeURIComponent(sid)}`;

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setState((prev) => ({
          ...prev,
          logLines: [
            ...(prev.logLines || []),
            `[${new Date().toLocaleTimeString()}] WebSocket connected successfully`,
          ].slice(-500),
        }));
      };

      socket.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const data = payload?.data;
          if (!data) {
            return;
          }

          setState((prev) => {
            let nextLogs = prev.logLines ? [...prev.logLines] : [];
            const msg: string | undefined = typeof data.message === 'string' ? data.message : undefined;
            if (msg) {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] ${msg}`);
            }

            if (data.promptPreview && data.phase === 'prompt_ready') {
              const timestamp = new Date().toLocaleTimeString();
              const promptLength = data.promptLength || data.promptPreview.length;
              nextLogs.push(
                `[${timestamp}] ━━━━━━━━━━ GROVER PROMPT (${promptLength} chars) ━━━━━━━━━━`
              );
              data.promptPreview.split('\n').forEach((line: string) => nextLogs.push(line));
              nextLogs.push(`[${timestamp}] ━━━━━━━━━━ END GROVER PROMPT ━━━━━━━━━━`);
              if (data.conversationChain) {
                nextLogs.push(`[${timestamp}] 🔗 Conversation Chain: ${data.conversationChain}`);
              }
            }

            if (data.tokenUsage && data.phase === 'response_received') {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(
                `[${timestamp}] 📊 Token Usage: Input=${data.tokenUsage.input} Output=${data.tokenUsage.output} Total=${data.tokenUsage.total}`
              );
              if (data.responseId) {
                nextLogs.push(`[${timestamp}] 🆔 Response ID: ${data.responseId}`);
              }
            }

            if (data.programsExtracted && Array.isArray(data.programsExtracted)) {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] 📝 Extracted ${data.programsExtracted.length} programs:`);
              data.programsExtracted.forEach((prog: any, idx: number) => {
                nextLogs.push(`[${timestamp}]   Program ${idx + 1}: ${prog.lines} lines`);
              });
            }

            if (data.executionSummary) {
              const timestamp = new Date().toLocaleTimeString();
              const sum = data.executionSummary;
              nextLogs.push(
                `[${timestamp}] 🐍 Execution Results: ${sum.successful}/${sum.total} successful, ${sum.failed} failed`
              );
              if (sum.scores && sum.scores.length > 0) {
                const scores = sum.scores.map((s: number) => s.toFixed(1)).join(', ');
                nextLogs.push(`[${timestamp}]    Scores: [${scores}]`);
              }
            }

            if (data.phase && data.phase !== prev.phase && !['log', 'prompt_ready', 'response_received'].includes(data.phase)) {
              const timestamp = new Date().toLocaleTimeString();
              nextLogs.push(`[${timestamp}] Phase: ${data.phase}`);
            }

            let nextIterations = prev.iterations || [];
            if (Array.isArray(data.iterations)) {
              nextIterations = data.iterations;
            }

            if (nextLogs.length > 500) {
              nextLogs = nextLogs.slice(-500);
            }

            const isLogOnly = data.type === 'log' || data.phase === 'log';
            const isProgressPhase = [
              'prompt_ready',
              'waiting_llm',
              'response_received',
              'programs_extracted',
              'execution',
              'iteration_complete',
            ].includes(data.phase);

            return isLogOnly
              ? {
                  ...prev,
                  message: data.message || prev.message,
                  logLines: nextLogs,
                  iterations: nextIterations,
                }
              : {
                  ...prev,
                  ...data,
                  status: isProgressPhase ? 'running' : data.status || prev.status,
                  logLines: nextLogs,
                  iterations: nextIterations,
                };
          });
        } catch (error) {
          console.error('[Grover] WebSocket parse error:', error);
        }
      };

      socket.onerror = (evt: Event) => {
        setState((prev) => {
          if (prev.status !== 'running') return prev;
          const nextLogs = [...(prev.logLines ?? []), `WebSocket connection error: ${evt.type}`].slice(-500);
          return {
            ...prev,
            status: 'error',
            phase: 'connection_error',
            message: 'WebSocket connection failed',
            logLines: nextLogs,
          };
        });
      };

      socket.onclose = (evt) => {
        setState((prev) => {
          if (prev.status !== 'running') return prev;
          const reason = evt.reason || 'Grover progress connection closed unexpectedly';
          const nextLogs = [...(prev.logLines ?? []), reason].slice(-500);
          return {
            ...prev,
            status: 'error',
            phase: 'connection_closed',
            message: reason,
            logLines: nextLogs,
          };
        });
      };
    },
    [closeSocket]
  );

  const start = useCallback(
    async (options?: GroverOptions) => {
      if (!taskId) {
        console.error('[GroverStream] No taskId provided!');
        return;
      }

      try {
        closeSocket();
        closeEventSource();
        promptLoggedRef.current = null;

        const maxIterations = options?.maxIterations ?? 5;
        setState({
          status: 'running',
          phase: 'initializing',
          iteration: 0,
          totalIterations: maxIterations,
          iterations: [],
          logLines: ['🔬 Grover Iterative Solver starting...'],
          streamingStatus: streamingEnabled ? 'starting' : 'idle',
          streamingText: '',
          streamingReasoning: '',
          streamingMessage: undefined,
          streamingJson: '',
          streamingRefusal: '',
          streamingAnnotations: [],
        });
        setSessionId(null);

        const modelKey = options?.modelKey || 'grover-gpt-5-nano';
        const temperature = options?.temperature ?? 0.2;

        if (streamingEnabled) {
          const query = new URLSearchParams();
          query.set('temperature', String(temperature));
          query.set('maxIterations', String(maxIterations));
          if (options?.previousResponseId) query.set('previousResponseId', options.previousResponseId);
          if (options?.reasoningEffort) query.set('reasoningEffort', options.reasoningEffort);
          if (options?.reasoningVerbosity) query.set('reasoningVerbosity', options.reasoningVerbosity);
          if (options?.reasoningSummaryType) query.set('reasoningSummaryType', options.reasoningSummaryType);

          const streamUrl = `/api/stream/grover/${taskId}/${encodeURIComponent(modelKey)}${
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
                nextLogs.push('🔬 Grover Iterative Solver initialized');
                nextLogs.push(`Session: ${payload.sessionId}`);
                nextLogs.push(`Task: ${payload.taskId}`);
                nextLogs.push(`Model: ${payload.modelKey}`);
                nextLogs.push(`Started at: ${new Date(payload.createdAt).toLocaleTimeString()}`);
                nextLogs.push('---');
                if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);

                return {
                  ...prev,
                  streamingStatus: 'starting',
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
              const status = JSON.parse((evt as MessageEvent<string>).data) as GroverStreamStatusPayload;
              setState((prev) => {
                let nextLogs = prev.logLines ? [...prev.logLines] : [];
                if (status.message && typeof status.message === 'string') {
                  nextLogs.push(status.message);
                }

                const promptPreview = typeof status.promptPreview === 'string' ? status.promptPreview : undefined;
                const promptAlreadyCaptured = promptPreview && promptLoggedRef.current === promptPreview;
                if (promptPreview && !promptAlreadyCaptured) {
                  const timestamp = new Date().toLocaleTimeString();
                  const promptLength = typeof status.promptLength === 'number'
                    ? status.promptLength
                    : promptPreview.length;
                  nextLogs.push(`[${timestamp}] ━━━━━━━━━━ GROVER PROMPT (${promptLength} chars) ━━━━━━━━━━`);
                  promptPreview.split('\n').forEach((line: string) => nextLogs.push(line));
                  nextLogs.push(`[${timestamp}] ━━━━━━━━━━ END GROVER PROMPT ━━━━━━━━━━`);
                  if (status.conversationChain) {
                    nextLogs.push(`[${timestamp}] 🔗 Conversation Chain: ${status.conversationChain}`);
                  }
                  promptLoggedRef.current = promptPreview;
                }

                if (status.promptError && typeof status.promptError === 'string') {
                  const timestamp = new Date().toLocaleTimeString();
                  nextLogs.push(`[${timestamp}] ⚠️ Prompt preview error: ${status.promptError}`);
                }

                if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);

                return {
                  ...prev,
                  streamingStatus: status.state ?? prev.streamingStatus ?? 'idle',
                  streamingPhase: status.phase ?? prev.streamingPhase,
                  streamingMessage: status.message ?? prev.streamingMessage,
                  status: status.state === 'failed' ? 'error' : prev.status,
                  phase: status.phase ?? prev.phase,
                  iteration: typeof status.iteration === 'number' ? status.iteration : prev.iteration,
                  totalIterations:
                    typeof status.totalIterations === 'number'
                      ? status.totalIterations
                      : prev.totalIterations,
                  progress: typeof status.progress === 'number' ? status.progress : prev.progress,
                  promptPreview: promptPreview ?? prev.promptPreview,
                  promptLength:
                    typeof status.promptLength === 'number' ? status.promptLength : prev.promptLength,
                  promptModel: typeof status.promptModel === 'string' ? status.promptModel : prev.promptModel,
                  promptGeneratedAt:
                    typeof status.promptGeneratedAt === 'string'
                      ? status.promptGeneratedAt
                      : prev.promptGeneratedAt,
                  conversationChain:
                    status.conversationChain !== undefined
                      ? status.conversationChain
                      : prev.conversationChain,
                  promptError: typeof status.promptError === 'string' ? status.promptError : prev.promptError,
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
                metadata?: Record<string, unknown>;
                raw?: unknown;
                timestamp?: number;
              };
              setState((prev) => {
                let nextLogs = prev.logLines ? [...prev.logLines] : [];
                const annotationText =
                  chunk.type === 'annotation'
                    ? typeof chunk.raw === 'string'
                      ? chunk.raw
                      : (() => {
                          try {
                            return JSON.stringify(chunk.raw);
                          } catch {
                            return '[annotation]';
                          }
                        })()
                    : undefined;
                const chunkText = chunk.delta ?? chunk.content ?? annotationText;

                const recordLines = (label: string, text: string) => {
                  const timestamp = new Date().toLocaleTimeString();
                  nextLogs.push(`[${timestamp}] ${label}`);
                  text.split('\n').forEach((line: string) => {
                    if (line.trim().length > 0) {
                      nextLogs.push(line);
                    }
                  });
                  nextLogs.push(`[${timestamp}] ────────────────`);
                };

                if (chunkText) {
                  if (chunk.type === 'text') {
                    chunkText.split('\n').forEach((line: string) => {
                      if (line.trim()) {
                        nextLogs.push(line);
                      }
                    });
                  } else if (chunk.type === 'reasoning') {
                    recordLines('🧠 Grover reasoning update', chunkText);
                  } else if (chunk.type === 'json') {
                    recordLines('📦 Structured output streaming', chunkText);
                  } else if (chunk.type === 'refusal') {
                    recordLines('⛔ Model refusal content', chunkText);
                  } else if (chunk.type === 'annotation') {
                    recordLines('🔖 Annotation metadata', chunkText);
                  } else if (chunk.type === 'prompt') {
                    if (promptLoggedRef.current !== chunkText) {
                      recordLines('📝 Grover prompt', chunkText);
                      promptLoggedRef.current = chunkText;
                    }
                  }
                }

                if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);

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
                  streamingJson:
                    chunk.type === 'json'
                      ? (prev.streamingJson ?? '') + (chunk.delta ?? chunk.content ?? '')
                      : prev.streamingJson,
                  streamingRefusal:
                    chunk.type === 'refusal'
                      ? (prev.streamingRefusal ?? '') + (chunk.delta ?? chunk.content ?? '')
                      : prev.streamingRefusal,
                  streamingAnnotations:
                    chunk.type === 'annotation'
                      ? [
                          ...(prev.streamingAnnotations ?? []),
                          {
                            annotation: chunk.raw ?? annotationText,
                            metadata: chunk.metadata,
                            timestamp:
                              typeof chunk.timestamp === 'number' ? chunk.timestamp : Date.now(),
                          },
                        ]
                      : prev.streamingAnnotations,
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
                  iterations?: GroverIteration[];
                  bestProgram?: string;
                  estimatedCost?: number;
                };
                status?: string;
              };
              setState((prev) => {
                let nextLogs = prev.logLines ? [...prev.logLines] : [];
                nextLogs.push('---');
                nextLogs.push('✅ Grover analysis complete');
                if (summary.metadata?.bestScore !== undefined) {
                  nextLogs.push(`Best score: ${summary.metadata.bestScore.toFixed(1)}/10`);
                }
                if (summary.metadata?.estimatedCost !== undefined) {
                  nextLogs.push(`Estimated cost: $${summary.metadata.estimatedCost.toFixed(4)}`);
                }
                if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);

                const tokenUsage = summary.metadata?.tokenUsage;
                const totalTokens =
                  (tokenUsage?.input ?? 0) + (tokenUsage?.output ?? 0) + (tokenUsage?.reasoning ?? 0);

                return {
                  ...prev,
                  status: 'completed',
                  streamingStatus: 'completed',
                  result: summary.responseSummary?.analysis ?? summary,
                  iterations: summary.metadata?.iterations ?? prev.iterations,
                  bestProgram: summary.metadata?.bestProgram ?? prev.bestProgram,
                  bestScore: summary.metadata?.bestScore ?? prev.bestScore,
                  streamingTokenUsage: tokenUsage,
                  tokenUsage: tokenUsage
                    ? {
                        input: tokenUsage.input ?? 0,
                        output: tokenUsage.output ?? 0,
                        total: totalTokens,
                      }
                    : prev.tokenUsage,
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
              const payload = JSON.parse((evt as MessageEvent<string>).data) as { message?: string };
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

          eventSource.onerror = (err) => {
            console.error('[GroverStream] EventSource error:', err);
            setState((prev) => ({
              ...prev,
              status: 'error',
              streamingStatus: 'failed',
              streamingMessage: 'Streaming connection lost',
            }));
            closeEventSource();
          };

          return;
        }

        // Legacy WebSocket path
        const wireOptions: Record<string, unknown> = {
          temperature,
          maxIterations,
        };
        if (options?.previousResponseId) wireOptions.previousResponseId = options.previousResponseId;
        if (options?.reasoningEffort) wireOptions.reasoningEffort = options.reasoningEffort;
        if (options?.reasoningVerbosity) wireOptions.reasoningVerbosity = options.reasoningVerbosity;
        if (options?.reasoningSummaryType) wireOptions.reasoningSummaryType = options.reasoningSummaryType;

        const res = await apiRequest('POST', `/api/puzzle/grover/${taskId}/${modelKey}`, wireOptions);
        const json = await res.json();
        const sid = json?.data?.sessionId as string | undefined;
        if (!sid) {
          throw new Error('Grover session did not return a sessionId');
        }
        setSessionId(sid);

        try {
          const snapshotRes = await apiRequest('GET', `/api/grover/status/${sid}`);
          const snapshotJson = await snapshotRes.json();
          const snapshot = snapshotJson?.data?.snapshot;
          if (snapshot && typeof snapshot === 'object') {
            setState((prev) => ({
              ...prev,
              ...snapshot,
              status: snapshot.status || prev.status,
              iteration: typeof snapshot.iteration === 'number' ? snapshot.iteration : prev.iteration,
              totalIterations: snapshot.totalIterations || prev.totalIterations,
              logLines: Array.isArray(snapshot.logLines)
                ? [...snapshot.logLines, `[${new Date().toLocaleTimeString()}] Initial state loaded`]
                : [`[${new Date().toLocaleTimeString()}] Initial state loaded`],
              iterations: Array.isArray(snapshot.iterations) ? snapshot.iterations : prev.iterations,
            }));
          }
        } catch (snapshotErr) {
          console.error('[Grover] Snapshot fetch failed:', snapshotErr);
        }

        openWebSocket(sid);
      } catch (error) {
        console.error('[GroverStream] Error in start function:', error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          streamingStatus: 'failed',
          streamingMessage: error instanceof Error ? error.message : 'Failed to start analysis',
          logLines: [
            ...(prev.logLines || []),
            `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
          ].slice(-500),
        }));
      }
    },
    [closeEventSource, closeSocket, openWebSocket, streamingEnabled, taskId]
  );

  useEffect(() => {
    if (!sessionId) return;
    if (state.status !== 'idle' && state.iterations && state.iterations.length > 0) return;

    const fetchSnapshot = async () => {
      try {
        const snapshotRes = await apiRequest('GET', `/api/grover/status/${sessionId}`);
        const snapshotJson = await snapshotRes.json();
        const snapshot = snapshotJson?.data?.snapshot;
        if (snapshot && typeof snapshot === 'object') {
          setState((prev) => ({
            ...prev,
            ...snapshot,
            status: snapshot.status || prev.status,
            iteration: typeof snapshot.iteration === 'number' ? snapshot.iteration : prev.iteration,
            totalIterations: snapshot.totalIterations || prev.totalIterations,
            logLines: Array.isArray(snapshot.logLines)
              ? [...snapshot.logLines, `[${new Date().toLocaleTimeString()}] State hydrated from snapshot`]
              : [`[${new Date().toLocaleTimeString()}] State hydrated from snapshot`],
            iterations: Array.isArray(snapshot.iterations) ? snapshot.iterations : prev.iterations,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            logLines: [
              ...(prev.logLines || []),
              `[${new Date().toLocaleTimeString()}] Warning: Snapshot was empty, waiting for updates...`,
            ].slice(-500),
          }));
        }
      } catch (snapshotErr) {
        console.error('[Grover] Failed to fetch snapshot:', snapshotErr);
        setState((prev) => ({
          ...prev,
          logLines: [
            ...(prev.logLines || []),
            `[${new Date().toLocaleTimeString()}] Error fetching snapshot: ${snapshotErr}`,
          ].slice(-500),
        }));
      }
    };

    fetchSnapshot();
  }, [sessionId, state.status, state.iterations?.length]);

  const cancel = useCallback(async () => {
    if (!sessionId) {
      console.warn('[Grover] Cannot cancel: no active session');
      return;
    }

    try {
      await apiRequest('POST', `/api/stream/cancel/${sessionId}`);
      closeSocket();
      closeEventSource();
      setState((prev) => ({
        ...prev,
        status: 'error',
        streamingStatus: 'failed',
        streamingMessage: 'Cancelled by user',
        message: 'Analysis cancelled by user',
        logLines: [
          ...(prev.logLines || []),
          `[${new Date().toLocaleTimeString()}] ⚠️ Cancelled by user`,
        ].slice(-500),
      }));
    } catch (error) {
      console.error('[Grover] Cancel failed:', error);
    }
  }, [sessionId, closeSocket, closeEventSource]);

  useEffect(() => {
    return () => {
      closeSocket();
      closeEventSource();
    };
  }, [closeSocket, closeEventSource]);

  return { sessionId, state, start, cancel };
}
