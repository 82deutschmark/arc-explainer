# Card comparison and TypeScript cleanup

Author: GPT-6 / Codex · October 29, 2026

## Goal

Show Mark Barney's player card beside Team Turducken's team card using the latest committed
card data and the existing PNG renderer. Clear all TypeScript diagnostics across the project
without weakening checks, suppressing errors or changing unrelated product behavior.

## Work

1. Bring this clean checkout up to date. Render the two exact cards locally and place their
   unchanged PNGs side by side in a comparison image for this chat.
2. Fix the matchup API's model-summary mismatch using the existing ranking/score definitions,
   and handle unknown timing in the external-results importer according to its data contract.
3. Update stale stream-event and repository-test contracts, and complete the placement test's
   required rating fields. Keep meaningful assertions and use current production types.
4. Declare and install the frontend test libraries already imported by its setup file.
5. Run the full TypeScript check, focused tests for affected modules and the production build.
   Update this plan and the changelog, commit and push to main.

## Constraints

Reuse the card renderer and artwork. Do not regenerate illustrations, change reported scores,
alter public honors, post to social accounts, or investigate deployment credentials. Keep the
compiler's strict settings and test coverage intact. Publication finishes at a successful push.

## Completion

- [x] Current player/team comparison rendered and shown
- [x] Production and test type errors resolved
- [x] TypeScript, focused tests and production build pass
- [x] Documentation and final publication prepared

## Result

The comparison is saved under `docs/newsroom/card-proofs/2026-10-29/mark-and-turducken-proof.png`.
It contains the production PNG fronts for P018 (Mark Barney) and T014 (Team Turducken),
with unchanged artwork and their saved October 29 standings. No website or card data changed.

The matchup service now shares its complete response type rather than dropping rank and
display score in a duplicate annotation. The Johan import DTO preserves unknown timing as
null, matching its existing importer and persistence behavior. Stream fixtures use the current
event/completion contract. Repository spies and placement fixtures now have complete types.

Frontend test dependencies are declared and locked, using versions compatible with Node 20.
The setup uses the library's Vitest integration for both runtime and typed matchers. Two actual
card-control tests cover successful copying and the selectable URL when copying is denied.

`npm run check` reports zero errors. All 29 focused checks pass (15 matchup/placement/card
checks, 12 stream/repository checks and two frontend sharing checks). The production build
passes. Compiler strictness and all existing assertions remain intact.
