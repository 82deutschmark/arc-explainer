# Hugging Face Union Accuracy Visualization Page Plan
**Date:** 2025-11-24
**Goal:** Create a dedicated visualization page for union accuracy scores across Hugging Face official test runs

---

## Overview

Create a new page dedicated to displaying union accuracy metrics specifically for Hugging Face model results on the ARC-AGI v2 public evaluation set. This page reuses the existing union accuracy computation logic (already built in v5.21.0+) and presents it in a simple, focused interface with clear disclaimers about the data source and visualization-only nature.

**Key Insight:** The union accuracy logic is already implemented and battle-tested on the ModelComparisonPage (v5.21.0+). This task is primarily a **UI composition task** that reuses existing utilities and backend queries.

---

## Architecture Overview

### Existing Reusable Components & Logic

1. **Union Accuracy Utilities** (`client/src/utils/modelComparison.ts`)
   - `computeAttemptUnionAccuracy()`
   - `parseAttemptModelName()` - Extract base model name + attempt number
   - Type guards and formatters

2. **Backend Union Stats** (`server/repositories/MetricsRepository.ts`)
   - `computeAttemptUnionStats()` method
   - Returns `AttemptUnionStats[]` with all metrics
   - Integrated into `getMultiModelComparison()` response

3. **Visual Components**
   - `AttemptUnionCard` (in ModelComparisonDialog.tsx) - Beautiful card showing union metric with progress bar, explanation, formula
   - `ClickablePuzzleBadge` - Reusable badge component for puzzle IDs
   - `ModelBadge` components for model display

4. **Existing Analytics/Comparison Infrastructure**
   - `ModelComparisonPage.tsx` - Reference for layout and state management
   - `AnalyticsOverview.tsx` - Reference for page structure and data fetching patterns
   - Database queries already filter by dataset

---

## Implementation Plan (Phase 1: MVP)

### 1. Create New Page Component
**File:** `client/src/pages/HuggingFaceUnionAccuracy.tsx`

**Structure:**
```
┌─────────────────────────────────────────────┐
│ Header Section                              │
│ - Page title: "Hugging Face Union Accuracy" │
│ - Subtitle: "Official ARC-AGI v2 Eval"      │
│ - Info banner: "Visualization only..."      │
│ - Link to HF raw data                       │
├─────────────────────────────────────────────┤
│ Controls Section                            │
│ - Dataset selector: [ARC2-Eval ▼]           │
│ - Results set selector: [Select pair ▼]     │
│   (e.g., "model-attempt1 + model-attempt2") │
│ - [View Union Accuracy] button               │
├─────────────────────────────────────────────┤
│ Results Display (conditional)                │
│ - AttemptUnionCard component                │
│ - Union metrics table/grid                  │
│ - Puzzle ID list with ClickablePuzzleBadge  │
│ - Comparison with individual model scores   │
└─────────────────────────────────────────────┘
```

**Key State:**
```typescript
const [dataset, setDataset] = useState<'arc1' | 'arc2'>('arc2');
const [selectedAttemptPair, setSelectedAttemptPair] = useState<string | null>(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [unionMetrics, setUnionMetrics] = useState<AttemptUnionStats | null>(null);
```

### 2. Fetch & Filter Hugging Face Models
**Backend Query:** Use existing `MetricsRepository.getMultiModelComparison()`
- Already filters by dataset
- Already computes union stats
- Just need to filter response to HF-only models

**HF Model Identification:**
Models from HF submissions typically have:
- API key pattern: `huggingface/` or `hf/`
- Or check metadata field: `origin: 'huggingface'` (if available in database)

**Filter Logic:**
```typescript
// In HuggingFaceUnionAccuracy.tsx component
const hfModels = comparisonSummary?.models?.filter(m =>
  m.name.toLowerCase().includes('huggingface') ||
  m.origin === 'huggingface'
) ?? [];

// Group by base model name (before -attempt1, -attempt2)
const attemptGroups = groupByBaseModelName(hfModels);
```

### 3. Create Results Pair Selector
**Dropdown Options:** Show all detected attempt pairs from HF results
```typescript
const attemptPairs = attemptGroups
  .filter(group => group.attempts.length >= 2) // Only pairs with 2+ attempts
  .map(group => ({
    label: `${group.baseModelName} (Attempt 1 + 2)`,
    value: group.baseModelName,
    attempts: group.attempts,
  }));
```

### 4. Display Union Accuracy Results
Reuse the **AttemptUnionCard** component from `ModelComparisonDialog.tsx`:
- Shows union accuracy % with progress bar
- Shows explanation of union metric
- Shows formula breakdown
- Shows model badges

**Additional Display:**
- Table comparing:
  - Model 1 (Attempt 1) accuracy
  - Model 2 (Attempt 2) accuracy
  - Union accuracy (both correct OR either correct)
  - Improvement from union
- List of puzzle IDs solved by union using **ClickablePuzzleBadge**
- Each badge opens puzzle in new tab for inspection

### 5. Add Info Banner
**Prominent disclaimer at top:**
```
⚠️ This is a visualization of official Hugging Face submissions tested against
the ARC-AGI v2 public evaluation set. This page shows aggregate metrics only.
For raw submission data, see Hugging Face: [link]
```

