# Public site cleanup — 7 October 2026

Author: Codex. Mark approved this work following the public-site audit.

- Use actual dataset test counts and the full dataset denominator for scoring; correct confidence units, combined costs and small-sample labels.
- Correct ARC-3 history, attribution, human-time descriptions and incomplete AS66 labels without changing games.
- Replace the stale `/home` landing with a current resource directory.
- Publish Human ARC navigation and editorial cleanup and update the pinned revision.
- Run regression tests and production build; inspect key pages and publish.

Original findings are recorded in `docs/audits/2026-10-07-public-site-quality.html` and its JSON companion. They describe the pre-fix site. No paid model runs, database rewrites or game-mechanic changes are included.

## Validation before publication

- Production build passed, including pinned Human ARC revision `d6bed3ef3c333171b563050533483c4cc0b801ad`.
- 30 focused tests passed across scoring math, real dataset counts, both repository endpoints, confidence rendering, metadata and hosted Human ARC HTTP routing.
- Browser inspection confirmed the resource directory and Human ARC guest-profile navigation.
- Full TypeScript check still reports 12 pre-existing errors in unrelated server/test code. No changed-file errors were reported; this is not a claim that the repository typecheck passes.
- Existing dependency audit warnings and bundle-size warnings remain outside this visitor-facing cleanup.

## Follow-up visitor pass

Version 9.119.1 deployed successfully on Railway. The live scoring API confirms 120 puzzles and 167 test cases, with the example model recomputed to 39.17% and both-attempt cost coverage present. The live resource hub and hosted Human ARC frontend were confirmed in the browser.

Version 9.120.1 exposes the resource hub and human/AI comparison in the ARC-3 menu as well as the legacy puzzle menu, labels the homepage resource link, and removes a nested main landmark. Further Kaggle leaderboard work belongs to the separate leaderboard chat.
