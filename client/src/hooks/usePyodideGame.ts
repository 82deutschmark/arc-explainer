/*
Author: Claude Sonnet 4.6
Date: 2026-03-12
PURPOSE: React hook that manages the Pyodide Web Worker lifecycle for client-side
         ARCEngine community game execution. Replaces the server-side Python subprocess
         bridge (CommunityGamePythonBridge + CommunityGameRunner) for the community game
         play page, eliminating per-action network round-trips.

         Responsibilities:
           - Lazy-create and own the pyodide-game-worker.js Web Worker
           - Drive init → load_game → step/reset message flow
           - Wrap every worker postMessage in a promise with 30s timeout
           - Expose typed FrameData + loading stages to the component
           - Expose `pyodideFailed` so the component can fall back to server sessions
           - Clean up the worker on unmount

         NOT responsible for: play-count tracking, win/loss persistence, session DB records.
         Those remain in the component (fire-and-forget HTTP calls).

SRP/DRY check: Pass — single responsibility: Pyodide worker lifecycle for game play.
*/

import { useCallback, useEffect, useRef, useState } from 'react';

// Matches the shape emitted by pyodide-game-worker.js and the existing CommunityGamePlay interface.
export interface PyodideFrameData {
  frame: number[][][];          // list of animation frames, each a 2D grid
  score: number;
  levels_completed: number;
  win_score: number;
  win_levels: number;
  state: string;                // e.g. "NOT_FINISHED", "WIN", "GAME_OVER"
  action_counter: number;
  max_actions: number;
  available_actions: number[];
  last_action: string;
}

export type PyodideInitStage = 'pyodide' | 'packages' | 'arcengine' | 'game';

export type PyodideStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PyodideGameState {
  status: PyodideStatus;
  frame: PyodideFrameData | null;
  loadingStage: PyodideInitStage | null;
  loadingMessage: string | null;
  error: string | null;
  /** True if Pyodide failed to initialise — component should fall back to server mode. */
  pyodideFailed: boolean;
}

export interface UsePyodideGameReturn extends PyodideGameState {
  /** Fetch source, initialise worker if needed, load game, return initial frame. */
  initGame: (gameId: string) => Promise<PyodideFrameData>;
  /** Send an action to the running game instance. */
  step: (action: string, data?: Record<string, number>) => Promise<PyodideFrameData>;
  /** Reset the current game. */
  reset: () => Promise<PyodideFrameData>;
  /** True while a step/reset message is awaiting a response. */
  isActing: boolean;
}

// ─── Worker message types ─────────────────────────────────────────────────────
interface WorkerOutMessage {
  type: 'ready' | 'frame' | 'error' | 'progress';
  id: number;
  frame?: PyodideFrameData;
  message?: string;
  stage?: PyodideInitStage;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
const WORKER_PATH = '/pyodide-game-worker.js';
const CALL_TIMEOUT_MS = 60_000; // generous — arcengine CDN fetch can be slow

export function usePyodideGame(): UsePyodideGameReturn {
  const workerRef = useRef<Worker | null>(null);
  const callIdRef = useRef(0);
  const pendingRef = useRef<Map<number, { resolve: (f: PyodideFrameData) => void; reject: (e: Error) => void }>>(new Map());
  const workerReadyRef = useRef<Promise<void> | null>(null);

  const [status, setStatus] = useState<PyodideStatus>('idle');
  const [frame, setFrame] = useState<PyodideFrameData | null>(null);
  const [loadingStage, setLoadingStage] = useState<PyodideInitStage | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pyodideFailed, setPyodideFailed] = useState(false);
  const [isActing, setIsActing] = useState(false);

