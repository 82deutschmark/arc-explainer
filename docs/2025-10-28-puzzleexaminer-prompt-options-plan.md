# PuzzleExaminer Prompt Options Restoration Plan (2025-10-28)

## Goal
Restore the full-size prompt configuration experience on PuzzleExaminer to match the prior August 2022 style, replacing the compact dropdown UI that shipped with the recent refactor. Capture historical visuals to document the regression.

## Context & References
- Current implementation: `client/src/pages/PuzzleExaminer.tsx` (uses `CompactControls` component)
- Legacy layout components: `PromptConfiguration`, `AdvancedControls`, `CollapsibleCard`
- Prompt picker UI: `client/src/components/PromptPicker.tsx`

## Tasks
1. Inspect historical commit (pre-`CompactControls` refactor) to confirm expected layout and identify necessary JSX structure.
2. Update `PuzzleExaminer.tsx` to swap the `CompactControls` block with `CollapsibleCard` sections that render `PromptConfiguration` and `AdvancedControls`, ensuring preview + confirm workflow still functions.
3. Verify DaisyUI classes allow prompt options to render full width on desktop and responsive on mobile; adjust spacing if needed.
4. Retain streaming modal + prompt preview logic introduced in recent commits.
5. Capture screenshots:
   - Legacy (Aug 2022) layout reference via historical commit checkout/render.
   - Updated current page after restoration to confirm parity.
6. Run lint/build sanity check if available.

## Validation Checklist
- [ ] Prompt options render as full-width radio list instead of compact select.
- [ ] Advanced controls remain accessible via collapsible card.
- [ ] Prompt preview workflow still triggers modal and confirm action.
- [ ] Streaming modal unaffected by layout changes.
- [ ] Screenshots stored for both legacy and updated UIs.
