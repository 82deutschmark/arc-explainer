# Son Pham's Arc-AGI-3: Pyodide Architecture Reference

**Document Version:** 1.0  
**Last Updated:** 2026-03-12  
**Scope:** How [sonpham-arc3](https://github.com/sonpham/arc-agi-3) uses Pyodide for in-browser game execution and LLM tool calls.

---

## Overview

sonpham-arc3 uses **Pyodide (Python 3.11 in WebAssembly)** for two distinct purposes:

1. **In-Browser Game Execution** — ARC-AGI-3 games run entirely client-side in a Web Worker, eliminating server overhead and enabling immediate visual feedback
2. **LLM Tool Calls** — When tools are enabled, Python code blocks from LLM responses execute client-side via Pyodide, providing instant feedback for grid manipulation and analysis

The system supports both **Pyodide mode** (client-side, using browser storage for history) and **Server mode** (traditional server-side execution). Users can toggle between them via the scaffolding UI.

---

## Technical Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Pyodide** | 0.27.4 | Full Python in WebAssembly via CDN (`cdn.jsdelivr.net`) |
| **arcengine** | ≥0.9 | ARC-AGI-3 game base class and action framework |
| **arc-agi** | ≥0.9 | Arcade container (env discovery, game registry) |
| **numpy** | Built into Pyodide | Numerical arrays for grid representation |
| **pydantic** | Downloaded via PyPI | Validation (manually extracted from wheel, not via micropip) |

---

## Game Environment Architecture

### Directory Structure

Games live in `environment_files/<game_id>/v1/`:

```
environment_files/
├── ws03/
│   └── v1/
│       ├── metadata.json      # Game metadata (ID, title, tags, FPS, dir)
│       └── ws03.py            # Game implementation (extends ARCBaseGame)
├── ls20/
│   └── v1/
│       ├── metadata.json
│       └── ls20.py
└── ...other games...
```

### Metadata (metadata.json)

```json
{
  "game_id": "ws03-v1",
  "title": "WS03",
  "default_fps": 5,
  "baseline_actions": [],
  "tags": ["fog-of-war", "puzzle", "energy-management"],
  "local_dir": "environment_files/ws03/v1"
}
```

**Fields:**
- `game_id` — Unique identifier matching the directory name
- `title` — Human-readable name
- `default_fps` — Frame rate for animation playback (default 5-20)
- `tags` — Gameplay category keywords
- `local_dir` — Relative path from repo root

### Game Implementation (Game Class)

Each game extends `arcengine.ARCBaseGame`:

```python
from arcengine import ARCBaseGame, GameAction, Level, Camera, Sprite

class Ws03(ARCBaseGame):
    """WS03: Fog-of-war puzzle game with energy management."""
    
    def __init__(self):
        # Initialize levels, sprites, camera, state
        pass
    
    def perform_action(self, action_input: ActionInput, raw: bool = True) -> FrameData:
        """Execute an action, return updated frame data."""
        # action_input.id → GameAction enum (RESET, ACTION1-7, etc.)
        # action_input.data → optional action parameters
        # Returns FrameData with frame(s), state, available_actions, etc.
        pass
```

**Key Methods:**
- `__init__()` — Set up sprites, levels, initial state
- `perform_action(action_input, raw=True)` → `FrameData`

**Key Attributes:**
- `sprites: dict[str, Sprite]` — Sprite definitions (pixels, collision, visibility)
- `levels: list[Level]` — Game levels (puzzle specs)
- `state: GameState` — Current game state (PLAYING, WON, LOST, etc.)
- `available_actions: list[int]` — List of legal action IDs for current state

---

## Pyodide Initialization (Client-Side)

### Worker Bootstrap

Pyodide runs in a dedicated **Web Worker** to avoid blocking the UI thread.

**File:** `static/js/engine.js` (lines 1–100)

#### REPL/Tool Call Worker (`_initPyodideWorker()`)

```javascript
function _initPyodideWorker() {
  const workerSrc = `
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js');
    let pyodide = null;
    const _namespaces = {};  // session_id → isolated namespace

    self.onmessage = async (e) => {
      const {type, id, code, grid, prev_grid, session_id} = e.data;
      if (type === 'init') {
        pyodide = await loadPyodide();
        await pyodide.loadPackage('numpy');
        self.postMessage({type: 'ready', id});
      } else if (type === 'execute') {
        // Execute Python code with grid context
        const ns = _getNamespace(session_id);
        ns['grid'] = np.array(grid);
        ns['prev_grid'] = prev_grid ? np.array(prev_grid) : None;
        pyodide.runPython(code, {globals: ns});
        // Return stdout output
      }
    };
  `;
  _pyodideWorker = new Worker(URL.createObjectURL(blob));
  _pyodideWorker.postMessage({type: 'init', id: initId});
}
```

**Lifecycle:**
1. Main thread calls `ensurePyodide()` → spawns worker blob
2. Worker imports Pyodide CDN, calls `loadPyodide()`
3. Worker loads `numpy` package (built-in)
4. Main thread waits for `{type: 'ready'}` message
5. Tool calls now route to `runPyodide(code, grid, prev_grid, sessionId)`

#### Game Engine Worker (`_initPyodideGameWorker()`)

```javascript
function _initPyodideGameWorker() {
  const workerSrc = `
    importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js');
    let pyodide = null;
    let _game_instance = null;
    let _undo_stack = [];

    self.onmessage = async (e) => {
      if (msg.type === 'init') {
        pyodide = await loadPyodide();
        await pyodide.loadPackage(['numpy', 'pydantic']);
        
        // Manual wheel extraction (micropip can't handle pydantic-core)
        await pyodide.runPythonAsync(`
import json, zipfile, io, importlib, site
from pyodide.http import pyfetch
resp = await pyfetch("https://pypi.org/pypi/arcengine/json")
meta = json.loads(await resp.string())
whl_url = next(u["url"] for u in meta["urls"] if u["filename"].endswith("py3-none-any.whl"))
whl_resp = await pyfetch(whl_url)
whl_bytes = bytes(await whl_resp.bytes())
with zipfile.ZipFile(io.BytesIO(whl_bytes)) as zf:
    zf.extractall(site.getsitepackages()[0])
from arcengine import ARCBaseGame
print(f"arcengine loaded: {ARCBaseGame}")
        `);
        self.postMessage({type: 'ready', id: msg.id});
      }
      else if (msg.type === 'load_game') {
        // exec() the game source, instantiate game, call perform_action(RESET)
      }
      else if (msg.type === 'step') {
        // Call _game_instance.perform_action(), snapshot undo stack
      }
    };
  `;
  _pyodideGameWorker = new Worker(URL.createObjectURL(blob));
}
```

**Key Difference from REPL Worker:**
- Loads `pydantic` + manual **wheel extraction** from PyPI (micropip can't handle C extensions)
- Maintains persistent `_game_instance` and `_undo_stack`
- Supports 4 message types: `init`, `load_game`, `step`, `reset`, `undo`

---

## Game Execution Flow (Client-Side)

### 1. Start Game

**Function:** `pyodideStartGame(gameId)` — `static/js/engine.js:557`

```javascript
async function pyodideStartGame(gameId) {
  // 1. Fetch game source from server
  const sourceData = await fetchJSON(`/api/games/${gameId}/source`);
  // {source: "game code", class_name: "Ws03", game_id: "ws03-v1"}
  
  // 2. Ensure Pyodide game engine is loaded
  await ensurePyodideGame();
  
  // 3. Send load_game message to worker
  const state = await _sendGameWorkerMsg({
    type: 'load_game',
    source: sourceData.source,
    class_name: sourceData.class_name,
    game_id: sourceData.game_id,
  });
  
  // 4. Worker response: exec(source) → instantiate Ws03() → perform_action(RESET)
  // 5. Extract grid, state, available_actions, return to UI
  state.session_id = 'pyodide-' + crypto.randomUUID();
  return state;
}
```

**Worker-Side (load_game):**

```python
# In Pyodide worker
import numpy as np
import arcengine
from arcengine import *
import copy

__file__ = '/virtual/game.py'
exec(_source_code)  # Game class definition
_game_instance = eval(_class_name + "()")  # Instantiate
_undo_stack = []
_reset_action = ActionInput(id=GameAction.RESET)
_frame_data = _game_instance.perform_action(_reset_action, raw=True)

# Extract state JSON and send back
state_json = {
    "grid": _frame_data.frame[-1].tolist(),
    "state": _frame_data.state.value,
    "levels_completed": _frame_data.levels_completed,
    "win_levels": _frame_data.win_levels,
    "available_actions": list(_frame_data.available_actions),
    "game_id": _frame_data.game_id,
}
```

### 2. Step Game

**Function:** `pyodideStep(actionId, actionData)` — `static/js/engine.js:593`

```javascript
async function pyodideStep(actionId, actionData) {
  const state = await _sendGameWorkerMsg({
    type: 'step',
    action: actionId,
    data: actionData || null,
  });
  
  // Animate intermediate physics frames (if available)
  if (state.frames && state.frames.length > 1) {
    const fps = currentState.default_fps || 20;
    const delay = Math.round(1000 / fps);
    for (let i = 0; i < state.frames.length - 1; i++) {
      renderGrid(state.frames[i]);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return state;
}
```

**Worker-Side (step):**

```python
# In Pyodide worker
# Save undo snapshot (before action)
_undo_stack.append((copy.deepcopy(_game_instance), copy.deepcopy(_frame_data)))

# Perform action
_action = GameAction.from_id(int(_action_id))
_data = dict(_action_data) if _action_data else None
_action_input = ActionInput(id=_action, data=_data or {})
_frame_data = _game_instance.perform_action(_action_input, raw=True)

# Extract state (thinning frame sequence if needed)
_all_frames = [f.tolist() for f in _frame_data.frame]
_step = max(1, len(_all_frames) // 120)  # Thin to ≤120 frames
_frames_out = _all_frames[::_step]
if _all_frames and _frames_out[-1] is not _all_frames[-1]:
    _frames_out.append(_all_frames[-1])

state_json = {
    "grid": _frames_out[-1],
    "frames": _frames_out,
    "state": _frame_data.state.value,
    "levels_completed": _frame_data.levels_completed,
    "win_levels": _frame_data.win_levels,
    "available_actions": list(_frame_data.available_actions),
    "game_id": _frame_data.game_id,
    "undo_depth": len(_undo_stack),
}
```

### 3. Reset / Undo

**Functions:** `pyodideReset()`, `pyodideUndo(count)` — `static/js/engine.js:618, 628`

- **Reset:** Call `perform_action(GameAction.RESET)`, clear `_undo_stack`
- **Undo:** Pop `count` snapshots from `_undo_stack`, restore `_game_instance` and `_frame_data`

---

## LLM Tool Call Integration (Client-Side)

### Flow Diagram

```
LLM Response with ```python blocks
         ↓
extractPythonBlocks(text)  [regex: /```python\s*\n([\s\S]*?)```/g]
         ↓
executeToolBlocks(code, grid, prev_grid, sessionId)
         ↓
runPyodide(code, grid, prev_grid, sessionId)
         ↓
[Worker] perform Python execution in isolated namespace
         ↓
Capture stdout → return to main thread
         ↓
[Main] Build tool_calls array: {name: "run_python", arguments: {code}, output}
         ↓
Feed tool call outputs back to LLM
```

### Code Extraction

**Function:** `extractPythonBlocks(text)` — `static/js/engine.js:127`

```javascript
function extractPythonBlocks(text) {
  const blocks = [];
  const re = /```python\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}
```

Extracts all triple-backtick Python blocks from LLM markdown response.

### Tool Block Execution

**Function:** `executeToolBlocks(text, grid, prev_grid, sessionId)` — `static/js/engine.js:134`

```javascript
async function executeToolBlocks(text, grid, prev_grid, sessionId) {
  const blocks = extractPythonBlocks(text);
  if (!blocks.length) return [];
  if (!_pyodideReady) return [];
  
  const toolCalls = [];
  for (const code of blocks) {
    const output = await runPyodide(code, grid, prev_grid, sessionId);
    toolCalls.push({
      name: 'run_python',
      arguments: {code},
      output
    });
  }
  return toolCalls;
}
```

### Python Execution Context (REPL Worker)

**Function:** `runPyodide(code, grid, prev_grid, sessionId)` — `static/js/engine.js:120`

```javascript
async function runPyodide(code, grid, prev_grid, sessionId) {
  if (!_pyodideReady) throw new Error('Pyodide not loaded');
  const id = ++_pyodideCallId;
  return new Promise((resolve, reject) => {
    _pyodidePending.set(id, {resolve, reject});
    _pyodideWorker.postMessage({
      type: 'execute',
      id,
      code,
      grid,
      prev_grid,
      session_id: sessionId || activeSessionId
    });
    // 10-second timeout
    setTimeout(() => {
      if (_pyodidePending.has(id)) {
        _pyodidePending.delete(id);
        resolve('[TIMEOUT] Code execution exceeded 10 seconds.');
      }
    }, 10000);
  });
}
```

**Worker-Side Execution (REPL Worker):**

```python
# Isolated namespace per session_id
ns = _getNamespace(session_id)

# Inject grid context
ns['grid'] = np.array(grid)
ns['prev_grid'] = np.array(prev_grid) if prev_grid else None

# Pre-loaded modules (in _getNamespace)
# import numpy as np
# import collections
# from collections import Counter, defaultdict
# import itertools
# import math

# Capture stdout
_stdout_buf = io.StringIO()
_old_stdout = sys.stdout
sys.stdout = _stdout_buf

# Execute user code
exec(code, {'globals': ns})

# Restore stdout and return
sys.stdout = _old_stdout
output = _stdout_buf.getvalue()
if len(output) > 4000:
    output = output[:4000] + '\n... [truncated]'
return output or '(no output)'
```

**Available Libraries:**
- `numpy` (as `np`)
- `collections` (`Counter`, `defaultdict`)
- `itertools`
- `math`
- `grid`, `prev_grid` — NumPy arrays injected from UI state

**Restrictions (Safety Sandbox):**
- No `open()`, `eval()`, `exec()`, `compile()`, `breakpoint()`, `exit()`, `quit()`
- Custom `__import__()` filter to prevent dangerous module access
- 5-second timeout per execution
- 4000-character output limit

---

## Tool Session Lifecycle (Server-Side for Comparison)

When not using Pyodide (server mode), tool sessions run server-side in Python threads.

**File:** `llm_providers.py:145–225`

### `_get_or_create_tool_session(session_id, grid, prev_grid)`

```python
def _get_or_create_tool_session(session_id, grid, prev_grid):
    with _tool_session_lock:
        sess = _tool_sessions.get(session_id)
        if sess is None:
            # Create isolated namespace with safe builtins
            safe_builtins = {...}  # Filtered __builtins__
            ns = {
                '__builtins__': safe_builtins,
                'np': np,
                'numpy': np,
                'collections': collections,
                'itertools': itertools,
                'Counter': collections.Counter,
                'defaultdict': collections.defaultdict,
            }
            sess = {'namespace': ns, 'created_at': time.time()}
            _tool_sessions[session_id] = sess
    
    # Inject grid state
    ns = sess['namespace']
    ns['grid'] = np.array(grid)
    ns['prev_grid'] = np.array(prev_grid) if prev_grid else None
    return sess
```

### `_execute_python(session_id, code, grid, prev_grid, timeout=5.0)`

```python
def _execute_python(session_id, code, grid, prev_grid, timeout=5.0):
    sess = _get_or_create_tool_session(session_id, grid, prev_grid)
    ns = sess['namespace']
    
    output_buf = io.StringIO()
    
    def _run():
        # Redirect print to output buffer
        original_print = builtins.print
        builtins.print = lambda *args, **kwargs: original_print(*args, **kwargs, file=output_buf)
        try:
            exec(code, ns)
        except Exception as e:
            output_buf.write(f"{type(e).__name__}: {e}")
    
    # Run in daemon thread with timeout
    t = threading.Thread(target=_run, daemon=True)
    t.start()
    t.join(timeout=timeout)
    
    if t.is_alive():
        return "[TIMEOUT] Code execution exceeded 5 seconds."
    
    output = output_buf.getvalue()
    if len(output) > 4000:
        output = output[:4000] + '\n... [truncated]'
    return output or '(no output)'
```

### `_cleanup_tool_session(session_id)`

```python
def _cleanup_tool_session(session_id):
    with _tool_session_lock:
        _tool_sessions.pop(session_id, None)
```

**Called after:**
- Game ends (WIN, LOSS, ERROR)
- User manually closes session
- Server restart

---

## arcengine Package

**Source:** [arcprizefoundation/arcengine](https://github.com/arcprizefoundation/arcengine)  
**Version:** ≥0.9  
**License:** Open source (verify repo)

### Core Classes

#### `ARCBaseGame`

Abstract base class for all ARC-AGI-3 games.

```python
class ARCBaseGame(ABC):
    """Base class for ARC-AGI-3 games."""
    
    def __init__(self):
        """Initialize game state, sprites, levels, camera."""
        self.sprites: dict[str, Sprite] = {}
        self.levels: list[Level] = []
        self.state: GameState = GameState.PLAYING
        self.available_actions: list[int] = [0, 1, 2, 3, 4, 5, 6, 7]
    
    def perform_action(self, action_input: ActionInput, raw: bool = True) -> FrameData:
        """Execute action, return frame data."""
        raise NotImplementedError
    
    @property
    def observation_space(self) -> FrameData:
        """Current game state snapshot."""
        raise NotImplementedError
```

#### `GameAction` (Enum)

```python
class GameAction(IntEnum):
    RESET = 0
    ACTION1 = 1
    ACTION2 = 2
    ACTION3 = 3
    ACTION4 = 4
    ACTION5 = 5
    ACTION6 = 6
    ACTION7 = 7
```

#### `ActionInput`

```python
@dataclass
class ActionInput:
    id: GameAction
    data: dict = field(default_factory=dict)
```

#### `FrameData`

```python
@dataclass
class FrameData:
    frame: list[np.ndarray]  # Animation frames (list of grids)
    state: GameState
    levels_completed: int
    win_levels: int
    available_actions: list[int]
    game_id: str
```

#### `GameState` (Enum)

```python
class GameState(Enum):
    PLAYING = "playing"
    WON = "won"
    LOST = "lost"
```

#### `Sprite`

```python
@dataclass
class Sprite:
    pixels: list[list[int]]  # 2D array of color IDs (-1 = transparent)
    name: str
    visible: bool = True
    collidable: bool = True
    tags: list[str] = field(default_factory=list)
    layer: int = 0
```

#### `Camera`

```python
@dataclass
class Camera:
    x: int
    y: int
    width: int
    height: int
```

#### `Level`

```python
@dataclass
class Level:
    grid: np.ndarray
    target: Optional[np.ndarray] = None
    description: str = ""
```

---

## File Structure & Discovery

### Environment Files Hierarchy

```
sonpham-arc3/
├── environment_files/
│   ├── ws03/
│   │   └── v1/
│   │       ├── metadata.json
│   │       └── ws03.py
│   ├── ls20/
│   │   └── v1/
│   │       ├── metadata.json
│   │       └── ls20.py
│   └── ...more games...
├── server.py
├── static/js/
│   ├── engine.js      ← Pyodide workers + game execution
│   ├── llm.js         ← LLM orchestration, tool call handling
│   ├── human.js       ← Human player input
│   └── ui.js          ← Game UI rendering
└── requirements.txt
```

### Game Discovery (Server-Side)

**File:** `server.py:249–250`

```python
def get_arcade():
    global arcade_instance
    if arcade_instance is None:
        arcade_instance = arc_agi.Arcade()
    return arcade_instance
```

The `arc_agi.Arcade()` constructor:
- Scans `environment_files/` recursively
- Finds all `metadata.json` files
- Parses metadata and loads game classes
- Builds registry: `game_id → game_class`

**Usage:**
```python
arcade = arc_agi.Arcade()
env = arcade.make('ws03-v1')  # Instantiate game
```

### Game Source Retrieval (Server-Side)

**Endpoint:** `GET /api/games/<game_id>/source`

```python
@app.route('/api/games/<game_id>/source')
def game_source(game_id):
    # Locate game file
    game_file = find_game_file(game_id)  # e.g., environment_files/ws03/v1/ws03.py
    with open(game_file) as f:
        source = f.read()
    
    # Extract class name from source or metadata
    metadata = load_metadata(game_id)
    class_name = extract_class_name(source)  # Usually first class extending ARCBaseGame
    
    return jsonify({
        'source': source,
        'class_name': class_name,
        'game_id': game_id
    })
```

---

## Client-Side vs Server-Side Execution

| Aspect | **Pyodide Mode (Client-Side)** | **Server Mode** |
|--------|--------------------------------|-----------------|
| **Where** | Browser Web Worker | Server thread pool |
| **Latency** | Instant (no network) | Network round-trip |
| **Isolation** | Per-browser session | Shared server resources |
| **Persistence** | localStorage (per-browser) | SQLite database |
| **Scaling** | Browser CPU/RAM | Server CPU/RAM |
| **Tool Calls** | `runPyodide()` + worker | `_execute_python()` + thread |
| **Game State** | `_game_instance` in worker | `arcade.make()` per step |
| **History** | In-browser (limited by storage) | Server database (unlimited) |

### Feature Flag

**Server code** checks `FEATURES.pyodide_game`:

```javascript
// static/js/ui.js:521
if (FEATURES.pyodide_game) {
    _pyodideGameActive = true;
    _pyodideGameSessionId = activeSessionId;
    data = await pyodideStartGame(gameId);
} else {
    // Fallback to server endpoint
    data = await fetchJSON('/api/step', {...});
}
```

The `FEATURES` object is injected into HTML via Jinja template and controlled by server-side configuration.

---

## Key Dependencies

| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| **Pyodide** | 0.27.4 | Python runtime in WASM | CDN: `cdn.jsdelivr.net` |
| **arcengine** | ≥0.9 | Game base class + arcprizefoundation | Manual wheel extraction in browser |
| **arc-agi** | ≥0.9 | Arcade (env discovery) | Server-side only |
| **numpy** | Built-in | Grid arrays | Pre-loaded in Pyodide |
| **pydantic** | Latest from PyPI | Validation (for arcengine) | Downloaded + extracted manually |
| **collections** | Built-in | Counter, defaultdict | Pre-loaded in REPL sandbox |
| **itertools** | Built-in | Combinatorial functions | Pre-loaded in REPL sandbox |
| **math** | Built-in | Math functions | Pre-loaded in REPL sandbox |

---

## Pyodide Versions & Compatibility

### Why Version 0.27.4?

**Pinned in:** `static/js/engine.js:15, 186`

```javascript
importScripts('https://cdn.jsdelivr.net/pyodide/v0.27.4/full/pyodide.js');
```

Reasons (inferred from codebase):
1. **Stable pydantic support** — 0.27.4 successfully loads pydantic via manual wheel extraction
2. **numpy included** — numpy precompiled and available without build
3. **Large enough for stdlib modules** — `collections`, `itertools`, `math` available
4. **Mature enough for production** — Bug-free wheel extraction and execution

### Manual Wheel Installation

Because **micropip can't handle C extensions** (pydantic-core), arcengine installation is:

```python
# Instead of: await micropip.install("arcengine")
# Do this:

import json, zipfile, io, importlib, site
from pyodide.http import pyfetch

# 1. Fetch PyPI JSON metadata
resp = await pyfetch("https://pypi.org/pypi/arcengine/json")
meta = json.loads(await resp.string())

# 2. Find Python 3 wheel URL
whl_url = next(u["url"] for u in meta["urls"] 
               if u["filename"].endswith("py3-none-any.whl"))

# 3. Download wheel bytes
whl_resp = await pyfetch(whl_url)
whl_bytes = bytes(await whl_resp.bytes())

# 4. Extract to site-packages
sp = site.getsitepackages()[0]
with zipfile.ZipFile(io.BytesIO(whl_bytes)) as zf:
    zf.extractall(sp)
    print(f"Extracted {len(zf.namelist())} files")

# 5. Verify import
importlib.invalidate_caches()
from arcengine import ARCBaseGame
```

---

## Performance & Optimization Notes

### Frame Thinning

To avoid large message payloads, the Pyodide game worker **thins** animation frame sequences:

```python
_all_frames = [f.tolist() for f in _frame_data.frame]  # All frames
_step = max(1, len(_all_frames) // 120)                # Target ≤120 frames
_frames_out = _all_frames[::_step]                     # Sample every _step-th frame

# Ensure last frame is always included
if _all_frames and _frames_out[-1] is not _all_frames[-1]:
    _frames_out.append(_all_frames[-1])

postMessage({frames: _frames_out, grid: _frames_out[-1], ...})
```

**Why?** `postMessage()` serializes large arrays; capping at ~120 frames keeps payloads manageable (typically <1MB per step).

### Grid Rendering

Client-side renders grid via Canvas (see `renderGrid()` in `ui.js`):
- Each color ID maps to an RGB value via `COLOR_MAP`
- Sprites are layered (layer = z-index)
- Fog-of-war rendered by game's `RenderableUserDisplay` interface

### Worker Pooling

sonpham-arc3 uses **two dedicated workers** (never pools):

1. **REPL Worker** (`_pyodideWorker`) — for tool calls + Python code execution
2. **Game Worker** (`_pyodideGameWorker`) — for game logic only

This avoids resource contention and keeps game state isolated.

---

## Error Handling & Timeouts

### Pyodide Tool Calls (10-second timeout)

```javascript
setTimeout(() => {
  if (_pyodidePending.has(id)) {
    _pyodidePending.delete(id);
    resolve('[TIMEOUT] Code execution exceeded 10 seconds.');
  }
}, 10000);
```

### Server-Side Tool Calls (5-second timeout)

```python
t = threading.Thread(target=_run, daemon=True)
t.start()
t.join(timeout=5.0)

if t.is_alive():
    return "[TIMEOUT] Code execution exceeded 5 seconds."
```

### Game Execution Errors

If Pyodide game step fails:

```javascript
try {
    const state = await pyodideStep(actionId, actionData);
    return state;
} catch (err) {
    console.error('[gameStep] Pyodide step failed:', err.message);
    return {error: err.message};  // Return error object to UI
}
```

UI displays error and may offer **fallback to server mode** or **reset** button.

---

## References

- **Pyodide Documentation:** https://pyodide.org
- **arcengine GitHub:** https://github.com/arcprizefoundation/arcengine
- **arc-agi GitHub:** https://github.com/arcprizefoundation/arc-agi
- **ARC-AGI Prize:** https://www.arcprize.org
- **sonpham-arc3 Repository:** https://github.com/sonpham/arc-agi-3

---

## FAQ

### Q: Why two separate Web Workers?

**A:** Separation of concerns. The REPL worker is stateless (per-session namespace isolation), while the game worker is stateful (maintains `_game_instance` + `_undo_stack`). Splitting them prevents tool calls from accidentally corrupting game state.

### Q: Can I use arcengine without Pyodide?

**A:** Yes. arcengine is a standard Python package (available on PyPI). Server-side code uses it directly: `arcade = arc_agi.Arcade()`. Pyodide is only needed for in-browser execution.

### Q: What happens if Pyodide fails to load?

**A:** The system gracefully degrades to **server mode**. All game steps and tool calls route to Flask endpoints instead of the worker. The user sees no difference (both modes behave identically from the UI).

### Q: How large can a game source file be?

**A:** Practically unlimited. The entire source is fetched from `/api/games/<game_id>/source` and `exec()`-ed in Pyodide. If a game is >1MB, loading may be slow (but still works). Typical games are 10–50 KB.

### Q: Can I run game code on the server instead of Pyodide?

**A:** Yes. Set `FEATURES.pyodide_game = false` in the Flask config, and all game steps automatically route to `POST /api/step` (server-side execution via `arcade.make()` + `env.step()`).

### Q: How do I add a new game to sonpham-arc3?

1. Create directory: `environment_files/<game_id>/v1/`
2. Create `metadata.json` with game_id, title, tags, default_fps
3. Create `<game_id>.py` extending `ARCBaseGame`
4. Implement `__init__()` and `perform_action(action_input, raw=True)`
5. Add sprites, levels, camera, state logic
6. Restart server (or use hot-reload if configured)
7. Game auto-appears in Arcade registry

---

**Document End**

Last edited: 2026-03-12 17:34 UTC  
Author: Research Sub-Agent (Bubba context)
