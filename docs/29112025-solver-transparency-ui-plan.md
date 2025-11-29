# Comprehensive Solver Transparency UI Plan

## Objective
Transform the solver experience from a minimal event log ("Executing Python code...") into a fully transparent, human-understandable narrative that explains each iteration of the solving process, showing which transformation attempts succeeded/failed and why, with clear progress tracking across the iteration loop.

---

## Current State Analysis

**Problem**: Users see minimal feedback during 5-30 minute solving sessions:
- "Waiting for LLM response..." (opaque to end user)
- "Executing Python code..." (no progress indicator)
- No sense of which iteration they're on
- No explanation of failures or how feedback will be used
- Appears frozen/broken

**Architecture Context**:
- **Poetiq Backend**: Multi-expert, iterative solver that:
  - Runs N iterations (default 10, max 8 experts in parallel)
  - Each iteration: prompt → code gen → sandbox execute → evaluate → feedback
  - Emits `PoetiqBridgeEvent` stream with detailed metadata
  - Includes iteration counts, train results, token usage, reasoning
- **Current Frontend**: `StreamingAnalysisPanel` shows raw text output only
- **Backend Streaming**: Already emits rich iteration data via WebSocket (not utilized by UI)

---

## Information Architecture: What to Display

### Phase 1: Initialization (immediate)
**Duration**: <1 second
- "Setting up X experts for collaborative solving..."
- Show: number of experts, max iterations, temperature, model name
- Visual: Status badge ("Initialized")

### Phase 2: LLM Request → Response (5-30 minutes per iteration)
**User-facing narrative**:
- "Expert #1 analyzing transformation pattern (iteration 2/10)..."
- Show: Which expert, which iteration, elapsed time, estimated time remaining
- Show: Token usage being accumulated (input/output counts, reasoning tokens if applicable)
- Visual: Progress bar for elapsed iterations; spinner indicating "LLM thinking"

### Phase 3: Code Parsing (seconds)
**User-facing narrative**:
- "Parsing Python code from Expert #1..."
- Status: "✓ Code parsed successfully" or "✗ Invalid syntax – will retry"

### Phase 4: Sandbox Execution (seconds)
**User-facing narrative**:
- "Executing transform function against training data..."
- Show: Per-example results in expandable/collapsible section:
  - Training Example 1: Input shape (4×5), Predicted (3×6), Actual (3×6) → ✓ PASS
  - Training Example 2: Input shape (6×8), Predicted (2×4), Actual (3×6) → ✗ FAIL (shape mismatch)
  - etc.

### Phase 5: Result Evaluation (seconds)
**User-facing narrative**:
- "Training accuracy: 2/3 examples correct (66%)"
- Decision logic:
  - If 100% accuracy: "Perfect match! This solution works." → Return immediately
  - If >0% accuracy: "Progress made. Generating feedback for next iteration..."
  - If 0% accuracy: "No examples passed. Analyzing errors..."

### Phase 6: Feedback Generation (seconds)
**User-facing narrative**:
- "Analyzing failures to guide next attempt..."
- Show: Key error patterns detected:
  - "Shape transformation inconsistent: expected 3×6 but got 2×4"
  - "Color mapping rules incomplete: found 5/7 required color mappings"
  - "Spatial relationship not captured: rotation/reflection missing"

### Phase 7: Loop Back or Complete
**User-facing narrative**:
- If more iterations remain and accuracy < 100%:
  - "Incorporating feedback... Expert #2 will attempt iteration 3"
  - Loop back to Phase 2
- If all experts exhausted or perfect solution found:
  - "Solving complete after 7 iterations"
  - Show final accuracy, best code, execution time

---

## Visual Design Patterns

### Primary Surface: Expanded `SolverActivityPanel` (NEW component)

