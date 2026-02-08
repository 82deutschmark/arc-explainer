# WS-Style Games Reference Guide

Author: Claude Opus 4.6
Date: 2026-02-06
PURPOSE: Document how WS-style games (WS03, WS04) work, their structure, sprite roles,
color slot assignments, and how they differ from the LS20 base game.

## Overview

WS-style games are variants of LS20, the base game in the ARCEngine. They share the same
core mechanics (grid movement, shape matching, energy management) but differ in:

- Color palettes
- Level layouts
- UI rendering (fog of war, energy/lives display)
- Optional features (permanent fog, seeded randomness, level progress dots)

All WS games move in **5-pixel steps** on a **64x64 grid**. The player avatar, walls,
targets, and all interactive sprites are sized/positioned on this 5px grid.

---

## Core Mechanics

### Movement
- Player moves in 5px steps: `mgu.x + direction * 5`
- Collision checks a 5x5 region at the proposed position: `rbt(x, y, 5, 5)`
- Walls (`nlo`, tag `jdd`) block movement
- Stepping on pickups triggers shape/color/rotation changes or energy refills

### Shape Matching
The player carries a "key" (displayed by `kdj`/`nio`, tag `wex`) with three properties:
- **Shape** (`snw` index into `hep` array) -- changed by `vxy` pickup (tag `gsu`)
- **Color** (`tmx` index into `hul` array) -- changed by `qqv` pickup (tag `gic`)
- **Rotation** (`tuv` index into `kdj` array) -- changed by `kdy` pickup (tag `bgt`)

When the key matches a target (`lhs`, tag `mae`), the target frame (`ulq`, tag `qex`)
lights up and `opw` (tag `fng`) becomes visible. Walking onto a matching target solves it.

### Energy & Lives
- Energy decrements each step (unless picking up `zba`, tag `iri`)
- When energy hits 0: lose a life, reset to start position, restore all pickups
- `krg` sprite fills the screen as a reset flash
- 3 lives total; 0 lives = game over

---

## Sprite Reference

| Sprite | Tags | Role | Collidable | Notes |
|--------|------|------|------------|-------|
| `pca` | `caf` | Player avatar | Yes | 5x5, moves on grid |
| `kdj`/`nio` | `wex` | Key indicator (shape preview) | Yes | Uses 0 as remap base |
| `nlo` | `jdd` | Wall tile | Yes | 5x5 solid blocks |
| `lhs` | `mae` | Target zone | No | 5x5, where player must deliver matching key |
| `hul` | - | Door/gate | Yes | 9x9 (2px frame + body) |
| `hep` | `nfq` | Level boundary | Yes | 10x10 solid block |
| `snw` | `yar` | Target border frame (7x7) | Yes | Shows around unsolved targets |
| `ggk` | `yar`, `vdr` | Alt target border (dual-target levels) | Yes | 7x7 frame |
| `ulq` | `qex` | Inner target frame (7x7) | No | Hidden until key matches |
| `tuv` | `fng` | Outer boundary frame (10x10) | Yes | Hidden, shown when any key matches |
| `rzt` | `axa` | Target indicator (inside door) | Yes | 3x3 diagonal pattern |
| `zba` | `iri` | Energy pickup | No | Refills energy bar |
| `vxy` | `gsu` | Shape changer | No | Cycles key shape |
| `qqv` | `gic` | Color changer | No | Cycles key color |
| `kdy` | `bgt` | Rotation changer | No | Cycles key rotation |
| `krg` | - | Reset flash | Yes | 1x1, scaled to 64x64 on death |
| `mgu` | - | UI frame (L-shaped) | Yes | Left bar + bottom panel |

### Shape sprites (remap bases -- use color 0)
These use `0` as their base color so `color_remap(0, target)` works:
`dcb`, `fij`, `lyd`, `nio`, `opw`, `rzt`, `tmx`

**Important**: These are the ONLY sprites where color 0 is correct. Any other sprite
using colors 0 or 1 in its pixel data (not as a remap base) is almost certainly a bug.

---

## Color Slot Assignments

These are the key locations where colors are configured. Each WS game chooses its own
palette, but the structural roles are the same.

### Global Settings

| Slot | Purpose | LS20 | WS03 | WS04 |
|------|---------|------|------|------|
| `BACKGROUND_COLOR` | Camera background / empty space fill | 3 | 10 | 10 |
| `PADDING_COLOR` | Camera padding around viewport | 3 | 15 | 15 |

### Structural Sprites

