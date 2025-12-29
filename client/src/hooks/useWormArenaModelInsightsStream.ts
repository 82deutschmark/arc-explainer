/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28
 * PURPOSE: Hook for streaming Worm Arena model insights with live reasoning/output updates
 * SRP/DRY check: Pass - focused on model insights streaming only
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { WormArenaModelInsightsReport } from '../../../shared/types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || '';

interface StreamChunk {
  type: 'reasoning' | 'json';
  delta: string;
  timestamp: number;
}

interface StreamStatus {
  state: 'idle' | 'requested' | 'in_progress' | 'completed' | 'failed';
  phase?: string;
  message?: string;
}

interface StreamError {
  code: string;
  message: string;
}

export function useWormArenaModelInsightsStream() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<StreamStatus>({ state: 'idle' });
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [report, setReport] = useState<WormArenaModelInsightsReport | null>(null);
  const [error, setError] = useState<StreamError | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Aggregate chunks by type
  const aggregated = useMemo(() => {
    return chunks.reduce(
      (acc, chunk) => {
        if (chunk.type === 'reasoning') {
          acc.reasoning += chunk.delta;
        } else if (chunk.type === 'json') {
          acc.json += chunk.delta;
        }
        return acc;
      },
      { reasoning: '', json: '' }
    );
  }, [chunks]);

  // Try to parse JSON incrementally
  const parsedInsights = useMemo(() => {
    if (!aggregated.json) return null;
    try {
      return JSON.parse(aggregated.json);
    } catch {
      return null; // Incomplete JSON, keep accumulating
    }
  }, [aggregated.json]);

  const startStream = useCallback((modelSlug: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus({ state: 'requested' });
    setChunks([]);
    setReport(null);
    setError(null);
    setSessionId(null);

    const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
    const streamUrl = `${baseUrl}/api/stream/snakebench/model-insights/${encodeURIComponent(modelSlug)}`;

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('stream.init', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        setSessionId(payload.sessionId);
      } catch (err) {
        console.error('[ModelInsightsStream] Failed to parse init', err);
      }
    });

    eventSource.addEventListener('stream.status', (event: MessageEvent) => {
      try {
        const statusUpdate = JSON.parse(event.data);
        setStatus(statusUpdate);
      } catch (err) {
        console.error('[ModelInsightsStream] Failed to parse status', err);
      }
    });

    eventSource.addEventListener('stream.chunk', (event: MessageEvent) => {
      try {
        const chunk = JSON.parse(event.data) as StreamChunk;
        setChunks(prev => [...prev, chunk]);
      } catch (err) {
        console.error('[ModelInsightsStream] Failed to parse chunk', err);
      }
    });

    eventSource.addEventListener('stream.complete', (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        setReport(payload.report);
        setStatus({ state: 'completed' });
        eventSource.close();
      } catch (err) {
        console.error('[ModelInsightsStream] Failed to parse complete', err);
      }
    });

    eventSource.addEventListener('stream.error', (event: MessageEvent) => {
      try {
        const errorPayload = JSON.parse(event.data);
        setError(errorPayload);
        setStatus({ state: 'failed', message: errorPayload.message });
        eventSource.close();
      } catch (err) {
        console.error('[ModelInsightsStream] Failed to parse error', err);
      }
    });

    eventSource.onerror = () => {
      setError({ code: 'CONNECTION_FAILED', message: 'Stream connection failed' });
      setStatus({ state: 'failed', message: 'Connection failed' });
      eventSource.close();
    };
  }, []);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus({ state: 'idle' });
    setChunks([]);
    setReport(null);
    setError(null);
    setSessionId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    sessionId,
    status,
    report,
    error,
    reasoningText: aggregated.reasoning,
    jsonText: aggregated.json,
    parsedInsights,
    isStreaming: status.state === 'in_progress' || status.state === 'requested',
    isComplete: status.state === 'completed',
    isError: status.state === 'failed',
    startStream,
    closeStream,
  };
}
