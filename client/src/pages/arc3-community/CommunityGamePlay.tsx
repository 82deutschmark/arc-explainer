/*
Author: Cascade (Claude Sonnet 4) / Claude Sonnet 4.6 / Claude Opus 5
Date: 2026-03-12 / 2026-08-30
PURPOSE: Blind play page for one mirrored ARC-AGI-3 task. Game logic runs client-side via
         Pyodide (Python in WebAssembly) using the usePyodideGame hook, which drives the
         pyodide-game-worker.js Web Worker. No server-side Python, no per-action round
         trips, and no account — which is what lets this be a public, anonymous surface.

         2026-08-30: the server-side session fallback (POST /session/start,
         /session/:guid/action) is gone. It existed because the Pyodide worker had been
         switched to micropip and broke; the worker is now back on arc3.sonpham.net's
         proven wheel-fetch recipe, and the endpoints the fallback called were removed
         with the DB-backed catalog. Pyodide is the only path, so its failures are now
         surfaced to the player instead of being silently papered over.

         NO-SPOILER RULE. This page shows the task id and the frame. It does NOT show the
         task's name, description, tags or author: a player is meant to infer the rules,
         the controls and the goal from the frame, and a header reading "Light Bender"
         destroys the baseline datum this page exists to collect.

         Supports ACTION6 click-on-grid with coordinates. All 7 actions exposed with
         keyboard bindings + a d-pad sidebar. Multi-frame animations step through at
         200ms intervals.

SRP/DRY check: Pass — uses usePyodideGame hook for execution, shared pixel UI primitives.
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'wouter';
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
import { Arc3GridVisualization } from '@/components/arc3/Arc3GridVisualization';
import { Arc3PixelPage, PixelButton, PixelPanel } from '@/components/arc3-community/Arc3PixelUI';
import { usePyodideGame, type PyodideFrameData } from '@/hooks/usePyodideGame';
import { humanPlay } from '@/lib/humanPlayTelemetry';

// ─── Types ────────────────────────────────────────────────────────────────────

type GameState = 'idle' | 'playing' | 'won' | 'lost';

// Frames come only from the Pyodide worker now that the server session path is gone.
type AnyFrameData = PyodideFrameData;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();

  // ── Pyodide hook (primary path) ──────────────────────────────────────────────
  const pyodide = usePyodideGame();

  // ── Shared display state ─────────────────────────────────────────────────────
  const [frame, setFrame] = useState<AnyFrameData | null>(null);
  const [gameInfo, setGameInfo] = useState<{ winScore: number; maxActions: number | null } | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const prevLevelsCompleted = useRef<number>(0);
  const [levelCelebration, setLevelCelebration] = useState<number | null>(null);
  const [displayFrameIndex, setDisplayFrameIndex] = useState<number>(0);
  const frameAnimationRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep frame in sync with the Pyodide hook.
  useEffect(() => {
    if (pyodide.frame) setFrame(pyodide.frame);
  }, [pyodide.frame]);

  // ── Frame application ────────────────────────────────────────────────────────
  const applyFrame = useCallback((
    newFrame: AnyFrameData,
    isGameOver: boolean,
    isWin: boolean,
  ) => {
    const newLevels = newFrame.levels_completed ?? newFrame.score ?? 0;

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
  const isActing = pyodide.isActing;

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

  // ── Action dispatcher ────────────────────────────────────────────────────────
  const handleAction = useCallback(async (
    actionStr: string,
    coordinates?: [number, number],
  ) => {
    try {
      const data = coordinates
        ? await pyodide.step(actionStr, { x: coordinates[0], y: coordinates[1] })
        : actionStr === 'RESET'
          ? await pyodide.reset()
          : await pyodide.step(actionStr);

      const { isGameOver, isWin } = detectGameOver(data);
      // Record after the action resolves so the level and state are the ones it produced.
      humanPlay.record(
        actionStr,
        typeof data?.score === 'number' ? data.score : null,
        isWin ? 'WIN' : isGameOver ? 'GAME_OVER' : 'NOT_FINISHED',
      );
      applyFrame(data, isGameOver, isWin);
    } catch {
      // Worker error — already reflected in pyodide.error state
    }
  }, [pyodide, applyFrame, detectGameOver]);

  // ── Start game ───────────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setGameState('playing');
    // Starts the anonymous run. Nothing is written until the first action.
    humanPlay.start(gameId ?? '');
    prevLevelsCompleted.current = 0;
    setLevelCelebration(null);
    setDisplayFrameIndex(0);

    try {
      // Lazy-init Pyodide + load game in one call. Win score and action cap come from
      // the frame itself -- the mirrored catalog deliberately carries no per-game
      // metadata beyond what is needed to run it.
      const initialFrame = await pyodide.initGame(gameId!);
      setGameInfo({
        winScore: initialFrame.win_score,
        maxActions: initialFrame.max_actions,
      });
      applyFrame(initialFrame, false, false);
    } catch {
      // pyodide.error is set and rendered; there is no second path to try.
    }
  }, [pyodide, gameId, applyFrame]);

  // Reset current level
  const handleReset = useCallback(() => {
    if (gameState !== 'playing' && gameState !== 'lost') return;
    setGameState('playing');
    void handleAction('RESET');
  }, [gameState, handleAction]);

  // Full restart from idle
  const handlePlayAgain = useCallback(() => {
    setFrame(null);
    setGameInfo(null);
    setGameState('idle');
    prevLevelsCompleted.current = 0;
    setLevelCelebration(null);
  }, []);

  // ── Loading state derivation ─────────────────────────────────────────────────
  const isStarting = pyodide.status === 'loading';
  const loadingMessage = pyodide.loadingMessage ?? 'Initialising...';

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
            {/* The id, and only the id. A name here would hand the player the answer. */}
            <div className="min-w-0">
              <span className="text-sm font-semibold truncate">{gameId}</span>
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
                Level: {(frame.levels_completed ?? frame.score ?? 0) + 1}
              </div>
              <div className="border-2 border-[var(--arc3-border)] bg-[var(--arc3-panel-soft)] px-2 py-1">
                Actions: {frame.action_counter}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Game Grid */}
          <div className="lg:col-span-3">
            {/* Pyodide is the only path now, so a failure here is fatal and must say so. */}
            {pyodide.error && (
              <div className="mb-4 border-2 border-yellow-600 bg-yellow-900/20 px-4 py-2 flex items-center gap-2 text-[11px] text-yellow-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This task could not start in your browser ({pyodide.error}). It needs
                WebAssembly and access to the Pyodide CDN.
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

            {/* Level clear.
                Overlaid on the board rather than inserted above it: as a block in the
                flow it pushed the whole game down the moment it appeared and pulled it
                back up 1.5s later, so the board visibly jumped twice per level. It is
                also no longer `animate-pulse` -- a flashing panel over a game reads as
                an error, and it flashed for the entire time it was mounted. */}
            <div className="relative">
              {levelCelebration !== null && (
                <div
                  className="arc3-level-clear absolute inset-x-0 top-0 z-20 flex items-center gap-3 px-4 py-3
                             border-b-2 border-[var(--arc3-border)] pointer-events-none"
                  style={{ backgroundColor: 'var(--arc3-c14)', color: 'var(--arc3-c5)' }}
                  role="status"
                  aria-live="polite"
                >
                  <Trophy className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-bold tracking-wide">
                    Level {levelCelebration} clear
                  </p>
                </div>
              )}

            <PixelPanel tone="blue">
              {gameState === 'idle' ? (
                <div className="text-center py-12">
                  <Gamepad2 className="w-12 h-12 text-[var(--arc3-dim)] mx-auto mb-4" />
                  <p className="text-sm font-semibold mb-2">{gameId}</p>
                  <p className="text-[11px] text-[var(--arc3-muted)] mb-6 max-w-md mx-auto">
                    {'No instructions. Work out what it does.'}
                  </p>
                  <p className="text-[10px] text-[var(--arc3-dim)] mt-3 max-w-[46ch] mx-auto leading-relaxed">
                    {'Anonymous gameplay events are recorded \u2014 inputs, timings, progress \u2014 so human play can be compared to AI play. No account, no personal data.'}
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
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {/* D-Pad */}
            <PixelPanel tone="blue" title="D-PAD" subtitle="Arrows / WASD">
              <div className="flex flex-col items-center gap-1.5">
                <PixelButton
                  tone="blue"
                  onClick={() => void handleAction('ACTION1')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-14 h-14"
                  title="W / Arrow Up"
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
                    title="A / Arrow Left"
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
                    title="D / Arrow Right"
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
                  title="S / Arrow Down"
                >
                  <div className="flex flex-col items-center leading-none">
                    <ChevronDown className="w-6 h-6" />
                    <span className="text-[9px] opacity-70 mt-0.5">S</span>
                  </div>
                </PixelButton>
              </div>
            </PixelPanel>

            {/* Action Buttons */}
            <PixelPanel tone="green" title="BUTTONS">
              <div className="space-y-2">
                <PixelButton
                  tone="green"
                  onClick={() => void handleAction('ACTION5')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-full h-11"
                  title="Space / Enter"
                >
                  <Zap className="w-4 h-4" />
                  <span>SPACEBAR</span>
                </PixelButton>

                <PixelButton
                  tone="pink"
                  onClick={() => {/* ACTION6 is grid-click only */}}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-full h-11"
                  title="Click the grid"
                >
                  <Mouse className="w-4 h-4" />
                  <span>CLICK</span>
                </PixelButton>

                <PixelButton
                  tone="orange"
                  onClick={() => void handleAction('ACTION7')}
                  disabled={!frame || isActing || gameState !== 'playing'}
                  className="w-full h-11"
                  title="Q / E"
                >
                  <Hash className="w-4 h-4" />
                  <span>UNDO</span>
                  <span className="ml-auto text-[9px] opacity-70 font-mono">Z</span>
                </PixelButton>
              </div>
            </PixelPanel>

            {/* Reset */}
            <PixelButton
              tone="neutral"
              onClick={handleReset}
              disabled={!frame || isActing}
              className="w-full h-9 text-[11px]"
              title="R"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET</span>
              <span className="ml-auto text-[9px] opacity-60 font-mono">R</span>
            </PixelButton>
          </div>
        </div>
      </main>
    </Arc3PixelPage>
  );
}
