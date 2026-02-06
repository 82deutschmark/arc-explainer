# Game Architecture and Organization Plan

**Author:** Claude Opus 4.5
**Date:** 31-January-2026
**PURPOSE:** Define architecture for organizing multiple games, supporting iteration, and enabling shareability

---

## 1. Scope

### In Scope
- Directory structure for organizing production games vs. example demos
- Game identification and versioning strategy for shareability
- Naming conventions and file organization
- Game registry/index for discovery
- Iteration workflow (how to version and evolve games)

### Out of Scope
- Network sharing implementation (API/hosting)
- Multiplayer mechanics
- Save/load game state persistence
- Analytics or telemetry

---

## 2. Current State Analysis

### Current Structure
```
ARCEngine/
├── arcengine/          # Core engine (stable)
├── examples/           # Mixed: demos + potential production games
│   ├── simple_maze.py
│   ├── complex_maze.py
│   ├── merge.py
│   ├── merge_detach.py
│   └── key_forge.py
├── docs/               # Design documents
└── tests/              # Unit tests
```

### Problems Identified
1. **Mixed purposes**: `examples/` contains both engine demos and potential production games
2. **Flat structure**: All games as single files will get crowded with 10+ games
3. **No versioning**: No way to track game iterations or maintain multiple versions
4. **No registry**: No central place to discover available games
5. **No asset separation**: Sprite data embedded in game files makes reuse difficult

---

## 3. Proposed Architecture

### 3.1 Directory Structure

```
ARCEngine/
├── arcengine/              # Core engine (unchanged)
├── examples/               # Engine capability demos ONLY
│   ├── simple_maze.py      # Basic movement demo
│   ├── merge.py            # Merge capability demo
│   └── merge_detach.py     # Merge/detach capability demo
├── games/                  # Production games (NEW)
│   ├── __init__.py         # Game registry
│   ├── world_shifter/      # Game 1
│   │   ├── __init__.py     # Exports WorldShifter class
│   │   ├── game.py         # Main game logic
│   │   ├── sprites.py      # Sprite definitions
│   │   └── levels.py       # Level definitions
│   ├── chain_reaction/     # Game 2
│   │   ├── __init__.py
│   │   ├── game.py
│   │   ├── sprites.py
│   │   └── levels.py
│   └── ...                 # Future games
├── docs/                   # Design documents
│   ├── DESIGN_world_shifter.md
│   ├── DESIGN_chain_reaction.md
│   └── ...
└── tests/
    ├── games/              # Game-specific tests (NEW)
    │   ├── test_world_shifter.py
    │   └── test_chain_reaction.py
    └── ...                 # Engine tests
```

### 3.2 Game Registry (`games/__init__.py`)

```python
"""
ARCEngine Game Registry

Provides a central place to discover and instantiate available games.
Each game is identified by a unique game_id.
"""

from typing import Type
from arcengine import ARCBaseGame

# Import all games
from games.world_shifter import WorldShifter
from games.chain_reaction import ChainReaction

# Registry: game_id -> game class
GAMES: dict[str, Type[ARCBaseGame]] = {
    "world_shifter": WorldShifter,
    "chain_reaction": ChainReaction,
}

def get_game(game_id: str) -> ARCBaseGame:
    """Instantiate a game by its ID."""
    if game_id not in GAMES:
        raise ValueError(f"Unknown game: {game_id}. Available: {list(GAMES.keys())}")
    return GAMES[game_id]()

def list_games() -> list[str]:
    """Return list of available game IDs."""
    return list(GAMES.keys())
```

### 3.3 Game Package Structure

Each game is a Python package with clear separation:

```python
# games/world_shifter/__init__.py
"""World Shifter: The world moves, not you."""
from games.world_shifter.game import WorldShifter

__all__ = ["WorldShifter"]
GAME_ID = "world_shifter"
VERSION = "1.0.0"
```

```python
# games/world_shifter/sprites.py
"""Sprite definitions for World Shifter."""
from arcengine import Sprite, BlockingMode

SPRITES = {
    "player": Sprite(...),
    "wall": Sprite(...),
    # etc.
}
```

```python
# games/world_shifter/levels.py
"""Level definitions for World Shifter."""
from arcengine import Level
from games.world_shifter.sprites import SPRITES

LEVELS = [
    Level(sprites=[...], grid_size=(8, 8)),
    # etc.
]
```

```python
# games/world_shifter/game.py
"""Main game logic for World Shifter."""
from arcengine import ARCBaseGame, Camera
from games.world_shifter.levels import LEVELS

class WorldShifter(ARCBaseGame):
    def __init__(self) -> None:
        ...
    def step(self) -> None:
        ...
```

---

## 4. Shareability Strategy

### 4.1 Game Identification

