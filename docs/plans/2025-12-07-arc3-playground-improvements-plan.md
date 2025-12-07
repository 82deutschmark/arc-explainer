# ARC-AGI-3 Playground Improvements Plan
**Date:** 2025-12-07
**Author:** Claude Code using Opus 4.5
**Goal:** Fix double-click bug, enrich agent context, and decompose monolithic playground page

**Status:** Phase 2 Complete ✓ | Phase 1 & 3 Pending

---

## Completion Status

### ✅ Phase 2: Enrich Agent Context (COMPLETE)

**Completed Steps:**
- ✅ Step 2.1: Created `server/services/arc3/helpers/colorAnalysis.ts`
  - `calculateColorDistribution()` - calculates color histogram for 2D grids
  - `summarizeColorDistribution()` - generates human-readable summary
  - Uses Arc3 16-color palette (0-15)

- ✅ Step 2.2: Enhanced `server/services/arc3/helpers/frameAnalysis.ts`
  - Added `FrameChanges` interface
  - Added `analyzeFrameChanges()` - compares frames and returns structured diff
  - Returns pixelsChanged, changedCells sample, regions, and human-readable summary

- ✅ Step 2.3: Updated `server/services/arc3/Arc3RealGameRunner.ts`
  - Modified `inspect_game_state` tool (both streaming and non-streaming versions)
  - Added imports: `analyzeFrameChanges`, `calculateColorDistribution`
  - Tool now returns: `frameImage`, `colorDistribution`, `changes`
  - Updated tool description to inform agent about new fields
  - Enhanced logging to show color count and pixel changes

**Agent Now Receives:**
```typescript
{
  frameImage: "data:image/png;base64,...",  // Visual representation
  colorDistribution: [                       // Which colors exist
    { value: 0, name: "White", count: 3892, percentage: 95.2 },
    { value: 8, name: "Red", count: 12, percentage: 0.3 }
  ],
  changes: {                                  // What changed since last action
    pixelsChanged: 47,
    changedCells: [{x: 5, y: 3, from: 0, to: 8}, ...],
    regions: [{top: 10, left: 15, width: 8, height: 6}],
    summary: "47 cells changed in 8×6 region at (15,10), 98% of region"
  }
}
```

### 🔲 Phase 1: Fix Action Button Double-Click Issue (PENDING)

### 🔲 Phase 3: Decompose ARC3AgentPlayground Page (PENDING)

---

## Phase 1: Fix Action Button Double-Click Issue

### Problem
- Action buttons in `ARC3AgentPlayground.tsx` (parent component)
- Grid in `Arc3GridVisualization.tsx` (child component)
- State updates cause render lag → requires double-clicks to execute actions
- Dynamic `key` prop on grid forces remount at wrong times

### Solution
Create `Arc3GamePanel.tsx` that tightly couples grid + action buttons in single render cycle.

### Files to Create
- `client/src/components/arc3/Arc3GamePanel.tsx` - New wrapper component

### Files to Modify
- `client/src/pages/ARC3AgentPlayground.tsx` - Replace grid+buttons with `<Arc3GamePanel />`
- `client/src/components/arc3/Arc3GridVisualization.tsx` - Remove unused props if needed

### Implementation Steps

#### Step 1.1: Create Arc3GamePanel Component
```typescript
// client/src/components/arc3/Arc3GamePanel.tsx
interface Arc3GamePanelProps {
  currentFrame: FrameData | null;
  frames: FrameData[];
  executeManualAction: (action: string, coords?: [number, number]) => Promise<void>;
  isPendingManualAction: boolean;
  // ... other props
}
```

Component contains:
- Action buttons (moved from playground)
- Arc3GridVisualization
- Layer/timestep navigation
- Frame navigation
- Color distribution display

#### Step 1.2: Move Action Button Logic
Move from `ARC3AgentPlayground.tsx` lines 685-742:
- Button rendering
- `handleActionClick` logic
- ACTION6 coordinate picker modal
- Available actions checking

#### Step 1.3: Update Parent Component
Replace grid section in `ARC3AgentPlayground.tsx` (lines 685-830) with:
```tsx
<Arc3GamePanel
  currentFrame={currentFrame}
  frames={state.frames}
  executeManualAction={executeManualAction}
  isPendingManualAction={isPendingManualAction}
  // ... pass other props
/>
```

