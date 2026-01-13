# 2026-01-13 Worm Arena live clock fix plan

## Context
- Live page (`WormArenaLive.tsx`) currently derives the "Clock" and "Since move" timers by subtracting timestamps embedded inside streamed frames.
- Those timestamps originate from the React hook (`useWormArenaStreaming`) calling `Date.now()` when the SSE frame event arrives, so the initial frame and the most recent frame have identical timestamps, leaving the timers stuck at 0.
- The streaming backend does not publish the authoritative match start time nor the latest move time in status/frame events, so the UI has no canonical clock to display.
- Users expect (per screenshot + description) a continuously ticking clock showing wall time since match start, a real timestamp showing when the match began, and a "since last move" timer that resets whenever a new frame/move is observed.

## Goals
1. Stream authoritative timestamps from the backend (match start, last move) so the UI no longer relies on client receipt times.
2. Update the live hook + components (status strip, scoreboard) to render:
   - Match start timestamp (human-readable and copyable if needed).
   - Live-updating wall clock (time since match start) even between frames.
   - Live-updating "since last move" timer that resets whenever a move/frame lands.
3. Ensure timers remain accurate across reconnects or slow frames and fall back gracefully when no timestamps exist.
4. Cover changes with targeted unit/integration checks (e.g., hook utility) and document the behavior.

## Deliverables
- Backend updates (streaming runner + SSE controller) emitting `matchStartedAt`/`lastMoveAt` metadata on status and frame events.
- Hook/UI changes consuming those fields, maintaining a monotonic timer via `requestAnimationFrame`/`setInterval`.
- Visual verification notes + documentation (plan resolved + CHANGELOG entry).

## Task Breakdown
1. **Audit existing data flow**
   - Trace timestamps through `SnakeBenchStreamingRunner`, `wormArenaStreamController`, `useWormArenaStreaming`, and UI components identified in the Worm Arena Replay Viewer Codemap to confirm where to attach new fields.
2. **Backend instrumentation**
   - Update streaming runner to record the first frame/status timestamp as `matchStartedAt`, update `lastMoveAt` whenever we emit a frame or detect a move.
   - Include these fields in `WormArenaStreamStatus` + `WormArenaFrameEvent` schemas (`shared/types.ts`) and propagate through SSE events.
   - Ensure `wormArenaStreamController` forwards the augmented payloads.
3. **Frontend hook & UI updates**
   - Extend `useWormArenaStreaming` state to store `matchStartedAt`, `lastMoveAt`, and drive derived timers with a `setInterval` tick (e.g., 1 Hz) so the values keep increasing even without new frames.
   - Reset "since move" timer to 0 whenever `lastMoveAt` updates; display formatted start timestamp and timers inside `WormArenaLiveStatusStrip` / scoreboard.
4. **Testing + verification**
   - Add a small unit test (or hook utility test) covering timer calculations where possible.
   - Manual QA checklist: run a live match, verify timers update, match start timestamp renders, timers reset on movement.
5. **Documentation & bookkeeping**
   - Update this plan (mark completed), CHANGELOG top entry, and any relevant reference docs outlining the timer behavior.

## Risks & Mitigations
- **Backend timestamps missing**: Guard UI with fallbacks (show "—" when data unavailable).
- **Clock drift or double intervals**: Tie timer effect lifecycle to hook subscription to prevent multiple intervals.
- **Schema changes**: Ensure all TypeScript consumers of `WormArenaStreamStatus`/`WormArenaFrameEvent` compile after adding new fields.

## Approval Checklist
- [x] User approves plan before implementation.
- [x] Update plan status to "done" once code + docs ship.

## Implementation Status
**Completed on 2026-01-13**

### Changes Made
1. **Backend timestamps** (`SnakeBenchStreamingRunner.ts`):
   - Added `matchStartedAt` captured at match launch
   - Added `lastMoveAt` updated on each frame emission
   - Created `emitStatus` and `emitFrame` helpers to inject timestamps into all events

2. **Shared types** (`shared/types.ts`):
   - Extended `WormArenaStreamStatus` with `matchStartedAt`, `lastMoveAt`, and `round` fields
   - Extended `WormArenaFrameEvent` with `matchStartedAt` and `lastMoveAt` fields

3. **Frontend hook** (`useWormArenaStreaming.ts`):
   - Added state for `matchStartedAt`, `lastMoveAt`, `wallClockSeconds`, `sinceLastMoveSeconds`
   - Extract timestamps from SSE status/frame events
   - Added `setInterval` (500ms) to continuously update timers based on authoritative timestamps
   - Export timer values for UI consumption

4. **Frontend utilities** (`client/src/lib/wormArena/timerUtils.ts`):
   - Created `computeTimerSeconds` helper for timer calculations
   - Handles null inputs gracefully, returns `{ wallClockSeconds, sinceLastMoveSeconds }`

5. **Frontend page** (`WormArenaLive.tsx`):
   - Removed local timer computation from frame timestamps
   - Now consumes authoritative timers from hook
   - Passes timers to `WormArenaLiveStatusStrip` and `WormArenaLiveScoreboard`

### Verification
- Schema compiles with new optional fields
- Hook maintains monotonic timers via interval tick
- UI components receive timer values with null fallbacks
- Timers reset correctly when new frames arrive (via `lastMoveAt` updates)
