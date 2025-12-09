# 2025-12-09 – Worm Arena Live Match Streaming Plan

Author: Cascade  
Date: 2025-12-09  
Scope: Worm Arena UX, backend SSE endpoint, frontend streaming tab

## 1. Goal / UX Overview

When a user clicks `▶ Run Match` in Worm Arena:

- **G1.** Start a real SnakeBench match (as today) but expose a **streaming session** while it runs.
- **G2.** Immediately open a **new browser tab** dedicated to that match, with a URL like `/worm-arena/live/:sessionId`.
- **G3.** In the live tab, mirror existing streaming UX patterns (Saturn / Puzzle Examiner):
  - Status badges (starting / in progress / completed / failed).
  - Rolling text / reasoning log.
  - Live or near-live board view using `WormArenaGameBoard`.
- **G4.** On completion, still persist a replay-compatible JSON file and DB row so the existing Worm Arena replay view continues to work unchanged.

Non-goals for this iteration:
- Leaderboards, matchmaking queues, or multi-spectator sync are out of scope.
- We do **not** change the external SnakeBench Next.js embed (that’s SnakeArena, separate).

---

## 2. Backend Design – Streaming Endpoint

### 2.1 Shared types

- **File:** `shared/types.ts`
- **Add:** Worm Arena streaming types (no breaking changes):
  - `WormArenaStreamStatus` – `{ state: 'starting' | 'in_progress' | 'completed' | 'failed'; phase?: string; message?: string; round?: number; }`.
  - `WormArenaFrameEvent` – `{ round: number; frame: any; timestamp: number; }` (reuses raw SnakeBench frame JSON shape to stay compatible with Python).
  - `WormArenaFinalSummary` – `{ gameId: string; modelA: string; modelB: string; scores: Record<string, number>; results: Record<string, SnakeBenchResultLabel>; roundsPlayed?: number; }`.

These are strictly additive so current code keeps compiling.

### 2.2 New controller: Worm Arena streaming

- **File:** `server/controllers/wormArenaStreamController.ts` (new).
- **Responsibilities:**
  1. **POST `/api/wormarena/prepare`**
     - Body: match config compatible with `SnakeBenchRunMatchRequest`.
     - Validates `modelA`, `modelB` (can reuse logic from `snakeBenchController.runMatch`).
     - Allocates a `sessionId` (use same ID pattern as `analysisStreamService` / `SSEStreamManager`).
     - Stores a small "pending run" object in an in-memory map keyed by `sessionId`:
       - `{ request: SnakeBenchRunMatchRequest; createdAt; expiresAt }`.
     - Returns `{ sessionId, createdAt, expiresAt }`.

  2. **GET `/api/wormarena/stream/:sessionId` (SSE)**
     - Registers an SSE connection via `SSEStreamManager.register(sessionId, res)`.
     - Emits initial event:
       - `event: stream.init` with `{ sessionId, createdAt, modelA, modelB }`.
     - Triggers the actual Python-backed match run via `snakeBenchService.runMatchStreaming(...)` (see 2.3).
     - Forwards callbacks from the service to SSE:
       - `stream.status` – status/phase updates (`WormArenaStreamStatus`).
       - `stream.frame` – individual `WormArenaFrameEvent` items, when available.
       - `stream.complete` – final `WormArenaFinalSummary` and `gameId`.
       - `stream.error` – error payload and marks session as failed.

### 2.3 Service changes: `snakeBenchService`

- **File:** `server/services/snakeBenchService.ts`

Current behavior:
- `runMatch` spawns Python once, buffers all stdout, parses **only the last line** as JSON, then returns a `SnakeBenchRunMatchResult`.

Planned extension (non-breaking):

1. **Introduce a new method**:
   - `runMatchStreaming(request: SnakeBenchRunMatchRequest, handlers: { onStatus?: (status) => void; onFrame?: (frameEvent) => void; onComplete?: (result) => void; onError?: (err) => void; }): Promise<void>`

2. **Implementation sketch:**
   - Internally reuse most of `runMatch` logic (model validation, clamping, env, spawn options).
   - Differences:
     - Start the Python child process as now, but:
       - As each `stdout` line arrives, attempt to parse it as JSON.
       - If it has an obvious frame structure (e.g. `type: 'frame'` or `state.frames`), call `handlers.onFrame`.
       - If it looks like a status/log event, call `handlers.onStatus`.
     - On close:
       - Parse the final JSON line as `SnakeBenchRunMatchResult` (exactly as today).
       - Trigger DB persistence + filesystem index via the existing logic.
       - Call `handlers.onComplete(result)`.
   - If Python currently only emits a single JSON line, `runMatchStreaming` can still:
     - Emit `onStatus({ state: 'starting' })` when process starts.
     - Emit `onStatus({ state: 'in_progress' })` when the first output arrives.
     - Emit `onComplete` when the final JSON is parsed.

3. **Backwards compatibility:**
   - Keep `runMatch` as a thin wrapper around `runMatchStreaming` that collects only the final result and returns it, so existing `/api/snakebench/run-match` continues to work.

### 2.4 Routing / wiring

