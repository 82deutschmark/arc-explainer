# Union Accuracy Modal Integration Plan

**Date:** 2025-11-23
**Author:** Claude Code
**Status:** In Progress
**Goal:** Integrate the improved AttemptUnionCard modal into ModelComparisonPage

---

## Overview

We have successfully created a beautiful `AttemptUnionCard` component in `ModelComparisonDialog.tsx` that displays:
- Large, prominent union accuracy percentage
- Progress bar showing success rate
- Model names as badges
- Clear explanation of what union accuracy means
- Mathematical formula showing the calculation
- Transparency note for researchers

**Goal:** Make this accessible from `ModelComparisonPage` with a prominent button that appears when comparing two attempts of the same model.

---

## Current State

### ✅ Completed
1. **AttemptUnionCard component** created with full ShadCN/UI styling and explanations
2. **ModelComparisonDialog wrapper** created to display the card in a modal
3. **Backend logic** already computes `attemptUnionMetrics` on ModelComparisonPage (lines 305-336)
4. **Basic display** of attempt union metrics already exists on page (lines 570-612)

### ❌ Incomplete
1. Dialog state management not added to ModelComparisonPage
2. ModelComparisonDialog not imported
3. "Details" button not added to metrics section
4. Dialog component not rendered
5. Button click handler not wired up

---

## Implementation Steps

### Step 1: Add Imports to ModelComparisonPage
**File:** `client/src/pages/ModelComparisonPage.tsx`

After line 14, add:
```typescript
import { ModelComparisonDialog } from '@/components/analytics/ModelComparisonDialog';
```

Update line 12 to include Zap icon:
```typescript
import { ArrowLeft, AlertCircle, Zap } from 'lucide-react';
```

### Step 2: Add Dialog State
**File:** `client/src/pages/ModelComparisonPage.tsx`

After line 45 (after `const [hasRefreshedFromCache, setHasRefreshedFromCache] = useState(false);`), add:
```typescript
const [showUnionDialog, setShowUnionDialog] = useState(false);
```

### Step 3: Add Details Button to Metrics Section
**File:** `client/src/pages/ModelComparisonPage.tsx`

Replace the attempt union metrics section (lines 570-612) to include a button:

Current structure (lines 570-573):
```tsx
{attemptUnionMetrics && attemptUnionMetrics.totalPuzzles > 0 && (
  <div className="bg-base-100 rounded-lg shadow p-2">
    <h3 className="text-xs font-bold uppercase tracking-wide opacity-70 mb-2">
      Attempt Union Accuracy
    </h3>
```

Should become:
```tsx
{attemptUnionMetrics && attemptUnionMetrics.totalPuzzles > 0 && (
  <div className="bg-base-100 rounded-lg shadow p-2">
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-xs font-bold uppercase tracking-wide opacity-70">
        Attempt Union Accuracy
      </h3>
      <button
        onClick={() => setShowUnionDialog(true)}
        className="btn btn-xs btn-primary gap-1"
        title="View detailed union accuracy analysis"
      >
        <Zap className="h-3 w-3" />
        Details
      </button>
    </div>
```

### Step 4: Render Dialog Component
**File:** `client/src/pages/ModelComparisonPage.tsx`

At the end of the component, right before the closing `</div>` and before the return statement ends, add:

```tsx
<ModelComparisonDialog
  open={showUnionDialog}
  onOpenChange={setShowUnionDialog}
  comparisonResult={comparisonData}
  loading={false}
  error={null}
/>
```

This should go inside the main container, after all the other content.

### Step 5: Update ModelComparisonDialog for Union-Only Focus
**File:** `client/src/components/analytics/ModelComparisonDialog.tsx`

The dialog currently shows full comparison details. For union-specific focus, consider:
- Keep title as "Union Accuracy Details" instead of "Model Comparison Results"
- Hide the NewModelComparisonResults component when in "union mode"
- Or create a prop `focusMode: 'union' | 'full'` to control display

---

## Key Design Notes

1. **Button Placement:** Top-right of the attempt union metrics section for prominent visibility
2. **Button Style:** Primary blue button with Zap icon (matches the union accuracy visual theme)
3. **Button Text:** "Details" (concise and action-oriented)
4. **Dialog Trigger:** Only appears when `attemptUnionMetrics && attemptUnionMetrics.totalPuzzles > 0`
5. **Button disabled state:** Not needed since button only renders when metrics exist

---

## Testing Checklist

- [ ] Navigate to Model Comparison page
- [ ] Select two attempts of same model (e.g., Gemini-attempt1 + Gemini-attempt2)
- [ ] Verify "Details" button appears in the attempt union section
- [ ] Click button and verify modal opens
- [ ] Verify modal shows AttemptUnionCard with:
  - [ ] Large percentage in blue
  - [ ] Model names as badges
  - [ ] Progress bar
  - [ ] "What is Union Accuracy?" explanation
  - [ ] Formula with calculation breakdown
  - [ ] Transparency note
- [ ] Click X or outside to close modal
- [ ] Verify modal closes properly

---

## Git Commit Message

```
feat: Add Union Accuracy Details modal to ModelComparisonPage

Integrate ModelComparisonDialog into ModelComparisonPage with a prominent
"Details" button that opens the improved AttemptUnionCard when comparing
attempt pairs. Button only appears when comparing multiple attempts of the
same model, providing researchers with detailed union accuracy calculation
and methodology explanation.

- Added dialog state management (showUnionDialog)
- Imported ModelComparisonDialog component
- Added Zap icon for visual consistency
- Placed "Details" button in metrics section header
- Rendered dialog with comparison data

The dialog displays the union accuracy percentage with progress bar,
model badges, plain-language explanation, mathematical formula, and
transparency note for full research clarity.
```

---

## Files to Modify

1. `client/src/pages/ModelComparisonPage.tsx` - Main integration
2. Optional: `client/src/components/analytics/ModelComparisonDialog.tsx` - If need to adjust title/focus

---

## Notes

- The AttemptUnionCard component is already complete and styled beautifully
- The attempt union metrics logic already exists on ModelComparisonPage
- No backend changes needed
- No new components needed, just integration of existing components
