# ARC Hall of Fame Redesign - Card Pack Opening Animation

**Author**: Claude Code using Opus 4.5
**Date**: 2025-12-06
**Status**: Plan Ready for Implementation

## Objective
Implement a card pack opening animation for first-time visitors and refine the Hall of Fame layout to be more information-dense while keeping trading cards as the focal point.

---

## External Links (Already Implemented)
- **Kaggle Leaderboard**: https://www.kaggle.com/competitions/arc-prize-2025/leaderboard
- **ARC Prize YouTube**: https://www.youtube.com/@ARCprize

## Contributor Video Links (Already Implemented)
Names must match exactly as stored in database (`server/scripts/seedContributors.ts`):
- **Alexia Jolicoeur-Martineau**: https://www.youtube.com/watch?v=P9zzUM0PrBM
- **Team NVARC (JF Puget & Ivan Sorokin)**: https://www.youtube.com/watch?v=t-mIRJJCbKg
- **Jean-François Puget (2024 Paper)**: https://www.youtube.com/watch?v=t-mIRJJCbKg

---

## Card Pack Opening Animation - Full Specification

### Overview
When a user visits the Hall of Fame page for the first time, they see a holographic gold card pack that opens to reveal all the contributor cards flying out and settling into their grid positions.

### User Experience Flow
```
┌─────────────────────────────────────────────────────────────┐
│  1. User lands on /hall-of-fame                             │
│  2. Check localStorage for first visit                      │
│  3. IF first visit:                                         │
│     a. Show centered gold holographic card pack             │
│     b. Pack pulses/shimmers (auto or click to open)         │
│     c. Pack bursts open with particle effect                │
│     d. Cards fly out in starburst pattern                   │
│     e. Cards settle into final grid positions               │
│     f. Mark visited in localStorage                         │
│  4. ELSE: Show normal page layout immediately               │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create

### 1. `client/src/hooks/useFirstVisit.ts`

```typescript
/**
 * Hook to detect and track first-time visitors to the Hall of Fame page.
 * Uses localStorage to persist visit state.
 */
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'arc-hall-of-fame-visited';

interface UseFirstVisitReturn {
  isFirstVisit: boolean | null; // null = loading, true = first visit, false = returning
  markVisited: () => void;
  resetVisit: () => void; // For development/testing
}

export function useFirstVisit(): UseFirstVisitReturn {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    // Check localStorage on mount
    const visited = localStorage.getItem(STORAGE_KEY);
    setIsFirstVisit(!visited);
  }, []);

  const markVisited = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setIsFirstVisit(false);
  }, []);

  const resetVisit = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsFirstVisit(true);
  }, []);

  return { isFirstVisit, markVisited, resetVisit };
}
```

---

### 2. `client/src/components/human/CardPackOpening.tsx`

This is the main animation component. Structure:

```typescript
/**
 * Card pack opening animation for first-time visitors.
 * Shows a holographic gold pack that bursts open, scattering cards
 * that then settle into their final positions.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import type { ArcContributor } from '@shared/types/contributor';
import { Crown } from 'lucide-react';

type AnimationPhase = 'pack' | 'opening' | 'scattering' | 'settling' | 'complete';

interface CardPackOpeningProps {
  /** All contributors to animate (limit to first 30 for performance) */
  contributors: ArcContributor[];
  /** Callback when animation completes */
  onComplete: () => void;
  /** Optional: auto-open after delay (ms), default 2000 */
  autoOpenDelay?: number;
}

