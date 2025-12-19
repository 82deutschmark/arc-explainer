# 2025-12-18 - Worm Arena Live "Console Mirror" tab plan

Author: GPT-5.2 (Codex CLI)  
Date: 2025-12-18  
PURPOSE: Add an educational "Console Mirror" tab to Worm Arena Live that shows (1) the ASCII board and (2) the raw, chronological stream of events emitted while the match runs, mirroring what a developer would watch in a Python terminal.

## Why this exists
Worm Arena Live currently focuses on a friendly UI (scoreboard, board renderer, reasoning panels). That is great for normal users, but it hides the underlying mechanics that make the system interesting and teachable:
- The SnakeBench Python engine emits per-round prints and structured JSON events (when `ARC_EXPLAINER_STDOUT_EVENTS` is enabled).
- The Node backend converts those into SSE events (`stream.status`, `stream.frame`, `stream.chunk`, etc.).
- The frontend consumes SSE and renders a curated view.

This plan adds a "Console Mirror" tab that surfaces the raw feed and an ASCII board view so users can learn how the live system actually works.

## Desired UX (developer-to-developer)
- Worm Arena Live page (`/worm-arena/live/:sessionId`) shows tabs when the match is running or completed:
  - Tab A: current curated UI (existing layout stays as-is).
  - Tab B: "Console Mirror" showing:
    - An ASCII board that updates as frames arrive.
    - A single scrollback region of raw events in arrival order (status lines plus JSON for structured events), like tailing stdout.
- No extra clutter: the console tab is intentionally minimal (ASCII + log). Any optional controls should be compact and only appear when relevant (for example: "Follow tail" toggle, "Copy logs" button).

## Data flow (what we are mirroring)
- Python game loop: `external/SnakeBench/backend/main.py`
  - When `ARC_EXPLAINER_STDOUT_EVENTS=1`, emits JSON lines such as `game.init`, `frame`, and `chunk`.
  - When disabled, prints human-readable lines and board output.
- Node wrapper: `server/services/snakeBenchService.ts`
  - `runMatchStreaming` spawns `server/python/snakebench_runner.py` which imports and runs SnakeBench.
  - Tails stdout and translates it into handler callbacks: status messages, frame events, chunk events.
- SSE endpoint: `server/controllers/wormArenaStreamController.ts`
  - Two-step flow stays intact: `/api/wormarena/prepare` then `/api/wormarena/stream/:sessionId`.
  - Emits `stream.init`, `stream.status`, `stream.frame`, `stream.chunk`, `stream.complete`, `stream.error`, `stream.end`.
- Frontend hook: `client/src/hooks/useWormArenaStreaming.ts`
  - Connects to SSE, stores frames/chunks, and exposes the latest summaries to the UI.

The console tab should be a faithful view of the same stream the UI already uses (not a separate backend path).

## Implementation approach
### 1) Frontend: add tabs and a dedicated console component
- Add shadcn Tabs to `client/src/pages/WormArenaLive.tsx` inside the active view (live/completed).
- Keep the existing UI layout as the default tab content to avoid stepping on the "nice TypeScript version" work.
- Add a new component dedicated to the raw view, for example:
  - `client/src/components/WormArenaLiveConsoleMirror.tsx` (or a small `client/src/components/wormArena/live/` folder if we want to keep live-only components grouped).
- Console component responsibilities:
  - Render ASCII board as a `<pre>` using a shared ASCII renderer (see section 3).
  - Render a monospaced scrollback log for raw events, capped to a safe size so it does not grow unbounded.
  - Auto-scroll to bottom while "Follow tail" is enabled; disable auto-scroll when the user manually scrolls up.

### 2) Frontend: produce a single chronological log stream
Right now `useWormArenaStreaming` exposes only the latest status message, plus arrays for frames and chunks. For a console mirror we need a unified, ordered view.

Plan:
- Extend `client/src/hooks/useWormArenaStreaming.ts` to keep an in-memory `eventLog` array where every SSE event appends a single entry with:
  - event type (init/status/frame/chunk/complete/error/end)
  - timestamp (client receive time, plus any server-provided timestamp if present)
  - payload (stored as a JSON-safe object)
