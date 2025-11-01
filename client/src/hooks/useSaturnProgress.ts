/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: React hook that orchestrates Saturn Visual Solver progress, bridging SSE streaming (prompt preview + deltas)
 * and legacy WebSocket fallback so the UI receives immediate feedback and continuous updates.
 * SRP/DRY check: Pass — reused shared streaming handlers, aligning behaviour with Grover/useGroverProgress while avoiding duplication.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { getDefaultSaturnModel } from '@/lib/saturnModels';
import { isStreamingEnabled } from '@shared/config/streaming';

export interface SaturnOptions {
  model?: string;
  temperature?: number;
  cellSize?: number;
  maxSteps?: number;
  captureReasoning?: boolean;
  useResponsesAPI?: boolean;
  previousResponseId?: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  reasoningVerbosity?: 'low' | 'medium' | 'high';
  reasoningSummaryType?: 'auto' | 'detailed';
}

export interface SaturnProgressState {
  status: 'idle' | 'running' | 'completed' | 'error';
  phase?: string;
  step?: number;
  totalSteps?: number;
  progress?: number;
  message?: string;
  result?: any;
  images?: { path: string; base64?: string }[];
  galleryImages?: { path: string; base64?: string }[];
  logLines?: string[];
  reasoningLog?: string;
  reasoningHistory?: string[];
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
  promptPreview?: string;
  promptLength?: number;
  promptModel?: string;
  promptId?: string;
  promptGeneratedAt?: string;
  conversationChain?: string | null;
  promptError?: string;
}

type SaturnStreamStatusPayload = {
  state?: SaturnProgressState['streamingStatus'];
  phase?: string;
  message?: string;
  images?: { path: string; base64?: string }[];
  step?: number;
  totalSteps?: number;
  progress?: number;
  promptPreview?: string;
  promptLength?: number;
  promptModel?: string;
  promptId?: string;
  promptGeneratedAt?: string;
  conversationChain?: string | null;
  promptError?: string;
};

