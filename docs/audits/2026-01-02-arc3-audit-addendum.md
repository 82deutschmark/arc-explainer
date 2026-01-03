# ARC3 Audit Addendum: Clarifications & Updated Remediation

**Date:** 2026-01-02
**Author:** Claude Sonnet 4.5
**Parent Document:** [2026-01-02-arc3-implementation-audit.md](./2026-01-02-arc3-implementation-audit.md)

---

## Critical Clarifications from User

### 1. Claude SDK Should Be Formally Integrated ✅

**Current State:**
```
.cache/external/ARC-AGI-3-ClaudeCode-SDK/  ❌ Hidden in cache folder
├── .git/  (repo: https://github.com/ThariqS/ARC-AGI-3-ClaudeCode-SDK)
├── actions/
├── helpers/
└── CLAUDE.MD
```

**Problem:** Reference implementation is hidden in `.cache/` folder, not formally part of the project structure.

**Solution:** Convert to official submodule in `external/` directory.

### 2. User DOES Want OpenAI Agents SDK ✅

**My Initial Misunderstanding:**
> "They should use simple HTTP calls like the Claude SDK, not the heavy Agents SDK"

**User's Actual Intent:**
> "Take all the good logic and code from the Claude SDK and apply it to OpenAI using the OpenAI Agents SDK"

**Corrected Understanding:**
- ✅ YES use OpenAI Agents SDK (not direct HTTP calls to OpenAI)
- ✅ YES mirror the Claude SDK structure (actions/, helpers/, clear workflow)
- ✅ YES integrate helper utilities (frame-analysis, grid-analysis, grid-visualization)
- ❌ NO the current implementations are missing the structured approach from Claude SDK

### 3. OpenAI Agents SDK as Submodule?

**User Question:** "Should the OpenAI Agents SDK be a submodule?"

**Answer:** **NO** - it should be an npm dependency.

**Reasoning:**
```json
// package.json
{
  "dependencies": {
    "@openai/agents": "^0.x.x"  // ✅ npm package
  }
}
```

The OpenAI Agents SDK is distributed as an npm package, not a git repository to clone.

---

## Revised Problem Statement

### The Real Issues

#### Issue 1: Claude SDK Not Integrated

The official reference implementation exists at `.cache/external/ARC-AGI-3-ClaudeCode-SDK/` but:
- ❌ Not listed in `.gitmodules`
- ❌ Hidden in cache folder (suggests temporary/non-critical)
- ❌ Helper utilities not imported into main codebase
- ❌ Workflow patterns not documented for OpenAI equivalent

#### Issue 2: Current Implementations Missing Structure

The existing runners (`Arc3RealGameRunner`, `CodexArc3Runner`) use the Agents SDK correctly but lack:
- ❌ Equivalent `actions/` scripts for manual testing
- ❌ Ported `helpers/` utilities (frame-analysis, grid-analysis)
- ❌ Clear separation between "automated agent" and "manual CLI"
- ❌ Documentation linking Claude SDK patterns to OpenAI implementation

**Example Missing Pattern:**

**Claude SDK Approach:**
```bash
# Manual CLI testing workflow
node actions/open-scorecard.js
node actions/start-game.js --game ls20
node actions/action.js --type 1  # Test ACTION1 manually
node actions/status.js
```

