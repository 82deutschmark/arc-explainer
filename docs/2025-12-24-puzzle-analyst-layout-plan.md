Author: Codex
Date: 2025-12-24
PURPOSE: Document the Puzzle Analyst layout refresh plan so every change is tracked and clear.
SRP/DRY check: Pass - describes UI work only, calls out reuse of existing TinyGrid and AnalysisResultCard.

# Puzzle Analyst Layout Refresh Plan

## Goals

- Deliver the dense black-table aesthetic described in the reference mockups by tightening row spacing, aligning columns, and exposing all key metadata in a single header.
- Keep the page read-only and reuse existing components (`TinyGrid`, `AnalysisResultCard`) instead of inventing new tools.
- Capture the new layout steps so future contributors understand the scope.

## Files to update

1. `client/src/components/puzzle/ExplanationGridRow.tsx` - redesign the compact row header, detail loading, and footer. Ensure comments describe behavior.
2. `client/src/pages/PuzzleAnalyst.tsx` - adjust container/padding, sticky header, and grid container to support the new dense layout.

## Todos

1. Audit the current row layout and detail loading logic (ensures no hidden state transitions are overlooked).
2. Rebuild the row component header to show model name, attempt metadata, cost/tokens, reasoning indicator, and expand toggle with proper spacing.
3. Ensure the expansion area uses `AnalysisResultCard` only when details are loaded, showing a background that blends with the dense theme.
4. Fine-tune the PuzzleAnalyst page to match (collapsed header, scrollable area, responsive adjustments).
5. Document the change in `CHANGELOG.md` with a new version entry referencing the updated files.

## Update

- Add stacked grid previews for multi-test predictions and pass expected outputs into `AnalysisResultCard` so grids and mismatch toggles work.
