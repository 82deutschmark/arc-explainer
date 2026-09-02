/*
Author: Claude Opus 5
Date: 2026-09-01
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
         official console ACTION6 is also a labelled CLICK button, so the deck grew one
         and the canvas was made inert. See point 7 — half of that was wrong.

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
         01-Sep, third pass — three faults on the loop that carries a reviewer from one
         task to the next, all reported together:

         4. NEXT DID NOTHING. /arc3/play/A -> /arc3/play/B is the same route with a new
            param, so React kept this component mounted and nothing read the change. The
            URL moved and the screen did not. Fixed by resetting in place on `gameId` —
            see the effect below `start`, which also explains why not `key={gameId}`.

         5. FEEDBACK LED NOWHERE. The panel's onDone was wired only for the mid-run
            scratchpad, so sending feedback at game over ended on a thank-you with the
            finished task still on screen. It now hands the player the next task, which
            is what closes the play -> react -> next loop this page exists to run.

         6. Z DID THE OPPOSITE OF WHAT IT SAID. It was bound to ACTION5 next to the
            spacebar while the deck read "Undo (Z)", so the key a stuck player reaches
            for spent a move instead of taking one back. Z is Undo. The spacebar is
            ACTION5. See KEY_MAP.

         02-Sep, fourth pass:

         7. THE CLICK GAMES COULD NOT BE PLAYED AT ALL. Making the canvas inert (see the
            second pass above) protected the tasks where ACTION6 is a submit and broke
            every task where it is a real click, which is the larger group: seven of the
            fifty read data["x"]/data["y"] off the action. t99e8274e is the clearest —
            available_actions is [5,6,7], so the d-pad is not merely unused, it does not
            exist, and the whole game is clicking cells to fill them. The deck's CLICK
            button sent ACTION6 with NO coordinates, so the game read the -1 default and
            _toggle returned early: not an unresponsive control, a guaranteed no-op. The
            board is clickable again, and a click carries the cell under the cursor.
            Coordinates are frame cells, matching arcengine's own
            ActionInput(id=ACTION6, data={"x","y"}) in base_game.py:517.

            THE DECK CLICK BUTTON STAYS, AND IS AN OPEN QUESTION. It is how you send a
            coordinate-free ACTION6, which is what q598-v1 and the other commit-style
            tasks actually want — press to declare "I am finished". Whether that
            mechanic belongs in our synthetic set at all is undecided: a submit button
            sharing an action id with a spatial click is why this page has now been wrong
            twice in opposite directions. It is deliberately NOT removed pending that
            decision, so do not tidy it away — see
            docs/2026-09-02-arc3-canvas-click-plan.md.

SRP/DRY check: Pass — presentation and input only. Execution stays in usePyodideGame,
         telemetry in humanPlayTelemetry, colours in utils/arc3Colors.
*/

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Play, Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
import { Arc3Console, type ConsoleButton } from '@/components/arc3-community/Arc3Console';
import { Arc3FeedbackPanel } from '@/components/arc3-community/Arc3FeedbackPanel';
import { usePyodideGame, type PyodideFrameData } from '@/hooks/usePyodideGame';
import { humanPlay } from '@/lib/humanPlayTelemetry';
import { ARC3_COLORS } from '@/utils/arc3Colors';
import type { Arc3MechanicEntry } from '@shared/arc3Mechanics';

type GameState = 'idle' | 'playing' | 'won' | 'lost';

interface MirroredGame {
  gameId: string;
  isLive: boolean;
  defaultFps: number;
  category: string;
}

/** One row of the ranked review queue. Culled tasks carry why, and are only returned
 *  when the endpoint is asked for them. */
interface ReviewEntry {
  gameId: string;
  status: 'queued' | 'duplicate' | 'weak' | 'illegible';
  duplicateOf: string | null;
  rank?: number;
}

interface ReviewTotals {
  probed: number;
  queued: number;
  duplicate: number;
  weak: number;
  /** Unwinnable by construction: the win condition names something never drawn. */
  illegible: number;
}

