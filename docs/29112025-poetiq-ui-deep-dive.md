# Poetiq UI Deep Dive - Comprehensive Implementation Plan

**Date**: 2025-11-29
**Status**: Planning Phase
**Scope**: Ultra-detailed UI enhancements leveraging full PoetiqBridgeEvent data stream

---

## OBJECTIVE

Design and implement production-ready UI components that fully leverage the rich PoetiqBridgeEvent stream data while addressing the core user anxiety: **What is happening during a 30-minute wait?** The solution must scale from casual users (just show progress) to power users (inspect reasoning, prompts, token efficiency, error analysis) without overwhelming either audience.

---

## CONTEXT: WHAT WE KNOW

### Current Hook State (usePoetiqProgress.ts)
The hook already accumulates ALL available data in structured buffers:
- `logLines[]`: Event log (capped 500)
- `reasoningHistory[]`: Raw LLM reasoning (capped 100)
- `reasoningSummaryHistory[]`: GPT-5.x chain-of-thought summaries (capped 50)
- `promptHistory[]`: All prompts sent (capped 50)
- `promptTimeline[]`: Prompts with iteration/expert metadata (capped 50)
- `pythonLogLines[]`: Sandbox execution output
- `tokenUsage`: Global token count (input/output/total)
- `cost`: Global cost breakdown
- `expertTokenUsage`: Per-expert token tracking
- `expertCost`: Per-expert cost breakdown
- `trainResults[]`: Per-iteration validation results
- `status`, `phase`, `iteration`, `expert`: Real-time state
- `rawEvents[]`: Full WebSocket payload history (capped 200)

**Hook already does 90% of the work.** UI just needs to consume and visualize this data properly.

### Event Flow Timing (Actual Wall-Clock Reality)
```
ITERATION N:
├─ Prompting phase (5-30s):    LLM API latency, waiting for response
│                               (user sees this as "thinking")
├─ Thinking phase (0-60s+):     Reasoning token accumulation (o3/gpt-5.x only)
│                               Shows progress with each token
├─ Evaluating phase (1-5s):     Sandbox execution of generated code
│                               Instant: quick success/fail feedback
├─ Feedback phase (2-10s):      Error parsing, building next prompt
│                               Visible in logs but brief
└─ NEXT ITERATION or DONE

KEY INSIGHT: Most time is in "prompting" (waiting for LLM).
Users need reassurance they're not hung, cost is accumulating, progress is being made.
```

### Multi-Expert Parallel Execution
- All experts run simultaneously (1, 2, or 8)
- Each expert has its own iteration loop
- Each expert's results feed into voting/selection
- Token costs and reasoning accumulate per-expert
- User wants to see: which expert is ahead? which found best solution?

---

## FILES TO MODIFY

### Core UI Components (Frontend)
1. **`client/src/components/poetiq/PoetiqProgressDashboard.tsx`** [NEW]
   - Central orchestrator for all real-time progress visualization
   - Consumes hook state, delegates to sub-components
   - Handles layout responsiveness for 30-min wait

2. **`client/src/components/poetiq/PoetiqPhaseIndicator.tsx`** [NEW]
   - Real-time phase visualization with timing
   - Shows current phase + how long spent in each
   - Actual phases: prompting, thinking, evaluating, feedback

3. **`client/src/components/poetiq/PoetiqExpertTracker.tsx`** [NEW]
   - Parallel expert status dashboard
   - Per-expert iteration progress
   - Per-expert token/cost accumulation
   - Which expert found best solution

4. **`client/src/components/poetiq/PoetiqIterationResults.tsx`** [NEW]
   - Side-by-side grid: training example results per iteration
   - Pass/fail status, soft scores, error analysis
   - Train score trend visualization (graph)

5. **`client/src/components/poetiq/PoetiqTokenMetrics.tsx`** [NEW]
   - Real-time token counter (input/output/total)
   - Live cost tracker with provider pricing context
   - Per-expert breakdown (mini tables)
   - Efficiency metrics: tokens per iteration, cost per solve attempt

6. **`client/src/components/poetiq/PoetiqPromptInspector.tsx`** [ENHANCE]
   - Current: shows single prompt
   - New: add timeline view, side-by-side comparison, diff highlighting
   - Show iteration N vs N-1 to see how feedback altered prompt