**Layout Structure**:
```
┌─ SolverActivityPanel ────────────────────────────┐
│ ┌─ Header ─────────────────────────────────────┐ │
│ │ Poetiq Solver: Task 00d62                     │ │
│ │ Running GPT-5-Nano with 2 experts            │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Current Phase Summary ──────────────────────┐ │
│ │ Expert #1 • Iteration 3 of 10 • 2m 14s       │ │
│ │ ════════════════════════════ 30% complete    │ │
│ │ "Analyzing second training example..."       │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Iteration Timeline (Accordion) ─────────────┐ │
│ │ ✓ Iteration 1: 78% accuracy (2.5s)          │ │
│ │ ✓ Iteration 2: 92% accuracy (3.1s)          │ │
│ │ ► Iteration 3: [IN PROGRESS] (2s elapsed) │ │
│ │   ├─ Phase: Executing code...               │ │
│ │   ├─ Example 1: ✓ PASS (shape match)        │ │
│ │   ├─ Example 2: ✗ FAIL (color mismatch)     │ │
│ │   └─ Feedback being generated...             │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Token Usage & Cost ─────────────────────────┐ │
│ │ Input: 12,450 tokens | Output: 3,280 tokens │ │
│ │ Cost so far: $0.18                            │ │
│ │ Estimated total: $0.42                        │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ ┌─ Best Solution So Far ───────────────────────┐ │
│ │ Accuracy: 92% (Iteration 2)                  │ │
│ │ [View Code] [Show Details]                   │ │
│ └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Key UI Components

1. **IterationAccordion** (expandable per-iteration details)
   - Shows collapsed: Iteration #, accuracy%, duration
   - Expands to show: phases, examples, feedback summary

2. **ExampleResultCard** (per training example)
   - Grid visualization (input + actual output)
   - Predicted output (show side-by-side)
   - Status badge: ✓ PASS | ✗ FAIL (with reason)
   - Details: shape, color mapping, spatial relationships

3. **FeedbackSummaryBadge**
   - Lists key error patterns in bullet form
   - Expandable for detailed analysis

4. **TokenUsageWidget**
   - Show live updates as tokens arrive
   - Display per-expert cumulative totals
   - Show cost estimate

5. **IterationProgressBar**
   - Visual bar showing current iteration (N of maxIterations)
   - Color coding: in-progress (blue), complete (green), failed (red)

### Styling Approach
- Use **shadcn/ui `Accordion`** for iteration timeline
- Use **shadcn/ui `Card`** for phase summaries
- Use **shadcn/ui `Badge`** for status (✓ PASS, ✗ FAIL, ⚙ IN PROGRESS)
- Use **shadcn/ui `Progress`** for iteration progress bar
- Color scheme: Amber/orange tones (consistent with existing PuzzleExaminer)
- Skeleton loaders for phase transitions

---

## Data Structures & Backend Changes

### New Type in `shared/types.ts` (or new file `shared/types/solver.ts`)

```typescript
// Iteration-level metadata
export interface SolverIterationState {
  iterationNumber: number;
  expertId: number;
  phase: 'llm_request' | 'code_parsing' | 'execution' | 'evaluation' | 'feedback';
  phaseMessage: string;
  elapsedMs: number;

  // Result of execution against training examples
  trainResults?: Array<{
    exampleIndex: number;
    success: boolean;
    softScore: number;
    expectedGrid?: number[][];
    predictedGrid?: number[][];
    error?: string;
    errorType?: 'shape_mismatch' | 'color_mismatch' | 'syntax' | 'timeout';
  }>;

  // Feedback for next iteration
  feedback?: {
    passedExamples: number;
    failedExamples: number;
    accuracy: number;
    keyIssues: string[];
    suggestions: string[];
  };

  code?: string;
  reasoning?: string;
  reasoningSummary?: string;
  tokenUsage?: {
    input: number;
    output: number;
    reasoning?: number;
  };
  cost?: {
    input: number;
    output: number;
    total: number;
  };
}

// Session-level tracking
export interface SolverSessionState {
  sessionId: string;
  puzzleId: string;
  model: string;
  numExperts: number;
  maxIterations: number;
  status: 'initialized' | 'in_progress' | 'completed' | 'failed';

  iterations: SolverIterationState[];
  currentPhase?: string;
  currentMessage?: string;

  // Aggregated metrics
  bestAccuracy: number;
  bestIterationIndex?: number;
  totalTokens: {
    input: number;
    output: number;
    reasoning?: number;
  };
  totalCost: number;
  elapsedMs: number;

