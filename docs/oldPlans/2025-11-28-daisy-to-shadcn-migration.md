# DaisyUI to shadcn/ui Migration Plan
**Date**: 2025-11-28
**Scope**: PuzzleExaminer page and related components
**Priority**: High
**Estimated Time**: 60-75 minutes

---

## Overview

Convert PuzzleExaminer page from DaisyUI to shadcn/ui for consistency with the rest of the codebase (30+ files already using shadcn/ui) and to address user dissatisfaction with the current DaisyUI implementation.

**Rationale**:
- Project already has comprehensive shadcn/ui infrastructure in place
- DaisyUI adds unnecessary CSS overhead alongside Tailwind
- shadcn/ui provides better accessibility (Radix UI primitives)
- More flexible component APIs and variant systems

---

## Current State Analysis

### DaisyUI Usage in Target Components

| Component | Location | DaisyUI Classes | Severity |
|-----------|----------|-----------------|----------|
| **PromptPreviewModal** | `client/src/components/PromptPreviewModal.tsx` | modal, modal-box, modal-action, btn-*, modal-backdrop | 🔴 HIGH |
| **PuzzleExaminer** | `client/src/pages/PuzzleExaminer.tsx` | card, card-compact, alert, badge, skeleton, bg-base-*, border-base-*, text-base-content | 🔴 HIGH |
| **ModelSelectionControls** | `client/src/components/puzzle/ModelSelectionControls.tsx` | btn, btn-sm, btn-ghost, border-base-*, bg-base-* | 🟡 MEDIUM |
| **ModelProviderGroup** | `client/src/components/puzzle/ModelProviderGroup.tsx` | bg-base-*, hover:bg-base-*, text-base-content/* | 🟡 MEDIUM |
| **ModelSelection** | `client/src/components/puzzle/ModelSelection.tsx` | text-base-content/* | 🟢 LOW |

### Non-Target Files (No Changes Needed)

| File | Reason |
|------|--------|
| `client/src/hooks/useModelGrouping.ts` | Pure state management, zero UI framework dependencies |
| `client/src/components/puzzle/ModelButton.tsx` | Already uses shadcn/ui Button (no changes needed) |
| `client/src/components/puzzle/ModelFamilyGroup.tsx` | Minimal color tokens, covered in ModelProviderGroup updates |

---

## Migration Strategy

### Phase 1: Modal & Button Components (HIGHEST PRIORITY)

#### 1.1 PromptPreviewModal.tsx

**Problem**: Uses native `<dialog>` element with DaisyUI modal classes and `.showModal()` JavaScript complexity.

**Solution**: Replace with shadcn/ui Dialog component.

**Changes**:
```typescript
// OLD (Current)
import React, { useState, useEffect, useRef } from 'react';

const dialogRef = useRef<HTMLDialogElement>(null);

useEffect(() => {
  if (!dialogRef.current) return;
  if (isOpen) {
    dialogRef.current.showModal();
  } else {
    dialogRef.current.close();
  }
}, [isOpen]);

return (
  <dialog ref={dialogRef} className="modal" style={{ zIndex: 9999 }}>
    <div className="modal-box max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
      {/* content */}
    </div>
    <form method="dialog" className="modal-backdrop">
      <button onClick={onClose}>close</button>
    </form>
  </dialog>
);

// NEW (Target)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          Prompt Preview - {promptId}
          {promptPreview?.selectedTemplate?.emoji && (
            <span className="ml-2">{promptPreview.selectedTemplate.emoji}</span>
          )}
        </DialogTitle>
      </DialogHeader>

      {/* content */}

      <DialogFooter>
        {confirmMode ? (
          <>
            <Button variant="ghost" onClick={onClose} disabled={isConfirming}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleConfirm}
              disabled={isConfirming || !promptPreview || isLoading}
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Starting...
                </>
              ) : (
                confirmButtonText
              )}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

**Button Migrations**:
- `btn btn-outline btn-sm` → `<Button variant="outline" size="sm">`
- `btn btn-ghost` → `<Button variant="ghost">`
- `btn btn-primary` → `<Button variant="default">`
- `btn` → `<Button>`

