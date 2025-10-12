# Critical Puzzle Grid & Refinement UI - DaisyUI Conversion Plan
**Author:** Claude Sonnet 4.5
**Date:** 2025-10-12
**Last Updated:** 2025-10-12 20:10 UTC
**Priority:** CRITICAL - Core visual components
**Status:** IN PROGRESS (3/5 components complete)

## Executive Summary

This is a **focused conversion plan** for the 5 most critical puzzle display components identified by the user. These components handle all puzzle grid visualization, streaming analysis, and refinement interfaces - the core user experience of the application.

## CURRENT STATUS

### ✅ COMPLETED (Commit 466f2cdc)
1. **PuzzleGrid.tsx** - Badge converted to DaisyUI
2. **StreamingAnalysisPanel.tsx** - Card/Badge/Button converted
3. **CollapsibleCard.tsx** - Complete DaisyUI rewrite

### 🔄 IN PROGRESS
None

### ⏳ REMAINING
4. **CompactPuzzleDisplay.tsx** (145 lines) - Collapsible + Card/Badge/Button
5. **RefinementThread.tsx** (414 lines) - Complex forms (Slider, Select, Textarea, Alert)

### ❌ DEFERRED
- **ProfessionalRefinementUI.tsx** - Requires IterationDataTable, PromptPicker conversion first

**Target Files:**
1. `PuzzleGrid.tsx` - Core grid rendering (176 lines)
2. `StreamingAnalysisPanel.tsx` - Live streaming output (111 lines)
3. `CompactPuzzleDisplay.tsx` - Puzzle overview orchestration (145 lines)
4. `RefinementThread.tsx` - Refinement UI coordination (414 lines)
5. `ProfessionalRefinementUI.tsx` - Professional research interface (427 lines)

**Total Scope:** 1,273 lines across 5 files

---

## Component Analysis

### 1. PuzzleGrid.tsx (176 lines) - SIMPLE
**Current shadcn/ui Usage:**
- `Badge` (2 occurrences) - line 21, 162

**Complexity:** LOW
**Dependencies:** None (leaf component)
**Conversion Time:** 15 minutes

**DaisyUI Conversion:**
```tsx
// BEFORE
import { Badge } from '@/components/ui/badge';
<Badge variant="outline" className="text-[10px] px-1 py-0 bg-gray-50">
  {gridMetadata.rows}×{gridMetadata.cols}
</Badge>

// AFTER
<div className="badge badge-outline badge-sm bg-base-200 text-[10px] px-1 py-0">
  {gridMetadata.rows}×{gridMetadata.cols}
</div>
```

**Changes Required:**
- Line 21: Remove Badge import
- Line 162: Convert Badge to div with DaisyUI classes
- Test grid display with various sizes (1x1, 30x30, strips)

---

### 2. StreamingAnalysisPanel.tsx (111 lines) - SIMPLE
**Current shadcn/ui Usage:**
- `Card`, `CardContent`, `CardHeader`, `CardTitle` (lines 9-10)
- `Badge` (line 10)
- `Button` (line 11)

**Complexity:** LOW-MEDIUM
**Dependencies:** None (leaf component)
**Conversion Time:** 30 minutes

**DaisyUI Conversion Patterns:**

**Card:**
```tsx
// BEFORE
<Card className="border-blue-200 bg-blue-50">
  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
    <div className="space-y-1 flex-1">...</div>
  </CardHeader>
  <CardContent className="space-y-4 text-sm text-blue-900">...</CardContent>
</Card>

// AFTER
<div className="card bg-blue-50 border border-blue-200 shadow-sm">
  <div className="card-body p-4">
    <div className="flex flex-row items-center justify-between pb-2">
      <div className="space-y-1 flex-1">...</div>
    </div>
    <div className="space-y-4 text-sm text-blue-900">...</div>
  </div>
</div>
```

**Badge with Status:**
```tsx
// BEFORE
<Badge variant="default" className="text-xs bg-blue-600">
  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
  Streaming
</Badge>

// AFTER
<div className="badge badge-primary badge-sm">
  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
  Streaming
</div>
```

**Button:**
```tsx
// BEFORE
<Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>

// AFTER
<button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
```