- Keep an upper bound (for example last 1,000 events) similar to how chunks are already capped.
- The console component renders this log by JSON-stringifying structured payloads and printing status messages as plain lines.

This avoids having to guess ordering by merging separate arrays and makes the view feel like a real terminal feed.

### 3) ASCII board rendering (reusable, consistent coordinate system)
We already have ASCII rendering logic in:
- `client/src/pages/WormArena.tsx` (replay viewer)

Plan:
- Extract that rendering function into a small utility module so both replay and live console share the same orientation and symbols.
- Suggested locations:
  - `client/src/lib/wormArena/renderAsciiFrame.ts` (frontend-only utility), or
  - `shared/utils/` if we expect both client and server to reuse it later.

Important: Worm Arena uses SnakeBench coordinates where (0,0) is bottom-left. The live console must match the replay viewer and the SVG board orientation.

### 4) Backend: decide how literal the "mirror" needs to be
Minimum viable mirror (no backend changes):
- Use the existing SSE events and show them raw in the console tab (status lines plus JSON for frame/chunk/complete).

If we want to be more literal (closer to actual stdout):
- Update `server/services/snakeBenchService.ts` to forward the raw stdout JSON line as a status/log event in addition to the parsed structured event, so the console shows exactly what the Python process printed.
  - This can be done by emitting a new SSE event type (for example `stream.raw`) or by appending the JSON line into the existing status stream.
  - If we add a new SSE event type, also update `shared/types.ts` and `client/src/hooks/useWormArenaStreaming.ts` to consume it.

### 5) "Raw API calls" (educational depth, but keep it safe)
Today, the Python stream already provides:
- `chunk` events containing each model's rationale text (per move).
- Tokens and cost exist in Python (`external/SnakeBench/backend/players/llm_player.py`) but are not currently emitted in the `chunk` metadata.

Plan options (incremental):
1) Add safe per-move metadata to chunk events (recommended first pass):
   - In `external/SnakeBench/backend/main.py`, enrich the emitted `chunk.metadata` with input tokens, output tokens, and per-move cost taken from `move_data`.
   - This keeps the event stream compact while still teaching users about cost and token usage.
2) Add explicit "api call" events (optional follow-up):
   - Instrument `external/SnakeBench/backend/llm_providers.py` to emit start/end events with safe fields only (model name, provider name, token usage, latency, response id if available).
   - Never emit API keys, auth headers, or full request headers.
   - Node side: ensure `server/services/snakeBenchService.ts` forwards these JSON stdout events to SSE (either as `stream.chunk` with a different type tag, or a dedicated event).
   - Frontend: render these events in the console log exactly as received.

## Acceptance criteria
- Live page includes a "Console Mirror" tab that is readable and clearly educational.
- Console tab shows an updating ASCII board and an ordered log of raw events while the match runs.
- Logs do not grow without bound (bounded in-memory buffer).
- The existing curated UI is unchanged in behavior and remains the default tab.
- No secrets are logged or displayed (especially API keys).

## Files expected to change (first pass)
- `client/src/pages/WormArenaLive.tsx` (add tabs and wire the console component)
- `client/src/hooks/useWormArenaStreaming.ts` (add unified event log collection)
- `client/src/components/WormArenaLiveConsoleMirror.tsx` (new; renders ASCII + log)
- `client/src/pages/WormArena.tsx` (if we extract the ASCII renderer out)
- `client/src/lib/wormArena/renderAsciiFrame.ts` (new; shared ASCII renderer)
- `CHANGELOG.md` (new version entry documenting the new educational console tab)

## Files that may change (if we deepen "raw API call" fidelity)
- `server/services/snakeBenchService.ts` (forward raw stdout lines and/or new event types)
- `server/controllers/wormArenaStreamController.ts` (emit additional SSE event types if introduced)
- `shared/types.ts` (typed payloads for any new SSE events)
- `external/SnakeBench/backend/main.py` (enrich chunk metadata with tokens/cost)
- `external/SnakeBench/backend/llm_providers.py` (optional: explicit API call start/end events, sanitized)