export const CardPackOpening: React.FC<CardPackOpeningProps> = ({
  contributors,
  onComplete,
  autoOpenDelay = 2000,
}) => {
  const [phase, setPhase] = useState<AnimationPhase>('pack');
  const packControls = useAnimation();

  // Limit cards for performance (use first 30 with images)
  const animatedCards = useMemo(() =>
    contributors.filter(c => c.imageUrl).slice(0, 30),
    [contributors]
  );

  // ... implementation details below
};
```

---

## Animation Phases - Detailed Timing

### Phase 1: Pack Appears (0.5s)
```typescript
// Pack entrance animation
const packEntrance = {
  initial: { scale: 0, rotateY: -180, opacity: 0 },
  animate: {
    scale: 1,
    rotateY: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.34, 1.56, 0.64, 1] // Back ease for bounce
    }
  }
};
```

### Phase 2: Pack Shimmer (1.5s loop until interaction)
```css
/* Holographic shimmer effect */
@keyframes holographic {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.pack-shimmer {
  background: linear-gradient(
    135deg,
    #ffd700 0%,
    #fff8dc 15%,
    #ffd700 30%,
    #daa520 45%,
    #ffd700 60%,
    #fff8dc 75%,
    #ffd700 90%,
    #b8860b 100%
  );
  background-size: 400% 400%;
  animation: holographic 3s ease infinite;
}
```

### Phase 3: Pack Opens (0.3s)
```typescript
// Click handler or auto-trigger
const openPack = async () => {
  setPhase('opening');
  await packControls.start({
    scale: [1, 1.2, 0],
    rotateZ: [0, 5, -5, 0],
    opacity: [1, 1, 0],
    transition: { duration: 0.3, ease: 'easeOut' }
  });
  setPhase('scattering');
};
```

### Phase 4: Cards Scatter (0.8s)
```typescript
// Generate random scatter positions (starburst from center)
const getScatterPosition = (index: number, total: number) => {
  const angle = (index / total) * 2 * Math.PI + Math.random() * 0.5;
  const distance = 200 + Math.random() * 300; // px from center
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
    rotate: Math.random() * 360 - 180,
  };
};

// Card scatter animation
const cardScatter = (index: number, total: number) => ({
  initial: { x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 },
  animate: {
    ...getScatterPosition(index, total),
    scale: 0.6,
    opacity: 1,
    transition: {
      duration: 0.6,
      delay: index * 0.02, // 20ms stagger
      ease: 'easeOut'
    }
  }
});
```

### Phase 5: Cards Settle (1.5s)
```typescript
// Cards animate to final grid positions
// Need to calculate actual DOM positions or use framer-motion layoutId

const cardSettle = (finalPosition: { x: number; y: number }) => ({
  animate: {
    x: finalPosition.x,
    y: finalPosition.y,
    scale: 1,
    rotate: 0,
    transition: {
      duration: 0.8,
      ease: [0.34, 1.56, 0.64, 1] // Back ease for satisfying landing
    }
  }
});
```

---

## Pack Visual Design

### SVG/JSX Structure
```tsx
const CardPack = ({ onClick, isShimmering }) => (
  <motion.div
    onClick={onClick}
    className="relative w-64 h-80 cursor-pointer"
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
  >
    {/* Back of pack (visible during 3D rotation) */}
    <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-amber-800 to-amber-950 rounded-xl border-2 border-amber-600/50" />

    {/* Front of pack */}
    <div className={`absolute inset-0 rounded-xl border-2 border-amber-400/60 shadow-2xl shadow-amber-500/20 overflow-hidden ${isShimmering ? 'pack-shimmer' : ''}`}>
      {/* Inner content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-amber-400/10 to-amber-600/20">
        {/* Crown icon */}
        <Crown className="w-16 h-16 text-amber-300 mb-4" />

        {/* Title */}
        <h2 className="text-2xl font-bold text-amber-100 text-center tracking-wide">
          ARC HALL OF FAME
        </h2>
        <p className="text-amber-200/70 text-sm mt-2">2025 Edition</p>

        {/* Click hint */}
        <p className="absolute bottom-4 text-amber-300/60 text-xs animate-pulse">
          Click to open
        </p>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-2 left-2 w-8 h-8 border-l-2 border-t-2 border-amber-300/40 rounded-tl-lg" />
      <div className="absolute top-2 right-2 w-8 h-8 border-r-2 border-t-2 border-amber-300/40 rounded-tr-lg" />
      <div className="absolute bottom-2 left-2 w-8 h-8 border-l-2 border-b-2 border-amber-300/40 rounded-bl-lg" />
      <div className="absolute bottom-2 right-2 w-8 h-8 border-r-2 border-b-2 border-amber-300/40 rounded-br-lg" />
    </div>
  </motion.div>
);
```

---

## Integration into HumanTradingCards.tsx

```typescript
import { useFirstVisit } from '@/hooks/useFirstVisit';
import { CardPackOpening } from '@/components/human/CardPackOpening';

