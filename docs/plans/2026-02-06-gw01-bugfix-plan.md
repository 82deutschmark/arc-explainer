# GW01 Gravity Well Bugfix Plan

**Author:** Claude Opus 4.6
**Date:** 2026-02-06
**Status:** Complete

## Objective

Fix multiple bugs in `gw01.py` (Gravity Well puzzle game) that caused incorrect orb movement, broken phase-through mechanics, and a corrupted data key.

## Bugs Identified

### 1. Cyrillic Characters in Level Data Key (Critical)
- **Location:** Line 150, level 0 data dict
- **Problem:** `"ned"` was spelled with Cyrillic characters (`"nед"` - Cyrillic "e" and "d")
- **Impact:** `level.get_data("ned")` returned `None` for level 0. Happened to work by accident because fallback `len(self.orb)` equals 2, matching the intended value.
- **Fix:** Replace Cyrillic characters with ASCII `"ned"`.

### 2. Sequential Orb Processing Causes False Collisions (Critical)
- **Location:** `sst()` method
- **Problem:** Orbs processed in arbitrary list order. When two orbs move in the same direction, the trailing orb detects collision with the leading orb (which hasn't moved yet) and triggers false fusion.
- **Example:** Two yellow orbs both moving right -- trailing orb's next position overlaps leading orb's current position, triggering spurious same-type fusion instead of both sliding freely.
- **Fix:** Sort orbs by movement direction before processing. Leading orb (closest to destination edge) moves first, clearing the path for trailing orbs.
  - Moving right: sort by x descending
  - Moving left: sort by x ascending
  - Moving down: sort by y descending
  - Moving up: sort by y ascending

### 3. Phase-Through Mechanic Breaks Green Orbs (Major)
- **Location:** Lines 350-353 (old), inside `sst()`
- **Problem:** After phasing through one platform, green (fused) orbs had their `"fsd"` tag stripped and replaced with `"lgt"` (light/yellow type), while keeping green pixels. This caused:
  - Visual inconsistency (looks green, acts yellow for collection)
  - Contradicts game description: "Green phases through platforms" implies permanent ability
  - One-time phasing makes green orbs nearly useless in later levels with multiple platforms
- **Fix:** Remove the tag/pixel change entirely. Green orbs permanently phase through platforms.

### 4. Fusion Reports Success on Incompatible Types (Minor)
- **Location:** `sst()` fusion loop + `fus()` method
- **Problem:** `fu = True` was set unconditionally after calling `fus()`, even when `fus()` returned early because the orb types weren't in the FSN fusion table (e.g., green + yellow). This caused an unnecessary extra simulation tick.
- **Fix:** Changed `fus()` to return `bool`. Only set `fu = True` when fusion actually occurred.

## Files Changed

- `external/ARCEngine/games/official/gw01.py` -- All four fixes applied
- `docs/plans/2026-02-06-gw01-bugfix-plan.md` -- This plan document
- `CHANGELOG.md` -- Version entry added
