/*
Author: Cascade (Claude Sonnet 4) / Claude Sonnet 4.6
Date: 2026-03-12
PURPOSE: Game play page for community games. Game logic runs client-side via Pyodide
         (Python in WebAssembly) using the usePyodideGame hook, which drives the
         pyodide-game-worker.js Web Worker. This eliminates all server-side Python
         subprocesses and per-action network round-trips — actions are now instant.

         If Pyodide fails to load (e.g. CDN blocked, no WASM support), the page falls
         back to the server-side session API (POST /session/start + /session/:guid/action)
         so the game still works.

         Play-count tracking remains a fire-and-forget POST to /games/:gameId/play.

         Supports ACTION6 click-on-grid with coordinates. All 7 actions exposed with
         keyboard bindings + a d-pad sidebar. Multi-frame animations step through at
         200ms intervals.

SRP/DRY check: Pass — uses usePyodideGame hook for execution, shared pixel UI primitives.
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  RotateCcw,
  Play,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trophy,
  XCircle,
  Gamepad2,
  Mouse,
  Zap,
  Hash,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Arc3GridVisualization } from '@/components/arc3/Arc3GridVisualization';
import { Arc3PixelPage, PixelButton, PixelPanel } from '@/components/arc3-community/Arc3PixelUI';
import { usePyodideGame, type PyodideFrameData } from '@/hooks/usePyodideGame';

// ─── Types ────────────────────────────────────────────────────────────────────

// Server-session FrameData shape (fallback mode only)
interface ServerFrameData {
  frame: number[][][];
  score: number;
  state: string;
  action_counter: number;
  max_actions: number;
  win_score: number;
  available_actions: string[];
  last_action: string;
  levels_completed?: number;
}

interface StartGameResponse {
  success: boolean;
  data: {
    sessionGuid: string;
    frame: ServerFrameData;
    game: { gameId: string; displayName: string; winScore: number; maxActions: number | null };
  };
}

interface ActionResponse {
  success: boolean;
  data: { frame: ServerFrameData; isGameOver: boolean; isWin: boolean };
}

interface GameDetails {
  gameId: string;
  displayName: string;
  description: string | null;
  authorName: string;
  winScore?: number;
  maxActions?: number | null;
}

type GameState = 'idle' | 'playing' | 'won' | 'lost';

// Unified frame shape accepted by the render layer
type AnyFrameData = PyodideFrameData | ServerFrameData;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();

  // ── Pyodide hook (primary path) ──────────────────────────────────────────────
  const pyodide = usePyodideGame();

  // ── Server-session fallback state ────────────────────────────────────────────
  const [sessionGuid, setSessionGuid] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);

  // ── Shared display state ─────────────────────────────────────────────────────
  const [frame, setFrame] = useState<AnyFrameData | null>(null);
  const [gameInfo, setGameInfo] = useState<{ displayName: string; winScore: number; maxActions: number | null } | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const prevLevelsCompleted = useRef<number>(0);
  const [levelCelebration, setLevelCelebration] = useState<number | null>(null);
  const [displayFrameIndex, setDisplayFrameIndex] = useState<number>(0);
  const frameAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep frame in sync with Pyodide hook when in primary mode
  useEffect(() => {
    if (!useFallback && pyodide.frame) {
      setFrame(pyodide.frame);
    }
  }, [pyodide.frame, useFallback]);

  // Detect Pyodide failure → switch to fallback
  useEffect(() => {
    if (pyodide.pyodideFailed && !useFallback) {
      setUseFallback(true);
    }
  }, [pyodide.pyodideFailed, useFallback]);

  // ── Game metadata query ──────────────────────────────────────────────────────
  const { data: gameDetails } = useQuery<{ success: boolean; data: GameDetails }>({
    queryKey: [`/api/arc3-community/games/${gameId}`],
    enabled: !!gameId,
  });

  // ── Server-session fallback mutations ────────────────────────────────────────
  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/arc3-community/session/start', { gameId });
      return response.json() as Promise<StartGameResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        setSessionGuid(data.data.sessionGuid);
        applyFrame(data.data.frame, false, false);
        setGameInfo(data.data.game);
        setGameState('playing');
      }
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (payload: string | { action: string; coordinates?: [number, number] }) => {
      if (!sessionGuid) throw new Error('No active session');
      const body = typeof payload === 'string' ? { action: payload } : payload;
      const response = await apiRequest('POST', `/api/arc3-community/session/${sessionGuid}/action`, body);
      return response.json() as Promise<ActionResponse>;
    },
    onSuccess: (data) => {
      if (data.success) {
        applyFrame(data.data.frame, data.data.isGameOver, data.data.isWin);
      }
    },
  });

  // ── Frame application (shared between Pyodide + fallback paths) ──────────────
  const applyFrame = useCallback((
    newFrame: AnyFrameData,
    isGameOver: boolean,
    isWin: boolean,
  ) => {
    const newLevels = ('levels_completed' in newFrame ? newFrame.levels_completed : undefined) ?? newFrame.score ?? 0;

    if (newLevels > prevLevelsCompleted.current && !isGameOver) {
      setLevelCelebration(newLevels);
      setTimeout(() => setLevelCelebration(null), 1500);
    }
    prevLevelsCompleted.current = newLevels;
    setFrame(newFrame);

    // Step through animation frames at 200ms each
    const totalFrames = newFrame.frame?.length ?? 1;
    if (totalFrames > 1) {
      setDisplayFrameIndex(0);
      if (frameAnimationRef.current) clearTimeout(frameAnimationRef.current);
      let idx = 0;
      const stepFrame = () => {
        idx++;
        if (idx < totalFrames) {
          setDisplayFrameIndex(idx);
          frameAnimationRef.current = setTimeout(stepFrame, 200);
        }
      };
      frameAnimationRef.current = setTimeout(stepFrame, 200);
    } else {
      setDisplayFrameIndex(0);
    }

    if (isGameOver) {
      setGameState(isWin ? 'won' : 'lost');
    }
  }, []);

  // Detect win/loss from Pyodide frame state string
  const detectGameOver = useCallback((f: PyodideFrameData) => {
    const s = f.state?.toUpperCase?.() ?? '';
    const isWin = s === 'WIN' || s === 'WON';
    const isLoss = s === 'GAME_OVER' || s === 'LOSE' || s === 'LOST';
    return { isGameOver: isWin || isLoss, isWin };
  }, []);

  // ── Keyboard handler ─────────────────────────────────────────────────────────
  const isActing = useFallback ? actionMutation.isPending : pyodide.isActing;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isActing || gameState !== 'playing') return;

    const keyMap: Record<string, string> = {
      ArrowUp: 'ACTION1', ArrowDown: 'ACTION2', ArrowLeft: 'ACTION3', ArrowRight: 'ACTION4',
      w: 'ACTION1', s: 'ACTION2', a: 'ACTION3', d: 'ACTION4',
      ' ': 'ACTION5', Enter: 'ACTION5',
      q: 'ACTION7', e: 'ACTION7',
      '1': 'ACTION1', '2': 'ACTION2', '3': 'ACTION3', '4': 'ACTION4',
      '5': 'ACTION5', '7': 'ACTION7',
      r: 'RESET',
    };

    const action = keyMap[e.key];
    if (action) {
      e.preventDefault();
      void handleAction(action);
    }
  }, [isActing, gameState]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // ── Action dispatcher (Pyodide primary, server fallback) ─────────────────────
  const handleAction = useCallback(async (
    actionStr: string,
    coordinates?: [number, number],
  ) => {
    if (useFallback) {
      if (actionStr === 'RESET') {
        actionMutation.mutate('RESET');
      } else if (coordinates) {
        actionMutation.mutate({ action: actionStr, coordinates });
      } else {
        actionMutation.mutate(actionStr);
      }
      return;
    }

    try {
      const data = coordinates
        ? await pyodide.step(actionStr, { x: coordinates[0], y: coordinates[1] })
        : actionStr === 'RESET'
          ? await pyodide.reset()
          : await pyodide.step(actionStr);

      const { isGameOver, isWin } = detectGameOver(data);
      applyFrame(data, isGameOver, isWin);
    } catch {
      // Worker error — already reflected in pyodide.error state
    }
  }, [useFallback, pyodide, actionMutation, applyFrame, detectGameOver]);

  // ── Start game ───────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setGameState('playing');
    prevLevelsCompleted.current = 0;
    setLevelCelebration(null);
    setDisplayFrameIndex(0);

    if (useFallback) {
      startGameMutation.mutate();
      return;
    }

    try {
      // Lazy-init Pyodide + load game in one call
      const initialFrame = await pyodide.initGame(gameId!);
      const details = gameDetails?.data;
      setGameInfo({
        displayName: details?.displayName ?? gameId ?? '',
        winScore: details?.winScore ?? initialFrame.win_score,
        maxActions: details?.maxActions ?? initialFrame.max_actions,
      });
      applyFrame(initialFrame, false, false);

      // Fire-and-forget play count
      fetch(`/api/arc3-community/games/${gameId}/play`, { method: 'POST' }).catch(() => {});
    } catch {
      // pyodide.pyodideFailed will be set → useFallback effect triggers
    }
  }, [useFallback, pyodide, gameId, gameDetails, startGameMutation, applyFrame]);

  // Reset current level
  const handleReset = useCallback(() => {
    if (gameState !== 'playing' && gameState !== 'lost') return;
    setGameState('playing');
    void handleAction('RESET');
  }, [gameState, handleAction]);

  // Full restart from idle
  const handlePlayAgain = useCallback(() => {
    setSessionGuid(null);
    setFrame(null);
    setGameInfo(null);
    setGameState('idle');
    prevLevelsCompleted.current = 0;
    setLevelCelebration(null);
  }, []);

  // ── Loading state derivation ─────────────────────────────────────────────────
  const isStarting = useFallback
    ? startGameMutation.isPending
    : pyodide.status === 'loading';

  const loadingMessage = useFallback
    ? 'Connecting to server...'
    : (pyodide.loadingMessage ?? 'Initialising...');

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Arc3PixelPage>
      {/* Header */}
      <header className="border-b-2 border-[var(--arc3-border)] bg-[var(--arc3-bg-soft)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/arc3/gallery">
              <PixelButton tone="neutral">
                <ArrowLeft className="w-4 h-4" />
                Gallery
              </PixelButton>
            </Link>
            <span className="text-[var(--arc3-dim)]">|</span>
            <Gamepad2 className="w-5 h-5 text-[var(--arc3-c14)]" />
            <div className="min-w-0">
              <span className="text-sm font-semibold truncate">
                {gameInfo?.displayName || gameDetails?.data?.displayName || 'Loading...'}
              </span>
              {gameDetails?.data && (
                <span className="text-[11px] text-[var(--arc3-dim)] ml-2">
                  by {gameDetails.data.authorName}
                </span>
              )}
            </div>
          </div>

          {/* Son Pham's official site link */}
          <a
            href="https://arc3.sonpham.net"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--arc3-dim)] hover:text-[var(--arc3-c14)] transition-colors shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            arc3.sonpham.net
          </a>

          {frame && gameState === 'playing' && (
            <div className="flex items-center gap-3 text-xs shrink-0">
              <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-c14)] text-[var(--arc3-c0)] px-2 py-1 font-semibold">
                Level: {(('levels_completed' in frame ? frame.levels_completed : frame.score) ?? 0) + 1}
              </div>
              <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] px-2 py-1">
                Actions: {frame.action_counter}
              </div>
              {useFallback && (
                <div className="border-2 border-[var(--arc3-border)] border-yellow-500 bg-yellow-900/30 text-yellow-400 px-2 py-1 text-[10px] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Server mode
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Game Grid */}
          <div className="lg:col-span-3">
            {/* Pyodide error notice (non-fatal if fallback kicked in) */}
            {pyodide.error && useFallback && (
              <div className="mb-4 border-2 border-yellow-600 bg-yellow-900/20 px-4 py-2 flex items-center gap-2 text-[11px] text-yellow-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                In-browser mode unavailable ({pyodide.error}). Running on server instead.
              </div>
            )}

            {/* Win overlay */}
            {gameState === 'won' && (
              <PixelPanel tone="green" title="Victory!" className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-[var(--arc3-c11)]" />
                    <div>
                      <p className="text-sm font-semibold">Congratulations!</p>
                      <p className="text-[11px] text-[var(--arc3-muted)]">
                        Final score: {frame?.score} | Actions: {frame?.action_counter}
                      </p>
                    </div>
                  </div>
                  <PixelButton tone="green" onClick={handlePlayAgain}>
                    <Play className="w-4 h-4" />
                    Play Again
                  </PixelButton>
                </div>
              </PixelPanel>
            )}

            {/* Loss overlay */}
            {gameState === 'lost' && (
              <PixelPanel tone="danger" title="Game Over" className="mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <XCircle className="w-8 h-8 text-[var(--arc3-c8)]" />
                    <div>
                      <p className="text-sm font-semibold">Better luck next time!</p>
                      <p className="text-[11px] text-[var(--arc3-muted)]">
                        Final score: {frame?.score} | Actions: {frame?.action_counter}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <PixelButton tone="yellow" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4" />
                      Retry
                    </PixelButton>
                    <PixelButton tone="green" onClick={handlePlayAgain}>
                      <Play className="w-4 h-4" />
                      New Game
                    </PixelButton>
                  </div>
                </div>
              </PixelPanel>
            )}

            {/* Level celebration */}
            {levelCelebration !== null && (
              <div
                className="mb-4 border-2 border-[var(--arc3-border)] px-4 py-3 flex items-center gap-3 animate-pulse"
                style={{ backgroundColor: 'var(--arc3-c14)', color: 'var(--arc3-c0)' }}
              >
                <Trophy className="w-6 h-6" />
                <div>
                  <p className="text-sm font-bold">Level Complete!</p>
                  <p className="text-[11px] opacity-80">Advancing to level {levelCelebration + 1}...</p>
                </div>
              </div>
            )}

            <PixelPanel tone="blue">
              {gameState === 'idle' ? (
                <div className="text-center py-12">
                  <Gamepad2 className="w-12 h-12 text-[var(--arc3-dim)] mx-auto mb-4" />
                  <p className="text-sm font-semibold mb-2">
                    {gameDetails?.data?.displayName || 'Community Game'}
                  </p>
                  <p className="text-[11px] text-[var(--arc3-muted)] mb-6 max-w-md mx-auto">
                    {gameDetails?.data?.description || 'Start the game to begin playing'}
                  </p>
                  <PixelButton
                    tone="green"
                    onClick={() => void handleStart()}
                    disabled={isStarting}
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Start Game
                      </>
                    )}
                  </PixelButton>
                </div>
              ) : frame?.frame ? (
                <div className="mx-auto" style={{ maxWidth: '512px' }}>
                  <Arc3GridVisualization
                    grid={frame.frame}
                    frameIndex={displayFrameIndex}
                    cellSize={8}
                    showGrid={false}
                    showCoordinates={false}
                    className="w-full"
                    onCellClick={(x, y) => {
                      if (gameState === 'playing' && !isActing) {
                        void handleAction('ACTION6', [x, y]);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--arc3-c14)] animate-spin mx-auto" />
                  <p className="text-[11px] text-[var(--arc3-dim)] mt-3">{loadingMessage}</p>
                </div>
              )}
            </PixelPanel>
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* D-Pad */}
            <PixelPanel tone="blue" title="Movement" subtitle="Arrow keys or WASD">
              <div className="flex flex-col items-center gap-1.5">
                <PixelButton
                  tone="blue"
                  onClick={() => void handleAction('ACTION1')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-14 h-14"
                  title="Move Up (W / Arrow Up)"
                >
                  <div className="flex flex-col items-center leading-none">
                    <ChevronUp className="w-6 h-6" />
                    <span className="text-[9px] opacity-70 mt-0.5">W</span>
                  </div>
                </PixelButton>

                <div className="flex gap-1.5 items-center">
                  <PixelButton
                    tone="blue"
                    onClick={() => void handleAction('ACTION3')}
                    disabled={!frame || isActing || gameState !== 'playing'}
                    className="w-14 h-14"
                    title="Move Left (A / Arrow Left)"
                  >
                    <div className="flex flex-col items-center leading-none">
                      <ChevronLeft className="w-6 h-6" />
                      <span className="text-[9px] opacity-70 mt-0.5">A</span>
                    </div>
                  </PixelButton>
                  <div className="w-14 h-14 border-2 border-dashed border-[var(--arc3-border)] opacity-30" />
                  <PixelButton
                    tone="blue"
                    onClick={() => void handleAction('ACTION4')}
                    disabled={!frame || isActing || gameState !== 'playing'}
                    className="w-14 h-14"
                    title="Move Right (D / Arrow Right)"
                  >
                    <div className="flex flex-col items-center leading-none">
                      <ChevronRight className="w-6 h-6" />
                      <span className="text-[9px] opacity-70 mt-0.5">D</span>
                    </div>
                  </PixelButton>
                </div>

                <PixelButton
                  tone="blue"
                  onClick={() => void handleAction('ACTION2')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-14 h-14"
                  title="Move Down (S / Arrow Down)"
                >
                  <div className="flex flex-col items-center leading-none">
                    <ChevronDown className="w-6 h-6" />
                    <span className="text-[9px] opacity-70 mt-0.5">S</span>
                  </div>
                </PixelButton>
              </div>
            </PixelPanel>

            {/* Action Buttons */}
            <PixelPanel tone="green" title="Actions">
              <div className="space-y-2">
                <PixelButton
                  tone="green"
                  onClick={() => void handleAction('ACTION5')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-full h-11"
                  title="Interact / Confirm (Space / Enter)"
                >
                  <Zap className="w-4 h-4" />
                  <span>Action</span>
                  <span className="ml-auto text-[9px] opacity-70 font-mono">Space</span>
                </PixelButton>

                <PixelButton
                  tone="pink"
                  onClick={() => {/* ACTION6 is grid-click only */}}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-full h-11"
                  title="Click on the game grid to interact with a specific cell"
                >
                  <Mouse className="w-4 h-4" />
                  <span>Click Grid</span>
                  <span className="ml-auto text-[9px] opacity-70 font-mono">Mouse</span>
                </PixelButton>

                <PixelButton
                  tone="orange"
                  onClick={() => void handleAction('ACTION7')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-full h-11"
                  title="Secondary Action (Q / E)"
                >
                  <Hash className="w-4 h-4" />
                  <span>Alt Action</span>
                  <span className="ml-auto text-[9px] opacity-70 font-mono">Q / E</span>
                </PixelButton>
              </div>
            </PixelPanel>

            {/* Reset */}
            <PixelButton
              tone="neutral"
              onClick={handleReset}
              disabled={!frame || isActing}
              className="w-full h-9 text-[11px]"
              title="Reset current level (R)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Level</span>
              <span className="ml-auto text-[9px] opacity-60 font-mono">R</span>
            </PixelButton>
          </div>
        </div>
      </main>
    </Arc3PixelPage>
  );
}
