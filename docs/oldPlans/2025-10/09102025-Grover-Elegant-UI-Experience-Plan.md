# Grover Elegant UI Experience Plan

**Author:** Sonnet 4.5  
**Date:** 2025-10-09  
**Problem:** Users wait 5-27 minutes watching an empty console. Amazing algorithm is invisible.

---

## Current State: 🗑️ GARBAGE UI

```
Status: running | Iter: 1/5 | 0.0/10
┌─ Console ────────────┐
│ Waiting...          │ ← 2 minutes of NOTHING
└─────────────────────┘
```

## What's Actually Happening: 🤯 INCREDIBLE

```
Iteration 1: Generate 5 programs
├─ 📤 Send 3,972 char prompt
├─ 🤖 GPT-5-nano generates code
├─ 🐍 Execute on training examples
├─ ⚖️  Grade: [2.3, 4.7, 8.1, 3.2, 1.0]
├─ 🎯 Best: 8.1/10
└─ 🧠 Amplify: Best programs LAST

Iteration 2: Build on best + visual
├─ 🔗 API loads encrypted reasoning
├─ 📤 Send continuation (500 tokens)
├─ 🤖 Generate 4 new programs  
├─ ⚖️  Grade: [6.1, 9.3, 7.8, 5.2]
├─ 🎯 New best: 9.3/10
└─ 🧠 Context: 9 programs sorted
```

**Quantum-inspired search is INVISIBLE!**

---

## Vision: Make Search Visible

### Layout
```
┌──────────────────────────────────────────────┐
│ Grover • 898e7135 • Iter 3/5 • Best: 9.3/10 │
└──────────────────────────────────────────────┘

┌─ TIMELINE ──────────────────────────────────┐
│ ✅ Iteration 1  Best: 8.1/10  [▼]           │
│ ✅ Iteration 2  Best: 9.3/10  [▼]           │
│ 🔄 Iteration 3  Generating programs... 32s  │
│ ⏸  Iteration 4  Queued                      │
│ ⏸  Iteration 5  Queued                      │
└─────────────────────────────────────────────┘

┌─ LIVE ACTIVITY ────────────────────────────┐
│ [17:14:23] 🔄 Starting Iteration 3         │
│ [17:14:23] 📤 Sending 4,127 char prompt    │
│ [17:14:23] 🔗 Chain: resp_iter2_abc123     │
│ [17:14:56] ✅ Response (1,234 tokens)      │
│ [17:14:56] 📝 Found 4 programs             │
│ [17:14:57] 🐍 Executing on 3 examples...   │
└─────────────────────────────────────────────┘

┌─ SEARCH SPACE ─────────────────────────────┐
│ Score                                       │
│  10│              ●  ← Best                 │
│   9│           ●                            │
│   8│        ●                               │
│   7│     ●                                  │
│   0└────────────────────                   │
│     Iter1  Iter2  Iter3  Iter4  Iter5      │
└─────────────────────────────────────────────┘
```

---

## Components

### 1. IterationCard (Expandable)

**Collapsed:**
```
🔄 Iteration 3 • Running • 32s elapsed
⏳ Phase: Waiting for LLM Response
📊 Context: 9 programs, best=9.3/10 [▼]
```

**Expanded:**
```
✅ Iteration 2 • 2m 18s • Best: 9.3/10 [▲]

┌─ PROMPT SENT ─────────────────────────┐
│ 📤 4,127 chars • OpenAI Responses API │
│ 🔗 Conversation: iter1_resp_abc123    │
│ [View Full Prompt ▼]                  │
└───────────────────────────────────────┘

┌─ PROGRAMS GENERATED ──────────────────┐
│ Program 1 • 127 lines • 6.1/10        │
│ Program 2 • 143 lines • 9.3/10 🎯     │
│ Program 3 • 98 lines  • 7.8/10        │
│ Program 4 • 156 lines • 5.2/10        │
│ [View Code] [View Execution]          │
└───────────────────────────────────────┘

┌─ EXECUTION RESULTS ───────────────────┐
│ Example 1: ✅✅✅❌ (3/4 passed)        │
│ Example 2: ✅✅✅✅ (4/4 passed)        │
│ Example 3: ✅✅✅✅ (4/4 passed)        │
│ Average: 7.6/10 • Best: 9.3/10        │
└───────────────────────────────────────┘

┌─ CONTEXT AMPLIFICATION ───────────────┐
│ Total attempts: 9 programs            │
│ Best score: 9.3/10 (↑ from 8.1)      │
│ Sorted: best positioned LAST          │
│ Pruned: 2 lowest-scoring programs     │
│ Next iteration: 7 programs loaded     │
└───────────────────────────────────────┘
```

