# shadcn/ui to DaisyUI Conversion Plan
**Author:** Claude Sonnet 4.5
**Date:** 2025-10-12
**Status:** PLANNING PHASE

## Executive Summary

This document outlines the complete conversion strategy for migrating the ARC Explainer project from shadcn/ui component library to DaisyUI. The conversion will improve maintainability, reduce bundle size, and simplify the UI component architecture while maintaining all existing functionality.

**Current State:**
- 52+ shadcn/ui component files in `client/src/components/ui/`
- 519+ import statements across 136 files
- 20 page components using shadcn/ui
- Complex Radix UI primitives as base layer
- Heavy reliance on class-variance-authority (CVA) for variants

**Target State:**
- Pure DaisyUI utility-first component classes
- Removal of all shadcn/ui components
- Removal of Radix UI dependencies
- Simplified component architecture
- Native DaisyUI theming system

**Reference Implementation:**
- `ModelComparisonPage.tsx` already successfully uses DaisyUI exclusively
- Demonstrates proper DaisyUI patterns and component usage

---

## Phase 1: Preparation & Dependency Analysis

### 1.1 Document Current Component Usage
**Action:** Create comprehensive mapping of shadcn/ui components to their DaisyUI equivalents

**Component Mapping:**

| shadcn/ui Component | Files Using | DaisyUI Equivalent | Notes |
|---------------------|-------------|-------------------|-------|
| Card, CardHeader, CardTitle, CardContent, CardFooter | 136+ files | `card`, `card-body`, `card-title`, `card-actions` | Most heavily used component |
| Button | 136+ files | `btn`, `btn-primary`, `btn-ghost`, `btn-outline`, `btn-sm`, `btn-lg` | Second most used |
| Badge | 100+ files | `badge`, `badge-primary`, `badge-secondary`, `badge-success`, `badge-error` | Very common |
| Select, SelectTrigger, SelectValue, SelectContent, SelectItem | 80+ files | `select`, `select-bordered`, `option` | Complex component |
| Input | 60+ files | `input`, `input-bordered`, `input-primary` | Form fields |
| Label | 60+ files | `label`, `label-text` | Form labels |
| Dialog, DialogContent, DialogHeader, DialogTitle | 50+ files | `modal`, `modal-box`, `modal-action` | Modals |
| Alert, AlertDescription | 40+ files | `alert`, `alert-error`, `alert-success`, `alert-info`, `alert-warning` | Notifications |
| Slider | 20+ files | `range`, `range-primary` | Input control |
| Switch | 15+ files | `toggle`, `checkbox` | Boolean control |
| ToggleGroup, ToggleGroupItem | 10+ files | `btn-group`, `btn-active` | Button groups |
| Tabs, TabsList, TabsTrigger, TabsContent | 10+ files | `tabs`, `tab`, `tab-active` | Tabbed interfaces |
| Accordion | 8+ files | `collapse`, `collapse-title`, `collapse-content` | Collapsible sections |
| Toast, Toaster | 8+ files | `toast`, `toast-start`, `toast-end` | Toast notifications |
| Tooltip | 8+ files | `tooltip`, `tooltip-open` | Hover info |
| Progress | 5+ files | `progress`, `progress-primary` | Progress bars |
| Checkbox | 5+ files | `checkbox`, `checkbox-primary` | Checkboxes |
| Radio Group | 3+ files | `radio`, `radio-primary` | Radio buttons |
| Table | 5+ files | `table`, `table-zebra`, `table-compact` | Data tables |
| Separator | 5+ files | `divider`, `divider-horizontal` | Visual dividers |
| Collapsible (custom) | 3+ files | `collapse` | Collapsible sections |

### 1.2 Identify High-Risk Areas
**Critical Pages Requiring Extra Care:**

1. **PuzzleExaminer.tsx** (1044 lines)
   - Core functionality page
   - Complex state management
   - Multiple shadcn/ui components
   - Streaming analysis panels
   - Model selection interface
   - Grid display systems