  // Final result
  finalResult?: {
    success: boolean;
    accuracy: number;
    predictions?: number[][][];
    generatedCode?: string;
  };
}
```

### Backend Changes: `server/services/poetiq/poetiqService.ts`

**Current**: Emits `PoetiqBridgeEvent` (phase, message, trainResults)

**Enhanced**: Map events into richer context:
- Add `iterationState` to progress events
- Include computed `feedback` object (parse error messages)
- Add `elapsedMs` per iteration
- Track `bestAccuracy` globally
- Emit `session_state` event (periodic full state snapshot)

No breaking changes—just richer event payloads.

### Backend Changes: WebSocket Broadcast Pattern

Ensure backend uses `broadcast()` to emit `SolverSessionState` on regular cadence:
```typescript
broadcast('solver:update', {
  sessionId,
  iterations,
  currentPhase,
  bestAccuracy,
  totalTokens,
  // ... full state
});
```

---

## Frontend Components to Create/Modify

### New Files in `client/src/components/solver/`

1. **`SolverActivityPanel.tsx`**
   - Main container for all solver transparency
   - Props: `sessionState: SolverSessionState | null`, `isActive: boolean`
   - Responsibility: Layout, phase summary, iteration timeline orchestration
   - SRP/DRY: Delegates to child components

2. **`IterationTimeline.tsx`**
   - Accordion-based list of iterations
   - Props: `iterations: SolverIterationState[]`
   - Shows collapsed summary per iteration
   - Expands to show phases, examples, feedback

3. **`IterationCard.tsx`**
   - Single expanded iteration detail view
   - Props: `iteration: SolverIterationState`
   - Shows: execution phases, example results, feedback

4. **`TrainingExampleResult.tsx`**
   - Per-example success/failure visualization
   - Props: `example: SolverIterationState['trainResults'][number]`
   - Shows: input/output grids side-by-side, error message if failed
   - Reuses existing `PuzzleGrid` or `GridDisplay` components (DRY)

5. **`FeedbackSummary.tsx`**
   - Displays feedback for next iteration
   - Props: `feedback: SolverIterationState['feedback']`
   - Shows: key issues, suggestions in human-readable bullets

6. **`TokenUsageWidget.tsx`**
   - Live token and cost tracking
   - Props: `totalTokens, totalCost, estimatedTotal`
   - Updates reactively

### Modifications to Existing Files

1. **`client/src/hooks/useAnalysisResults.ts`**
   - Add new state: `solverSessionState: SolverSessionState | null`
   - Listen to WebSocket event: `solver:update`
   - Update state reactively as events arrive

2. **`client/src/components/puzzle/StreamingAnalysisPanel.tsx`**
   - Conditional render:
     - If `phase` starts with "poetiq_" or `isSolverFlow`, render `SolverActivityPanel`
     - Otherwise, render existing text/code output (backward compatible)

3. **`client/src/pages/PuzzleExaminer.tsx`**
   - Pass `solverSessionState` to `StreamingAnalysisPanel`
   - No other changes needed

---

## Integration Points

### 1. Real-time Updates
- WebSocket listener in `useAnalysisResults` hook
- Event: `solver:update` carries `SolverSessionState`
- Trigger state update → component re-render

### 2. Backward Compatibility
- Existing non-Poetiq flows (Grover, Saturn, direct LLM) continue unchanged
- Conditional rendering based on phase name or solver type

### 3. Grid Visualization
- Reuse existing `PuzzleGrid` component for training examples
- Pass `showColorOnly`, `showEmojis`, `emojiSet` from parent context
- Reduce duplication by reusing grid-rendering logic

### 4. Storage
- `providerRawResponse` field in Explanation table already stores iteration data
- No database schema changes needed
- UI pulls historical iteration details from existing DB structure

---

## MVP vs. Enhancements

### MVP (Phase 1: Essential Transparency)
- [x] Iteration accordion showing #, accuracy, duration
- [x] Current phase summary with progress bar
- [x] Training example results (pass/fail) per iteration
- [x] Token usage widget with live updates
- [x] Feedback summary bullets
- [x] Best solution so far indicator

**Estimated Scope**: 4-5 new components, 200-300 LoC TypeScript/TSX

### Enhancements (Phase 2: Polish & Insights)
- [ ] Animated transitions between phases
- [ ] Heatmap of accuracy improvement across iterations
- [ ] Code diff viewer (show how generated code evolved)
- [ ] Error analysis dashboard (group failures by error type)
- [ ] Estimated time remaining (ETA)
- [ ] Expert comparison chart (if running multi-expert)
- [ ] Hover tooltips explaining technical terms

---

## UX Patterns & Paradigms

### Familiar Patterns Users Understand

1. **Build log / CI/CD pipeline UI**
   - Users understand "steps" in a build process
   - Apply: "Iteration 1", "Iteration 2" = natural "steps"
   - Pass/fail status badges = familiar from tests

2. **Version control history**
   - Apply: "Best solution (iteration 3)" parallels "current commit"
   - Timeline view = git history metaphor

3. **API request/response inspector**
   - Apply: Token usage, cost tracking = familiar from API dashboards
   - Nested structure (expert → iteration → phase) = familiar DOM inspection

4. **ML training dashboard** (for technically-inclined users)
   - Apply: Accuracy improvement per iteration, token efficiency
   - Iteration timeline = epoch tracking

---

## Technical Implementation Notes

### State Management Approach
- Pull updates via WebSocket (reactive)
- Store in hook: `[solverSessionState, setSolverSessionState]`
- No TanStack Query needed—real-time stream, not cacheable

### Performance Considerations
- Large iteration counts (up to 10 iterations × 8 experts = potential 80 phases)
- Use virtualization (lazy-render only visible accordion items) if needed
- Skeleton loaders during phase transitions (avoid layout shift)

### Error Handling
- If WebSocket disconnects, show: "Live updates paused" warning
- Allow manual refresh to reload latest state
- Store iteration snapshots locally to avoid loss

### Accessibility
- ARIA labels for accordions
- Color + icon (not color alone) for status badges
- Keyboard navigation for accordion expand/collapse
- High contrast token usage numbers

---

## Validation & Success Criteria

### UI Usability
- [ ] Users can understand current iteration status without prior knowledge
- [ ] Error messages are actionable (not raw Python tracebacks)
- [ ] Accuracy improvements across iterations are visually obvious
- [ ] Time remaining estimate reduces user anxiety

### Technical Quality
- [ ] No PropTypes errors; full TypeScript coverage
- [ ] Integrates seamlessly with existing StreamingAnalysisPanel
- [ ] Backward compatible with non-Poetiq flows
- [ ] <500ms re-render on state update (performance OK for 10 iterations)

### Data Integrity
- [ ] All iteration details correctly stored in `providerRawResponse`
- [ ] Historical session data can be re-rendered from database
- [ ] Token usage and cost reconciliation with backend calculations

---

## Files to Create

```
client/src/components/solver/
├── SolverActivityPanel.tsx        # Main container
├── IterationTimeline.tsx          # Accordion wrapper
├── IterationCard.tsx              # Per-iteration detail
├── TrainingExampleResult.tsx      # Example pass/fail card
├── FeedbackSummary.tsx            # Feedback bullet list
└── TokenUsageWidget.tsx           # Token/cost display

shared/types/
└── solver.ts                      # SolverSessionState, SolverIterationState

(Modify existing)
client/src/hooks/useAnalysisResults.ts
client/src/components/puzzle/StreamingAnalysisPanel.tsx
server/services/poetiq/poetiqService.ts  # Enhance event enrichment
```

---

## Summary

This plan transforms the solver experience from opaque ("Executing...") into a transparent narrative that mirrors how humans understand problem-solving:
1. Multiple experts attempt solution
2. Each iteration: generate code → test → measure progress → adapt
3. Track improvement, show failures, explain feedback
4. Clear visual progress through iterations

The implementation reuses existing components (shadcn/ui, grid rendering), integrates with current WebSocket architecture, and maintains backward compatibility with other solver types.
