/**
 * client/src/hooks/useSaturnProgress.ts
 *
 * Hook for managing a Saturn analysis session. Supports two execution paths:
 * 1) SSE streaming when VITE_ENABLE_SSE_STREAMING === 'true'
 * 2) Legacy WebSocket polling when streaming is disabled
 *
 * Returns helpers and state so pages can render the current phase/progress,
 * live streaming output, and final result.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

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
  streamingTokenUsage?: {
    input?: number;
    output?: number;
    reasoning?: number;
  };
}

export function useSaturnProgress(taskId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SaturnProgressState>({
    status: 'idle',
    galleryImages: [],
    logLines: [],
    reasoningHistory: [],
    streamingStatus: 'idle',
  });
  const wsRef = useRef<WebSocket | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const streamingEnabled = import.meta.env.VITE_ENABLE_SSE_STREAMING === 'true';

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
      if (!taskId) return;

      closeSocket();
      closeEventSource();

      setState({
        status: 'running',
        phase: 'initializing',
        step: 0,
        totalSteps: options?.maxSteps,
        galleryImages: [],
        logLines: [],
        reasoningHistory: [],
        streamingStatus: streamingEnabled ? 'starting' : 'idle',
        streamingText: undefined,
        streamingReasoning: undefined,
        streamingMessage: undefined,
      });

      const modelKey = options?.model || 'gpt-5-nano-2025-08-07';

      if (streamingEnabled) {
        const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) || '';
        const apiUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        const query = new URLSearchParams();
        query.set('temperature', String(options?.temperature ?? 0.2));
        query.set('promptId', 'solver');
        if (options?.previousResponseId) query.set('previousResponseId', options.previousResponseId);
        if (options?.reasoningEffort) query.set('reasoningEffort', options.reasoningEffort);
        if (options?.reasoningVerbosity) query.set('reasoningVerbosity', options.reasoningVerbosity);
        if (options?.reasoningSummaryType) query.set('reasoningSummaryType', options.reasoningSummaryType);

        const streamUrl = `${apiUrl}/api/stream/saturn/${taskId}/${encodeURIComponent(modelKey)}${
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
            setState((prev) => ({
              ...prev,
              streamingStatus: 'starting',
              status: 'running',
            }));
          } catch (error) {
            console.error('[SaturnStream] Failed to parse init payload:', error);
          }
        });

        eventSource.addEventListener('stream.status', (evt) => {
          try {
            const status = JSON.parse((evt as MessageEvent<string>).data) as {
              state?: SaturnProgressState['streamingStatus'];
              phase?: string;
              message?: string;
            };
            setState((prev) => ({
              ...prev,
              streamingStatus: status.state ?? prev.streamingStatus ?? 'idle',
              streamingPhase: status.phase ?? prev.streamingPhase,
              streamingMessage: status.message ?? prev.streamingMessage,
              status: status.state === 'failed' ? 'error' : prev.status,
              phase: status.phase ?? prev.phase,
            }));
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
            };
            setState((prev) => ({
              ...prev,
              streamingText:
                chunk.type === 'text'
                  ? (prev.streamingText ?? '') + (chunk.delta ?? chunk.content ?? '')
                  : prev.streamingText,
              streamingReasoning:
                chunk.type === 'reasoning'
                  ? (prev.streamingReasoning ?? '') + (chunk.delta ?? chunk.content ?? '')
                  : prev.streamingReasoning,
            }));
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
            setState((prev) => ({
              ...prev,
              status: 'error',
              streamingStatus: 'failed',
              streamingMessage: payload.message ?? 'Streaming error',
            }));
          } catch (error) {
            console.error('[SaturnStream] Failed to parse error payload:', error);
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

        return;
      }

      // Legacy WebSocket path
      const endpoint = `/api/saturn/analyze/${taskId}`;
      const requestBody = {
        modelKey,
        temperature: options?.temperature ?? 0.2,
        promptId: 'solver',
        ...(options?.previousResponseId && { previousResponseId: options.previousResponseId }),
        captureReasoning: true,
        reasoningEffort: options?.reasoningEffort || 'high',
        reasoningVerbosity: options?.reasoningVerbosity || 'high',
        reasoningSummaryType: options?.reasoningSummaryType || 'detailed',
      };

      const res = await apiRequest('POST', endpoint, requestBody);
      const json = await res.json();
      const sid = json?.data?.sessionId as string;
      setSessionId(sid);
      openWebSocket(sid);
    },
    [closeEventSource, closeSocket, openWebSocket, streamingEnabled, taskId]
  );

  useEffect(() => {
    return () => {
      closeSocket();
      closeEventSource();
    };
  }, [closeEventSource, closeSocket]);

  return { sessionId, state, start };
}