**Changes Required:**
- Lines 9-11: Remove all shadcn/ui imports
- Lines 64-108: Convert Card structure to DaisyUI
- Lines 46-60: Convert Badge variants (starting, in_progress, completed, failed)
- Lines 73-82: Convert Buttons
- Test streaming states (idle, starting, in_progress, completed, failed)

---

### 3. CompactPuzzleDisplay.tsx (145 lines) - MEDIUM
**Current shadcn/ui Usage:**
- `Card`, `CardContent`, `CardHeader`, `CardTitle` (line 23)
- `Badge` (line 24)
- `Button` (line 25)
- `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` (line 26)

**Complexity:** MEDIUM
**Dependencies:** Uses TrainingPairGallery, TestCaseGallery, PredictionCard
**Conversion Time:** 45 minutes

**Collapsible Conversion (Critical):**
```tsx
// BEFORE (shadcn/ui)
<Collapsible open={isTrainingOpen} onOpenChange={setIsTrainingOpen}>
  <CollapsibleTrigger asChild>
    <Button variant="ghost" size="sm">
      <div className="flex items-center gap-2">
        {isTrainingOpen ? <ChevronDown /> : <ChevronRight />}
        <span>Training Examples</span>
      </div>
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div className="pl-2">Content here</div>
  </CollapsibleContent>
</Collapsible>

// AFTER (DaisyUI)
<div className="collapse collapse-arrow bg-base-100">
  <input
    type="checkbox"
    checked={isTrainingOpen}
    onChange={(e) => setIsTrainingOpen(e.target.checked)}
  />
  <div className="collapse-title text-sm font-semibold flex items-center gap-2">
    Training Examples
    <div className="badge badge-outline badge-sm">
      {trainExamples.length}
    </div>
  </div>
  <div className="collapse-content">
    <div className="pl-2">Content here</div>
  </div>
</div>
```

**Changes Required:**
- Lines 23-26: Remove shadcn/ui imports
- Lines 70-78: Convert Card wrapper
- Lines 81-108: Convert Collapsible to DaisyUI collapse
- Lines 84-96: Rework CollapsibleTrigger button
- Test collapsible interaction
- Test with various numbers of training examples

---

### 4. RefinementThread.tsx (414 lines) - COMPLEX
**Current shadcn/ui Usage:**
- `Card`, `CardContent`, `CardHeader`, `CardTitle` (line 15)
- `Badge` (line 16)
- `Button` (line 17)
- `Textarea` (line 18)
- `Alert`, `AlertDescription` (line 19)
- `Slider` (line 20)
- `Label` (line 21)
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (line 22)

**Complexity:** HIGH
**Dependencies:** Uses OriginalExplanationCard, IterationCard, PromptPreviewModal
**Conversion Time:** 2-3 hours

**Key Sections to Convert:**

**1. Header Card (Lines 146-361):**
```tsx
// BEFORE
<Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50">
  <CardContent className="p-1 space-y-0.5">...</CardContent>
</Card>

// AFTER
<div className="card bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200">
  <div className="card-body p-1 space-y-0.5">...</div>
</div>
```

**2. Badge Grid (Lines 180-203):**
```tsx
// BEFORE
<Badge variant="outline" className="bg-purple-100 text-purple-900 border-purple-300 font-mono text-[8px] px-1 py-0">
  {modelDisplayName}
</Badge>

// AFTER
<div className="badge badge-outline bg-purple-100 text-purple-900 border-purple-300 font-mono text-[8px] px-1 py-0">
  {modelDisplayName}
</div>
```

**3. Slider Control (Lines 223-234):**
```tsx
// BEFORE
<Slider
  id="temperature"
  min={0.1}
  max={2.0}
  step={0.05}
  value={[temperature]}
  onValueChange={(value) => setTemperature(value[0])}
  className="w-full"
/>

// AFTER
<input
  type="range"
  id="temperature"
  min={0.1}
  max={2.0}
  step={0.05}
  value={temperature}
  onChange={(e) => setTemperature(parseFloat(e.target.value))}
  className="range range-primary w-full"
/>
```