7. **`client/src/components/poetiq/PoetiqReasoningViewer.tsx`** [NEW]
   - For advanced models (o3, gpt-5.x): show streaming reasoning tokens
   - Chain-of-thought summary display
   - Mark truncation if reasoning capped at 100 entries
   - Toggle between raw reasoning and summaries

8. **`client/src/components/poetiq/PoetiqErrorAnalyzer.tsx`** [NEW]
   - When iteration fails, analyze error type
   - Shape mismatch? Color mismatch? Logic error? Timeout?
   - Show which training examples failed
   - Display error traceback in collapsible panel

9. **`client/src/components/poetiq/PoetiqTerminalView.tsx`** [ENHANCE]
   - Current: PoetiqPythonTerminal shows executions
   - New: add streaming output during "evaluating" phase
   - Show stdout/stderr from sandbox in real-time

10. **`client/src/components/poetiq/PoetiqActivityLog.tsx`** [ENHANCE]
    - Current: PoetiqLiveActivityStream is basic
    - New: add severity filtering, search, export options
    - Highlight critical events (errors, phase transitions)
    - Show expert context (which expert logged this)

### Layout & Page
11. **`client/src/pages/PoetiqSolver.tsx`** [ENHANCE]
    - Current: 2-column layout works but info scattered
    - New: integrate PoetiqProgressDashboard as primary view during run
    - Training grids shown pre-run, hidden during run to maximize output space
    - Inspector panels remain toggleable but don't break layout

### Hook Enhancement (Minimal)
12. **`client/src/hooks/usePoetiqProgress.ts`** [ENHANCE]
    - Add phase timing tracking: when did phase start?
    - Track phase transitions (to detect stuck states)
    - Compute metrics: tokens/sec, cost/iteration, best expert so far
    - No new WebSocket changes - just derive metrics from existing data

---

## IMPLEMENTATION TASKS

### Phase 1: Foundation (Phase Awareness & Timing)

**1. Enhance usePoetiqProgress hook for timing data**
- Add `phaseStartTime` field to track when current phase began
- Add `phaseHistory[]`: array of {phase, startedAt, endedAt, duration}
- Compute elapsed time in current phase on every state update
- Detect phase transitions and log them
- Result: hook now knows "we've been prompting for 28 seconds"

**2. Create PoetiqPhaseIndicator component**
- Input: `phase`, `iteration`, `phaseStartTime`, `message`
- Display: visual phase progress bar with 4 segments (prompting → thinking → evaluating → feedback)
- Each segment shows elapsed time + estimate to completion
- Color code: gray (waiting), blue (thinking), green (executing), yellow (parsing)
- Show spinner in active phase
- Result: user sees EXACTLY what's happening and how long it's been

**3. Create PoetiqProgressDashboard orchestrator**
- Input: full `PoetiqProgressState` from hook
- Layout: 4-quadrant grid (responsive to single column on mobile)
  - Top-left: Phase indicator + elapsed time
  - Top-right: Expert tracker (next task)
  - Bottom-left: Iteration results grid (next task)
  - Bottom-right: Token metrics (next task)
- Composition: render sub-components, pass relevant slices of state
- Result: single source of truth for "what's happening right now"

---

### Phase 2: Expert Visibility (Multi-Expert Tracking)

**4. Create PoetiqExpertTracker component**
- Input: `numExperts`, `expert` (current), `expertTokenUsage`, `expertCost`, `iteration`, `trainResults`
- Display: Expert cards (1-8 depending on config)
  - Each card shows: expert ID, current iteration, current phase
  - Mini progress bars: iterations completed (0-10 or configured max)
  - Token counter: tokens spent by this expert so far
  - Cost counter: cost accumulated by this expert
  - Status badge: THINKING, EVALUATING, WAITING, COMPLETE, ERROR
  - Best accuracy achieved by this expert
- Highlight: bold border/background on currently-active expert
- Color scheme:
  - Green if 100% train accuracy achieved (solved)
  - Amber if partial success (50-99%)
  - Red if all iterations failed
- Result: users see parallel work in action, understand why 8 experts = slower aggregate

**5. Create PoetiqIterationResults component**
- Input: `trainResults[]` (from current iteration), `iteration` count, `expert` ID
- Display grid: each training example as column
  - Input grid (small thumbnail)
  - Arrow →
  - Output grid (what code produced)
  - Status: ✓ (match) or ✗ (mismatch)
  - Error detail on hover (shape mismatch, color error, etc.)
