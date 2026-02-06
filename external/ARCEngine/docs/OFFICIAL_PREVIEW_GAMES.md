# Official ARC-AGI-3 Preview Games Analysis

**Author:** Claude Sonnet 4  
**Date:** 2026-01-31  
**Source:** Downloaded via `arc-agi` API, MIT Licensed by ARC Prize Foundation

---

## Overview

The three official preview games are now available locally in `games/official/`:

| Game | Actions | Levels | Human Baseline Actions | Mechanic |
|------|---------|--------|------------------------|----------|
| **ls20** | 4 (directional) | 7 | 29-172 per level | Shape-matching navigation puzzle |
| **ft09** | 6 (directional + click) | 6 | 7-21 per level | Color-cycling constraint satisfaction |
| **vc33** | 1 (click only) | 7 | 6-92 per level | Rail-switching train routing |

---

## ls20 - Shape Matching Navigation

**File:** `games/official/ls20.py` (1561 lines)

### Core Mechanic
Navigate a 5x5 tile cursor through a maze, collecting shape targets. The cursor has three properties that must match:
- **Shape** (from `hep` array - tetromino-like pieces)
- **Color** (from `hul` array - palette indices)
- **Rotation** (0°, 90°, 180°, 270°)

### Input Mapping
```
ACTION1 = Up    (kyr = -1)
ACTION2 = Down  (kyr = +1)
ACTION3 = Left  (lgr = -1)
ACTION4 = Right (lgr = +1)
```

### Key Tags
- `jdd` - Wall/blocking tiles
- `mae` - Target positions to match
- `iri` - Collectible items
- `gsu` - Shape-change triggers
- `gic` - Color-change triggers
- `bgt` - Rotation triggers

### Win Condition
All targets (`rzt` array) must be matched by visiting them with correct shape/color/rotation combination.

### Fail Condition
Counter (`lbq`) decrements on invalid moves; reaching 0 triggers `lose()`.

---

## ft09 - Color Constraint Grid

**File:** `games/official/ft09.py` (2521 lines)

### Core Mechanic
Click-based puzzle where clicking a cell cycles colors in a pattern. Constraints between adjacent cells must be satisfied.

### Input Mapping
```
ACTION1-5 = Directional (unused in main gameplay)
ACTION6   = Click at (x, y) coordinates
```

### Key Tags
- `bsT` - Constraint cells (3x3 sprites with color rules)
- `Hkx` - Clickable toggle cells
- `NTi` - Pattern modifier cells
- `gOi` - Special interaction markers

### Game Logic
1. Click a cell tagged `Hkx` or `NTi`
2. Colors cycle through `gqb` array (default: `[9, 8]`)
3. Propagation pattern defined by `irw` (default: center only)
4. `NTi` cells use their pixel pattern to determine affected neighbors

### Win Condition (`cgj()`)
All constraint cells (`bsT`) must have their adjacency rules satisfied:
- Pixel value `0` = adjacent cell must **match** center color
- Pixel value `≠0` = adjacent cell must **differ** from center color

---

## vc33 - Rail Switching

**File:** `games/official/vc33.py` (2141 lines)

### Core Mechanic
Click-only puzzle where you route trains by clicking switches. Trains slide along rails.

### Input Mapping
```
ACTION6 = Click at (x, y) coordinates (only action)
```

### Key Tags
- `rDn` - Rail/platform segments (black rectangles)
- `UXg` - Gray rail barriers (collision boundaries)
- `HQB` - Train sprites (yellow/orange arrow shapes)
- `fZK` - Destination markers (colored tips)
- `zHk` - Clickable switch levers
- `ZGd` - Clickable junction points
- `rlV` - Visual indicators for valid switches
- `WuO` - Horizontal rail segments
- `ACQ` - Active/moveable elements

### Game Logic
1. Click `ZGd` to toggle junction routing
2. Click `zHk` (when highlighted with `rlV`) to slide train cars
3. Animation system (`vai`) handles smooth movement via `ysn` class
4. `dzy` dictionary maps switches to (source_rail, dest_rail) pairs

### Win Condition (`gug()`)
All trains (`HQB`) must be on rails that connect to their matching destination markers (`fZK`), verified by color matching.

---

## Code Patterns Observed

### Obfuscated Variable Names
All three games use 3-letter obfuscated variable names (e.g., `xhp`, `kbj`, `lgr`). This is intentional to make reverse-engineering harder for benchmark purposes.

### Common Structure
```python
class GameName(ARCBaseGame):
    def __init__(self):
        super().__init__("game_id", levels, Camera(...))
    
    def on_set_level(self, level: Level):
        # Initialize level-specific state
        
    def step(self):
        # Handle current action
        # Check win/lose conditions
        # Call complete_action()
```

### Level Data Pattern
Each level stores configuration in `data` dict:
```python
Level(
    sprites=[...],
    grid_size=(64, 64),
    data={"key": value, ...},
    name="level_name",
)
```

---

## Running the Games

```python
import arc_agi

# Initialize arcade (gets anonymous API key automatically)
arc = arc_agi.Arcade()

# Create environment
env = arc.make("ls20", render_mode="human")  # or ft09, vc33

# Play
obs = env.reset()
while obs.state == GameState.NOT_FINISHED:
    obs = env.step(GameAction.ACTION1)  # or other actions
```

---

## Cloning for Modification

The games are MIT licensed. To create a variant:

1. Copy from `games/official/` to `games/your_variant/`
2. Rename the class (e.g., `Ls20` → `MyPuzzle`)
3. Modify sprites, levels, or game logic
4. Register with your own game ID

---

## Human Baseline Data

Available on Google Drive (linked from ARC Prize docs):
- Replay traces showing human solutions
- Action sequences for each level
- Useful for understanding intended solutions