Each game has:
- **game_id**: Lowercase snake_case identifier (e.g., `"world_shifter"`)
- **VERSION**: SemVer string in `__init__.py`
- **Stable class name**: PascalCase matching game_id (e.g., `WorldShifter`)

### 4.2 Sharing Mechanics

For sharing games between users/systems:

1. **By game_id**: Users reference games by their stable ID
   ```python
   from games import get_game
   game = get_game("world_shifter")
   ```

2. **Replay sharing**: Game state is deterministic (same actions = same result)
   - Share: `(game_id, version, [list of ActionInput])`
   - Replay produces identical frames

3. **Level sharing**: Levels are data, easily serializable
   - Each level's `data` dict can store metadata
   - Levels can be exported/imported as JSON if needed

### 4.3 Version Compatibility

- **Major version change**: Breaking changes to game mechanics or level structure
- **Minor version change**: New levels, balance changes
- **Patch version change**: Bug fixes, visual polish

When sharing replays, include game version to ensure compatibility.

---

## 5. Iteration Workflow

### 5.1 Creating a New Game

1. Create design document: `docs/DESIGN_{game_name}.md`
2. Create game directory: `games/{game_name}/`
3. Create package files: `__init__.py`, `sprites.py`, `levels.py`, `game.py`
4. Register in `games/__init__.py`
5. Create tests: `tests/games/test_{game_name}.py`

### 5.2 Iterating on an Existing Game

1. **Adding levels**: Edit `levels.py`, bump minor version
2. **Changing mechanics**: Edit `game.py`, document in design doc, bump version appropriately
3. **Visual changes**: Edit `sprites.py`, bump patch version

### 5.3 Game States

Games progress through states:
- **Draft**: Active development, may have breaking changes
- **Beta**: Feature-complete, testing/balancing
- **Released**: Stable, version-tracked

Track state in the design document header.

---

## 6. Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Game directory | lowercase_snake | `world_shifter/` |
| Game class | PascalCase | `WorldShifter` |
| Game ID | lowercase_snake | `"world_shifter"` |
| Sprite keys | lowercase_snake | `"player"`, `"wall_corner"` |
| Level data keys | lowercase_snake | `"move_world"`, `"max_delta_x"` |
| Tags | lowercase_snake | `"moveable"`, `"fixed"` |

---

## 7. Migration Plan

### Phase 1: Create Structure (Now)
1. Create `games/` directory
2. Create `games/__init__.py` with registry
3. Build World Shifter as first game using new structure
4. Build Chain Reaction as second game

### Phase 2: Migrate Existing (Later, if desired)
1. Move `key_forge.py` to `games/key_forge/`
2. Keep `examples/` for pure engine demos
3. Update imports in any dependent code

### Phase 3: Enhanced Features (Future)
1. Add JSON export/import for levels
2. Add replay serialization
3. Add game metadata (description, difficulty, author)

---

## 8. TODOs (Ordered Steps)

- [x] Document architecture plan (this document)
- [ ] Create `games/` directory structure
- [ ] Create `games/__init__.py` with registry
- [ ] Write World Shifter design document
- [ ] Write Chain Reaction design document
- [ ] **PAUSE for review**
- [ ] Implement World Shifter using new structure
- [ ] Implement Chain Reaction using new structure
- [ ] Add tests for both games
- [ ] Update main README with game discovery info

---

## 9. Docs/Changelog Touchpoints

When implementing:
- Update `README.md` to document game discovery (`games/` package)
- Create `games/README.md` explaining structure
- Each game's design doc serves as its documentation
- No CHANGELOG updates needed (new feature, not behavior change to existing code)

---

## 10. Decision Rationale

### Why packages instead of single files?

**Pros of packages:**
- Clear separation of concerns (sprites, levels, logic)
- Easier to navigate when games have 5+ levels
- Enables sprite reuse between games
- Supports future expansion (animations, sounds, etc.)
- Better testability

**Cons:**
- More files to manage
- Slightly more boilerplate

**Decision**: Use packages. The benefits outweigh the overhead, especially for games expected to have multiple levels and iterate over time.

### Why a registry?

- Enables dynamic game discovery
- Single source of truth for available games
- Simplifies integration with any future UI/API
- Makes it trivial to add new games (one import, one dict entry)

### Why keep examples/ separate?

- `examples/` demonstrates engine features (educational)
- `games/` contains polished, playable games (production)
- Clear distinction prevents confusion about what's a "real" game

---

## Summary

This architecture provides:
1. **Shareability**: Stable game_ids, deterministic replay, version tracking
2. **Multi-game support**: Clean directory structure, registry for discovery
3. **Iteration support**: Separated concerns, versioning, clear workflow

The structure scales from 2 games to 50+ without becoming unwieldy.
