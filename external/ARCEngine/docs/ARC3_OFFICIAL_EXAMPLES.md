# ARC-AGI-3 Official Example Games

> **Author**: Claude Sonnet 4  
> **Date**: 2026-01-31  
> **Purpose**: Reference documentation for official ARC Prize Foundation example games. These examples demonstrate canonical patterns for building ARC-AGI-3 environments.  
> **Source**: https://docs.arcprize.org/

---

## Table of Contents

1. [Overview](#overview)
2. [Official Preview Games](#official-preview-games)
3. [Example Game: ab12 (Click-to-Remove)](#example-game-ab12-click-to-remove)
4. [Editing Existing Games](#editing-existing-games)
5. [Sprite Techniques](#sprite-techniques)
6. [Animation Pattern](#animation-pattern)
7. [Directory Structure](#directory-structure)

---

## Overview

The ARC Prize Foundation provides official example games demonstrating how to build ARC-AGI-3 environments. These games are:

- **Turn-based** — Each action produces 1–N frames (hard cap: 1000 frames/action)
- **Grid-based** — Maximum 64×64 grid with 16-color palette (0-15)
- **Action-driven** — Games respond to standardized actions (ACTION1-7)

### Documentation Index

The complete ARC-AGI-3 documentation is available at:
- **Documentation Index**: https://docs.arcprize.org/llms.txt
- **Create Game Guide**: https://docs.arcprize.org/add_game
- **Edit Game Guide**: https://docs.arcprize.org/edit_games
- **ARCEngine GitHub**: https://github.com/arcprize/ARCEngine

---

## Official Preview Games

Three example games are available in the ARC-AGI-3 preview:

| Game ID | Name | Focus Area | URL |
|---------|------|------------|-----|
| `ls20` | Agent Reasoning | Complex decision making | https://three.arcprize.org/games/ls20 |
| `ft09` | Elementary Logic | Basic logical reasoning | https://three.arcprize.org/games/ft09 |
| `vc33` | Orchestration | Multi-step coordination | https://three.arcprize.org/games/vc33 |

### Accessing Games

```python
import arc_agi
from arcengine import GameAction

# Initialize the ARC-AGI-3 client
arc = arc_agi.Arcade()

# Create environment with terminal rendering
env = arc.make("ls20", render_mode="terminal")

# See available actions for this game
print(env.action_space)

# Take an action
obs = env.step(GameAction.ACTION1)

# Check scorecard
print(arc.get_scorecard())
```

---

## Example Game: ab12 (Click-to-Remove)

This is the **official tutorial example** from the ARC Prize Foundation documentation. It demonstrates:

- Procedural sprite generation with seeding
- Click-based interaction (ACTION6)
- Level progression with varying grid sizes
- Win condition checking

### Complete Source Code

```python
"""
Author: ARC Prize Foundation (Official Example)
Date: 2026-01-31
PURPOSE: Click-to-remove puzzle game demonstrating procedural generation,
         ACTION6 handling, and level progression. This is the canonical
         example from https://docs.arcprize.org/add_game
SRP/DRY check: Pass - Official reference implementation
"""

import random

from arcengine import (
    ARCBaseGame,
    Camera,
    GameAction,
    Level,
    Sprite,
)

# ==============================================================================
# SPRITE DEFINITIONS
# ==============================================================================

# Base sprite template - single pixel that will be cloned, scaled, and recolored
sprites = {
    "sprite-1": Sprite(
        pixels=[
            [9],
        ],
        name="sprite-1",
        visible=True,
        collidable=True,
    ),
}

# ==============================================================================
# LEVEL DEFINITIONS
# ==============================================================================

# Levels with increasing grid sizes (sprites generated procedurally)
levels = [
    Level(sprites=[], grid_size=(8, 8)),
    Level(sprites=[], grid_size=(16, 16)),
    Level(sprites=[], grid_size=(24, 24)),
    Level(sprites=[], grid_size=(32, 32)),
    Level(sprites=[], grid_size=(64, 64)),
]

# ==============================================================================
# CONSTANTS
# ==============================================================================

BACKGROUND_COLOR = 0
PADDING_COLOR = 4

# Available colors for sprites (excluding black/white for visibility)
SPRITE_COLORS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

# Parameters for procedural generation
MIN_SIZE = 1
MAX_SIZE = 4


# ==============================================================================
# GAME CLASS
# ==============================================================================

class Ab12(ARCBaseGame):
    """Click-to-remove puzzle game with seeded random sprite generation."""

    def __init__(self, seed: int = 0) -> None:
        # Initialize random number generator with seed for reproducibility
        self._rng = random.Random(seed)

        # Create camera with background and padding colors
        camera = Camera(
            background=BACKGROUND_COLOR,
            letter_box=PADDING_COLOR,
            width=8,
            height=8,
        )

        # Initialize base game
        super().__init__(
            game_id="ab12",
            levels=levels,
            camera=camera,
        )

    def generate_sprites(self) -> None:
        """Generate a random set of sprites based on the seed."""
        # Determine number of sprites based on grid size
        cell_count = self.current_level.grid_size[0] * self.current_level.grid_size[1]
        sprite_count = cell_count // 64

        for idx in range(sprite_count):
            # Random properties for each sprite
            scale = self._rng.randint(MIN_SIZE, MAX_SIZE)
            color = self._rng.choice(SPRITE_COLORS)
            x = self._rng.randint(0, self.current_level.grid_size[0] - 1)
            y = self._rng.randint(0, self.current_level.grid_size[1] - 1)

            # Create sprite by cloning template and applying properties
            sprite = (
                sprites["sprite-1"]
                .clone()
                .color_remap(None, color)
                .set_scale(scale)
                .set_position(x, y)
            )
            self.current_level.add_sprite(sprite)

    def on_set_level(self, level: Level) -> None:
        """Called when the level is set - generates sprites for this level."""
        self.generate_sprites()

    def _check_win(self) -> bool:
        """Check if all targets have been removed."""
        return len(self.current_level._sprites) == 0

    def step(self) -> None:
        """Process game logic for each step."""
        # Handle click action (ACTION6 provides x,y coordinates)
        if self.action.id == GameAction.ACTION6:
            # Extract coordinates from action data
            x = self.action.data.get("x", 0)
            y = self.action.data.get("y", 0)

            # Convert display coordinates to grid coordinates
            coords = self.camera.display_to_grid(x, y)

            if coords:
                grid_x, grid_y = coords

                # Find and remove the clicked sprite
                clicked_sprite = self.current_level.get_sprite_at(grid_x, grid_y)
                if clicked_sprite:
                    self.current_level.remove_sprite(clicked_sprite)

                    # Check win condition - advance to next level if all removed
                    if self._check_win():
                        self.next_level()

        # REQUIRED: Always call complete_action at end of step
        self.complete_action()
```

### Testing the Example

```python
import arc_agi
from arcengine import GameAction

# Default: looks for games in "environment_files" directory
arc = arc_agi.Arcade()
env = arc.make("ab12-v1", seed=0, render_mode="terminal")

# Perform clicks (ACTION6 with x, y coordinates)
env.step(GameAction.ACTION6, data={"x": 32, "y": 32})
```

---

## Editing Existing Games

### Project Setup

Game files are stored in an `environments` directory. Configure in `.env`:

```dotenv
environments_dir = my_environments
```

Or specify directly:

```python
arc = arc_agi.Arcade(environments_dir="./my_environments")
```

### Creating a New Version

Copy your existing version folder to create a new version:

**Windows:**
```bash
xcopy environment_files\ls20\v1 environment_files\ls20\v2\ /E /I
```

**Mac/Linux:**
```bash
cp -r environment_files/ls20/v1 environment_files/ls20/v2
```

Then update `metadata.json`:

```json
{
  "game_id": "ls20-v2",
  "default_fps": 5,
  "local_dir": "environment_files\\ls20\\v2"
}
```

Test the new version:

```python
arc = arc_agi.Arcade()
env = arc.make("ls20-v2", render_mode="terminal")
```

### Metadata File Fields

| Field | Description |
|-------|-------------|
| `game_id` | Unique identifier: `{4-char game ID}-{version}` |
| `default_fps` | Frames per second for playback (optional) |
| `baseline_actions` | Array of average action counts per level (optional) |
| `tags` | Optional tags for categorization |
| `local_dir` | Relative path to game directory |

---

## Sprite Techniques

### Modifying Sprite Pixels

Edit the pixel array directly in the `sprites` dictionary:

```python
sprites = {
    "pca": Sprite(
        pixels=[
            [10, 10, 10, 10, 10],
            [10, 10, 10, 10, 10],
            [8, 8, 8, 8, 8],
            [8, 8, 8, 8, 8],
            [8, 8, 8, 8, 8],
        ],
        name="pca",
        visible=True,
        collidable=True,
        tags=["caf"],
    ),
}
```

### Inline Sprite Modifications in Levels

```python
Level(
    sprites=[
        # Edit position
        sprites["pca"].clone().set_position(29, 35),

        # Edit colors (remap all colors to color 12)
        sprites["zba"].clone().set_position(15, 16).color_remap(None, 12),

        # Edit rotation
        sprites["kdy"].clone().set_position(49, 45).set_rotation(90),
    ],
    # ...
)
```

### Dynamic Sprite Addition/Removal

```python
# Add sprite during gameplay
new_sprite = sprites["sprite-name"].clone().set_position(x, y)
self.current_level.add_sprite(new_sprite)

# Remove sprite
self.current_level.remove_sprite(some_sprite)
```

### Querying Sprites

```python
# Get sprites by tag
players = self.current_level.get_sprites_by_tag("Player")

# Get sprite at position
sprite = self.current_level.get_sprite_at(x, y)

# Get sprites by name
ABC_sprites = self.current_level.get_sprites_by_name("ABC")
```

---

## Animation Pattern

For multi-frame effects, delay `complete_action()`:

```python
def step(self) -> None:
    """Process game logic with animation support."""
    # If animating, advance the animation instead of processing input
    if self.animating:
        self.animation_frame += 1
        if self.animation_frame >= self.animation_length:
            self.animating = False
            self.complete_action()  # Animation finished
        return  # Don't complete action yet - keep animating

    # Normal game logic when not animating...
    if self.action.id == GameAction.ACTION1:
        self._start_animation()

    # REQUIRED: Complete action when not animating
    self.complete_action()
```

**Note**: The game loop keeps calling `step()` until `complete_action()` is called. This enables multi-frame animations.

---

## Directory Structure

### Official ARC-AGI Format (Single File)

```
ARC-AGI/
└── environment_files/
    └── ab12/               # 4-character game ID
        └── v1/             # Version identifier
            ├── ab12.py     # Must match game ID
            └── metadata.json
```

### This Project Format (Multi-File)

```
games/
└── your_game/
    ├── __init__.py      # Exports: from .game import YourGame
    ├── game.py          # Main game class
    ├── sprites.py       # Sprite definitions
    └── levels.py        # Level definitions
```

### Level Data Access

```python
# Define in level
Level(
    sprites=[...],
    grid_size=(64, 64),
    data={
        "Amount": 30,
        "Values": [5, 0, 2],
        "level_flag": False,
        "names": ["name-1", "name-2"],
    },
)

# Access in game class
self.amount = self.current_level.get_data("Amount")
self.flag = self.current_level.get_data("level_flag")
```

---

## Color Palette Reference

ARCEngine uses a 16-color palette (0-15) plus special values:

| Value | Meaning |
|-------|---------|
| `-1` | Transparent (not rendered, not collidable) |
| `-2` | Transparent but collidable |
| `0-15` | Color palette indices |

Common color conventions:
- `0` = White/Background
- `5` = Black
- `6-7` = Pink shades
- `8` = Red
- `9` = Blue
- `10` = Light Blue
- `11` = Yellow
- `12` = Orange
- `13` = Dark Red
- `14` = Green
- `15` = Purple

---

## References

- **ARC-AGI-3 Docs**: https://docs.arcprize.org/
- **Create Game Guide**: https://docs.arcprize.org/add_game
- **Edit Game Guide**: https://docs.arcprize.org/edit_games
- **Actions Reference**: https://docs.arcprize.org/actions
- **ARCEngine GitHub**: https://github.com/arcprize/ARCEngine
- **Game Schema**: https://docs.arcprize.org/game-schema
