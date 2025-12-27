## 2025-11-21 — Puzzle Examiner Color-Only Grid Toggle Plan

### Objective
Add a lightweight UI toggle beside the existing emoji control so Puzzle Examiner users can hide numeric labels and view training/test grids as color blocks only.

### Key References
- `client/src/pages/PuzzleExaminer.tsx` — owns header controls and passes props to `PuzzleGridDisplay`.
- `client/src/components/puzzle/PuzzleHeader.tsx` — current emoji toggle and solver buttons.
- `client/src/components/puzzle/PuzzleGridDisplay.tsx` — renders PuzzleGrid pairs.
- `client/src/components/puzzle/PuzzleGrid.tsx` & `client/src/components/puzzle/GridCell.tsx` — low-level rendering, needs awareness of color-only mode.
- `client/src/types/puzzle.ts` — prop contracts for PuzzleGrid/GridCell.

### Implementation Notes / TODOs
1. **State plumbing**
   - Add `showColorOnly` boolean state to `PuzzleExaminer`.
   - Pass toggle callbacks to `PuzzleHeader` and `PuzzleGridDisplay`.
2. **Header UI**
   - Introduce button next to emoji toggle that switches between `Show Colors Only` and `Show Numbers`.
   - Disable or visually note that emoji view overrides color-only (auto-off when emojis enabled).
3. **Grid rendering**
   - Extend props so `PuzzleGrid`/`GridCell` know when to suppress numbers.
   - Ensure background colors remain unchanged; consider accessible `aria-label` for hidden values.
4. **Changelog**
   - Document feature at top of `CHANGELOG.md` with semantic version bump per instructions.

### Test / Verification
- Load Puzzle Examiner (any task) and verify three modes:
  1. Default numbers (button reads “Show Colors Only”).
  2. Color-only (numbers hidden, backgrounds intact).
  3. Emojis override (color-only auto-disabled or ignored).
- Confirm props typing builds without TS errors.
