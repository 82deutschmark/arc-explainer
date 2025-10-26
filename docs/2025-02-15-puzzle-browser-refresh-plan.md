# Puzzle Browser Refresh Plan

## Objectives
- Expand emoji mosaic accent component to support wider, more expressive layouts.
- Center key hero sections (filters, knowledge hub) per UX request.
- Remove redundant "Local Puzzles" messaging and tighten header real estate.
- Convert mission statement into modal badge for modular layout.

## Impacted Areas
- `client/src/components/browser/EmojiMosaicAccent.tsx`
- `client/src/pages/PuzzleBrowser.tsx`
- `client/src/components/ui/collapsible-mission.tsx`
- `CHANGELOG.md`

## Implementation Notes
1. **Emoji mosaic flexibility**
   - Replace fixed column union with numeric input and clamp helper to keep responsive.
   - Compute Tailwind grid class dynamically via template string and limit to practical maxima (e.g., 12).
   - Add responsive font sizing adjustments for long strips (>=6 columns).
2. **Hero & knowledge hub layout**
   - Introduce narrower container (e.g., `max-w-6xl`) for header body while keeping background full width.
   - Center knowledge hub card with `mx-auto`, add responsive width constraints.
   - Update hero mosaics once component supports new dimensions.
3. **Filter bar centering**
   - Wrap filter controls in container using `justify-center`, `mx-auto`, `max-w-*` to prevent overflow.
   - Allow wrap on smaller screens with consistent gap spacing.
4. **Mission statement modal badge**
   - Swap collapsible card for badge/button that opens modal with same content.
   - Ensure modal accessible via keyboard, includes close button.
5. **Results header clean-up**
   - Remove "Local Puzzles" text, replace with dynamic count badge and optional context if necessary.
   - Confirm loading/empty states still understandable.
6. **Changelog**
   - Document UI updates succinctly.

## Testing Strategy
- `npm run lint` (if available) or `npm run test` for regression checks.
- Manual review in browser (not available in environment) focusing on hero alignment and modal.