/** Our own generation pipeline — the fallback ordering when the review queue is
 *  unavailable. Mirrors PIPELINE_CATEGORY on the gallery and landing pages. */
const PIPELINE_CATEGORY = 'ai-generated';

/**
 * Keyboard bindings, matching the official player.
 *
 * Z IS NOT HERE, DELIBERATELY. It used to be a second binding for ACTION5 alongside the
 * spacebar, while the deck's Undo control was labelled "Undo (Z)" and the Help overlay
 * said "Spacebar or Z". So the one key a stuck player reaches for spent a MOVE instead
 * of taking one back -- the worst direction for that mistake to go on a surface where a
 * single wrong action can end the level. Z is Undo (see the keydown handler); the
 * spacebar is ACTION5. They are different things and no key means both.
 */
const KEY_MAP: Record<string, string> = {
  ArrowUp: 'ACTION1', w: 'ACTION1', W: 'ACTION1',
  ArrowDown: 'ACTION2', s: 'ACTION2', S: 'ACTION2',
  ArrowLeft: 'ACTION3', a: 'ACTION3', A: 'ACTION3',
  ArrowRight: 'ACTION4', d: 'ACTION4', D: 'ACTION4',
  ' ': 'ACTION5',
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



/**
 * What the task was, shown after the player has said what they thought it was.
 *
 * Deliberately plain and inside the feedback panel rather than over the console: the
 * console's screen shows only what the official one shows, and this is our own apparatus.
 * A missing entry renders nothing at all -- a reveal that says "no description available"
 * is worse than the thank-you it replaced.
 */
function MechanicReveal({ entry, onNext, onBack }: {
  entry: Arc3MechanicEntry | null;
  onNext?: () => void;
  onBack?: () => void;
}) {
  if (!entry?.mechanic) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-[12px]" style={{ color: ARC.green }}>
        Thanks — that helps.
        {onNext && (
          <button onClick={onNext} className="underline" style={{ color: ARC.pink }}>Next task</button>
        )}
        {onBack && (
          <button onClick={onBack} className="underline" style={{ color: ARC.faint }}>Close</button>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2.5 py-1">
      <p className="text-[10px] tracking-[1.5px] uppercase" style={{ color: ARC.green }}>
        Thanks — here is what it was
      </p>
      <p className="text-[12.5px] leading-relaxed" style={{ color: ARC.text }}>{entry.mechanic}</p>
      {entry.controls && (
        <p className="text-[11.5px] leading-relaxed" style={{ color: ARC.dim }}>
          <span style={{ color: ARC.text }}>Controls. </span>{entry.controls}
        </p>
      )}
      {entry.goal && (
        <p className="text-[11.5px] leading-relaxed" style={{ color: ARC.dim }}>
          <span style={{ color: ARC.text }}>Wins when. </span>{entry.goal}
        </p>
      )}
      <div className="flex items-center gap-3 pt-1">
        {onNext && (
          <button onClick={onNext} className="px-3 h-8 text-[11.5px] rounded-[4px]"
                  style={{ background: ARC.pink, color: '#fff' }}>
            Next task →
          </button>
        )}
        {onBack && (
          <button onClick={onBack} className="px-3 h-8 text-[11.5px] rounded-[4px]"
                  style={{ border: `1px solid ${ARC.border}`, color: ARC.text }}>
            Back to the task
          </button>
        )}
        <Link href="/arc3/mechanics" className="text-[11px] underline" style={{ color: ARC.faint }}>
          All 50, with spoilers
        </Link>
      </div>
    </div>
  );
}

export default function CommunityGamePlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, navigate] = useLocation();
  const pyodide = usePyodideGame();

  const [frame, setFrame] = useState<PyodideFrameData | null>(null);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [displayFrameIndex, setDisplayFrameIndex] = useState(0);
  const [live, setLive] = useState(false);
  // HELP is a control on the official deck. It explains the CONTROLS only -- never the
  // task -- so it cannot leak the mechanic.
  const [showHelp, setShowHelp] = useState(false);
  // Feedback is the qualitative half of the cull decision, so it is reachable mid-run
  // (a scratchpad for what you are trying) and offered again when the run ends.
  const [showFeedback, setShowFeedback] = useState(false);
  /** The frame cell under the pointer, so the board can show where a click would land.
   *  Null whenever the pointer is off the board or ACTION6 is not a spatial click here. */
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  /** Set when feedback is sent. Gates the answer-key fetch, so the solution to a task in
   *  progress is never sitting in the page's network log for a player to find. */
  const [revealEarned, setRevealEarned] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const heldRef = useRef<string | null>(null);
  /** The task this component is currently showing, so a same-route param change can be
   *  told apart from a re-render. See the task-change effect below `start`. */
  const shownGameRef = useRef(gameId);

  /** Only isLive + defaultFps are read here. The catalog names nothing. */
  const { data: catalog } = useQuery<{ data: { games: MirroredGame[] } }>({
    queryKey: ['/api/arc3-mirror/games'],
    staleTime: 5 * 60 * 1000,
  });
  const meta = useMemo(
    () => catalog?.data?.games?.find((g) => g.gameId === gameId) ?? null,
    [catalog, gameId],
  );

  /** Which tasks anyone has ever played, so Next can prefer one nobody has touched. */
  const { data: stats } = useQuery<{ data: { games: { game_id: string }[] } }>({
    queryKey: ['/api/arc3-play/human-stats'],
    staleTime: 60 * 1000,
  });

  /**
   * The mechanic guide, for the reveal after feedback is sent.
   *
   * Fetched only once this run is OVER. It is a complete answer key and pulling it while
   * the task is still being played would put the solution in the page's own network log,
   * one devtools tab away from the person the blind-play sample depends on.
   */
  const { data: mechanics } = useQuery<{ data: { games: Arc3MechanicEntry[] } }>({
    queryKey: ['/api/arc3-mirror/mechanics'],
    staleTime: 60 * 60 * 1000,
    enabled: revealEarned,
  });

  /**
   * WHICH TASKS ACTUALLY READ A CLICK. One bit per game, not the answer key.
   *
   * `available_actions` cannot be trusted for this. Only 18 of the 50 declare it and the
   * rest inherit arcengine's [1,2,3,4,5,6] default, so 26 games advertise ACTION6 and read
   * nothing from it. Gating the crosshair on the frame alone put a live-looking click
   * target on half the set that accepted the click, spent a step and did nothing -- the
   * same complaint that started this work, wearing a different hat.
   *
   * Fetched with the page, unlike the mechanic reveal: this is one boolean about the
   * CONTROLS, which the console has to know to draw itself honestly, and not a fact about
   * how the task is solved.
   */
  const { data: clickable } = useQuery<{ data: { known: string[]; clickTargets: string[] } }>({
    queryKey: ['/api/arc3-mirror/click-targets'],
    staleTime: 60 * 60 * 1000,
  });

  /**
   * Does a click on this board mean anything?
   *
   * null = we cannot say. Upstream tasks are not in our digest, and an unknown task keeps
   * the frame's own word rather than being silently made inert -- a false negative here
   * would break the click games all over again, which is the more expensive mistake.
   */
  const readsClicks = useMemo(() => {
    const d = clickable?.data;
    if (!d || !gameId) return null;
    if (d.clickTargets.includes(gameId)) return true;
    return d.known.includes(gameId) ? false : null;
  }, [clickable, gameId]);

  /** The ranked review queue: generated tasks that are neither duplicates nor pushovers. */
  const { data: review } = useQuery<{ data: { games: ReviewEntry[]; totals: ReviewTotals } }>({
    queryKey: ['/api/arc3-mirror/review-queue'],
    staleTime: 60 * 60 * 1000,
  });

  /** Where this task sits in the queue, for the "17 / 328" readout. */
  const queuePosition = useMemo(() => {
    const q = review?.data?.games ?? [];
    if (q.length === 0 || !gameId) return null;
    const i = q.findIndex((g) => g.gameId === gameId);
    return i < 0 ? null : { at: i + 1, of: q.length };
  }, [review, gameId]);

  /**
   * The next task to offer.
   *
   * Walks the review queue rather than the raw catalog. The catalog is 877 entries, and
   * most of them are not what this site is for: the official 25, the 252 community tasks
   * and the in-house set are known good and need nobody's verdict. What needs a human is
   * our own generator's most recent output, which is what the queue holds — newest first,
   * with the 66 near-duplicates and 177 random-mashable tasks already held back. Position
   * comes from the queue, so finishing a task advances one place instead of jumping to
   * wherever the first unplayed gap happens to be.
   *
   * Falls back to the old catalog walk when the queue is unavailable or when this task
   * is not in it (an official or community task, or a culled one reached by direct
   * link) — Next must never dead-end.
   */
  const nextGameId = useMemo(() => {
    const allQueued = review?.data?.games ?? [];
    const played = new Set((stats?.data?.games ?? []).map((g) => g.game_id));
    const games = catalog?.data?.games ?? [];

    // A queued task the catalog cannot serve is not a next task. The queue is static
    // triage and lists tasks independently of whether any source can currently fetch them
    // -- as of 01-Sep the arena set is triaged but unservable -- so Next must check.
    const servable = new Set(games.map((g) => g.gameId));
    const queue = allQueued.filter((g) => servable.has(g.gameId));

    if (queue.length > 0) {
      const at = queue.findIndex((g) => g.gameId === gameId);
      for (let i = 1; i <= queue.length; i++) {
        const cand = queue[(at + i + queue.length) % queue.length];
        if (cand.gameId !== gameId && !played.has(cand.gameId)) return cand.gameId;
      }
      // Whole queue played: keep moving rather than stranding the reviewer.
      const fallback = queue[(at + 1 + queue.length) % queue.length];
      if (fallback && fallback.gameId !== gameId) return fallback.gameId;
    }

    if (games.length === 0) return null;
    const pools = [
      games.filter((g) => g.category === PIPELINE_CATEGORY && !played.has(g.gameId)),
      games.filter((g) => !played.has(g.gameId)),
      games,
    ];
    const pool = pools.find((p) => p.some((g) => g.gameId !== gameId));
    if (!pool) return null;
    const candidates = pool.filter((g) => g.gameId !== gameId);
    let hash = 0;
    for (let i = 0; i < (gameId ?? '').length; i++) hash = (hash * 31 + gameId!.charCodeAt(i)) >>> 0;
    return candidates[hash % candidates.length].gameId;
  }, [review, catalog, stats, gameId]);

  useEffect(() => { if (pyodide.frame) setFrame(pyodide.frame); }, [pyodide.frame]);

  /** Which of ACTION1..7 this game accepts. Empty = unknown, so allow everything. */
  const available = useMemo(
    () => new Set((frame?.available_actions ?? []).map(Number)),
    [frame],
  );
  const known = available.size > 0;

  /**
   * The grid currently on screen, and the single source of its dimensions.
   *
   * Read from `displayFrameIndex` rather than frame[0] because applyFrame walks
   * multi-frame responses on a 200ms timer: a click landing mid-animation must map
   * against the grid the player is actually looking at, and a game whose frames differ
   * in size would otherwise map against the wrong one.
   */
  const displayedGrid = useMemo(() => {
    const frames = frame?.frame;
    if (!frames?.length) return null;
    return frames[Math.min(displayFrameIndex, frames.length - 1)] ?? null;
  }, [frame, displayFrameIndex]);

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
        // level and score are DIFFERENT numbers and are sent separately. The score used
        // to be passed in the level slot, so telemetry recorded the score twice and the
        // level never. No `levels_completed ?? score` fallback here, deliberately -- that
        // is the display fallback used for the level label, and reusing it would put the
        // score back in the level column under a different name.
        humanPlay.record(
          action,
          typeof next.levels_completed === 'number' ? next.levels_completed : null,
          s === 'WIN' ? 'WIN' : s === 'GAME_OVER' ? 'GAME_OVER' : 'NOT_FINISHED',
          typeof next.score === 'number' ? next.score : null,
          // Present when the action carried a click target -- a click on the board.
          // Null for a deck CLICK press, which sends ACTION6 with no coordinates on
          // purpose; the two are different moves and the column tells them apart.
          action === 'ACTION6' && coords ? coords : null,
        );
      }
      applyFrame(next);
    } catch { /* surfaced through pyodide.error */ }
  }, [pyodide, canSend, applyFrame, gameState]);

  const undo = useCallback(async () => {
    if (!frame?.undo_depth || pyodide.isActing) return;
    try { applyFrame(await pyodide.undo()); } catch { /* surfaced through pyodide.error */ }
  }, [pyodide, frame, applyFrame]);

  // ── The board as a click target ─────────────────────────────────────────────
  /**
   * Whether a click on the board means anything right now, and therefore whether the board
   * gets a crosshair and a hover cell at all. Three conditions, and the third is the one
   * that took two passes to get right:
   *
   *   - the run is live;
   *   - the frame offers ACTION6, so the dispatcher will not refuse it;
   *   - and the GAME ACTUALLY READS THE COORDINATES. `readsClicks === false` means we
   *     checked the source and it does not. Offering a crosshair there is a lie: the click
   *     is accepted, a step is spent, and nothing happens, which from the player's side is
   *     indistinguishable from having clicked the wrong cell.
   *
   * `null` is not `false`. An unknown task keeps the frame's word.
   */
  const boardClickable =
    gameState === 'playing' && canSend('ACTION6') && readsClicks !== false;

  /**
   * Pointer position -> frame cell.
   *
   * Proportional against the element's own box, NOT against a cell size derived from
   * canvas.width. The console screen is a fixed square and the canvas is stretched to
   * fill it (`w-full h-full`), so the drawn pixel size and the displayed pixel size are
   * different numbers; dividing by the drawn one lands on the wrong cell on any grid
   * that is not square. Clamped because a click exactly on the right or bottom edge
   * computes one past the last index.
   */
  const cellFromPointer = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const grid = displayedGrid;
    const canvas = canvasRef.current;
    if (!grid?.length || !canvas) return null;
    const h = grid.length;
    const w = grid[0]?.length ?? 0;
    if (!w) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * w);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * h);
    if (x < 0 || y < 0 || x > w || y > h) return null;
    // Clamp rather than reject: a click on the last pixel of the last column computes
    // exactly `w`, and dropping it would make the board's right and bottom edges dead.
    return { x: Math.min(x, w - 1), y: Math.min(y, h - 1) };
  }, [displayedGrid]);

  /**
   * A click on the board IS ACTION6. No arming, no deck button first -- the click games
   * are unplayable any other way (see point 7 in the header). Guarded exactly as the deck
   * controls are: an unavailable action is refused, and a click while a step is in flight
   * is dropped rather than queued, so a fast clicker cannot outrun the worker.
   */
  const clickBoard = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!boardClickable || pyodide.isActing) return;
    const cell = cellFromPointer(e);
    if (!cell) return;
    void act('ACTION6', cell);
  }, [boardClickable, pyodide.isActing, cellFromPointer, act]);

  // ── Keyboard ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'idle') return;
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); void act('RESET'); return; }
      // Z is Undo. It returns before KEY_MAP is consulted so it can never also be read as
      // a move -- see the note on KEY_MAP. Held down it repeats, which is what rewinding
      // out of a blind guess actually looks like; undo() itself refuses at depth 0 and
      // while a step is in flight, so the repeat cannot outrun the engine.
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); void undo(); return; }
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
  }, [act, undo, canSend, gameState, live]);

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

  /** The run is over — won or lost. Both ends offer feedback and both ends move on. */
  const runOver = gameState === 'won' || gameState === 'lost';

  const showFeedbackPanel = gameState !== 'idle' && (showFeedback || runOver);

  // The console alone fills a laptop viewport, so a panel appended below it opens
  // off-screen and is never seen. Bring it into view when it appears.
  useEffect(() => {
    if (!showFeedbackPanel) return;
    const t = setTimeout(
      () => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      120,
    );
    return () => clearTimeout(t);
  }, [showFeedbackPanel]);

  // ── Canvas ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const grid = displayedGrid;
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
    // The cell a click would land on. Drawn INTO the canvas rather than positioned as an
    // overlay div: the canvas is stretched to the square screen, so an overlay would need
    // the same proportional maths a second time and would drift from it. Two strokes,
    // dark under light, so it reads on any ARC3 colour.
    if (hoverCell && hoverCell.y < h && hoverCell.x < w) {
      const px = hoverCell.x * scale;
      const py = hoverCell.y * scale;
      ctx.lineWidth = Math.max(1, Math.round(scale / 8));
      ctx.strokeStyle = 'rgba(0,0,0,.75)';
      ctx.strokeRect(px + ctx.lineWidth / 2, py + ctx.lineWidth / 2, scale - ctx.lineWidth, scale - ctx.lineWidth);
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.strokeRect(px + ctx.lineWidth * 1.5, py + ctx.lineWidth * 1.5, scale - ctx.lineWidth * 3, scale - ctx.lineWidth * 3);
    }
  }, [displayedGrid, hoverCell]);

  /** Nothing to hover when the board is not a click target -- a stale outline left over
   *  from a clickable task would say the next one takes clicks when it does not. */
  useEffect(() => { if (!boardClickable) setHoverCell(null); }, [boardClickable]);


  const start = useCallback(async () => {
    const target = gameId;
    humanPlay.start(target ?? '');
    setDisplayFrameIndex(0);
    try {
      const first = await pyodide.initGame(target!);
      // A cold boot is a minute long and Next is reachable for the whole of it. If the
      // player moved on while this was in flight, the frame belongs to a task they are no
      // longer looking at — drop it rather than dealing it onto the new task's screen.
      if (shownGameRef.current !== target) return;
      applyFrame(first);
    } catch { /* pyodide.error is rendered */ }
  }, [pyodide, gameId, applyFrame]);

  /**
   * SAME ROUTE, DIFFERENT TASK.
   *
   * Next goes from /arc3/play/A to /arc3/play/B — one route, one param. wouter swaps
   * `gameId` and React keeps this component mounted, and nothing here used to read that:
   * the old frame, the old GAME OVER overlay and the old game inside the Pyodide worker
   * all survived the navigation. The URL changed and the screen did not, which is the
   * whole of the "clicking Next Task does nothing" report.
   *
   * Reset in place rather than remounting on `key={gameId}`. A remount tears down
   * usePyodideGame, whose unmount terminates the worker, so every Next would pay a full
   * cold boot — Pyodide, numpy, pydantic and the engine wheel, up to a minute — on a
   * queue meant to be walked hundreds of times. The worker's `load_game` accepts a new
   * game into a warm runtime, so we keep the runtime and re-init.
   *
   * A warm worker starts the next task immediately; a cold or broken one falls back to
   * the START screen, because that first minute is one the player should choose to spend.
   */
  useEffect(() => {
    if (shownGameRef.current === gameId) return;
    shownGameRef.current = gameId;

    // The finished run's tail events, before humanPlay.start() drops the queue. This page
    // never unmounts on a Next, so pagehide will not do it for us.
    try { humanPlay.flush(false); } catch { /* fire and forget */ }

    if (animRef.current) { clearTimeout(animRef.current); animRef.current = null; }
    heldRef.current = null;
    setFrame(null);
    setGameState('idle');
    setDisplayFrameIndex(0);
    setShowFeedback(false);
    setShowHelp(false);
    setLive(false);
    setRevealEarned(false);
    setHoverCell(null);

    if (pyodide.status === 'ready') void start();
  }, [gameId, start, pyodide.status]);

  /** This task's entry in the mechanic guide, once the run is over and it has loaded. */
  const reveal = useMemo(
    () => mechanics?.data?.games?.find((g) => g.gameId === gameId) ?? null,
    [mechanics, gameId],
  );

  /** Feedback's exit, and the game-over Skip. Nowhere to go is a no-op, never a dead end
   *  on the queue's last task. */
  const goNext = useCallback(() => {
    if (nextGameId) navigate(`/arc3/play/${nextGameId}`);
  }, [navigate, nextGameId]);

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

  /*
   * THE DECK CLICK BUTTON. This sends ACTION6 with NO coordinates, which is a different
   * move from clicking the board and is kept on purpose -- the commit-style tasks read
   * ACTION6 as "I am finished" and never look at data. Whether that mechanic should exist
   * in our synthetic set is an open question (see point 7 in the header); until it is
   * settled this control stays. Removing it would silently delete the only way to send
   * a bare ACTION6.
   */

  return (
    <div
      className="min-h-screen w-full flex flex-col"
      style={{ background: ARC.ground, color: ARC.text, fontFamily: MONO }}
    >
      {/* One slim bar. This route sits outside PageLayout precisely so the site nav is
          not stacked on top of the console. */}
      <div className="flex items-center gap-4 px-4 h-11 shrink-0" style={{ borderBottom: `1px solid ${ARC.border}` }}>
        <Link href="/arc3/gallery" className="flex items-center gap-1.5 text-[12px]" style={{ color: ARC.dim }}>
          <ArrowLeft className="w-3.5 h-3.5" /> All tasks
        </Link>
        <span className="text-[11px]" style={{ color: ARC.faint }}>
          {gameState === 'idle' ? '' : `Step ${frame?.action_counter ?? 0}`}
        </span>
        {/* Where this sits in the review run. A reviewer working a 328-long queue needs to
            see progress, and it marks the difference between the queue walk and the
            catalog fallback. */}
        {queuePosition && (
          <span className="text-[11px]" style={{ color: ARC.faint }}>
            Review {queuePosition.at} / {queuePosition.of}
          </span>
        )}
        {statusLabel && (
          <span className="ml-auto text-[11px]" style={{ color: statusColor }}>{statusLabel}</span>
        )}
        {/* Always available: most players will not finish most tasks, and the loop that
            produces volume is play -> react -> next, not play -> finish -> next. */}
        {nextGameId && (
          <Link
            href={`/arc3/play/${nextGameId}`}
            className={`flex items-center gap-1 text-[12px] ${statusLabel ? '' : 'ml-auto'}`}
            style={{ color: ARC.pink }}
          >
            Next task <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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

        <div className={`w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-5 ${
          showFeedbackPanel ? 'lg:max-w-[880px]' : ''
        }`}>
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
            // On the official deck this is SELECT. A real-time task needs the live
            // toggle there; every other task uses it for the notes scratchpad, so the
            // control is never dead weight.
            label: meta?.isLive ? 'Live' : 'Notes',
            onPress: () => {
              if (meta?.isLive) setLive((v) => !v);
              else setShowFeedback((v) => !v);
            },
            disabled: gameState === 'idle',
            active: meta?.isLive ? live : showFeedback,
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
                    ? pyodide.loadingStage === 'game'
                      ? 'Loading this task'
                      : 'One-time engine load — this can take a minute'
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
                {/* The board IS the ACTION6 target. Clicking a cell sends ACTION6 with
                    that cell's coordinates -- no deck button first. The crosshair and the
                    hover outline appear only when this task actually takes ACTION6. */}
                <canvas
                  ref={canvasRef}
                  className={`block w-full h-full ${boardClickable ? 'cursor-crosshair' : ''}`}
                  style={{ imageRendering: 'pixelated' }}
                  onClick={clickBoard}
                  onMouseMove={(e) => { if (boardClickable) setHoverCell(cellFromPointer(e)); }}
                  onMouseLeave={() => setHoverCell(null)}
                />
                {showHelp && (
                  <div className="absolute inset-0 p-5 flex flex-col justify-center gap-2 text-[10.5px] leading-relaxed"
                       style={{ background: 'rgba(0,0,0,.86)', color: 'rgba(255,255,255,.85)' }}>
                    <p style={{ color: '#FFF' }}>Controls</p>
                    <p>Arrows or WASD — the d-pad.</p>
                    <p>Spacebar — the Spacebar button.</p>
                    <p>Click the board — that is ACTION6, sent at the cell you clicked.</p>
                    <p>The Click button sends the same action with no coordinates, for the
                       tasks that use it as a plain button.</p>
                    <p>Z undoes one move. R resets the level.</p>
                    <p>Notes opens a scratchpad — tell us if a task seems broken.</p>
                    <p style={{ color: 'rgba(255,255,255,.5)' }}>
                      Greyed controls are ones this task does not use. What any of them do
                      is for you to find out — that part is the experiment.
                    </p>
                  </div>
                )}
                {(gameState === 'won' || gameState === 'lost') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4"
                       style={{ background: 'rgba(0,0,0,.82)' }}>
                    <p className="text-[22px] tracking-[2px]"
                       style={{ color: gameState === 'won' ? ARC.green : ARC.red }}>
                      {gameState === 'won' ? 'YOU WIN' : 'GAME OVER'}
                    </p>
                    {/* No Undo here, deliberately. The official console does not let you
                        rewind out of a loss -- it offers the level again, and nothing
                        else. Undo stays on the deck DURING play, where the real console
                        also has it, but a game over is a game over. */}
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      <button onClick={() => void act('RESET')} className="px-4 h-8 text-[11px] rounded-[4px]"
                              style={{ border: '1px solid rgba(255,255,255,.35)', color: '#FFF' }}>
                        Try the level again
                      </button>
                      {nextGameId && (
                        <Link
                          href={`/arc3/play/${nextGameId}`}
                          className="px-4 h-8 text-[11px] rounded-[4px] inline-flex items-center gap-1.5"
                          style={{ background: ARC.pink, color: '#fff' }}
                        >
                          Next task <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          }
        />

        {/* Feedback sits BELOW the console, never inside the screen. Two reasons: the CRT
            is a fixed square and the form clipped inside it, and while writing about a
            task you need to still see the task. The console stays authentic -- its screen
            shows only what the official one shows. */}
        {showFeedbackPanel && (
          <div ref={feedbackRef} className="w-full max-w-[500px] lg:max-w-[340px] lg:mt-8 p-4 shrink-0"
               style={{ border: `1px solid ${ARC.border}`, background: '#111010' }}>
            {/* onDone was undefined at game over — the panel opens off `gameState` there,
                not off `showFeedback` — so sending feedback ended at "Thanks" and left the
                player parked on a task they had finished. Finishing the form IS the end of
                the run, so it hands them the next task. Mid-run it is still just a
                scratchpad and closing it returns you to the game you are playing. */}
            <Arc3FeedbackPanel
              compact
              key={gameId}
              /* THE REVEAL. Sending feedback is what earns it: the reviewer's reading of
                 the task is recorded BEFORE they are told what it was, which is the only
                 order in which their reading is worth anything. Supplying this also stops
                 the panel auto-advancing, so the reveal stays until they leave it.

                 ON ANY SUBMIT, NOT ONLY AT THE END, because the end is not reachable.
                 None of the fifty tasks calls lose() -- verified across the set by
                 scripts/arc3/mechanic_digest.py, which reports callsLose false for all of
                 them -- so there is no GAME OVER and the only finish is winning every
                 level. Gating the reveal on a finished run would have hidden it from
                 almost every reviewer, on a page whose own Next-task logic is written
                 around most people not finishing most tasks. Mid-run it costs a deliberate
                 act: open Notes, write something, press send. */
              onSent={() => setRevealEarned(true)}
              afterSent={
                <MechanicReveal
                  entry={reveal}
                  onNext={runOver && nextGameId ? goNext : undefined}
                  onBack={runOver ? undefined : () => setShowFeedback(false)}
                />
              }
              gameId={gameId ?? ''}
              reachedLevel={levelsDone}
              outcome={gameState === 'won' ? 'completed' : gameState === 'lost' ? 'lost' : 'in_progress'}
              doneLabel={runOver ? 'Skip \u2192 next task' : 'Skip'}
              onDone={
                runOver
                  ? (nextGameId ? goNext : undefined)
                  : () => setShowFeedback(false)
              }
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
