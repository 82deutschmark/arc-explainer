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

         31-Aug, second pass: the shell is now Arc3Console, a reproduction of the
         arcprize.org task console, because the flat layout was still wrong in a way that
         mattered. It told the player to "click the board to act" — but ACTION6 is not a
         spatial click in every game. In q598-v1 it is a SUBMIT: you build a command with
         the arrows and ACTION6 declares you are finished, so pressing it early calls
         lose(). A player clicking the board to see what happens is dead on move one,
         which is precisely the "clicking anything results in game over" report. On the
         official console ACTION6 is a labelled CLICK button — a control you press
         deliberately. The canvas is no longer clickable for that reason.

         The same task also explains "nothing appears to do anything": q598-v1 buffers
         arrow presses and the board does not visibly change on every one (measured: the
         second press changes no pixels). The console's step readout and button feedback
         are the only signal that an action registered, so they are not decoration.

         Deliberately NOT ported — the tile-skin and frame-filter bars (researcher
         instrumentation, Son's side), and the game title, which this site must never
         show.

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
import { ArrowLeft, Play, Loader2, AlertTriangle } from 'lucide-react';
import { Arc3Console, type ConsoleButton } from '@/components/arc3-community/Arc3Console';
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



export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const pyodide = usePyodideGame();

  const [frame, setFrame] = useState<PyodideFrameData | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [displayFrameIndex, setDisplayFrameIndex] = useState(0);
  const [live, setLive] = useState(false);
  // HELP is a control on the official deck. It explains the CONTROLS only -- never the
  // task -- so it cannot leak the mechanic.
  const [showHelp, setShowHelp] = useState(false);

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


  const start = useCallback(async () => {
    humanPlay.start(gameId ?? '');
    setDisplayFrameIndex(0);
    try { applyFrame(await pyodide.initGame(gameId!)); }
    catch { /* pyodide.error is rendered */ }
  }, [pyodide, gameId, applyFrame]);

  const statusLabel = gameState === 'won' ? 'WIN'
    : gameState === 'lost' ? 'GAME OVER'
    : gameState === 'playing' ? 'IN PROGRESS' : '';
  const statusColor = gameState === 'won' ? ARC.green : gameState === 'lost' ? ARC.red : ARC.dim;

  const levelsDone = frame?.levels_completed ?? frame?.score ?? 0;
  const winLevels = frame?.win_levels ?? 0;
  const levelLabel = gameState === 'idle'
    ? 'ARC-AGI-3'
    : `Level ${Math.min(levelsDone + 1, winLevels || levelsDone + 1)} / ${winLevels || '?'}`;

  /** A console control. `unavailable` dims it in place rather than removing it: the
   *  official console keeps the same deck on every task, so the panel never reflows,
   *  and a greyed control still tells the player this game does not use it. */
  const ctl = (action: string, label: string): ConsoleButton => ({
    label,
    onPress: () => void act(action),
    unavailable: !canSend(action),
    disabled: pyodide.isActing || gameState !== 'playing',
  });

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: ARC.ground, color: ARC.text, fontFamily: MONO }}
    >
      {/* One slim bar. This route sits outside PageLayout precisely so the site nav is
          not stacked on top of the console. */}
      <div className="flex items-center gap-4 px-4 h-11 shrink-0" style={{ borderBottom: `1px solid ${ARC.border}` }}>
        <Link href="/arc3/gallery">
          <a className="flex items-center gap-1.5 text-[12px]" style={{ color: ARC.dim }}>
            <ArrowLeft className="w-3.5 h-3.5" /> All tasks
          </a>
        </Link>
        <span className="text-[11px]" style={{ color: ARC.faint }}>
          {gameState === 'idle' ? '' : `Step ${frame?.action_counter ?? 0}`}
        </span>
        {statusLabel && (
          <span className="ml-auto text-[11px]" style={{ color: statusColor }}>{statusLabel}</span>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-3">
        {pyodide.error && (
          <div className="w-full max-w-[500px] px-4 py-2 flex items-center gap-2 text-[12px]"
               style={{ border: `1px solid ${ARC.red}`, color: ARC.red }}>
            <AlertTriangle className="w-4 h-4 shrink-0" />
            This task could not start in your browser ({pyodide.error}). It needs
            WebAssembly and access to the Pyodide CDN.
          </div>
        )}

        <Arc3Console
          gameId={gameId ?? ''}
          levelLabel={levelLabel}
          up={ctl('ACTION1', '')}
          down={ctl('ACTION2', '')}
          left={ctl('ACTION3', '')}
          right={ctl('ACTION4', '')}
          spacebar={ctl('ACTION5', 'Spacebar')}
          click={ctl('ACTION6', 'Click')}
          undo={{
            label: 'Undo (Z)',
            onPress: () => void undo(),
            disabled: !frame?.undo_depth || pyodide.isActing,
          }}
          reset={{
            label: 'Reset',
            onPress: () => void act('RESET'),
            disabled: gameState === 'idle' || pyodide.isActing,
          }}
          help={{
            label: 'Help',
            onPress: () => setShowHelp((v) => !v),
            active: showHelp,
          }}
          select={{
            label: meta?.isLive ? 'Live' : 'Select',
            onPress: () => { if (meta?.isLive) setLive((v) => !v); },
            unavailable: !meta?.isLive,
            active: live,
          }}
          screen={
            gameState === 'idle' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-6 text-center">
                <p className="text-[15px] tracking-[3px]" style={{ color: '#EDEDED' }}>ARC-AGI-3</p>
                <button
                  onClick={() => void start()}
                  disabled={pyodide.status === 'loading'}
                  className="px-9 h-[52px] rounded-[6px] text-[19px] tracking-[2px] disabled:opacity-60 flex items-center gap-2"
                  style={{
                    background: 'repeating-linear-gradient(0deg,#FFF 0 2px,#D8D8D8 2px 4px)',
                    color: '#111',
                    boxShadow: '0 0 26px rgba(255,255,255,.45)',
                  }}
                >
                  {pyodide.status === 'loading'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-[13px]">{pyodide.loadingMessage ?? 'LOADING'}</span></>
                    : <><Play className="w-4 h-4" />START</>}
                </button>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,.55)' }}>
                  {pyodide.status === 'loading'
                    ? 'One-time engine load — this can take a minute'
                    : pyodide.error
                      ? 'Press Start to try again'
                      : 'Press Start to Play'}
                </p>
                {/* A failed boot used to leave the console looking idle with every control
                    dead and nothing on screen to say why. Say it on the screen itself. */}
                {pyodide.error && (
                  <p className="text-[9.5px] max-w-[38ch] leading-relaxed" style={{ color: '#F98A82' }}>
                    {pyodide.error}
                  </p>
                )}
                <p className="text-[9.5px] max-w-[36ch] leading-relaxed" style={{ color: 'rgba(255,255,255,.32)' }}>
                  No instructions — that is the experiment. Anonymous gameplay events are
                  recorded so human play can be compared to AI play. No account.
                </p>
              </div>
            ) : (
              <>
                {/* Not clickable. ACTION6 is a button on the deck, because in some tasks
                    it is a submit and poking the board is instant death. */}
                <canvas ref={canvasRef} className="block w-full h-full" style={{ imageRendering: 'pixelated' }} />
                {showHelp && (
                  <div className="absolute inset-0 p-5 flex flex-col justify-center gap-2 text-[10.5px] leading-relaxed"
                       style={{ background: 'rgba(0,0,0,.86)', color: 'rgba(255,255,255,.85)' }}>
                    <p style={{ color: '#FFF' }}>Controls</p>
                    <p>Arrows or WASD — the d-pad.</p>
                    <p>Spacebar or Z — the Spacebar button.</p>
                    <p>The Click button is an action, not a place on the screen.</p>
                    <p>R resets. Undo steps back one move.</p>
                    <p style={{ color: 'rgba(255,255,255,.5)' }}>
                      Greyed controls are ones this task does not use. What any of them do
                      is for you to find out — that part is the experiment.
                    </p>
                  </div>
                )}
                {(gameState === 'won' || gameState === 'lost') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                       style={{ background: 'rgba(0,0,0,.78)' }}>
                    <p className="text-[22px] tracking-[2px]"
                       style={{ color: gameState === 'won' ? ARC.green : ARC.red }}>
                      {gameState === 'won' ? 'YOU WIN' : 'GAME OVER'}
                    </p>
                    <div className="flex gap-2">
                      {!!frame?.undo_depth && (
                        <button onClick={() => void undo()} className="px-4 h-8 text-[11px] rounded-[4px]"
                                style={{ border: '1px solid rgba(255,255,255,.35)', color: '#FFF' }}>
                          Undo last move
                        </button>
                      )}
                      <button onClick={() => void act('RESET')} className="px-4 h-8 text-[11px] rounded-[4px]"
                              style={{ background: ARC.pink, color: '#fff' }}>
                        Try again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )
          }
        />
      </div>
    </div>
  );
}