**Removals**:
- Delete `useRef` and dialog control `useEffect`
- Remove `<form method="dialog">` (Dialog handles this)
- Remove `ref={dialogRef}` from dialog

**Files Modified**: 1

---

#### 1.2 ModelSelectionControls.tsx

**Problem**: Uses DaisyUI button classes.

**Solution**: Simple button component replacement.

**Changes**:
```typescript
// OLD
<button className="btn btn-sm btn-ghost border border-base-300 hover:bg-base-200 gap-1">
  <ChevronDown className="h-4 w-4" />
  Expand All
</button>

// NEW
<Button variant="outline" size="sm" className="gap-1">
  <ChevronDown className="h-4 w-4" />
  Expand All
</Button>
```

**New Import**:
```typescript
import { Button } from '@/components/ui/button';
```

**Changes**:
- Replace two `<button>` elements with `<Button>` components
- `btn btn-sm btn-ghost border border-base-300 hover:bg-base-200` → `variant="outline" size="sm"`
- Remove `className="mb-3 flex justify-end gap-2 px-2"` from parent (keep parent structure)

**Files Modified**: 1

---

### Phase 2: Card & Layout Components

#### 2.1 PuzzleExaminer.tsx

**Problem**: Extensive DaisyUI usage: cards, alerts, skeletons, color utilities.

**Solution**: Replace with shadcn/ui components and semantic color tokens.

**2.1.1 Card Components (Lines 358-416)**:

```typescript
// OLD
<section className="card card-compact bg-base-100 shadow-sm border border-base-200">
  <div className="card-body gap-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="card-title text-sm font-semibold">Prompt Style</h3>
        <p className="text-xs text-base-content/70">
          Select the template, tweak emoji options, and preview the compiled instructions.
        </p>
      </div>
      <span className="badge badge-outline badge-xs uppercase tracking-wide">Prompt</span>
    </div>
    <PromptConfiguration {...props} />
  </div>
</section>

// NEW
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

<Card className="border-border">
  <CardHeader>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <CardTitle className="text-sm">Prompt Style</CardTitle>
        <CardDescription className="text-xs mt-1">
          Select the template, tweak emoji options, and preview the compiled instructions.
        </CardDescription>
      </div>
      <Badge variant="outline" className="text-xs uppercase tracking-wide">
        Prompt
      </Badge>
    </div>
  </CardHeader>
  <CardContent className="gap-3 flex flex-col">
    <PromptConfiguration {...props} />
  </CardContent>
</Card>
```

**Key Changes**:
- `card card-compact` → `<Card>`
- `card-title` → `<CardTitle>`
- `card-body` → `<CardContent>` (with `flex flex-col gap-3`)
- `text-base-content/70` → `CardDescription` or `text-muted-foreground`
- `badge badge-outline badge-xs` → `<Badge variant="outline">`
- `bg-base-100 shadow-sm border border-base-200` → removed (Card defaults handle this)

**Apply to both cards**:
- "Prompt Style" card (line 358)
- "Advanced Controls" card (line 387)

---

**2.1.2 Alert Components (Lines 101, 318)**:

```typescript
// OLD
<div role="alert" className="alert alert-error">
  <span>Failed to load puzzle: {taskError?.message || 'Puzzle not found'}</span>
</div>

// NEW
import { Alert, AlertDescription } from '@/components/ui/alert';

<Alert variant="destructive">
  <AlertDescription>
    Failed to load puzzle: {taskError?.message || 'Puzzle not found'}
  </AlertDescription>
</Alert>
```

**Files to update**:
- Line 101: Invalid puzzle ID error
- Line 318: Task load error

---

**2.1.3 Skeleton Components (Lines 487)**:

```typescript
// OLD
<div className="space-y-3">
  {[1, 2, 3].map((i) => (
    <div key={i} className="skeleton h-32 w-full"></div>
  ))}
</div>

// NEW
import { Skeleton } from '@/components/ui/skeleton';

<div className="space-y-3">
  {[1, 2, 3].map((i) => (
    <Skeleton key={i} className="h-32 w-full" />
  ))}
</div>
```