export function useSaturnProgress(taskId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SaturnProgressState>({
    status: 'idle',
    galleryImages: [],
    logLines: [],
    reasoningHistory: [],
    streamingStatus: 'idle',
    streamingAnnotations: [],
  });
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const promptLoggedRef = useRef<string | null>(null);
  // Enable streaming in development by default, or use config in production
  const streamingEnabled = import.meta.env.DEV ? true : isStreamingEnabled();

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // Ignore errors during cleanup
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
        // Ignore errors during cleanup
      } finally {
        sseRef.current = null;
      }
    }
  }, []);

  const openWebSocket = useCallback((sid: string) => {
    closeSocket();

    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const isDev = import.meta.env.DEV;
    const wsHost = isDev ? 'localhost:5000' : location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/api/saturn/progress?sessionId=${encodeURIComponent(sid)}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const data = payload?.data;
        if (!data) {
          return;
        }

        setState((prev) => {
          let nextGallery = prev.galleryImages ?? [];
          const incoming = Array.isArray(data.images) ? data.images : [];
          if (incoming.length) {
            const seen = new Set(nextGallery.map((i) => i.path));
            for (const im of incoming) {
              if (im?.path && !seen.has(im.path)) {
                nextGallery = [...nextGallery, im];
                seen.add(im.path);
              }
            }
          }

          let nextLogs = prev.logLines ? [...prev.logLines] : [];
          const msg: string | undefined = typeof data.message === 'string' ? data.message : undefined;
          const phase = data.phase;
          const status = data.status;
          if (
            msg &&
            (phase === 'log' ||
              status === 'error' ||
              status === 'completed' ||
              phase === 'runtime' ||
              phase === 'persistence' ||
              phase === 'handler')
          ) {
            nextLogs.push(msg);
            if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
          }

          let nextReasoningHistory = prev.reasoningHistory ? [...prev.reasoningHistory] : [];
          const reasoningLog = data.reasoningLog;
          if (reasoningLog && typeof reasoningLog === 'string') {
            nextReasoningHistory.push(reasoningLog);
            if (nextReasoningHistory.length > 100) nextReasoningHistory = nextReasoningHistory.slice(-100);
          }

          return {
            ...prev,
            ...data,
            galleryImages: nextGallery,
            logLines: nextLogs,
            reasoningHistory: nextReasoningHistory,
          };
        });
      } catch (error) {
        console.error('[Saturn] WebSocket parse error:', error, 'payload:', evt.data);
      }
    };
  }, [closeSocket]);

  const start = useCallback(
    async (options?: SaturnOptions) => {
      console.log('[SaturnStream] START CALLED with options:', options);
      
      if (!taskId) {
        console.error('[SaturnStream] No taskId provided!');
        return;
      }

      try {
        closeSocket();
        closeEventSource();

        promptLoggedRef.current = null;

        // IMMEDIATE UI FEEDBACK - Set state synchronously FIRST
        console.log('[SaturnStream] Setting initial state to running...');
        setState({
          status: 'running',
          phase: 'initializing',
          step: 0,
          totalSteps: options?.maxSteps,
          galleryImages: [],
          logLines: ['🪐 Saturn Visual Solver starting...'],
          reasoningHistory: [],
          streamingStatus: streamingEnabled ? 'starting' : 'idle',
          streamingText: '',
          streamingReasoning: '',
          streamingMessage: undefined,
          streamingJson: '',
          streamingRefusal: '',
          streamingAnnotations: [],
          promptPreview: undefined,
          promptLength: undefined,
          promptModel: undefined,
          promptId: undefined,
          promptGeneratedAt: undefined,
          conversationChain: undefined,
          promptError: undefined,
        });

        // Use utility function to get default model if none provided
        const defaultModel = getDefaultSaturnModel();
        const modelKey = options?.model || (defaultModel?.key ?? 'gpt-5-nano-2025-08-07');

        console.log('[SaturnStream] Streaming enabled:', streamingEnabled);
        console.log('[SaturnStream] Selected model:', modelKey);
        console.log('[SaturnStream] TaskId:', taskId);

        if (streamingEnabled) {
        // For development, use empty string to make relative requests to same origin
        // Vite dev server proxy will forward /api/* to backend
        const query = new URLSearchParams();
        query.set('promptId', 'solver');
        if (typeof options?.temperature === 'number') {
          query.set('temperature', String(options.temperature));
        }
        if (options?.previousResponseId) query.set('previousResponseId', options.previousResponseId);
        if (options?.reasoningEffort) query.set('reasoningEffort', options.reasoningEffort);
        if (options?.reasoningVerbosity) query.set('reasoningVerbosity', options.reasoningVerbosity);
        if (options?.reasoningSummaryType) query.set('reasoningSummaryType', options.reasoningSummaryType);

        const streamUrl = `/api/stream/saturn/${taskId}/${encodeURIComponent(modelKey)}${
          query.toString() ? `?${query.toString()}` : ''
        }`;

        console.log('[SaturnStream] Starting SSE connection:', streamUrl);
        console.log('[SaturnStream] Model:', modelKey);
        console.log('[SaturnStream] Options:', options);

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
            if (payload.sessionId) {
              openWebSocket(payload.sessionId);
            }
            setState((prev) => {
              // Add init message to logLines
              let nextLogs = prev.logLines ? [...prev.logLines] : [];
              nextLogs.push(`🪐 Saturn Visual Solver initialized`);
              nextLogs.push(`Session: ${payload.sessionId}`);
              nextLogs.push(`Task: ${payload.taskId}`);
              nextLogs.push(`Model: ${payload.modelKey}`);
              nextLogs.push(`Started at: ${new Date(payload.createdAt).toLocaleTimeString()}`);
              nextLogs.push('---');

              return {
                ...prev,
                streamingStatus: 'starting',
                status: 'running',
                logLines: nextLogs,
              };
            });
          } catch (error) {
            console.error('[SaturnStream] Failed to parse init payload:', error);
          }
        });

        eventSource.addEventListener('stream.status', (evt) => {
          try {
            const status = JSON.parse((evt as MessageEvent<string>).data) as SaturnStreamStatusPayload;

            setState((prev) => {
              // Add status message to logLines if present
              let nextLogs = prev.logLines ? [...prev.logLines] : [];
              if (status.message && typeof status.message === 'string') {
                nextLogs.push(status.message);
                if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
              }

              const promptPreview = typeof status.promptPreview === 'string' ? status.promptPreview : undefined;
              const promptAlreadyCaptured =
                promptPreview && promptLoggedRef.current === promptPreview;
              if (promptPreview && !promptAlreadyCaptured) {
                const timestamp = new Date().toLocaleTimeString();
                const promptLength = typeof status.promptLength === 'number' ? status.promptLength : promptPreview.length;
                nextLogs.push(`[${timestamp}] ━━━━━━━━━━ SATURN PROMPT (${promptLength} chars) ━━━━━━━━━━`);
                promptPreview.split('\n').forEach((line: string) => {
                  nextLogs.push(line);
                });
                nextLogs.push(`[${timestamp}] ━━━━━━━━━━ END SATURN PROMPT ━━━━━━━━━━`);
                if (status.conversationChain) {
                  nextLogs.push(`[${timestamp}] 🔗 Conversation Chain: ${status.conversationChain}`);
                }
                promptLoggedRef.current = promptPreview;
              }

              if (status.promptError && typeof status.promptError === 'string') {
                const timestamp = new Date().toLocaleTimeString();
                nextLogs.push(`[${timestamp}] ⚠️ Prompt preview error: ${status.promptError}`);
              }

              // Add any new images to gallery
              let nextGallery = prev.galleryImages ?? [];
              const incoming = Array.isArray(status.images) ? status.images : [];
              if (incoming.length > 0) {
                const seen = new Set(nextGallery.map((i) => i.path));
                for (const im of incoming) {
                  if (im?.path && !seen.has(im.path)) {
                    nextGallery = [...nextGallery, im];
                    seen.add(im.path);
                    // Also log that we received an image
                    nextLogs.push(`📸 Generated image: ${im.path}`);
                  }
                }
              }

              return {
                ...prev,
                streamingStatus: status.state ?? prev.streamingStatus ?? 'idle',
                streamingPhase: status.phase ?? prev.streamingPhase,
                streamingMessage: status.message ?? prev.streamingMessage,
                status: status.state === 'failed' ? 'error' : prev.status,
                phase: status.phase ?? prev.phase,
                step: status.step ?? prev.step,
                totalSteps: status.totalSteps ?? prev.totalSteps,
                progress: status.progress ?? prev.progress,
                logLines: nextLogs,
                galleryImages: nextGallery,
                promptPreview: promptPreview ?? prev.promptPreview,
                promptLength:
                  typeof status.promptLength === 'number'
                    ? status.promptLength
                    : prev.promptLength,
                promptModel: typeof status.promptModel === 'string' ? status.promptModel : prev.promptModel,
                promptId: typeof status.promptId === 'string' ? status.promptId : prev.promptId,
                promptGeneratedAt:
                  typeof status.promptGeneratedAt === 'string'
                    ? status.promptGeneratedAt
                    : prev.promptGeneratedAt,
                conversationChain:
                  status.conversationChain !== undefined
                    ? (status.conversationChain as string | null)
                    : prev.conversationChain,
                promptError: typeof status.promptError === 'string' ? status.promptError : prev.promptError,
              };
            });
          } catch (error) {
            console.error('[SaturnStream] Failed to parse status payload:', error);
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

              let nextPromptPreview = prev.promptPreview;
              let nextPromptLength = prev.promptLength;
              let nextPromptGeneratedAt = prev.promptGeneratedAt;

              if (chunkText && chunk.type === 'prompt') {
                if (promptLoggedRef.current !== chunkText) {
                  promptLoggedRef.current = chunkText;
                }
                nextPromptPreview = chunkText;
                const metaLength =
                  typeof chunk.metadata?.promptLength === 'number'
                    ? (chunk.metadata.promptLength as number)
                    : chunkText.length;
                nextPromptLength = metaLength;
                if (typeof chunk.metadata?.promptGeneratedAt === 'string') {
                  nextPromptGeneratedAt = chunk.metadata.promptGeneratedAt as string;
                }
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
                            typeof chunk.timestamp === 'number'
                              ? chunk.timestamp
                              : Date.now(),
                        },
                      ]
                    : prev.streamingAnnotations,
                promptPreview: nextPromptPreview,
                promptLength: nextPromptLength,
                promptGeneratedAt: nextPromptGeneratedAt,
                promptId:
                  typeof chunk.metadata?.promptId === 'string'
                    ? (chunk.metadata?.promptId as string)
                    : prev.promptId,
                promptModel:
                  typeof chunk.metadata?.promptModel === 'string'
                    ? (chunk.metadata?.promptModel as string)
                    : prev.promptModel,
              };
            });
          } catch (error) {
            console.error('[SaturnStream] Failed to parse chunk payload:', error);
          }
        });

        eventSource.addEventListener('stream.complete', (evt) => {
          try {
            const summary = JSON.parse((evt as MessageEvent<string>).data) as {
              responseSummary?: Record<string, unknown>;
              metadata?: { tokenUsage?: { input?: number; output?: number; reasoning?: number } };
            };
            setState((prev) => ({
              ...prev,
              status: 'completed',
              streamingStatus: 'completed',
              result: summary.responseSummary ?? summary,
              streamingTokenUsage: summary.metadata?.tokenUsage,
            }));
          } catch (error) {
            console.error('[SaturnStream] Failed to parse completion payload:', error);
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
              // Add error message to logLines
              let nextLogs = prev.logLines ? [...prev.logLines] : [];
              const errorMsg = payload.message ?? 'Streaming error';
              nextLogs.push(`ERROR: ${errorMsg}`);
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
            console.error('[SaturnStream] Failed to parse error payload:', error);
          } finally {
            closeEventSource();
          }
        });

        eventSource.onerror = (err) => {
          console.error('[SaturnStream] EventSource error:', err);
          console.error('[SaturnStream] EventSource readyState:', eventSource.readyState);
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
      const endpoint = `/api/saturn/analyze/${taskId}`;
      const requestBody: Record<string, unknown> = {
        modelKey,
        promptId: 'solver',
        captureReasoning: true,
      };

      if (typeof options?.temperature === 'number') {
        requestBody.temperature = options.temperature;
      }

      if (options?.previousResponseId) {
        requestBody.previousResponseId = options.previousResponseId;
      }

      if (options?.reasoningEffort) {
        requestBody.reasoningEffort = options.reasoningEffort;
      }

      if (options?.reasoningVerbosity) {
        requestBody.reasoningVerbosity = options.reasoningVerbosity;
      }

      if (options?.reasoningSummaryType) {
        requestBody.reasoningSummaryType = options.reasoningSummaryType;
      }

      const res = await apiRequest('POST', endpoint, requestBody);
      const json = await res.json();
      const sid = json?.data?.sessionId as string;
      setSessionId(sid);
      openWebSocket(sid);
      } catch (error) {
        console.error('[SaturnStream] Error in start function:', error);
        setState((prev) => ({
          ...prev,
          status: 'error',
          streamingStatus: 'failed',
          streamingMessage: error instanceof Error ? error.message : 'Failed to start analysis',
          logLines: [...(prev.logLines || []), `❌ Error: ${error instanceof Error ? error.message : String(error)}`],
        }));
      }
    },
    [closeEventSource, closeSocket, openWebSocket, streamingEnabled, taskId]
  );

  const cancel = useCallback(async () => {
    if (!sessionId) {
      console.warn('[Saturn] Cannot cancel: no active session');
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
        message: 'Analysis cancelled by user'
      }));
    } catch (error) {
      console.error('[Saturn] Cancel failed:', error);
    }
  }, [sessionId, closeSocket, closeEventSource]);

  useEffect(() => {
    return () => {
      closeSocket();
      closeEventSource();
    };
  }, [closeEventSource, closeSocket]);

  return { sessionId, state, start, cancel };
}
