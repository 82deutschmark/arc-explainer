/**
 * client/src/hooks/useSaturnProgress.ts
 *
 * Hook for managing a Saturn analysis session: starts the backend job and
 * streams real-time progress updates over WebSocket. Returns helpers and state
 * so pages can render the current phase/progress and final result.
 *
 * How it works:
 * - POST to `/api/saturn/analyze/:taskId` to start a job and get a `sessionId`.
 * - Open a WebSocket to `/api/saturn/progress?sessionId=...`.
 * - Merge streamed JSON snapshots into state. Accumulate any `images` into a
 *   deduplicated `galleryImages` list for the UI.
 *
 * Author: Cascade (model: GPT-5 medium reasoning)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface SaturnOptions {
  model?: string;
  temperature?: number;
  cellSize?: number;
  maxSteps?: number;
  captureReasoning?: boolean;
}

export interface SaturnProgressState {
  status: 'idle' | 'running' | 'completed' | 'error';
  phase?: string;
  step?: number;
  totalSteps?: number;
  progress?: number;
  message?: string;
  result?: any;
  images?: { path: string; base64?: string }[]; // last batch from server
  galleryImages?: { path: string; base64?: string }[]; // accumulated across run
  // Cascade: accumulate log lines for a live console panel. The backend forwards
  // Python stdout/stderr as ws events with phase === 'log'. We also append
  // terminal status messages on error/completion for visibility.
  logLines?: string[];
}

export function useSaturnProgress(taskId: string | undefined) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<SaturnProgressState>({ status: 'idle', galleryImages: [], logLines: [] });
  const wsRef = useRef<WebSocket | null>(null);

  // Helper to close any existing socket
  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  // Start an analysis and open WebSocket
  const start = useCallback(async (options?: SaturnOptions) => {
    if (!taskId) return;
    // Reset state for new run
    setState({ status: 'running', phase: 'initializing', step: 0, totalSteps: options?.maxSteps, galleryImages: [], logLines: [] });
    closeSocket();

    // Map friendly UI labels to backend model ids and include provider for clarity.
    // Wrapper still validates and enforces OpenAI-only (base64 PNG), but we send
    // provider explicitly to surface clear errors on unsupported selections.
    const uiModel = options?.model ?? 'GPT-5';
    let provider: string | undefined;
    let modelId: string | undefined;
    const m = (uiModel || '').toString().toLowerCase();
    if (m === 'gpt-5' || uiModel === 'GPT-5') {
      provider = 'openai';
      modelId = 'gpt-5';
    } else if (m.includes('claude')) {
      provider = 'anthropic';
      modelId = uiModel; // wrapper will error (unsupported provider)
    } else if (m.includes('grok')) {
      provider = 'xai';
      modelId = uiModel; // wrapper will error (unsupported provider)
    } else {
      provider = undefined; // let wrapper infer
      modelId = uiModel;
    }

    const wireOptions = {
      provider,
      model: modelId,
      temperature: options?.temperature ?? 0.2,
      cellSize: options?.cellSize ?? 24,
      maxSteps: options?.maxSteps ?? 8,
      captureReasoning: !!options?.captureReasoning,
    };

    const res = await apiRequest('POST', `/api/saturn/analyze/${taskId}`, wireOptions);
    const json = await res.json();
    const sid = json?.data?.sessionId as string;
    setSessionId(sid);

    // Open WebSocket
    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    
    // In development, frontend (Vite) runs on different port than backend
    const isDev = import.meta.env.DEV;
    const wsHost = isDev ? 'localhost:5000' : location.host;
    
    const wsUrl = `${wsProtocol}://${wsHost}/api/saturn/progress?sessionId=${encodeURIComponent(sid)}`;
    const sock = new WebSocket(wsUrl);
    wsRef.current = sock;

    sock.onmessage = (evt) => {
      try {
        console.log('[SATURN-DEBUG] WebSocket raw message:', evt.data.substring(0, 500));
        const payload = JSON.parse(evt.data);
        const data = payload?.data;
        console.log('[SATURN-DEBUG] WebSocket parsed payload:', {
          type: payload?.type,
          status: data?.status,
          phase: data?.phase,
          message: data?.message?.substring(0, 100),
          imagesCount: Array.isArray(data?.images) ? data.images.length : 0
        });
        if (!data) {
          console.log('[SATURN-DEBUG] WebSocket message has no data field');
          return;
        }
        setState((prev) => {
          let nextGallery = prev.galleryImages ?? [];
          const incoming = Array.isArray(data.images) ? data.images : [];
          if (incoming.length) {
            const seen = new Set((nextGallery).map((i) => i.path));
            for (const im of incoming) {
              if (im?.path && !seen.has(im.path)) {
                nextGallery = [...nextGallery, im];
                seen.add(im.path);
              }
            }
          }
          // Build next log buffer
          let nextLogs = prev.logLines ? [...prev.logLines] : [];
          const msg: string | undefined = typeof data.message === 'string' ? data.message : undefined;
          const phase = data.phase;
          const status = data.status;
          if (msg && (phase === 'log' || status === 'error' || status === 'completed' || phase === 'runtime' || phase === 'persistence' || phase === 'handler')) {
            nextLogs.push(msg);
            // Cap to avoid unbounded growth
            if (nextLogs.length > 500) nextLogs = nextLogs.slice(-500);
          }
          const newState = { ...prev, ...data, galleryImages: nextGallery, logLines: nextLogs };
          console.log('[SATURN-DEBUG] WebSocket state update:', {
            status: newState.status,
            phase: newState.phase,
            galleryCount: newState.galleryImages?.length || 0,
            logCount: newState.logLines?.length || 0
          });
          return newState;
        });
      } catch (error) {
        console.error('[SATURN-DEBUG] WebSocket parse error:', error, 'Raw data:', evt.data);
      }
    };

    sock.onclose = () => {
      // If we closed while still running, keep last state; otherwise no-op
    };

  }, [taskId, closeSocket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeSocket();
    };
  }, [closeSocket]);

  return { sessionId, state, start };
}
