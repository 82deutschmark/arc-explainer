/**
 * Author: Cascade
 * Date: 2025-12-18
 * PURPOSE: React hook for Worm Arena live match streaming via SSE.
 *          One session = one match. Handles connection, frame streaming, and final summary.
 *          Batch mode removed - all matches are single-session.
 * SRP/DRY check: Pass - manages SSE connection state only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SnakeBenchRunMatchRequest,
  WormArenaFrameEvent,
  WormArenaFinalSummary,
  WormArenaStreamStatus,
  WormArenaStreamChunk,
} from '@shared/types';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

export function useWormArenaStreaming() {
  const [status, setStatus] = useState<StreamState>('idle');
  const [message, setMessage] = useState<string | undefined>();
  const [phase, setPhase] = useState<string | undefined>();
  const [frames, setFrames] = useState<WormArenaFrameEvent[]>([]);
  const [chunks, setChunks] = useState<WormArenaStreamChunk[]>([]);
  const [reasoningBySnakeId, setReasoningBySnakeId] = useState<Record<string, string>>({});
  const [playerNameBySnakeId, setPlayerNameBySnakeId] = useState<Record<string, string>>({});
  const [finalSummary, setFinalSummary] = useState<WormArenaFinalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const statusRef = useRef<StreamState>('idle');
  const sawInitRef = useRef(false);

  // Match progress state (kept for UI compatibility but batch mode removed)
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const startMatch = useCallback(async (payload: SnakeBenchRunMatchRequest) => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/wormarena/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to prepare match');
      }
      const { sessionId } = json;
      if (!sessionId) {
        throw new Error('Missing sessionId from prepare response');
      }
      const liveUrl = `${window.location.origin}/worm-arena/live/${sessionId}`;
      return { sessionId, liveUrl };
    } finally {
      setIsStarting(false);
    }
  }, []);

  const disconnect = useCallback((opts?: { preserveState?: boolean }) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const preserve = opts?.preserveState === true;
    if (!preserve) {
      setStatus('idle');
      setMessage(undefined);
      setPhase(undefined);
      setFrames([]);
      setChunks([]);
      setReasoningBySnakeId({});
      setPlayerNameBySnakeId({});
      setFinalSummary(null);
      setError(null);
      setCurrentMatchIndex(null);
      setTotalMatches(null);
    }
  }, [setCurrentMatchIndex, setError, setFinalSummary, setFrames, setMessage, setPhase, setStatus, setTotalMatches]);

  const connect = useCallback((sessionId: string) => {
    disconnect({ preserveState: false });
    sawInitRef.current = false;
    setStatus('connecting');
    setMessage('Connecting to live stream...');
    setError(null);
    const es = new EventSource(`/api/wormarena/stream/${encodeURIComponent(sessionId)}`);
    eventSourceRef.current = es;

    es.addEventListener('stream.init', () => {
      sawInitRef.current = true;
      setStatus('starting');
      setMessage('Launching match...');
    });

    es.addEventListener('stream.status', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaStreamStatus;
        const mappedState =
          data.state === 'starting'
            ? 'starting'
            : data.state === 'in_progress'
            ? 'in_progress'
            : data.state === 'completed'
            ? 'completed'
            : data.state === 'failed'
            ? 'failed'
            : 'idle';
        setStatus(mappedState);
        if (data.message) setMessage(data.message);
        if (data.phase) setPhase(data.phase);
      } catch (err: any) {
        setError(err?.message || 'Failed to parse status event');
      }
    });

    es.addEventListener('stream.frame', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaFrameEvent;
        setFrames((prev) => [...prev, data]);
      } catch (err: any) {
        setError(err?.message || 'Failed to parse frame event');
      }
    });

    es.addEventListener('stream.chunk', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaStreamChunk;

        setChunks((prev) => {
          const next = [...prev, data];
          if (next.length > 500) {
            return next.slice(next.length - 500);
          }
          return next;
        });

        const meta = (data as any)?.metadata as Record<string, unknown> | undefined;
        const snakeId = typeof meta?.snakeId === 'string' ? meta.snakeId : undefined;
        const playerName = typeof meta?.playerName === 'string' ? meta.playerName : undefined;
        const text = typeof data.content === 'string' ? data.content : typeof data.delta === 'string' ? data.delta : '';

        if (snakeId) {
          if (playerName) {
            setPlayerNameBySnakeId((prev) => ({ ...prev, [snakeId]: playerName }));
          }
          if (text) {
            setReasoningBySnakeId((prev) => ({ ...prev, [snakeId]: text }));
          }
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to parse chunk event');
      }
    });

    es.addEventListener('stream.complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaFinalSummary;
        setFinalSummary(data);
        setStatus('completed');
        setMessage('Match finished');
        es.close();
        eventSourceRef.current = null;
      } catch (err: any) {
        setError(err?.message || 'Failed to parse completion event');
        setStatus('failed');
      }
    });

    es.addEventListener('stream.end', () => {
      setStatus((prev) => (prev === 'failed' ? prev : 'completed'));
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('stream.error', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { message?: string };
        setError(data?.message || 'Match failed');
      } catch {
        setError('Match failed');
      }
      setStatus('failed');
      es.close();
    });

    es.onerror = () => {
      const current = statusRef.current;
      if (current === 'completed' || current === 'failed') {
        es.close();
        eventSourceRef.current = null;
        return;
      }
      if (!sawInitRef.current) {
        setError('Session unavailable');
        setMessage('Live sessions can only be viewed immediately after launch (reconnect not yet supported).');
      } else {
        setError('Connection lost');
      }
      setStatus('failed');
      es.close();
      eventSourceRef.current = null;
    };
  }, [disconnect]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return {
    status,
    message,
    phase,
    frames,
    chunks,
    reasoningBySnakeId,
    playerNameBySnakeId,
    finalSummary,
    error,
    isStarting,
    currentMatchIndex,
    totalMatches,
    startMatch,
    connect,
    disconnect,
  };
}

export default useWormArenaStreaming;