2. **PuzzleBrowser.tsx** (617 lines)
   - Primary navigation page
   - Heavy filtering/sorting logic
   - Card-based puzzle listing
   - Search functionality
   - Badge-heavy interface

3. **AnalyticsOverview.tsx** (622 lines)
   - Data-heavy dashboard
   - Multiple card layouts
   - Chart integrations (recharts)
   - Complex state management
   - Model comparison interface

4. **ModelDebate.tsx**
   - Multi-model comparison
   - Real-time debate interfaces
   - Complex card layouts

5. **PuzzleDiscussion.tsx**
   - Conversation threading
   - Progressive refinement UI
   - Complex nested components

### 1.3 Dependencies to Remove Post-Conversion

**NPM Packages:**
```json
"@radix-ui/react-accordion": "^1.2.4",
"@radix-ui/react-alert-dialog": "^1.1.7",
"@radix-ui/react-aspect-ratio": "^1.1.3",
"@radix-ui/react-avatar": "^1.1.4",
"@radix-ui/react-checkbox": "^1.1.5",
"@radix-ui/react-collapsible": "^1.1.4",
"@radix-ui/react-context-menu": "^2.2.7",
"@radix-ui/react-dialog": "^1.1.7",
"@radix-ui/react-dropdown-menu": "^2.1.7",
"@radix-ui/react-hover-card": "^1.1.7",
"@radix-ui/react-label": "^2.1.3",
"@radix-ui/react-menubar": "^1.1.7",
"@radix-ui/react-navigation-menu": "^1.2.6",
"@radix-ui/react-popover": "^1.1.7",
"@radix-ui/react-progress": "^1.1.3",
"@radix-ui/react-radio-group": "^1.2.4",
"@radix-ui/react-scroll-area": "^1.2.4",
"@radix-ui/react-select": "^2.1.7",
"@radix-ui/react-separator": "^1.1.3",
"@radix-ui/react-slider": "^1.2.4",
"@radix-ui/react-slot": "^1.2.0",
"@radix-ui/react-switch": "^1.1.4",
"@radix-ui/react-tabs": "^1.1.4",
"@radix-ui/react-toast": "^1.2.7",
"@radix-ui/react-toggle": "^1.1.3",
"@radix-ui/react-toggle-group": "^1.1.3",
"@radix-ui/react-tooltip": "^1.2.0",
"class-variance-authority": "^0.7.1",
"cmdk": "^1.1.1"
```

**Keep These:**
```json
"daisyui": "^5.2.3",  // Already installed
"tailwindcss": "^3.4.17",
"clsx": "^2.1.1",  // Still useful for conditional classes
"tailwind-merge": "^2.6.0"  // Still useful for merging classes
```

---

## Phase 2: Page-by-Page Conversion Strategy

### Priority Order (Highest Risk First)

#### **Tier 1 - Core Pages (Convert First)**
1. **PuzzleExaminer.tsx** - 1044 lines
   - Components to convert: Card, Button, Dialog, Slider, Switch, Label, Select, Badge, Alert, ToggleGroup, Tooltip
   - Custom components: StreamingAnalysisPanel, ModelButton, AnalysisResultCard, PuzzleGrid
   - Risk: HIGH - most critical page
   - Dependencies: Multiple child components must be converted first

2. **PuzzleBrowser.tsx** - 617 lines
   - Components to convert: Card, Button, Input, Label, Select, Badge, Alert
   - Custom components: CollapsibleMission
   - Risk: HIGH - primary entry point
   - Dependencies: Few child components

3. **AnalyticsOverview.tsx** - 622 lines
   - Components to convert: Card, Select, Button, Badge
   - Custom components: DifficultPuzzlesSection, ModelComparisonDialog
   - Risk: MEDIUM-HIGH - complex but isolated
   - Dependencies: Analytics components

