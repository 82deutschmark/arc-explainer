# 2025-12-18 - Worm Arena Console Mirror (Improved Plan)

**Author:** Claude Sonnet 4  
**Date:** 2025-12-18  
**PURPOSE:** Add a "Console Mirror" view mode to BOTH the Live and Replay pages, letting users toggle between the friendly cartoon canvas view and a raw Python-style terminal experience.

## Gaps in the Original Plan

The original plan (`2025-12-18-worm-arena-live-console-mirror-plan.md`) is well-written but has these gaps:

1. **Replay page not addressed** - Only covers WormArenaLive, but users also want the raw view for replays
2. **ASCII format mismatch** - The existing `renderAsciiFrame()` in WormArena.tsx uses `@` for apples; Python's `GameState.print_board()` uses `A`
3. **Y-axis labels missing** - Python output includes row numbers (e.g., `9  . . . A . . . . . .`)
4. **X-axis labels missing** - Python output includes column labels at the bottom
5. **Tokens/cost not in chunk metadata** - Python emits chunks but doesn't include `input_tokens`, `output_tokens`, or `cost` in the metadata yet
6. **No raw stdout line forwarding** - For a true "terminal feel", we should show the actual stdout lines, not just parsed events

## Design Goals

- **Toggle, not tabs** - A simple button/switch to flip between "Cartoon" and "Console" view modes
- **Both pages** - Works on `/worm-arena` (replay) AND `/worm-arena/live/:sessionId` (live)
- **Python-accurate ASCII** - Match the exact format from `GameState.print_board()`:
  - `.` = empty, `A` = apple, `0`/`1` = snake heads, `T` = body
  - Y-axis labels on left (high to low), X-axis labels at bottom
- **Raw event log** - Chronological scrolling log of all events (status lines, frames, chunks)
- **Minimal UI in console mode** - Monospace fonts, dark theme option, auto-scroll

## Python ASCII Format Reference

From `external/SnakeBench/backend/domain/game_state.py`:

```
 9 . . . A . . . . . .
 8 . . . . . . . . . .
 7 . . . . . T T T . .
 6 . . . . . . . . 1 .
 5 . . . 0 T . . . . .
 4 . . . . . . . A . .
 3 . . . . . . . . . .
 2 . A . . . . . . . .
 1 . . . . . . . . . .
 0 . . . . A . . . . .
   0 1 2 3 4 5 6 7 8 9
```

Key details:
- Row labels are 2 characters wide, right-aligned
- Cells are space-separated
- Rows printed top-to-bottom (y=height-1 first)
- X-axis labels at bottom with 3-space indent

## Implementation

### 1. Shared ASCII Renderer

Create `client/src/lib/wormArena/renderPythonAsciiBoard.ts`:
- Input: frame state (snakes, apples, width, height, alive)
- Output: string matching Python's `GameState.print_board()` exactly
- Handles dead snakes (skip rendering if not alive)

### 2. Event Log State (Live page only)

Extend `useWormArenaStreaming` hook:
- Add `eventLog: WormArenaEventLogEntry[]` state
- Each SSE event appends an entry with: `{ type, timestamp, payload }`
- Cap at 1000 entries to prevent memory bloat
- Expose `eventLog` in hook return

### 3. Console Mirror Component

Create `client/src/components/WormArenaConsoleMirror.tsx`:
- Props: `frame`, `boardWidth`, `boardHeight`, `eventLog?`, `aliveMap?`
- Renders:
  - ASCII board in a `<pre>` block
  - Event log as scrolling monospace text (for live page)
  - Auto-scroll toggle ("Follow tail")
- Dark terminal theme styling

### 4. View Mode Toggle

Add to both pages:
- State: `viewMode: 'cartoon' | 'console'`
- Toggle button in the control bar area
- Conditionally render either:
  - `WormArenaGameBoard` / `WormArenaLiveBoardPanel` (cartoon)
  - `WormArenaConsoleMirror` (console)

### 5. Page Updates

**WormArenaLive.tsx:**
- Add viewMode state
- Add toggle button near the board
- Pass `eventLog` from streaming hook to console component
- Keep existing 3-column layout; console view replaces center column content

**WormArena.tsx (replay):**
- Add viewMode state  
- Add toggle button in control bar
- Pass current frame to console component
- No event log needed (replay doesn't have live events)

## Files to Create

| File | Purpose |
|------|---------|
| `client/src/lib/wormArena/renderPythonAsciiBoard.ts` | Python-accurate ASCII renderer |
| `client/src/components/WormArenaConsoleMirror.tsx` | Console view component |

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/hooks/useWormArenaStreaming.ts` | Add eventLog state collection |
| `client/src/pages/WormArenaLive.tsx` | Add viewMode toggle, integrate console |
| `client/src/pages/WormArena.tsx` | Add viewMode toggle, integrate console |
| `CHANGELOG.md` | Document new feature |

## Acceptance Criteria

- [ ] Toggle button switches between cartoon and console views
- [ ] ASCII board matches Python's `GameState.print_board()` format exactly
- [ ] Console view works on both live and replay pages
- [ ] Live page console shows scrolling event log
- [ ] Event log is capped to prevent memory issues
- [ ] No secrets exposed in console output
- [ ] Existing cartoon view unchanged when not in console mode

## Future Enhancements (Out of Scope)

- Enrich Python chunk events with tokens/cost metadata
- Forward raw stdout lines as separate SSE event type
- "How it works" educational panel (per original plan)
- Dark mode toggle for console
