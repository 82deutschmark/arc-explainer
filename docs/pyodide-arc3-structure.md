# Pyodide Architecture in Son Pham's ARC-3 Implementation

**Document Version:** 1.0  
**Date:** March 12, 2026  
**Scope:** sonpham-arc3 (GitHub: https://github.com/sonpham-arc3)

## 1. Overview

Pyodide is used in sonpham-arc3 for **two distinct, complementary purposes:**

1. **Game Engine Execution** (`pyodide_game`) — The full ARC game (from `arcengine`) runs entirely in the browser via a Web Worker, delivering client-side gameplay with instant response times and no server round-trip latency for stepping, resetting, and undoing actions.

2. **LLM Tool Use / Python REPL** — When an LLM is planning or executing code as a tool, Python code blocks (extracted from LLM responses) are executed in a separate Pyodide instance in another Web Worker. This allows the LLM to run reasoning code, inspect grid state, and perform calculations entirely client-side without server overhead.

Both mechanisms use **Web Workers** to avoid blocking the UI thread.

---

## 2. Initialization

### Pyodide Version & CDN
- **Version:** v0.27.4
- **CDN URL:** `https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js`
- **Loading:** Loaded via `importScripts()` inside Web Worker code (not in main thread)

### Entry Points
- **Game Engine Worker:** Initialized lazily on first game start or eagerly on page load if `FEATURES.pyodide_game` is true
- **Tool REPL Worker:** Initialized lazily on first LLM call when `_pyodideReady` is required

### Initialization Flow
1. **Main thread** calls `ensurePyodide()` or `ensurePyodideGame()`
2. This creates a **Blob** containing the worker source code
3. Worker is created: `new Worker(URL.createObjectURL(blob))`
4. Worker **receives 'init' message**, loads Pyodide via CDN
5. Worker responds with **'ready' message**; main thread sets `_pyodideReady = true` or `_pyodideGameReady = true`

---

## 3. arcengine Loading

The `arcengine` Python package is loaded **only in the game engine worker** (not in the tool REPL worker). This is deliberate — games require the full arcengine API; tools only need a Python environment.

### arcengine Package Installation
**Location:** `static/js/engine.js` (game worker initialization, ~line 212)

```javascript
// Fetch metadata from PyPI to get the latest wheel URL
resp = await pyfetch("https://pypi.org/pypi/arcengine/json")
meta = json.loads(await resp.string())
whl_url = next(u["url"] for u in meta["urls"] if u["filename"].endswith("py3-none-any.whl"))

// Download the .whl file
whl_resp = await pyfetch(whl_url)
whl_bytes = bytes(await whl_resp.bytes())

// Extract .whl (ZIP archive) directly to site-packages
import zipfile, io, site
sp = site.getsitepackages()[0]
with zipfile.ZipFile(io.BytesIO(whl_bytes)) as zf:
    zf.extractall(sp)

// Verify import
from arcengine import ARCBaseGame
```

**Why not `micropip.install()`?**
- `micropip` cannot handle packages with native C extensions (like `pydantic-core`)
- Pyodide's package mirror may not have the latest version
- By fetching directly from PyPI and extracting manually, we ensure the latest `arcengine` is available

**Dependency Chain:**
- `arcengine` requires `numpy` ✓ (loaded in Pyodide)
- `arcengine` requires `pydantic` ✓ (manually installed via .whl)
- Both are loaded before the game source is executed

---

## 4. Game Execution Flow

### Game Startup (`pyodideStartGame`)
**Location:** `static/js/engine.js` (~line 580)

1. **Fetch game source** from `/api/games/{game_id}/source` (server endpoint returns Python source code, class name, default FPS)
2. **Ensure Pyodide game worker is ready** (show progress UI while loading)
3. **Send 'load_game' message** to worker with:
   - `source`: Raw Python code for the game class
   - `class_name`: Name of the class (e.g., "GameFromARC3_lb03")
   - `game_id`: Game ID

### Game Worker Load Message Handler
**Location:** `static/js/engine.js` (worker code, lines ~270–300)

```javascript
// Exec the game source in a namespace with arcengine imported
pyodide.runPython(`
  import numpy as np
  import arcengine
  from arcengine import *
  import copy
`);

// Set source and class name as globals to avoid escaping
pyodide.globals.set('_source_code', source);
pyodide.globals.set('_class_name', class_name);

// Execute the source code
pyodide.runPython(`
  __file__ = '/virtual/game.py'  # Provide __file__ for Path(__file__) usage
  exec(_source_code)
  _game_instance = eval(_class_name + "()")  # Instantiate the game
  _undo_stack = []
  _reset_action = ActionInput(id=GameAction.RESET)
  _frame_data = _game_instance.perform_action(_reset_action, raw=True)
`);

// Extract state and return to main thread
state = {
  grid: frame (as list of lists),
  state: GameState enum value (e.g., "NOT_FINISHED"),
  levels_completed: int,
  win_levels: int,
  available_actions: list of action IDs,
  game_id: str,
}
```

### Taking a Step
**Location:** `static/js/engine.js` (worker 'step' handler, lines ~301–345)

```javascript
// Before stepping: save undo snapshot (game instance + frame data)
_undo_stack.append((copy.deepcopy(_game_instance), copy.deepcopy(_frame_data)))

// Perform the action
_action = GameAction.from_id(int(action_id))
_action_input = ActionInput(id=_action, data=action_data or {})
_frame_data = _game_instance.perform_action(_action_input, raw=True)

// Extract all frames from the action (physics simulation may produce multiple frames)
_all_frames = [f.tolist() for f in _frame_data.frame]

// Thin to ≤120 frames so postMessage payload stays small
_step = max(1, len(_all_frames) // 120)
_frames_out = _all_frames[::_step]
if _all_frames and _frames_out[-1] is not _all_frames[-1]:
    _frames_out.append(_all_frames[-1])  # Always include final frame

// Return state with all frames for animation
return {
  grid: final frame (as list),
  frames: all intermediate frames (for animation),
  state: GameState enum value,
  levels_completed: int,
  win_levels: int,
  available_actions: list,
  game_id: str,
  undo_depth: int,
}
```

### State Management
- **Current game instance:** `_game_instance` (kept in worker memory)
- **Current frame data:** `_frame_data` (kept in worker memory)
- **Undo stack:** `_undo_stack` (array of (game_instance, frame_data) tuples; persisted until reset or page reload)
- **Session isolation:** None (single game per page load; game can be reset but not switched)

### Reset & Undo
- **Reset:** Calls `GameAction.RESET` on the game instance, clears undo stack
- **Undo:** Pops N snapshots from undo stack, restores game instance and frame data

---

## 5. Tool Use Bridge (LLM Python REPL)

The **tool use system** allows an LLM to execute Python code as a tool for reasoning or calculation.

### Tool Use Trigger
**Location:** `static/js/llm.js` (lines ~210–213, ~295–297)

When an LLM response includes:
- A `tools_active` flag (for Gemini), OR
- Python code blocks wrapped in ` ```python...``` ` (for any LLM)

The main thread extracts the code and sends it to the **tool REPL worker** (separate from the game worker).

### Tool REPL Execution
**Location:** `static/js/engine.js` (first worker, lines ~1–95)

```javascript
// On 'execute' message:
ns = _getNamespace(session_id)  // Get or create a session-specific namespace

// Inject grid and prev_grid
pyodide.runPython('import numpy as np', {globals: ns});
ns.set('grid', pyodide.runPython('np.array(...)', {globals: ns}));
ns.set('prev_grid', pyodide.runPython('np.array(...)', {globals: ns}));

// Capture stdout
pyodide.runPython(`
  import io as _io, sys as _sys
  _stdout_buf = _io.StringIO()
  _old_stdout = _sys.stdout
  _sys.stdout = _stdout_buf
`, {globals: ns});

// Execute user code
pyodide.runPython(code, {globals: ns});

// Restore stdout and return output
_sys.stdout = _old_stdout
output = _stdout_buf.getvalue()
```

### Session Isolation
- **Multiple namespaces:** `_namespaces[session_id]` keeps variables separate per session
- **Shared imports:** All sessions get `numpy`, `collections`, `itertools`, `math` on first execution
- **Session cleanup:** `clear_session` message clears a session's namespace

### Tool Call Response
The tool call result is attached to the LLM's message for context window inclusion:
```javascript
{
  name: 'run_python',
  arguments: { code: '...' },
  output: '...'  // captured stdout or error message
}
```

### Special Handling in RLM (Reasoning + Learning Mode)
**Location:** `static/js/scaffolding-rlm.js` (lines ~111–135)

When RLM is active, additional helper functions are injected:
- `SHOW_VARS()` — lists all user-defined variables
- `FINAL_VAR(name)` — retrieves a variable by name
- `llm_query(prompt)` — disabled in browser (returns stub message)
- `llm_query_batched(prompts)` — disabled in browser (returns stub messages)

---

## 6. Data Flow

### Startup Sequence
```
Page Load (index.html)
  ↓
DOMContentLoaded
  ↓
[FEATURES.pyodide_game] → _initPyodideGameWorker() [non-blocking, shows UI when ready]
  ↓
User selects a game (via UI)
  ↓
pyodideStartGame(gameId)
  ├─ fetchJSON('/api/games/{gameId}/source')
  │  └─ Server returns: { source, class_name, game_id, default_fps }
  ├─ ensurePyodideGame() [waits for worker ready]
  └─ _sendGameWorkerMsg({type: 'load_game', source, class_name, game_id})
     ↓ [worker executes source, instantiates game, performs RESET]
     → returns initial state { grid, state, levels_completed, ... }
  ↓
UI renders grid, displays available actions
```

### Gameplay Sequence
```
User clicks action button (or LLM sends action)
  ↓
gameStep(sessionId, actionId, actionData)
  ├─ [_pyodideGameActive] → pyodideStep(actionId, actionData)
  │  └─ _sendGameWorkerMsg({type: 'step', action, data})
  │     ↓ [worker saves undo, performs action, extracts frames]
  │     → returns { grid, frames, state, undo_depth, ... }
  │
  │  └─ animateFrames(frames) [render each frame with delay based on FPS]
  │
  └─ [server mode] → fetchJSON('/api/step', {session_id, action, data})
  ↓
UI updates grid, undo button state, action availability
```

### LLM Tool Use Sequence
```
LLM response arrives (with Python code blocks)
  ↓
executeToolBlocks(code, grid, prev_grid, sessionId)
  ├─ ensurePyodide() [wait for tool REPL worker ready]
  ├─ extractPythonBlocks(llm_response_text)
  ├─ for each code block:
  │  └─ runPyodide(code, grid, prev_grid, sessionId)
  │     ↓ [worker receives execute message]
  │     ├─ getNamespace(sessionId) [reuse session namespace]
  │     ├─ inject grid, prev_grid as numpy arrays
  │     ├─ exec(code) [capture stdout]
  │     → returns output string
  │
  └─ build tool_calls array: [{name: 'run_python', arguments, output}, ...]
  ↓
Tool calls included in LLM context for next iteration
```

---

## 7. Key Files

| File | Role |
|------|------|
| `static/js/engine.js` | **Pyodide worker initialization, game execution, tool REPL execution. Two Web Workers embedded as Blob source.** |
| `static/js/ui.js` | **UI integration: triggers `pyodideStartGame()` when game is selected, displays "Local" badge when Pyodide is active.** |
| `static/js/llm.js` | **LLM orchestration: detects Python blocks in responses, calls `executeToolBlocks()` and `runPyodide()`.** |
| `static/js/scaffolding-rlm.js` | **RLM mode: injects helper functions (SHOW_VARS, FINAL_VAR) into REPL namespace.** |
| `static/js/session.js` | **Session management: clears Pyodide namespaces when switching sessions (clear_session message).** |
| `server.py` (or `server/app.py`) | **`/api/games/<game_id>/source` endpoint: returns game Python source code for client-side execution.** |
| `templates/index.html` | **Contains `#pyodideGameLoading` overlay div (shown during game worker init).** |

---

## 8. Known Limitations

### Performance & Latency
1. **Initial load time:** First game load takes 3–5 seconds (Pyodide runtime + numpy + pydantic + arcengine download and extraction)
   - Subsequent games on the same page are instant
   - Progress UI shows download/extraction stages

2. **Memory usage:** Each Pyodide instance consumes ~30–50 MB of heap
   - Two workers (game + tool REPL) = 60–100 MB overhead
   - Acceptable for modern browsers; watch on low-memory devices

3. **Step execution latency:** Game steps are faster in browser (no network RTT) but may be slower than server for large grids or complex physics
   - Typical: 10–50 ms per step
   - Network round-trip would be 100–300 ms (always worse than local)

### Package Support
1. **C extensions & native modules:** Limited support
   - `numpy` ✓ (precompiled for Pyodide)
   - `pydantic` ✓ (manually installed from wheel)
   - Most packages without C extensions work fine
   - Packages with C extensions may fail unless pre-built for Pyodide

2. **File I/O:** Severely limited
   - No access to local filesystem (browser security)
   - In-memory virtual filesystem available; persists only during session
   - Can read game source code from server; cannot write permanent files

### Session Management
1. **Single game per page load:** Game worker is not switchable; must reload page to play a different game
2. **No persistence across page reloads:** Game state and undo stack are lost on page refresh
3. **No inter-worker communication:** Game worker and tool REPL worker cannot directly communicate; must relay through main thread

### Fallback Mechanism
If Pyodide fails to initialize:
- `_pyodideGameActive` remains `false`
- Game requests fall back to server endpoints (`/api/start`, `/api/step`)
- Tool use requests return `"[tool unavailable]"` or fail silently
- User experience degrades but page remains functional

---

## 9. Feature Flag & Configuration

**Feature flag:** `FEATURES.pyodide_game`
- **Location:** `server.py` (or `server/app.py`) — set per environment (staging, prod)
- **When true:** Games run via Pyodide (client-side)
- **When false:** Games run via server endpoints (server-side)

**Tool REPL availability:** Always enabled if `_pyodideReady` (no separate flag)

---

## 10. Browser Compatibility

- **Supported:** Chrome, Firefox, Safari, Edge (all modern versions with Web Worker support)
- **Required features:**
  - Web Workers (IE 10+)
  - `importScripts()` (all modern browsers)
  - Blob URLs (`URL.createObjectURL()`)
  - `postMessage()` for worker communication
- **Known issues:** Some older or mobile browsers may timeout on large Pyodide downloads

---

## Conclusion

Pyodide enables Son Pham's ARC-3 to run complex game logic and LLM reasoning tools **entirely in the browser**, eliminating server latency and enabling offline gameplay. The dual-worker architecture cleanly separates game execution (ephemeral, per-game) from tool REPL (persistent, per-session), while falling back gracefully to server execution if initialization fails.

The manual arcengine wheel installation (rather than `micropip.install()`) works around limitations in Pyodide's package mirror and C extension handling, ensuring the latest arcengine is always available.
