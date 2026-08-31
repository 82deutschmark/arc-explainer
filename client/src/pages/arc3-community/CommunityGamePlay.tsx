/*
Author: Claude Opus 5
Date: 2026-08-31
PURPOSE: The blind play surface — one ARC-AGI-3 task, rendered and driven the way the
         official ARC-AGI-3 player does it. Full rewrite of the previous page, replaced
         rather than patched for three reasons:

         1. DOUBLE CHROME. It rendered its own header inside PageLayout, which already
            renders AppHeader, so every game sat under two nav bars. This page is routed
            OUTSIDE PageLayout (see App.tsx) and owns its whole viewport, like a game.

         2. IT OFFERED CONTROLS THE GAME REJECTS. Every game declares `available_actions`
            and most accept a subset: `ac02` is click-only ([6]), `ar02` is d-pad-only
            ([1,2,3,4]), `q004-v1` omits ACTION2. The old page showed all seven
            unconditionally. On a click-only game the d-pad did nothing ("none of the
            buttons worked"); on q004-v1 one press of Down went straight to GAME_OVER
            ("it said Game Over immediately"). Two reports, one cause. Controls are now
            built from `available_actions`, and the dispatcher refuses an unavailable
            action even if a keypress gets past the UI.

         3. NO UNDO AND NO LIVE MODE. A blind player's first move is a guess by
            construction; without undo the only recovery is restarting the run. And the
            handful of real-time tasks (`isLive`) cannot be played turn-by-turn at all.

         Ported from arc3.sonpham.net's games-play.js: canvas render at ~512px, status /
         level / step readout, level strip, end overlay, reset + undo, and a live tick
         driven by a held action. Deliberately NOT ported — the tile-skin and frame-filter
         bars (researcher instrumentation, Son's side), and the game title, which this
         site must never show.

         TELEMETRY. humanPlay.record() fires on every deliberate action and is the reason
         this site exists. Live ticks are NOT recorded: at 10-30fps they would swamp the
         event table and make human action counts incomparable to agent ones — the same
         reasoning HumanPlayRepository already applies to RESET.
SRP/DRY check: Pass — presentation and input only. Execution stays in usePyodideGame,
         telemetry in humanPlayTelemetry, colours in utils/arc3Colors.
*/

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw, Undo2, Play, Pause, Loader2, AlertTriangle } from 'lucide-react';
import { usePyodideGame, type PyodideFrameData } from '@/hooks/usePyodideGame';
import { humanPlay } from '@/lib/humanPlayTelemetry';
import { ARC3_COLORS } from '@/utils/arc3Colors';

type GameState = 'idle' | 'playing' | 'won' | 'lost';

interface MirroredGame {
  gameId: string;
  isLive: boolean;
  defaultFps: number;
}

/** Keyboard bindings, matching the official player. */
const KEY_MAP: Record<string, string> = {
  ArrowUp: 'ACTION1', w: 'ACTION1', W: 'ACTION1',
  ArrowDown: 'ACTION2', s: 'ACTION2', S: 'ACTION2',
  ArrowLeft: 'ACTION3', a: 'ACTION3', A: 'ACTION3',
  ArrowRight: 'ACTION4', d: 'ACTION4', D: 'ACTION4',
  ' ': 'ACTION5', z: 'ACTION5', Z: 'ACTION5',
  x: 'ACTION7', X: 'ACTION7', c: 'ACTION7', C: 'ACTION7',
};

const ARC = {
  ground: '#0E0C0C',
  text: '#E3E1DF',
  dim: '#9A9694',
  faint: '#6E6A68',
  border: '#262626',
  pink: '#E53AA3',
  green: '#4FCC30',
  red: '#F93C31',
  control: '#393736',
};

const MONO = "'SF Mono', Menlo, Consolas, 'Courier New', monospace";

const DPAD = [
  { action: 'ACTION1', label: 'W', glyph: '▲' },
  { action: 'ACTION3', label: 'A', glyph: '◀' },
  { action: 'ACTION4', label: 'D', glyph: '▶' },
  { action: 'ACTION2', label: 'S', glyph: '▼' },
];