  // Clean up worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  // ── Send a message to the worker and await its response ──────────────────────
  const sendToWorker = useCallback(<T extends PyodideFrameData | void>(
    msg: Record<string, unknown>,
    expectFrame: boolean,
  ): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error('Worker not initialised'));
        return;
      }

      const id = ++callIdRef.current;
      const timer = setTimeout(() => {
        pendingRef.current.delete(id);
        reject(new Error(`Worker call timed out after ${CALL_TIMEOUT_MS / 1000}s`));
      }, CALL_TIMEOUT_MS);

      if (expectFrame) {
        pendingRef.current.set(id, {
          resolve: (f) => {
            clearTimeout(timer);
            resolve(f as T);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
      } else {
        // For init: resolve on 'ready', reject on 'error'
        (pendingRef.current as Map<number, { resolve: (f: PyodideFrameData) => void; reject: (e: Error) => void }>).set(id, {
          resolve: () => {
            clearTimeout(timer);
            (resolve as (v: void) => void)(undefined);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
      }

      workerRef.current.postMessage({ ...msg, id });
    });
  }, []);

  // ── Ensure worker is created and Pyodide is initialised ─────────────────────
  const ensureWorkerReady = useCallback((): Promise<void> => {
    if (workerReadyRef.current) return workerReadyRef.current;

    const promise = new Promise<void>((resolve, reject) => {
      const worker = new Worker(WORKER_PATH);
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const { type, id, frame: msgFrame, message, stage } = e.data;

        if (type === 'progress') {
          setLoadingStage(stage ?? null);
          setLoadingMessage(message ?? null);
          return;
        }

        const pending = pendingRef.current.get(id);
        if (!pending) return;

        if (type === 'ready') {
          pendingRef.current.delete(id);
          pending.resolve(undefined as unknown as PyodideFrameData);
        } else if (type === 'frame' && msgFrame) {
          pendingRef.current.delete(id);
          pending.resolve(msgFrame);
        } else if (type === 'error') {
          pendingRef.current.delete(id);
          pending.reject(new Error(message ?? 'Unknown worker error'));
        }
      };

      worker.onerror = (e) => {
        const err = new Error(e.message ?? 'Worker crashed');
        // Reject all pending calls
        for (const p of pendingRef.current.values()) p.reject(err);
        pendingRef.current.clear();
        reject(err);
      };

      // Send init — response handled by onmessage above via pending map
      const initId = ++callIdRef.current;
      const timer = setTimeout(() => {
        pendingRef.current.delete(initId);
        const e = new Error(`Pyodide init timed out after ${CALL_TIMEOUT_MS / 1000}s`);
        reject(e);
      }, CALL_TIMEOUT_MS);

      pendingRef.current.set(initId, {
        resolve: () => { clearTimeout(timer); resolve(); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });

      worker.postMessage({ type: 'init', id: initId });
    });

    workerReadyRef.current = promise;
    return promise;
  }, []);

  // ── Public: initGame ─────────────────────────────────────────────────────────
  const initGame = useCallback(async (gameId: string): Promise<PyodideFrameData> => {
    setStatus('loading');
    setError(null);
    setFrame(null);
    setPyodideFailed(false);

    try {
      // Step 1: fetch source + class name from server
      setLoadingStage('game');
      setLoadingMessage('Fetching game source...');
      const res = await fetch(`/api/arc3-community/games/${gameId}/source`);
      if (!res.ok) throw new Error(`Failed to fetch game source: ${res.statusText}`);
      const json = await res.json();
      const { sourceCode, className } = json.data as { sourceCode: string; className: string | null };
      if (!className) throw new Error('Game source does not export an ARCBaseGame subclass');

      // Step 2: boot Pyodide (idempotent)
      setLoadingStage('pyodide');
      setLoadingMessage('Loading Python runtime...');
      await ensureWorkerReady();

      // Step 3: load the game into Pyodide
      setLoadingStage('game');
      setLoadingMessage('Starting game...');
      const initialFrame = await sendToWorker<PyodideFrameData>(
        { type: 'load_game', source: sourceCode, className },
        true,
      );

      setFrame(initialFrame);
      setStatus('ready');
      setLoadingStage(null);
      setLoadingMessage(null);
      return initialFrame;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus('error');
      setPyodideFailed(true);
      setLoadingStage(null);
      setLoadingMessage(null);
      throw err;
    }
  }, [ensureWorkerReady, sendToWorker]);

  // ── Public: step ─────────────────────────────────────────────────────────────
  const step = useCallback(async (
    action: string,
    data?: Record<string, number>,
  ): Promise<PyodideFrameData> => {
    setIsActing(true);
    try {
      const newFrame = await sendToWorker<PyodideFrameData>(
        { type: 'step', action: action.toUpperCase(), data: data ?? null },
        true,
      );
      setFrame(newFrame);
      return newFrame;
    } finally {
      setIsActing(false);
    }
  }, [sendToWorker]);

  // ── Public: reset ────────────────────────────────────────────────────────────
  const reset = useCallback(async (): Promise<PyodideFrameData> => {
    setIsActing(true);
    try {
      const newFrame = await sendToWorker<PyodideFrameData>(
        { type: 'reset' },
        true,
      );
      setFrame(newFrame);
      return newFrame;
    } finally {
      setIsActing(false);
    }
  }, [sendToWorker]);

  return {
    status,
    frame,
    loadingStage,
    loadingMessage,
    error,
    pyodideFailed,
    isActing,
    initGame,
    step,
    reset,
  };
}
