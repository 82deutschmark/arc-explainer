# Professional Progressive Reasoning Interface

**Author:** Cascade using Sonnet 4.5  
**Date:** 2025-10-11  
**Purpose:** Professional data table interface for progressive reasoning analysis

---

## Design Philosophy

Progressive reasoning analysis requires a **professional research interface** similar to:
- Financial trading terminals (Bloomberg, Reuters)
- Scientific data analysis platforms (Jupyter, RStudio)
- Analytics dashboards (Tableau, Looker)
- Database management tools (pgAdmin, DataGrip)

**NOT like:**
- Consumer messaging apps
- Social media interfaces
- Casual chat applications

---

## Core Components

### 1. IterationDataTable

**Purpose:** Tabular display of iteration history with expand/collapse functionality.

**Columns:**
| Column | Width | Content |
|--------|-------|---------|
| Toggle | 48px | Expand/collapse button |
| Iter # | 80px | `#1`, `#2` (font-mono) |
| Model | 128px | Model name badge |
| Result | 96px | ✓ Correct / ✗ Incorrect badge |
| Confidence | 96px | `85%` (font-mono) |
| Reasoning | 112px | Token count (font-mono, purple) |
| Prediction | 128px | TinyGrid preview (80x80px) |
| Pattern | Fluid | Truncated summary (100 chars) |
| Timestamp | 128px | Formatted date/time |

**Row Styling:**
- Correct predictions: `bg-green-50/30` (subtle green tint)
- Incorrect predictions: `bg-red-50/30` (subtle red tint)
- Hover: `hover:bg-gray-50` (consistent across all rows)

**Expanded State:**
- Full AnalysisResultCard embedded in table row
- Spans all columns
- Shows complete analysis details using existing component

### 2. ProfessionalRefinementUI

**Purpose:** Orchestrator component managing the entire refinement interface.

**Layout Structure:**
```
┌─ Header Card ──────────────────────────────────────┐
│  Progressive Reasoning Analysis                    │
│  Model: grok-4-fast-reasoning                      │
│                                                     │
│  [Metrics Grid - 4 columns]                        │
│  Total: 5 | Correct: 2 | Tokens: 12.5k | Status: ✓│
└────────────────────────────────────────────────────┘

┌─ Advanced Model Parameters (CollapsibleCard) ──────┐
│  ▶ Show/Hide                                       │
│  [Temperature slider, GPT-5 reasoning params]      │
└────────────────────────────────────────────────────┘

┌─ Iteration History (Table) ────────────────────────┐
│  [IterationDataTable component]                    │
│  Row 1: #0 | Model | ✗ | 75% | 2.5k | [Grid] | ...│
│  Row 2: #1 | Model | ✗ | 82% | 3.8k | [Grid] | ...│
│  Row 3: #2 | Model | ✓ | 91% | 6.2k | [Grid] | ...│
└────────────────────────────────────────────────────┘

┌─ Continue Refinement (Card) ───────────────────────┐
│  User Guidance: [Textarea]                         │
│  [Generate Next Iteration Button]                  │
│  [Success/Error Alerts]                            │
└────────────────────────────────────────────────────┘
```

**Metrics Dashboard:**
- 4-column grid with clear labels
- Large font sizes for numbers (text-2xl)
- Color coding: Green for correct, Purple for tokens
- Badges for status (✓ Correct / ✗ Incorrect)

### 3. Puzzle Display

**Purpose:** Standard puzzle grid display matching PuzzleExaminer pattern.

**Uses:** Regular `PuzzleGrid` components (NOT TinyGrid for main display)
- Training examples: 2 or 4 column responsive grid
- Test cases: Standard size with proper spacing
- Labeled sections with badge counts

---

## Key Metrics

### Displayed Prominently
1. **Total Iterations**: Count of refinement cycles
2. **Correct Predictions**: How many got the right answer
3. **Reasoning Tokens**: Cumulative token usage
4. **Current Status**: Latest iteration correctness

### Per-Iteration (in table)
- Iteration number
- Model used
- Correctness (✓/✗)
- Confidence percentage
- Reasoning tokens (this iteration)
- Predicted grid (visual preview)
- Pattern summary (brief)
- Timestamp

---

## Design Patterns

### Following PuzzleExaminer Standards

**Card Layout:**
- White background, gray borders
- Consistent padding (p-3, p-4)
- CardHeader + CardContent structure

**CollapsibleCard:**
- For Advanced Controls
- Matches PuzzleExaminer's Advanced Controls section
- Same styling, same behavior

**Typography:**
- Headers: text-lg, font-semibold
- Labels: text-sm, font-medium
- Data: font-mono for numbers
- Descriptions: text-sm, text-gray-600

**Color Scheme:**
- Gray scale for structure (50, 100, 200, 500, 600, 700, 900)
- Purple for primary actions and reasoning (600, 700)
- Green for success/correct (50, 600)
- Red for errors/incorrect (50, 600)
- Blue for info and secondary (50, 600, 700)

**Spacing:**
- Section gaps: space-y-4
- Internal spacing: gap-2, gap-3, gap-4
- Padding: p-2, p-3, p-4
- Margins: mb-2, mb-3, mt-1, mt-2

---

## User Workflows

