# 2026-01-08 Landing Label Adjustment Plan

## Objective
Realign the Landing page hero cards so that:
1. The ARC 1&2 card shows its section title and active puzzle name above the frame rather than inside it.
2. The ARC 3 card shows its section title and active game name above the frame rather than inside it.
3. Overall spacing/typography remains consistent with the current minimalist hero aesthetic.

## Tasks
- [x] Inspect `client/src/pages/LandingPage.tsx` to understand the existing DOM structure, typography utilities, and animation hooks.
- [x] Update the layout to add out-of-frame labels (section title + dynamic puzzle/game name) positioned above each card while removing redundant in-frame overlays.
- [x] Verify responsive alignment (mobile + desktop) and ensure hover/animation cues remain intact.

## Dependencies & Notes
- No backend/API work required; changes are purely presentational within `LandingPage.tsx`.
- Maintain accessibility: ensure headings remain readable with adequate contrast.
- After implementation, review the page in dev server before handing off.

## Status
Completed 2026-01-08 — hero labels now sit above each card with consistent spacing, and in-frame overlays were removed to match the request.
