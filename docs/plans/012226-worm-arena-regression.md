# 012226-worm-arena-regression.md

## Goal
Identify and fix the regression that broke the Worm Arena stats, placement, and skill analysis pages after the latest greatest-hits refactor.

## Tasks
1. [ ] Baseline behavior
   - Reproduce the failure on `client/src/pages/WormArenaStats.tsx`, `client/src/pages/WormArenaPlacement.tsx`, and `client/src/pages/WormArenaSkillAnalysis.tsx`.
   - Capture console/network errors to confirm failing modules.
2. [ ] Root cause analysis
   - Inspect recent changes (merge helper, pinned games, vitest config) for shared imports or side effects consumed by the stats/placement/skill pages.
   - Verify shared Worm Arena hooks (`useWormArenaGreatestHits`, `useWormArenaStats`, etc.) still export expected shapes.
3. [ ] Fix + verification
   - Implement targeted fix (restore missing exports, adjust imports, or revert accidental renames).
   - Re-run affected pages/tests to confirm stats/placement/skill analysis render correctly.
4. [ ] Documentation / changelog
   - Update `CHANGELOG.md` and any relevant docs with the regression fix summary.
