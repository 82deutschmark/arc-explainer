# PuzzleBrowser Gradient & Emoji Enhancement Plan

## Goal
Refresh the PuzzleBrowser page so that interactive zones feel obvious and playful using gradient backgrounds, ARC-inspired emoji mosaics, and more compact filter controls.

## Target Files
- `client/src/components/browser/EmojiMosaicAccent.tsx` (new)
- `client/src/pages/PuzzleBrowser.tsx`
- `client/src/components/puzzle/PuzzleCard.tsx`
- `client/src/components/puzzle/EmojiStatusMosaic.tsx` (new helper if needed)
- `client/src/pages/styles/puzzlebrowser.css` (create only if Tailwind utilities prove insufficient; likely unnecessary)

## Tasks
1. **Emoji Mosaic Component**
   - Build a configurable component that renders 2×2 or 3×3 emoji grids with accessibility-friendly `aria-hidden` usage.
   - Allow presets (hero, filter badge, status) so we can reuse palettes.

2. **Hero Knowledge Hub Revamp**
   - Wrap hero section with a layered gradient background.
   - Position mosaic accents at strategic corners.
   - Upgrade resource tiles to gradient cards with emoji badges indicating interactivity.

3. **Filter Toolbar Color Coding**
   - Split filters into smaller fieldsets and shrink overall footprint.
   - Add gradient headers and compact emoji badges per filter group.
   - Style primary action button with gradient and focus state.

4. **Puzzle Card Gradients**
   - Apply status-based gradient backgrounds.
   - Add mini emoji grid overlay to signal puzzle status.
   - Harmonize button styling with new palette.

5. **QA**
   - Run `npm run lint` (or applicable command) if lightweight enough; otherwise document manual verification.

## Notes
- Prioritize Tailwind + DaisyUI utilities before custom CSS.
- Keep emoji purely decorative; ensure text contrast meets accessibility guidelines.