**4. Select Dropdown (Lines 246-257):**
```tsx
// BEFORE
<Select value={reasoningEffort} onValueChange={(value) => setReasoningEffort(value as 'minimal' | 'low' | 'medium' | 'high')}>
  <SelectTrigger className="w-full h-8 text-xs">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="minimal">Minimal</SelectItem>
    <SelectItem value="low">Low</SelectItem>
    <SelectItem value="medium">Medium</SelectItem>
    <SelectItem value="high">High</SelectItem>
  </SelectContent>
</Select>

// AFTER
<select
  className="select select-bordered select-sm w-full text-xs"
  value={reasoningEffort}
  onChange={(e) => setReasoningEffort(e.target.value as 'minimal' | 'low' | 'medium' | 'high')}
>
  <option value="minimal">Minimal</option>
  <option value="low">Low</option>
  <option value="medium">Medium</option>
  <option value="high">High</option>
</select>
```

**5. Textarea (Lines 320-327):**
```tsx
// BEFORE
<Textarea
  value={userGuidance}
  onChange={(e) => onUserGuidanceChange(e.target.value)}
  placeholder="Leave blank for the model to refine based on its own analysis"
  rows={2}
  className="text-xs resize-none"
/>

// AFTER
<textarea
  className="textarea textarea-bordered w-full text-xs resize-none"
  value={userGuidance}
  onChange={(e) => onUserGuidanceChange(e.target.value)}
  placeholder="Leave blank for the model to refine based on its own analysis"
  rows={2}
/>
```

**6. Alert (Lines 352-357):**
```tsx
// BEFORE
<Alert variant="destructive" className="mt-3 py-2">
  <AlertDescription className="text-xs">
    {error.message}
  </AlertDescription>
</Alert>

// AFTER
<div role="alert" className="alert alert-error mt-3 py-2">
  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-4 w-4" fill="none" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span className="text-xs">{error.message}</span>
</div>
```

**Changes Required:**
- Lines 15-22: Remove all shadcn/ui imports
- Lines 146-361: Convert header Card structure
- Lines 180-203: Convert multiple Badge variants
- Lines 161-174: Convert Buttons
- Lines 217-234: Convert Slider controls
- Lines 246-290: Convert Select dropdowns (3 instances)
- Lines 320-327: Convert Textarea
- Lines 352-357: Convert Alert
- Test all advanced controls (temperature, reasoning params)
- Test user guidance input
- Test error display
- Test refinement continuation

---

### 5. ProfessionalRefinementUI.tsx (427 lines) - VERY COMPLEX
**Current shadcn/ui Usage:**
- `Card`, `CardContent`, `CardHeader`, `CardTitle` (line 15)
- `Badge` (line 16)
- `Button` (line 17)
- `Textarea` (line 18)
- `Alert`, `AlertDescription` (line 19)
- `Slider` (line 20)
- `Label` (line 21)
- `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` (line 22)
- `CollapsibleCard` (line 24) - CUSTOM COMPONENT

**Complexity:** VERY HIGH
**Dependencies:** Uses CollapsibleCard, IterationDataTable, PromptPicker, PromptPreviewModal
**Conversion Time:** 3-4 hours

**Note:** This file uses CollapsibleCard (line 24, 246-329) which is a custom shadcn/ui wrapper. That component must be converted FIRST before converting this file.

**Key Sections:**

**1. Header Metrics Grid (Lines 147-218):**
```tsx
// Keep as-is - this is a custom data grid, just convert the Card wrapper
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <div className="flex items-center justify-between">...</div>
    <div className="grid grid-cols-8 gap-2 p-2 bg-gray-50 rounded border border-gray-200 text-xs">
      {/* 8 metric columns */}
    </div>
  </div>
</div>
```

**2. Prompt Template Section (Lines 222-242):**
```tsx
// BEFORE
<Card className="bg-gray-50 border-gray-200">
  <CardContent className="p-3">...</CardContent>
</Card>

// AFTER
<div className="card bg-gray-50 border border-gray-200">
  <div className="card-body p-3">...</div>
</div>
```

**3. Advanced Controls with CollapsibleCard (Lines 245-329):**
**PREREQUISITE:** Convert `CollapsibleCard` component first (see below)

**4. Continue Refinement Section (Lines 361-423):**
Similar patterns to RefinementThread.tsx - Card, Label, Textarea, Button, Alert

**Changes Required:**
- **FIRST**: Convert CollapsibleCard.tsx component (dependency)
- Lines 15-22: Remove shadcn/ui imports
- Lines 147-218: Convert header Card and Badge usage
- Lines 222-242: Convert prompt Card
- Lines 246-329: Update CollapsibleCard usage (or convert inline)
- Lines 256-276: Convert Slider
- Lines 280-327: Convert Select dropdowns (3 instances for GPT-5 params)
- Lines 361-423: Convert final Card, Textarea, Button, Alert
- Test all advanced parameters
- Test iteration data table integration
- Test continue refinement flow

