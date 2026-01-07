# 2026-01-07 landing page simplification plan

## Scope
- Keep `client/src/pages/LandingPage.tsx` hyper-minimal so the retro VisitorCounter is the focal point, but scale the typography dramatically so the counter + “Visitors since launch” label dominate the fold.
- Add a “terrifying” footer strip that reuses the curated animated puzzle GIFs (each linking to its `/task/:id` route) so the bottom of the page feels like an ominous gallery while retaining SRP/DRY compliance.
- Preserve required file header metadata whenever touching TS files and ensure other routes remain untouched.

## Objectives
1. Document the intent so future agents know the counter stays at the top with oversized typography.
2. Add a bottom section that tiles the provided GIF assets, links them to the correct puzzles, and leans into the “terrifying” aesthetic.
3. Keep all other pages/routes unaffected.

## TODOs
- [x] Confirm the plan with the user before making code edits.
- [x] Enlarge the VisitorCounter typography/styling while keeping its retro flair.
- [x] Update `client/src/pages/LandingPage.tsx` to keep the counter at the top and add the terrifying GIF footer with correct links.
- [ ] Mention the change in `CHANGELOG.md` once shipped.
