## Goal
Deliver a Worm Arena Matches experience that actually responds to user filters and spotlights the long, high-drama matches people care about.

## Notes
- Backend `/api/snakebench/matches` filtering works; problems stem from the frontend (stale Apply reads, clunky defaults).
- Feedback prioritizes long matches → default to high min-rounds and provide quick presets.
- Need deterministic Apply flow (no stale closure bugs) and better UX cues (round presets, clearer defaults, reliable pagination).

## Tasks
1. Introduce a single draft filter state (with ref mirror) so Apply always captures the latest selections even under batched state updates.
2. Auto-bootstrap defaults: pre-select a model, default `minRounds` to a long-match threshold, and set sorting to `rounds desc`.
3. Add long-match preset chips + helper copy; keep min-round input editable but make presets the primary affordance.
4. Ensure pagination uses applied page size, requests ignore stale responses, and the list refreshes immediately after Apply.
5. Update docs/changelog once behavior verified against live API responses.