---

**2.1.4 Color Token Mapping**:

Replace throughout PuzzleExaminer.tsx:

| DaisyUI | shadcn/ui / Tailwind | Context |
|---------|----------------------|---------|
| `bg-base-100` | `bg-background` or `bg-card` | Card backgrounds |
| `bg-base-200` | `bg-muted` | Secondary backgrounds |
| `bg-base-300` | `bg-input` or lighter | Tertiary backgrounds |
| `border-base-200` | `border-border` | Card borders |
| `border-base-300` | `border-border` | Darker borders |
| `text-base-content` | `text-foreground` | Primary text |
| `text-base-content/60` | `text-muted-foreground` | Secondary text |
| `text-base-content/70` | `text-muted-foreground` | Secondary text |
| `hover:bg-base-200` | `hover:bg-muted` | Hover states |
| `hover:bg-base-300` | `hover:bg-accent` | Hover states |

**Lines to update**:
- Line 358: Card backgrounds and borders
- Line 387: Card backgrounds and borders
- Line 419: Model selection container
- Line 423: Header button hover state

---

**2.1.5 Streaming Modal (Lines 495-535)**:

**Option A** (Quick): Keep as-is for now
**Option B** (Consistent): Convert to shadcn/ui Dialog

```typescript
// Option B - Convert streaming modal
<Dialog open={isStreamingActive} onOpenChange={closeStreamingModal}>
  <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>
        {`Streaming ${streamingModel?.name ?? streamingModelKey ?? 'Analysis'}`}
      </DialogTitle>
    </DialogHeader>
    <StreamingAnalysisPanel {...props} />
  </DialogContent>
</Dialog>
```

**Recommendation**: Implement Option A first (keep as-is), migrate in Phase 2 if time permits.

---

**New Imports for PuzzleExaminer**:
```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
```

---

#### 2.2 ModelProviderGroup.tsx

**Problem**: Uses DaisyUI color utilities.

**Solution**: Replace with semantic color tokens.

**Changes**:
```typescript
// OLD (Line 72)
className="w-full flex items-center justify-between p-2 bg-base-200 rounded-lg hover:bg-base-300 transition-colors text-left"

// NEW
className="w-full flex items-center justify-between p-2 bg-muted rounded-lg hover:bg-accent transition-colors text-left"

// OLD (Line 85)
<p className="text-xs text-base-content/60">

// NEW
<p className="text-xs text-muted-foreground">
```

**No new imports needed** - uses only Tailwind utilities.

---

#### 2.3 ModelSelection.tsx

**Problem**: Minimal DaisyUI usage (only color tokens).

**Solution**: Update color classes.

**Changes**:
```typescript
// OLD (Empty state)
<p className="text-sm">No models available.</p>
<div className="text-center py-8 text-base-content/60">

// NEW
<p className="text-sm">No models available.</p>
<div className="text-center py-8 text-muted-foreground">
```

**No new imports needed**.

---

## Implementation Checklist

### PromptPreviewModal.tsx
- [ ] Add shadcn/ui Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter imports
- [ ] Add Button component import
- [ ] Remove dialogRef useRef
- [ ] Remove dialog control useEffect
- [ ] Replace `<dialog>` with `<Dialog open={isOpen} onOpenChange={onClose}>`
- [ ] Structure content with DialogHeader, DialogDescription, DialogFooter
- [ ] Migrate button variants to shadcn/ui Button
- [ ] Remove `<form method="dialog">` backdrop
- [ ] Test modal opens/closes correctly

### ModelSelectionControls.tsx
- [ ] Add Button import
- [ ] Replace two `<button>` elements with `<Button>` components
- [ ] Set `variant="outline" size="sm"` for both
- [ ] Remove DaisyUI classes
- [ ] Test buttons render correctly

