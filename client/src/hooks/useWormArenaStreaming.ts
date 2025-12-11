import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  SnakeBenchRunMatchRequest,
  WormArenaFrameEvent,
  WormArenaFinalSummary,
  WormArenaStreamStatus,
  WormArenaBatchMatchStart,
  WormArenaBatchMatchComplete,
  WormArenaBatchComplete,
  WormArenaBatchError,
} from '@shared/types';

type StreamState = 'idle' | 'connecting' | 'starting' | 'in_progress' | 'completed' | 'failed';

export function useWormArenaStreaming() {
  const [status, setStatus] = useState<StreamState>('idle');
  const [message, setMessage] = useState<string | undefined>();
  const [phase, setPhase] = useState<string | undefined>();
  const [frames, setFrames] = useState<WormArenaFrameEvent[]>([]);
  const [finalSummary, setFinalSummary] = useState<WormArenaFinalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  // Batch state
  const [batchResults, setBatchResults] = useState<WormArenaBatchMatchComplete[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const startMatch = useCallback(async (payload: SnakeBenchRunMatchRequest, opponents: string[] = []) => {
    setIsStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/wormarena/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          opponents: opponents.length > 0 ? opponents : undefined,
        }),
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

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
    setMessage(undefined);
    setPhase(undefined);
    setFrames([]);
    setFinalSummary(null);
    setError(null);
  }, []);

  const connect = useCallback((sessionId: string) => {
    disconnect();
    setStatus('connecting');
    const es = new EventSource(`/api/wormarena/stream/${encodeURIComponent(sessionId)}`);
    eventSourceRef.current = es;

    es.addEventListener('stream.init', () => {
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

    es.addEventListener('stream.complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaFinalSummary;
        setFinalSummary(data);
        setStatus('completed');
        setMessage('Match finished');
      } catch (err: any) {
        setError(err?.message || 'Failed to parse completion event');
        setStatus('failed');
      }
    });

    // Batch events
    es.addEventListener('batch.init', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as { totalMatches: number; modelA: string; modelB: string };
        setStatus('starting');
        setTotalMatches(data.totalMatches);
        setBatchResults([]);
        setCurrentMatchIndex(null);
        setMessage(`Preparing batch of ${data.totalMatches} matches...`);
      } catch (err: any) {
        setError(err?.message || 'Failed to parse batch init event');
      }
    });

    es.addEventListener('batch.match.start', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaBatchMatchStart;
        setCurrentMatchIndex(data.index);
        setStatus('in_progress');
        setMessage(`Running match ${data.index} of ${data.total}...`);
      } catch (err: any) {
        setError(err?.message || 'Failed to parse match start event');
      }
    });

    es.addEventListener('batch.match.complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaBatchMatchComplete;
        setBatchResults((prev) => [...prev, data]);
      } catch (err: any) {
        setError(err?.message || 'Failed to parse match complete event');
      }
    });

    es.addEventListener('batch.error', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaBatchError;
        setError(`Match ${data.index} failed: ${data.error}`);
        // Continue running batch despite error
      } catch (err: any) {
        setError(err?.message || 'Match error');
      }
    });

    es.addEventListener('batch.complete', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as WormArenaBatchComplete;
        setStatus('completed');
        setMessage(`Batch complete: ${data.completedMatches}/${data.totalMatches} matches finished`);
        if (data.failedMatches > 0) {
          setError(`${data.failedMatches} matches failed`);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to parse batch complete event');
        setStatus('failed');
      }
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
      setError('Connection lost');
      setStatus('failed');
      es.close();
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
    finalSummary,
    error,
    isStarting,
    batchResults,
    currentMatchIndex,
    totalMatches,
    startMatch,
    connect,
    disconnect,
  };
}

export default useWormArenaStreaming;
