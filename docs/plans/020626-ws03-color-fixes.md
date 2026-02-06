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

---

## Pending Fix Plan (Write-first, implement after approval)

### Goal
Resolve remaining WS03 regressions called out by the user: oversized collision for the 3×3 player avatar, overuse of color 5 (black), distinct background vs padding colors, and possible energy collectible bounding-box drift.

### Constraints & Guidelines
1. **No edits** until this plan is approved.
2. Treat colors **0–5 as reserved**; only use them when absolutely required by mechanics.
3. `background_color` and `padding_color` must remain distinct and avoid values 0–5 unless justified.
4. Any sprite using `0` as the remap base must never remap to `5`.
5. Verify bounding boxes for both the player (`pca`) and collectibles (`zba`).

### Executed Changes

#### WS03 (`ws03.py`)

| Fix | Line | Old | New | Rationale |
|-----|------|-----|-----|-----------|
| pca bounding box | 31 | 3x3 `[[9,6,9],[6,9,6],[9,6,9]]` | 5x5 with -1 padding around 3x3 visual | Game moves in 5px steps; 3x3 bbox caused false wall collisions |
| BACKGROUND_COLOR | 42 | `5` (Black) | `10` (Light Blue) | Floor color, outside 0-5 range |
| PADDING_COLOR | 43 | `5` (Black) | `15` (Purple) | Distinct from bg, outside 0-5 range |
| mgu left bar | 27 | `[5,5,5,5]` | `[6,6,6,6]` | Magenta, matches WS03 border theme |
| mgu bottom fill | 27 | `[5]*52` | `[13]*52` | Dark Red, matches panel border |
| Panel bg | 89 | `5` | `15` (Purple) | No more color 5 in key indicator |
| Energy bar off | 99 | `5` | `15` (Purple) | Empty segments use Purple |
| Lives off | 105 | `5` | `15` (Purple) | Empty segments use Purple |

- **kdj verified**: uses 0 as base, remaps to hul=[12,9,14,8]. Never maps to 5.
- **zba verified**: 1x1 orange (12). Collision via `rbt()` checks 5x5 region, so 1x1 still detected. Intentional design.

#### WS04 (`ws04.py`)

| Fix | Line | Old | New | Rationale |
|-----|------|-----|-----|-----------|
| BACKGROUND_COLOR | 44 | `5` (Black) | `10` (Light Blue) | Floor color, outside 0-5 |
| PADDING_COLOR | 45 | `5` (Black) | `15` (Purple) | Distinct from bg |
| mgu structure | 29 | 24 rows, `*7` bug | 52 rows, proper `] + [` separation | Same structural bugs WS03 had |
| mgu left bar | 29 | `[5,5,5,5]` | `[8,8,8,8]` | Red, matches WS04 border theme |
| mgu bottom fill | 29 | `[5]*52` | `[9]*52` | Blue, matches WS04 panel/wall theme |
| Panel bg | 370 | `5` | `15` (Purple) | No color 5 in key indicator |
| nlo.color_remap reset | 507 | `5` (Black) | `8` (Red) | Restore hep to its original Red color |
| Header comments | 4,16 | Wrong color names | Corrected to actual ARC3 palette names | Accuracy |

- **pca verified**: Already 5x5 in WS04. No change needed.
- **zba verified**: Already 3x3 in WS04, matches LS20 structure.
- **Energy/lives off**: Already using `9` (Blue) in WS04. No change needed.
