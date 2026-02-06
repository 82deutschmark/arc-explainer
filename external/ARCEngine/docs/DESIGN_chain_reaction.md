# Chain Reaction: Game Design Document

**Author:** Claude Opus 4.5
**Date:** 31-January-2026
**Status:** Draft
**Version:** 0.0.1

> **Match colors. Clear the board. Escape.**

---

## 1. Game Concept

### Title
Chain Reaction

### Elevator Pitch
A **block-pushing puzzle game** (in the style of classic warehouse puzzlers like Boxxle or those "push the crate onto the target" games) where you shove colored blocks around a grid. The twist: pushing a block into another block **of the same color destroys both**. Clear all colored blocks to unlock the exit and escape each level.

> **What's Sokoban?** A 1982 Japanese puzzle game where you push boxes onto target spots in a warehouse. The term is often used generically for any "push blocks around a grid" puzzle game. Think of those levels in Zelda or Pokemon where you push boulders onto switches.

### Core Innovation
Unlike traditional Sokoban where you push boxes onto targets, Chain Reaction uses **mutual annihilation**: two matching blocks colliding means both disappear. This creates cascading possibilities and requires planning destruction sequences.

### Why It Works for ARCEngine
- **Proven mechanic**: `complex_maze.py` lines 289-301 demonstrate push-and-destroy with matching blocks
- **Clear visual language**: 16-color palette provides 8+ distinct block colors
- **Deterministic puzzles**: Same solution always works (ideal for ARC-AGI)
- **Self-contained levels**: Each level is a discrete puzzle with clear win state

### Target Experience
Players should feel:
1. Assessment (what blocks need to match?)
2. Planning (what order should I push?)
3. Execution (precise movement sequence)
4. Satisfaction (watching pairs vanish, exit unlock)

---

## 2. Core Mechanics

### 2.1 Movement

| Input | Action |
|-------|--------|
| ACTION1 (W/Up) | Move player up 1 tile |
| ACTION2 (S/Down) | Move player down 1 tile |
| ACTION3 (A/Left) | Move player left 1 tile |
| ACTION4 (D/Right) | Move player right 1 tile |
| ACTION5 (Space) | Reserved (future: undo preview) |
| ACTION7 (Z) | Undo last move |

### 2.2 Block Pushing
- Player can push **one block at a time**
- Blocks only push if destination is empty or contains a **matching block**
- Blocks cannot push other blocks (no chain pushing)
- Blocks cannot be pulled, only pushed

### 2.3 Block Matching
When a pushed block collides with another block:
1. Compare tags (both blocks have a color tag like `"red"`, `"blue"`)
2. If tags match: **both blocks are REMOVED**
3. If tags don't match: **push is blocked** (block doesn't move)

```python
# Matching logic from complex_maze.py
if sprite.name.startswith(other_sprite.name):
    sprite.set_interaction(InteractionMode.REMOVED)
    other_sprite.set_interaction(InteractionMode.REMOVED)
```

### 2.4 Win Condition
1. All colored blocks must be destroyed (no blocks with color tags remaining)
2. Exit sprite becomes **accessible** (no longer blocked)
3. Player reaches exit to complete level
4. Complete all levels to win

### 2.5 Lose Condition
- **Soft fail**: Unsolvable state (block stuck against wall with no match available)
- No "game over" - player can always reset level or undo
- Future extension: move limit for scoring

### 2.6 Fixed vs Pushable Blocks
- **Pushable blocks**: Tagged with color (e.g., `"red"`, `"blue"`) and `"pushable"`
- **Fixed obstacles**: Tagged `"fixed"` - cannot be pushed, provide maze structure

---

## 3. Visual Design

### 3.1 Color Palette Usage (ARC3)

| Element | Color Index | Color Name | Tag |
|---------|-------------|------------|-----|
| Background | 5 | Black | - |
| Walls | 2 | Gray | `"fixed"` |
| Player | 12 | Orange | `"player"` |
| Exit (locked) | 0 | White | `"exit"` |
| Exit (unlocked) | 14 | Green | `"exit"` |
| Block Red | 8 | Red | `"red"` |
| Block Blue | 9 | Blue | `"blue"` |
| Block Yellow | 11 | Yellow | `"yellow"` |
| Block Light Blue | 10 | Light Blue | `"lightblue"` |
| Block Purple | 15 | Purple | `"purple"` |
| Block Pink | 6 | Pink | `"pink"` |
| Letterbox | 4 | Darker Gray | - |

