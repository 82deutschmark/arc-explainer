# 2025-12-04 Compact Puzzle Card GIF Integration Plan

**Goal:** Show our curated animated ARC GIFs on the compact puzzle cards whenever a matching puzzle ID is available so researchers immediately see the test behavior without relying on TinyGrid previews.

## Context
- The latest commit added 11 ARC1-Eval GIFs under `.claude/skills/slack-gif-creator/ARC1_EVAL/arc_puzzle_<id>.gif`.
- PuzzleDBViewer’s `CompactPuzzleCard` currently fetches `/api/puzzle/task/:id` and renders a TinyGrid of the first test output.
- GIFs live outside `client/public`, so the React app cannot serve them yet.

## Key Decisions
1. **Asset location:** Copy the curated GIFs into `client/public/images/decoration/` (same home as our existing ARC GIF library) so they can be loaded via `/images/decoration/...`.
2. **Deterministic mapping:** Create a simple lookup `PUZZLE_GIF_MAP` that maps puzzle IDs to the GIF filename. This keeps logic explicit and allows future expansion beyond the initial 11 puzzles.
3. **Render priority:** For puzzles in the map, render the GIF preview instead of TinyGrid. For all other puzzles, keep the existing TinyGrid behavior with lazy-loaded task fetch.
4. **Lazy loading:** Reuse the `IntersectionObserver` gating already in `CompactPuzzleCard` so GIFs only load once the card is on screen, preventing unnecessary network usage.

## Implementation Steps
1. **Assets**
   - Copy each GIF from `.claude/skills/slack-gif-creator/ARC1_EVAL/` into `client/public/images/decoration/`.
   - Confirm filenames follow the `arc_puzzle_<id>.gif` pattern.

2. **Mapping helper**
   - Add `client/src/utils/puzzleGifMap.ts` exporting `PUZZLE_GIF_MAP: Record<string, string>` (values are `/images/decoration/...` paths).
   - Optional helper `getPuzzleGif(puzzleId: string): string | undefined`.

3. **Compact card integration**
   - Import the helper into `CompactPuzzleCard`.
   - Detect `const gifSrc = getPuzzleGif(puzzle.id)`.
   - If `gifSrc` exists, render an `<img>` in the preview slot when `isVisible` becomes true; skip the TinyGrid fetch entirely.
   - Maintain the existing TinyGrid fallback (test output -> train output) when no GIF is available.
   - Keep action buttons/metrics unchanged.

4. **Verification**
   - Manually load `/puzzles/database` and scroll until ARC1-Eval entries like `7d419a02` or `50f325b5` appear; ensure the GIF animates smoothly.
   - Confirm cards without mappings still fetch grids and render TinyGrid exactly as before.

## SRP/DRY Check
- SRP: The new helper encapsulates GIF knowledge; `CompactPuzzleCard` remains focused on rendering.
- DRY: Prevents scattering hard-coded paths throughout components, making it easy to add more GIFs later.
