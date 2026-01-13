/**
 * Author: Cascade / Claude Sonnet 4
 * Date: 2025-12-18 (updated 2025-12-18)
 * PURPOSE: React hook for Worm Arena live match streaming via SSE.
 *          One session = one match. Handles connection, frame streaming, and final summary.
 *          Batch mode removed - all matches are single-session.
 *          Now includes unified eventLog for Console Mirror view.
 * SRP/DRY check: Pass - manages SSE connection state only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SnakeBenchRunMatchRequest,
  WormArenaFrameEvent,
  WormArenaFinalSummary,
  WormArenaStreamStatus,
  WormArenaStreamChunk,
  WormArenaPlayerTiming,
  WormArenaRoundTiming,
} from '@shared/types';
import { computeTimerSeconds } from '@/lib/wormArena/timerUtils';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

/**
 * Event log entry for Console Mirror view.
 * Captures all SSE events in chronological order.
 */
export interface WormArenaEventLogEntry {
  /** SSE event type (init, status, frame, chunk, complete, error, end) */
  type: string;
  /** Client-side timestamp when event was received */
  timestamp: number;
  /** Raw payload data */
  payload: unknown;
  /** Human-readable summary for display */
  summary?: string;
}

/** Maximum number of event log entries to retain (prevents memory bloat) */
const MAX_EVENT_LOG_SIZE = 1000;

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
  const [eventLog, setEventLog] = useState<WormArenaEventLogEntry[]>([]);
  const statusRef = useRef<StreamState>('idle');
  const sawInitRef = useRef(false);
  const [matchStartedAt, setMatchStartedAt] = useState<number | null>(null);
  const [lastMoveAt, setLastMoveAt] = useState<number | null>(null);
  const [wallClockSeconds, setWallClockSeconds] = useState<number | null>(null);
  const [sinceLastMoveSeconds, setSinceLastMoveSeconds] = useState<number | null>(null);
  const [playerTiming, setPlayerTiming] = useState<Record<string, WormArenaPlayerTiming>>({});
  const [roundTiming, setRoundTiming] = useState<WormArenaRoundTiming[]>([]);

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

  /**
   * Append an entry to the event log, capping at MAX_EVENT_LOG_SIZE.
   */
  const appendEventLog = useCallback((entry: WormArenaEventLogEntry) => {
    setEventLog((prev) => {
      const next = [...prev, entry];
      if (next.length > MAX_EVENT_LOG_SIZE) {
        return next.slice(next.length - MAX_EVENT_LOG_SIZE);
      }
      return next;
    });
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
      setEventLog([]);
      setCurrentMatchIndex(null);
      setTotalMatches(null);
      setMatchStartedAt(null);
      setLastMoveAt(null);
      setWallClockSeconds(null);
      setSinceLastMoveSeconds(null);
      setPlayerTiming({});
      setRoundTiming([]);
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

    es.addEventListener('stream.init', (event) => {
      sawInitRef.current = true;
      setStatus('starting');
      setMessage('Launching match...');
      try {
        const data = JSON.parse((event as MessageEvent).data);
        appendEventLog({
          type: 'init',
          timestamp: Date.now(),
          payload: data,
          summary: `Session initialized: ${data?.payload?.modelA ?? '?'} vs ${data?.payload?.modelB ?? '?'}`,
        });
      } catch {
        appendEventLog({
          type: 'init',
          timestamp: Date.now(),
          payload: null,
          summary: 'Session initialized',
        });
      }
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
        if (Number.isFinite(data.matchStartedAt)) {
          setMatchStartedAt((prev) => (prev ?? data.matchStartedAt!) as number);
        }
        if (Number.isFinite(data.lastMoveAt)) {
          setLastMoveAt(data.lastMoveAt!);
        }
        appendEventLog({
          type: 'status',
          timestamp: Date.now(),
          payload: data,
          summary: data.message ?? `State: ${data.state}`,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to parse status event');
      }
    });

    es.addEventListener('stream.frame', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaFrameEvent;
        setFrames((prev) => [...prev, data]);
        if (Number.isFinite(data.matchStartedAt)) {
          setMatchStartedAt((prev) => (prev ?? data.matchStartedAt!) as number);
        }
        if (Number.isFinite(data.lastMoveAt)) {
          setLastMoveAt(data.lastMoveAt!);
        } else {
          setLastMoveAt(Date.now());
        }
        const round = (data as any)?.round;
        appendEventLog({
          type: 'frame',
          timestamp: Date.now(),
          payload: data,
          summary: `Frame: round ${round ?? '?'}`,
        });
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
        // Log chunk to event log (truncate long text for summary)
        const truncatedText = text.length > 80 ? text.slice(0, 80) + '...' : text;
        appendEventLog({
          type: 'chunk',
          timestamp: Date.now(),
          payload: data,
          summary: `[${playerName ?? snakeId ?? 'unknown'}] ${truncatedText}`,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to parse chunk event');
      }
    });

    es.addEventListener('stream.complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaFinalSummary;
        if (data.playerTiming) {
          setPlayerTiming(data.playerTiming);
        }
        if (data.roundTiming) {
          setRoundTiming(data.roundTiming);
        }
        setFinalSummary(data);
        setStatus('completed');
        setMessage('Match completed');
        appendEventLog({
          type: 'complete',
          timestamp: Date.now(),
          payload: data,
          summary: `Match completed: ${data.gameId}`,
        });
      } catch (err: any) {
        setError(err?.message || 'Failed to parse complete event');
      }
    });

    es.addEventListener('stream.end', () => {
      setStatus((prev) => (prev === 'failed' ? prev : 'completed'));
      appendEventLog({
        type: 'end',
        timestamp: Date.now(),
        payload: null,
        summary: 'Stream ended',
      });
      es.close();
      eventSourceRef.current = null;
    });

    es.addEventListener('stream.error', (event) => {
      let errorMsg = 'Match failed';
      try {
        const data = JSON.parse((event as MessageEvent).data) as { message?: string };
        errorMsg = data?.message || 'Match failed';
        setError(errorMsg);
        appendEventLog({
          type: 'error',
          timestamp: Date.now(),
          payload: data,
          summary: `Error: ${errorMsg}`,
        });
      } catch {
        setError('Match failed');
        appendEventLog({
          type: 'error',
          timestamp: Date.now(),
          payload: null,
          summary: 'Error: Match failed',
        });
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

  useEffect(() => {
    if (!matchStartedAt) {
      setWallClockSeconds(null);
      setSinceLastMoveSeconds(null);
      return;
    }

    // Stop ticking when match is completed or failed
    if (status === 'completed' || status === 'failed') {
      return;
    }

    const updateTimers = () => {
      const now = Date.now();
      const { wallClockSeconds: wall, sinceLastMoveSeconds: since } = computeTimerSeconds(
        matchStartedAt,
        lastMoveAt,
        now,
      );
      setWallClockSeconds(wall);
      setSinceLastMoveSeconds(since);
    };

    updateTimers();
    const handle = window.setInterval(updateTimers, 500);
    return () => {
      window.clearInterval(handle);
    };
  }, [matchStartedAt, lastMoveAt, status]);

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
    eventLog,
    matchStartedAt,
    lastMoveAt,
    wallClockSeconds,
    sinceLastMoveSeconds,
    playerTiming,
    roundTiming,
    startMatch,
    connect,
    disconnect,
  };
}

export default useWormArenaStreaming;
