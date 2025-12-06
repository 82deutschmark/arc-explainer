## Puzzle Browser Compact Card Fix Plan

**Date:** 2025-12-06  
**Goal:** Get the PuzzleBrowser page back to a consistent `CompactPuzzleCard` experience with visible grids/GIFs and correct attempt metrics, while keeping the shared card reusable for PuzzleDBViewer.

### Scope
- `client/src/components/puzzle/CompactPuzzleCard.tsx` – tighten the grid-preload logic, show attempts/wrong/tests metadata, and keep GIF/TinyGrid heuristics reliable.
- `client/src/pages/PuzzleBrowser.tsx` – feed the card real `PuzzleDBStats` (include rich metrics), prefetch featured puzzles’ tasks, and pass prefetched data so the gallery does not render blank placeholders.
- `client/src/hooks/usePuzzleDBStats.ts` – ensure the stats query requests rich metrics so the cards can surface the real attempt/wrong totals the user is asking for.
- `client/src/utils/puzzleGifMap.ts` – double-check the GIF mapping matches the files added under `client/public/images/decoration`.
- `CHANGELOG.md` – add a new version entry describing the fix (bumping the minor version per repository rules).

### Tasks
1. Wire `PuzzleBrowser` to `usePuzzleDBStats({ includeRichMetrics: true })`, map the enriched stats, and prefetch featured puzzle tasks via `useQueries` so their grids appear immediately.
2. Teach `CompactPuzzleCard` to surface attempts, wrongs, test counts, and grid size along with the tiny preview; keep the existing lazy-loading behavior and GIF preference.
3. Confirm the GIF map still references the correct files (no code change if already aligned) and update the changelog with the new version entry documenting the layout/stat improvements.

### Success Criteria
- Featured and results cards show TinyGrid or GIF previews instead of blank white boxes.
- Metric badges report the actual attempts/wrong counts delivered by the database stats.
- PuzzleBrowser continues to share the `CompactPuzzleCard` with PuzzleDBViewer without regressions, and a new changelog entry documents the change.
