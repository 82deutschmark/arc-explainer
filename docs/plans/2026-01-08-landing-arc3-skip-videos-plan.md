# Author: Codex (GPT-5)
# Date: 2026-01-08T19:20:00Z
# PURPOSE: Plan to skip problem ARC3 replays on the landing page while keeping other ARC3 replays rotating.
# SRP/DRY check: Pass - uses existing replay assets and landing page structure.

# 2026-01-08 - Landing ARC3 Replay Skip Plan

## Scope
- Update the landing page ARC3 replay rotation to skip AS66 and SP80.
- Keep the canvas replay player and rotate through remaining ARC3 replays.
- Update docs and changelog to reflect the behavior change.

## Objectives
- Avoid failed replay errors on the landing page.
- Preserve current landing layout and reduced-motion behavior.
- Keep ARC3 replay rotation working with available replays.

## TODO
- Update `client/src/pages/LandingPage.tsx` replay list to remove AS66/SP80 and include other available ARC3 replays.
- Adjust landing page header metadata in the file after edits.
- Update `docs/reference/frontend/landing-hero.md` to match the new replay list behavior.
- Add a top entry in `CHANGELOG.md` describing the change and author.
