# ARCEngine Game Ideas: Deep Dive

A collection of original game concepts based on a thorough analysis of ARCEngine's capabilities beyond the simple examples.

---

## Hidden Engine Capabilities

The simple examples (`simple_maze.py`, `merge.py`) only scratch the surface. Deeper analysis of `complex_maze.py` and `merge_detach.py` reveals powerful features:

### Movement & World Manipulation
| Feature | How It Works | Example |
|---------|--------------|---------|
| **Moving the world** | The maze sprite itself can be moved, not just the player | `sprite.move(dx, dy)` on maze |
| **Push chains** | Push block A into block B, both get destroyed | `InteractionMode.REMOVED` |
| **Level metadata** | Store custom data per level | `Level(data={"move_maze": True})` |

### Sprite Transformation
| Feature | How It Works | Example |
|---------|--------------|---------|
| **Scale down** | Negative scale shrinks sprites | `set_scale(-1)` = half size |
| **Incremental scaling** | Smooth step-by-step size changes | `adjust_scale(delta)` |
| **Rotation** | 90-degree increments | `set_rotation(90)`, `rotate(90)` |
| **Mirroring** | Flip horizontally/vertically | `set_mirror_lr(True)` |

### Visibility & Collision Modes
| Mode | Visible? | Collidable? | Use Case |
|------|----------|-------------|----------|
| `TANGIBLE` | Yes | Yes | Normal objects |
| `INTANGIBLE` | Yes | No | Ghosts, visual effects |
| `INVISIBLE` | No | Yes | Hidden walls, traps |
| `REMOVED` | No | No | Deleted objects |

### Merge & Detach System
- **Merge**: Combine two sprites into one (`sprite1.merge(sprite2)`)
- **Detach**: Track merged components, restore them later (see `merge_detach.py`)
- **Pixel comparison**: Check if player shape matches target (`get_pixels_at_sprite()`)

### Camera & UI
- Camera viewport can be smaller than 64x64 (auto-scales with letterboxing)
- Custom UI overlays via `RenderableUserDisplay` subclass
- `ToggleableUserDisplay` for state-based UI elements

---

## Game Concepts

### 1. World Shifter

**Core Mechanic:** You don't move. The world moves around you.

**How it works:**
- Player is fixed at center of screen
- Pushing against edges shifts the entire maze in that direction
- Exit, enemies, and hazards all move with the world
- Goal: maneuver the exit to reach YOU

**Why it's interesting:**
- Inverts the fundamental assumption of maze games
- Creates unique spatial reasoning challenges
- Uses the "moving maze" feature from `complex_maze.py`

**Implementation notes:**
- Use level metadata to define shift boundaries
- All sprites except player tagged as "moveable"
- On player input, move all moveable sprites in opposite direction
- Collision still works normally

```python
# Pseudocode
def step(self):
    if self.action.id == GameAction.ACTION1:  # "Up"
        # Move world DOWN (opposite)
        for sprite in self.current_level.get_sprites_by_tag("moveable"):
            sprite.move(0, 1)
```

---

### 2. The Great Unbuilding

**Core Mechanic:** Start big, strategically disassemble yourself to navigate.

**How it works:**
- Player begins as a large merged "ship" made of many pieces
- Passages require specific shapes/sizes to pass through
- Use ACTION5 to detach pieces - they become permanent obstacles
- Reach the exit before stripping yourself too thin
- Some pieces are "essential" - lose them and you lose

**Why it's interesting:**
- Flips the merge mechanic (start merged, end minimal)
- Detached pieces create emergent level design
- Resource management + spatial puzzle
- Uses the detach system from `merge_detach.py`

**Implementation notes:**
- Track which sprites were merged in order
- Detached sprites placed at current position, become TANGIBLE obstacles
- Win condition: reach exit with "core" piece still attached
- Lose condition: core piece detached

```python
# Pseudocode
def detach_last(self):
    if len(self._attached) <= 1:
        self.lose()  # Can't detach core
        return
    piece = self._attached.pop()
    piece.set_position(self._player.x, self._player.y)
    self.current_level.add_sprite(piece)
    self._rebuild_player()
```

---

### 3. Phantom Steps

**Core Mechanic:** Leave ghost copies that block enemies but not you.