/** ACTION5/7 have no arrow glyph; the official player labels them by key. */
const EXTRAS = [
  { action: 'ACTION5', hint: 'Space / Z' },
  { action: 'ACTION7', hint: 'X / C' },
];

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const pyodide = usePyodideGame();

  const [frame, setFrame] = useState<PyodideFrameData | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [displayFrameIndex, setDisplayFrameIndex] = useState(0);
  const [live, setLive] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef<string | null>(null);

  /** Only isLive + defaultFps are read here. The catalog names nothing. */
  const { data: catalog } = useQuery<{ data: { games: MirroredGame[] } }>({
    queryKey: ['/api/arc3-mirror/games'],
    staleTime: 5 * 60 * 1000,
  });
  const meta = useMemo(
    () => catalog?.data?.games?.find((g) => g.gameId === gameId) ?? null,
    [catalog, gameId],
  );

  useEffect(() => { if (pyodide.frame) setFrame(pyodide.frame); }, [pyodide.frame]);

  /** Which of ACTION1..7 this game accepts. Empty = unknown, so allow everything. */
  const available = useMemo(
    () => new Set((frame?.available_actions ?? []).map(Number)),
    [frame],
  );
  const known = available.size > 0;
  const acceptsClick = available.has(6);

  /**
   * RESET is action id 0 and never appears in available_actions — it is not a move. It
   * routes through pyodide.reset(), so it must bypass this gate rather than be blocked.
   */
  const canSend = useCallback(
    (action: string) =>
      action === 'RESET' || !known || available.has(Number(action.replace('ACTION', ''))),
    [available, known],
  );

  const applyFrame = useCallback((next: PyodideFrameData) => {
    setFrame(next);
    const total = next.frame?.length ?? 1;
    if (animRef.current) clearTimeout(animRef.current);
    if (total > 1) {
      setDisplayFrameIndex(0);
      let i = 0;
      const step = () => {
        i += 1;
        if (i < total) { setDisplayFrameIndex(i); animRef.current = setTimeout(step, 200); }
      };
      animRef.current = setTimeout(step, 200);
    } else {
      setDisplayFrameIndex(0);
    }
    const s = next.state?.toUpperCase?.() ?? '';
    if (s === 'WIN' || s === 'WON') setGameState('won');
    else if (s === 'GAME_OVER' || s === 'LOSE' || s === 'LOST') setGameState('lost');
    else setGameState('playing');
  }, []);

  /**
   * @param silent live tick — advances the game but is not recorded. A held key at
   *               10-30fps is not a deliberate move, and logging it would swamp the
   *               human baseline this site exists to collect.
   */
  const act = useCallback(async (
    action: string,
    coords?: { x: number; y: number },
    silent = false,
  ) => {
    if (action !== 'RESET' && (gameState === 'won' || gameState === 'lost')) return;
    if (!canSend(action)) return;
    try {
      const next = action === 'RESET' ? await pyodide.reset() : await pyodide.step(action, coords);
      if (!silent) {
        const s = next.state?.toUpperCase?.() ?? '';
        humanPlay.record(
          action,
          typeof next.score === 'number' ? next.score : null,
          s === 'WIN' ? 'WIN' : s === 'GAME_OVER' ? 'GAME_OVER' : 'NOT_FINISHED',
        );
      }
      applyFrame(next);
    } catch { /* surfaced through pyodide.error */ }
  }, [pyodide, canSend, applyFrame, gameState]);

  const undo = useCallback(async () => {
    if (!frame?.undo_depth) return;
    try { applyFrame(await pyodide.undo()); } catch { /* surfaced through pyodide.error */ }
  }, [pyodide, frame, applyFrame]);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'idle') return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); void act('RESET'); return; }
      const action = KEY_MAP[e.key];
      if (!action || !canSend(action)) return;
      e.preventDefault();
      // In live mode a key is HELD: it sets what the tick repeats rather than firing one
      // step per keydown.
      if (live) heldRef.current = action;
      else void act(action);
    };
    const up = (e: KeyboardEvent) => {
      if (live && KEY_MAP[e.key] && heldRef.current === KEY_MAP[e.key]) heldRef.current = null;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [act, canSend, gameState, live]);

  // ── Live tick ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!live || gameState !== 'playing') return;
    const fps = Math.min(30, Math.max(2, meta?.defaultFps ?? 10));
    const timer = setInterval(() => {
      if (pyodide.isActing) return;
      // Idle action keeps a real-time game ticking when no key is down, matching the
      // official player: ACTION7 if the game has it, else ACTION5.
      const idle = available.has(7) ? 'ACTION7' : available.has(5) ? 'ACTION5' : null;
      const action = heldRef.current ?? idle;
      if (action) void act(action, undefined, true);
    }, Math.max(16, Math.round(1000 / fps)));
    return () => clearInterval(timer);
  }, [live, gameState, meta, available, act, pyodide.isActing]);

  useEffect(() => () => { if (animRef.current) clearTimeout(animRef.current); }, []);

  // ── Canvas ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const frames = frame?.frame;
    const grid = frames?.[Math.min(displayFrameIndex, (frames?.length ?? 1) - 1)];
    if (!canvas || !grid?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const h = grid.length;
    const w = grid[0].length;
    // Integer scale only: a fractional cell size makes a pixel grid shimmer.
    const scale = Math.max(1, Math.floor(512 / Math.max(h, w)));
    canvas.width = w * scale;
    canvas.height = h * scale;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        ctx.fillStyle = ARC3_COLORS[grid[y][x]] ?? '#000';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }, [frame, displayFrameIndex]);

  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!acceptsClick || gameState !== 'playing') return;
    const canvas = canvasRef.current;
    const grid = frame?.frame?.[0];
    if (!canvas || !grid?.length) return;
    const rect = canvas.getBoundingClientRect();
    const cols = grid[0].length;
    const rows = grid.length;
    const x = Math.max(0, Math.min(cols - 1, Math.floor(((e.clientX - rect.left) / rect.width) * cols)));
    const y = Math.max(0, Math.min(rows - 1, Math.floor(((e.clientY - rect.top) / rect.height) * rows)));
    void act('ACTION6', { x, y });
  }, [acceptsClick, gameState, frame, act]);

  const start = useCallback(async () => {
    humanPlay.start(gameId ?? '');
    setDisplayFrameIndex(0);
    try { applyFrame(await pyodide.initGame(gameId!)); }
    catch { /* pyodide.error is rendered */ }
  }, [pyodide, gameId, applyFrame]);

  const levelsDone = frame?.levels_completed ?? frame?.score ?? 0;
  const winLevels = frame?.win_levels ?? 0;
  const status = gameState === 'won' ? 'WIN' : gameState === 'lost' ? 'GAME OVER' : gameState === 'playing' ? 'IN PROGRESS' : '';
  const statusColor = gameState === 'won' ? ARC.green : gameState === 'lost' ? ARC.red : ARC.dim;
  const hasDpad = known && DPAD.some((b) => canSend(b.action));
  const extras = EXTRAS.filter((b) => known && canSend(b.action));

  return (
    <div className="min-h-screen w-full" style={{ background: ARC.ground, color: ARC.text, fontFamily: MONO }}>
      {/* One bar, not two. This route sits outside PageLayout precisely so the site nav
          is not stacked on top of the game. */}
      <div className="flex items-center gap-4 px-4 h-11" style={{ borderBottom: `1px solid ${ARC.border}` }}>
        <Link href="/arc3/gallery">
          <a className="flex items-center gap-1.5 text-[12px]" style={{ color: ARC.dim }}>
            <ArrowLeft className="w-3.5 h-3.5" /> All tasks
          </a>
        </Link>
        {/* The id, and only the id. A name here hands the player the answer. */}
        <span className="text-[12px]" style={{ color: ARC.pink }}>{gameId}</span>
        {status && <span className="ml-auto text-[11px]" style={{ color: statusColor }}>{status}</span>}
      </div>

      <div className="max-w-[1000px] mx-auto px-4 py-6">
        {pyodide.error && (
          <div className="mb-4 px-4 py-2 flex items-center gap-2 text-[12px]"
               style={{ border: `1px solid ${ARC.red}`, color: ARC.red }}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            This task could not start in your browser ({pyodide.error}). It needs
            WebAssembly and access to the Pyodide CDN.
          </div>
        )}

        {gameState !== 'idle' && (
          <>
            <div className="flex items-center gap-5 mb-2 text-[11px]" style={{ color: ARC.dim }}>
              <span>Level {levelsDone}{winLevels ? `/${winLevels}` : ''}</span>
              <span>Step {frame?.action_counter ?? 0}</span>
              {frame?.max_actions ? <span style={{ color: ARC.faint }}>Max {frame.max_actions}</span> : null}
            </div>
            {winLevels > 1 && (
              <div className="flex gap-1 mb-4">
                {Array.from({ length: winLevels }, (_, i) => (
                  <div key={i} className="h-1.5 flex-1"
                       style={{ background: i < levelsDone ? ARC.green : i === levelsDone ? ARC.pink : ARC.control }} />
                ))}
              </div>
            )}
          </>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_170px] items-start">
          <div className="relative" style={{ border: `1px solid ${ARC.border}`, background: '#000' }}>
            {gameState === 'idle' ? (
              <div className="aspect-square flex flex-col items-center justify-center gap-5 px-6 text-center">
                <p className="text-[13px]" style={{ color: ARC.text }}>{gameId}</p>
                <p className="text-[12px] max-w-[38ch] leading-relaxed" style={{ color: ARC.dim }}>
                  No instructions. Work out what it does.
                </p>
                <button
                  onClick={() => void start()}
                  disabled={pyodide.status === 'loading'}
                  className="px-5 h-9 text-[12px] disabled:opacity-50 flex items-center gap-2"
                  style={{ background: ARC.pink, color: '#fff' }}
                >
                  {pyodide.status === 'loading'
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{pyodide.loadingMessage ?? 'Starting…'}</>
                    : <><Play className="w-3.5 h-3.5" />Start</>}
                </button>
                <p className="text-[10px] max-w-[42ch] leading-relaxed" style={{ color: ARC.faint }}>
                  Anonymous gameplay events are recorded — inputs, timings, progress — so
                  human play can be compared to AI play. No account, no personal data.
                </p>
              </div>
            ) : (
              <>
                <canvas
                  ref={canvasRef}
                  onClick={onCanvasClick}
                  className="block w-full h-auto"
                  style={{ imageRendering: 'pixelated', cursor: acceptsClick ? 'crosshair' : 'default' }}
                />
                {(gameState === 'won' || gameState === 'lost') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                       style={{ background: 'rgba(0,0,0,.72)' }}>
                    <p className="text-[20px] font-bold"
                       style={{ color: gameState === 'won' ? ARC.green : ARC.red }}>
                      {gameState === 'won' ? 'YOU WIN' : 'GAME OVER'}
                    </p>
                    <div className="flex gap-2">
                      {!!frame?.undo_depth && (
                        <button onClick={() => void undo()} className="px-4 h-8 text-[12px]"
                                style={{ border: `1px solid ${ARC.control}`, color: ARC.text }}>
                          Undo last move
                        </button>
                      )}
                      <button onClick={() => void act('RESET')} className="px-4 h-8 text-[12px]"
                              style={{ background: ARC.pink, color: '#fff' }}>
                        Try again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls, built from what this game actually accepts. */}
          {gameState !== 'idle' && (
            <div className="flex flex-col gap-3">
              {hasDpad && (
                <div className="grid grid-cols-3 gap-1">
                  <span />
                  <Ctl b={DPAD[0]} disabled={!canSend('ACTION1') || pyodide.isActing} onPress={act} />
                  <span />
                  <Ctl b={DPAD[1]} disabled={!canSend('ACTION3') || pyodide.isActing} onPress={act} />
                  <span />
                  <Ctl b={DPAD[2]} disabled={!canSend('ACTION4') || pyodide.isActing} onPress={act} />
                  <span />
                  <Ctl b={DPAD[3]} disabled={!canSend('ACTION2') || pyodide.isActing} onPress={act} />
                  <span />
                </div>
              )}

              {extras.map((b) => (
                <button key={b.action} onClick={() => void act(b.action)} disabled={pyodide.isActing}
                        className="h-9 text-[11px] disabled:opacity-40"
                        style={{ border: `1px solid ${ARC.control}`, color: ARC.text }}>
                  {b.hint}
                </button>
              ))}

              <p className="text-[10px] leading-relaxed" style={{ color: ARC.faint }}>
                {acceptsClick
                  ? hasDpad ? 'Click the board to act. Arrow keys or WASD also work.' : 'Click the board to act.'
                  : 'Arrow keys or WASD to act.'}
              </p>

              <button onClick={() => void undo()} disabled={!frame?.undo_depth || pyodide.isActing}
                      className="h-8 text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-30"
                      style={{ border: `1px solid ${ARC.control}`, color: ARC.dim }}>
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button onClick={() => void act('RESET')} disabled={pyodide.isActing}
                      className="h-8 text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-30"
                      style={{ border: `1px solid ${ARC.control}`, color: ARC.dim }}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              {meta?.isLive && (
                <button onClick={() => setLive((v) => !v)}
                        className="h-8 text-[11px] flex items-center justify-center gap-1.5"
                        style={{
                          border: `1px solid ${live ? ARC.pink : ARC.control}`,
                          background: live ? ARC.pink : 'transparent',
                          color: live ? '#fff' : ARC.dim,
                        }}>
                  {live ? <><Pause className="w-3.5 h-3.5" /> Stop</> : <><Play className="w-3.5 h-3.5" /> Live</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Ctl({ b, disabled, onPress }: {
  b: { action: string; label: string; glyph: string };
  disabled: boolean;
  onPress: (a: string) => void;
}) {
  return (
    <button
      onClick={() => void onPress(b.action)}
      disabled={disabled}
      className="h-12 flex flex-col items-center justify-center leading-none disabled:opacity-20"
      style={{ border: `1px solid ${ARC.control}`, color: ARC.text }}
      title={b.label}
    >
      <span className="text-[15px]">{b.glyph}</span>
      <span className="text-[9px] mt-0.5" style={{ color: ARC.faint }}>{b.label}</span>
    </button>
  );
}
