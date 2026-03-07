# 2026-03-07 ARC3 Community Game Submission Flow Audit

**Author:** Cascade (Claude Sonnet 4)  
**Date:** 2026-03-07  
**Scope:** Full pipeline from user upload → server validation → admin publish → game execution  

---

## Architecture Summary

The project has **two separate game execution paths** — neither uses `arc_agi.Arcade`:

| Path | Discovery | Storage | Loader |
|------|-----------|---------|--------|
| **Official games** | `ArcEngineOfficialGameCatalog` scans `external/ARCEngine/games/official/*.py` via Python subprocess | Git submodule | `CommunityGamePythonBridge` → `community_game_runner.py` |
| **Community uploads** | PostgreSQL `community_games` table | `uploads/community-games/{gameId}.py` | `CommunityGamePythonBridge` → `community_game_runner.py` |

The `arc_agi.Arcade` API (which scans `environment_files/`) is a **completely separate** path used by external agents/tools. The web app never touches it.

---

## Issues Found

### CRITICAL

#### C1. Dead sample game link — `ws01.py` no longer exists
- **File:** `GameSubmissionPage.tsx:43`
- **Code:** `const SAMPLE_GAME_URL = 'https://github.com/arcprize/ARCEngine/blob/main/games/official/ws01.py';`
- **Problem:** `ws01.py` was deleted upstream. This link 404s for every submitter.
- **Fix:** Point to a game that exists, e.g., `ws03.py` or the official `ls20.py`.

#### C2. `__future__` imports trigger false validation warning
- **File:** `CommunityGameValidator.ts:119`
- **Problem:** `from __future__ import annotations` is standard Python, but `__future__` isn't in `ALLOWED_IMPORTS`. Every well-written game using this pattern gets a spurious "not in the standard allowed list" warning.
- **Fix:** Add `'__future__'` to the `ALLOWED_IMPORTS` array.

#### C3. Coordinates not passed for ACTION6 via `ActionInput.data`
- **File:** `community_game_runner.py:224-230`
- **Problem:** The runner sets `action_input.x` and `action_input.y` directly, but `ARCBaseGame.step()` reads coordinates from `self.action.data.get("x", 0)`. The `ActionInput` constructor accepts a `data` dict parameter — coordinates should be passed as `ActionInput(id=action_id, data={"x": x, "y": y})`.
- **Impact:** Click-based games (ct01, ct03, ft09) may receive wrong coordinates through the web app's session API.
- **Fix:** Change to `action_input = ActionInput(id=action_id, data={"x": coordinates[0], "y": coordinates[1]})`.

### MODERATE

#### M1. No runtime validation during submission
- **File:** `arc3Community.ts:494`
- **Problem:** Only `validateSource()` (static analysis) runs. The `validateRuntime()` and `validateFull()` methods exist in `CommunityGameValidator.ts` but are never called from the submission endpoint. A game can pass static analysis but crash at instantiation (missing levels, bad sprite data, etc.).
- **Recommendation:** Call `validateFull()` instead of `validateSource()` — it already does static analysis first and falls through to runtime if that passes. This would catch crashes before the admin even sees the submission.

#### M2. Publish endpoint doesn't register game for `arc_agi.Arcade`
- **File:** `arc3Community.ts:644-648`
- **Problem:** Publishing only flips DB flags (`status='approved'`, `isPlayable=true`). No `environment_files/{gameId}/{version}/metadata.json` is created. Published community games are invisible to `arc_agi.Arcade`.
- **Impact:** External agents using the official ARC toolkit cannot discover or play community games.
- **Recommendation:** On publish, generate an `environment_files/` entry (metadata.json + symlink/copy of .py). This is a future enhancement, not blocking current web play.

#### M3. Game ID format diverges from ARC Prize convention
- **Client:** `^[a-z][a-z0-9_-]{2,49}$` — allows `my-awesome-puzzle` (long, with dashes)
- **Arcade API:** Expects 4-char base IDs (`ls20`, `ft09`) — docs say "first 4 characters are the game_id"
- **Web app runner:** Works with any string (no length constraint)
- **Impact:** Not blocking for web play. But community games with IDs like `my-game-v2` won't be Arcade-compatible if that's ever desired.
- **Recommendation:** Consider suggesting (not enforcing) the 4-char format in the UI, or document that community game IDs are web-app-only.

#### M4. `community_game_runner.py` doesn't pass `seed`
- **File:** `community_game_runner.py:182,187`
- **Problem:** `GameClass()` is called with no arguments. Games with a `seed` parameter work (defaults to 0), but there's no way for the web session to request a specific seed for reproducibility.
- **Fix:** Accept optional `seed` in the init payload, use `inspect.signature` like `arc_agi.LocalEnvironmentWrapper` does.

### LOW

#### L1. `open` in `FORBIDDEN_IMPORTS` is misleading
- **File:** `CommunityGameValidator.ts:50`
- **Problem:** `open` is listed as a forbidden import module name, but `open()` is a Python builtin, not a module. `import open` doesn't exist in Python. The actual `open()` check is handled separately by the regex at line 131. Having it in the imports list is dead code that could confuse maintainers.
- **Fix:** Remove `'open'` from `FORBIDDEN_IMPORTS` (the regex at L131 already handles `open()` calls).

#### L2. Client ARCBaseGame check is case-insensitive
- **File:** `PythonFileUploader.tsx:56`
- **Code:** `/ARCBaseGame/i.test(content)` — the `i` flag matches `arcbasegame`
- **Server check:** Case-sensitive `/class\s+(\w+)\s*\(\s*ARCBaseGame\s*\)/` (correct)
- **Impact:** Cosmetic only — client shows "ready" for a file that would fail server validation if casing is wrong. Not critical since server is the authority.

#### L3. File storage doesn't version submissions
- **File:** `CommunityGameStorage.ts:60-67`
- **Problem:** Files stored as `uploads/community-games/{gameId}.py`. If a rejected game is resubmitted with the same ID (after cleanup), the old file is silently overwritten. No version history.
- **Impact:** Low risk given the manual review flow, but could lose audit trail.

#### L4. `self.open()` method false positive
- **File:** `CommunityGameValidator.ts:131`
- **Code:** `/\bopen\s*\(/.test(line)` — matches any word-boundary `open(`, including `self.open()` as a method name.
- **Impact:** Unlikely in practice (no ARCEngine API uses `.open()`), but a legitimate custom method named `open` would be flagged.

---

## What's Working Well

- **Two-tier validation:** Client-side gives instant feedback, server-side is authoritative.
- **SHA-256 integrity checks:** File hash verified before every play and admin review.
- **Official game auto-discovery:** `ArcEngineOfficialGameCatalog` dynamically scans the ARCEngine submodule — no hardcoded whitelist.
- **Python bridge isolation:** Each game session runs in its own subprocess with clean teardown.
- **Admin token gating:** All admin endpoints require `ARC3_COMMUNITY_ADMIN_TOKEN`.
- **Session timeout:** 15-minute inactivity cleanup prevents orphaned processes.

---

## Recommended Priority Order

1. **C3** — Fix coordinate passing (games are unplayable via web without this)
2. **C1** — Fix dead sample link (blocks new submitters)
3. **C2** — Add `__future__` to allowed imports (false warnings)
4. **M1** — Enable runtime validation on submission
5. **M4** — Pass seed through Python bridge
6. **M2/M3** — Arcade compatibility (future enhancement)
