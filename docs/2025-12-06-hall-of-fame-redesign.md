# ARC Hall of Fame Redesign - Card Pack Opening Animation

## Objective
Implement a card pack opening animation for first-time visitors and refine the Hall of Fame layout to be more information-dense while keeping trading cards as the focal point.

## External Links to Include
- Kaggle Leaderboard: https://www.kaggle.com/competitions/arc-prize-2025/leaderboard
- ARC Prize YouTube: https://www.youtube.com/@ARCprize

## Contributor Video Links (exact names from database)
- **Alexia Jolicoeur-Martineau**: https://www.youtube.com/watch?v=P9zzUM0PrBM
- **Team NVARC (JF Puget & Ivan Sorokin)**: https://www.youtube.com/watch?v=t-mIRJJCbKg
- **Jean-François Puget (2024 Paper)**: https://www.youtube.com/watch?v=t-mIRJJCbKg

## Files to Modify
- `client/src/pages/HumanTradingCards.tsx` - Main page with animation orchestration
- `client/src/components/human/HumanTradingCard.tsx` - Add animation-ready props

## Files to Create
- `client/src/components/human/CardPackOpening.tsx` - Card pack animation component
- `client/src/hooks/useFirstVisit.ts` - localStorage hook for first-visit detection

## Implementation Tasks

### Phase 1: First-Visit Detection Hook

1. Create `client/src/hooks/useFirstVisit.ts`:
```typescript
const STORAGE_KEY = 'arc-hall-of-fame-visited';

export function useFirstVisit() {
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);

  useEffect(() => {
    const visited = localStorage.getItem(STORAGE_KEY);
    setIsFirstVisit(!visited);
  }, []);

  const markVisited = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setIsFirstVisit(false);
  }, []);

  return { isFirstVisit, markVisited };
}
```

### Phase 2: Card Pack Animation Component

2. Create `client/src/components/human/CardPackOpening.tsx` using framer-motion (already installed v11.13.1):
   - Import `motion`, `AnimatePresence`, `useAnimation` from `framer-motion`
   - Create a gold/holographic card pack visual (SVG or styled div)
   - Pack should have a "tear open" animation triggered on click or auto-play
   - Cards fly out in a scatter pattern with staggered delays
   - Each card animates to its final grid position

3. Animation sequence design:
   - **Step 1**: Pack appears centered (scale 0 -> 1, duration 0.5s)
   - **Step 2**: Pack glows/shimmers (CSS animation or framer-motion)
   - **Step 3**: User clicks pack OR auto-open after 1.5s delay
   - **Step 4**: Pack "bursts" open (scale 1.2 -> 0, opacity fade)
   - **Step 5**: Cards emerge from center, scatter in starburst pattern
   - **Step 6**: Cards settle into final grid positions (stagger 50ms per card)

4. CardPackOpening component structure:
```typescript
interface CardPackOpeningProps {
  contributors: ArcContributor[];
  onComplete: () => void;
}

// States: 'pack' | 'opening' | 'scattering' | 'settling' | 'complete'
```

### Phase 3: Update HumanTradingCard for Animation Support

5. Modify `client/src/components/human/HumanTradingCard.tsx`:
   - Add optional `animationDelay?: number` prop
   - Add optional `initialPosition?: { x: number; y: number }` prop
   - Wrap card in `motion.div` when animation props provided
   - Use `initial`, `animate`, and `transition` for entrance animation

### Phase 4: Integrate Animation into Page

6. Update `client/src/pages/HumanTradingCards.tsx`:
   - Import `useFirstVisit` hook
   - Import `CardPackOpening` component
   - Add state: `const [animationComplete, setAnimationComplete] = useState(false)`
   - Conditional render:
     - If `isFirstVisit && !animationComplete`: show `<CardPackOpening />`
     - Otherwise: show normal grid layout

7. Pass all contributors to CardPackOpening:
```typescript
const allContributors = useMemo(() => [
  ...founders,
  ...topPaperAward2025,
  ...winners2025,
  ...winners2024,
  ...researchers,
  ...pioneers,
  ...arc3Preview
], [founders, topPaperAward2025, ...]);
```

### Phase 5: Layout Refinements

8. In `HumanTradingCards.tsx`, further reduce spacing:
   - Change `space-y-5` to `space-y-3`
   - Change `gap-3` to `gap-2`
   - Change `py-4` to `py-3`
   - Section headers: reduce `pb-2` to `pb-1`

9. Card sizing strategy (keep `max-w-[280px]` but allow smaller on dense grids):
   - Current: `max-w-[280px]` with `aspect-[3/4]`
   - Consider adding responsive sizing: `max-w-[240px] xl:max-w-[260px]`
   - Grid columns already good: 2/3/4/5/6 columns responsive

### Phase 6: Card Pack Visual Design

10. Create card pack SVG/styling in `CardPackOpening.tsx`:
    - Gold foil wrapper with holographic gradient
    - ARC Prize logo or Crown icon on pack front
    - "ARC Hall of Fame 2025" text
    - Use CSS gradients for holographic effect:
      ```css
      background: linear-gradient(
        135deg,
        #ffd700 0%,
        #fff 25%,
        #ffd700 50%,
        #b8860b 75%,
        #ffd700 100%
      );
      ```

11. Pack tear animation options:
    - CSS clip-path animation (performant)
    - Two-piece pack that splits apart
    - Scale + rotate + fade out

### Phase 7: Performance Optimization

12. Performance considerations:
    - Use `will-change: transform` on animated cards
    - Limit to 20-30 cards in the scatter animation (rest appear instantly)
    - Use `layoutId` for framer-motion shared layout transitions
    - Preload all card images before animation starts

13. Add skip button for returning visitors or impatient users:
    - "Skip Animation" button in corner
    - Calls `markVisited()` and `setAnimationComplete(true)`

### Phase 8: Sound Effects (Optional Enhancement)

14. Optional: Add sound effects:
    - Card pack open sound
    - Card scatter whoosh
    - Use Web Audio API with user interaction gate
    - Store mute preference in localStorage

## Integration Points

- `useArcContributors` hook provides all card data
- `HumanTradingCard` component handles individual card rendering
- framer-motion already in package.json (v11.13.1)
- localStorage pattern established in `useEloVoting.ts`

## Animation Library Decision

**Recommendation: framer-motion** (already installed)

Reasons:
- Already a project dependency
- `AnimatePresence` handles enter/exit animations cleanly
- `layout` prop enables automatic position transitions
- `useAnimation` allows imperative control for sequencing
- Supports staggered children animations via `staggerChildren`
- No additional bundle size

Alternative considered:
- CSS animations: Simpler but harder to coordinate multi-step sequences
- react-spring: Not installed, similar capability to framer-motion

## Validation

Development plan complete. Implementation can proceed with Phase 1 (useFirstVisit hook) and Phase 2 (CardPackOpening component) in parallel, followed by integration in Phases 4-5.

Key files for implementation agent:
- Start with: `client/src/hooks/useFirstVisit.ts` (new)
- Then: `client/src/components/human/CardPackOpening.tsx` (new)
- Update: `client/src/pages/HumanTradingCards.tsx`
- Update: `client/src/components/human/HumanTradingCard.tsx`
