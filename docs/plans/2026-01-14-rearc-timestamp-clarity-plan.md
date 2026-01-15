# 2026-01-14 RE-ARC timestamp clarity plan

## Context
Users reported RE-ARC submissions table showing dataset generation times as future-relative (e.g., "in 6 days"). The relative phrasing is confusing and incorrect; we should present the authoritative generation timestamp plainly.

## Goals
- Show the dataset generation time as an unambiguous timestamp only (no relative wording).
- Keep evaluation time and elapsed time columns intact.
- Avoid changing backend data shape.

## Non-Goals
- Changing dataset seed derivation or storage.
- Altering evaluation logic, scoring, or leaderboard ordering.

## Plan
1) Adjust the RE-ARC submissions table rendering to display the dataset generation timestamp as a plain UTC timestamp (no relative text).
2) Ensure tooltip/help copy reflects the simplified display.
3) Verify table still sorts/pages correctly and elapsed time remains unchanged.

## Verification
- Load `/re-arc/submissions`, confirm "Dataset Generated" shows only the UTC timestamp with no "in X days" phrasing.
- Check pagination and sort still work.
