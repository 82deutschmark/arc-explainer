# ARC3 Analyze Grid Tool Implementation Plan

**Author:** Claude Code using Opus 4.5
**Date:** 2025-12-08
**PURPOSE:** Add Python code execution capability to ARC3 Agent system for programmatic grid analysis

## Objective

Add an `analyze_grid` tool to the ARC3 Agent that allows agents to execute Python code for programmatic grid analysis (connected components, symmetry detection, bounding boxes, etc.) without flooding context with raw grid data.

## Files to Modify

- `server/services/arc3/Arc3RealGameRunner.ts` - Add `analyze_grid` tool definition
- `docs/reference/arc3/ARC3_Agent_Playbook.md` - Add tool usage guidance

## Files Already Created (No Changes Needed)

- `server/services/arc3/helpers/gridAnalyzer.ts` - Python execution helper (complete)

## Files to Delete (DRY Cleanup)

- None - but mark the non-streaming `run()` method for deprecation

## Implementation Tasks

### Phase 1: Add analyze_grid Tool to runWithStreaming()

1. **In `Arc3RealGameRunner.ts` line ~475 (after inspectTool definition)**, add the analyze_grid tool:

```typescript
const analyzeGridTool = tool({
  name: 'analyze_grid',
  description: 'Execute Python code to analyze the current game grid programmatically. The code runs in a sandboxed environment with numpy, scipy.ndimage available. You have access to: `grid` (3D numpy array of all layers), `current_layer` (2D array of latest layer), and helper functions: find_connected_components(layer, color=None), detect_symmetry(layer), get_bounding_box(layer, exclude_color=0), color_counts(layer). Use print() to output results - stdout is captured and returned. 10 second timeout.',
  parameters: z.object({
    code: z
      .string()
      .min(5)
      .max(4000)
      .describe('Python code to execute. Must use print() to output results. Has access to grid, current_layer, numpy (as np), and scipy.ndimage.'),
    note: z
      .string()
      .max(120)
      .nullable()
      .describe('Optional note explaining the purpose of this analysis.'),
  }),
  execute: async ({ code, note }) => {
    logger.info(`[ARC3 TOOL STREAM] analyze_grid called with note: "${note}"`, 'arc3');

    if (!currentFrame) {
      throw new Error('Game session not initialized yet.');
    }

    streamHarness.emitEvent("agent.tool_call", {
      tool: 'analyze_grid',
      arguments: { code: code.slice(0, 200) + '...', note },
      timestamp: Date.now(),
    });

    const result = await executeGridAnalysis(currentFrame.frame, code);

    const toolResult = {
      success: result.success,
      output: result.output,
      error: result.error,
      executionTimeMs: result.executionTimeMs,
      note: note ?? null,
    };

    logger.info(
      `[ARC3 TOOL STREAM] analyze_grid completed: success=${result.success}, ` +
      `time=${result.executionTimeMs}ms, output_length=${result.output.length}`,
      'arc3'
    );

    streamHarness.emitEvent("agent.tool_result", {
      tool: 'analyze_grid',
      result: toolResult,
      timestamp: Date.now(),
    });

    return toolResult;
  },
});
```

2. **Add the tool to the agent's tools array** at line ~594:

Change:
```typescript
tools: [inspectTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
```

To:
```typescript
tools: [inspectTool, analyzeGridTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
```

### Phase 2: Add analyze_grid to Non-Streaming run() Method (for parity)

3. **In `Arc3RealGameRunner.ts` line ~167 (after inspectTool in run() method)**, add the same analyze_grid tool definition without streaming events:

```typescript
const analyzeGridTool = tool({
  name: 'analyze_grid',
  description: 'Execute Python code to analyze the current game grid programmatically. The code runs in a sandboxed environment with numpy, scipy.ndimage available. You have access to: `grid` (3D numpy array of all layers), `current_layer` (2D array of latest layer), and helper functions: find_connected_components(layer, color=None), detect_symmetry(layer), get_bounding_box(layer, exclude_color=0), color_counts(layer). Use print() to output results - stdout is captured and returned. 10 second timeout.',
  parameters: z.object({
    code: z
      .string()
      .min(5)
      .max(4000)
      .describe('Python code to execute. Must use print() to output results.'),
    note: z
      .string()
      .max(120)
      .nullable()
      .describe('Optional note explaining the purpose of this analysis.'),
  }),
  execute: async ({ code, note }) => {
    logger.info(`[ARC3 TOOL] analyze_grid called with note: "${note}"`, 'arc3');

    if (!currentFrame) {
      throw new Error('Game session not initialized yet.');
    }

    const result = await executeGridAnalysis(currentFrame.frame, code);

    logger.info(
      `[ARC3 TOOL] analyze_grid completed: success=${result.success}, ` +
      `time=${result.executionTimeMs}ms`,
      'arc3'
    );

    return {
      success: result.success,
      output: result.output,
      error: result.error,
      executionTimeMs: result.executionTimeMs,
      note: note ?? null,
    };
  },
});
```

