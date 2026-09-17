# Holdout games

Games served for play by direct link only: `/arc3/play/<id>`. They are a separate local source
in `server/services/arc3Mirror/Arc3MirrorCatalog.ts` (key `holdout`), the `holdout` category is
in `HIDDEN_FROM_BROWSE` in `CommunityGallery.tsx`, and it is not in the visitor-facing allowlist
in `client/src/lib/arc3TaskSets.ts`, so nothing here appears in the gallery, a filter chip, the
review queue or a "next task" recommendation.

## as66 -- the lost game, "Always Sliding"

AS66 was one of the six ARC-AGI-3 preview games (July 2025) and was withdrawn from the public
set by September 2026. No source for it was ever published. `as66.py` is a recreation read off
Boss's 27-Dec-2025 nine-level winning recording and verified against it frame for frame.

- Canonical source: `external/ARCEngine/games/official/as66.py` (this file is a copy; edit
  the canonical one and copy it here and to `external/ARCEngine/environment_files/as66/v1/`).
- Proof: `external/ARCEngine/tests/games/test_as66.py` replays all 155 recorded actions.
- Spec and history: `docs/plans/2026-09-16-as66-always-sliding-recreation-prd.md`.
- Everything about the game in one place: `docs/reference/arc3/AS66_Lost_Game.md`.
- Spoiler page (also URL-only): `/arc3/games/as66`.

Do NOT publish this game to `sonpham-org/arc-3` (`docs/static/games/`). That catalog is what
the fine-tune pipeline plays and trains on; a holdout that is in the training catalog is not
a holdout.
