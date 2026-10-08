# Leaderboard top navigation — 7 October 2026

Author: Codex. Mark requested a direct top-bar Leaderboard link and removal of the ARC-Interactive top-bar link.

- Add Leaderboard as a primary link to the existing `/kaggle-leaderboard` page, which provides ARC-3/ARC-2 switching.
- Reuse the current link rendering, trophy icon and active-route styling. Keep the existing dropdown entry available.
- Remove only ARC-Interactive's external top-bar entry; game/project attribution elsewhere remains intact.
- Keep Leaderboard text visible on phones, give the navigation a full-width mobile row, and name collapsed icon controls for accessibility.
- Build, inspect desktop/mobile layout and navigation, then publish within the already-approved site cleanup.

No leaderboard data, calculations or page behavior changes.

Validation: Vite production build and `git diff --check` passed. Browser inspection at desktop and 390px widths confirmed the visible Leaderboard label, absent ARC-Interactive top-bar link and successful navigation to the existing leaderboard route. The static preview has no API backend, so live leaderboard data is checked after deployment.

A further 320px check exposed left-edge clipping from the centered Radix menu. Keeping the menu at its content width inside the existing scroll container fixed it; the rebuilt preview shows the entire link within the viewport, from x=40 to x=174.