- **File:** `server/routes.ts` or equivalent route registration file.
- **Add routes:**
  - `POST /api/wormarena/prepare` → `wormArenaStreamController.prepare`.
  - `GET  /api/wormarena/stream/:sessionId` → `wormArenaStreamController.startStream`.

No authentication; must remain public per project rules.

---

## 3. Frontend Design – Hooks & Pages

### 3.1 New streaming hook: `useWormArenaStreaming`

- **File:** `client/src/hooks/useWormArenaStreaming.ts` (new).

**State exposed:**
- `status`: `'idle' | 'starting' | 'in_progress' | 'completed' | 'failed'` (derived from SSE events).
- `frames`: `WormArenaFrameEvent[]`.
- `currentFrame`: convenience getter for the latest frame.
- `logs`: string[] or `{ ts, message }[]`.
- `finalSummary?: WormArenaFinalSummary`.
- `error?: string`.

**Methods:**
- `startMatch(config: SnakeBenchRunMatchRequest): Promise<{ sessionId: string; liveUrl: string }>`
  - Calls `POST /api/wormarena/prepare`.
  - Builds `liveUrl = window.location.origin + '/worm-arena/live/' + sessionId`.
- `connect(sessionId: string): void`
  - Opens `EventSource` to `/api/wormarena/stream/${sessionId}`.
  - Wires `stream.init`, `stream.status`, `stream.frame`, `stream.complete`, `stream.error` into state.
- `disconnect(): void`
  - Closes the SSE connection and resets/optionally preserves history.

API style intentionally mirrors `useSaturnProgress` + `useAnalysisStreaming` but simplified.

### 3.2 New live match page: `WormArenaLive`

- **File:** `client/src/pages/WormArenaLive.tsx` (new).
- **Route:** `/worm-arena/live/:sessionId` configured in the client router.

**Responsibilities:**
- Read `sessionId` from route params.
- On mount: call `connect(sessionId)` from `useWormArenaStreaming`.
- Layout:
  - **Header:**
    - Shows models (`modelA vs modelB`) once known from `finalSummary`.
    - Shows status badge using the same visual language as `StreamingAnalysisPanel`.
  - **Main content:** 2 or 3-column layout, matching the farm aesthetic:
    - Center: `WormArenaGameBoard` rendering `currentFrame.frame` with `boardWidth/boardHeight` derived from the frame data.
    - Side panel: text / reasoning log.
  - **Footer:**
    - Final scores and result when `status === 'completed'`.
    - Link / button to open the replay in the existing Worm Arena page once `finalSummary.gameId` is known (e.g. `/worm-arena?gameId=...`).

This page does **not** depend on the main WormArena component; it just consumes the stream.

### 3.3 Update WormArena “Run Match” behavior

- **File:** `client/src/pages/WormArena.tsx`.

Current `handleRunMatch`:
- Builds `SnakeBenchRunMatchRequest`.
- Calls `useSnakeBenchMatch().runMatch(payload)`.
- When response returns, sets `selectedGameId` and refreshes games.

Planned change:
- Introduce small wrapper around `useWormArenaStreaming.startMatch`:

  - On click of `▶ Run Match`:
    1. Validate `modelA`/`modelB` as today.
    2. Call `startMatch(payload)`.
    3. When it returns `{ sessionId, liveUrl }`, call `window.open(liveUrl, '_blank', 'noopener,noreferrer')`.

- Keep existing `useSnakeBenchRecentGames` + `useSnakeBenchGame` logic untouched so replays still work.
- Optionally: when `finalSummary.gameId` becomes available on the live page, it can redirect back or hint to the main WormArena page for replay.

---

## 4. Integration & Compatibility

- **Existing `/api/snakebench/run-match`** remains for non-streaming consumption (other tools, scripts, or SnakeArena page).
- **New streaming endpoints** live under `/api/wormarena/*` to keep concerns separated and avoid breaking existing clients.
- Streaming uses the same SSE infrastructure (`SSEStreamManager`) and event naming style as `streamController` so monitoring/logging stays consistent.
- All endpoints remain **public** (no auth middleware) to comply with ARC Explainer external integration requirements.

---

## 5. Implementation Order

1. **Types & service**
   - Add streaming types to `shared/types.ts`.
   - Implement `snakeBenchService.runMatchStreaming` and refactor `runMatch` onto it.

2. **Controller + routes**
   - Add `wormArenaStreamController` with prepare + stream handlers.
   - Wire routes into the Express app under `/api/wormarena/*`.

3. **Frontend streaming hook**
   - Implement `useWormArenaStreaming` with SSE wiring and state machine.

4. **Live page**
   - Build `WormArenaLive` page with `WormArenaGameBoard` + basic status/log UI.

5. **Wire Run Match button**
   - Update `WormArena.tsx` to call `startMatch` and open the new tab.

6. **Polish**
   - Improve logs / status messages.
   - Optional: add per-round frame streaming once Python side supports it.

---

## 6. Open Questions

- Do we need true per-round live frames in v1, or is a coarse-grained streaming status + final summary acceptable initially?
- Preferred URL pattern: `/worm-arena/live/:sessionId` vs query-string-based.
- How much of the StreamingAnalysisPanel UI (grids, prompt preview) should be reused vs. a slimmer, WormArena-specific status card.
