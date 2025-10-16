# Saturn Visual Solver - Complete Rebuild Plan
**Date**: 2025-10-13
**Author**: Sonnet 4.5
**Status**: Planning Phase

## 🎯 MISSION: Build Brand New Saturn Solver from Scratch

**Context**: The old SaturnVisualSolver.tsx has been deleted. It was a 680-line monolithic file mixing shadcn/ui with DaisyUI, violating project standards. We're building a completely new implementation following best practices from GroverSolver.tsx.

**Critical Goals**:
1. ✅ **DaisyUI Exclusively** - No shadcn components whatsoever
2. ✅ **Modular Components** - Extract reusable pieces following SRP
3. ✅ **Fix Image Rendering** - Saturn images stream correctly but don't display
4. ✅ **SSE Streaming Integration** - Real-time reasoning display
5. ✅ **Visual Consistency** - Match GroverSolver's clean, compact style
6. ✅ **Accessibility & UX** - ARIA labels, keyboard nav, loading states

---

## 📊 Architecture Analysis

### Current State: useSaturnProgress Hook (WORKING)
The hook provides rich state including:
- ✅ `state.status` - 'idle' | 'running' | 'completed' | 'error'
- ✅ `state.phase` - Current phase name
- ✅ `state.step` / `state.totalSteps` - Progress tracking
- ✅ `state.progress` - 0-1 percentage
- ✅ `state.message` - Current status message
- ✅ `state.galleryImages` - Array of `{ path: string; base64: string }[]`
- ✅ `state.logLines` - Array of log strings
- ✅ `state.reasoningHistory` - Array of reasoning strings
- ✅ `state.streamingText` - Live accumulated text
- ✅ `state.streamingReasoning` - Live accumulated reasoning
- ✅ `state.streamingTokenUsage` - Token counts
- ✅ `state.result` - Final analysis result

**SSE Event Handling**:
- `stream.init` - Sets sessionId, logs initialization (lines 202-231)
- `stream.status` - Updates phase, adds images to gallery (lines 233-284)
- `stream.chunk` - Accumulates text/reasoning deltas (lines 286-322)
- `stream.complete` - Finalizes with result (lines 324-348)
- `stream.error` - Handles errors gracefully (lines 350-373)

**Image Handling Logic** (lines 253-265):
```typescript
// Add any new images to gallery
let nextGallery = prev.galleryImages ?? [];
const incoming = Array.isArray(status.images) ? status.images : [];
if (incoming.length > 0) {
  const seen = new Set(nextGallery.map((i) => i.path));
  for (const im of incoming) {
    if (im?.path && !seen.has(im.path)) {
      nextGallery = [...nextGallery, im];
      seen.add(im.path);
      nextLogs.push(`📸 Generated image: ${im.path}`);
    }
  }
}
```

### Reference Implementation: GroverSolver.tsx (GOLD STANDARD)
**Visual Hierarchy** (398 lines total):
- **Compact Header** - Back button + title + model select + Start button (lines 119-167)
- **Collapsible Advanced Controls** - Temperature + reasoning params (lines 169-266)
- **Visual Status Panel** - Animated spinner + progress bar when running (lines 268-323)
- **Compact Status Bar** - Badge display when idle/done (lines 325-339)
- **Three-Column Layout** - 50% iterations | 25% logs | 25% visualizations (lines 341-394)

**DaisyUI Components Used**:
- `btn btn-outline btn-sm` - Navigation buttons
- `btn btn-primary btn-lg` - Gradient action buttons with shadow
- `alert alert-error` - Error states
- `card bg-base-100 shadow` - Content containers
- `card-body` - Card content wrapper
- `badge badge-outline` - Status indicators
- `select select-bordered` - Dropdown controls
- `range range-xs` - Slider controls
- `bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300` - Visual panels

**Layout Pattern**:
```jsx
<div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
  <div className="lg:col-span-6">  {/* 50% - Main content */}</div>
  <div className="lg:col-span-3">  {/* 25% - Logs */}</div>
  <div className="lg:col-span-3">  {/* 25% - Viz */}</div>
</div>
```

