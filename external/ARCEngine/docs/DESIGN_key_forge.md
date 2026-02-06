# Key Forge: Game Design Document

A maze navigation game where you collect key fragments and merge them to unlock doors.

---

## 1. Game Concept

**Title:** Key Forge

**Elevator Pitch:** Navigate a maze, collect scattered key fragments, merge them together to forge a complete key, then reach the locked door to escape.

**Combines:**
- **From simple_maze:** Grid navigation, wall collision, reaching an exit
- **From merge:** Collecting sprites, merging them together, matching a target shape

**Why it works:** The maze provides structure and challenge, while the merge mechanic adds a puzzle layer. Players must plan their route to collect fragments efficiently.

---

## 2. Core Mechanics

### 2.1 Movement
- **ACTION1 (W/Up):** Move up 1 pixel
- **ACTION2 (S/Down):** Move down 1 pixel
- **ACTION3 (A/Left):** Move left 1 pixel
- **ACTION4 (D/Right):** Move right 1 pixel

### 2.2 Collection & Merging
- When the player collides with a **key fragment** (tagged `"fragment"`), they automatically merge with it
- The player sprite grows as fragments are collected
- Fragments have distinct colors to show what's been collected

### 2.3 Win Condition
- A **locked door** sprite (tagged `"door"`) shows the required key shape
- When the player's merged shape matches the door's key pattern, touching the door wins the level
- Use `get_pixels_at_sprite()` to compare player shape vs door shape

### 2.4 Lose Condition
- **None** - This is a relaxed puzzle game. Players can always reset if stuck.
- (Optional extension: add a move counter for scoring)

---

## 3. Sprites Specification

### 3.1 Player
```python
"player": Sprite(
    pixels=[[9]],  # Blue - 1x1 starting size
    name="player",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["player"],
)
```

### 3.2 Key Fragments (3 types for variety)
```python
"fragment_top": Sprite(
    pixels=[
        [4, 4, 4],  # Yellow - top of key
        [-1, 4, -1],
    ],
    name="fragment_top",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    tags=["fragment"],
)

"fragment_middle": Sprite(
    pixels=[
        [4],  # Yellow - shaft
        [4],
    ],
    name="fragment_middle",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    tags=["fragment"],
)

"fragment_teeth": Sprite(
    pixels=[
        [4, 4],  # Yellow - teeth at bottom
        [4, -1],
    ],
    name="fragment_teeth",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    tags=["fragment"],
)
```

### 3.3 Complete Key (Target Shape on Door)
```python
"key_complete": Sprite(
    pixels=[
        [4, 4, 4],  # The assembled key shape
        [9, 4, -1],  # Blue (player) + yellow fragments
        [4, 4, -1],
        [4, -1, -1],
        [4, 4, -1],
    ],
    name="key_complete",
    tags=["door"],
)
```

### 3.4 Maze Walls
```python
"maze": Sprite(
    pixels=[
        # 2D array defining walls (5 = gray) and paths (-1 = transparent)
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, -1, 5, -1, -1, -1, -1, 5],
        # ... etc
    ],
    name="maze",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,  # Render below everything
)
```

---

## 4. Level Design

### Level 1: Tutorial (8x8 grid)
**Goal:** Introduce basic mechanics - one fragment, simple maze

```
##########
#P.......#
#.#####..#
#.#...#..#
#.#.F.#..#
#.#...#..#
#.....#.D#
##########

P = Player start (1,1)
F = Fragment (4,4)
D = Door with target key (7,6)
# = Wall
. = Empty path
```

**What player learns:**
- Move with arrow keys
- Collect fragment by touching it
- Match the door pattern to win

### Level 2: Two Fragments (10x10 grid)
**Goal:** Collect multiple fragments, plan route

```
############
#P.........#
#.####.###.#
#.#..#...#.#
#.#.F#.#.#.#
#.#..#.#...#
#.##.#.###.#
#....#.F...#
#.######.#.#
#........#D#
############
```

### Level 3: Three Fragments + Longer Path (12x12 grid)
**Goal:** Full key assembly, more complex maze

---