- Add iteration history: collapsible list of previous iterations with same layout
- Include train score trend: line graph showing % pass rate over iterations (0-10)
- Add error analysis:
  - If iteration fails: "Training ex #3 failed: Shape mismatch (expected 5x5, got 4x3)"
  - Color it red, make it obvious
- Result: user sees EXACTLY what code produced, where it failed, trend toward 100%

**6. Add per-expert iteration tracking to hook**
- Maintain `expertIterationResults`: {expertId: {iteration: number, trainResults: [], bestScore: number}}
- Update whenever we see new expert + iteration combo
- Result: PoetiqExpertTracker can show which iteration each expert is on

---

### Phase 3: Cost & Token Transparency (Real-Time Financial Data)

**7. Create PoetiqTokenMetrics component**
- Input: `tokenUsage`, `cost`, `expertTokenUsage`, `expertCost`, `iteration`
- Display:
  - Large counter: TOTAL TOKENS (input / output / total)
  - Below: TOTAL COST ($X.XX)
  - Sparkline trend: tokens/iteration over time (insight: are iterations getting longer?)
  - Per-expert mini-table:
    | Expert | Tokens | Cost | Tokens/Iter | Cost/Iter |
    |--------|--------|------|-------------|-----------|
    | 1      | 12.4k  | $0.14| 1.24k       | $0.014    |
    | 2      | 18.3k  | $0.22| 1.83k       | $0.022    |
- Context callout: "At this rate, full 10 iterations × 2 experts ≈ 400k tokens / $4.80"
- Result: user FEELS the cost accumulating, understands value proposition

**8. Compute efficiency metrics in hook**
- `tokensPerIteration`: trending average of tokens used per iteration (per expert)
- `costPerSolveAttempt`: cost to go from 0→100% accuracy on training examples
- `estimatedFinalCost`: based on trajectory, what will this run cost?
- `costPerExpert`: simple math from `expertCost` dict
- Result: PoetiqTokenMetrics has rich data to display

---

### Phase 4: Advanced Transparency (Power Users)

**9. Enhance PoetiqPromptInspector with timeline + diff**
- Current: shows single prompt
- New features:
  - Timeline view: dropdown or tabs showing Iter 1 → Iter 2 → Iter 3 prompts
  - Diff viewer: highlight what changed between iterations (feedback from errors)
  - Mark sensitive data: show `***API_KEY***` instead of actual keys
  - Search box: filter prompts by keyword
  - Export: copy single prompt or all prompts as JSON
- Result: advanced users can understand how feedback loop works

**10. Create PoetiqReasoningViewer component**
- Input: `reasoningHistory[]`, `reasoningSummaryHistory[]`
- Display:
  - If `reasoningSummaryHistory` present: show GPT-5.x summaries (cleaner)
  - Else: show raw `reasoningHistory` if available
  - Collapsible panels: one per iteration + expert
  - Mark if truncated: "Showing 100 of 250+ reasoning blocks (capped for performance)"
  - Auto-highlight: key insight keywords (error, found, test, match, etc.)
- Result: power users can debug AI thinking, understand why certain approaches failed

**11. Create PoetiqErrorAnalyzer component**
- Input: `status`, `message`, `trainResults[]` (when some fail)
- Logic: parse error patterns
  - Syntax error in generated code? → show code snippet + error line
  - Shape mismatch? → show expected vs actual grid shapes
  - Timeout? → show "Execution exceeded 5s limit"
  - Logic error? → show "Color mapping incorrect: expected red, got blue"
- Display:
  - Error summary card (red background, clear icon)
  - Training example grid: which examples failed?
  - Error detail: full traceback in collapsible pre block
  - Suggestion: "This error suggests the AI needs feedback about..."
- Only show when `status === 'error'` OR `trainResults.some(r => !r.success)`
- Result: user understands why iteration failed, feels confidence in "feedback" phase

**12. Create PoetiqTerminalEnhancer (upgrade existing PoetiqPythonTerminal)**
- Add real-time streaming output during "evaluating" phase
- Show stdout line-by-line as code executes
- Color code output: green (success), red (failure/error), yellow (warning)
- Show execution time per example
- If timeout: "Example 3 execution exceeded 5s limit"
- Result: user sees exact Python output, builds trust in sandbox

---

### Phase 5: Layout Integration (Page-Level)

