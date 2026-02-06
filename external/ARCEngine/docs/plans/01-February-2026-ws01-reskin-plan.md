# 01-February-2026 WS01 Reskin Plan

## Goal
Create WS01 as a visually distinct variant of LS20 that looks different at first glance but uses identical game mechanics. The differentiation comes from color palette changes and level geometry transformation (flip/rotate).

## Current State

### Completed
1. **Color remapping** - All 10 colors in LS20 have been mapped to different palette indices in WS01:

| Original (LS20) | New (WS01) | Description |
|-----------------|------------|-------------|
| 0 (White) | 9 (Blue) | |
| 1 (Light Gray) | 7 (Light Pink) | |
| 3 (Dark Gray) | 15 (Purple) | Background/padding |
| 4 (Darker Gray) | 13 (Dark Red) | |
| 5 (Black) | 2 (Gray) | Borders/outlines |
| 8 (Red) | 14 (Green) | |
| 9 (Blue) | 6 (Pink) | |
| 11 (Yellow) | 12 (Orange) | |
| 12 (Orange) | 8 (Red) | |
| 14 (Green) | 11 (Yellow) | |

2. **Class/ID renamed** - `Ls20` → `Ws01`, game ID `"ls20"` → `"ws01"`

3. **Bug fixes** - Added `_get_rotation_index()` and `_get_color_index()` helpers to handle unexpected metadata values gracefully instead of crashing

4. **Registry updated** - `games/__init__.py` now includes all 5 official games

### Not Yet Done
1. **Level geometry transformation** - Flip or rotate all level layouts so the maze shapes look different from LS20

## Scope

### In Scope
- Transform all 7 level geometries in WS01 via flip or rotation
- Adjust sprite rotations to match the transformation
- Update any level metadata that contains position data
- Verify game still plays correctly after transformation

### Out of Scope
- Changing game mechanics
- Adding new levels
- Modifying sprite artwork beyond the color remap already done

## Architecture

### Files to Modify
- `games/official/ws01.py` - Apply geometry transformation to all `set_position(x, y)` calls and `set_rotation()` values

### Coordinate System
- Grid is 64×64 pixels, coordinates 0-63
- Origin (0,0) is top-left
- Sprites have varying dimensions (must account for width/height when transforming)

### Transformation Options

**Option A: Horizontal Flip (Mirror Left-Right)**
- Formula: `new_x = 63 - x - (sprite_width - 1)`
- Rotation adjustment: 90° ↔ 270° swap, 0° and 180° unchanged
- Pros: Simple conceptually, maze looks mirrored
- Cons: Need to know each sprite's width

**Option B: Vertical Flip (Mirror Top-Bottom)**
- Formula: `new_y = 63 - y - (sprite_height - 1)`
- Rotation adjustment: 0° ↔ 180° swap, 90° and 270° unchanged
- Pros: Simple conceptually
- Cons: Need to know each sprite's height

**Option C: 180° Rotation**
- Formula: `new_x = 63 - x - (sprite_width - 1)`, `new_y = 63 - y - (sprite_height - 1)`
- Rotation adjustment: Add 180° to all rotations (mod 360)
- Pros: Most visually different, rotation math is simple
- Cons: Need both width and height of every sprite

**Option D: Transpose/Rotate 90°**
- Formula: `new_x = y`, `new_y = 63 - x - (sprite_width - 1)` (or similar)
- Rotation adjustment: Add 90° or 270° to all rotations
- Pros: Very different look
- Cons: Sprites themselves may need rotation, complex

### Recommendation
**Option C (180° rotation)** is recommended because:
1. Rotation math for existing `.set_rotation()` calls is trivial (add 180)
2. Results in maximum visual difference
3. Symmetric transformation means fewer edge cases

### Implementation Approach
1. Catalog all sprite dimensions from the `sprites = {}` dictionary
2. Write a Python script to parse and transform all `set_position(x, y)` calls
3. Transform all `set_rotation(angle)` calls
4. Check for any level `data={}` fields that contain coordinates
5. Run and visually verify each level

## TODOs

1. [ ] Catalog all sprite names and their pixel dimensions from ws01.py
2. [ ] Decide on transformation type (recommend 180° rotation)
3. [ ] Write transformation script or manual edits
4. [ ] Apply transformation to all 7 levels
5. [ ] Adjust all `.set_rotation()` values
6. [ ] Check level `data={}` for any position metadata that needs transforming
7. [ ] Test game loads without errors
8. [ ] Visual verification - compare WS01 to LS20, confirm they look different
9. [ ] Playtest at least one level to confirm mechanics still work

## Open Questions

1. **Which transformation?** - Need user decision on Option A/B/C/D
2. **Level metadata** - Do any `data={}` fields in levels contain coordinates that need transforming?
3. **UI elements** - Are there any hardcoded UI positions that should stay fixed (not transform)?

## Docs/Changelog
- Update this plan with chosen transformation after decision
- No CHANGELOG entry needed until implementation complete