## 5. Game Class Structure

```python
class KeyForge(ARCBaseGame):
    """Navigate maze, collect key fragments, unlock the door."""

    _player: Sprite
    _door: Sprite

    def __init__(self) -> None:
        camera = Camera(
            background=0,      # Black background
            letter_box=3,      # Cyan letterbox
        )
        super().__init__(
            game_id="key_forge",
            levels=levels,
            camera=camera,
        )

    def on_set_level(self, level: Level) -> None:
        """Cache references when level loads."""
        self._player = level.get_sprites_by_name("player")[0]
        self._door = level.get_sprites_by_tag("door")[0]

    def step(self) -> None:
        """Process one game step."""
        # 1. Calculate movement direction
        dx, dy = 0, 0
        if self.action.id == GameAction.ACTION1:
            dy = -1  # Up
        elif self.action.id == GameAction.ACTION2:
            dy = 1   # Down
        elif self.action.id == GameAction.ACTION3:
            dx = -1  # Left
        elif self.action.id == GameAction.ACTION4:
            dx = 1   # Right

        # 2. Try to move and get collisions
        collisions = self.try_move("player", dx, dy)

        # 3. Handle fragment collection (merge)
        for sprite in collisions:
            if "fragment" in sprite.tags:
                self._collect_fragment(sprite, dx, dy)

        # 4. Check win condition (player matches door key)
        if self._check_key_matches():
            for sprite in collisions:
                if "door" in sprite.tags:
                    self._handle_door_reached()

        self.complete_action()

    def _collect_fragment(self, fragment: Sprite, dx: int, dy: int) -> None:
        """Merge fragment into player."""
        old_player = self._player
        self._player = self._player.merge(fragment)

        # Update level sprites
        self.current_level.remove_sprite(fragment)
        self.current_level.remove_sprite(old_player)
        self.current_level.add_sprite(self._player)

        # Continue movement after merge
        self._player.move(dx, dy)

    def _check_key_matches(self) -> bool:
        """Compare player shape to door's required key."""
        player_pixels = self.get_pixels_at_sprite(self._player)
        door_pixels = self.get_pixels_at_sprite(self._door)
        return np.array_equal(player_pixels, door_pixels)

    def _handle_door_reached(self) -> None:
        """Player unlocked the door!"""
        if self.is_last_level():
            self.win()
        else:
            self.next_level()
```

---

## 6. Implementation Checklist

Use this checklist to track your progress:

### Setup
- [ ] Create new file: `examples/key_forge.py`
- [ ] Add imports (copy from simple_maze.py)
- [ ] Add `import numpy as np` for pixel comparison

### Sprites (Step 1)
- [ ] Define `player` sprite (blue 1x1)
- [ ] Define `fragment_top` sprite (yellow key top)
- [ ] Define `fragment_middle` sprite (yellow shaft)
- [ ] Define `fragment_teeth` sprite (yellow teeth)
- [ ] Define `key_complete` sprite (target shape for door)
- [ ] Define `maze_1` sprite (level 1 walls)

### Level 1 (Step 2)
- [ ] Create Level with maze_1, player, one fragment, door
- [ ] Set correct positions for each sprite
- [ ] Test: player can move, hits walls, collects fragment

### Game Logic (Step 3)
- [ ] Create `KeyForge` class inheriting `ARCBaseGame`
- [ ] Implement `__init__` with camera setup
- [ ] Implement `on_set_level` to cache player/door references
- [ ] Implement movement in `step()`
- [ ] Implement fragment collection (merge logic)
- [ ] Implement win condition check

### Testing (Step 4)
- [ ] Test level 1 plays correctly
- [ ] Add level 2 with two fragments
- [ ] Add level 3 with three fragments
- [ ] Test full game flow

---

## 7. Testing Guide

### Manual Testing
```python
from key_forge import KeyForge
from arcengine import ActionInput, GameAction

# Create game
game = KeyForge()

# Get initial frame
result = game.perform_action(ActionInput(id=GameAction.RESET))
print(f"State: {result.state}")

# Move right
result = game.perform_action(ActionInput(id=GameAction.ACTION4))

# Move down
result = game.perform_action(ActionInput(id=GameAction.ACTION2))

# Check game state after each action
print(f"State: {result.state}, Levels completed: {result.levels_completed}")
```

