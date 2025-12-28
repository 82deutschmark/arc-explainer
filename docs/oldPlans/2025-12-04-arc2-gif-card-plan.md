# 2025-12-04 ARC2 GIF Card Integration Plan

**Goal:** Extend the animated GIF preview support on `CompactPuzzleCard` to cover the ARC2-Eval unsolved puzzles using the newly generated assets under `.claude/skills/slack-gif-creator/ARC2_EVAL/`.

## Scope
1. Copy the ARC2 GIFs into `client/public/images/decoration/` so the client can serve them.
2. Expand `PUZZLE_GIF_MAP` to include the ARC2 puzzle IDs and filenames.
3. Ensure PuzzleDBViewer (ARC2 section) now displays the GIFs automatically via the existing `CompactPuzzleCard` logic.

## Steps
1. **Assets**
   - Copy every `arc_puzzle_<id>.gif` in `.claude/skills/slack-gif-creator/ARC2_EVAL/` to `client/public/images/decoration/`.
   - Keep filenames unchanged for consistency.

2. **Mapping**
   - Update `client/src/utils/puzzleGifMap.ts` so the `RAW_PUZZLE_GIF_MAP` includes each ARC2 puzzle ID.
   - Double-check for duplicates or typos.

3. **Verification**
   - Load `/puzzles/database` with ARC2 filter; confirm cards show the animations with no console errors.
   - Scroll to ARC1 cards to ensure existing GIFs still render.

## SRP/DRY Check
- SRP: Only `puzzleGifMap` knows about IDs and filenames, keeping components clean.
- DRY: Reuses the same card logic added previously; no new rendering components required.