---

## 🏗️ NEW ARCHITECTURE: Component Breakdown

### 1. Main Page: SaturnVisualSolver.tsx (~200 lines)
**File**: `client/src/pages/SaturnVisualSolver.tsx`

**Responsibilities** (SRP):
- Orchestrate layout and component composition
- Manage model selection and settings state
- Handle start/cancel actions
- Delegate to useSaturnProgress hook
- Route to extracted components

**Structure**:
```jsx
<div className="container mx-auto p-3 max-w-6xl">
  {/* Header - Back button + Title + Model Select + Start/Cancel */}
  <SaturnHeader />

  {/* Advanced Settings - Collapsible */}
  <SaturnAdvancedSettings />

  {/* Visual Status Panel - Only when running */}
  {isRunning && <SaturnRunningStatus state={state} />}

  {/* Compact Status Bar - When idle/done */}
  {!isRunning && <SaturnCompactStatus state={state} />}

  {/* Three-Column Layout */}
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
    {/* LEFT: Phase Cards + Image Gallery */}
    <div className="lg:col-span-6 space-y-3">
      <SaturnPhaseProgress state={state} />
      <SaturnImageGallery images={state.galleryImages} />
    </div>

    {/* MIDDLE: Terminal Logs */}
    <div className="lg:col-span-3">
      <SaturnLogViewer logs={state.logLines} />
    </div>

    {/* RIGHT: Reasoning Stream + Results */}
    <div className="lg:col-span-3 space-y-3">
      <SaturnReasoningPanel state={state} />
      {isDone && <SaturnResultsCard result={state.result} />}
    </div>
  </div>

  {/* Attribution Footer */}
  <SaturnAttribution />
</div>
```

### 2. SaturnImageGallery.tsx (~80 lines) - CRITICAL FIX
**File**: `client/src/components/saturn/SaturnImageGallery.tsx`

**Why Important**: This is where images fail to render. Old version used shadcn Card.

**Requirements**:
- ✅ Use DaisyUI `card` exclusively
- ✅ Display images as `data:image/png;base64,${base64}`
- ✅ Skeleton loaders for loading state
- ✅ Error boundaries for failed loads
- ✅ Responsive grid (2/3/4 columns)
- ✅ Image path labels
- ✅ Empty state when no images

**DaisyUI Pattern**:
```jsx
<div className="card bg-base-100 shadow">
  <div className="card-body">
    <h2 className="card-title">Generated Images ({images.length})</h2>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((img, idx) => (
        <div key={idx} className="card bg-base-200 shadow-sm">
          <figure className="px-2 pt-2">
            <img
              src={`data:image/png;base64,${img.base64}`}
              alt={img.path}
              className="rounded-lg w-full h-auto"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.src = '/fallback-image.png';
              }}
            />
          </figure>
          <div className="card-body p-2">
            <p className="text-xs text-gray-500 truncate">{img.path}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
</div>
```

**Skeleton Loader Pattern**:
```jsx
{images.length === 0 && isRunning && (
  <div className="animate-pulse">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-gray-300 rounded-lg h-32"></div>
      ))}
    </div>
  </div>
)}
```

### 3. SaturnLogViewer.tsx (~100 lines)
**File**: `client/src/components/saturn/SaturnLogViewer.tsx`

**Responsibilities**:
- Display terminal-style log output
- Auto-scroll to bottom
- Syntax highlighting for log levels (ERROR, WARN, INFO, SUCCESS, SATURN)
- Timestamps for each line
- Copy-to-clipboard functionality

