---
Author: Claude Sonnet 5
Date: 2026-09-11
PURPOSE: Plan for extending the informal-name spoiler registry (shared/arc3Games/) from
         the original 6 games to the current 25-game ARC-AGI-3 public demo set, documenting
         the AS66 withdrawal finding, and covering the 13 previously-unanalyzed games with
         real mechanics analysis before naming them.
SRP/DRY check: Pass - single plan doc for this effort, no code changes here.
---

# ARC3 25-game naming — plan

## Scope

**In scope**
- Confirm and document that AS66 was withdrawn from the public demo set (done — see
  findings below; note added to `as66.ts`, not a rewrite of its existing content).
- Add `Arc3GameMetadata` entries (or an honestly-partial equivalent) for the 19 public-demo
  games that currently have no entry in `shared/arc3Games/`.
- Assign SK48 the informal name "Skewer Kebabs" (user-specified).
- For 6 of those 19, use the already-verified mechanics analysis in
  `docs/2026-09-02-arc3-official-game-studies.md` (TR87, BP35, WA30, CN04, DC22, LF52).
- For the remaining 13 (AR25, CD82, G50T, KA59, M0R0, R11L, RE86, S5I5, SB26, SC25, SU15,
  TN36, TU93), run a single-pass (non-adversarial) source read per game against the
  obfuscated `.py` in `external/ARCEngine/environment_files/`, write the findings to a new
  doc so they aren't lost, then propose names grounded in what was actually found — with a
  dedicated look at why G50T, M0R0, R11L, S5I5 don't fit the two-letter-prefix code pattern.

**Out of scope**
- Screenshots, replay videos, hints, or "isFullyDocumented: true" for the 19 new entries —
  those assets don't exist and CLAUDE.md forbids inventing them. New entries get
  `isFullyDocumented: false`, empty `hints`, and `resources` limited to the real replay URLs
  already on file in `client/src/data/astraHarnessGap.ts`.
- Renaming or rewriting any of the existing 6 games' informal names.
- Changing the `category: 'preview' | 'evaluation'` enum shape — it's read by
  `Arc3GameSpoiler.tsx` / `Arc3ArchiveGameSpoiler.tsx` for a UI badge. New entries get
  `category: 'evaluation'` (they weren't part of the original 3-game preview announcement)
  with the real "ARC-AGI-3 Public Demo" fact captured in `tags`/`notes` instead.

## Findings: AS66

Withdrawn from the public demo set. Three independent, dated sources agree there are
exactly 25 public-demo games as of Sep 2026 and AS66 is not one of them:
- `https://arcprize.org/tasks?v=3` (live, checked 2026-09-11): "Showing 1-25 of 25" under
  ARC-AGI-3 Public Demo; `three.arcprize.org/games/as66` no longer resolves to a game page.
- `external/ARCEngine/environment_files/` batch download, 2026-08-31 (25 sequential API
  pulls) — same 25 codes, no AS66.
- `client/src/data/astraHarnessGap.ts` (ARC Prize's own published results, 2-Sep-2026) —
  same 25 codes, no AS66.

Semi-private/private set membership is **not verifiable** — those sets are never published.
Report the withdrawal as fact; do not claim a destination.

## TODOs

1. [x] Locate spoiler pages, confirm naming convention, confirm live route.
2. [x] Confirm the 25-game list and the AS66 withdrawal (3 independent sources).
3. [ ] User approves/edits the 7 grounded names (LS20/AS66/FT09/LP85/SP80/VC33 unchanged;
       SK48, TR87, BP35, WA30, CN04, DC22, LF52 proposed).
4. [x] Run single-pass source analysis on the 13 unanalyzed games; write up findings in a
       new doc (`docs/2026-09-11-arc3-public-set-additional-games-study.md`), with a
       dedicated section on the 4 non-two-letter-prefix codes.
5. [x] Proposed names for the 13; user confirmed all names as-is (including SK48). SK48's
       mechanic description was corrected to a shorter, hedged version after the user
       flagged the first draft as overclaiming (not always paired skewers, not necessarily
       matching a "partner") — see sk48.ts's mechanicsExplanation.
6. [x] Wrote `shared/arc3Games/<code>.ts` for all 20 new entries (19 + sk48) + `index.ts`
       registration.
7. [x] Added a withdrawal note to `as66.ts`'s `notes` field (and header).
8. [x] `CHANGELOG.md` entry at top (9.57.0).
9. [ ] Verify build/typecheck, commit, push.

## Docs/Changelog touchpoints

- New: `docs/2026-09-11-arc3-public-set-additional-games-study.md` (13-game analysis).
- Edited: `shared/arc3Games/*.ts`, `shared/arc3Games/index.ts`, `CHANGELOG.md`.