---

## Prerequisite: Convert CollapsibleCard.tsx

**File:** `client/src/components/ui/collapsible-card.tsx`
**Current Implementation:** Uses shadcn/ui Card + Collapsible
**Priority:** MUST CONVERT BEFORE ProfessionalRefinementUI.tsx

**Current Usage:**
```tsx
import { CollapsibleCard } from '@/components/ui/collapsible-card';

<CollapsibleCard
  title="Advanced Model Parameters"
  icon={Settings}
  defaultOpen={false}
  headerDescription={<p className="text-sm text-gray-600">Fine-tune model behavior</p>}
>
  {/* Content */}
</CollapsibleCard>
```

**DaisyUI Conversion:**
```tsx
// Convert to DaisyUI collapse component
interface CollapsibleCardProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  headerDescription?: React.ReactNode;
  children: React.ReactNode;
}

export function CollapsibleCard({
  title,
  icon: Icon,
  defaultOpen = false,
  headerDescription,
  children
}: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="collapse collapse-arrow">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(e) => setIsOpen(e.target.checked)}
        />
        <div className="collapse-title">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            <h3 className="text-base font-semibold">{title}</h3>
          </div>
          {headerDescription && <div className="mt-1">{headerDescription}</div>}
        </div>
        <div className="collapse-content">
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
```

---

## Conversion Order & Dependencies

### Phase 1: Leaf Components (No dependencies)
1. **PuzzleGrid.tsx** ✅ (15 min)
   - Simple Badge conversion
   - Test with various grid sizes

2. **StreamingAnalysisPanel.tsx** ✅ (30 min)
   - Card, Badge, Button conversions
   - Test streaming states

### Phase 2: Custom Component Dependency
3. **CollapsibleCard.tsx** ✅ (45 min)
   - Convert from shadcn/ui to DaisyUI
   - Required for ProfessionalRefinementUI.tsx

### Phase 3: Orchestration Components
4. **CompactPuzzleDisplay.tsx** ✅ (45 min)
   - Collapsible conversion
   - Test training examples display
   - Test test case gallery

### Phase 4: Complex UI Components
5. **RefinementThread.tsx** ✅ (2-3 hours)
   - Most complex form controls
   - Slider, Select, Textarea, Alert conversions
   - Test refinement workflow

6. **ProfessionalRefinementUI.tsx** ✅ (3-4 hours)
   - Requires CollapsibleCard.tsx converted first
   - Similar patterns to RefinementThread.tsx
   - Test professional data display

**Total Estimated Time:** 7-9 hours

---

## Testing Checklist

### PuzzleGrid.tsx
- [ ] Tiny grids (1x1, 2x2)
- [ ] Small grids (5x5)
- [ ] Medium grids (10x10, 15x15)
- [ ] Large grids (20x20, 30x30)
- [ ] Strip grids (1xN, Nx1)
- [ ] Empty grids
- [ ] Highlighted grids (test cases)
- [ ] Compact mode
- [ ] Badge display for dimensions

### StreamingAnalysisPanel.tsx
- [ ] Idle state
- [ ] Starting state
- [ ] In_progress state with spinner
- [ ] Completed state
- [ ] Failed state
- [ ] Text streaming display
- [ ] Reasoning display
- [ ] Token usage display
- [ ] Cancel button functionality
- [ ] Close button functionality

### CompactPuzzleDisplay.tsx
- [ ] Training examples collapsible
- [ ] Training examples expanded/collapsed
- [ ] Test case gallery display
- [ ] Prediction history horizontal scroll
- [ ] Badge counts correct
- [ ] Different numbers of training examples

### RefinementThread.tsx
- [ ] Header card display
- [ ] Model badge display
- [ ] Temperature slider functionality
- [ ] GPT-5 reasoning selects (3 dropdowns)
- [ ] User guidance textarea
- [ ] Continue refinement button
- [ ] Error alert display
- [ ] Iteration cards rendering
- [ ] Auto-scroll to newest iteration
- [ ] Reset functionality
- [ ] Back button navigation

