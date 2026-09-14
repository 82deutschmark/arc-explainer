# Recoverable contributed play

Author: Codex (GPT-6), 2026-09-14

The user reported that ordinary exploration in KS01 causes unexplained game overs.
Live reproduction: Right twice from the opening board performs two empty rewinds and loses.
The previous winning-sequence checks did not establish discoverability or forgiving play.

This change makes KS01's arrows spatial, moves pulse rewind to an explicit C control,
removes its move limit and empty-rewind penalties, and exposes short contextual guidance.
Across all 44 contributed games, the browser restores the previous position after a fatal
move, explains the recovery, offers unlimited retries, and preserves completed levels when
retrying. A visible moves-remaining readout is provided when a game exposes its budget.
Other puzzle rules and win conditions remain in the game engines. Recovery runs are versioned
separately in telemetry so they are distinguishable from earlier strict play.

Verification covers real loss sequences, undo/checkpoint behavior, all KS01 levels, random
exploration, browser controls, published artifacts and a production build before deployment.

Implemented and checked:

- KS01: eight genuine level wins through both direct engine play and recovery mode;
  100 additional exploration moves and 8,000 state-machine probes without a loss.
- All 44 contributed games: 692 exploratory actions on the final sources. Actual losing
  moves in each of the other 43 games were restored twice. Recorded failures and later-level
  checkpoint retries were also verified for EY09, PC70 and AQ93.
- Browser reproduction: Right, Right no longer loses; empty C reports no pulse; rapid
  inputs do not overlap animation. Goal and recovery guidance sit beside the desktop board.
- Publication integrity: all 94 authored/contributed sources and generated artifacts pass.
  Five public-ID/control/version tests and the production build pass. Full TypeScript checking
  retains the same 12 pre-existing errors in unrelated server and test files; changed files
  introduce none.

Retry checkpoints last for the current browser run. Reloading the page starts a fresh run.
The old KS01 QC record remains historical; the superseding revision and source hash are in
`arc3-contributed-recovery-20260914.json`. Practice session identity is the hexadecimal SHA256
of the engine source version plus `:retry1`, keeping it valid for the existing telemetry
schema while distinguishing it from strict engine sessions.