**13. Refactor PoetiqSolver page layout**
- Current: 2-column fixed (left: results, right: training grids / logs)
- New during RUN:
  - Left column (40%): PoetiqProgressDashboard (phase + experts + iterations)
  - Right column (60%): PoetiqTerminalView (code + execution output)
  - Below both: collapsible inspector sections (prompts, reasoning, errors, tokens)
  - Hidden: training grids (shown pre-run only)
- New pre-RUN:
  - Left column: training grids (existing)
  - Right column: control panel (existing)
- New post-RUN:
  - Left column: final result card + generated code
  - Right column: event log + token summary
- Result: maximize visibility during wait, minimize clutter

**14. Enhance activity log (PoetiqLiveActivityStream)**
- Add filtering: checkbox group to show/hide by category
  - ☑ Iteration events
  - ☑ Error messages
  - ☐ Debug logs
  - ☑ Expert voting
- Add search: text input to filter logs by keyword
- Add severity indicators: color-code by level (info/warn/error)
- Add expert context: show which expert generated log (e.g., "[Expert 2] Iteration 5...")
- Preserve auto-scroll unless user pauses
- Result: casual users see clean stream, power users can drill down

---

### Phase 6: Terminal States & Error Handling

**15. Design terminal state UX components**
- Create reusable component: PoetiqTerminalStateCard
- States to handle:
  - `SOLVED`: "All training examples correct! Test prediction: [grid]"
  - `UNSOLVED`: "Best achieved X% on training examples. Iteration limit reached."
  - `ERROR`: Error analyzer component (task 11)
  - `TIMEOUT`: "Solver exceeded 30-minute timeout. Best solution: [code]"
  - `PARTIAL`: "8 experts ran. Best accuracy: 75%. Some experts achieved 100%."
- Each state shows:
  - Clear success/failure indicator
  - Best code generated (if any)
  - Statistics summary
  - Suggestion for next steps
- Result: user knows exactly what happened and why

