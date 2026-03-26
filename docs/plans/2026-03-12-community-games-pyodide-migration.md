# Community Games: Pyodide Migration Plan

**Date:** 2026-03-12
**Author:** Claude Sonnet 4.6
**Reference:** `docs/sonpham-arc3-pyodide-architecture.md`

---

## Objective

Migrate community game execution from server-side Python subprocesses to client-side Pyodide (Python in WebAssembly). Games run in a Web Worker — no server sessions, no round-trips per action, instant input response.

---

## Scope

**In:**
- Replace `CommunityGamePythonBridge` + `CommunityGameRunner` subprocess flow with a Pyodide Web Worker
- New `usePyodideGame` React hook that owns the worker lifecycle
- Update `CommunityGamePlay.tsx` to use the hook instead of server mutations
- Add `class_name` to the existing `/games/:gameId/source` endpoint response
- Graceful fallback to server-side sessions if Pyodide fails to load

**Out:**
- Server session endpoints (`/session/start`, `/session/:guid/action`, etc.) — **kept as-is** for fallback, not deleted
- Submission/validation pipeline — unchanged
- Admin endpoints — unchanged
- Undo support — skip for v1 (Son Pham has it, we don't need it yet)

---

## Architecture

### Current Flow (per-action network round-trip)

```
CommunityGamePlay.tsx
  → POST /api/arc3-community/session/start      # spawns Python subprocess
  → POST /api/arc3-community/session/:guid/action  # each button press
       → CommunityGameRunner
           → CommunityGamePythonBridge
               → community_game_runner.py (child_process.spawn)
                   → ARCEngine
               ← NDJSON stdout
           ← FrameData
       ← JSON response
  ← re-render
```

### New Flow (zero network latency per action)

```
CommunityGamePlay.tsx
  → usePyodideGame hook
      → fetch /api/arc3-community/games/:gameId/source  (one-time)
      → PyodideGameWorker (Web Worker)
          ← postMessage({type:'init'})   → load Pyodide 0.27.4, numpy, pydantic, arcengine
          ← postMessage({type:'load_game', source, class_name})
          ← postMessage({type:'step', action, data})   # instant, no network
      → maps worker responses to FrameData shape
  → re-render

Play count: still POST /api/arc3-community/games/:gameId/play (fire-and-forget once on start)
```

---

## Files Touched

| File | Change |
|------|--------|
| `client/public/pyodide-game-worker.js` | **New** — Web Worker with Pyodide bootstrap + game execution |
| `client/src/hooks/usePyodideGame.ts` | **New** — React hook wrapping worker lifecycle |
| `client/src/pages/arc3-community/CommunityGamePlay.tsx` | **Update** — swap server mutations for hook |
| `server/routes/arc3Community.ts` | **Update** — add `class_name` to `/games/:gameId/source` response |
| `CHANGELOG.md` | **Update** — SemVer entry |

---

## Implementation Steps

### Step 1 — Update source endpoint to return `class_name`

**File:** `server/routes/arc3Community.ts` — `GET /games/:gameId/source` handler

The `CommunityGameValidator.validateSource()` already extracts `className` from the source via regex. Re-run it (cheap static analysis, ~1ms) on the source text and include the result.

```ts
// After reading sourceCode:
const validation = await CommunityGameValidator.validateSource(sourceCode);
return res.json(formatResponse.success({
  gameId: game.gameId,
  sourceCode,
  hash: game.sourceHash,
  className: validation.metadata?.className ?? null,  // ← add this
}));
```

Apply to both the official game branch and the community DB branch.

---

### Step 2 — Web Worker (`client/public/pyodide-game-worker.js`)

Placed in `client/public/` so Vite serves it as a static asset (importable as `/pyodide-game-worker.js`).

**Message protocol:**

| Message type (in) | Payload | Response type (out) |
|---|---|---|
| `init` | `{id}` | `{type:'ready', id}` or `{type:'error', id, message}` |
| `load_game` | `{id, source, class_name, game_id}` | `{type:'frame', id, frame}` or `{type:'error', id, message}` |
| `step` | `{id, action, data}` | `{type:'frame', id, frame}` or `{type:'error', id, message}` |
| `reset` | `{id}` | `{type:'frame', id, frame}` or `{type:'error', id, message}` |

**Bootstrap sequence (init):**
1. `importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js')`
2. `await loadPyodide()`
3. `await pyodide.loadPackage(['numpy', 'pydantic'])` — these are pre-compiled Pyodide wheels, no micropip
4. Manual arcengine wheel extraction (Son Pham's pattern):
   ```python
   import json, zipfile, io, importlib, site
   from pyodide.http import pyfetch
   resp = await pyfetch("https://pypi.org/pypi/arcengine/json")
   meta = json.loads(await resp.string())
   whl_url = next(u["url"] for u in meta["urls"] if u["filename"].endswith("py3-none-any.whl"))
   whl_bytes = bytes(await (await pyfetch(whl_url)).bytes())
   with zipfile.ZipFile(io.BytesIO(whl_bytes)) as zf:
       zf.extractall(site.getsitepackages()[0])
   importlib.invalidate_caches()
   from arcengine import ARCBaseGame
   ```
5. Post `{type:'ready', id}`

**load_game handler:**
```python
import copy
from arcengine import *
import numpy as np

__file__ = '/virtual/game.py'
exec(_source_code, globals())
_game_instance = eval(_class_name + "()")
_action_input = ActionInput(id=GameAction.RESET)
_frame_data = _game_instance.perform_action(_action_input)
# serialize and postMessage
```

**step handler:**
```python
_action_enum = GameAction(_action_id_int)
_data = dict(_action_data) if _action_data else {}
_frame_data = _game_instance.perform_action(ActionInput(id=_action_enum, data=_data))
# thin frames to ≤120, serialize, postMessage
```

**Frame serialization** (match existing `FrameData` interface in `CommunityGamePlay.tsx`):
```python
_all_frames = [f.tolist() for f in _frame_data.frame]
_step = max(1, len(_all_frames) // 120)
_frames_out = _all_frames[::_step]
if _all_frames and _frames_out[-1] != _all_frames[-1]:
    _frames_out.append(_all_frames[-1])

state_json = {
    "frame": _frames_out,
    "score": _frame_data.levels_completed,
    "levels_completed": _frame_data.levels_completed,
    "win_score": _frame_data.win_levels,
    "state": _frame_data.state.value,
    "action_counter": _action_counter,
    "max_actions": getattr(_game_instance, 'max_actions', 100),
    "available_actions": list(_frame_data.available_actions),
    "last_action": _last_action_name,
}
```

**Error handling:** All Python exceptions caught, posted as `{type:'error', message}`.

---

### Step 3 — `usePyodideGame` hook (`client/src/hooks/usePyodideGame.ts`)

```ts
interface PyodideGameState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  frame: FrameData | null;
  gameInfo: { displayName: string; winScore: number; maxActions: number | null } | null;
  gameState: 'idle' | 'playing' | 'won' | 'lost';
  loadingStage: 'pyodide' | 'arcengine' | 'game' | null;  // for UX messaging
  error: string | null;
}
```

**API exposed to component:**
- `initGame(gameId)` — fetch source, send `load_game` to worker (lazy-inits worker on first call)
- `step(actionId: number, data?: Record<string,number>)` → resolves to `FrameData`
- `reset()` → resolves to `FrameData`
- `isActing: boolean` — true while a step is in-flight

**Worker lazy-init:** Worker is created on first `initGame()` call. If already initialised, reuse. Handle cleanup on unmount.

**Promise wrapping:** Use a `Map<id, {resolve, reject}>` pending map, same pattern as `CommunityGamePythonBridge`. Auto-reject after 30s.

**Fallback flag:** If `init` fails (e.g., CDN blocked, no WASM), set `pyodideFailed = true` — component falls back to server mutations.

---

### Step 4 — Update `CommunityGamePlay.tsx`

**State changes:**
- Remove `sessionGuid` state — no longer needed
- Remove `startGameMutation` and `actionMutation` (`useMutation` calls)
- Add `usePyodideGame()` hook

**`handleStart`:** Call `hook.initGame(gameId)` instead of `startGameMutation.mutate()`. Also fire `POST /api/arc3-community/games/:gameId/play` (play count, fire-and-forget).

**`handleReset`:** Call `hook.reset()` instead of `actionMutation.mutate('RESET')`.

**Action buttons / keyboard handler:** Call `hook.step(actionNumber, data)` instead of `actionMutation.mutate(...)`.

**Loading states:** Add a loading banner during Pyodide init with stage messaging:
- "Loading Python runtime..." (pyodide)
- "Installing game engine..." (arcengine)
- "Starting game..." (game)

First-load is ~5–10s; subsequent games on same page load are instant.

**Fallback:** If `hook.status === 'error'` and `pyodideFailed`, render a "Pyodide unavailable — using server mode" notice and wire the original server mutations back. Keep this as a code path, not deleted.

---

## Action ID Mapping

Our existing UI sends string action names (`'ACTION1'`…`'ACTION7'`, `'RESET'`). The worker needs integer `GameAction` enum values. Map in the hook:

```ts
const ACTION_MAP: Record<string, number> = {
  RESET: 0, ACTION1: 1, ACTION2: 2, ACTION3: 3,
  ACTION4: 4, ACTION5: 5, ACTION6: 6, ACTION7: 7,
};
```

Pass `data` for ACTION6 clicks: `{x: coordinates[0], y: coordinates[1]}`.

---

## Key Decisions

**Why `client/public/` for the worker?**
Vite doesn't bundle Web Worker scripts referenced by URL string. `public/` is served as-is.

**Why manual arcengine wheel extraction, not micropip?**
`arcengine` depends on `pydantic`, which has a Rust/C core. Pyodide's `loadPackage` handles the pre-compiled pydantic wheel. micropip would try to install pydantic as a dep and fail on `pydantic-core`. Son Pham solved this by skipping micropip entirely for arcengine — fetch the `py3-none-any.whl` directly from PyPI and extract it after pydantic is already loaded.

**Why keep server session endpoints?**
Fallback path + they cost nothing to keep. Official/community games currently work server-side. Don't break that.

**Why Pyodide 0.27.4 specifically?**
Son Pham's reference confirms this version has stable pydantic support and pre-compiled numpy. Don't upgrade without testing.

---

## Verification Checklist

- [ ] Source endpoint returns `class_name` for both official and community games
- [ ] Worker `init` completes within 15s on cold load (CDN)
- [ ] `load_game` instantiates game and returns valid RESET frame
- [ ] All 7 actions (including ACTION6 with coordinates) produce correct frames
- [ ] Multi-frame animations render (frame thinning working)
- [ ] Win/loss state detected correctly from `frame.state`
- [ ] Level celebration triggers on `levels_completed` increment
- [ ] Fallback to server mode triggers on Pyodide init failure
- [ ] No Python subprocess spawned during Pyodide mode (verify via server logs)
- [ ] Play count incremented once per game start
- [ ] Worker cleaned up on component unmount (no memory leak)

---

## CHANGELOG entry (draft)

```
### [X.Y.Z] - 2026-03-12
#### Changed
- **Community Games: Pyodide in-browser execution** — Game sessions now run entirely
  client-side in a Web Worker using Pyodide 0.27.4 + arcengine. Eliminates Python
  subprocess per-session on the server and removes per-action network round-trips.
  Actions are now instant. Server session endpoints retained as fallback.
  Ref: `docs/sonpham-arc3-pyodide-architecture.md`
  Files: client/public/pyodide-game-worker.js (new),
         client/src/hooks/usePyodideGame.ts (new),
         client/src/pages/arc3-community/CommunityGamePlay.tsx,
         server/routes/arc3Community.ts
  Author: Claude Sonnet 4.6
```