#### **Tier 2 - Feature Pages**
4. **ModelDebate.tsx**
   - Components to convert: Card, Button, Badge, Select, Dialog, Tabs
   - Custom components: IndividualDebate, ExplanationsList, RebuttalCard
   - Risk: MEDIUM

5. **PuzzleDiscussion.tsx**
   - Components to convert: Card, Button, Badge, Alert, Dialog
   - Custom components: RefinementThread, ChatRefinementThread, IterationCard
   - Risk: MEDIUM

6. **GroverSolver.tsx**
   - Components to convert: Card, Button, Select, Badge, Progress, Alert
   - Custom components: GroverModelSelect, IterationCard, LiveActivityStream
   - Risk: MEDIUM

7. **SaturnVisualSolver.tsx**
   - Components to convert: Card, Button, Select, Badge, Progress
   - Custom components: SaturnModelSelect, SaturnImageGallery
   - Risk: MEDIUM

#### **Tier 3 - Admin & Utility Pages**
8. **ModelManagement.tsx**
9. **AdminHub.tsx**
10. **HuggingFaceIngestion.tsx**
11. **KaggleReadinessValidation.tsx**
12. **ModelBrowser.tsx**
13. **EloComparison.tsx**
14. **EloLeaderboard.tsx**
15. **PuzzleFeedback.tsx**
16. **PuzzleDBViewer.tsx**
17. **About.tsx**
18. **Leaderboards.tsx**
19. **not-found.tsx**

#### **Tier 4 - Already Converted**
20. **ModelComparisonPage.tsx** - ✅ ALREADY USING DAISYUI (use as reference!)

### Component Conversion Order

**Step 1: Shared UI Components (Foundation)**
Convert these first as they're used by pages:
1. `client/src/components/ui/collapsible-card.tsx` - Custom component
2. `client/src/components/ui/collapsible-mission.tsx` - Custom component
3. `client/src/components/ui/ClickablePuzzleBadge.tsx` - Custom component
4. `client/src/components/ui/ModelPerformanceCard.tsx` - Custom component

**Step 2: Puzzle-Specific Components**
5. `client/src/components/puzzle/PuzzleGrid.tsx` - Core grid display
6. `client/src/components/puzzle/ModelButton.tsx` - Model selection
7. `client/src/components/puzzle/AnalysisResultCard.tsx` - Result display
8. `client/src/components/puzzle/StreamingAnalysisPanel.tsx` - Streaming UI
9. `client/src/components/puzzle/ModelProgressIndicator.tsx`
10. `client/src/components/puzzle/AnalysisResultContent.tsx`
11. `client/src/components/puzzle/AnalysisResultHeader.tsx`
12. `client/src/components/puzzle/AnalysisResultGrid.tsx`
13. `client/src/components/puzzle/AnalysisResultMetrics.tsx`
14. `client/src/components/puzzle/AnalysisResultListCard.tsx`
15. `client/src/components/puzzle/PredictionCard.tsx`
16. `client/src/components/puzzle/CompactPuzzleDisplay.tsx`

**Step 3: Puzzle Examples & Grids**
17-24. All files in `client/src/components/puzzle/examples/`
25-27. All files in `client/src/components/puzzle/testcases/`
28. `client/src/components/puzzle/grids/GridDisplay.tsx`

**Step 4: Debate Components**
29-33. All files in `client/src/components/puzzle/debate/`

**Step 5: Refinement Components**
34-40. All files in `client/src/components/puzzle/refinement/`

**Step 6: Analytics Components**
41. `client/src/components/analytics/NewModelComparisonResults.tsx`
42. `client/src/components/analytics/ModelComparisonDialog.tsx`
43. `client/src/components/analytics/DifficultPuzzlesSection.tsx`
44. `client/src/components/analytics/ModelPerformancePanel.tsx`

**Step 7: Overview & Leaderboard Components**
45-48. All files in `client/src/components/overview/statistics/`
49-53. All files in `client/src/components/overview/leaderboards/`
54-57. Other files in `client/src/components/overview/`