### 3.2 Block Visual Design
Each block is 2x2 pixels for visibility:
```
##
##
```

This provides:
- Clear color identification at 64x64
- Satisfying visual "chunk" when destroyed
- Distinguishable from 1x1 player

### 3.3 Grid Sizes
- **Levels 1-2**: 8x8 (tutorial, 1 color pair)
- **Levels 3-4**: 10x10 (intermediate, 2 color pairs)
- **Levels 5-6**: 12x12 (advanced, 3 color pairs)

---

## 4. Sprites Specification

### 4.1 Player Sprite
```python
"player": Sprite(
    pixels=[[8]],  # Orange 1x1
    name="player",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    layer=10,
    tags=["player"],
)
```

### 4.2 Exit Sprite (Locked)
```python
"exit_locked": Sprite(
    pixels=[
        [7, 7],
        [7, 7],
    ],  # White 2x2 - visible but blocked
    name="exit",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    layer=0,
    tags=["exit", "locked"],
)
```

### 4.3 Exit Sprite (Unlocked)
```python
"exit_unlocked": Sprite(
    pixels=[
        [6, 6],
        [6, 6],
    ],  # Green 2x2 - goal achieved!
    name="exit",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    layer=0,
    tags=["exit"],
)
```

### 4.4 Colored Blocks

**Red Block (Pair)**
```python
"block_red": Sprite(
    pixels=[
        [2, 2],
        [2, 2],
    ],
    name="block_red",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["pushable", "colored", "red"],
)
```

**Blue Block (Pair)**
```python
"block_blue": Sprite(
    pixels=[
        [9, 9],
        [9, 9],
    ],
    name="block_blue",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["pushable", "colored", "blue"],
)
```

**Yellow Block (Pair)**
```python
"block_yellow": Sprite(
    pixels=[
        [4, 4],
        [4, 4],
    ],
    name="block_yellow",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["pushable", "colored", "yellow"],
)
```

**Cyan Block (Pair)**
```python
"block_cyan": Sprite(
    pixels=[
        [3, 3],
        [3, 3],
    ],
    name="block_cyan",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["pushable", "colored", "cyan"],
)
```

**Purple Block (Pair)**
```python
"block_purple": Sprite(
    pixels=[
        [12, 12],
        [12, 12],
    ],
    name="block_purple",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["pushable", "colored", "purple"],
)
```

**Green Block (Pair)**
```python
"block_green": Sprite(
    pixels=[
        [6, 6],
        [6, 6],
    ],
    name="block_green",
    blocking=BlockingMode.BOUNDING_BOX,
    interaction=InteractionMode.TANGIBLE,
    tags=["pushable", "colored", "green"],
)
```

### 4.5 Wall Sprites

**Level 1 Walls (8x8 - Open Arena)**
```python
"walls_1": Sprite(
    pixels=[
        [5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, 5, 5, 5, 5, 5],
    ],
    name="walls_1",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,
    tags=["fixed", "walls"],
)
```

**Level 2 Walls (8x8 - Central Pillar)**
```python
"walls_2": Sprite(
    pixels=[
        [5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, 5, 5, -1, -1, 5],
        [5, -1, -1, 5, 5, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, 5, 5, 5, 5, 5],
    ],
    name="walls_2",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,
    tags=["fixed", "walls"],
)
```

**Level 3 Walls (10x10 - Corridors)**
```python
"walls_3": Sprite(
    pixels=[
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, -1, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, -1, -1, -1, -1, 5, 5, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, 5, -1, -1, -1, -1, 5],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ],
    name="walls_3",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,
    tags=["fixed", "walls"],
)
```

**Level 4 Walls (10x10 - L-Shaped)**
```python
"walls_4": Sprite(
    pixels=[
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, 5, 5, -1, -1, -1, -1, -1, 5],
        [5, -1, 5, 5, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, 5, 5, -1, 5],
        [5, -1, -1, -1, -1, -1, 5, 5, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ],
    name="walls_4",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,
    tags=["fixed", "walls"],
)
```

**Level 5 Walls (12x12 - Complex)**
```python
"walls_5": Sprite(
    pixels=[
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, -1, -1, 5, 5, -1, -1, 5, 5, 5],
        [5, -1, -1, -1, -1, 5, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ],
    name="walls_5",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,
    tags=["fixed", "walls"],
)
```

