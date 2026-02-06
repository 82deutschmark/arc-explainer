---
Title: 020526-ws02-step-plan
---

# 020526-ws02-step-plan

## Objective
Diagnose and fix the WS02 "step is still running" issue by auditing the action loop, sprite state mutations, and fog interface side effects to ensure each tick finishes promptly and transitions/states reset correctly.

## Root Cause Analysis

After tracing the `step()` method (ws02.py lines 464-574), two code paths return **without** calling `complete_action()`:

1. **Goal mismatch bounce** (lines 510-514): When the player lands on a `mae`-tagged goal sprite but `qhg()` returns `False` (wrong shape/color/rotation), `kbj` is set to `True` and the method returns. The *next* step call handles the `kbj` flag at lines 472-476 and calls `complete_action()`. This is intentional two-tick feedback (flash the boundary red, then reset).

2. **Death/respawn sequence** (lines 543-573): When energy is depleted and the player has lives remaining, `xhp` is set to `True`, the death overlay is shown, and the method returns. The *next* step call clears `xhp` at lines 465-470 and calls `complete_action()`. This is also intentional (show death screen, then resume).

**The bug**: Both paths rely on the *next* `step()` call to fire `complete_action()`. If the ARCEngine expects `complete_action()` within the *same* tick (synchronous completion), the game hangs in "step is still running" state until the next input event triggers the deferred `complete_action()`.

## Fix Strategy

Ensure every `step()` invocation calls `complete_action()` before returning, while preserving the visual two-tick transitions by using a separate animation/state flag that doesn't block the action loop.

## Tasks
- [x] **Confirm current WS02 runtime behavior** -- inspected `step()` in `ws02.py` lines 464-574. Identified two deferred `complete_action()` paths (goal-mismatch bounce at L510-514, death/respawn at L543-573).
- [x] **Trace sprite/tag lookups** -- verified `on_set_level` (lines 407-459). All tag lookups (`caf`, `wex`, `nfq`, `fng`, `axa`, `mae`) match sprite definitions. No IndexError risk with existing levels.
- [x] **Instrument timers / guard clauses** -- identified the exact branches that skip `complete_action()`: the `kbj=True` return (L514) and the `xhp=True` return (L573).
- [x] **Validate fog interface energy drain** -- `jvq.pca()` countdown (L323-326) interacts safely with `step()`. Energy drain is only bypassed when `xpb` (energy pickup collected) is True. The `render_interface` method (L331-365) is read-only on game state.
- [ ] **Apply fix** -- add `complete_action()` calls to the two deferred-return paths so the engine never stalls. Preserve visual feedback by scheduling state resets on the next tick without blocking the action queue.
- [ ] **Add regression test** -- create/extend a test under `external/ARCEngine/tests` to simulate repeated steps without player input and assert the game advances/terminates without hanging.
- [ ] **Document + changelog** -- update `CHANGELOG.md` covering WS02 step fix with SemVer entry.

## Proposed Code Changes

### Path 1: Goal mismatch (line ~514)
```python
# Before:
elif "mae" in oib.tags:
    qzq = self.qqv.index(oib)
    if not self.qhg(qzq):
        self.nlo.color_remap(None, 0)
        self.kbj = True
        return  # BUG: no complete_action()

# After:
elif "mae" in oib.tags:
    qzq = self.qqv.index(oib)
    if not self.qhg(qzq):
        self.nlo.color_remap(None, 0)
        self.kbj = True
        self.complete_action()  # FIX: always complete
        return
```

### Path 2: Death/respawn (line ~573)
```python
# Before:
            for pqv in self.current_level.get_sprites_by_tag("yar"):
                pqv.set_visible(True)
            return  # BUG: no complete_action()

# After:
            for pqv in self.current_level.get_sprites_by_tag("yar"):
                pqv.set_visible(True)
            self.complete_action()  # FIX: always complete
            return
```

Both the `kbj` and `xhp` handlers at the top of `step()` already call `complete_action()`, so the next tick still processes the visual reset correctly.
