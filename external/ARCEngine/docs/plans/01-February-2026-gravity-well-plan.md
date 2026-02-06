# Gravity Well: Game Design & Implementation Plan

**Author:** Claude Opus 4.5
**Date:** 01-February-2026
**Status:** Planning

> **You control gravity itself. Everything falls together.**

---

## Scope

### In Scope
- New puzzle game based on ls20.py structure (16x16 grid scaled to 64x64)
- Gravity-based mechanics where all loose objects move simultaneously
- Collector well that captures orbs
- Two orb types: light (slides until blocked) and heavy (slides 1 tile)
- Cycling rim border from World Shifter for visual feedback
- 6 levels of increasing difficulty
- Deep ocean color scheme (distinct from ls20 and World Shifter)

### Out of Scope
- Click-to-place mechanics (ACTION6)
- Undo functionality (may add later)
- Sound or animation beyond basic physics simulation
- Hazard zones (simplified for MVP)

---

## Architecture

### File Structure
Single-file pattern following World Shifter v0.03:
```
games/
└── gravity_well/
    ├── __init__.py      # Exports GravityWell, GAME_ID, VERSION
    └── game.py          # Complete implementation with inline sprites/levels
```

### Modules to Reuse
- `ARCBaseGame` - base game controller
- `Camera` - viewport/rendering (16x16 with letterboxing)
- `Level` - sprite container
- `Sprite` - visual entities
- `RenderableUserDisplay` - orb counter UI (from ls20 pattern)
- `BlockingMode`, `InteractionMode`, `GameAction` - enums

### Color Palette (Deep Ocean Theme)

| Element | Index | ARC3 Color | Visual Role |
|---------|-------|------------|-------------|
| Background/Void | 5 | Black | Deep abyss |
| Platforms | 1 | Dark Gray | Coral shelves |
| Platform edges | 2 | Gray | Definition |
| Collector Well | 14 | Green | Bioluminescent goal |
| Well center | 3 | Gray-Green | Depth |
| Light Orbs | 11 | Yellow | Glowing energy |
| Heavy Orbs | 12 | Orange | Weighted energy |
| Rim primary | 9 | Blue | Pressure boundary |
| Rim secondary | 10 | Light Blue | Cycling highlight |
| UI text | 0 | White | Counter display |

---

## TODOs (Implementation Steps)

### Phase 1: Project Setup
1. Create `games/gravity_well/` directory
2. Create `games/gravity_well/__init__.py` with exports
3. Create `games/gravity_well/game.py` skeleton with header

### Phase 2: Sprites & Constants
4. Define color constants using ARC3 palette
5. Create platform sprite (5x5 solid block with border)
6. Create light orb sprite (3x3 yellow glow)
7. Create heavy orb sprite (3x3 orange with marker)
8. Create collector well sprite (5x5 with center)
9. Create rim sprite (64x64 with 2px checkered border)
10. Create player indicator sprite (optional - shows gravity direction)

### Phase 3: Level Design
11. Design Level 1 (tutorial - 2 light orbs, simple path)
12. Design Level 2 (introduce heavy orb)
13. Design Level 3 (multiple platforms, need sequence)
14. Design Level 4 (heavy orb as blocker)
15. Design Level 5 (complex multi-step)
16. Design Level 6 (master challenge)
17. Create levels list with sprite placements and data

### Phase 4: Game Logic
18. Implement `GravityWell.__init__()` with camera and UI setup
19. Implement `on_set_level()` to cache sprite references
20. Implement `step()` main loop:
    - Parse action (ACTION1-4 = gravity direction)
    - Run physics simulation until all orbs settle
    - Check collection (orbs overlapping well)
    - Check win condition (all orbs collected)
21. Implement `_simulate_gravity()` - physics per frame
22. Implement `_can_move_orb()` - collision check
23. Implement `_collect_orb()` - remove orb, update counter
24. Implement `_cycle_rim()` - visual feedback from World Shifter

### Phase 5: UI
25. Create orb counter display (collected/total)
26. Wire up `RenderableUserDisplay` to camera

### Phase 6: Testing
27. Verify game initializes without errors
28. Test each level loads correctly
29. Test gravity mechanics (all 4 directions)
30. Test light orb sliding
31. Test heavy orb single-step
32. Test collection detection
33. Test win condition triggers level advance

### Phase 7: Polish
34. Adjust level difficulty curve
35. Tune physics feel (single frame vs multi-frame)
36. Verify visual clarity at 64x64

---

## Verification Steps

1. **Import test**: `from games.gravity_well import GravityWell`
2. **Init test**: `game = GravityWell()`
3. **Reset test**: `game.perform_action(ActionInput(id=GameAction.RESET))`
4. **Action test**: Each ACTION1-4 shifts gravity correctly
5. **Win test**: Complete level 1, verify level advances
6. **Full playthrough**: Complete all 6 levels

---

## Docs/Changelog Touchpoints

- Update `CHANGELOG.md` with new game entry
- Consider adding to `docs/DESIGN_game_ideas.md` if not already listed
- No README changes needed (game discovery is automatic)

---

## Key Differences from World Shifter

| Aspect | World Shifter | Gravity Well |
|--------|---------------|--------------|
| What moves | Entire world (maze) | Only loose objects (orbs) |
| Player | Fixed crosshair at center | No visible player (you ARE gravity) |
| Goal | Bring exit TO you | Collect all orbs into well |
| Movement type | Inverse (press up, world goes down) | Direct (press down, orbs fall down) |
| Physics | Single step per action | Multi-step simulation until settled |
| Orb types | N/A | Light (slides) vs Heavy (1 step) |
| Color scheme | Blue/Orange rim, gray maze | Blue rim, yellow/orange orbs |

---

## Key Differences from ls20

| Aspect | ls20 | Gravity Well |
|--------|------|--------------|
| Grid size | 16x16 | 16x16 (same) |
| Mechanic | Cursor + matching shapes | Gravity + physics |
| Controls | Movement + rotation/color | Direction only |
| Win condition | Collect all targets | Collect all orbs |
| Visual style | Colorful tetrominos | Deep ocean theme |

---

## Risk Mitigation

1. **Physics complexity**: Start with simple "slide until blocked" - no momentum, no bouncing
2. **Level design**: Begin with obvious solutions, add complexity gradually
3. **Performance**: Limit simulation to 100 frames max per action to prevent infinite loops
4. **Edge cases**: Handle orbs at boundaries, multiple orbs colliding

---

## Approval Requested

Ready to implement this plan. The game:
- Uses proven ls20 structure (16x16 scaled)
- Incorporates World Shifter's cycling rim visual feedback
- Has completely different mechanics (gravity vs maze navigation)
- Uses distinct deep ocean color palette
- Should be implementable in ~400-500 lines of code

Proceed with implementation?