**Level 6 Walls (12x12 - Master)**
```python
"walls_6": Sprite(
    pixels=[
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        [5, -1, -1, 5, -1, -1, -1, -1, 5, -1, -1, 5],
        [5, -1, -1, 5, -1, -1, -1, -1, 5, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, 5, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, 5, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, 5, 5, -1, -1, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, -1, -1, 5, -1, -1, -1, -1, 5, -1, -1, 5],
        [5, -1, -1, 5, -1, -1, -1, -1, 5, -1, -1, 5],
        [5, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5],
        [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    ],
    name="walls_6",
    blocking=BlockingMode.PIXEL_PERFECT,
    interaction=InteractionMode.TANGIBLE,
    layer=-1,
    tags=["fixed", "walls"],
)
```

---

## 5. Level Design

### Level Design Philosophy
1. **Introduce one concept at a time**
2. **Blocks always come in pairs** (matching required)
3. **Exit position visible from start** (goal clarity)
4. **Multiple solutions discouraged** (puzzle purity)
5. **Trapped states possible** (adds consequence)

### Level Specifications

#### Level 1: First Match (8x8)
**Goal**: Teach basic push-and-match
**Setup**:
- One pair of red blocks
- Open arena with minimal obstacles
- Exit visible and close

```
########
#      #
# R    #
#      #
#    R #
#      #
#  P E #
########

P = Player (1,6)
R = Red blocks (2,2) and (5,4)
E = Exit locked (5,6)
```

**What player learns**: Push one red into the other, both vanish, reach exit.

#### Level 2: Walls Matter (8x8)
**Goal**: Teach that walls affect pushing
**Setup**:
- One pair of blue blocks
- Central pillar creates routing challenge
- Must push around obstacle

```
########
# B    #
#      #
#  ##  #
#  ##  #
#      #
#    B #
#P   E #
########
```

**What player learns**: Can't push through walls, must position carefully.

#### Level 3: Two Colors (10x10)
**Goal**: Introduce multiple color pairs
**Setup**:
- One pair of red blocks
- One pair of blue blocks
- Must match colors correctly (wrong push = stuck)

```
##########
#   #    #
#R  #   B#
#        #
####  ####
#        #
#        #
#B  # R  #
#P  #   E#
##########
```

**What player learns**: Color matching matters, order matters.

#### Level 4: Order Dependency (10x10)
**Goal**: Teach that solving order matters
**Setup**:
- Two color pairs positioned so one blocks access to another
- Must clear in specific order

```
##########
#        #
# YY     #
# YY  CC #
#        #
#     CC #
# YY     #
# YY     #
#P      E#
##########
```

**What player learns**: Sometimes you must match in a specific sequence.

#### Level 5: The Gauntlet (12x12)
**Goal**: Complex multi-pair puzzle
**Setup**:
- Three color pairs (red, blue, yellow)
- Pillars create lanes and dead-ends
- Requires planning full solution before starting

```
############
#    #     #
#    #     #
# R     B  #
#          #
###  ##  ###
#          #
#  Y    Y  #
#          #
# B  # R   #
#P   #    E#
############
```

**What player learns**: Full puzzle planning required.

#### Level 6: Master Chain (12x12)
**Goal**: Final challenge
**Setup**:
- Three color pairs with tight positioning
- Multiple pillars create complex routing
- Near-optimal solution required

```
############
#  #    #  #
#  #    #  #
# R  CC  B #
#    ##    #
#    ##    #
#    ##    #
# B  YY  R #
#  #    #  #
#  #    #  #
#P        E#
############
```

**What player learns**: Mastery of all mechanics combined.

---

## 6. Game Class Structure

### 6.1 Class Overview

```python
class ChainReaction(ARCBaseGame):
    """Push colored blocks into matching pairs to clear the board."""

    _player: Sprite
    _exit: Sprite

    def __init__(self) -> None:
        """Initialize game with camera and levels."""
        ...

    def on_set_level(self, level: Level) -> None:
        """Cache references and set initial exit state."""
        ...

    def step(self) -> None:
        """Process one game step."""
        ...

    def _try_push(self, dx: int, dy: int) -> None:
        """Attempt to push a block in the given direction."""
        ...

    def _check_match(self, pushed: Sprite, target: Sprite) -> bool:
        """Check if two blocks match (same color tag)."""
        ...

    def _destroy_pair(self, block1: Sprite, block2: Sprite) -> None:
        """Remove both blocks from the level."""
        ...

    def _count_remaining_blocks(self) -> int:
        """Count colored blocks still on the board."""
        ...

    def _update_exit_state(self) -> None:
        """Unlock exit if all blocks are cleared."""
        ...
```

