# Create ARC-AGI-3 Environment

Complete guide to building a game for ARC-AGI-3

## Overview

This guide demonstrates building a click-to-remove game where players eliminate randomly generated sprites to win. The documentation covers file structure, sprite/level definitions, and game mechanics implementation.

## Key Structural Requirements

### Directory Layout

```
ARC-AGI/
└── environment_files/
    └── [game_id]/
        └── v1/
            ├── [game_id].py
            └── metadata.json
```

### Metadata Configuration

The `metadata.json` file requires a `game_id` field in format "{4-char ID}-{version}" and a `local_dir` pointing to the game directory.

Example metadata.json:
```json
{
  "game_id": "myga-001",
  "local_dir": "/path/to/environment_files/myga/v1"
}
```

## Core Components

### Imports & Setup

Games require importing the following from the arcengine module:
- `ARCBaseGame`
- `Camera`
- `GameAction`
- `Level`
- `Sprite`

Plus standard libraries as needed.

### Sprite Definition

Sprites are template objects containing:
- Pixel arrays (palette indices 0-15, -1 for transparent)
- Names for identification
- Visibility flags
- Collision properties (BlockingMode, InteractionMode)

These templates get cloned and modified during gameplay.

Example sprite definition:
```python
player_sprite = Sprite(
    name="player",
    pixels=[[1, 2], [3, 4]],  # 2x2 pixel array
    visible=True,
    blocking_mode=BlockingMode.PIXEL_PERFECT
)
```

### Level Definition

Levels are `Level` objects specifying:
- Sprite placements and initial positions
- Grid dimensions
- Sprite tags and metadata

The example uses five levels with grid sizes ranging from 8×8 to 64×64 pixels.

## Game Class Implementation

The main class extends `ARCBaseGame` and accepts a seed parameter for deterministic random generation.

### Key Methods

**`__init__()`**
- Initializes the camera, random number generator, and parent class

**`on_set_level()`**
- Called when levels load
- Triggers sprite generation or initialization

**`generate_sprites()`**
- Creates randomized sprites using chained operations
- Methods: clone, color_remap, set_scale, set_position

**`_check_win()`**
- Returns true when all sprites are removed
- Determines level completion

**`step()`**
- Main game loop handling click actions
- Processes sprite removal and win conditions
- Advances levels upon victory

### Example Game Class Structure

```python
from arc_engine import ARCBaseGame, Camera, GameAction, Level, Sprite

class MyGame(ARCBaseGame):
    def __init__(self, seed: int = 0):
        self.camera = Camera(width=64, height=64)
        self.random = Random(seed)
        super().__init__([...levels...])

    def on_set_level(self):
        self.generate_sprites()

    def generate_sprites(self):
        # Create randomized sprites
        pass

    def _check_win(self):
        # Check if all sprites are removed
        return len(self.level.get_sprites_by_tag("clickable")) == 0

    def step(self):
        # Handle game logic
        pass
```

## Gameplay Mechanics

The game processes `GameAction.ACTION6` (click) commands by:

1. Extracting x, y coordinates from action data
2. Converting display coordinates to grid coordinates via `camera.display_to_grid()`
3. Detecting sprite collisions at those coordinates
4. Removing clicked sprites and checking win conditions
5. Advancing levels upon victory

## Testing & Deployment

Games launch through the ARC-AGI-3 client using:

```python
from arc_agi import Arcade

arcade = Arcade()
env = arcade.make("myga-001", seed=0, render_mode="human")
```

### Parameters

- `game_id`: The game identifier (e.g., "myga-001")
- `seed`: Random seed for reproducibility
- `render_mode`: Display mode ("human", "terminal", "terminal-fast", custom function)

Custom environment directories can be specified during initialization:

```python
arcade = Arcade(environments_dir="/custom/path/to/environment_files")
```

## File Structure Example

```
environment_files/
└── myga/
    └── v1/
        ├── myga.py          # Main game class
        └── metadata.json    # Game metadata
```

## Best Practices

1. **Use descriptive sprite names** for easy identification and querying
2. **Tag sprites appropriately** for bulk operations (e.g., "clickable", "static")
3. **Test with multiple seeds** to ensure deterministic behavior
4. **Implement proper win conditions** that are clear and unambiguous
5. **Keep frame count reasonable** - avoid infinite loops in step()
6. **Document game rules** in comments for maintainability
