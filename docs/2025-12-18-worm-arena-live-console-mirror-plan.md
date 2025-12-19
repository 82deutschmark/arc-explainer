# 2025-12-18 - Worm Arena Live "Console Mirror" tab plan

Author: GPT-5.2 (Codex CLI)  
Date: 2025-12-18 (updated 2025-12-19)  
PURPOSE: Add an educational "Console Mirror" tab to Worm Arena Live that shows (1) the ASCII board and (2) the raw, chronological stream of events emitted while the match runs, mirroring what a developer would watch in a Python terminal. Also includes an in-app "How it works" explanation so non-technical users can understand the full end-to-end pipeline.

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

## In-app explanation ("How it works") - draft copy for users
This section is the content we will render on the Worm Arena Live page (inside the Console Mirror tab, collapsed by default). It is written for curious users who want to understand what they are seeing without reading the code.

### What you are watching
Worm Arena is a live match between two AI models playing the same snake game.
- The center of the page is the game board.
- Each round, both models choose one move: UP, DOWN, LEFT, or RIGHT.
- The Console Mirror tab shows the raw feed coming out of the Python engine (plus a live ASCII board), like watching the game run in a terminal.

### The high-level pipeline (end-to-end)
1) Your browser starts a live match and opens a unique live URL.
2) The server launches a Python process that runs the SnakeBench engine.
3) Each round, the Python engine asks both models for their next move.
4) The engine updates the board, score, and who is still alive.
5) The engine streams events as it runs, and the browser displays them immediately.
6) When the match ends, the engine writes a replay JSON file and updates the database so the match can be replayed and counted in stats.

### What happens every round (the game loop)
Each round follows the same pattern:
- The engine takes a snapshot of the current game state (snake positions, apples, scores).
- It asks each alive snake player for a move. In Worm Arena there are two players.
- Both moves are applied at the same time (so collisions and head-on crashes are handled fairly).
- Apples are eaten, scores are updated, and new apples are spawned to keep the board stocked.
- The engine checks if the match should end (max rounds reached, only one snake left alive, or someone hit the apple target).

### How the AI models are asked to move (the prompt)
Each player is an LLM-based "snake controller". The engine sends the model a text description of the current state including:
- Board size and the coordinate system (0,0 is bottom-left).
- Locations of apples.
- Your snake's head and body coordinates.
- The opponent snake's head and body coordinates.
- Current scores.
- An ASCII rendering of the board so the model can visually parse the state.
- Your last move and your last reasoning (so the model can stay consistent turn to turn).

Important rule: the model can write as much reasoning as it wants, but the last non-empty line must be exactly one of: UP, DOWN, LEFT, RIGHT.

### How model output becomes a move (and why random moves happen)
After the model responds:
- The engine scans the response for a valid direction and uses it as the move.
- If the provider call fails (network issue, auth issue, model error), the engine logs a provider error and chooses a random move so the match can continue.
- If the model talks but never outputs a valid final direction, the engine also chooses a random move.

In the Console Mirror, these situations are visible as status lines and as the model text you received that round.

### What the ASCII board means
The ASCII board in the Console Mirror matches the Python engine's printed board:
- Each row is labeled with its y coordinate, with the top row shown first.
- The bottom line shows x-axis labels.
- `.` is empty space.
- `A` is an apple.
- `0` and `1` are snake heads (player slots).
- `T` is snake body / tail.