4. **Update tools array in non-streaming run()** at line ~274:

Change:
```typescript
tools: [inspectTool, resetGameTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
```

To:
```typescript
tools: [inspectTool, analyzeGridTool, resetGameTool, simpleAction('ACTION1'), simpleAction('ACTION2'), simpleAction('ACTION3'), simpleAction('ACTION4'), simpleAction('ACTION5'), action6Tool],
```

### Phase 3: Update ARC3 Agent Playbook

5. **In `docs/reference/arc3/ARC3_Agent_Playbook.md`**, add a new section after "3. Tools and Harness Features":

```markdown
---

### 3.6 Grid Analysis Tool (`analyze_grid`)

The `analyze_grid` tool lets you execute Python code to perform programmatic analysis on the current game grid. This is essential for tasks that are difficult to determine visually:

**Available in your code environment:**
- `grid`: numpy array of shape (layers, height, width), values 0-15
- `current_layer`: the most recent 2D layer (what you see)
- `np` (numpy): for array operations
- `scipy.ndimage`: for connected components, labeling, morphology

**Built-in helper functions:**
- `find_connected_components(layer, color=None)` - Returns list of (color, size, bounding_box) tuples
- `detect_symmetry(layer)` - Returns dict with horizontal, vertical, rotation_90, rotation_180 booleans
- `get_bounding_box(layer, exclude_color=0)` - Returns (min_row, min_col, max_row, max_col) or None
- `color_counts(layer)` - Returns dict mapping color to pixel count

**Example usage:**
```python
# Find all connected components
components = find_connected_components(current_layer)
print(f"Found {len(components)} objects")
for color, size, bbox in components:
    print(f"  Color {color}: {size} pixels at {bbox}")

# Check for symmetry
sym = detect_symmetry(current_layer)
print(f"Horizontal symmetry: {sym['horizontal']}")
print(f"Vertical symmetry: {sym['vertical']}")

# Custom analysis - find distance between two colors
color_3_coords = np.argwhere(current_layer == 3)
color_7_coords = np.argwhere(current_layer == 7)
if len(color_3_coords) > 0 and len(color_7_coords) > 0:
    center_3 = color_3_coords.mean(axis=0)
    center_7 = color_7_coords.mean(axis=0)
    distance = np.linalg.norm(center_3 - center_7)
    print(f"Distance between color 3 and 7 centers: {distance:.2f}")
```

**When to use:**
- Detecting object counts and positions
- Checking symmetry properties
- Calculating distances between objects
- Finding patterns that span the grid
- Validating hypotheses about game rules

**Constraints:**
- 10 second execution timeout
- No file I/O, network, or external packages
- Output limited to 8000 characters
- Use print() to return results
```

6. **In the same file, update Section 2.1 "Per-Game Setup"** to mention the new tool:

Add after line ~54:
```markdown
   - Use `analyze_grid` tool for programmatic pattern detection when visual inspection is insufficient.
```

7. **Update Section 2.2 "Exploration Phase"** to include analyze_grid:

Add after line ~76:
```markdown
- Use `analyze_grid` for structured experiments:
  - Count objects before and after actions
  - Measure distances between key elements
  - Check symmetry changes
  - Track which connected components move or change
```

## Security Considerations

The existing `gridAnalyzer.ts` implementation already addresses security:

1. **Sandboxed execution**: Python runs as a subprocess with no shell access
2. **Timeout protection**: 10-second hard timeout via SIGTERM
3. **Output limits**: Truncated to 8000 characters to prevent context flooding
4. **No imports allowed**: Only numpy/scipy from the injected environment
5. **Temp file cleanup**: Script and data files are deleted after execution
6. **No file system access**: Code cannot read/write arbitrary files (data passed via temp JSON)

**Note**: The Python code runs with the same privileges as the Node.js server. For production deployment, consider adding:
- Process isolation (Docker/VM)
- Memory limits
- CPU quotas

## Integration Points

- `executeGridAnalysis()` from `helpers/gridAnalyzer.ts` handles all Python execution
- Tool results flow through the existing SSE streaming pipeline via `streamHarness.emitEvent()`
- Tool timeline entries are captured by `processRunItemsWithReasoning()` for final result
- The tool is stateless - it reads from `currentFrame.frame` which is already managed by the runner

## Testing Approach (Manual)

1. Start the dev server: `npm run test`
2. Navigate to ARC3 Agent Playground
3. Start a game session
4. In the agent prompt, include: "Use analyze_grid to count the objects in the grid"
5. Verify:
   - Tool appears in agent's available tools
   - Agent can call the tool with Python code
   - Python execution completes and returns output
   - Results are visible in the tool timeline
   - Errors (syntax errors, timeouts) are handled gracefully

## Validation

- Plan created and saved to `docs/plans/2025-12-08-arc3-analyze-grid-tool-plan.md`
- User should review and approve before implementation begins
