# ARC Hall of Fame Redesign - Card Pack Opening Animation

**Author**: Claude Code using Opus 4.5
**Date**: 2025-12-06
**Status**: Plan Ready for Implementation

---

## Objective

Implement a card pack opening animation for first-time visitors. When the page loads, a holographic gold card pack appears, opens (on click or after 2s), and cards scatter outward then settle into a grid.

---

## External Links (Already Implemented)

- Kaggle Leaderboard: https://www.kaggle.com/competitions/arc-prize-2025/leaderboard
- ARC Prize YouTube: https://www.youtube.com/@ARCprize

## Contributor Video Links (Already Implemented)

Names must match exactly as stored in `server/scripts/seedContributors.ts`:
- **Alexia Jolicoeur-Martineau**: https://www.youtube.com/watch?v=P9zzUM0PrBM
- **Team NVARC (JF Puget & Ivan Sorokin)**: https://www.youtube.com/watch?v=t-mIRJJCbKg
- **Jean-François Puget (2024 Paper)**: https://www.youtube.com/watch?v=t-mIRJJCbKg

---

## Architecture

### File Structure

```
client/src/
├── hooks/
│   ├── useFirstVisit.ts          # localStorage visit tracking
│   └── usePackAnimation.ts       # Animation phase state machine
├── components/human/
│   ├── CardPackOpening.tsx       # Thin orchestrator
│   ├── CardPack.tsx              # Pack visuals + interaction
│   └── ScatteredCard.tsx         # Single animated card
```

### Responsibility Assignment

| Component | Single Responsibility |
|-----------|----------------------|
| `useFirstVisit` | Read/write localStorage for visit tracking. Returns `isFirstVisit`, `markVisited()`, `resetVisit()`. |
| `usePackAnimation` | State machine for animation phases. Handles timing, phase transitions, auto-open timer. No visuals. |
| `CardPack` | Renders the holographic pack visual. Handles click and keyboard (Enter/Space) events. Emits `onOpen`. |
| `ScatteredCard` | Renders one card. Receives scatter position and settle position as props. Animates between them based on phase prop. |
| `CardPackOpening` | Orchestrator only. Calculates positions, passes data to children, coordinates phase callbacks. Contains no animation logic or complex visuals. |

---

## Animation Phases

```
idle → pack → opening → scattering → settling → complete
        │        │          │            │          │
        │        │          │            │          └─ Call onComplete, unmount animation
        │        │          │            └─ Cards animate to grid positions (0.8s, staggered)
        │        │          └─ Cards fly outward in starburst (0.5s, staggered)
        │        └─ Pack burst animation (0.3s)
        └─ Pack visible, shimmering, awaiting click or auto-open (2s timeout)
```

### Timing Summary

| Phase | Duration | Trigger |
|-------|----------|---------|
| pack | Until interaction | Auto-starts on mount |
| opening | 300ms | Click, Enter key, or 2s auto-timer |
| scattering | 500ms + stagger | Automatic after opening |
| settling | 800ms + stagger | Automatic after scatter |
| complete | Instant | Calls `onComplete()`, hides animation overlay |

---

## Position Calculation Strategy

### Problem
Cards must scatter from center, then settle into a grid. The settling grid is NOT the same as the page's actual grid (which has categories, sections, etc.). This is a simplified "reveal" grid.

### Solution: Pre-calculated Centered Grid

1. **Scatter positions**: Calculate on mount using starburst formula
   - Angle: `(index / total) * 2π` (evenly distributed around circle)
   - Distance: Responsive based on viewport width (`min(viewportWidth * 0.3, 250)`)
   - Rotation: Random ±30°

2. **Settle positions**: Pre-calculate a centered grid
   - Responsive columns: 2 (mobile) / 3 (tablet) / 4 (desktop)
   - Card dimensions match `ScatteredCard` size
   - Grid is centered at (0, 0) relative to viewport center
   - Positions are offsets from center, not absolute coordinates

3. **Why not measure actual DOM?**
   - The real page grid doesn't exist yet (animation overlay is fullscreen)
   - Measuring DOM during animation is jank-prone
   - The "settle" grid is a preview, not the final layout
   - After animation completes, the overlay unmounts and real page renders

