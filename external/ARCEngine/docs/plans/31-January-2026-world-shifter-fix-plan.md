# 31-January-2026-world-shifter-fix-plan.md

## Goal
Fix World Shifter game by cloning the working `complex_maze.py` pattern and implementing proper 50x50+ levels with a dynamic checkered rim mechanic.

## Current Problems
1. **Tiny levels** - Current mazes are only 10-14 pixels, should fill most of 64x64
2. **Boring design** - Just squares, no creative shapes
3. **Missing checkered rim** - User wants a multi-colored checkered border that changes on each move
4. **Over-engineered architecture** - Split across 4 files when official games use single-file pattern

## Scope

### In Scope
- Consolidate into single-file pattern like `complex_maze.py`
- Create large 50x50 playable area mazes
- Add checkered rim that cycles colors on movement
- Keep inverse movement core mechanic (world moves, not player)
- 3-4 levels with interesting maze designs

### Out of Scope
- Energy/move tracking (simplify for now)
- Complex multi-layer movement (simplify to just rim + maze)

## Architecture

### Files to Modify
- `c:\Projects\ARCEngine\games\world_shifter\game.py` - Complete rewrite
- `c:\Projects\ARCEngine\games\world_shifter\sprites.py` - Delete (inline)
- `c:\Projects\ARCEngine\games\world_shifter\levels.py` - Delete (inline)
- `c:\Projects\ARCEngine\games\world_shifter\__init__.py` - Update exports

### Pattern to Clone
Follow `complex_maze.py`:
- `sprites = {}` dict at top
- `levels = []` list 
- Single game class with `step()` and `on_set_level()`

### Rim Mechanic
- 2-pixel wide checkered border around entire 64x64 canvas
- Alternating colors (e.g., 9/10 blue, 11/12 orange)
- On each player move, rim colors rotate/shift
- Uses `ToggleableUserDisplay` or direct pixel manipulation

## TODOs

1. [x] Read existing games to understand patterns
2. [ ] Create large 50x50 maze sprites (procedural or hand-designed)
3. [ ] Implement checkered rim sprites
4. [ ] Consolidate game.py with all sprites/levels inline
5. [ ] Implement rim color cycling on movement
6. [ ] Update __init__.py exports
7. [ ] Delete sprites.py and levels.py
8. [ ] Test the game runs

## Docs/Changelog
- Update `docs/DESIGN_world_shifter.md` with new architecture
- Add CHANGELOG entry for v0.03
