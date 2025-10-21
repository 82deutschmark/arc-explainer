## Goal
- enforce prompt preview confirmation before any single analysis run initiated from PuzzleExaminer

## Files To Touch
- `client/src/pages/PuzzleExaminer.tsx` - gate analyze handlers behind a confirmation workflow, reuse existing modal props

## To-Dos
- track pending model key + capability so confirm handler can call `analyzeWithModel` safely
- keep manual preview button operating in view-only mode
- after implementation audit other analysis surfaces (ModelTable, debate/refinement UIs) to confirm they already use `PromptPreviewModal`
