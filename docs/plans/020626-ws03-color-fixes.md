# 020626-ws03-color-fixes

## Objective
Fix systemic color and rendering bugs in WS03 game identified by comparing against LS20 reference.
There is never a background color.
## Issues Found & Fixed

### 1. White Boxes (BACKGROUND_COLOR/PADDING_COLOR)
- **Root cause**: `BACKGROUND_COLOR = 0` (White) instead of a dark color
- **Fix**: Changed to `5` (Black) at `ws03.py:42-43`
- **LS20 reference**: Uses `3` (Dark Gray)

### 2. mgu Sprite (L-shaped frame) - 3 bugs in one sprite
- **Color bug**: Body used `0` (White) instead of `5` (Black) - visible as white bars
- **Row count bug**: Left bar had `*24` (24 rows) instead of `*52` (52 rows) - sprite was 42px tall, not 64
- **Panel structure bug**: `[topBorder, sideRow]*7` created 14 alternating rows instead of `[topBorder] + [sideRow]*7` (1 top + 7 sides = 8 rows)
- **Fix**: All three corrected at `ws03.py:27`

### 3. Fog of War Color
- **Root cause**: Used `5` (Black) - too extreme, not "foggy"
- **Fix**: Changed to `2` (Gray) at `ws03.py:76`

### 4. Player Character Colors (pca sprite)
- **Root cause**: Used `3+6` (DarkGray+Pink checkerboard)
- **Fix**: Changed to `9+6` (Blue+Pink checkerboard) at `ws03.py:31`

### 5. Energy Bar Off-State
- **Root cause**: Off-color was `0` (White) - showed white segments in UI
- **Fix**: Changed to `5` (Black) at `ws03.py:99`

### 6. Lives Indicator Off-State
- **Root cause**: Same White issue as energy bar
- **Fix**: Changed to `5` (Black) at `ws03.py:105`

### 7. nlo (hep/nfq) Reset After Wrong-Match Flash
- **Root cause**: `color_remap(None, 5)` reset the Magenta(6) boundary to Black(5) instead of restoring it
- **Fix**: Changed to `color_remap(None, 6)` at `ws03.py:376`

## Intentional WS03 Differences from LS20 (preserved)
- Magenta (6) borders instead of Black (5): `ggk`, `hep`, `lhs`, `snw`, `tuv`, `ulq`
- Dark Red (13) walls instead of Darker Gray (4): `nlo`, `hul`
- Orange (12) energy pickups (1x1) instead of Yellow (11) (3x3): `zba`
- Red (8) reset flash instead of Yellow (11): `krg`
- Fog radius 10.0 instead of 20.0 (tighter)
- Fog always enabled (`qee = True`) instead of per-level
- Bordered panel around key sprite display (LS20 draws sprite directly)
- Seeded randomness support
- Reordered levels
