---
description: synchronize featured community games with ARC official builds
---

<!--
Author: Cascade (ChatGPT)
Date: 2026-02-01
PURPOSE: Execution log for exposing official ARC preview games via community routes and bridge.
SRP/DRY check: Pass — single-source plan status.
-->

# 020126-featured-official-games.md

## Objective
Expose the official ARC Prize preview games (`ls20`, `ft09`, `vc33`) in the ARC3 Community UI so they can be launched just like `ws01` and `gw01`. Ensure backend routing, Python bridge, and metadata honor new IDs and that docs/changelog capture the expansion.

## Constraints & Notes
- Historical note: this plan originally introduced a hardcoded "featured" list in the server (routes + runner).
- As of `v7.2.4` (Feb 01, 2026), official games are discovered dynamically via `server/services/arc3Community/ArcEngineOfficialGameCatalog.ts`, so adding new official game files no longer requires updating server-side whitelists.
- Maintain SRP/DRY: avoid copy/paste, prefer shared helper where sensible.

## Task List
1. **Server route metadata** – add `ls20`, `ft09`, `vc33` entries in `FEATURED_COMMUNITY_GAMES` with accurate descriptions. File: `server/routes/arc3Community.ts` (lines ~20-110).
2. **Runner ID whitelist** – update `FEATURED_COMMUNITY_GAMES` set and virtual metadata inside `CommunityGameRunner` for new IDs. File: `server/services/arc3Community/CommunityGameRunner.ts` (lines ~17-110).
3. **Optional shared constants** – consider moving repeated metadata into `shared/config/arc3Colors.ts` or new shared helper if duplication grows (evaluate after steps 1-2).
4. **Docs & changelog** – add entry to `CHANGELOG.md` (top) and mention in this plan once complete.
5. **Verification** – Hit `/api/arc3-community/games/featured` and `/games/<id>` for all five IDs; start sessions for each to confirm Python bridge loads (manual testing checklist).

## Status – Feb 01, 2026

- Completed steps 1-3: server route metadata, runner whitelist, and ARCEngine registry now include `ls20`, `ft09`, and `vc33`, so the Python bridge can load the official preview games just like `ws01`/`gw01`.
- Step 4 covered via CHANGELOG entry `v7.2.2` describing the metadata + registry expansion (this doc notes the change here).
- Step 5 pending manual regression tests on `/api/arc3-community/games/*` endpoints and live gameplay; keep this checklist for the next verification pass.

## Update – Feb 01, 2026 (v7.2.4)
- The server no longer relies on the hardcoded featured lists described above; official games are now auto-discovered from the ARCEngine submodule, so new files like `ws02.py`/`ws03.py` appear without server edits.
