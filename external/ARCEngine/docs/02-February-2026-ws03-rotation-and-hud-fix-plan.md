# 02-February-2026 WS03 Rotation + HUD Fix Plan

## Context
- `games/official/ws03.py` is intended to be an LS20-variant with a jarring palette, permanent fog-of-war, and extra energy pickups.
- In the current WS03 build, the “target/lock” pieces are not being transformed from level metadata (shape/color/rotation), and the key piece color shifting is broken because remaps assume a base color of `0` while the WS03 piece templates are drawn with base color `6`.
- WS03 also does not attach a `RenderableUserDisplay` HUD to the `Camera`, so fog-of-war masking and energy/lives UI behavior are missing or inconsistent.

## Goal
- Make WS03 render and play like LS20 (same mechanics), while preserving WS03’s intended variant rules:
  - Permanent fog-of-war.
  - Extra energy pickups already present in WS03 levels.
  - Correct target piece shape/color/rotation per level metadata.

## Scope
### In Scope
- Fix `games/official/ws03.py`:
  - Use LS20’s tag conventions (`caf` player, `wex` key display, `mae` locks, `axa` target piece, `fng/qex/yar` overlays) and wire `on_set_level()` accordingly.
  - Restore an LS20-style HUD (`RenderableUserDisplay`) for fog-of-war and energy/lives rendering.
  - Correct WS03 color remapping to use the WS03 piece template base color (`6`) instead of `0`.
  - Keep WS03’s existing 7 levels and extra energy pickups (do not redesign layouts).
- Add a small pytest covering WS03 initialization and expected per-level target rotations (sanity check against the level metadata).
- Update `CHANGELOG.md` top entry for the behavior/visual change (include author/model name).

### Out of Scope
- Refactoring or redesigning LS20/WS01/WS02 beyond what’s required to validate WS03.
- Gameplay rebalance, new sprites, or new level geometry for WS03.
- Implementing WS04 (will be planned separately after WS03 is correct).

## Architecture
- Reuse LS20’s proven mechanics and data contract:
  - Level metadata keys:
    - `tuv`: target shape index (int or list[int])
    - `nlo`: target color value (int or list[int])
    - `opw`: target rotation degrees (int or list[int])
    - `qqv/ggk/fij`: initial key piece (shape/color/rotation)
    - `vxy`: max energy
    - `kdy`: fog flag (WS03 will force fog on regardless)
- WS03 will implement:
  - A lightweight HUD class (copied from LS20’s `jvq`) with palette-appropriate colors, owned by `Ws03` and passed into `Camera(…, interfaces=[hud])`.
  - `Ws03.on_set_level()` aligned to LS20 (populate `self.qqv` from `mae`, `self.pca` from `axa`, etc.) and transform `axa` sprites from metadata (including rotation).
  - Fix `pxr()` and in-step remaps to use the WS03 piece base color (`6`) when recoloring templates.

## TODOs
1. Add the HUD class to `ws03.py` and wire it into the camera interfaces.
2. Rewrite `Ws03.__init__()`/`Ws03.on_set_level()` to match LS20’s mechanics contract while keeping WS03 palette + always-on fog.
3. Fix all WS03 remaps that assume old color `0` to instead remap from base color `6`.
4. Add pytest coverage to ensure WS03 initializes and that `axa` target sprites match per-level `opw/nlo/tuv` metadata (rotation + non-transparent pixels present).
5. Update `CHANGELOG.md` with WS03 fix notes.
6. Run `python -m pytest` and fix any issues introduced by the change.

## Docs/Changelog Touchpoints
- `CHANGELOG.md`: new top entry describing WS03 behavior/visual fixes (include author/model name).
- No other docs expected unless gameplay behavior diverges from LS20 beyond fog always-on.