---

## Phase 2: Enrich Agent Context

### Goal
Add color distribution and change detection to `inspect_game_state` tool response.

### Files to Create
- `server/services/arc3/helpers/colorAnalysis.ts` - Server-side color distribution calculator

### Files to Modify
- `server/services/arc3/Arc3RealGameRunner.ts` - Add colorDistribution and changes to tool response
- `server/services/arc3/helpers/frameAnalysis.ts` - Export change detection utilities

### Implementation Steps

#### Step 2.1: Create Server-Side Color Distribution Helper
```typescript
// server/services/arc3/helpers/colorAnalysis.ts
import { getArc3ColorName, ARC3_COLOR_NAMES } from '@shared/config/arc3Colors';

export interface ColorDistribution {
  value: number;
  name: string;
  count: number;
  percentage: number;
}

export function calculateColorDistribution(grid: number[][]): ColorDistribution[] {
  // Count occurrences, calculate percentages
  // Return sorted by value (0-15)
}
```

#### Step 2.2: Add Change Detection Helper
```typescript
// server/services/arc3/helpers/frameAnalysis.ts
export interface FrameChanges {
  pixelsChanged: number;
  changedCells: Array<{x: number, y: number, from: number, to: number}>;
  summary: string;
}

export function analyzeFrameChanges(
  prevFrame: FrameData | null,
  currentFrame: FrameData
): FrameChanges | null {
  // Compare frames, return changes
}
```

#### Step 2.3: Update inspect_game_state Tool
In `Arc3RealGameRunner.ts`, modify tool execute function:
```typescript
// Calculate color distribution
const grid2D = currentFrame.frame[currentFrame.frame.length - 1];
const colorDistribution = calculateColorDistribution(grid2D);

// Analyze changes (if prevFrame exists)
const changes = prevFrame ? analyzeFrameChanges(prevFrame, currentFrame) : null;

const result = {
  // ... existing fields
  frameImage,
  colorDistribution,  // NEW
  changes,            // NEW
};
```

#### Step 2.4: Update Tool Description
Update `description` to tell agent about new fields:
```
'Inspect the current game state including visual image, color distribution,
 change analysis, score, and game status. The colorDistribution shows which
 colors exist and their counts. The changes object shows what pixels changed
 since the last action.'
```

---

## Phase 3: Decompose ARC3AgentPlayground Page

### Problem
- 964-line monolithic file (massive SRP violation)
- Incorrect color mapping (uses 10 colors instead of 16)
- Missing base64 mini-preview for "agent's view"

### Solution
Break into focused components following SRP.

### Files to Create
- `client/src/components/arc3/Arc3ConfigurationPanel.tsx` - Model/game selection, config options
- `client/src/components/arc3/Arc3AgentControls.tsx` - Start/stop/continue buttons
- `client/src/components/arc3/Arc3ReasoningViewer.tsx` - Reasoning stream display
- `client/src/components/arc3/Arc3ToolTimeline.tsx` - Tool call history
- `client/src/components/arc3/Arc3AgentVisionPreview.tsx` - Mini base64 image preview

### Files to Modify
- `client/src/pages/ARC3AgentPlayground.tsx` - Slim down to composition layer
- `client/src/utils/arc3Colors.ts` - Verify 16-color support (already correct)

### Implementation Steps

#### Step 3.1: Create Arc3ConfigurationPanel
Extract lines 235-470 (game selector, model dropdown, reasoning effort, prompts):
```typescript
interface Arc3ConfigurationPanelProps {
  gameId: string;
  onGameChange: (gameId: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  // ... other config props
}
```

#### Step 3.2: Create Arc3AgentControls
Extract agent start/stop/continue buttons and status:
```typescript
interface Arc3AgentControlsProps {
  isPlaying: boolean;
  canContinue: boolean;
  onStart: () => void;
  onCancel: () => void;
  onContinue: () => void;
  status: string;
}
```

#### Step 3.3: Create Arc3ReasoningViewer
Extract reasoning stream display (lines 501-638):
```typescript
interface Arc3ReasoningViewerProps {
  reasoning: string;
  isStreaming: boolean;
  streamingMessage: string | null;
}
```

