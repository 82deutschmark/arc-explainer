# 2026-02-01 ARC3 ARCEngine Official Game ID Sync Plan (Updated)

## Context
- Community game playback fails because ARCEngine no longer provides the WorldShifter class at games.world_shifter.
- ARCEngine now ships official games under games/official/ with IDs like ws01 and gw01.
- We are switching to official ARC3 naming conventions:
  - Keep ws01 (World Shifter)
  - Add gw01 (Gravity Well)
  - Remove chain_reaction (no longer exists)
  - Remove legacy world_shifter (no longer exists)

## Goals
- Restore featured game playback using official IDs and module locations.
- Align all community featured game metadata and session start logic to ws01 and gw01 only.
- Remove legacy IDs (world_shifter, chain_reaction) from API surfaces and internal mappings.
- Keep changes small, explicit, and fully documented.

## Scope
- Server community featured game metadata (API payloads).
- Community game session start logic and any ID routing.
- Python bridge loader in server/python/community_game_runner.py.
- Docs and CHANGELOG updates for the behavioral change.

## Non-Goals
- No UI redesigns or new gameplay features.
- No database migrations unless required for runtime correctness.
- No changes to preview ARC3 routes or official ARC3 agent playground flows.

## Plan
1. Confirm current ARCEngine official IDs and entry points
   - Verify files in external/ARCEngine/games/official/ (ws01.py, gw01.py).
   - Confirm class names (Ws01, Gw01) and game_id strings.
   - Note: a web search of the upstream ARCEngine repo could confirm any additional breaking changes beyond the submodule.
2. Remove legacy featured game IDs from server metadata
   - Update featured list to include only ws01 and gw01.
   - Remove world_shifter and chain_reaction from:
     - server/routes/arc3Community.ts
     - server/services/arc3Community/CommunityGameRunner.ts
3. Update the Python runner to load official games
   - Prefer games.official for ws01 and gw01 if the registry import path has changed.
   - Ensure the emitted game_id matches the official ID (ws01, gw01).
4. Update documentation and changelog
   - Add a top entry in CHANGELOG.md with SemVer, what/why/how, author.
   - Update any ARC3 community docs that mention world_shifter or chain_reaction as featured.
5. Verify
   - Start a session for ws01 and gw01 and confirm frames return.
   - Confirm /api/arc3-community/games and /featured return only ws01 and gw01.

## Files Likely Touched
- server/routes/arc3Community.ts
- server/services/arc3Community/CommunityGameRunner.ts
- server/python/community_game_runner.py
- docs/* (plan updates and any ARC3 community references)
- CHANGELOG.md

## Open Questions
1. Should the display names be strictly "ws01" and "gw01", or do you want user-facing names like "World Shifter" and "Gravity Well"?
2. Should we keep any compatibility aliasing in the API (return a 404 for old IDs vs redirect or message)?