### What the streaming events mean
The live feed is event-based. You will see a mix of:
- Status messages: plain text progress like "Finished round 12 ..." and connection state updates.
- Frame events: a full snapshot of the board state for a specific round (used to render the ASCII board).
- Chunk events: text output produced by a model for a specific round (typically the model's rationale or "thoughts").
- Completion event: the final match summary including the game ID, scores, and results.

The curated UI and the Console Mirror are two views of the same underlying stream.

Note: ARC Explainer runs SnakeBench in a structured streaming mode where the Python engine emits JSON events. In that mode, the engine does not print a full ASCII board to stdout every turn; instead it emits frame snapshots, and the Console Mirror reconstructs the same board view from those frames.

### What we do and do not show (privacy and safety)
The Console Mirror is meant to be educational, but it is still safe by design:
- We do show the model output text used to justify moves (because that is the most educational part).
- We do not show API keys, auth headers, or raw HTTP request headers.
- We do not currently stream the full prompt text by default. If we want a true "API call mirror" that includes the prompt and call metadata (latency, token usage), we will add a dedicated, sanitized event type from the Python provider layer.

### What gets saved when the match ends
When the match finishes, the engine does two important things:
- Writes a replay JSON file (the full frame-by-frame history plus metadata such as per-player totals and costs).
- Updates the database so the match appears in the replay list, matches list, and the stats/placement pages.

That is why a live match can always be replayed later, even though you watched it live.

## In-app explanation - developer mapping (where each part lives in code)
This is not shown to users, but it is included in the plan so a developer can verify the explanation against source of truth.

### Match launch and live URL
- Frontend entry point: `client/src/pages/WormArenaLive.tsx`
- SSE connection + state: `client/src/hooks/useWormArenaStreaming.ts`
- SSE controller: `server/controllers/wormArenaStreamController.ts`

### Python process and streaming bridge
- Node spawns Python runner: `server/services/snakeBenchService.ts` (`runMatchStreaming`)
- Python bridge reads payload and runs SnakeBench: `server/python/snakebench_runner.py`

### SnakeBench engine (game loop, rules, persistence)
- Core loop and event emission: `external/SnakeBench/backend/main.py`
  - Emits JSON stdout events when `ARC_EXPLAINER_STDOUT_EVENTS=1` (`game.init`, `frame`, `chunk`)
  - Prints "Finished round ..." status lines every round
  - Writes replay JSON in `save_history_to_json` and updates DB in `persist_to_database`
- Board formatting and coordinate convention: `external/SnakeBench/backend/domain/game_state.py` (`GameState.print_board`)
- Win conditions / apple target: `external/SnakeBench/backend/domain/constants.py` (`APPLE_TARGET`)

### LLM "player" and prompts
- LLM player logic: `external/SnakeBench/backend/players/llm_player.py`
  - Builds the prompt from the current `GameState`
  - Parses the model response to extract the final direction
  - Falls back to a random move on provider errors or invalid outputs
  - Computes per-move cost using token usage and pricing

### Provider calls (OpenRouter vs direct OpenAI)
- Provider abstraction and Responses usage: `external/SnakeBench/backend/llm_providers.py`
  - OpenRouter proxy calls (base_url configurable via `OPENROUTER_BASE_URL`)
  - Direct OpenAI calls through `/v1/responses` when `OPENAI_API_KEY` exists and the model is OpenAI
  - Responses input is built as role/content items (not chat message arrays)

### Live DB state (optional, but part of SnakeBench)
- Live state updates in Postgres: `external/SnakeBench/backend/data_access/live_game.py` and `external/SnakeBench/backend/data_access/repositories/game_repository.py`
  - Writes `games.current_state` and `games.rounds` while the match runs
  - Marks `games.status='completed'` when the match ends

### Environment variables that change behavior
- `ARC_EXPLAINER_STDOUT_EVENTS`: when enabled, SnakeBench prints structured JSON events for frames and chunks.
  - Side effect: per-turn `print_board()` output is suppressed; the live UI should render from emitted frame snapshots instead.
- `DATABASE_URL`: SnakeBench uses this to write live state, replays, participants, and ratings to Postgres.
- `OPENROUTER_API_KEY` and `OPENAI_API_KEY`: control which providers can be used.

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
  - Include a collapsed-by-default "How it works" panel that renders the user-facing explanation text from this plan, so the live view stays clean but curious users can learn the full pipeline.

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
- Implement an ASCII renderer that matches SnakeBench's terminal board format (`GameState.print_board`) so the Console Mirror output matches what users would see in Python.
  - This is separate from the existing replay ASCII helper, which uses different symbols and labeling for compactness.
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