### 2. ProgramExecutionViewer

```
Program 2 - Execution Details

┌─ TRAINING EXAMPLE 1 ──────────────┐
│ Input → Output                     │
│ [2 2 2]       [7 7 7]  ✅ MATCH   │
│ [2 0 2]  →    [7 0 7]             │
│ [2 2 2]       [7 7 7]             │
│                                    │
│ Cell comparison: 9/9 cells (100%) │
└────────────────────────────────────┘

┌─ TRAINING EXAMPLE 2 ──────────────┐
│ ✅ MATCH - 16/16 cells            │
└────────────────────────────────────┘

┌─ TRAINING EXAMPLE 3 ──────────────┐
│ ❌ PARTIAL - 14/16 cells          │
│ Mismatched:                        │
│ • Position (2,1): Expected 5, Got 3│
│ • Position (2,3): Expected 5, Got 3│
└────────────────────────────────────┘

Overall Grade: 9.3/10
```

### 3. ConversationChainViewer

```
┌─ RESPONSES API CONVERSATION ──────┐
│ Leveraging 30-day encrypted storage│
│                                    │
│ Iteration 1 (Initial)              │
│ 💬 System + User → 3,972 tokens    │
│ 📦 Stored: resp_abc123xyz          │
│      ↓                             │
│ Iteration 2 (Continuation)         │
│ 🔗 Linked: resp_abc123xyz          │
│ 📥 API Retrieved: full context     │
│ 👤 User: 500 tokens (NEW only)    │
│ 📦 Stored: resp_def456uvw          │
│      ↓                             │
│ Iteration 3 (Continuation)         │
│ 🔗 Linked: resp_def456uvw          │
│ 📥 API Retrieved: cumulative       │
│                                    │
│ 💡 Token Savings:                  │
│ Without chaining: 13,333 tokens    │
│ With chaining: 500 tokens (-96%)  │
└────────────────────────────────────┘
```

---

## Animations & Interactions

### Live Updates Every Phase

**Waiting (0-30s):**
- Show prompt preview immediately
- Display conversation chain link
- Live timer with "thinking" animation

**Processing (30s-2m):**
- "Response received" notification
- Token usage stats
- Program extraction count

**Executing (2m-3m):**
- Per-program status bars
- Training example results streaming
- Real-time score updates

**Complete:**
- Celebrate score improvements (✨)
- Auto-expand next iteration
- Update search visualization

### Score Animation
```
🎯 New Best Score!
[8.1] → [9.3] ✨
+1.2 improvement
```

---

## Data Flow

```typescript
// Grover service sends RICH progress
sendProgress({
  phase: 'program_execution',
  iteration: 2,
  program: {
    index: 1,
    code: "def transform...",
    lines: 143
  },
  execution: {
    exampleIndex: 1,
    input: [[2,2,2]],
    output: [[7,7,7]],
    expected: [[7,7,7]],
    match: true
  }
});

// Hook accumulates detailed state
const {
  iterations,      // Array of completed iterations with full data
  currentIteration, // In-progress iteration
  programs,        // All programs generated
  scores,          // Score history
  executionResults // Grid-level execution details
} = useGroverProgress(taskId);

// Components render from state
<IterationCard 
  iteration={iterations[1]}
  programs={programs}
  expanded={true}
/>
```

---

## Implementation Phases

### Week 1: Core Components
- IterationCard (expandable)
- LiveActivityStream
- Enhanced grover.ts progress data

### Week 2: Visualizations
- SearchSpaceVisualization graph
- ConversationChainViewer
- Animations

### Week 3: Detail Views
- ProgramExecutionViewer
- Grid visualizations
- Code syntax highlighting

### Week 4: Polish
- Responsive design
- Performance optimization
- Accessibility

---

## Files to Create

1. `client/src/components/grover/IterationCard.tsx`
2. `client/src/components/grover/ProgramExecutionViewer.tsx`
3. `client/src/components/grover/LiveActivityStream.tsx`
4. `client/src/components/grover/SearchVisualization.tsx`
5. `client/src/components/grover/ConversationChain.tsx`

## Files to Modify

1. `server/services/grover.ts` - Add detailed progress broadcasts
2. `client/src/hooks/useGroverProgress.ts` - Capture rich data
3. `client/src/pages/GroverSolver.tsx` - Replace console with timeline

---

**Goal:** Turn 5 minutes of waiting into 5 minutes of fascination. Make the quantum search visible, educational, and beautiful. 🎨
