# ARC-AGI-3 Game Development Guide

> **Author**: Claude Sonnet 4  
> **Date**: 2026-01-31  
> **Purpose**: Comprehensive guide for developing ARCEngine games based on official ARC Prize Foundation documentation.  
> **Source**: https://docs.arcprize.org/

---

## Table of Contents

1. [Overview](#overview)
2. [Game File Structure](#game-file-structure)
3. [Core Concepts](#core-concepts)
4. [Sprites](#sprites)
5. [Levels](#levels)
6. [Game Class](#game-class)
7. [Actions](#actions)
8. [Game State & Lifecycle](#game-state--lifecycle)
9. [Collision Detection](#collision-detection)
10. [Scoring Methodology](#scoring-methodology)
11. [Testing](#testing)
12. [Complete Example](#complete-example)

---

## Overview

ARC-AGI-3 is an **Interactive Reasoning Benchmark** designed to measure an AI Agent's ability to generalize in novel, unseen environments. Games are built using the ARCEngine library.

### Key Principles

- **Grid-based**: Maximum 64x64 grid, cell values 0-15 (colors)
- **Coordinate System**: (0,0) at top-left, (x,y) format
- **Level-based Progression**: Games have multiple levels; completing all levels = WIN
- **Action-based Input**: Agents send actions (ACTION1-7), games respond with frame data

---

## Game File Structure

Each game follows this structure:

```
games/
└── your_game/
    ├── __init__.py      # Exports the game class
    ├── game.py          # Main game logic (YourGame class)
    ├── sprites.py       # Sprite definitions
    └── levels.py        # Level definitions
```

### Single-File Alternative (Official Format)

For submission to ARC Prize, games can be a single file:

```
environment_files/
└── ab12/               # 4-character game ID
    └── v1/             # version identifier
        ├── ab12.py     # must match game ID
        └── metadata.json
```

---

## Core Concepts

### ARC3 Color Palette (0-15)

| Index | Color | Common Use |
|-------|-------|------------|
| 0 | White | Background, highlights |
| 1-4 | Grays | Walls, structures |
| 5 | Black | Background, void |
| 6 | Pink | Accents |
| 7 | Light Pink | Accents |
| 8 | Red | Danger, enemies |
| 9 | Blue | Goals, water |
| 10 | Light Blue | Highlights |
| 11 | Yellow | Energy, coins |
| 12 | Orange | Player, important |
| 13 | Dark Red | Depleted, danger |
| 14 | Green | Success, exit |
| 15 | Purple | Special |

### Transparency

Use `-1` in pixel arrays to indicate transparent pixels.

---

## Sprites

Sprites are the visual and interactive elements of your game.

### Sprite Definition

```python
from arcengine import Sprite, BlockingMode, InteractionMode

PLAYER = Sprite(
    pixels=[
        [-1, 12, -1],
        [12, 12, 12],
        [-1, 12, -1],
    ],
    name="player",
    blocking=BlockingMode.BOUNDING_BOX,  # or PIXEL_PERFECT, NOT_BLOCKED
    interaction=InteractionMode.TANGIBLE,  # or INTANGIBLE, INVISIBLE, REMOVED
    layer=10,  # Higher = rendered on top
    tags=["player", "moveable"],
    visible=True,
    collidable=True,
)
```

### BlockingMode

- **NOT_BLOCKED**: No collision detection
- **BOUNDING_BOX**: Simple rectangular collision
- **PIXEL_PERFECT**: Only non-transparent pixels block

### InteractionMode

- **TANGIBLE**: Visible and collidable
- **INTANGIBLE**: Visible but not collidable (ghost-like)
- **INVISIBLE**: Not visible but collidable (invisible wall)
- **REMOVED**: Not visible, not collidable (effectively deleted)

### Sprite Operations

```python
# Clone (required when reusing in levels)
new_sprite = SPRITE.clone()

# Position
sprite.set_position(x, y)
sprite.move(dx, dy)

# Transform
sprite.set_scale(2)
sprite.color_remap(old_color, new_color)

# Chain operations
sprite = TEMPLATE.clone().set_position(10, 10).set_scale(2)
```

---

## Levels

Levels define the initial state of each stage.

### Level Definition

```python
from arcengine import Level
from .sprites import SPRITES

LEVEL_1 = Level(
    sprites=[
        SPRITES["world"].clone().set_position(10, 10),
        SPRITES["exit"].clone().set_position(50, 50),
        SPRITES["player"].clone().set_position(30, 30),
    ],
    grid_size=(64, 64),
    data={
        "custom_key": "custom_value",
        "max_moves": 30,
    },
)

LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3]
```

### Level Data

Use `data` dict for level-specific configuration accessible via `self.current_level.get_data("key")`.

### Level Methods

```python
# In game class
level.get_sprites()                    # All sprites
level.get_sprites_by_name("player")    # By name
level.get_sprites_by_tag("moveable")   # By tag
level.get_sprite_at(x, y)              # At position
level.add_sprite(sprite)               # Add dynamically
level.remove_sprite(sprite)            # Remove dynamically
```

---

## Game Class

The game class extends `ARCBaseGame` and implements your game logic.

### Required Structure

```python
from arcengine import ARCBaseGame, Camera, GameAction, Level

class YourGame(ARCBaseGame):
    """Your game description."""
    
    def __init__(self, seed: int = 0) -> None:
        """Initialize camera and call super().__init__."""
        camera = Camera(
            width=64,
            height=64,
            background=5,      # Background color
            letter_box=5,      # Letterbox color
            interfaces=[],     # UI elements
        )
        super().__init__(
            game_id="your_game-0.01",
            levels=LEVELS,
            camera=camera,
        )
    
    def on_set_level(self, level: Level) -> None:
        """Called when level loads. Cache sprite references here."""
        self._player = level.get_sprites_by_name("player")[0]
    
    def step(self) -> None:
        """Main game logic. MUST call self.complete_action() at end."""
        # Handle input
        if self.action.id == GameAction.ACTION1:
            # Do something for UP
            pass
        
        # Check win/lose conditions
        if self._check_win():
            if self.is_last_level():
                self.win()      # Beat the game!
            else:
                self.next_level()  # Advance to next level
        
        if self._check_lose():
            self.lose()
        
        # REQUIRED: Always call this
        self.complete_action()
```

### Critical Rules

1. **Always call `self.complete_action()`** at end of `step()`
2. **Clone sprites** when placing in levels: `SPRITE.clone().set_position(x, y)`
3. **Use `self.next_level()`** to advance (increments score automatically)
4. **Use `self.win()`** only on the last level
5. **Use `self.lose()`** for game over conditions

---

## Actions

Actions are the input interface between agents/players and games.

### Action Types

| Action | Type | Common Use | Keybinding |
|--------|------|------------|------------|
| RESET | Simple | Reset game/level | - |
| ACTION1 | Simple | Up / Option A | W, ↑ |
| ACTION2 | Simple | Down / Option B | S, ↓ |
| ACTION3 | Simple | Left / Option C | A, ← |
| ACTION4 | Simple | Right / Option D | D, → |
| ACTION5 | Simple | Action / Confirm | Space, F |
| ACTION6 | Complex | Click at (x,y) | Mouse |
| ACTION7 | Simple | Undo | - |

### Handling Actions

```python
def step(self) -> None:
    # Simple actions (directional)
    if self.action.id == GameAction.ACTION1:
        self._move_up()
    elif self.action.id == GameAction.ACTION2:
        self._move_down()
    elif self.action.id == GameAction.ACTION3:
        self._move_left()
    elif self.action.id == GameAction.ACTION4:
        self._move_right()
    
    # Complex action with coordinates
    elif self.action.id == GameAction.ACTION6:
        x = self.action.data.get("x", 0)
        y = self.action.data.get("y", 0)
        coords = self.camera.display_to_grid(x, y)
        if coords:
            grid_x, grid_y = coords
            self._handle_click(grid_x, grid_y)
    
    self.complete_action()
```

---

## Game State & Lifecycle

### GameState Enum

- **NOT_PLAYED**: Initial state
- **NOT_FINISHED**: Game in progress
- **WIN**: Player beat all levels
- **GAME_OVER**: Player lost (called `self.lose()`)

### Lifecycle Flow

```
__init__() → on_set_level(level_0) → [ready to play]
                    ↓
            step() called for each action
                    ↓
        ┌─── next_level() ───┐
        │                    │
        ↓                    ↓
  on_set_level(n+1)    is_last_level()?
        │                    │
        │              ┌─────┴─────┐
        │              │           │
        │              ↓           ↓
        │           win()       lose()
        │              ↓           ↓
        └───────── [game over] ────┘
```

### Level Progression

```python
# Check if player should advance
if self._player_reached_exit():
    if self.is_last_level():
        self.win()  # Beat the game!
    else:
        self.next_level()  # Go to next level (increments score)
```

### Score

- `self._score` = number of levels completed (automatically incremented by `next_level()`)
- `self._win_score` = total number of levels (set in `__init__`, defaults to `len(levels)`)

---

## Collision Detection

### Sprite Collision

```python
# Check if two sprites overlap
if sprite_a.collides_with(sprite_b):
    # Collision detected
    pass
```

### Position-based Collision (Recommended)

```python
def _get_blocking_sprite_at(self, x: int, y: int) -> Sprite | None:
    """Check for blocking sprite at position."""
    for sprite in self.current_level.get_sprites():
        if sprite.interaction == InteractionMode.REMOVED:
            continue
        if sprite == self._player:
            continue
        if sprite.blocking == BlockingMode.NOT_BLOCKED:
            continue
        if self._sprite_occupies_position(sprite, x, y):
            return sprite
    return None

def _sprite_occupies_position(self, sprite: Sprite, x: int, y: int) -> bool:
    """Check if sprite covers the given position."""
    return (sprite.x <= x < sprite.x + sprite.width and
            sprite.y <= y < sprite.y + sprite.height)
```

### Pixel-Level Collision (For Complex Shapes)

```python
def _is_wall_at_position(self, world_x: int, world_y: int) -> bool:
    """Check if a wall pixel exists at position."""
    # Convert world to sprite-local coordinates
    local_x = world_x - self._maze.x
    local_y = world_y - self._maze.y
    
    # Bounds check
    if not (0 <= local_y < len(self._maze.pixels) and
            0 <= local_x < len(self._maze.pixels[0])):
        return True  # Out of bounds = blocked
    
    # Check pixel value (-1 = transparent/walkable, other = solid)
    pixel = self._maze.pixels[local_y][local_x]
    return pixel != -1 and pixel == WALL_COLOR
```

---

## Scoring Methodology

ARC-AGI-3 measures **completion** and **efficiency**.

### Per-Level Scoring

```
level_score = human_baseline_actions / ai_actions
```

- Score capped at 1.0 (100%) per level
- Taking twice as many actions as human = 0.5 (50%)

### Per-Game Aggregation

Sum of per-level scores / number of levels.

### Important Notes

- **Score = levels_completed** (not a custom point system)
- **Win condition = complete all levels** (not reach a score)
- Don't display "Score: X/Y" to users - show "Level: N" instead

---

## Testing

### Local Testing

```python
from arcengine import GameAction, ActionInput
from games.your_game import YourGame

# Create game instance
game = YourGame()

# Get initial frame
frame = game.perform_action(ActionInput(id=GameAction.RESET))
print(f"State: {frame.state}, Level: {frame.levels_completed + 1}")

# Perform actions
frame = game.perform_action(ActionInput(id=GameAction.ACTION1))  # Up
frame = game.perform_action(ActionInput(id=GameAction.ACTION4))  # Right

# Check state
if frame.state == GameState.WIN:
    print("Game won!")
```

### Using ARC-AGI Toolkit

```python
import arc_agi
from arcengine import GameAction

arc = arc_agi.Arcade()
env = arc.make("your_game-v1", render_mode="terminal")

# Play
obs = env.step(GameAction.ACTION1)
print(f"State: {obs.state}, Levels: {obs.levels_completed}/{obs.win_levels}")
```

---

## Complete Example

See `/games/world_shifter/` for a complete example demonstrating:

- Sprite definitions with different blocking modes
- Level definitions with custom data
- Inverse movement mechanic (world moves, not player)
- Pixel-level collision detection
- Energy/move tracking with UI
- Proper level progression

Key files:
- `sprites.py`: Player, exit, world platform sprites
- `levels.py`: 6 levels with increasing difficulty
- `game.py`: WorldShifter class with full game logic

---

## References

- **Official Docs**: https://docs.arcprize.org/
- **ARCEngine GitHub**: https://github.com/arcprize/ARCEngine
- **Create Game Guide**: https://docs.arcprize.org/add_game
- **Edit Game Guide**: https://docs.arcprize.org/edit_games
- **Actions Reference**: https://docs.arcprize.org/actions
- **Scoring Methodology**: https://docs.arcprize.org/methodology
