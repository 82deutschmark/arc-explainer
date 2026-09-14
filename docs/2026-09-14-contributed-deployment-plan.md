# Contributed game release — 2026-09-14

Author: Codex (GPT-6)

The user authorized deployment to arc.markbarney.net and explicitly limited it to contributed games.
This release starts from production main, independent of the unmerged feedback and research branches.

## Release contents

- Stable public names for all 44 games in `contributed-glowup`, using the existing evolution registry.
- Four exact-source revisions with completed machine checks, independent simulated clarity reviews,
  and passing pair comparisons: KS01 (g500), EY09 (g502), PC70 (g519), AQ93 (g542).
- Generated frames, controls and explanations for those four sources. Their printed Z prompts now
  map to ACTION5 in the website; Space also works and the host Undo moves to U for those four only.
- Old links and canonical engine, feedback and telemetry identities remain valid.

The other 40 contributed sources remain at their production revisions. The 25 research games and
unrelated original-game feedback revisions are excluded. This partial website release does not
activate the evolution pool or declare the 44-game simplification batch complete. QC reviews here
are simulated reviews, not human approval.

## Validation and release

1. Pin the four source hashes and verify their exact QC, machine and pair evidence.
2. Use the existing importer to strip authoring prose and substitute canonical engine IDs.
3. Regenerate derived artifacts; replay all 32 levels and recorded losses twice against frozen hashes.
4. Check all 94 published games with the Docker integrity gate; check all 44 public aliases and controls.
5. Build the production client/server and exercise the real local browser player.
6. Merge the scoped release, observe the Railway deployment and verify the live gallery and source hashes.

`arc3-contributed-release-20260914.json` records the source and published hashes and fixture paths.

## Concurrent production update

During preparation, research PR #464 was merged separately as 89b1dff8. This branch integrates
that existing main commit without changing its research sources; its diff against current main
contains only the contributed release and its publication integration. No research work is
merged by this release. The research collection therefore reflects that separate publication.

## Checks completed before release

- All 94 bundled authored/contributed games pass the production publication integrity gate.
- All 44 contributed modules import and respond; all 44 public/legacy source pairs resolve identically.
- Four revised campaigns and their losses replay twice: 32 distinct levels, 16 replays, 5,800 frames.
- Production build passes. Project-wide TypeScript checking reports 12 errors in existing unrelated
  SnakeBench, ingestion and test files; no errors are reported in this release’s changed files.
