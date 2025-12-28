# 2025-10-26 – Restore classic PuzzleGrid layout plan

## Goal
Return the Puzzle Examiner grid presentation to the late-August 2025 look-and-feel with simple arrow-separated input/output pairs while keeping the modern sizing utilities stable.

## Context
- Current `PuzzleGridDisplay` uses brand-new bucketing logic that still feels heavier than the Aug 22 layout.
- `PuzzleGrid` styling lost the thicker border and shadow that anchored each grid card in the older design.
- Changelog must reflect the visual regression fix so hobby teammates know why the UI shifted.

## Target files
- `client/src/components/puzzle/PuzzleGrid.tsx`
- `client/src/components/puzzle/PuzzleGridDisplay.tsx`
- `CHANGELOG.md`

## Tasks
1. Reapply the classic border/shadow styling inside `PuzzleGrid` while keeping optional `maxWidth`/`maxHeight` scaling for compact cards.
2. Replace the bucketing layout in `PuzzleGridDisplay` with the straightforward Aug 22-style row cards (Input → Output) for both training and test sections, including dimension labels.
3. Document the visual rollback in `CHANGELOG.md` under a new unreleased entry.