### 1. Viewing Iteration History

**Scenario:** Researcher wants to see how model improved over iterations.

**Steps:**
1. Look at metrics dashboard - see 5 iterations, 2 correct
2. Scan table rows - green/red tint shows correctness at a glance
3. Check predicted grid previews in table column
4. Read pattern summaries for context

**Result:** Quick understanding of progression without clicking.

### 2. Deep Diving into Specific Iteration

**Scenario:** Researcher wants full details on iteration #3.

**Steps:**
1. Click expand button on row #3
2. Table row expands showing full AnalysisResultCard
3. Review complete analysis: pattern, strategy, hints, reasoning
4. See predicted vs expected grids with diff highlighting
5. Check token usage, cost, timing

**Result:** Complete analysis details using familiar AnalysisResultCard interface.

### 3. Continuing Refinement

**Scenario:** Latest iteration was incorrect, want to try again.

**Steps:**
1. Check Current Status metric - shows ✗ Incorrect
2. Optionally provide user guidance in textarea
3. Click "Generate Next Iteration" button
4. New row appears in table with updated analysis

**Result:** Seamless iteration workflow.

---

## Technical Implementation

### Component Hierarchy
```
PuzzleDiscussion.tsx
├─ PuzzleGrid (Training + Test display)
└─ ProfessionalRefinementUI
    ├─ Metrics Dashboard (Card)
    ├─ CollapsibleCard (Advanced Controls)
    ├─ IterationDataTable
    │   └─ AnalysisResultCard (expanded rows)
    └─ Continue Refinement (Card)
```

### Data Flow
1. **PuzzleDiscussion** manages state (iterations, model, guidance)
2. **ProfessionalRefinementUI** receives props, calculates metrics
3. **IterationDataTable** renders rows, handles expand/collapse
4. **AnalysisResultCard** shows full details (reused component)

### State Management
- Parent component owns iteration state
- Table manages expanded row state locally
- No complex state synchronization
- Props drilling is acceptable for this depth

---

## Comparison: Professional vs Chat

| Aspect | Chat Interface | Professional Interface |
|--------|----------------|------------------------|
| **Visual Metaphor** | Messaging app | Data analytics platform |
| **Layout** | Message bubbles | Data table |
| **Density** | Low (3-4 visible) | High (10+ visible) |
| **Scanning** | Sequential reading | Instant row scanning |
| **Metrics** | Header stats | Prominent dashboard |
| **Details** | Always embedded | Expandable on demand |
| **Grid Display** | Tiny (64px) | Preview (80px) + Full (expandable) |
| **Professional Feel** | Consumer app | Research tool |
| **Target User** | General public | Researchers, analysts |

---

## Benefits

### For Researchers
- **Fast Scanning**: See 10+ iterations without scrolling
- **Familiar Patterns**: Matches PuzzleExaminer they already use
- **Data Dense**: Maximum information per screen space
- **Professional**: Looks serious, not toy-like
- **Expandable**: Details available when needed, not overwhelming

### For Development
- **Reusable**: Uses existing AnalysisResultCard
- **Consistent**: Follows established design patterns
- **Maintainable**: Standard table + card structure
- **Extensible**: Easy to add columns or metrics

### For Analysis
- **Correctness Tracking**: Visual green/red coding
- **Token Monitoring**: See reasoning token growth
- **Pattern Evolution**: Read summary progression
- **Temporal Data**: Timestamps for iteration timing

---

## Success Metrics

### UI should enable:
1. **3-second scan**: Identify which iterations were correct in <3 seconds
2. **Data density**: 10+ iterations visible on standard 1080p screen
3. **No confusion**: Users immediately recognize as data table, not chat
4. **Familiar patterns**: Researchers say "looks like PuzzleExaminer"

### Research should reveal:
1. **Improvement rate**: % puzzles that go from ✗ → ✓
2. **Iteration count**: Average iterations to reach correctness
3. **Token efficiency**: Cost/benefit of reasoning tokens
4. **Pattern insights**: How explanations evolve

---

## Future Enhancements

### Near-term
- [ ] Add sort/filter to table (by correctness, tokens, timestamp)
- [ ] Export table data as CSV
- [ ] Add column showing diff count (cells changed from previous)
- [ ] Show delta in confidence between iterations

### Mid-term
- [ ] Comparison view: Side-by-side iteration comparison
- [ ] Chart visualization: Line graph of confidence over iterations
- [ ] Search/filter pattern summaries
- [ ] Add notes/annotations to specific iterations

### Long-term
- [ ] Multi-puzzle comparison: Which puzzles benefit from refinement?
- [ ] Model comparison: Which models improve with refinement?
- [ ] Analytics: Average iterations-to-success by model
- [ ] Batch refinement: Run refinement on multiple puzzles

---

## Conclusion

The professional data table interface treats progressive reasoning analysis as **scientific research**, not casual conversation.

The table format provides:
- **Instant visibility** into iteration history
- **Familiar patterns** matching existing tools
- **Professional appearance** for research work
- **Data density** without overwhelming
- **Expandable details** using proven AnalysisResultCard

This aligns with the project's identity as a **research platform** for analyzing AI capabilities on ARC-AGI puzzles, not a consumer chat application.
