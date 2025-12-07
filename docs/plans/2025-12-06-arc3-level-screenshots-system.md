# ARC-AGI-3 Level Screenshots System Implementation Plan

**Author**: Claude Code using Sonnet 4.5
**Date**: 2025-12-06
**Status**: Planning
**Priority**: Medium

## Executive Summary

Implement a scalable system for displaying level screenshots across all six ARC-AGI-3 games (ls20, as66, ft09, lp85, sp80, vc33). The system allows gradual addition of screenshots as they become available, with each game having up to ~20 level screenshots maximum (since games have 10-20 levels).

---

## 1. Problem Statement

### Current State
- Game metadata exists in `shared/arc3Games.ts` with basic info
- Screenshot URLs are currently stored in `resources` array (mixed with articles/videos)
- No structured way to associate screenshots with specific game levels
- No visual gallery display for level progression

### Issues
- Screenshots mixed with external resources (articles, videos)
- No level organization or visual hierarchy
- Difficult to track which levels have documentation
- Not scalable for incremental screenshot additions

---

## 2. Data Structure Design

### 2.1 New Interface: `LevelScreenshot`

```typescript
/**
 * Screenshot of a specific game level
 */
export interface LevelScreenshot {
  /** Level number (1-based) */
  level: number;

  /** Image URL relative to public folder (e.g., '/ft09-lvl8.png') */
  imageUrl: string;

  /** Optional caption or description */
  caption?: string;

  /** Optional notes about this specific level */
  notes?: string;
}
```

### 2.2 Update `Arc3GameMetadata` Interface

```typescript
export interface Arc3GameMetadata {
  // ... existing fields ...

  /** Level screenshots organized by level number */
  levelScreenshots?: LevelScreenshot[];

  // ... rest of existing fields ...
}
```

### 2.3 Migration Strategy for ft09

**Before** (current `resources` array):
```typescript
resources: [
  {
    title: 'Level 8 Screenshot',
    url: '/ft09-lvl8.png',
    type: 'article',
    description: 'Advanced puzzle layout showing tile complexity at level 8',
  },
  {
    title: 'Level 9 Screenshot',
    url: '/ft09-lvl9.png',
    type: 'article',
    description: 'Advanced puzzle layout showing tile complexity at level 9',
  },
],
```

**After** (new `levelScreenshots` array):
```typescript
levelScreenshots: [
  {
    level: 8,
    imageUrl: '/ft09-lvl8.png',
    caption: 'Advanced puzzle layout showing tile complexity',
    notes: 'Notice the increased frequency of pink checkered tiles',
  },
  {
    level: 9,
    imageUrl: '/ft09-lvl9.png',
    caption: 'Complex tile arrangement with resource management',
  },
],
resources: [
  // Keep only actual external resources (articles, videos, GitHub repos, etc.)
],
```

---

## 3. UI Component Design

### 3.1 Screenshots Section in Mechanics Tab

Add a new collapsible section in the Mechanics tab of `Arc3GameSpoiler.tsx`:

**Location**: After "Action Mappings" card, before "Tags" card

**Component Structure**:
```tsx
{/* Level Screenshots Gallery */}
{game.levelScreenshots && game.levelScreenshots.length > 0 && (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Image className="h-5 w-5" />
        Level Screenshots
      </CardTitle>
      <CardDescription>
        Visual documentation of {game.levelScreenshots.length} level{game.levelScreenshots.length > 1 ? 's' : ''}
        {game.levelCount && ` (${game.levelScreenshots.length} of ${game.levelCount} levels documented)`}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {game.levelScreenshots
          .sort((a, b) => a.level - b.level)
          .map(screenshot => (
            <LevelScreenshotCard key={screenshot.level} screenshot={screenshot} />
          ))}
      </div>
    </CardContent>
  </Card>
)}
```

### 3.2 `LevelScreenshotCard` Component

Individual card for each level screenshot:

```tsx
function LevelScreenshotCard({ screenshot }: { screenshot: LevelScreenshot }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono">
          Level {screenshot.level}
        </Badge>
        {screenshot.caption && (
          <span className="text-sm text-muted-foreground">
            {screenshot.caption}
          </span>
        )}
      </div>

      {/* Image with aspect ratio container */}
      <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
        <img
          src={screenshot.imageUrl}
          alt={`Level ${screenshot.level}`}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>

      {screenshot.notes && (
        <p className="text-xs text-muted-foreground italic">
          {screenshot.notes}
        </p>
      )}
    </div>
  );
}
```

### 3.3 Empty State

When `levelScreenshots` is undefined or empty:
```tsx
{/* No screenshots message - only show if game has levels but no screenshots */}
{game.levelCount && (!game.levelScreenshots || game.levelScreenshots.length === 0) && (
  <Card className="text-center py-8">
    <CardContent>
      <Image className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-30" />
      <p className="text-sm text-muted-foreground">
        No level screenshots documented yet for this game.
      </p>
    </CardContent>
  </Card>
)}
```