### 6.2 Core Logic Flow

```python
def step(self) -> None:
    """Process one game step."""

    # 1. Determine movement direction
    dx, dy = 0, 0
    if self.action.id == GameAction.ACTION1:
        dy = -1  # Up
    elif self.action.id == GameAction.ACTION2:
        dy = 1   # Down
    elif self.action.id == GameAction.ACTION3:
        dx = -1  # Left
    elif self.action.id == GameAction.ACTION4:
        dx = 1   # Right

    # 2. Try to move player
    if dx != 0 or dy != 0:
        collisions = self.try_move("player", dx, dy)

        # 3. Handle block pushing
        if collisions:
            for sprite in collisions:
                if "pushable" in sprite.tags:
                    self._try_push_block(sprite, dx, dy)

        # 4. Check if player reached exit
        if collisions and self._is_exit_unlocked():
            for sprite in collisions:
                if "exit" in sprite.tags:
                    self._handle_level_complete()

    # 5. Update exit visual state
    self._update_exit_state()

    # 6. Complete the action
    self.complete_action()
```

### 6.3 Block Pushing Logic

```python
def _try_push_block(self, block: Sprite, dx: int, dy: int) -> None:
    """Attempt to push a block, handling matches."""

    # Try to move the block
    block_collisions = self.try_move_sprite(block, dx, dy)

    if block_collisions:
        # Block hit something
        for other in block_collisions:
            if self._check_match(block, other):
                # Colors match! Destroy both
                self._destroy_pair(block, other)
                # Player can now move into the space
                self.try_move("player", dx, dy)
                return

        # No match - block couldn't move (hit wall or wrong color)
        # Player stays in place (already handled by try_move)
    else:
        # Block moved successfully, player follows
        self.try_move("player", dx, dy)
```

### 6.4 Color Matching

```python
def _check_match(self, block1: Sprite, block2: Sprite) -> bool:
    """Check if two blocks have the same color tag."""
    if "colored" not in block2.tags:
        return False

    # Find color tag (not 'pushable', 'colored', etc.)
    color_tags = {"red", "blue", "yellow", "cyan", "purple", "green"}

    block1_color = next((t for t in block1.tags if t in color_tags), None)
    block2_color = next((t for t in block2.tags if t in color_tags), None)

    return block1_color is not None and block1_color == block2_color
```

### 6.5 Block Destruction

```python
def _destroy_pair(self, block1: Sprite, block2: Sprite) -> None:
    """Remove both blocks from play."""
    block1.set_interaction(InteractionMode.REMOVED)
    block2.set_interaction(InteractionMode.REMOVED)
```

### 6.6 Exit State Management

```python
def _count_remaining_blocks(self) -> int:
    """Count how many colored blocks remain."""
    colored = self.current_level.get_sprites_by_tag("colored")
    return sum(1 for s in colored if s.interaction != InteractionMode.REMOVED)

def _is_exit_unlocked(self) -> bool:
    """Check if exit should be unlocked."""
    return self._count_remaining_blocks() == 0

def _update_exit_state(self) -> None:
    """Update exit sprite appearance based on state."""
    if self._is_exit_unlocked():
        # Change exit to unlocked appearance
        self._exit.pixels = [[6, 6], [6, 6]]  # Green
        if "locked" in self._exit.tags:
            self._exit.tags.remove("locked")
```

---

## 7. Implementation Checklist

### Phase 1: Project Setup
- [ ] Create `games/chain_reaction/` directory
- [ ] Create `games/chain_reaction/__init__.py`

### Phase 2: Sprites
- [ ] Create `games/chain_reaction/sprites.py`
- [ ] Define player sprite
- [ ] Define exit sprites (locked and unlocked)
- [ ] Define all colored block sprites (6 colors)
- [ ] Define wall sprites for all 6 levels

### Phase 3: Levels
- [ ] Create `games/chain_reaction/levels.py`
- [ ] Define Level 1 (one red pair)
- [ ] Define Level 2 (one blue pair with pillar)
- [ ] Define Level 3 (two color pairs)
- [ ] Define Level 4 (order dependency)
- [ ] Define Level 5 (three color pairs)
- [ ] Define Level 6 (master challenge)

