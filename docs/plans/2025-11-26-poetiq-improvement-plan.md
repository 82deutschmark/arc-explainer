/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-11-26
 * PURPOSE: Comprehensive improvement plan for Poetiq solver implementation
 *          Based on analysis of Saturn and Grover solver patterns
 * SRP and DRY check: Pass - Documentation only
 */

# Poetiq Solver Improvement Plan

## Executive Summary

The current Poetiq implementation is significantly less mature than Saturn and Grover solvers. This document outlines the gaps and a phased improvement plan to bring Poetiq up to the same quality standard.

## Gap Analysis

### File Count Comparison

| Component | Saturn | Grover | Poetiq | Gap |
|-----------|--------|--------|--------|-----|
| Server files | 5 | 5 | 3 | Missing streaming service, proper service layer |
| Client components | 21 | 4 | 5 | Missing specialized UI components |
| Hooks | 2 | 1 | 2 | Adequate |
| Total | 28 | 10 | 10 | Quality gap, not quantity |

### Server-Side Gaps

#### 1. Missing Streaming Service
- **Saturn has**: `saturnStreamService.ts` (SSE streaming with abort handling)
- **Grover has**: `groverStreamService.ts` (SSE streaming with abort handling)
- **Poetiq missing**: No dedicated streaming service - only basic WebSocket broadcasts

#### 2. No SSE Endpoint
- Saturn: `GET /api/saturn/stream/:taskId/:modelKey` 
- Grover: `GET /api/grover/stream/:taskId/:modelKey`
- Poetiq: None - only `POST /api/poetiq/solve/:taskId` with WebSocket

#### 3. In-Memory Batch Sessions
- Poetiq stores batch sessions in `Map<string, PoetiqBatchSession>` - lost on server restart
- Should use database like batch testing system does

#### 4. Missing Session Context
- Grover uses `setSessionContext()` for proper log broadcasting
- Poetiq doesn't use this pattern

### Client-Side Gaps

#### 1. Component Count Disparity

**Saturn Components (21 files)**:
- SaturnControlPanel.tsx
- SaturnFinalResultPanel.tsx
- SaturnHeroGallery.tsx
- SaturnImageCarousel.tsx
- SaturnImageGallery.tsx
- SaturnMetricsPanel.tsx
- SaturnModelSelect.tsx
- SaturnMonitoringTable.tsx
- SaturnPhaseTimeline.tsx
- SaturnProgressTracker.tsx
- SaturnRadarCanvas.tsx
- SaturnResultsShowcase.tsx
- SaturnStreamingTerminal.tsx
- SaturnStreamingVisualizer.tsx
- SaturnTerminalLogs.tsx
- SaturnVisualWorkbench.tsx
- SaturnWorkTable.tsx

**Grover Components (4 files)**:
- GroverModelSelect.tsx
- GroverStreamingModal.tsx
- IterationCard.tsx (shared)
- LiveActivityStream.tsx (shared)
- SearchVisualization.tsx (shared)

**Poetiq Components (1 file)**:
- PoetiqExplainer.tsx (just info text)

#### 2. Missing UI Features

| Feature | Saturn | Grover | Poetiq |
|---------|--------|--------|--------|
| Model selector component | ✅ | ✅ | ❌ (inline select) |
| Advanced controls panel | ✅ | ✅ | ❌ |
| Iteration cards | N/A | ✅ | ❌ |
| Live activity stream | ✅ | ✅ | ❌ |
| Code preview during solving | N/A | ✅ | ❌ |
| Streaming terminal | ✅ | ✅ | ❌ |
| Token usage display | ✅ | ✅ | ❌ |
| Progress timeline | ✅ | ✅ | ❌ (basic bar only) |
| Elapsed timer in header | ✅ | ✅ | ❌ (in progress card only) |
| 3-column responsive layout | ✅ | ✅ | ❌ (single column) |
| Streaming modal | ✅ | ✅ | ❌ |

### Page Layout Comparison