### ProfessionalRefinementUI.tsx
- [ ] Header metrics grid (8 columns)
- [ ] Prompt template display
- [ ] Advanced controls collapsible
- [ ] Temperature slider
- [ ] GPT-5 reasoning controls (3 selects)
- [ ] Iteration data table
- [ ] User guidance textarea
- [ ] Generate next iteration button
- [ ] Success alert display
- [ ] Error alert display
- [ ] All metrics calculating correctly

---

## Risk Assessment

### LOW RISK
- **PuzzleGrid.tsx**: Single Badge component, minimal changes
- **StreamingAnalysisPanel.tsx**: Straightforward Card/Badge/Button conversion

### MEDIUM RISK
- **CompactPuzzleDisplay.tsx**: Collapsible interaction pattern differs between shadcn/ui and DaisyUI
- **CollapsibleCard.tsx**: Custom component with complex behavior

### HIGH RISK
- **RefinementThread.tsx**: Many form controls, complex state management, extensive testing needed
- **ProfessionalRefinementUI.tsx**: Most complex component, dependency on CollapsibleCard conversion, professional data display

---

## Success Criteria

### Visual
- [ ] All grids render identically to current implementation
- [ ] No layout shifts or spacing issues
- [ ] Responsive design maintained
- [ ] Theme compatibility (light/dark/cupcake/etc.)
- [ ] Colors and styles match current design

### Functional
- [ ] All interactions work identically
- [ ] Form controls maintain state correctly
- [ ] Collapsibles expand/collapse smoothly
- [ ] Streaming updates display correctly
- [ ] No console errors
- [ ] No TypeScript errors

### Performance
- [ ] No render performance degradation
- [ ] Grid rendering remains fast
- [ ] Collapsible animations smooth
- [ ] No memory leaks

---

## Implementation Notes

### DaisyUI Specific Patterns

**1. Collapse Arrow vs Custom Icons:**
DaisyUI's collapse-arrow provides automatic chevron rotation. For custom icons (like the current ChevronDown/ChevronRight pattern), we need to manage the rotation manually:

```tsx
{/* Custom icon rotation */}
<div className={`transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}>
  <ChevronDown className="h-4 w-4" />
</div>
```

**2. Range Input Styling:**
DaisyUI range inputs don't show the current value by default. We're already displaying the value in labels, so this is fine:

```tsx
<Label htmlFor="temperature" className="text-sm font-medium whitespace-nowrap">
  Temperature: {temperature.toFixed(2)}
</Label>
<input type="range" ... />
```

**3. Alert Icons:**
DaisyUI alerts require manual SVG icons. We can keep the lucide-react icons we're already using:

```tsx
<div role="alert" className="alert alert-error">
  <AlertCircle className="h-4 w-4" />
  <span>{error.message}</span>
</div>
```

**4. Select Dropdowns:**
Native select elements are simpler than shadcn/ui's Radix Select. Event handling changes from `onValueChange` to `onChange`:

```tsx
// BEFORE
<Select value={value} onValueChange={setValue}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="opt1">Option 1</SelectItem>
  </SelectContent>
</Select>

// AFTER
<select
  className="select select-bordered w-full"
  value={value}
  onChange={(e) => setValue(e.target.value)}
>
  <option value="opt1">Option 1</option>
</select>
```

**5. Card Padding:**
DaisyUI's card-body has default padding (p-4). Match existing padding with custom classes:

```tsx
{/* Existing: p-1 */}
<div className="card-body p-1">...</div>