#### Step 3.4: Create Arc3ToolTimeline
Extract tool call history (lines 472-500):
```typescript
interface Arc3ToolTimelineProps {
  toolEntries: ToolEntry[];
  onClearHistory: () => void;
}
```

#### Step 3.5: Create Arc3AgentVisionPreview
NEW component showing base64 image agent sees:
```typescript
interface Arc3AgentVisionPreviewProps {
  frameImage: string | null;  // Base64 data URL
  width?: number;
  height?: number;
}

// Renders:
// - Small thumbnail (128x128 or 256x256)
// - Label "Agent's View"
// - Shows what vision model receives
```

Extract from SSE stream events → grab `frameImage` from `agent.tool_result` events.

#### Step 3.6: Fix Color Mapping Issues
Audit `ARC3AgentPlayground.tsx` for any hardcoded color references:
- Ensure all use `ARC3_COLORS` (16 colors, 0-15)
- Remove any references to classic ARC colors (10 colors, 0-9)
- Check prompt templates, tooltips, help text

#### Step 3.7: Compose New Page Structure
```tsx
// client/src/pages/ARC3AgentPlayground.tsx (slimmed down)
export function ARC3AgentPlayground() {
  // State management only
  const { state, start, cancel, continueWithMessage, ... } = useArc3AgentStream();

  return (
    <div className="three-column-layout">
      {/* Left Column: Configuration */}
      <Arc3ConfigurationPanel ... />
      <Arc3AgentControls ... />
      <Arc3ToolTimeline ... />

      {/* Middle Column: Game */}
      <Arc3GamePanel ... />
      <Arc3AgentVisionPreview frameImage={extractedFrameImage} />

      {/* Right Column: Reasoning */}
      <Arc3ReasoningViewer ... />
    </div>
  );
}
```

---

## Dependencies Between Phases

- **Phase 1 → Phase 2**: Independent (can work in parallel)
- **Phase 2 → Phase 3**: Vision preview (Phase 3) depends on frameImage (Phase 2 already done)
- **Phase 1 → Phase 3**: Arc3GamePanel (Phase 1) becomes a component in Phase 3

## Recommended Implementation Order

1. **Phase 2 first** - Enrich agent context (backend changes, low risk)
2. **Phase 1 second** - Fix double-click bug (impacts UX immediately)
3. **Phase 3 last** - Decompose page (largest refactor, builds on Phase 1)

---

## Testing Checklist

### Phase 1
- [ ] Single-click actions work without delay
- [ ] ACTION6 coordinate picker still functional
- [ ] Frame navigation doesn't break
- [ ] Layer animation still works

### Phase 2
- [ ] Agent receives colorDistribution in tool response
- [ ] Agent receives changes object after actions
- [ ] Color distribution counts accurate (spot-check)
- [ ] Changes summary describes correct pixels

### Phase 3
- [ ] All configuration options still work
- [ ] Game selection updates URL correctly
- [ ] Reasoning stream displays properly
- [ ] Vision preview shows correct base64 image
- [ ] No hardcoded 10-color references remain
- [ ] Page loads without errors

---

## Backward Compatibility

- All SSE event formats remain unchanged
- Hook API (`useArc3AgentStream`) unchanged
- Database schema unaffected
- API endpoints unaffected

## File Summary

### Created (8 files)
1. `client/src/components/arc3/Arc3GamePanel.tsx`
2. `server/services/arc3/helpers/colorAnalysis.ts`
3. `client/src/components/arc3/Arc3ConfigurationPanel.tsx`
4. `client/src/components/arc3/Arc3AgentControls.tsx`
5. `client/src/components/arc3/Arc3ReasoningViewer.tsx`
6. `client/src/components/arc3/Arc3ToolTimeline.tsx`
7. `client/src/components/arc3/Arc3AgentVisionPreview.tsx`
8. `docs/plans/2025-12-07-arc3-playground-improvements-plan.md` (this file)

### Modified (4 files)
1. `client/src/pages/ARC3AgentPlayground.tsx` - Decompose into components
2. `server/services/arc3/Arc3RealGameRunner.ts` - Add colorDistribution + changes
3. `server/services/arc3/helpers/frameAnalysis.ts` - Export change helpers
4. `CHANGELOG.md` - Document changes