**Step 8: Solver Components**
58-62. All files in `client/src/components/grover/`
63-64. All files in `client/src/components/saturn/`

**Step 9: Supporting Components**
65-68. Feedback components
69-71. ELO components
72-73. Batch components
74-77. Model examiner components
78-80. Layout components
81-82. Prompt components
83-85. Other root components

---

## Phase 3: Conversion Patterns & Code Examples

### Pattern 1: Card Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card className="shadow-lg">
  <CardHeader>
    <CardTitle>Title Here</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

**AFTER (DaisyUI):**
```tsx
<div className="card bg-base-100 shadow-xl">
  <div className="card-body">
    <h2 className="card-title">Title Here</h2>
    <p>Content here</p>
  </div>
</div>
```

### Pattern 2: Button Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default" size="lg">Click Me</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Ghost</Button>
```

**AFTER (DaisyUI):**
```tsx
<button className="btn btn-primary btn-lg">Click Me</button>
<button className="btn btn-outline btn-sm">Cancel</button>
<button className="btn btn-error">Delete</button>
<button className="btn btn-ghost">Ghost</button>
```

### Pattern 3: Select Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Choose option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

**AFTER (DaisyUI):**
```tsx
<select
  className="select select-bordered w-full"
  value={value}
  onChange={(e) => setValue(e.target.value)}
>
  <option disabled selected>Choose option</option>
  <option value="option1">Option 1</option>
  <option value="option2">Option 2</option>
</select>
```

### Pattern 4: Dialog/Modal Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Modal Title</DialogTitle>
    </DialogHeader>
    <div>Modal content</div>
  </DialogContent>
</Dialog>
```

**AFTER (DaisyUI):**
```tsx
<dialog className={`modal ${isOpen ? 'modal-open' : ''}`}>
  <div className="modal-box">
    <h3 className="font-bold text-lg">Modal Title</h3>
    <div className="py-4">Modal content</div>
    <div className="modal-action">
      <button className="btn" onClick={() => setIsOpen(false)}>Close</button>
    </div>
  </div>
  <form method="dialog" className="modal-backdrop">
    <button onClick={() => setIsOpen(false)}>close</button>
  </form>
</dialog>
```

### Pattern 5: Badge Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="outline">Outlined</Badge>
<Badge variant="default">Default</Badge>
<Badge variant="destructive">Error</Badge>
```

**AFTER (DaisyUI):**
```tsx
<div className="badge badge-outline">Outlined</div>
<div className="badge">Default</div>
<div className="badge badge-error">Error</div>
```

### Pattern 6: Input & Label Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="Enter email" />
</div>
```

**AFTER (DaisyUI):**
```tsx
<div className="form-control">
  <label className="label">
    <span className="label-text">Email</span>
  </label>
  <input
    type="email"
    placeholder="Enter email"
    className="input input-bordered w-full"
  />
</div>
```

### Pattern 7: Alert Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Alert, AlertDescription } from '@/components/ui/alert';

<Alert>
  <AlertDescription>
    This is an alert message
  </AlertDescription>
</Alert>
```

**AFTER (DaisyUI):**
```tsx
<div role="alert" className="alert">
  <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
  <span>This is an alert message</span>
</div>
```

### Pattern 8: Slider Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Slider } from '@/components/ui/slider';

<Slider
  value={[temperature]}
  onValueChange={(value) => setTemperature(value[0])}
  min={0}
  max={2}
  step={0.1}
/>
```

**AFTER (DaisyUI):**
```tsx
<input
  type="range"
  min={0}
  max={2}
  step={0.1}
  value={temperature}
  onChange={(e) => setTemperature(parseFloat(e.target.value))}
  className="range range-primary"
/>
```

### Pattern 9: Switch/Toggle Conversion

**BEFORE (shadcn/ui):**
```tsx
import { Switch } from '@/components/ui/switch';

<Switch checked={enabled} onCheckedChange={setEnabled} />
```