**DaisyUI Pattern**:
```jsx
<div className="card bg-base-100 shadow h-[600px]">
  <div className="card-body p-3">
    <h2 className="card-title text-sm">
      <Terminal className="h-4 w-4" />
      Live Output
      <div className="badge badge-outline ml-2">{logs.length} lines</div>
    </h2>
    <div
      ref={logRef}
      className="bg-gray-900 text-green-400 font-mono text-xs rounded-lg p-3 flex-1 overflow-auto space-y-1"
    >
      {logs.map((line, i) => {
        const { timestamp, level, message } = parseLogLine(line, i);
        return (
          <div key={i} className="flex items-start gap-2">
            <span className="text-gray-500">{timestamp}</span>
            <span className={levelBadgeClass(level)}>{level}</span>
            <span className="flex-1">{message}</span>
          </div>
        );
      })}
    </div>
  </div>
</div>
```

**Log Level Parsing** (extract from old file logic, lines 263-332):
```typescript
function parseLogLine(line: string, index: number) {
  // Detect ERROR, WARN, INFO, SUCCESS, SATURN keywords
  // Extract timestamp, level, and clean message
  // Return { timestamp, level, message, levelClassName }
}
```

### 4. SaturnPhaseProgress.tsx (~120 lines)
**File**: `client/src/components/saturn/SaturnPhaseProgress.tsx`

**Responsibilities**:
- Display current phase with icon and description
- Show step progress (Step 3/8)
- Progress bar visualization
- Phase-specific explanations
- Timing information

**DaisyUI Pattern**:
```jsx
<div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 shadow">
  <div className="card-body p-4">
    <div className="flex items-start gap-4">
      {/* Phase Icon */}
      <div className="flex-shrink-0">
        <PhaseIcon phase={state.phase} />
      </div>

      {/* Phase Info */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-purple-900">
            {getPhaseTitle(state.phase)}
          </h3>
          <div className="flex items-center gap-2">
            <div className="badge badge-outline">
              Step {state.step}/{state.totalSteps}
            </div>
            <div className="badge bg-purple-600">
              {Math.round(state.progress * 100)}%
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-700 mb-2">
          {getPhaseDescription(state.phase)}
        </p>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${state.progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  </div>
</div>
```

**Phase Mapping** (extract from old file, lines 154-227):
```typescript
function getPhaseInfo(phase: string) {
  // Map phase names to { title, description, icon }
  // init, analyzing, reasoning, generating, validating, etc.
}
```

### 5. SaturnAdvancedSettings.tsx (~100 lines)
**File**: `client/src/components/saturn/SaturnAdvancedSettings.tsx`

**Responsibilities**:
- Collapsible settings panel
- Temperature slider
- GPT-5 reasoning controls (effort, verbosity, summary)
- Model-specific parameter visibility

