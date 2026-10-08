# Results audit and medal chart cleanup — 7 October 2026

Author: Codex. Mark requested a deeper comparison with ARC Prize's results pages and a replacement for the compressed medal-race graphic. Existing cleanup and publication approval applies.

## Scope

- Replace the medal chart's clipped leaders, crowded labels and nearly invisible gold band with a focused gold-cutoff view. Offer medal-field and full-board views with truthful axes and readable mobile controls.
- Keep current neutral competition labels, pins, data collection and all other leaderboard work.
- Remove persisted comparison score payloads. Remember model/dataset selections but fetch fresh scores on every page entry so scoring corrections take effect for returning visitors.
- Describe the Hugging Face archive using the observed June 4, 2026 update cutoff rather than claiming a permanent publication shutdown.
- Compare actual public journeys on both sites: results chronology, archived downloads, puzzle answers, model comparisons, failure cost and coverage. Record primary-source evidence in a separate local report for Mark.

## Validation plan

Run focused chart and comparison-cache regressions, production client build and TypeScript diagnostics. Inspect real public board data on desktop and mobile, all chart views, keyboard inspection, ARC-2 reuse, and a comparison that previously displayed a stale score. Publish and verify the affected live pages. Do not start the application database or background workers for preview.

## Completed verification

- 27 tests passed across medal windows/bounds, selection-only caching, existing leaderboard helpers and metadata.
- Production Vite and esbuild server bundles passed.
- Browser checks against real public APIs confirmed ARC-3 and ARC-2 cutoff values, the focused/medal/full ranges, keyboard selection, and no horizontal overflow at phone width. Full view exposes rank 1 at its actual 55.89 score in the sampled ARC-3 snapshot.
- The comparison preview displays the fresh 74.4% harness score, 83/120 fully solved tasks and 119/167 correct test pairs, instead of the obsolete cached 86.7%.
- The comparison evidence report is a local review artifact for Mark, not a message sent to ARC Prize.
- Repository-wide TypeScript diagnostics remain in unrelated existing server/test files; no diagnostics were reported in this change's files. This is not a claim that the whole repository typecheck passes.