### Phase 4: Game Logic
- [ ] Create `games/chain_reaction/game.py`
- [ ] Implement `__init__` with camera setup
- [ ] Implement `on_set_level` to cache references
- [ ] Implement player movement in `step()`
- [ ] Implement `_try_push_block()` for block pushing
- [ ] Implement `_check_match()` for color comparison
- [ ] Implement `_destroy_pair()` for block removal
- [ ] Implement `_count_remaining_blocks()` for win check
- [ ] Implement `_update_exit_state()` for visual feedback
- [ ] Implement exit collision and level completion

### Phase 5: Registry
- [ ] Register ChainReaction in `games/__init__.py`

### Phase 6: Testing
- [ ] Create `tests/games/test_chain_reaction.py`
- [ ] Test player movement (basic)
- [ ] Test block pushing (block moves when pushed)
- [ ] Test color matching (same colors destroy)
- [ ] Test non-matching (different colors block)
- [ ] Test exit locking (can't exit until blocks cleared)
- [ ] Test exit unlocking (clears when all blocks gone)
- [ ] Test full playthrough of all levels

### Phase 7: Polish
- [ ] Playtest all levels for solvability
- [ ] Verify no unsolvable starting positions
- [ ] Check visual clarity of all block colors

---

## 8. Testing Guide

### 8.1 Manual Testing

```python
from games import get_game
from arcengine import ActionInput, GameAction

# Create game
game = get_game("chain_reaction")

# Get initial frame
frames = list(game.perform_action(ActionInput(id=GameAction.RESET)))
print(f"Initial state: {frames[-1].state}")

# Move player toward a block
frames = list(game.perform_action(ActionInput(id=GameAction.ACTION1)))  # Up

# Push block into matching block
# ...observe both blocks disappear

# Check if exit is unlocked
remaining = len(game.current_level.get_sprites_by_tag("colored"))
print(f"Blocks remaining: {remaining}")
```

### 8.2 Automated Test Cases

```python
def test_block_push():
    """Player can push a block into empty space."""
    game = ChainReaction()
    # Setup: player adjacent to block, space beyond
    # Push block
    # Assert block moved

def test_color_match_destroys_both():
    """Matching color blocks destroy each other."""
    game = ChainReaction()
    # Setup: player, red block, another red block in line
    # Push first red into second red
    # Assert both have InteractionMode.REMOVED

def test_color_mismatch_blocks():
    """Non-matching colors don't destroy."""
    game = ChainReaction()
    # Setup: player, red block, blue block in line
    # Push red toward blue
    # Assert neither moved/destroyed

def test_exit_locked_until_cleared():
    """Can't reach exit while blocks remain."""
    game = ChainReaction()
    # Don't clear any blocks
    # Try to reach exit
    # Assert level not complete

def test_exit_unlocks_when_cleared():
    """Exit accessible after all blocks cleared."""
    game = ChainReaction()
    # Clear all blocks
    # Move to exit
    # Assert level complete (or game won)
```

---

## 9. Extension Ideas (Post-MVP)

### 9.1 Move Counter
Track moves per level, display in UI, show par for optimal solution.

### 9.2 Undo System
Full undo stack (ACTION7) to recover from mistakes without full reset.

### 9.3 Ice Blocks
Blocks that slide until hitting something (momentum puzzles).

### 9.4 Bomb Blocks
When matched, destroys adjacent blocks too (chain reaction!).

### 9.5 Teleport Pairs
Push block into teleporter, appears at paired location.

### 9.6 Color Changers
Floor tiles that change a block's color when it passes over.

---

## 10. File Structure Summary

```
games/
├── __init__.py                # Registry
└── chain_reaction/
    ├── __init__.py            # Exports ChainReaction, GAME_ID, VERSION
    ├── sprites.py             # SPRITES dict (player, exit, blocks, walls)
    ├── levels.py              # LEVELS list (6 levels)
    └── game.py                # ChainReaction class with game logic
```

---

## Summary

**Chain Reaction** is a Sokoban-style puzzle game with a twist: matching colored blocks destroy each other. Clear all pairs to unlock the exit and escape.

**Key implementation points:**
1. Blocks tagged with colors; matching colors on collision triggers REMOVED
2. Exit is locked (white) until all colored blocks cleared, then unlocked (green)
3. Push logic: player pushes block, if block hits matching block, both destroyed
4. Level design ensures at least one solution exists
5. No chain-pushing (one block at a time)

**Estimated implementation effort:** 200-250 lines of code across 4 files.
