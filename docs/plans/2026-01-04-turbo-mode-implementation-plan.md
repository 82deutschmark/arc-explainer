# Turbo Mode Implementation Plan

**Author:** Claude Haiku 4.5
**Date:** 2026-01-04
**Goal:** Implement deterministic "Turbo Mode" for Worm Arena alongside existing "Random Mode"

---

## Overview

Currently, Worm Arena uses **Random Mode** for all games:
- Snake starting positions: random free cells
- Apple positions: random free cells
- Respawn: random free cells (maintains `numApples` count)

**New Turbo Mode** will provide deterministic, strategically-placed positioning to create fast-paced, balanced gameplay.

---

## Requirements

### Turbo Mode Behavior

**Initial Setup:**
- Snake 0 spawns at (0, 9)
- Snake 1 spawns at (9, 0)
- 10 apples placed deterministically:
  - 5 apples on y=6 axis at ODD x positions: (1,6), (3,6), (5,6), (7,6), (9,6)
  - 5 apples on y=4 axis at EVEN x positions: (0,4), (2,4), (4,4), (6,4), (8,4)

**Apple Respawn Logic:**
- When apples are eaten during gameplay
- If apple count drops below 5, spawn new apples randomly (same `_random_free_cell()` logic)
- Maintains minimum 5 apples on board at all times

**Random Mode (default):**
- All existing behavior unchanged
- Retroactively called "Random Mode"

---

## Implementation Steps

### 1. Create Turbo Mode Module
**File:** `external/SnakeBench/backend/domain/turbo_mode.py`

Create new module with:
- `get_turbo_start_positions(width: int, height: int) -> Dict[str, Tuple[int, int]]`
  - Returns `{"0": (0, 9), "1": (9, 0)}`
- `get_turbo_initial_apples(width: int, height: int) -> List[Tuple[int, int]]`
  - Returns 10 apples in pattern: y=6 (odd x) + y=4 (even x)
- Helper validation: ensure positions fit within board dimensions

### 2. Refactor SnakeGame Initialization
**File:** `external/SnakeBench/backend/main.py`

**2a. Add mode parameter to `SnakeGame.__init__`:**
```python
def __init__(
    self,
    width: int,
    height: int,
    max_rounds: int = 150,
    num_apples: int = 5,
    game_id: str = None,
    game_type: str = 'ladder',
    game_mode: str = 'random'  # NEW: 'random' or 'turbo'
):
    self.game_mode = game_mode
    # ... existing init code ...
```

**2b. Refactor initial apple placement (lines 140-143):**
Replace random loop with mode-aware logic:
```python
if self.game_mode == 'turbo':
    from domain.turbo_mode import get_turbo_initial_apples
    self.apples = get_turbo_initial_apples(self.width, self.height)
else:  # random mode
    for _ in range(self.num_apples):
        cell = self._random_free_cell()
        self.apples.append(cell)
```

**2c. Refactor `add_snake()` (lines 160-173):**
```python
def add_snake(self, snake_id: str, player: Player):
    if snake_id in self.snakes:
        raise ValueError(f"Snake with id {snake_id} already exists.")

    if self.game_mode == 'turbo':
        from domain.turbo_mode import get_turbo_start_positions
        positions_map = get_turbo_start_positions(self.width, self.height)
        positions = positions_map.get(snake_id)
        if positions is None:
            raise ValueError(f"Turbo mode: no start position defined for snake {snake_id}")
    else:  # random mode
        positions = self._random_free_cell()

    self.snakes[snake_id] = Snake([positions])
    self.players[snake_id] = player
    self.scores[snake_id] = 0
    self.player_costs[snake_id] = 0.0

    # ... existing logging ...
```

**2d. Update apple respawn logic (lines 485-486):**
```python
# keep apple count constant
# For turbo mode: respawn when count drops below 5 (random placement)
# For random mode: respawn when count drops below num_apples (random placement)
min_apples = 5 if self.game_mode == 'turbo' else self.num_apples
while len(self.apples) < min_apples:
    self.apples.append(self._random_free_cell())
```

**2e. Update `run_simulation()` (line 852):**
Accept `game_mode` parameter and pass to SnakeGame:
```python
def run_simulation(model_config_1: Dict, model_config_2: Dict, game_params: argparse.Namespace) -> Dict:
    game = SnakeGame(
        width=game_params.width,
        height=game_params.height,
        max_rounds=game_params.max_rounds,
        num_apples=game_params.num_apples,
        game_id=getattr(game_params, 'game_id', None),
        game_type=getattr(game_params, 'game_type', 'ladder'),
        game_mode=getattr(game_params, 'game_mode', 'random')  # NEW
    )
    # ... rest of function ...
```

**2f. Update `main()` argument parser:**
Add CLI argument for mode selection:
```python
parser.add_argument("--game-mode", type=str, required=False, default='random',
                    choices=['random', 'turbo'],
                    help="Game mode: 'random' (default) or 'turbo' (deterministic)")
```

### 3. Update Request Types
**File:** `shared/types.ts`

Add `gameMode` to `SnakeBenchRunMatchRequest`:
```typescript
export type SnakeBenchRunMatchRequest = {
  modelA: string;
  modelB: string;
  width: number;
  height: number;
  maxRounds: number;
  numApples: number;
  gameMode?: 'random' | 'turbo';  // NEW: optional, defaults to 'random'
  apiKey?: string;
  provider?: string;
};
```

### 4. Update Backend API Handler
**Files:** `server/controllers/` or `server/services/snakeBench/`

Locate the endpoint that accepts match requests and passes `gameMode` through to Python invocation:
- Extract `gameMode` from request payload
- Pass as `--game-mode` argument (or env var) to Python subprocess
- Default to 'random' if not provided

### 5. Update Frontend UI
**File:** `client/src/components/WormArenaRunControls.tsx`

Add mode selector dropdown/toggle:
- Options: "Random Mode" (default) and "Turbo Mode"
- Store selection in component state (add to `useWormArenaSetup` hook)
- Include in payload sent to backend
- Display selected mode in form

**File:** `client/src/hooks/useWormArenaSetup.ts`

Add `gameMode` state:
```typescript
const [gameMode, setGameMode] = useState<'random' | 'turbo'>('random');
```

Return `gameMode` and `setGameMode` from hook.

### 6. Update CHANGELOG
Add entry documenting:
- New Turbo Mode feature
- Default remains Random Mode
- Architecture: mode-based positioning system
- Files modified: see list below

---

## Critical Files to Modify

1. **New:** `external/SnakeBench/backend/domain/turbo_mode.py`
2. `external/SnakeBench/backend/main.py` (SnakeGame, add_snake, apple respawn, run_simulation, main)
3. `shared/types.ts` (SnakeBenchRunMatchRequest)
4. `server/[controllers|services]/snakeBench/...` (API handler)
5. `client/src/components/WormArenaRunControls.tsx` (UI toggle)
6. `client/src/hooks/useWormArenaSetup.ts` (state management)
7. `CHANGELOG.md` (documentation)

---

## Testing Considerations

- Turbo mode: verify both snakes spawn at correct positions
- Turbo mode: verify 10 apples spawn at correct grid positions
- Turbo mode: verify respawn maintains 5-apple minimum with random placement
- Random mode: verify no changes to existing behavior (regression test)
- Verify mode parameter flows correctly through frontend → backend → Python

---

## Notes

- Turbo mode assumes a 10x10 board (or compatible dimensions for the fixed positions)
- If board is smaller, turbo_mode.py should validate and raise helpful error
- Both modes use identical respawn mechanics once below threshold
- Mode selection is optional; defaults to 'random' for backwards compatibility
