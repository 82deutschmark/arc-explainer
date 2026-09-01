<!--
Author: Claude Opus 5
Date: 2026-09-01
PURPOSE: Plan of record for the three faults reported on the ARC3 play surface — Next
         task doing nothing, feedback never advancing, and Z not undoing. Written before
         the edits, kept as the audit trail for why each fix took the shape it did.
SRP/DRY check: Pass — a plan document; no code.
-->

# ARC3 play loop — Next, feedback and Undo

## Reported

1. After Game Over the player is asked for feedback; sending it should carry them to the
   next task. It does not.
2. Clicking **Next task** does nothing.
3. The **Z** keyboard shortcut for Undo does not work.

## Diagnosis

### 1 & 2 are one root cause plus one missing wire

`/arc3/play/:gameId` is a single route (`client/src/App.tsx:113`). Next points at the same
route with a different param, so wouter swaps `gameId` while React keeps
`CommunityGamePlay` mounted. Nothing in the page read that change: `frame`, `gameState`,
`displayFrameIndex` and the game loaded inside the Pyodide worker all survived the
navigation, so the GAME OVER overlay stayed up and the screen never moved. The `<Link>`
itself is fine — the "All tasks" link two elements away uses the identical pattern and
works, because it targets a *different* route and therefore remounts.

On top of that, the feedback panel's `onDone` was passed only when `showFeedback` was
true. At game over the panel opens off `gameState`, not `showFeedback`, so `onDone` was
`undefined` and the panel's post-submit `setTimeout(() => onDone?.(), 900)` was a no-op.
Even mid-run `onDone` only closed the panel — "go to the next task" was never implemented
anywhere.

### 3 is a straight contradiction between three places

`KEY_MAP` bound `z`/`Z` to `ACTION5` alongside the spacebar. `undo()` had no keyboard path
at all. The deck button read "Undo (Z)" and the Help overlay read "Spacebar or Z". So the
key a stuck player reaches for spent a move instead of taking one back.

## Decisions

- **Reset in place, not `key={gameId}`.** A remount tears down `usePyodideGame`, whose
  unmount cleanup terminates the worker, so every Next would pay a full cold boot
  (Pyodide + numpy + pydantic + the engine wheel, budgeted at up to 180s) on a queue meant
  to be walked hundreds of times. The worker's `load_game` accepts a new game into a warm
  runtime, and `ensureWorkerReady()` is idempotent, so the runtime is kept and re-inited.
- **Auto-start only on a warm runtime.** `pyodide.status === 'ready'` means the engine is
  already up and the next task appears immediately. Cold or errored falls back to the
  START screen, because that first minute is one the player should choose to spend.
- **Flush telemetry on the way out.** `humanPlay.start()` clears the pending queue, and
  this page never unmounts on a Next, so `pagehide` will not flush for us. Without an
  explicit flush the finished run's tail events would be dropped — a data-loss bug that
  only becomes reachable once Next works.
- **Z is Undo, the spacebar is ACTION5, no key means both.** Confirmed with the user.
- **Drop a frame that arrives for a task you have left.** Next is reachable during the
  cold boot, so `initGame`'s promise can resolve after the player has moved on. `start()`
  now compares the task it was asked for against the one on screen before applying the
  frame; without that, task A's board would appear under task B's URL.

## Changes

| File | Change |
| --- | --- |
| `client/src/pages/arc3-community/CommunityGamePlay.tsx` | `gameId`-change effect: flush telemetry, clear run state, re-init on a warm worker. `goNext` via `useLocation`. Z bound to `undo()` ahead of `KEY_MAP`; `z`/`Z` removed from `KEY_MAP`. `undo()` gated on `pyodide.isActing`. Help text and loading copy corrected. |
| `client/src/components/arc3-community/Arc3FeedbackPanel.tsx` | New optional `doneLabel`; `onDone` documented as the caller's choice of exit. |

## Verification

- `npx tsc --noEmit` — no new errors (pre-existing failures are in `server/` and `tests/`,
  untouched here).
- Driven in the browser against `npm run dev`, all four confirmed:
  - Z at step 1 returned to step 0, reverted the board and re-greyed the Undo control; a
    spacebar keydown advanced to step 1. Distinct, both working.
  - Next from a warm worker moved q246-v1 -> q225-v1 -> q255-v1, each landing on a fresh
    board at step 0 with "Review N / 328" advancing. Next from a never-started page moved
    the task and correctly showed the START screen instead of auto-starting.
  - Lost q225-v1 deliberately, ticked a flag, sent feedback: `POST /api/arc3-play/feedback`
    200, the queued `human-events` flushed 200, and the page landed on the next task.
- Console is clean apart from Vite's HMR websocket, which points at the configured port
  rather than the auto-assigned one — unrelated to this change. The
  `validateDOMNesting: <a> inside <a>` warning this page did emit is fixed: wouter v3's
  `Link` renders its own anchor, so the hand-written inner `<a>` was removed from all
  three links.