---

## Transition to Normal Page

### Flow
1. Animation plays in a `fixed inset-0 z-50` overlay
2. Normal page content is NOT rendered during animation (or rendered but hidden)
3. When `onComplete` fires:
   - `CardPackOpening` overlay unmounts
   - Normal `HumanTradingCards` page renders immediately
   - No transition animation between settle grid and real grid (clean cut)

### Why clean cut instead of morph?
- Morphing requires cards to exist in both views simultaneously (complex)
- Real page has categorized sections, not a flat grid
- The settle grid is just a satisfying visual, not the actual layout
- Users understand the animation is a "pack opening" metaphor

---

## Responsive Behavior

| Viewport | Pack Size | Scatter Distance | Settle Columns | Card Size |
|----------|-----------|------------------|----------------|-----------|
| < 640px (mobile) | 224×288 | 80-160px | 2 | 128×176 |
| ≥ 640px (tablet/desktop) | 256×320 | 80-250px | 3-4 | 160×224 |

---

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Keyboard | Pack responds to Enter and Space keys |
| Focus | Pack is focusable with visible focus ring |
| ARIA | Pack has `role="button"`, `aria-label` explaining interaction |
| Reduced motion | Check `prefers-reduced-motion`, skip animation entirely if true |
| Dialog role | Overlay has `role="dialog"` and `aria-label` |

---

## Auto-Open Behavior

- Pack opens on **click OR Enter/Space OR 2-second timeout** (whichever comes first)
- Timer is cleared if user interacts first
- Visual hint: "Click or press Enter to open" text with pulse animation

---

## Dev Testing

The `useFirstVisit` hook exposes `resetVisit()` which clears localStorage.

**Options for surfacing reset:**
1. Add a dev-only button in the page when `import.meta.env.DEV` is true
2. Call `resetVisit()` from browser console: `window.__resetHallOfFameVisit()`
3. Clear localStorage manually in DevTools

Recommend option 1: visible button in bottom corner during development.

---

## Files Already Modified

| File | Change |
|------|--------|
| `shared/types/contributor.ts` | Added `youtube?: string` to links type |
| `client/src/components/human/HumanTradingCard.tsx` | Added YouTube link button |
| `client/src/pages/HumanTradingCards.tsx` | Compact layout, external links, video mapping |

## Files to Create

| File | Purpose |
|------|---------|
| `client/src/hooks/useFirstVisit.ts` | localStorage hook |
| `client/src/hooks/usePackAnimation.ts` | Phase state machine |
| `client/src/components/human/CardPack.tsx` | Pack visual |
| `client/src/components/human/ScatteredCard.tsx` | Single animated card |
| `client/src/components/human/CardPackOpening.tsx` | Orchestrator |

## CSS to Add

Add `pack-shimmer` class and `holographic` keyframes to global styles or component.

---

## Dependencies

- **framer-motion** (v11.13.1, already installed)
- **lucide-react** (already installed, for Crown icon)

---

## Testing Checklist

- [ ] First visit shows pack animation
- [ ] Click opens pack
- [ ] Enter/Space key opens pack
- [ ] Auto-opens after 2 seconds if no interaction
- [ ] Cards scatter in starburst pattern
- [ ] Cards settle into centered grid
- [ ] Animation completes and normal page renders
- [ ] Returning visitors skip animation
- [ ] Skip button works
- [ ] Mobile: smaller pack, closer scatter, 2 columns
- [ ] Tablet: 3 columns
- [ ] Desktop: 4 columns
- [ ] Reduced motion: animation skipped entirely
- [ ] Keyboard navigation works (Tab to pack, Enter to open)
- [ ] Dev reset button clears localStorage

---

## Open Questions

1. **Should cards fade out before real page renders, or hard cut?**
   - Recommendation: Hard cut. It's cleaner and avoids complexity.

2. **What if user has < 4 cards with images?**
   - Handle gracefully: grid adapts, scatter still works.

3. **Should we preload images during shimmer phase?**
   - Optional enhancement. With only ~15 cards, probably unnecessary.