**DaisyUI Pattern** (reuse GroverSolver's CollapsibleCard):
```jsx
<CollapsibleCard
  title="Advanced Settings"
  icon={Settings}
  defaultOpen={false}
>
  <div className="space-y-4">
    {/* Temperature Slider */}
    {supportsTemperature && (
      <div className="p-2 bg-gray-50 border rounded">
        <label className="label text-sm font-medium">
          Temperature: {temperature}
        </label>
        <input
          type="range"
          className="range range-xs w-full"
          min="0"
          max="2"
          step="0.05"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
        />
      </div>
    )}

    {/* GPT-5 Reasoning Controls */}
    {isGPT5Model && (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <h5 className="text-sm font-semibold text-blue-800 mb-3">
          GPT-5 Reasoning Parameters
        </h5>
        <div className="grid grid-cols-3 gap-3">
          {/* Effort, Verbosity, Summary selects */}
        </div>
      </div>
    )}
  </div>
</CollapsibleCard>
```

### 6. SaturnReasoningPanel.tsx (~80 lines)
**File**: `client/src/components/saturn/SaturnReasoningPanel.tsx`

**Responsibilities**:
- Display live streaming reasoning
- Show token usage stats
- Reasoning history accordion

**DaisyUI Pattern**:
```jsx
<div className="card bg-base-100 shadow">
  <div className="card-body p-3">
    <h2 className="card-title text-sm">
      <Brain className="h-4 w-4" />
      AI Reasoning
    </h2>

    {state.streamingReasoning && (
      <div className="bg-blue-50 rounded-lg p-3 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="h-3 w-3 animate-spin text-blue-600" />
          <span className="text-xs font-medium text-blue-700">Thinking...</span>
        </div>
        <div className="text-gray-700 whitespace-pre-wrap">
          {state.streamingReasoning}
        </div>
      </div>
    )}

    {state.streamingTokenUsage && (
      <div className="stats shadow text-xs">
        <div className="stat p-2">
          <div className="stat-title text-xs">Input</div>
          <div className="stat-value text-sm">{state.streamingTokenUsage.input}</div>
        </div>
        <div className="stat p-2">
          <div className="stat-title text-xs">Output</div>
          <div className="stat-value text-sm">{state.streamingTokenUsage.output}</div>
        </div>
        <div className="stat p-2">
          <div className="stat-title text-xs">Reasoning</div>
          <div className="stat-value text-sm">{state.streamingTokenUsage.reasoning}</div>
        </div>
      </div>
    )}
  </div>
</div>
```

### 7. Supporting Components (~50 lines each)

**SaturnRunningStatus.tsx**:
- Animated spinner with current iteration count
- Phase indicator
- Timing info

**SaturnCompactStatus.tsx**:
- Badge showing status (idle/completed/error)
- Best score display

**SaturnResultsCard.tsx**:
- JSON display of final results
- Copy button

**SaturnAttribution.tsx**:
- Link to Saturn ARC project by Zoe Carver

---

## 🔧 Implementation Plan

### Phase 1: Core Page Structure (30 mins)
**Files to Create**:
1. `client/src/pages/SaturnVisualSolver.tsx` - Main orchestrator (~200 lines)
2. `client/src/components/saturn/SaturnHeader.tsx` - Header with nav/title/buttons (~60 lines)

**Acceptance Criteria**:
- ✅ Page renders with DaisyUI layout
- ✅ Model selection dropdown works
- ✅ Start button triggers useSaturnProgress hook
- ✅ Cancel button works
- ✅ Back navigation functional

### Phase 2: Image Gallery Fix (CRITICAL) (20 mins)
**Files to Create**:
1. `client/src/components/saturn/SaturnImageGallery.tsx` - DaisyUI image grid (~80 lines)

**Acceptance Criteria**:
- ✅ Images render with `data:image/png;base64,${base64}` format
- ✅ Responsive grid (2/3/4 columns)
- ✅ Empty state when no images
- ✅ Skeleton loaders during loading
- ✅ Error boundaries for failed loads

**Debug Steps**:
1. Console log `state.galleryImages` to verify data structure
2. Check if `base64` field exists and is valid
3. Verify img src format is correct
4. Test with sample base64 image string

### Phase 3: Log Viewer (25 mins)
**Files to Create**:
1. `client/src/components/saturn/SaturnLogViewer.tsx` - Terminal-style logs (~100 lines)
2. `client/src/utils/logParser.ts` - Log level parsing utility (~50 lines)

**Acceptance Criteria**:
- ✅ Auto-scroll to bottom
- ✅ Color-coded log levels (ERROR red, WARN yellow, SUCCESS green, SATURN purple)
- ✅ Timestamps for each line
- ✅ Monospace font with dark theme

### Phase 4: Phase Progress Display (25 mins)
**Files to Create**:
1. `client/src/components/saturn/SaturnPhaseProgress.tsx` - Phase cards (~120 lines)
2. `client/src/utils/saturnPhases.ts` - Phase metadata (~80 lines)

**Acceptance Criteria**:
- ✅ Visual progress bar
- ✅ Step counter (3/8)
- ✅ Phase-specific icons and descriptions
- ✅ Timing estimates

### Phase 5: Advanced Settings (20 mins)
**Files to Create**:
1. `client/src/components/saturn/SaturnAdvancedSettings.tsx` - Collapsible settings (~100 lines)

**Acceptance Criteria**:
- ✅ Reuse existing CollapsibleCard component
- ✅ Temperature slider (0-2)
- ✅ GPT-5 reasoning controls (effort, verbosity, summary)
- ✅ Model-specific parameter visibility

### Phase 6: Reasoning Panel (20 mins)
**Files to Create**:
1. `client/src/components/saturn/SaturnReasoningPanel.tsx` - Live reasoning display (~80 lines)

**Acceptance Criteria**:
- ✅ Live streaming reasoning text
- ✅ Token usage stats (input/output/reasoning)
- ✅ Reasoning history accordion

### Phase 7: Supporting Components (20 mins)
**Files to Create**:
1. `client/src/components/saturn/SaturnRunningStatus.tsx` (~50 lines)
2. `client/src/components/saturn/SaturnCompactStatus.tsx` (~40 lines)
3. `client/src/components/saturn/SaturnResultsCard.tsx` (~50 lines)
4. `client/src/components/saturn/SaturnAttribution.tsx` (~30 lines)

### Phase 8: Testing & Polish (30 mins)
**Tasks**:
1. Test with real Saturn analysis on taskId
2. Verify image rendering works
3. Check log streaming updates in real-time
4. Verify reasoning display
5. Test all advanced settings
6. Responsive layout testing (mobile, tablet, desktop)
7. Accessibility audit (keyboard nav, ARIA labels)

---

## 🎨 Visual Design Principles

### Color Palette (Match GroverSolver)
- **Primary Actions**: `bg-gradient-to-r from-blue-600 to-purple-600`
- **Running Status**: `bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300`
- **Success States**: `bg-green-600`
- **Error States**: `bg-red-600`
- **Warning States**: `bg-orange-500`
- **Terminal Background**: `bg-gray-900 text-green-400`

### Spacing & Layout
- **Container**: `p-3 max-w-6xl`
- **Card Spacing**: `space-y-3`
- **Grid Gap**: `gap-3`
- **Compact Padding**: `p-3` or `p-4` (not p-6)

### Typography
- **Page Title**: `text-lg font-bold`
- **Card Title**: `card-title text-sm`
- **Body Text**: `text-sm`
- **Badges**: `badge badge-outline text-xs`

### Responsive Breakpoints
- **Mobile**: `grid-cols-1` (stacked)
- **Desktop**: `lg:grid-cols-12` (three columns)
- **Layout**: 50% | 25% | 25% (main | logs | viz)

---

## 🐛 Image Rendering Debug Strategy

### Hypothesis: Why Images Don't Render
1. **SSE Event Handling** - Images may not populate `galleryImages` state correctly
   - ✅ VERIFIED: useSaturnProgress lines 253-265 handle image accumulation
   - ✅ VERIFIED: Images logged with `📸 Generated image: ${path}` (line 262)

2. **Base64 Encoding Issue**
   - Backend may send malformed base64
   - Base64 string may be missing or empty

3. **Component Rendering Issue**
   - Old SaturnImageGallery used shadcn Card (incompatible with DaisyUI)
   - Component may filter out images incorrectly
   - Image src format may be wrong

4. **React State Update Issue**
   - Images may be added to state but not triggering re-render
   - Gallery component may not receive updated props

### Debug Steps
1. **Add Console Logging**:
   ```typescript
   // In useSaturnProgress.ts line 260
   console.log('[Saturn] Adding image to gallery:', im.path, 'base64 length:', im.base64?.length);

   // In SaturnImageGallery.tsx
   console.log('[Gallery] Rendering images:', images.length);
   images.forEach(img => console.log('  -', img.path, 'base64:', img.base64?.substring(0, 50)));
   ```

2. **Test with Sample Image**:
   ```typescript
   const SAMPLE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
   ```

3. **Verify Image Format**:
   - Check if backend sends `{ path, base64 }` or different structure
   - Verify base64 string doesn't include `data:image/png;base64,` prefix

4. **Error Boundary**:
   ```jsx
   <img
     src={`data:image/png;base64,${img.base64}`}
     onError={(e) => {
       console.error('[Gallery] Image load failed:', img.path);
       e.currentTarget.style.border = '2px solid red';
     }}
   />
   ```

---

## 📋 File Checklist

### Components to Create
- [ ] `client/src/pages/SaturnVisualSolver.tsx` (~200 lines)
- [ ] `client/src/components/saturn/SaturnHeader.tsx` (~60 lines)
- [ ] `client/src/components/saturn/SaturnImageGallery.tsx` (~80 lines) **CRITICAL**
- [ ] `client/src/components/saturn/SaturnLogViewer.tsx` (~100 lines)
- [ ] `client/src/components/saturn/SaturnPhaseProgress.tsx` (~120 lines)
- [ ] `client/src/components/saturn/SaturnAdvancedSettings.tsx` (~100 lines)
- [ ] `client/src/components/saturn/SaturnReasoningPanel.tsx` (~80 lines)
- [ ] `client/src/components/saturn/SaturnRunningStatus.tsx` (~50 lines)
- [ ] `client/src/components/saturn/SaturnCompactStatus.tsx` (~40 lines)
- [ ] `client/src/components/saturn/SaturnResultsCard.tsx` (~50 lines)
- [ ] `client/src/components/saturn/SaturnAttribution.tsx` (~30 lines)

### Utilities to Create
- [ ] `client/src/utils/logParser.ts` (~50 lines)
- [ ] `client/src/utils/saturnPhases.ts` (~80 lines)

### Existing Components to Reuse
- ✅ `client/src/components/saturn/SaturnModelSelect.tsx` (already exists)
- ✅ `client/src/components/puzzle/PuzzleGrid.tsx` (already exists)
- ✅ `client/src/components/ui/collapsible-card.tsx` (from GroverSolver)
- ✅ `client/src/hooks/useSaturnProgress.ts` (already exists)
- ✅ `client/src/hooks/usePuzzle.ts` (already exists)
- ✅ `client/src/hooks/useModels.ts` (already exists)

---

## 🚀 Success Criteria

### Must-Have Features
1. ✅ Images render correctly in gallery
2. ✅ Logs stream in real-time to terminal viewer
3. ✅ Phase progress updates visually
4. ✅ Advanced settings work (temperature, reasoning params)
5. ✅ Start/Cancel buttons function correctly
6. ✅ SSE streaming integration displays live reasoning
7. ✅ Token usage displays accurately
8. ✅ Responsive layout works on mobile/tablet/desktop
9. ✅ DaisyUI components used exclusively (no shadcn)
10. ✅ SRP compliance - each component has single responsibility

### Nice-to-Have Features
1. 🎯 Copy-to-clipboard for logs
2. 🎯 Download images as ZIP
3. 🎯 Expand/collapse individual log levels
4. 🎯 Keyboard shortcuts (Space = Start/Cancel, Esc = Cancel)
5. 🎯 Dark mode support
6. 🎯 Export reasoning as Markdown

---

## 📝 Implementation Notes

### DRY Opportunities
- **Log Parsing Logic** - Extract to `utils/logParser.ts`
- **Phase Metadata** - Extract to `utils/saturnPhases.ts`
- **Collapsible Card** - Reuse from GroverSolver
- **Badge Components** - Create shared badge utility

### SRP Violations to Avoid
- ❌ Don't mix log parsing logic in component
- ❌ Don't inline phase descriptions in JSX
- ❌ Don't duplicate settings controls
- ❌ Don't mix image gallery with log viewer

### Accessibility Checklist
- [ ] All buttons have descriptive `aria-label`
- [ ] Image gallery has `role="list"` and `role="listitem"`
- [ ] Keyboard navigation works (Tab, Enter, Esc)
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announcements for status updates

---

## 🎯 FINAL GOAL

**A 200-line main page that delegates to 10 modular components, uses DaisyUI exclusively, fixes image rendering, has proper SSE streaming, and follows best practices from GroverSolver.tsx.**

**Zero shadcn/ui. Zero 680-line monoliths. Zero compromises.**

---

## 📚 References
- `client/src/pages/GroverSolver.tsx` - Visual design pattern
- `client/src/hooks/useSaturnProgress.ts` - State management
- `server/services/saturnService.ts` - Backend image streaming
- DaisyUI Docs: https://daisyui.com/components/