**Link:** https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval/tree/main

---

## Implementation Checklist (Phase 1)

- [ ] Create `client/src/pages/HuggingFaceUnionAccuracy.tsx` component
- [ ] Add route in `client/src/App.tsx` (e.g., `/hf-union-accuracy`)
- [ ] Add navigation link in header/menu (probably under Analytics or new HF section)
- [ ] Fetch HF models from backend using `getMultiModelComparison()` with dataset filter
- [ ] Implement model filtering to identify HF submissions
- [ ] Build attempt pair selector dropdown
- [ ] Reuse **AttemptUnionCard** component for display
- [ ] Add **ClickablePuzzleBadge** grid for puzzle IDs
- [ ] Add comparison table (Attempt1 vs Attempt2 vs Union accuracy)
- [ ] Add prominent info banner with HF link
- [ ] Style to match existing Analytics page aesthetic
- [ ] Test with ARC1-Eval and ARC2-Eval datasets
- [ ] Add loading/error states

---

## Phase 2: Future Enhancements (Optional)

- **Multi-pair comparison:** Select 2+ attempt pairs to compare side-by-side
- **Model-over-time view:** Show how union accuracy improved across model versions
- **Export functionality:** Download union accuracy results as CSV
- **Leaderboard integration:** Show HF results in a ranked leaderboard format
- **Difficulty analysis:** Break down union accuracy by puzzle difficulty/category
- **Submission metadata:** Display submission date, author, model architecture notes from HF

---

## Code Reuse Checklist

✅ **Union Accuracy Computation**
- Reuse: `computeAttemptUnionAccuracy()` from `client/src/utils/modelComparison.ts`
- Reuse: `parseAttemptModelName()` to extract base model + attempt number
- Reuse: `MetricsRepository.computeAttemptUnionStats()` backend method

✅ **Visual Components**
- Reuse: `AttemptUnionCard` from `ModelComparisonDialog.tsx` (copy into component or extract to shared folder)
- Reuse: `ClickablePuzzleBadge` for puzzle links
- Reference: `ModelComparisonPage.tsx` for layout patterns and state management

✅ **Data Fetching**
- Reuse: `getMultiModelComparison()` API endpoint (already filters by dataset)
- Reference: How ModelComparisonPage fetches and processes comparison data

---

## Key Design Principles

1. **Simple & Focused:** One page, one purpose—show HF union accuracy
2. **Clear Data Source:** Prominent disclaimer about official testing, visualization-only
3. **External Link:** Encourage users to verify with raw HF data
4. **Reuse > Rebuild:** Leverage the existing union accuracy logic (already proven)
5. **Minimal New Code:** Mostly composition of existing components and utilities

---

## Database/Backend Notes

**No new backend code needed!** Existing query (`getMultiModelComparison`) already:
- Fetches all models for a dataset
- Computes union stats via `computeAttemptUnionStats()`
- Returns metadata to identify model origin

**Optional backend enhancement (Phase 2):**
- Add `origin` field to model metadata if not already present
- This makes HF filtering more explicit: `origin: 'huggingface'`

---

## Testing Strategy

1. **Manual testing with real data:**
   - Navigate to `/hf-union-accuracy`
   - Select ARC2-Eval dataset
   - Select an attempt pair from dropdown
   - Verify union accuracy % appears
   - Click puzzle badges, verify they open in new tabs
   - Verify link to HF raw data works

2. **Edge cases:**
   - No HF results in dataset → Show "No Hugging Face results available"
   - Only 1 attempt available → Disable pair selector, show message
   - Very large puzzle ID list → Verify flex wrapping doesn't break layout

---

## Success Criteria

✅ Users can navigate to the page
✅ Users can select HF dataset + attempt pair
✅ Union accuracy metric displays correctly
✅ Explanation & formula are clear
✅ Puzzle IDs are clickable and open in new tabs
✅ Info banner clearly states "visualization only"
✅ Link to raw HF data is prominent
✅ Page works on mobile (responsive)
✅ No console errors or type issues

---

## Files to Reference

- `client/src/pages/ModelComparisonPage.tsx` - Layout & state patterns
- `client/src/pages/AnalyticsOverview.tsx` - Page structure & data fetching
- `client/src/components/analytics/ModelComparisonDialog.tsx` - AttemptUnionCard component
- `client/src/utils/modelComparison.ts` - Union accuracy utilities
- `server/repositories/MetricsRepository.ts` - Backend union stats logic
- `shared/types.ts` or `server/types/index.ts` - Type definitions (ModelComparisonResult, AttemptUnionStats, etc.)

---

## Questions for Implementer

Before starting, clarify:

1. **How to identify HF models:** Does the database have an `origin` field? If not, should we add one? Or rely on model name patterns?
2. **Dataset display:** Should page default to ARC2-Eval only, or allow both ARC1 & ARC2?
3. **Puzzle grid limit:** If 100+ puzzles in union, show all or paginate?
4. **Comparison display:** Show individual attempt scores alongside union, or union-only?
5. **Mobile layout:** Simplified view for small screens (hide explanation section?) or full layout?

---

**Status:** Ready for implementation
**Effort Estimate:** ~4–6 hours (mostly UI assembly, no new backend code)
**Owner:** [Next Developer]
