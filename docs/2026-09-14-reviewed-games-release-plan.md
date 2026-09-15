# Reviewed games publication — 14 September 2026

Author: Codex (GPT-6).

The user authorized publishing the reviewed improvements in PR 463 and authoring PR 26.
This release incorporates the four human-feedback rounds recorded in the two September 12
feedback plans: 33 changed games, 245 levels, and 34 reviewed public names (PM12 is also
part of the contributed collection). It does not activate the separate unfinished QC loop.

## Integration

- Rebase the complete reviewed change onto website main `7390f5d12394f36a022d244cf2ca02b61583ded2`.
  The original reviewed head is `0a3fc9955e0e7842a96f603802ed0fc0f0035f6e`.
- Preserve all 25 research games, 44 contributed names, four qualified contributed revisions,
  KS01 recovery, and the latest universal Z Undo correction.
- Reuse the shared public-name resolver and action playback helper. Keep contributed
  practice rules scoped to the contributed registry; adding names to reviewed originals
  must not enable practice recovery or change their telemetry mode.
- Regenerate the game artifacts together. Preserve byte-identical old previews when their
  regenerated pixels are unchanged.

## Release checks

- Production Vite and server build: passed.
- Publication integrity: all 94 original/contributed modules pass ownership, source identity,
  authoring-prose stripping, generated data and preview checks.
- Public-name/source tests: passed for all 77 aliases against 119 local and 932 upstream
  catalog entries, including unchanged legacy source versions and contributed-only recovery.
- Four action-playback tests: passed.
- G512: all eight engine levels and key/aperture counterfactuals passed.
- Research collection: all 375 level replays and 25 failure/reset paths passed.
- Full TypeScript check: the same 12 existing diagnostics in unrelated files; no changed-file
  diagnostics. The check needs an 8 GB Node heap in this large workspace.
- The source and packaged campaign checks are recorded with authoring PR 26.

Merge PR 463 after these checks, then compare live source versions with this checkout and
exercise the renamed games in the browser. The GitHub PR and task report record the final
merge/deployment outcome.