**AFTER (DaisyUI):**
```tsx
<input
  type="checkbox"
  className="toggle toggle-primary"
  checked={enabled}
  onChange={(e) => setEnabled(e.target.checked)}
/>
```

### Pattern 10: Toast Conversion

**BEFORE (shadcn/ui):**
```tsx
import { useToast } from '@/hooks/use-toast';

const { toast } = useToast();
toast({
  title: "Success",
  description: "Action completed",
});
```

**AFTER (DaisyUI + Custom Hook):**
```tsx
// Create new hook: client/src/hooks/useDaisyToast.ts
// Use DaisyUI toast classes with portal rendering
// Details in implementation phase
```

---

## Phase 4: Implementation Workflow

### Step-by-Step Process for Each File

1. **Backup & Branch**
   - Create feature branch: `feature/daisyui-conversion-[component-name]`
   - Commit current state before changes

2. **Update Imports**
   - Remove all `@/components/ui/*` imports
   - Add necessary utility imports (clsx, cn) if needed

3. **Convert Component Structure**
   - Replace shadcn/ui JSX with DaisyUI classes
   - Update className props
   - Adjust event handlers for native elements

4. **Update Conditional Classes**
   - Replace CVA-based variants with DaisyUI modifiers
   - Use clsx/cn for conditional styling

5. **Test Functionality**
   - Visual regression testing
   - Interaction testing
   - Responsive design testing
   - Theme switching testing

6. **Commit & Document**
   - Commit with detailed message
   - Note any behavioral changes
   - Update component documentation

### Batch Conversion Strategy

**Week 1: Foundation**
- Convert shared UI components (collapsible-card, ClickablePuzzleBadge, etc.)
- Create DaisyUI utility hooks (toast, modal management)
- Document patterns

**Week 2: Core Puzzle Components**
- Convert PuzzleGrid and related display components
- Convert ModelButton and model selection UIs
- Convert AnalysisResultCard and related result displays

**Week 3: Major Pages (Part 1)**
- Convert PuzzleBrowser.tsx
- Convert basic admin pages

**Week 4: Major Pages (Part 2)**
- Convert PuzzleExaminer.tsx (most complex)
- Convert AnalyticsOverview.tsx

**Week 5: Feature Pages**
- Convert ModelDebate.tsx
- Convert PuzzleDiscussion.tsx
- Convert solver pages

**Week 6: Polish & Cleanup**
- Remove shadcn/ui component files
- Remove Radix UI dependencies
- Update package.json
- Final testing
- Documentation updates

---

## Phase 5: Testing Strategy

### Visual Regression Testing
- Take screenshots of all pages before conversion
- Compare after conversion for pixel-perfect accuracy
- Focus on:
  - Card layouts
  - Button states
  - Form inputs
  - Modals
  - Responsive breakpoints

### Functional Testing Checklist
For each converted page:
- [ ] All buttons clickable and functional
- [ ] Form inputs accept input correctly
- [ ] Dropdowns/selects work properly
- [ ] Modals open/close correctly
- [ ] Tooltips display on hover
- [ ] Progress indicators update
- [ ] Badges display correctly
- [ ] Alerts show/hide correctly
- [ ] Navigation works
- [ ] Mobile responsive design intact
- [ ] Keyboard navigation functional
- [ ] Screen reader compatibility

### Theme Testing
Test with all DaisyUI themes:
- [ ] light
- [ ] dark
- [ ] cupcake
- [ ] emerald
- [ ] corporate
- [ ] retro
- [ ] cyberpunk

### Performance Testing
- [ ] Bundle size reduction (expect 30-40% reduction)
- [ ] Initial page load time
- [ ] Component render performance
- [ ] Memory usage

---

## Phase 6: Post-Conversion Cleanup