---

## 4. Responsive Design

### Layout Strategy
- **Mobile (< 768px)**: 1 column grid, full-width screenshots
- **Desktop (≥ 768px)**: 2 column grid for side-by-side comparison
- **Large screens (≥ 1024px)**: Optional 3 columns if needed (configurable)

### Image Loading
- Use `loading="lazy"` for performance (screenshots below the fold)
- `object-contain` to preserve aspect ratio without cropping
- Square aspect ratio containers (`aspect-square`) for consistent layout

---

## 5. Implementation Checklist

### Phase 1: Data Structure (Completed)
- [x] Define `LevelScreenshot` interface
- [ ] Update `Arc3GameMetadata` interface with `levelScreenshots` field
- [ ] Migrate ft09 screenshots from `resources` to `levelScreenshots`
- [ ] Export updated types

### Phase 2: UI Component
- [ ] Add `Image` icon import from lucide-react
- [ ] Create `LevelScreenshotCard` component in `Arc3GameSpoiler.tsx`
- [ ] Add screenshots gallery section to Mechanics tab
- [ ] Add empty state for games without screenshots
- [ ] Test responsive layout (mobile + desktop)

### Phase 3: Polish & Testing
- [ ] Verify ft09 displays level 8 and 9 screenshots correctly
- [ ] Verify other games show empty state or existing screenshots
- [ ] Test image loading performance with lazy loading
- [ ] Verify aspect ratios and image quality on different screen sizes

### Phase 4: Documentation
- [ ] Update CHANGELOG with new feature
- [ ] Add comments to new component code
- [ ] Document how to add new screenshots in `shared/arc3Games.ts`

---

## 6. Future Enhancements

### Optional Lightbox/Modal View
- Click screenshot to open full-screen lightbox modal
- Navigation between levels within modal
- Zoom controls for detailed inspection

### Progress Tracking
- Visual indicator showing "X of Y levels documented"
- Progress bar or completion percentage per game
- Dashboard view showing screenshot coverage across all games

### Bulk Upload Support
- Helper script to batch-add screenshots
- Auto-generate metadata from filenames (e.g., `ft09-lvl8.png` → level 8)
- Validation to ensure level numbers match game's `levelCount`

---

## 7. Scalability Notes

### Max Screenshots per Game
- Each game has ~10-20 levels maximum
- System designed to handle up to 20 screenshots per game efficiently
- Grid layout scales cleanly from 1 to 20+ items

### Adding New Screenshots
**Process**:
1. Add PNG file to `client/public/` (e.g., `ls20-lvl5.png`)
2. Update game entry in `shared/arc3Games.ts`:
   ```typescript
   levelScreenshots: [
     // ... existing screenshots ...
     {
       level: 5,
       imageUrl: '/ls20-lvl5.png',
       caption: 'Mid-game complexity example',
     },
   ],
   ```
3. No code changes required - UI automatically renders new screenshot

### Performance
- Lazy loading prevents loading all screenshots at once
- Grid layout prevents layout shift as images load
- Images served from static public folder (no CDN needed for now)

---

## 8. Migration Path for All Games

### Current Games to Update
1. **ft09** (Functional Tiles): 2 screenshots ready (levels 8, 9)
2. **ls20** (Locksmith): 0 screenshots (to be added)
3. **as66** (Always Sliding): 0 screenshots (to be added)
4. **lp85** (Loop & Pull): 0 screenshots (to be added)
5. **sp80** (Streaming Purple): 0 screenshots (to be added)
6. **vc33** (Volume Control): 0 screenshots (to be added)

### Gradual Rollout
- Start with ft09 (2 screenshots available now)
- Add screenshots for other games as they become available
- No rush - system supports incremental additions
- Each game stands independently (no dependencies)

---

## 9. Files to Modify

### Data Layer
- `shared/arc3Games.ts` - Add interface, update ft09 entry

### UI Layer
- `client/src/pages/Arc3GameSpoiler.tsx` - Add gallery component

### Assets
- `client/public/ft09-lvl8.png` - Already exists
- `client/public/ft09-lvl9.png` - Already exists

### Documentation
- `CHANGELOG.md` - Document new feature

---

## 10. Success Criteria

✅ ft09 game page displays level 8 and 9 screenshots in a clean gallery
✅ Screenshots maintain proper aspect ratio (square containers)
✅ Other games show appropriate empty state
✅ Responsive layout works on mobile and desktop
✅ Easy to add new screenshots without code changes
✅ Performance remains good with lazy loading

---

## Notes

- This is a **documentation feature**, not a core gameplay feature
- Incremental approach allows slow, steady documentation of all games
- System designed for maintainability - data-driven, no hardcoded logic
- Screenshots provide visual reference for players learning game mechanics