**Our OpenAI Implementation:**
- ✅ Has `Arc3ApiClient` (equivalent to Claude SDK's HTTP requests)
- ✅ Has agent runners (automated gameplay)
- ❌ NO manual CLI scripts to test actions independently
- ❌ NO ported helper utilities for analysis

#### Issue 3: Naming Still Confusing

Even understanding that both use Agents SDK:
- "arc3_claude" → Actually uses OpenAI Agents SDK
- "codex" → Also uses OpenAI Agents SDK, just different model

**Better naming:**
- "openai_nano" (using gpt-5-nano)
- "openai_codex" (using gpt-5.1-codex-mini)

---

## Revised Remediation Plan

### Phase 0: Integrate Claude SDK Properly (Immediate)

**Task 0.1: Convert Claude SDK to Proper Submodule**

```bash
# 1. Remove from .cache/external/
cd d:\GitHub\arc-explainer
mv .cache\external\ARC-AGI-3-ClaudeCode-SDK external\ARC-AGI-3-ClaudeCode-SDK

# 2. Add as git submodule
git submodule add https://github.com/ThariqS/ARC-AGI-3-ClaudeCode-SDK external/ARC-AGI-3-ClaudeCode-SDK

# 3. Update .gitmodules
```

**Expected `.gitmodules` entry:**
```ini
[submodule "external/ARC-AGI-3-ClaudeCode-SDK"]
	path = external/ARC-AGI-3-ClaudeCode-SDK
	url = https://github.com/ThariqS/ARC-AGI-3-ClaudeCode-SDK
```

**Task 0.2: Document Reference Implementation**

Create `docs/reference/arc3/Claude_SDK_Reference.md`:
```markdown
# Claude SDK Reference for OpenAI Implementation

## Overview
The official Claude Code ARC-AGI-3 SDK lives at `external/ARC-AGI-3-ClaudeCode-SDK/`.
This documents how we apply its patterns to our OpenAI Agents SDK implementation.

## Workflow Mapping

### Claude SDK (CLI Scripts)
1. `node actions/open-scorecard.js` → Opens scorecard, stores card_id in config.json
2. `node actions/start-game.js --game ls20` → Calls RESET, stores guid in sessions.json
3. `node actions/action.js --type 1` → Executes ACTION1 via /api/cmd/ACTION1
4. `node actions/status.js` → Shows current frame, state, score

### Our OpenAI Implementation
1. `Arc3ApiClient.openScorecard()` → Same HTTP call, returns card_id
2. `Arc3ApiClient.startGame(gameId, cardId)` → Same RESET call, returns FrameData
3. OpenAI Agents SDK → Wraps actions as tools, agent decides which to call
4. Stream events → Real-time updates instead of CLI output

## Helper Utilities Mapping

| Claude SDK Helper | Our TypeScript Equivalent | Status |
|-------------------|---------------------------|--------|
| `helpers/frame-analysis.js` | `server/services/arc3/helpers/frameAnalysis.ts` | ❌ TODO |
| `helpers/grid-analysis.js` | `server/services/arc3/helpers/gridAnalysis.ts` | ❌ TODO |
| `helpers/grid-visualization.js` | `server/services/arc3/helpers/gridVisualization.ts` | ❌ TODO |

## Key Insights

1. **Claude SDK = Manual Scripts**: Human (or Claude Code) decides which action to run
2. **Our OpenAI SDK = Automated Agent**: OpenAI model decides actions via tool calls
3. **Same ARC3 API**: Both use identical endpoints (/api/scorecard/open, /api/cmd/*)
4. **Different Control Flow**: Claude SDK is imperative, our implementation is declarative

## TODO: Port Missing Features
- [ ] Port frame-analysis.js to TypeScript
- [ ] Port grid-analysis.js to TypeScript
- [ ] Port grid-visualization.js to TypeScript
- [ ] Create manual CLI scripts for testing (optional)
- [ ] Document system prompt equivalence
```

### Phase 1: Port Helper Utilities (This Week)

**Priority:** HIGH
**Why:** These utilities are battle-tested and missing from our implementation

#### Task 1.1: Port frame-analysis.js → TypeScript

**Source:** `external/ARC-AGI-3-ClaudeCode-SDK/helpers/frame-analysis.js`
**Destination:** `server/services/arc3/helpers/frameAnalysis.ts`

**Functions to port:**
```typescript
// server/services/arc3/helpers/frameAnalysis.ts
/**
 * Author: [Your Name]
 * Date: 2026-01-0X
 * PURPOSE: Frame analysis utilities ported from official Claude SDK.
 *          Provides frame comparison, grid extraction, and diff summaries.
 * SRP/DRY check: Pass - single responsibility (frame/grid analysis)
 * SOURCE: external/ARC-AGI-3-ClaudeCode-SDK/helpers/frame-analysis.js
 */

import type { FrameData } from '../Arc3ApiClient';

export interface PixelDifference {
  row: number;
  col: number;
  layer?: number;
  oldVal: number;
  newVal: number;
}

/**
 * Compare two frames and return array of pixel differences.
 * Ported from Claude SDK's compareFrames().
 */
export function compareFrames(
  frame1: FrameData,
  frame2: FrameData
): PixelDifference[] {
  const diffs: PixelDifference[] = [];
  const grid1 = getGrid(frame1);
  const grid2 = getGrid(frame2);

  // Handle 3D frames (layers)
  if (Array.isArray(grid1[0][0])) {
    // 3D: [layer][row][col]
    const layers = grid1.length;
    const height = grid1[0].length;
    const width = grid1[0][0].length;

    for (let l = 0; l < layers; l++) {
      for (let r = 0; r < height; r++) {
        for (let c = 0; c < width; c++) {
          const oldVal = grid1[l][r][c];
          const newVal = grid2[l][r][c];
          if (oldVal !== newVal) {
            diffs.push({ layer: l, row: r, col: c, oldVal, newVal });
          }
        }
      }
    }
  } else {
    // 2D: [row][col]
    const height = grid1.length;
    const width = grid1[0].length;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const oldVal = grid1[r][c];
        const newVal = grid2[r][c];
        if (oldVal !== newVal) {
          diffs.push({ row: r, col: c, oldVal, newVal });
        }
      }
    }
  }

  return diffs;
}

/**
 * Extract the 2D or 3D grid array from a frame object.
 * Handles frame.frame or frame.frames structures.
 */
export function getGrid(frame: FrameData): number[][] | number[][][] {
  // Frame might have 'frame' or 'frames' property
  if ('frame' in frame && frame.frame) {
    return frame.frame;
  }
  if ('frames' in frame && frame.frames && frame.frames.length > 0) {
    return frame.frames[frame.frames.length - 1]; // Return latest frame
  }
  throw new Error('Frame data does not contain grid information');
}

/**
 * Print a readable summary of frame changes.
 * Ported from Claude SDK's printDifferenceSummary().
 */
export function printDifferenceSummary(
  differences: PixelDifference[],
  actionName: string
): string {
  if (differences.length === 0) {
    return `Action ${actionName}: No pixels changed`;
  }

  const summary = [`Action ${actionName}: ${differences.length} pixels changed`];
  const preview = differences.slice(0, 5);

  preview.forEach((diff, i) => {
    const loc = diff.layer !== undefined
      ? `layer ${diff.layer}, (${diff.row}, ${diff.col})`
      : `(${diff.row}, ${diff.col})`;
    summary.push(`  ${i + 1}. ${loc}: ${diff.oldVal} → ${diff.newVal}`);
  });

  if (differences.length > 5) {
    summary.push(`  ... and ${differences.length - 5} more`);
  }

  return summary.join('\n');
}

/**
 * Load a frame from our database or cache.
 * Replacement for Claude SDK's loadFrame(framePath).
 */
export async function loadFrameFromDb(
  sessionId: string,
  frameIndex: number
): Promise<FrameData> {
  // TODO: Implement database lookup
  // For now, return mock
  throw new Error('loadFrameFromDb not yet implemented');
}
```

#### Task 1.2: Port grid-analysis.js → TypeScript

**Source:** `external/ARC-AGI-3-ClaudeCode-SDK/helpers/grid-analysis.js`
**Destination:** `server/services/arc3/helpers/gridAnalysis.ts`

**Functions to port:**
- `analyzeColorDistribution(grid)` → color counts and percentages
- `findRectangularRegions(grid, targetColor)` → bounding boxes of color regions
- `detectRepeatingPattern(sequence)` → pattern detection in 1D arrays
- `getRow(grid, rowIndex)` / `getColumn(grid, colIndex)` → extractors
- `findRowPatterns(grid)` / `findColumnPatterns(grid)` → 2D pattern detection
- `findConnectedComponents(grid, targetColor)` → connected region analysis

**Note:** The current `analyze_grid` tool in runners (Python execution) can **use** these TypeScript helpers instead of duplicating logic.

#### Task 1.3: Port grid-visualization.js → TypeScript

**Source:** `external/ARC-AGI-3-ClaudeCode-SDK/helpers/grid-visualization.js`
**Destination:** `server/services/arc3/helpers/gridVisualization.ts`

**Functions to port:**
- `gridToAscii(grid, colorMap)` → ASCII art representation
- `displayRegion(grid, centerRow, centerCol, radius)` → zoomed view
- `createGridSummary(grid, scale)` → downsampled overview
- `highlightPositions(grid, positions, highlightChar)` → mark specific cells
- `compareSideBySide(grid1, grid2, maxWidth)` → diff visualization

**Use Case:** Generate text-based visualizations for LLM context (cheaper than images).

### Phase 2: Improve Current Runners (Next Week)

**Goal:** Keep using OpenAI Agents SDK, but integrate helper utilities and improve structure.

#### Task 2.1: Consolidate Runners

**Problem:** Two nearly identical implementations (Arc3RealGameRunner, CodexArc3Runner)

**Solution:** Single unified runner with model parameter.

```typescript
// server/services/arc3/Arc3AgentsRunner.ts (new unified file)
/**
 * Author: [Your Name]
 * Date: 2026-01-0X
 * PURPOSE: Unified ARC3 agent runner using OpenAI Agents SDK.
 *          Consolidates Arc3RealGameRunner and CodexArc3Runner into single implementation.
 *          Integrates helper utilities from Claude SDK.
 * SRP/DRY check: Pass - single runner with model configuration
 * REFERENCE: external/ARC-AGI-3-ClaudeCode-SDK/ for workflow patterns
 */

import { Agent, run, tool } from '@openai/agents';
import { Arc3ApiClient } from './Arc3ApiClient';
import { compareFrames, getGrid, printDifferenceSummary } from './helpers/frameAnalysis';
import { analyzeColorDistribution, findConnectedComponents } from './helpers/gridAnalysis';
import { gridToAscii, compareSideBySide } from './helpers/gridVisualization';

export interface Arc3AgentsConfig {
  game_id: string;
  model: 'gpt-5-nano-2025-08-07' | 'gpt-5.1-codex-mini' | string;
  maxTurns: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  systemPrompt?: string;
  sessionId?: string;
}

export class Arc3AgentsRunner {
  constructor(private apiClient: Arc3ApiClient) {}

  async run(config: Arc3AgentsConfig): Promise<Arc3RunResult> {
    // 1. Open scorecard
    const cardId = await this.apiClient.openScorecard(['openai-agents']);

    // 2. Start game
    let currentFrame = await this.apiClient.startGame(config.game_id, undefined, cardId);
    const gameGuid = currentFrame.guid;

    // 3. Create analysis tools using ported helpers
    const analyzeFrameTool = tool({
      name: 'analyze_frame',
      description: 'Analyze the current frame using Claude SDK helper utilities',
      parameters: {},
      execute: async () => {
        const grid = getGrid(currentFrame);
        const colors = analyzeColorDistribution(grid);
        const ascii = gridToAscii(grid);
        return { colors, ascii, grid };
      }
    });

    // 4. Create agent with imported helper utilities
    const agent = new Agent({
      name: 'ARC3 OpenAI Agent',
      instructions: this.buildSystemPrompt(config),
      model: config.model,
      tools: [
        analyzeFrameTool,
        ...this.getActionTools(gameGuid, cardId),
      ],
      modelSettings: {
        reasoning: {
          effort: config.reasoningEffort || 'medium',
          summary: 'detailed'
        },
        text: {
          verbosity: config.model.includes('codex') ? 'medium' : 'high'
        }
      }
    });

    // 5. Run agent loop
    const result = await run(agent, `Play ${config.game_id}`, { stream: true });

    return {
      gameGuid,
      finalFrame: currentFrame,
      providerResponseId: result.response?.id
    };
  }

  private buildSystemPrompt(config: Arc3AgentsConfig): string {
    // Import system prompt patterns from Claude SDK's CLAUDE.MD
    const basePrompt = `You are solving ARC-AGI-3 puzzles. These are visual reasoning games where you must:

1. **Observe** the grid pattern
2. **Reason** about the underlying rule
3. **Act** by calling action tools (ACTION1-7)

Use the analyze_frame tool to get structured analysis of the current state.
Use frame comparison to see what changed after each action.
`;
    return config.systemPrompt || basePrompt;
  }

  private getActionTools(gameGuid: string, cardId: string): Tool[] {
    // Action tools (ACTION1-7) that call Arc3ApiClient
    // ... existing implementation from Arc3RealGameRunner
  }
}
```

**Benefits:**
- ✅ Single codebase (no more Arc3RealGameRunner vs CodexArc3Runner confusion)
- ✅ Uses ported helper utilities
- ✅ Model is just a parameter
- ✅ Follows Claude SDK patterns (observe, reason, act)

#### Task 2.2: Rename Frontend Providers

```typescript
// client/src/pages/ARC3AgentPlayground.tsx
- const [provider, setProvider] = useState<'arc3_claude' | 'codex'>('arc3_claude');
+ const [model, setModel] = useState<string>('gpt-5-nano-2025-08-07');

// UI change
- <Toggle>Claude / Codex</Toggle>
+ <Select>
+   <Option value="gpt-5-nano-2025-08-07">OpenAI Nano (Cheap)</Option>
+   <Option value="gpt-5.1-codex-mini">OpenAI Codex Mini</Option>
+   <Option value="gpt-4o">OpenAI GPT-4o</Option>
+ </Select>
```

**Why:** Makes it clear these are all OpenAI models, just different pricing tiers.

#### Task 2.3: Add ACTION7 (Undo)

Already covered in main audit - add to unified runner.

### Phase 3: Optional CLI Tools (Future)

**Goal:** Create manual testing scripts similar to Claude SDK's `actions/` folder.

**Use Case:** Test ARC3 API integration without running full agent.

```bash
# Manual testing workflow (similar to Claude SDK)
npm run arc3:open-scorecard
npm run arc3:start-game -- --game ls20
npm run arc3:action -- --type 1
npm run arc3:status
```

**Implementation:** Create `server/scripts/arc3/` folder with TypeScript CLI tools.

---

## Updated Success Criteria

### Phase 0 (Immediate - Today)
- [x] Claude SDK moved from `.cache/external/` to `external/`
- [ ] Added as git submodule
- [ ] Documentation created: `docs/reference/arc3/Claude_SDK_Reference.md`

### Phase 1 (This Week)
- [ ] `frameAnalysis.ts` ported and tested
- [ ] `gridAnalysis.ts` ported and tested
- [ ] `gridVisualization.ts` ported and tested
- [ ] Unit tests for helper utilities

### Phase 2 (Next Week)
- [ ] `Arc3AgentsRunner.ts` created (consolidates old runners)
- [ ] Frontend updated to use model selector instead of provider toggle
- [ ] ACTION7 implemented
- [ ] Old runners deprecated with clear migration path
- [ ] Integration tests passing

### Phase 3 (Future - Optional)
- [ ] CLI tools created for manual testing
- [ ] Documentation showing Claude SDK → OpenAI equivalence

---

## Revised File Structure

### Before (Current Mess)
```
arc-explainer/
├── .cache/external/                        ❌ Hidden reference impl
│   └── ARC-AGI-3-ClaudeCode-SDK/
├── server/services/arc3/
│   ├── Arc3ApiClient.ts                   ✅ Good
│   ├── Arc3RealGameRunner.ts (1064 lines) ❌ Duplicate
│   ├── CodexArc3Runner.ts (490 lines)     ❌ Duplicate
│   └── (no helpers/ folder)               ❌ Missing
```

### After (Clean Structure)
```
arc-explainer/
├── external/                               ✅ Official submodules
│   ├── ARC-AGI-3-ClaudeCode-SDK/          ✅ Proper submodule (reference)
│   ├── SnakeBench/                         ✅ Already exists
│   └── re-arc/                             ✅ Already exists
├── server/services/arc3/
│   ├── Arc3ApiClient.ts                   ✅ Keep (HTTP client)
│   ├── Arc3AgentsRunner.ts                ✅ New (unified runner)
│   ├── Arc3StreamService.ts               ✅ Keep (SSE coordination)
│   ├── helpers/                            ✅ New (ported from Claude SDK)
│   │   ├── frameAnalysis.ts
│   │   ├── gridAnalysis.ts
│   │   └── gridVisualization.ts
│   └── types.ts                           ✅ Keep
├── docs/reference/arc3/
│   └── Claude_SDK_Reference.md            ✅ New (mapping document)
```

---

## Key Takeaways (Revised)

1. ✅ **DO use OpenAI Agents SDK** - User confirmed this is the right approach
2. ✅ **DO integrate Claude SDK** - Move from `.cache/` to `external/` as submodule
3. ✅ **DO port helper utilities** - frame/grid analysis from Claude SDK to TypeScript
4. ✅ **DO consolidate runners** - Single `Arc3AgentsRunner` with model parameter
5. ❌ **DON'T rewrite from scratch** - Current implementation is mostly correct
6. ❌ **DON'T add OpenAI SDK as submodule** - It's an npm package

---

## Timeline Estimate (Revised)

- **Phase 0:** 1-2 hours (move folder, update .gitmodules, create docs)
- **Phase 1:** 2-3 days (port helper utilities, write unit tests)
- **Phase 2:** 3-4 days (consolidate runners, update frontend, test)
- **Phase 3:** Optional (future enhancement)

**Total:** ~1 week for critical path (Phases 0-2)

---

**End of Addendum**