| Slot | Purpose | LS20 | WS03 | WS04 |
|------|---------|------|------|------|
| `hep` (boundary) | Level boundary block color | 5 | 6 | 8 |
| `nlo` (walls) | Wall tile color | 4 | 13 | 9 |
| `hul` (door body) | Door/gate fill color | 4 | 13 | 4 |
| `lhs` (target) | Target zone color | 5 | 6 | 8 |
| `snw` (target frame) | Target border color | 5 | 6 | 8 |
| `ggk` (alt frame) | Alt target border color | 5 | 6 | 8 |
| `tuv` (outer frame) | Outer boundary frame color | 5 | 6 | 8 |
| `ulq` (inner frame) | Inner target frame color | 5 | 6 | 8 |

### Player & Key

| Slot | Purpose | LS20 | WS03 | WS04 |
|------|---------|------|------|------|
| `pca` colors | Player avatar appearance | 12+9 | 9+6 | 3+7 |
| `krg` (reset flash) | Reset indicator color | ? | 8 | 2 |

### Interactive Pickups

| Slot | Purpose | LS20 | WS03 | WS04 |
|------|---------|------|------|------|
| `zba` (energy) | Energy pickup visual | 11 (3x3) | 12 (1x1) | 4 (3x3 ring) |
| `vxy` (shape changer) | Shape picker visual colors | ? | 6 | 8 |
| `qqv` (color changer) | Color picker visual colors | ? | 15,8,6,11,12 | 9,14,4,8,12 |
| `kdy` (rotation changer) | Rotation picker visual colors | ? | 6,12 | 8,4 |

### UI / Render Interface

| Slot | Purpose | LS20 | WS03 | WS04 |
|------|---------|------|------|------|
| Fog of war color | Color for hidden areas | 5 | 2 | 9 |
| Fog radius | Visibility radius around player | 20.0 | 10.0 | 15.0 |
| Panel border | Border around key preview panel | N/A | 6 | 8 |
| Panel background | Background of key preview panel | N/A | 15 | 15 |
| Energy bar ON | Active energy segment color | ? | 12 | 4 |
| Energy bar OFF | Empty energy segment color | ? | 15 | 9 |
| Lives ON | Active life indicator color | ? | 14 | 3 |
| Lives OFF | Empty life indicator color | ? | 15 | 9 |
| `nlo` reset color | Color restored after wrong-match flash | 5 | 6 | 8 |

### mgu Sprite (L-shaped UI frame)

The `mgu` sprite is a complex multi-part sprite that creates the game's UI frame:

```
Rows 0-51:  Left bar (4px wide) + transparent (60px)
Row 52:     Panel top border (12px solid) + transparent (52px)
Rows 53-59: Panel sides (1px border, 10px interior, 1px border) + transparent (52px)
Rows 60-62: Panel sides (1px border, 10px interior, 1px border) + bottom fill (52px solid)
Row 63:     Full bottom bar (12px + 52px solid)
```

| Part | Purpose | LS20 | WS03 | WS04 |
|------|---------|------|------|------|
| Left bar color | Left edge decoration | 5 | 6 | -1 (transparent) |
| Panel border color | Bottom panel frame | 4 | 13 | 9 |
| Bottom fill color | Right-side bottom area | 4 | 13 | 9 |

**Known bugs (now fixed):**
- Row count: must be `*52` (not `*24`) for the left bar to span full height
- Panel structure: must be `] + [side]*7` not `[top, side]*7` (the latter creates
  14 alternating rows instead of 1 top + 7 sides)

---

## Level Data Fields

Each level's `data` dict contains:

| Key | Type | Purpose |
|-----|------|---------|
| `vxy` | int | Maximum energy (e.g., 36, 42) |
| `tuv` | int or list | Target shape index(es) into `hep` array |
| `nlo` | int or list | Target color index(es) into `hul` array |
| `opw` | int or list | Target rotation(s) (0, 90, 180, 270) |
| `qqv` | int | Initial key shape index |
| `ggk` | int | Initial key color value (actual color, looked up in `hul`) |
| `fij` | int | Initial key rotation (actual degrees, looked up in `kdj`) |
| `kdy` | bool | Whether fog of war is enabled (WS03 always True, WS04 per-level) |

---

## Key Differences Between WS03, WS04, and LS20

| Feature | LS20 | WS03 | WS04 |
|---------|------|------|------|
| Fog of war | Per-level | Always on | Per-level |
| Fog radius | 20.0 | 10.0 (tighter) | 15.0 |
| Energy display | Horizontal bar | Horizontal bar | Vertical bar (right side) |
| Lives display | Horizontal | Horizontal | Vertical (right side) |
| Level progress | None | None | Dots in top-right corner |
| Seeded randomness | No | Yes | Yes |
| Number of levels | ? | 7 | 7 |
| Key preview panel | Direct draw | Bordered panel | Bordered panel |
| Color palette | Dark/muted | Magenta/DarkRed/Orange | Cyan/Blue/Yellow |
