* 
* Author: Cascade using Sonnet 4
* Date: 2025-10-11T19:00:00Z
* PURPOSE: VERBOSE DETAILS ABOUT HOW THIS WORKS AND WHAT ELSE IT TOUCHES
* SRP/DRY check: Pass (one markdown plan file, no code duplication)
* shadcn/ui: Pass (plan suggests using existing shadcn/ui components rather than custom)

# PuzzleExaminer Grid Display Improvement Plan

## Goals
- Increase information density; minimise vertical scrolling.
- Support irregular grid sizes and varying training/test pair counts gracefully.
- Keep UI responsive & performant (virtualisation for large sets).
- Maintain SRP by moving grid-related logic out of `PuzzleExaminer.tsx`.

## Proposed Component Decomposition
- **`PuzzleExamplesSection`** _(new)_ – orchestrates training & test sub-sections, accepts `task` prop.
- **`TrainingPairGallery`** _(new)_ – CSS Grid auto-fits `TrainingPairCard`s; lazy-loads when > 20.
- **`TrainingPairCard`** _(new)_ – compact card holding `PuzzleGrid` input→output; click/⤢ opens zoom modal.
- **`TestCaseViewer`** _(new)_ – shows all test inputs; slide-in reveal of answers or toggle.
- **Enhance `PuzzleGrid`** – accepts `maxPixel`, auto-calculates cell px to fit irregular dimensions; caches styles via `useMemo`.

## Layout Strategy
```
<Flex column gap={2}>
  Header
  <PuzzleExamplesSection>
    <TrainingPairGallery/>  // auto-wrap 3-6 cards/row
    <TestCaseViewer/>       // sticky heading
  </PuzzleExamplesSection>
  Rest of Controls/Results
</Flex>
```
- Use `grid-template-columns: repeat(auto-fit, minmax(180px,1fr));` for gallery.
- Reduce card padding/margins; rely on subtle `border` & `shadow-sm`.

## Performance
- `react-window` for card virtualisation when `task.train.length > 40`.
- Memoise grids; avoid re-render on unrelated state via `React.memo`.

## UX Enhancements
- "Compact / Detailed" toggle stores preference in `localStorage`.
- Hover tooltip shows grid dimensions.
- Modal zoom uses shadcn/ui `Dialog` for full-size grid.

## Implementation Sequence
1. Refactor `PuzzleGrid` scaling logic.
2. Create new components under `client/src/components/puzzle/examples/`.
3. Slice out grid rendering block from `PuzzleExaminer.tsx` and replace with new section.
4. Add compact toggle & preference persistence.
5. Integrate virtualization.
6. Remove obsolete styles/margins; test across sample tasks.

---
_Completes doc authoring per project guidelines._