### Files to Delete
**Component Files (52+ files):**
- `client/src/components/ui/accordion.tsx`
- `client/src/components/ui/alert.tsx`
- `client/src/components/ui/alert-dialog.tsx`
- `client/src/components/ui/aspect-ratio.tsx`
- `client/src/components/ui/avatar.tsx`
- `client/src/components/ui/badge.tsx`
- `client/src/components/ui/breadcrumb.tsx`
- `client/src/components/ui/button.tsx`
- `client/src/components/ui/calendar.tsx`
- `client/src/components/ui/card.tsx`
- `client/src/components/ui/carousel.tsx`
- `client/src/components/ui/chart.tsx`
- `client/src/components/ui/checkbox.tsx`
- `client/src/components/ui/collapsible.tsx`
- `client/src/components/ui/command.tsx`
- `client/src/components/ui/context-menu.tsx`
- `client/src/components/ui/dialog.tsx`
- `client/src/components/ui/drawer.tsx`
- `client/src/components/ui/dropdown-menu.tsx`
- `client/src/components/ui/form.tsx`
- `client/src/components/ui/hover-card.tsx`
- `client/src/components/ui/input.tsx`
- `client/src/components/ui/input-otp.tsx`
- `client/src/components/ui/label.tsx`
- `client/src/components/ui/menubar.tsx`
- `client/src/components/ui/navigation-menu.tsx`
- `client/src/components/ui/pagination.tsx`
- `client/src/components/ui/popover.tsx`
- `client/src/components/ui/progress.tsx`
- `client/src/components/ui/radio-group.tsx`
- `client/src/components/ui/resizable.tsx`
- `client/src/components/ui/scroll-area.tsx`
- `client/src/components/ui/select.tsx`
- `client/src/components/ui/separator.tsx`
- `client/src/components/ui/sheet.tsx`
- `client/src/components/ui/sidebar.tsx`
- `client/src/components/ui/skeleton.tsx`
- `client/src/components/ui/slider.tsx`
- `client/src/components/ui/switch.tsx`
- `client/src/components/ui/table.tsx`
- `client/src/components/ui/tabs.tsx`
- `client/src/components/ui/textarea.tsx`
- `client/src/components/ui/toast.tsx`
- `client/src/components/ui/toaster.tsx`
- `client/src/components/ui/toggle.tsx`
- `client/src/components/ui/toggle-group.tsx`
- `client/src/components/ui/tooltip.tsx`

**Keep These Custom Components:**
- `client/src/components/ui/collapsible-card.tsx` (convert to DaisyUI)
- `client/src/components/ui/collapsible-mission.tsx` (convert to DaisyUI)
- `client/src/components/ui/ClickablePuzzleBadge.tsx` (convert to DaisyUI)
- `client/src/components/ui/ModelPerformanceCard.tsx` (convert to DaisyUI)

### Update package.json

**Remove:**
```bash
npm uninstall @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip class-variance-authority cmdk
```

### Update tailwind.config.ts

**Remove shadcn/ui theme colors:**
```ts
// Remove entire colors object from theme.extend
// Keep only DaisyUI theming
```

**Final config should look like:**
```ts
export default {
  darkMode: ["class"],
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,jsx,ts,tsx}",
  ],
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("daisyui")
  ],
  daisyui: {
    themes: ["light", "dark", "cupcake", "emerald", "corporate", "retro", "cyberpunk"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
  },
} satisfies Config;
```

---

## Phase 7: Documentation Updates

### Files to Update
1. **CLAUDE.md**
   - Remove references to shadcn/ui
   - Add DaisyUI component guidelines
   - Update component creation patterns

2. **README.md** (if exists)
   - Update technology stack section
   - Update installation instructions
   - Add DaisyUI theme information

3. **Component Documentation**
   - Create DaisyUI component guide
   - Document custom DaisyUI patterns
   - Add theme customization guide

---

## Risk Mitigation

### Known Challenges

1. **Toast Notifications**
   - shadcn/ui uses complex Radix primitives
   - DaisyUI toasts require custom implementation
   - Solution: Create custom toast manager hook

2. **Complex Selects**
   - shadcn/ui Select has rich features
   - Native select is simpler
   - Solution: Use react-select for complex cases or build custom dropdown

