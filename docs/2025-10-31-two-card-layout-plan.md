## Goal
Rework the Puzzle Examiner layout so that "Prompt Style" and "Advanced Controls" render as two compact cards side by side, with dense yet readable controls.

## Tasks
1. Update `client/src/pages/PuzzleExaminer.tsx` to replace the stacked `CollapsibleCard` instances with a responsive two-card grid using DaisyUI cards.
2. Refactor `client/src/components/puzzle/PromptConfiguration.tsx` to adopt the compact card layout (tight spacing, DaisyUI-friendly buttons, tooltip help) and ensure the preview call to action aligns to the new design.
3. Redesign `client/src/components/puzzle/AdvancedControls.tsx` into a high-density grid with inline value displays, numeric inputs beside sliders, and collapsible reasoning parameters.
4. Verify component props/state wiring remains intact, polish ARIA/tooltip text, and update `CHANGELOG.md` with a summary of the UI refinements.