**How it works:**
- Every N moves, a ghost (INTANGIBLE copy) appears at your position
- Ghosts are visible but you pass through them
- Enemies collide with ghosts (they're TANGIBLE to enemies)
- Use your trail of ghosts to herd enemies away from the exit
- Optional: ghosts fade after M turns

**Why it's interesting:**
- Your history becomes your tool
- Creates emergent "wall building" through movement
- Time-based puzzle element
- Uses `InteractionMode.INTANGIBLE` creatively

**Implementation notes:**
- Clone player sprite every N steps
- Set clone to `InteractionMode.INTANGIBLE` for player collision checks
- Enemies use separate collision logic that treats ghosts as TANGIBLE
- Tag ghosts for easy querying

```python
# Pseudocode
def step(self):
    self._move_count += 1
    if self._move_count % 3 == 0:
        ghost = self._player.clone("ghost")
        ghost.set_interaction(InteractionMode.INTANGIBLE)
        ghost.tags.append("ghost")
        self.current_level.add_sprite(ghost)
```

---

### 4. Scale Maze

**Core Mechanic:** Your size is your key.

**How it works:**
- Collect "shrink" and "grow" pickups scattered in maze
- Shrink (scale -1, -2) to fit through narrow cracks
- Grow (scale 2, 3) to push heavy blocks or block paths
- Some doors only open when you're a specific size
- Some enemies only see you at certain sizes

**Why it's interesting:**
- Adds inventory/resource layer to navigation
- Size affects both what you can DO and where you can GO
- Creates Metroidvania-like gating without items
- Uses the full scale system (positive and negative)

**Implementation notes:**
- `adjust_scale(1)` to grow, `adjust_scale(-1)` to shrink
- Size-gated passages use pixel-perfect collision
- Store size-change pickups or make them single-use
- UI shows current scale

```python
# Pseudocode
def step(self):
    collisions = self.try_move("player", dx, dy)
    for sprite in collisions:
        if "shrink" in sprite.tags:
            self._player.adjust_scale(-1)
            sprite.set_interaction(InteractionMode.REMOVED)
        elif "grow" in sprite.tags:
            self._player.adjust_scale(1)
            sprite.set_interaction(InteractionMode.REMOVED)
```

---

### 5. Split Mind

**Core Mechanic:** Control multiple pieces that all move together.

**How it works:**
- You start as one piece, can split into 2-4 pieces
- ALL pieces move in the same direction simultaneously
- Each piece must reach its own colored target
- Walls affect pieces independently (one might be blocked while others move)
- Merge back together to pass through narrow sections

**Why it's interesting:**
- Creates parallel puzzle-solving
- "What works for one may trap another"
- Unique coordination challenge
- Combines merge/split with multi-body physics

**Implementation notes:**
- Track list of active player pieces
- On input, try_move each piece independently
- Win when all pieces on their targets simultaneously
- Split/merge via ACTION5/ACTION6

```python
# Pseudocode
def step(self):
    dx, dy = self._get_direction()
    for piece in self._player_pieces:
        self.try_move_sprite(piece, dx, dy)  # Each piece moves independently

    if self._all_on_targets():
        self.next_level()
```

---

### 6. Invisible Labyrinth

**Core Mechanic:** The real walls are hidden.

**How it works:**
- Visible maze has openings that look passable
- Invisible walls (`InteractionMode.INVISIBLE`) block the true path
- Player must discover real path through trial and memory
- Optional: collectibles reveal nearby invisible walls temporarily
- Optional: "sonar" ability shows walls in radius for one turn

**Why it's interesting:**
- Memory and mapping puzzle
- Tension between what you see and what's real
- Discovery-based gameplay
- Uses INVISIBLE interaction mode

**Implementation notes:**
- Layer visible "fake" maze (INTANGIBLE) over invisible "real" maze
- Player collides with invisible walls normally
- Reveal pickups temporarily set walls to TANGIBLE
- Could track which walls player has discovered

---

### 7. Chain Reaction

**Core Mechanic:** Push blocks to destroy matching pairs.

**How it works:**
- Maze filled with colored blocks
- Push block into matching color = both destroyed
- Clear all blocks to open the exit
- Some blocks are fixed, some pushable
- Limited moves optional

**Why it's interesting:**
- Puzzle game like Puzznic/Same Game meets Sokoban
- Chain planning required
- Uses the block destruction from `complex_maze.py`
- Clear win state, easy to understand

**Implementation notes:**
- Blocks tagged by color
- On push collision, check if colors match
- Match = both `InteractionMode.REMOVED`
- Win when no colored blocks remain

```python
# Pseudocode
def _push_block(self, block, dx, dy):
    collisions = self.try_move_sprite(block, dx, dy)
    for other in collisions:
        if block.tags[0] == other.tags[0]:  # Same color
            block.set_interaction(InteractionMode.REMOVED)
            other.set_interaction(InteractionMode.REMOVED)
```

---

## Recommendations

**Easiest to implement (junior-friendly):**
1. **Chain Reaction** - Builds directly on `complex_maze.py` push mechanics
2. **Scale Maze** - Simple pickup-based mechanic, clear cause/effect

**Most original:**
1. **The Great Unbuilding** - Inverts merge mechanic, unique puzzle type
2. **Split Mind** - Multi-body control is rare in puzzle games

**Best combination of originality + feasibility:**
1. **World Shifter** - Simple to implement, mind-bending to play
2. **Phantom Steps** - Medium complexity, very unique mechanic

---

## Implementation Priority

If building one game to showcase ARCEngine's unique capabilities, I'd recommend:

1. **The Great Unbuilding** - Shows off merge/detach, creates emergent gameplay
2. **Split Mind** - Demonstrates multi-sprite control, unique puzzle design
3. **World Shifter** - Proves the engine can do unconventional mechanics

Each of these would result in a game that couldn't easily exist in other engines and demonstrates ARCEngine's flexibility.

---

## Technical Reference

### Key Methods for These Games

```python
# Merge sprites
new_sprite = sprite1.merge(sprite2)

# Change interaction mode
sprite.set_interaction(InteractionMode.REMOVED)    # Delete
sprite.set_interaction(InteractionMode.INVISIBLE)  # Hidden wall
sprite.set_interaction(InteractionMode.INTANGIBLE) # Ghost

# Scale manipulation
sprite.set_scale(2)      # Double size
sprite.set_scale(-1)     # Half size
sprite.adjust_scale(1)   # Grow one step
sprite.adjust_scale(-1)  # Shrink one step

# Level data
level = Level(sprites=[...], data={"custom_key": "value"})
value = self.current_level.get_data("custom_key")

# Pixel comparison for win conditions
player_pixels = self.get_pixels_at_sprite(self._player)
target_pixels = self.get_pixels_at_sprite(self._target)
if np.array_equal(player_pixels, target_pixels):
    self.win()

# Move world instead of player
for sprite in self.current_level.get_sprites_by_tag("world"):
    sprite.move(-dx, -dy)  # Opposite direction
```

---

*Document prepared for future development. Pick a concept, prototype it, and iterate.*