### Automated Test Ideas
```python
def test_fragment_collection():
    """Player should merge with fragment on collision."""
    game = KeyForge()
    # Move player to fragment position
    # Assert player sprite has grown

def test_wall_collision():
    """Player should not pass through walls."""
    game = KeyForge()
    # Try to move into wall
    # Assert player position unchanged

def test_win_condition():
    """Matching key shape at door should win."""
    game = KeyForge()
    # Collect all fragments
    # Move to door
    # Assert game state is WIN or level advanced
```

---

## 8. Extension Ideas (After Basic Version Works)

Once the basic game works, consider these enhancements:

1. **Move Counter UI** - Display moves taken using `ToggleableUserDisplay`
2. **Wrong Key Feedback** - Flash red if touching door without complete key
3. **Timed Levels** - Add urgency with a step limit
4. **Color Mixing** - Fragments of different colors must be collected in order
5. **Locked Passages** - Mini-keys unlock gates within the maze
6. **Enemies** - Moving obstacles that reset the level if touched

---

## 9. Color Palette Reference

The 16-color palette for designing sprites:

| Index | Color | Suggested Use |
|-------|-------|---------------|
| 0 | Black | Background |
| 1 | Blue (dark) | - |
| 2 | Red | Danger/enemies |
| 3 | Cyan | Letterbox |
| 4 | Yellow | Key fragments |
| 5 | Gray | Walls |
| 6 | Green | - |
| 7 | White | - |
| 8 | Orange | - |
| 9 | Blue (light) | Player |
| 10 | Pink | - |
| 11 | Teal | - |
| 12 | Purple | - |
| 13 | Lime | - |
| 14 | Maroon | - |
| 15 | Navy | - |
| -1 | Transparent | Empty space |

---

## 10. File Template

Here's the skeleton to get started:

```python
"""Key Forge: Collect key fragments in a maze to unlock the door."""

import numpy as np

from arcengine import (
    ARCBaseGame,
    BlockingMode,
    Camera,
    GameAction,
    InteractionMode,
    Level,
    Sprite,
)

# =============================================================================
# SPRITES
# =============================================================================

sprites = {
    "player": Sprite(
        pixels=[[9]],
        name="player",
        blocking=BlockingMode.BOUNDING_BOX,
        interaction=InteractionMode.TANGIBLE,
        tags=["player"],
    ),
    # TODO: Add fragment sprites
    # TODO: Add key_complete sprite (door target)
    # TODO: Add maze sprites
}

# =============================================================================
# LEVELS
# =============================================================================

levels = [
    # Level 1
    Level(
        sprites=[
            # TODO: Add sprites with positions
        ],
        grid_size=(8, 8),
    ),
]

# =============================================================================
# GAME CLASS
# =============================================================================

BACKGROUND_COLOR = 0
PADDING_COLOR = 3


class KeyForge(ARCBaseGame):
    """Navigate maze, collect key fragments, unlock the door."""

    _player: Sprite
    _door: Sprite

    def __init__(self) -> None:
        camera = Camera(background=BACKGROUND_COLOR, letter_box=PADDING_COLOR)
        super().__init__(game_id="key_forge", levels=levels, camera=camera)

    def on_set_level(self, level: Level) -> None:
        self._player = level.get_sprites_by_name("player")[0]
        self._door = level.get_sprites_by_tag("door")[0]

    def step(self) -> None:
        # TODO: Implement game logic
        # 1. Handle movement (copy from simple_maze)
        # 2. Handle fragment collection (adapt from merge)
        # 3. Check win condition
        self.complete_action()
```

---

## Summary

**Key Forge** combines:
- The satisfying navigation of **simple_maze**
- The creative assembly mechanic of **merge**

It's approachable because:
- Builds directly on patterns from both example games
- Clear, visual feedback (watch your key grow!)
- No lose condition reduces frustration
- Each level teaches one new concept

Good luck building it!
