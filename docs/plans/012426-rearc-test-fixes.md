# 012426-rearc-test-fixes

## Goal
Address RE-ARC SSE test failures by aligning controller/service behavior with test expectations while keeping production outputs protected.

## Tasks
- [x] server/services/reArc/reArcService.ts (around generateDataset return block): gate ground-truth outputs behind test-only env flag so tests can craft valid submissions without leaking prod outputs.
- [x] tests/reArcController.test.ts (top env setup): enable test-only output exposure to build perfect submission payloads for SSE assertions.
- [x] tests/reArcService.test.ts (top env setup): ensure outputs remain withheld in service-level tests to mirror production behavior.
- [x] CHANGELOG.md: document RE-ARC test fixes and env flag addition with SemVer entry.

## Notes
- New env flag: `RE_ARC_TEST_EXPOSE_OUTPUTS` (default off). Only set to true in controller tests to access ground truth outputs.
- Dev mode remains guarded by `RE_ARC_DEV_MODE` for faster dataset generation during tests.