**16. Add WebSocket disconnect fallback**
- If WS closes unexpectedly during run:
  - Show warning banner: "Connection lost. Polling fallback active."
  - Continue polling `/api/poetiq/status/:sessionId` every 5 seconds
  - Auto-reconnect WS on page focus/visibility change
  - Preserve UI state (don't clear logs, metrics)
  - Resume updates when connection restored
- Result: robust UX for flaky networks

---

## COMPONENT PROP INTERFACES

### PoetiqProgressDashboard
```typescript
interface PoetiqProgressDashboardProps {
  state: PoetiqProgressState;
  isRunning: boolean;
  isDone: boolean;
  onCancel?: () => void;
}
```

### PoetiqPhaseIndicator
```typescript
interface PoetiqPhaseIndicatorProps {
  phase?: string;
  iteration?: number;
  totalIterations?: number;
  message?: string;
  phaseStartTime?: number; // unix ms
  elapsedMs?: number;
}
```

### PoetiqExpertTracker
```typescript
interface PoetiqExpertTrackerProps {
  numExperts: number;
  currentExpert?: number;
  expertTokenUsage: Record<string, PoetiqTokenUsage>;
  expertCost: Record<string, PoetiqCostBreakdown>;
  expertIterationProgress: Record<string, { iteration: number; best: number }>;
  expertStatuses: Record<string, 'thinking' | 'evaluating' | 'waiting' | 'solved' | 'error'>;
}
```

### PoetiqIterationResults
```typescript
interface PoetiqIterationResultsProps {
  trainResults?: Array<{ success: boolean; softScore: number; error?: string }>;
  iteration?: number;
  expert?: number;
  iterationHistory?: Array<{
    iteration: number;
    trainResults: Array<{ success: boolean; softScore: number }>;
  }>;
  trainExamples?: Array<{ input: number[][]; output: number[][] }>;
}
```

### PoetiqTokenMetrics
```typescript
interface PoetiqTokenMetricsProps {
  tokenUsage?: PoetiqTokenUsage | null;
  cost?: PoetiqCostBreakdown | null;
  expertTokenUsage: Record<string, PoetiqTokenUsage>;
  expertCost: Record<string, PoetiqCostBreakdown>;
  iteration?: number;
  totalIterations?: number;
  model?: string;
}
```

---

## INTEGRATION POINTS

1. **Hook → Components**: PoetiqProgressDashboard receives full `state` from `usePoetiqProgress()`
2. **Sub-components**: Dashboard slices state and passes relevant fields to each component
3. **PoetiqSolver Page**: Detects `isRunning` to toggle layout, shows/hides dashboard
4. **Terminal Display**: Existing PoetiqPythonTerminal moved to right column during run
5. **Event Log**: Existing PoetiqLiveActivityStream enhanced with filtering/search
6. **Database Storage**: No changes needed - hook already captures `providerRawResponse` for replay
7. **Historical Replay**: Saved runs can be re-hydrated from `providerRawResponse` blob

---

## VALIDATION CHECKLIST

### User Anxiety Resolution
- ✓ User sees current phase (prompting/thinking/evaluating/feedback)
- ✓ User sees elapsed time in current phase (don't let them wonder "how long has it been?")
- ✓ User sees token accumulation in real-time (awareness of cost)
- ✓ User sees which expert is currently active (parallel work is visible)
- ✓ User sees progress toward 100% training accuracy (trend visible)
- ✓ User sees error analysis immediately when iteration fails
- ✓ User can toggle power-user panels without disrupting main view

### Component Quality
- ✓ Each component has single responsibility (SRP)
- ✓ No duplication with existing components (DRY)
- ✓ Prop interfaces clearly document data contracts
- ✓ Responsive layout tested on mobile (reflow gracefully)
- ✓ Performance: no re-renders on every log line (memoize wisely)
- ✓ Accessibility: ARIA labels for status indicators, keyboard navigation

### Data Flow
- ✓ All data comes from hook (no redundant API calls)
- ✓ Metrics computed once in hook, used by many components
- ✓ Phase timing tracked in hook from first WebSocket update
- ✓ Expert iteration progress tracked per (expert, iteration) tuple
- ✓ No circular dependencies or prop drilling beyond 2 levels

### Error Handling
- ✓ Graceful display if expertTokenUsage is undefined (show "collecting...")
- ✓ Graceful display if trainResults not yet available (show "waiting...")
- ✓ Handle WS disconnection with fallback polling
- ✓ Render terminal state cards for error/timeout/solved
- ✓ Show meaningful message if expert count changes mid-run (shouldn't happen but safe)

### Power User Features
- ✓ Prompt inspector shows timeline of all prompts
- ✓ Reasoning viewer distinguishes summaries from raw
- ✓ Error analyzer highlights exact failure point
- ✓ Activity log filterable by category + searchable
- ✓ All data exportable (logs, prompts, reasoning, tokens)

---

## MVP DEFINITION

### Minimum Viable (Addresses Core Anxiety)
1. PoetiqPhaseIndicator (task 2) - shows what's happening
2. PoetiqProgressDashboard (task 3) - orchestrates the view
3. PoetiqExpertTracker (task 4) - shows parallel work
4. PoetiqTokenMetrics (task 7) - real-time cost awareness
5. Page layout refactor (task 13) - maximize visibility during run
6. Hook timing enhancement (task 1) - phase durations

**MVP Effort**: ~16 hours
**User Impact**: Transforms 30-minute waits from "is it hung?" anxiety to "I understand the timeline"

### Nice-to-Have (Power User Depth)
- Tasks 6, 9, 10, 11, 12, 14, 15, 16
- Effort: ~24 hours additional
- Impact: 5% of users will love this, 95% won't need it

---

## TECHNICAL NOTES

### Performance Considerations
- **Re-render Cost**: PoetiqProgressDashboard will re-render on every state update (many per second during prompting)
  - Mitigation: Memoize child components with `React.memo()` and `useMemo()` hooks
  - Only pass changed slices of state to sub-components
  - Use `useCallback()` for event handlers

- **Memory**: Buffer caps already in place (100 reasoning, 50 prompts, 500 logs, etc.)
  - No additional memory concern

- **Network**: WebSocket + polling fallback already implemented
  - No changes needed

### Historical Data Replay
- Saved `providerRawResponse` blob contains all iteration data
- To replay: deserialize blob, populate hook state synchronously, render normally
- UI remains unchanged (already reads from hook state)

### Testing Strategy
- Unit tests: PoetiqPhaseIndicator with mock timing data
- Unit tests: PoetiqTokenMetrics with various expert/token counts
- Integration test: PoetiqProgressDashboard with full mock `PoetiqProgressState`
- Smoke test: Layout shift on entering/exiting run (no overflow, readable at all sizes)
- E2E: Real solver run captured, UI displays correctly throughout

### Browser Compatibility
- WebSocket: IE11+, all modern browsers
- CSS Grid: IE11 (fallback to flex)
- CSS Animation: all modern (graceful degradation)

---

## ROLLOUT STRATEGY

1. **Phase 1 (3 days)**: Hook + Phase Indicator + Dashboard (MVP)
2. **Phase 2 (2 days)**: Expert Tracker + Iteration Results
3. **Phase 3 (2 days)**: Token Metrics + Page Layout
4. **Phase 4 (3 days)**: Advanced features (reasoning, prompt timeline, error analyzer)
5. **Phase 5 (2 days)**: Polish + testing + docs

---

## KNOWN CONSTRAINTS & DECISIONS

- **No new backend changes**: All data already in hook
- **No new database changes**: `providerRawResponse` already captures everything
- **No messaging system**: Use existing toast/alert patterns for WS errors
- **shadcn/ui + TailwindCSS**: Existing component library, no new deps
- **No fancy charts**: Line graphs OK, but avoid D3.js/Recharts (heavy deps)

---

## SUCCESS METRICS

1. **Reduced user anxiety**: Qualitative feedback ("I knew what was happening")
2. **Increased run completion**: Users stop canceling runs thinking they're hung
3. **Power user adoption**: 20%+ of sessions use inspector panels
4. **Performance**: Page remains responsive even with 500 log lines + streaming tokens
5. **Error rate**: <1% of runs end with ambiguous "unknown error" (error analyzer clarifies)

---

## APPENDIX: DATA EXAMPLE

**Hook State During 30-Minute Run (2 experts, iteration 3)**
```typescript
{
  status: 'running',
  phase: 'prompting',         // Current phase
  iteration: 3,               // Current iteration (0-indexed)
  expert: 1,                  // Currently Expert 1 is prompting
  totalIterations: 10,
  message: 'Sending prompt to OpenAI...',

  // Timing
  phaseStartTime: 1732869543210,  // When "prompting" phase started

  // Expert tracking
  expertTokenUsage: {
    'expert-0': { input_tokens: 4200, output_tokens: 1800, total_tokens: 6000 },
    'expert-1': { input_tokens: 3900, output_tokens: 2100, total_tokens: 6000 },
  },
  expertCost: {
    'expert-0': { input: 0.084, output: 0.054, total: 0.138 },
    'expert-1': { input: 0.078, output: 0.063, total: 0.141 },
  },

  // Global
  tokenUsage: { input_tokens: 8100, output_tokens: 3900, total_tokens: 12000 },
  cost: { input: 0.162, output: 0.117, total: 0.279 },

  // Iteration results
  result: {
    trainResults: [
      { success: true, softScore: 1.0 },
      { success: false, softScore: 0.5, error: 'Shape mismatch' },
      { success: true, softScore: 1.0 },
    ],
  },

  // Logs
  logLines: [
    '[12:30:15] 🚀 Poetiq Meta-System Solver starting...',
    '[12:30:15] 📋 Task: 05f8ee84',
    // ... 498 more lines
  ],

  // Reasoning (if GPT-5.x)
  reasoningSummaryHistory: [
    '[Iteration 0] [Expert 0] Let me analyze the pattern: The input grid contains...',
    '[Iteration 0] [Expert 1] Looking at the examples, I notice...',
    '[Iteration 1] [Expert 0] My previous approach failed. New strategy: ...',
    '[Iteration 2] [Expert 0] The feedback helped. Now trying...',
  ],

  // Prompts sent
  promptHistory: [
    // First prompt to expert 0, iteration 0
    { userPrompt: 'You are an ARC solver...', model: 'gpt-5.1-codex', ... },
    // Second prompt (after feedback) to expert 0, iteration 1
    { userPrompt: 'Your previous attempt failed on example 2...', ... },
    // And so on for expert 1
  ],
}
```

**PoetiqProgressDashboard Will Display**:
- Phase Indicator: "Prompting Expert 1 (18s elapsed) - 30s expected"
- Expert Tracker: Expert 0 (Iter 3, 6k tokens, $0.14), Expert 1 (Iter 3*, 6k tokens, $0.14)
- Iteration Results: Example 1 ✓, Example 2 ✗ (shape mismatch), Example 3 ✓ → 67% accuracy
- Token Metrics: 12k total tokens / $0.28 | Est. 80-100k final / $2.80 for full run

---