{/* Existing: p-3 */}
<div className="card-body p-3">...</div>
```

---

## Post-Conversion Cleanup

After converting these 5 files:

1. **Test Extensively**: Run through all puzzle display scenarios
2. **Visual Regression**: Compare screenshots before/after
3. **Document Changes**: Update component docs if needed
4. **Git Commit**: Detailed commit message with changes
5. **User Feedback**: Get user confirmation before proceeding to other components

---

## Next Steps After Critical Components

Once these 5 critical components are successfully converted, we can proceed with:

1. **Supporting Components**: OriginalExplanationCard, IterationCard, PredictionCard
2. **Gallery Components**: TrainingPairGallery, TestCaseGallery
3. **Prompt Components**: PromptPicker, PromptPreviewModal
4. **Remaining Pages**: Following the full conversion plan in the main document

---

## Next Developer Instructions

### Immediate Next Steps

**1. Convert CompactPuzzleDisplay.tsx**

Location: `client/src/components/puzzle/CompactPuzzleDisplay.tsx`

**Imports to remove:**
```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
```

**Key conversions:**
- Lines 70-78: Card → `<div className="card">`
- Lines 81-108: Collapsible → DaisyUI collapse pattern (see CollapsibleCard.tsx for reference)
- Lines 84-96: CollapsibleTrigger Button → checkbox-controlled collapse
- Line 92-94: Badge → `<div className="badge">`

**Critical section (lines 81-108):**
```tsx
// CURRENT shadcn/ui Collapsible
<Collapsible open={isTrainingOpen} onOpenChange={setIsTrainingOpen}>
  <CollapsibleTrigger asChild>
    <Button variant="ghost" ...>
      {isTrainingOpen ? <ChevronDown /> : <ChevronRight />}
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>...</CollapsibleContent>
</Collapsible>

// CONVERT TO DaisyUI collapse
<div className="collapse">
  <input
    type="checkbox"
    checked={isTrainingOpen}
    onChange={(e) => setIsTrainingOpen(e.target.checked)}
  />
  <div className="collapse-title">
    {/* Content with custom chevron rotation */}
  </div>
  <div className="collapse-content">...</div>
</div>
```

**2. Convert RefinementThread.tsx**

Location: `client/src/components/puzzle/refinement/RefinementThread.tsx`

**Imports to remove (lines 15-22):**
- Card, CardContent, CardHeader, CardTitle
- Badge
- Button
- Textarea
- Alert, AlertDescription
- Slider
- Label
- Select, SelectContent, SelectItem, SelectTrigger, SelectValue

**Major conversion sections:**

A. **Header Card (lines 146-361):**
- Card → `<div className="card">`
- Multiple Badge → `<div className="badge badge-*">`
- Button → `<button className="btn">`

B. **Slider (lines 223-234):**
```tsx
// FROM
<Slider value={[temperature]} onValueChange={(value) => setTemperature(value[0])} />
// TO
<input type="range" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="range range-primary" />
```

C. **Select dropdowns (lines 246-257, 264-275, 281-290):**
```tsx
// FROM
<Select value={x} onValueChange={setX}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    <SelectItem value="a">A</SelectItem>
  </SelectContent>
</Select>
// TO
<select value={x} onChange={(e) => setX(e.target.value)} className="select select-bordered">
  <option value="a">A</option>
</select>
```

D. **Textarea (lines 320-327):**
```tsx
// FROM
<Textarea value={x} onChange={(e) => ...} />
// TO
<textarea value={x} onChange={(e) => ...} className="textarea textarea-bordered" />
```

E. **Alert (lines 352-357):**
```tsx
// FROM
<Alert variant="destructive">
  <AlertDescription>{error.message}</AlertDescription>
</Alert>
// TO
<div role="alert" className="alert alert-error">
  <svg>...</svg>
  <span>{error.message}</span>
</div>
```

### Build Verification

After each conversion:
1. Run `npm run build`
2. Check for TypeScript errors
3. Verify build succeeds

### Commit Template

```
feat: Convert [ComponentName] to DaisyUI

**Changes:**
- Removed shadcn/ui imports: [list]
- Converted [component] to DaisyUI [equivalent]
- Updated [specific sections]

**Build status:** ✓ Zero TypeScript errors
**Visual testing:** [User responsibility]
```

### Known Good Patterns

Reference these completed files for patterns:
- **Badge conversion:** See PuzzleGrid.tsx (line 161)
- **Card conversion:** See StreamingAnalysisPanel.tsx (lines 61-106)
- **Collapsible conversion:** See CollapsibleCard.tsx (complete file)
- **Button conversion:** See StreamingAnalysisPanel.tsx (lines 72-79)

### Deferred Work

**ProfessionalRefinementUI.tsx** requires these conversions first:
- IterationDataTable component
- PromptPicker component

Do not attempt until dependencies are resolved.

---

## Build Status

**Last Build:** Success ✓ (466f2cdc)
**TypeScript Errors:** 0
**Components Remaining:** 2 (CompactPuzzleDisplay, RefinementThread)
**Components Deferred:** 1 (ProfessionalRefinementUI)
