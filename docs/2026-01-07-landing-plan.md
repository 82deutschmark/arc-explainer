# 2026-01-07 landing page simplification plan

## Scope
- Evaluate the current `client/src/pages/LandingPage.tsx` and replace it with a single `VisitorCounter`-only layout per the owner’s direction—no hero copy, no cards, no filler content.
- Preserve required file header metadata whenever touching TS files and ensure SRP/DRY compliance. Keep other routes untouched.

## Objectives
1. Document the simplified intent so future agents understand why the landing page shows only the counter.
2. Replace the landing page markup with nothing but the `VisitorCounter` component framed by minimal layout semantics.
3. Keep all other pages/routes unaffected.

## TODOs
- [x] Confirm the plan with the user before making code edits.
- [x] Update `client/src/pages/LandingPage.tsx` to render only `VisitorCounter` (with updated header metadata).
- [ ] Mention the change in `CHANGELOG.md` once shipped.