**Saturn Layout (3-column)**:
- LEFT (4 cols): Status monitoring, work table, puzzle grids
- CENTER (5 cols): Token metrics, streaming reasoning/output, final results
- RIGHT (3 cols): Image gallery

**Grover Layout (3-column)**:
- LEFT (7-8 cols): Iteration cards with full details
- CENTER (3 cols): Live activity stream
- RIGHT (2-3 cols): Search visualization

**Poetiq Layout (single column)**:
- Just stacked cards: Header → BYO Key Card → Progress Card → ARC2-Eval Card → Info Card

### Bug Pattern Analysis from CHANGELOG

The CHANGELOG shows 5 consecutive bug fix versions (5.23.0 → 5.27.4):

1. **v5.26.1**: WebSocket connection rejected (wasn't in whitelist)
2. **v5.26.0**: Wrong API parameter, wrong response structure, TypeScript errors
3. **v5.27.2**: Wrong puzzle count (114 vs 120), incorrect status (all "attempted")
4. **v5.27.3**: "Run Solver" button just navigated instead of starting solver
5. **v5.27.4**: Railway deployment failures due to missing submodule handling

These bugs indicate rushed implementation without proper testing against the established patterns.

---

## Improvement Plan

### Phase 1: Server-Side Foundation (Priority: HIGH)

#### 1.1 Create PoetiqStreamService
Location: `server/services/streaming/poetiqStreamService.ts`

Features to match Saturn/Grover:
- SSE streaming with `sseStreamManager`
- Abort signal handling
- Proper phase broadcasting
- Session context logging

#### 1.2 Add SSE Streaming Endpoint
Add to `poetiqController.ts`:
```typescript
async streamSolve(req: Request, res: Response) {
  // Match pattern from saturnController.streamAnalyze
  // and groverController.streamAnalyze
}
```

#### 1.3 Use Session Context for Logging
```typescript
import { setSessionContext } from '../utils/broadcastLogger.js';

setSessionContext(sessionId, async () => {
  // All console.log calls will broadcast to browser
});
```

### Phase 2: Client Component Library (Priority: HIGH)

#### 2.1 Create PoetiqModelSelect Component
Location: `client/src/components/poetiq/PoetiqModelSelect.tsx`

Features:
- Dropdown with model icons
- Provider grouping (OpenRouter recommended, Direct API)
- Speed/cost indicators
- Disabled state during solving

#### 2.2 Create PoetiqIterationCard Component  
Location: `client/src/components/poetiq/PoetiqIterationCard.tsx`

Features:
- Iteration number with active/complete state
- Phase indicator
- Generated code preview (collapsible)
- Train/test scores
- Best program highlight

#### 2.3 Create PoetiqLiveStream Component
Location: `client/src/components/poetiq/PoetiqLiveStream.tsx`

Features:
- Real-time log output
- Auto-scroll
- Log level filtering (info, warn, error)
- Timestamp display

#### 2.4 Create PoetiqStreamingModal Component
Location: `client/src/components/poetiq/PoetiqStreamingModal.tsx`

Features:
- Full-screen modal for detailed streaming view
- Split view: reasoning + output
- Code syntax highlighting

### Phase 3: Enhanced UI Layout (Priority: MEDIUM)

#### 3.1 Redesign PoetiqSolver.tsx
Transform from single-column to 3-column layout:

```
┌──────────────┬────────────────────┬──────────────┐
│ LEFT (4 col) │ CENTER (5 col)     │ RIGHT (3 col)│
├──────────────┼────────────────────┼──────────────┤
│ Model Select │ Iteration Cards    │ Puzzle Grids │
│ BYO Key      │ (expandable)       │              │
│ Controls     │                    │ Current Code │
│ Timer        │                    │              │
│ Start/Cancel │                    │ Train Scores │
└──────────────┴────────────────────┴──────────────┘
```

#### 3.2 Add Advanced Controls Panel
Collapsible panel (like Grover) with:
- Temperature slider
- Max iterations
- Number of experts (already exists, move here)
- Model-specific reasoning controls

#### 3.3 Real-Time Code Preview
Show generated code AS IT'S BEING WRITTEN, not just after completion:
- Syntax highlighting with Prism or highlight.js
- Line numbers
- Copy button

#### 3.4 Token Usage Dashboard
Match Saturn's token display:
- Input tokens
- Output tokens  
- Total tokens
- Estimated cost

### Phase 4: Polish & Parity (Priority: LOW)

#### 4.1 Add Phase Timeline
Visual timeline showing: Initializing → Generating Code → Testing → Refining → Complete

#### 4.2 Add Search/Best Program Visualization
Like Grover's SearchVisualization - show convergence toward solution

#### 4.3 Persistent Batch Sessions
Move from in-memory Map to database table

#### 4.4 Community Page Improvements
- Real-time leaderboard
- Contributor attribution
- Puzzle difficulty indicators

---

## Implementation Order

1. **Week 1**: Phase 1 (Server foundation) + Phase 2.1-2.2 (Model select + Iteration card)
2. **Week 2**: Phase 2.3-2.4 (Live stream + Modal) + Phase 3.1 (Layout redesign)
3. **Week 3**: Phase 3.2-3.4 (Controls, code preview, tokens) + Phase 4 (Polish)

## Success Criteria

- [ ] Poetiq has dedicated streaming service matching Saturn/Grover pattern
- [ ] Poetiq has SSE endpoint for real-time streaming
- [ ] Poetiq UI shows iteration progress with expandable cards
- [ ] Poetiq shows generated code in real-time during solving
- [ ] Poetiq has 3-column responsive layout
- [ ] Poetiq has model selector component matching Grover's
- [ ] Poetiq has advanced controls panel (collapsible)
- [ ] Poetiq shows token usage and estimated cost
- [ ] No more "it just navigates away" type UX bugs

## Files to Create

### Server
1. `server/services/streaming/poetiqStreamService.ts`

### Client Components
1. `client/src/components/poetiq/PoetiqModelSelect.tsx`
2. `client/src/components/poetiq/PoetiqIterationCard.tsx`
3. `client/src/components/poetiq/PoetiqLiveStream.tsx`
4. `client/src/components/poetiq/PoetiqStreamingModal.tsx`
5. `client/src/components/poetiq/PoetiqCodePreview.tsx`
6. `client/src/components/poetiq/PoetiqTokenMetrics.tsx`
7. `client/src/components/poetiq/PoetiqControlPanel.tsx`

### Files to Modify
1. `server/controllers/poetiqController.ts` - Add streaming endpoint
2. `server/services/poetiq/poetiqService.ts` - Add streaming support
3. `client/src/pages/PoetiqSolver.tsx` - Complete redesign
4. `client/src/pages/PoetiqCommunity.tsx` - Enhance with better UX
5. `client/src/hooks/usePoetiqProgress.ts` - Add SSE support

---

## References

### Saturn Implementation (Model to Follow)
- Controller: `server/controllers/saturnController.ts`
- Streaming: `server/services/streaming/saturnStreamService.ts`
- UI Page: `client/src/pages/SaturnVisualSolver.tsx`
- Components: `client/src/components/saturn/`

### Grover Implementation (Model to Follow)
- Controller: `server/controllers/groverController.ts`
- Streaming: `server/services/streaming/groverStreamService.ts`
- UI Page: `client/src/pages/GroverSolver.tsx`
- Components: `client/src/components/grover/`

### Key Patterns to Adopt

1. **Immediate broadcast on start**:
```typescript
broadcast(sessionId, {
  status: 'running',
  phase: 'initializing',
  iteration: 0,
  totalIterations: options.maxIterations,
  message: 'Starting...',
});
```

2. **Session context for logging**:
```typescript
setSessionContext(sessionId, async () => {
  // All work here
});
```

3. **SSE registration pattern**:
```typescript
sseStreamManager.register(sessionId, res);
sseStreamManager.sendEvent(sessionId, 'stream.init', { ... });
```

4. **Abort handling**:
```typescript
const abortController = new AbortController();
res.on('close', () => abortController.abort());
```