### PuzzleExaminer.tsx
- [ ] Add Card component imports
- [ ] Add Alert, AlertDescription imports
- [ ] Add Badge import
- [ ] Add Skeleton import
- [ ] Migrate "Prompt Style" card (lines 358-385)
- [ ] Migrate "Advanced Controls" card (lines 387-415)
- [ ] Update Model Selection container colors (line 419)
- [ ] Update header button hover state (line 423)
- [ ] Migrate error alerts (lines 101, 318)
- [ ] Migrate loading skeletons (line 487)
- [ ] Replace all color tokens (bg-base-*, border-base-*, text-base-content/*)
- [ ] Test card styling, layouts, and responsiveness

### ModelProviderGroup.tsx
- [ ] Update background colors (line 72)
- [ ] Update text colors (line 85)
- [ ] No imports needed
- [ ] Test button hover states

### ModelSelection.tsx
- [ ] Update text color in empty state
- [ ] No imports needed
- [ ] Test displays correctly

---

## Validation Checklist

### Functionality
- [ ] PromptPreviewModal opens when model card clicked
- [ ] Modal closes on cancel/backdrop click
- [ ] Prompt preview loads and displays correctly
- [ ] Copy buttons work (system prompt, user prompt)
- [ ] Confirm & Send Analysis button triggers analysis
- [ ] Expand All/Collapse All buttons work
- [ ] Model cards display correctly
- [ ] Error alerts display and are dismissible
- [ ] Loading skeletons show while data loads

### Visual Design
- [ ] Colors match design system (verify against Compare page, Discussion page)
- [ ] Button hover/active/disabled states work
- [ ] Modal backdrop appears correctly
- [ ] Card shadows and borders render correctly
- [ ] Text colors have proper contrast (WCAG AA)
- [ ] Badge styling matches
- [ ] Responsive layout works (mobile, tablet, desktop)

### Consistency
- [ ] Dialog behavior matches FeedbackModal, ModelComparisonDialog patterns
- [ ] Button variants match project standards
- [ ] Color tokens match design system
- [ ] No DaisyUI classes remain

---

## Reference Files for Pattern Consistency

These files demonstrate established shadcn/ui patterns in the project:

1. **Dialog Pattern**: `client/src/components/feedback/FeedbackModal.tsx`
2. **Card Pattern**: `client/src/components/analytics/ModelComparisonDialog.tsx`
3. **Alert Pattern**: `client/src/components/analytics/ModelComparisonDialog.tsx`
4. **Button Pattern**: `client/src/components/puzzle/ModelButton.tsx`

---

## Rollback Strategy

Each component is independent. If critical issues arise:
```bash
# Revert individual component
git checkout client/src/components/PromptPreviewModal.tsx
git checkout client/src/pages/PuzzleExaminer.tsx
# etc.
```

No database/API changes required - fully reversible.

---

## Notes

- **Modal Complexity Reduction**: Switching from `.showModal()` to Dialog component removes ~10 lines of JavaScript complexity
- **CSS Reduction**: Eliminating DaisyUI modal classes reduces CSS bundle
- **Accessibility**: Radix UI Dialog has built-in WCAG compliance (focus management, keyboard nav)
- **Maintainability**: Components now match rest of codebase (30+ files already use shadcn/ui)
- **Testing**: No API/backend changes, so testing is UI-only

---

## Success Criteria

✅ No DaisyUI classes remain on PuzzleExaminer page
✅ All functionality works as before
✅ Visual design matches project's established shadcn/ui patterns
✅ No console warnings or errors
✅ Modal opens/closes smoothly
✅ Responsive design works across breakpoints
✅ Accessibility maintained (keyboard nav, focus management)

---

## Timeline

- **PromptPreviewModal**: 15-20 min
- **ModelSelectionControls**: 5 min
- **PuzzleExaminer.tsx**: 30-40 min (largest file)
- **ModelProviderGroup + ModelSelection**: 10 min
- **Testing & QA**: 10 min

**Total**: 60-75 minutes

---

**Created**: 2025-11-28
**Status**: Ready for implementation
**Next Step**: Begin Phase 1 (PromptPreviewModal.tsx)
