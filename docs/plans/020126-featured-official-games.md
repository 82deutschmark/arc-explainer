---
description: synchronize featured community games with ARC official builds
---

# 020126-featured-official-games.md

## Objective
Expose the official ARC Prize preview games (`ls20`, `ft09`, `vc33`) in the ARC3 Community UI so they can be launched just like `ws01` and `gw01`. Ensure backend routing, Python bridge, and metadata honor new IDs and that docs/changelog capture the expansion.

## Constraints & Notes
- Featured list lives entirely in server memory (`server/routes/arc3Community.ts`) and mirrored set in the runner.
- Python bridge already resolves any registry-listed ID; just needs metadata & validation updates.
- Maintain SRP/DRY: avoid copy/paste, prefer shared helper where sensible.

## Task List
1. **Server route metadata** – add `ls20`, `ft09`, `vc33` entries in `FEATURED_COMMUNITY_GAMES` with accurate descriptions. File: `server/routes/arc3Community.ts` (lines ~20-110).
2. **Runner ID whitelist** – update `FEATURED_COMMUNITY_GAMES` set and virtual metadata inside `CommunityGameRunner` for new IDs. File: `server/services/arc3Community/CommunityGameRunner.ts` (lines ~17-110).
3. **Optional shared constants** – consider moving repeated metadata into `shared/config/arc3Colors.ts` or new shared helper if duplication grows (evaluate after steps 1-2).
4. **Docs & changelog** – add entry to `CHANGELOG.md` (top) and mention in this plan once complete.
5. **Verification** – Hit `/api/arc3-community/games/featured` and `/games/<id>` for all five IDs; start sessions for each to confirm Python bridge loads (manual testing checklist).