export default function HumanTradingCards() {
  const { isFirstVisit, markVisited } = useFirstVisit();
  const [showAnimation, setShowAnimation] = useState(true);

  // ... existing hooks ...

  // Collect all contributors for animation
  const allContributors = useMemo(() => [
    ...founders,
    ...topPaperAward2025,
    ...winners2025,
    ...winners2024,
    ...researchers,
    ...pioneers,
    ...arc3Preview
  ], [founders, topPaperAward2025, winners2025, winners2024, researchers, pioneers, arc3Preview]);

  const handleAnimationComplete = () => {
    markVisited();
    setShowAnimation(false);
  };

  // Show loading state while checking first visit
  if (isFirstVisit === null || isLoading) {
    return <LoadingSpinner />;
  }

  // Show pack animation for first-time visitors
  if (isFirstVisit && showAnimation) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 flex items-center justify-center">
        <CardPackOpening
          contributors={allContributors}
          onComplete={handleAnimationComplete}
        />
        {/* Skip button */}
        <button
          onClick={handleAnimationComplete}
          className="fixed bottom-8 right-8 text-zinc-500 hover:text-zinc-300 text-sm"
        >
          Skip Animation
        </button>
      </div>
    );
  }

  // Normal page render
  return (
    <div className="min-h-screen ...">
      {/* existing page content */}
    </div>
  );
}
```

---

## Performance Considerations

1. **Card Limit**: Animate max 30 cards (rest appear instantly after animation)
2. **will-change**: Apply to animated elements
   ```css
   .animated-card { will-change: transform, opacity; }
   ```
3. **Image Preloading**: Preload card images during pack shimmer phase
   ```typescript
   useEffect(() => {
     if (phase === 'pack') {
       animatedCards.forEach(c => {
         if (c.imageUrl) {
           const img = new Image();
           img.src = c.imageUrl;
         }
       });
     }
   }, [phase, animatedCards]);
   ```
4. **RAF for calculations**: Use requestAnimationFrame for position calculations
5. **Reduced motion**: Respect `prefers-reduced-motion` media query
   ```typescript
   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   if (prefersReducedMotion) {
     onComplete(); // Skip animation entirely
     return null;
   }
   ```

---

## Testing Checklist

- [ ] First visit shows pack animation
- [ ] Click on pack triggers opening
- [ ] Auto-open triggers after 2 seconds if no click
- [ ] Cards scatter in starburst pattern
- [ ] Cards settle into grid positions
- [ ] Animation completes and shows normal page
- [ ] Returning visitors see normal page immediately
- [ ] Skip button works
- [ ] Mobile responsive (smaller pack, fewer cards)
- [ ] Reduced motion preference respected
- [ ] Development: can reset visit state for testing

---

## Files Modified (Already Done)

- `shared/types/contributor.ts` - Added `youtube?: string` to links type
- `client/src/components/human/HumanTradingCard.tsx` - Added YouTube link display
- `client/src/pages/HumanTradingCards.tsx` - Compact layout, external links, video mapping

## Files to Create (Pending)

- `client/src/hooks/useFirstVisit.ts` - First visit detection hook
- `client/src/components/human/CardPackOpening.tsx` - Animation component

---

## Dependencies

- **framer-motion**: Already installed (v11.13.1) - used for animations
- **lucide-react**: Already installed - used for Crown icon

---

## Future Enhancements (Optional)

1. **Sound Effects**: Card pack rip sound, whoosh for scatter
2. **Particle Effects**: Confetti or sparkles on pack open
3. **Rare Card Highlight**: Special glow for top paper award winner
4. **Pack Varieties**: Different pack designs for different years
