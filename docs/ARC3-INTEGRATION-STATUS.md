# ARC3 Integration Status — Handoff Brief

**Author:** Bubba (Claude Sonnet 4.6)  
**Date:** 27-March-2026  
**Branch:** arc3  
**Purpose:** Brief the next coding agent on the current state of arc-explainer's ARC-AGI-3 integration and what needs to be done to bring it up to speed with the latest upstream changes.

---

## Context

`arc-explainer` (repo: `82deutschmark/arc-explainer`, branch: `arc3`) is a Flask + TypeScript web app that lets users play, analyze, and run AI agents against ARC-AGI-3 games. It wraps an ARCEngine submodule (`external/ARCEngine`) and serves both the ARC Prize Foundation games and custom Observatory games.

The upstream `arc-agi-3` repo (`sonpham-org/arc-agi-3`) has been the active development target. Most of the recent work happened there — the changelog in arc-explainer cuts off at **v7.4.0 (March 12, 2026)**. Everything since then needs to be reconciled.

---

## What Has Been Done (March 12 → March 27, 2026)

All of this work happened in `arc-agi-3`, not in `arc-explainer`. You need to audit which of these are already in arc-explainer and which need to be ported:

### Game Catalog — All Foundation Games Now Present
The full set of Foundation games is now downloaded and registered. The complete game list in `arc-agi-3/environment_files/` is:

`ab, ac, ar, ar25, bp35, cd82, cn04, cr, dc22, fd, fr, ft09, fy, g50t, gh, ka59, lb, lf52, lp85, ls20, m0r0, mr, mw, pc, pi, pt, px, r11l, re86, s5i5, sb26, sc25, sh, sk48, sn, sp80, su15, td, tn36, tr87, ts, tu93, vc33, wa30, ws03, ws04`

Verify arc-explainer has all of these. Any missing from `environment_files/` or `data/games/` need to be downloaded and registered.

### Game Version Logic Fixed (v1.13.6 in arc-agi-3)
When multiple versions of a Foundation game exist (e.g. `ls20-cb3b57cc` vs `ls20-9607627b`), the server was picking by hash sort (wrong). It now picks by `date_downloaded` in `metadata.json` — most recent wins, hash is only a tiebreaker. Check `server/helpers.py` (`get_game_version`) and `server/app.py` (`list_games`, `game_source`) in arc-explainer for this fix.

### Dynamic Foundation Game Detection (v1.13.7)
Removed the hardcoded `_ARC_FOUNDATION_GAMES` list. The app now detects Foundation games dynamically: if a game's title equals its ID (e.g. "LS20" == "ls20"), it's a Foundation game. `ws03`/`ws04` are hardcoded exceptions (Observatory games despite ID-like titles). The `_renderGames()` helper was extracted to `ui.js` to DRY up `human.js` and `session-views-grid.js`.

### Unplayable Games Hidden; Level Selector Fixed (v1.13.9)
- `list_games()` now filters out games where `local_dir=None` (downloaded from API but not locally present) — these caused `Path(None)` TypeErrors.
- Level cards showed blank canvases on failure; now draw a numbered placeholder immediately.
- "Game Results" tab removed from Play as Human panel (showed nothing useful).

### Claude OAuth Token Support (v1.14.0)
- Anthropic requires the system message to begin with `"You are Claude Code, Anthropic's official CLI for Claude."` for OAuth tokens (sk-ant-oat) to route correctly. Without it, Sonnet 4.6 returns HTTP 400. This preamble is now auto-prepended in all three Anthropic call paths: browser CORS proxy (`server/app.py`), server-side provider (`llm_providers_anthropic.py`), and CLI agent (`agent_llm.py`).
- Model IDs reverted to short-form: `claude-sonnet-4-6`, `claude-opus-4-6` (no date suffixes).
- Proxy timeout bumped 120s → 300s. Browser-side retry added (3 attempts, 5s/10s backoff) for 502/504/529 errors.
- API key inputs changed to `type="text"` so users can see what they pasted.

### CI / Test Suite Overhaul (v1.14.1)
- Python bumped to 3.12 in CI (required by arc-agi SDK). `arc-agi==0.9.6` pinned.
- New test files: `test_app_boots.py` (Flask smoke tests), `test_routes.py` (8 route groups, zero live API calls).
- DB test mocking fixed; file header assertions removed from `test_refactor_modules.py` (no more hardcoded author names).
- `CLAUDE_CODE_TOKEN` env var removed — use `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTHTOKEN` only.

---

## What You Need to Do

### 1. Audit the Game List
Compare the game IDs in arc-agi-3's `environment_files/` (listed above) against arc-explainer's local game storage. Any missing games need to be fetched from the ARC Prize API and registered. Check `scripts/` for download tooling.

### 2. Port the Game Version Fix
`server/helpers.py` and `server/app.py` — verify the `date_downloaded`-based version selection is present. If not, port from arc-agi-3.

### 3. Port Dynamic Foundation Detection
Check `server/app.py` and the JS sidebar rendering code. If `_ARC_FOUNDATION_GAMES` is still a hardcoded list, replace it with the dynamic ID-equals-title check. Port `_renderGames()` to `ui.js` if not already there.

### 4. Verify Claude OAuth System Preamble
In `server/app.py` (proxy route), `llm_providers_anthropic.py`, and `agent_llm.py`: confirm the `"You are Claude Code..."` preamble is auto-prepended for Anthropic calls. This is critical for OAuth tokens to work on Sonnet 4.6.

### 5. CHANGELOG
After porting, add a CHANGELOG entry at the top of `CHANGELOG.md` in SemVer format documenting what was synced. New version should be 7.5.0 or higher. Follow the existing format: what / why / how, author + model, files changed.

---

## Notes for the Agent

- **Branch:** Always work on `arc3`. Do not touch `main`.
- **No API key.** This project uses `ANTHROPIC_OAUTHTOKEN` (sk-ant-oat prefix). Never use or recreate `ANTHROPIC_API_KEY`.
- **Coding standards** are in `Mark's Coding Standards.md` at the repo root. File headers required on every TS/JS/Py file you touch.
- **Commit messages** follow the existing pattern: `fix:`, `feat:`, `chore:`, `docs:` prefixes.
- **Check before creating** — arc-explainer and arc-agi-3 share significant code history. Don't rebuild something that's already there.