3. **Dialog Animations**
   - shadcn/ui has smooth animations
   - DaisyUI modals have different animation style
   - Solution: Add custom transitions if needed

4. **Form Validation**
   - shadcn/ui integrates with react-hook-form
   - Need to ensure DaisyUI forms work with validation
   - Solution: Test form validation patterns early

5. **Accessibility**
   - Radix UI has excellent a11y
   - Must ensure DaisyUI maintains accessibility
   - Solution: Comprehensive a11y testing

### Rollback Plan

If conversion causes critical issues:
1. Revert to previous commit
2. Identify specific problem component
3. Convert remaining components but keep problematic one as shadcn/ui
4. Address issue separately
5. Complete conversion when resolved

---

## Success Metrics

### Technical Metrics
- [ ] Bundle size reduced by 30-40%
- [ ] No TypeScript errors
- [ ] All tests passing
- [ ] Zero accessibility regressions
- [ ] Page load time improved or maintained

### Functional Metrics
- [ ] All pages render correctly
- [ ] All interactions work identically
- [ ] Mobile responsive design intact
- [ ] All themes functional
- [ ] No console errors

### Code Quality Metrics
- [ ] Reduced component complexity
- [ ] Fewer dependencies
- [ ] Cleaner import statements
- [ ] Better maintainability
- [ ] Improved DRY compliance

---

## Conversion Checklist Summary

### Phase 1: Preparation ✅
- [ ] Document all component usage
- [ ] Create component mapping
- [ ] Identify high-risk areas
- [ ] Set up testing environment

### Phase 2: Shared Components
- [ ] Convert collapsible-card.tsx
- [ ] Convert collapsible-mission.tsx
- [ ] Convert ClickablePuzzleBadge.tsx
- [ ] Convert ModelPerformanceCard.tsx

### Phase 3: Puzzle Components (17 components)
- [ ] Convert PuzzleGrid.tsx
- [ ] Convert ModelButton.tsx
- [ ] Convert AnalysisResultCard.tsx
- [ ] Convert StreamingAnalysisPanel.tsx
- [ ] (13 more puzzle components...)

### Phase 4: Page Conversion (20 pages)
- [ ] PuzzleBrowser.tsx
- [ ] PuzzleExaminer.tsx
- [ ] AnalyticsOverview.tsx
- [ ] (17 more pages...)

### Phase 5: Supporting Components (~80 components)
- [ ] Analytics components (4)
- [ ] Overview components (12)
- [ ] Debate components (5)
- [ ] Refinement components (7)
- [ ] Solver components (7)
- [ ] (45 more components...)

### Phase 6: Cleanup
- [ ] Delete shadcn/ui component files
- [ ] Remove Radix UI dependencies
- [ ] Update package.json
- [ ] Clean up tailwind.config.ts
- [ ] Remove unused imports

### Phase 7: Testing
- [ ] Visual regression tests
- [ ] Functional tests
- [ ] Theme tests
- [ ] Performance tests
- [ ] Accessibility tests

### Phase 8: Documentation
- [ ] Update CLAUDE.md
- [ ] Update README.md
- [ ] Create DaisyUI guide
- [ ] Document patterns

---

## Timeline Estimate

**Aggressive Timeline (Full-Time):** 4-6 weeks
**Realistic Timeline (Part-Time):** 8-12 weeks
**Conservative Timeline (With Testing):** 12-16 weeks

---

## Conclusion

This conversion will significantly improve the maintainability and performance of the ARC Explainer project. The systematic approach ensures minimal risk while maximizing benefits. Using ModelComparisonPage.tsx as a reference implementation provides a proven pattern to follow throughout the conversion.

**Next Steps:**
1. Review and approve this plan
2. Create feature branch
3. Begin Phase 1 preparation
4. Start converting shared components
5. Progress through pages systematically

**Key Success Factor:** Incremental conversion with continuous testing ensures each component works before moving to the next.
