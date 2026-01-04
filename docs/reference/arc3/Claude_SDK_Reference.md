# Claude SDK Reference for OpenAI Implementation

**Date:** 2026-01-02
**Purpose:** Document how the official Claude Code ARC-AGI-3 SDK patterns map to our OpenAI Agents SDK implementation
**Reference Repo:** [external/ARC-AGI-3-ClaudeCode-SDK](../../../external/ARC-AGI-3-ClaudeCode-SDK/)

---

## Overview

The official **Claude Code ARC-AGI-3 SDK** provides a CLI-based interface for playing ARC-AGI-3 games using simple Node.js scripts. Our implementation uses the **OpenAI Agents SDK** to create an automated agent runner while preserving the same underlying patterns and helper utilities.

### Key Differences

| Aspect | Claude SDK (CLI Scripts) | Our OpenAI Implementation |
|--------|--------------------------|---------------------------|
| **Control** | Human (or Claude Code AI) manually decides actions | OpenAI agent autonomously decides actions via tool calls |
| **Interface** | CLI scripts (`node actions/action.js --type 1`) | Web UI + SSE streaming |
| **ARC3 API** | Direct HTTP calls to `three.arcprize.org` | Same (via `Arc3ApiClient`) |
| **Helpers** | JavaScript utilities in `helpers/` | TypeScript ports in `server/services/arc3/helpers/` |
| **Storage** | Local JSON files (config.json, sessions.json) | PostgreSQL database |
| **Model** | Claude via Code tool invocations | OpenAI via Agents SDK |

---

## Workflow Mapping

### Claude SDK Workflow

```bash
# 1. Open scorecard (required before starting games)
node actions/open-scorecard.js --tags "experiment,test"
# → Calls POST /api/scorecard/open
# → Stores card_id in config.json

# 2. Start a game
node actions/start-game.js --game ls20-016295f7601e
# → Calls POST /api/cmd/RESET with card_id
# → Stores guid in sessions.json
# → Saves frame_0000.json

# 3. Execute actions manually
node actions/action.js --type 1  # ACTION1 (e.g., move up)
# → Calls POST /api/cmd/ACTION1 with guid + card_id
# → Saves frame_0001.json

node actions/action.js --type 6 --x 10 --y 20  # ACTION6 (click at coordinates)
# → Calls POST /api/cmd/ACTION6 with {x, y, guid, card_id}
# → Saves frame_0002.json

# 4. Check status
node actions/status.js
# → Shows current frame, state (NOT_FINISHED/WIN/GAME_OVER), score

# 5. Reset if needed
node actions/reset-game.js
# → Calls POST /api/cmd/RESET

# 6. Close scorecard when done
node actions/close-scorecard.js
```

### Our OpenAI Implementation

```typescript
// 1. Open scorecard
const cardId = await Arc3ApiClient.openScorecard(['openai-agents']);
// → Same HTTP call to /api/scorecard/open
// → Returns card_id, stored in session state

// 2. Start game
const initialFrame = await Arc3ApiClient.startGame('ls20-016295f7601e', undefined, cardId);
// → Same HTTP call to /api/cmd/RESET with card_id
// → Returns FrameData with guid, frame, state, score

// 3. Create OpenAI agent with action tools
const agent = new Agent({
  name: 'ARC3 Agent',
  instructions: systemPrompt,
  model: 'gpt-5-nano-2025-08-07',
  tools: [action1Tool, action2Tool, ..., action6Tool],  // Action tools wrap API client calls
  modelSettings: {
    reasoning: { effort: 'medium', summary: 'detailed' },
    text: { verbosity: 'high' }
  }
});

// 4. Run agent loop (autonomous action selection)
const result = await run(agent, `Play ${gameId}`, { stream: true });
// → Agent calls action tools based on reasoning
// → Each tool executes via Arc3ApiClient.executeAction()
// → Streams frame updates via SSE

// 5. Final state returned
// result.frames contains all FrameData objects
// result.providerResponseId for conversation continuation
```

---

## Helper Utilities Mapping

The Claude SDK provides battle-tested JavaScript utilities for frame/grid analysis. We port these to TypeScript for use in our OpenAI implementation.

### Frame Analysis

**Source:** [external/ARC-AGI-3-ClaudeCode-SDK/helpers/frame-analysis.js](../../../external/ARC-AGI-3-ClaudeCode-SDK/helpers/frame-analysis.js)
**Destination:** [server/services/arc3/helpers/frameAnalysis.ts](../../../server/services/arc3/helpers/frameAnalysis.ts)

| Function | Purpose | Status |
|----------|---------|--------|
| `compareFrames(frame1, frame2)` | Find pixel differences between frames | ✅ Ported |
| `loadFrame(framePath)` | Load frame from JSON file | ⚠️ Adapted for DB |
| `getGrid(frame)` | Extract 2D/3D grid array from frame object | ✅ Ported |
| `printDifferenceSummary(diffs, action)` | Human-readable change summary | ✅ Ported |
| `getFrameFiles(sessionDir)` | List all frame files in session | ❌ N/A (DB) |

**Usage Example:**
```typescript
import { compareFrames, printDifferenceSummary } from '@/server/services/arc3/helpers/frameAnalysis';

const diffs = compareFrames(previousFrame, currentFrame);
const summary = printDifferenceSummary(diffs, 'ACTION1');
console.log(summary);
// Output: "Action ACTION1: 12 pixels changed"
//         "  1. (5, 10): 0 → 3"
//         "  2. (5, 11): 0 → 3"
//         ...
```

### Grid Analysis

**Source:** [external/ARC-AGI-3-ClaudeCode-SDK/helpers/grid-analysis.js](../../../external/ARC-AGI-3-ClaudeCode-SDK/helpers/grid-analysis.js)
**Destination:** [server/services/arc3/helpers/gridAnalysis.ts](../../../server/services/arc3/helpers/gridAnalysis.ts)

| Function | Purpose | Status |
|----------|---------|--------|
| `analyzeColorDistribution(grid)` | Count pixels per color, calculate percentages | ✅ Ported |
| `findRectangularRegions(grid, color)` | Find bounding boxes of color regions | ✅ Ported |
| `detectRepeatingPattern(sequence)` | Detect repeating patterns in 1D arrays | ✅ Ported |
| `getRow(grid, rowIndex)` | Extract specific row | ✅ Ported |
| `getColumn(grid, colIndex)` | Extract specific column | ✅ Ported |
| `findRowPatterns(grid)` | Find repeating patterns in rows | ✅ Ported |
| `findColumnPatterns(grid)` | Find repeating patterns in columns | ✅ Ported |
| `findConnectedComponents(grid, color)` | 4-connected component analysis | ✅ Ported |

**Usage Example:**
```typescript
import { analyzeColorDistribution, findConnectedComponents } from '@/server/services/arc3/helpers/gridAnalysis';

const grid = getGrid(currentFrame);
const colors = analyzeColorDistribution(grid);
console.log(colors);
// Output: { 0: 3840, 3: 96, 7: 64 }  (color → pixel count)

const components = findConnectedComponents(grid, 3);
console.log(`Found ${components.length} separate objects of color 3`);
```

### Grid Visualization

**Source:** [external/ARC-AGI-3-ClaudeCode-SDK/helpers/grid-visualization.js](../../../external/ARC-AGI-3-ClaudeCode-SDK/helpers/grid-visualization.js)
**Destination:** [server/services/arc3/helpers/gridVisualization.ts](../../../server/services/arc3/helpers/gridVisualization.ts)

| Function | Purpose | Status |
|----------|---------|--------|
| `gridToAscii(grid, colorMap)` | Convert grid to ASCII art | ✅ Ported |
| `displayRegion(grid, row, col, radius)` | Show zoomed region with coordinates | ✅ Ported |
| `createGridSummary(grid, scale)` | Downsampled overview of large grids | ✅ Ported |
| `highlightPositions(grid, positions, char)` | Mark specific cells in ASCII view | ✅ Ported |
| `compareSideBySide(grid1, grid2, maxWidth)` | Side-by-side diff visualization | ✅ Ported |

**Usage Example:**
```typescript
import { gridToAscii, compareSideBySide } from '@/server/services/arc3/helpers/gridVisualization';

const grid = getGrid(currentFrame);
const ascii = gridToAscii(grid);
console.log(ascii);
// Output (example):
//   0000000000000000
//   0003333000000000
//   0003333000777700
//   0003333000777700
//   ...

const diff = compareSideBySide(previousGrid, currentGrid);
console.log(diff);
// Shows grids side-by-side with changes highlighted
```

---

## System Prompt Equivalence

### Claude SDK System Message

The Claude SDK doesn't have a centralized system prompt. Instead, Claude Code reads the instructions from `CLAUDE.MD` when invoked. Key excerpts:

```markdown
You are a bot that is solving the Arc AGI 3 benchmark.

## Core Concept
- Input: One or more grid patterns (up to 64x64 cells)
- Goal: Discover the underlying rule/pattern and apply it
- Values: Each cell contains a value from 0-15 (representing colors)

## Game Mechanics
1. Start: Agent resets the game to receive initial frame
2. Observe: Agent analyzes the current grid pattern(s)
3. Reason: Agent must identify the transformation rule
4. Act: Agent submits an action to transform the grid
5. Score: Performance measured on a scale of 0-254

## Available Helper Functions
- compareFrames(), analyzeColorDistribution(), gridToAscii(), etc.

## Taking Notes
Whenever you need to take notes write them in ./notes folder as markdown files.
```

### Our OpenAI System Prompt

We translate these instructions into a structured system prompt for the OpenAI agent:

```typescript
const systemPrompt = `You are solving ARC-AGI-3 (Abstraction and Reasoning Corpus) puzzles.

# Game Mechanics
- **Grid:** Up to 64x64 cells, each containing a value 0-15 (representing colors)
- **Goal:** Discover the underlying rule/pattern and apply it via actions
- **Actions:** You have 7 action tools (ACTION1-7) to interact with the environment
  - ACTION1-5: Simple actions (often mapped to directional movement or interactions)
  - ACTION6: Complex action with coordinates (x, y) for clicking/selecting
  - ACTION7: Undo (if supported by the game)

# Workflow
1. **Observe:** Analyze the current grid using the analyze_frame tool
2. **Reason:** Identify patterns, transformations, or rules
3. **Hypothesize:** Form theories about how actions will change the grid
4. **Act:** Call an action tool (ACTION1-7) to test your hypothesis
5. **Verify:** Check if the result matches your prediction
6. **Iterate:** Refine your understanding and continue

# Available Tools
- \`analyze_frame\`: Get structured analysis of the current grid (colors, components, patterns)
- \`ACTION1-7\`: Execute game actions

# Strategy Tips
- Start with exploratory actions to understand the game mechanics
- Use analyze_frame to detect patterns and symmetries
- Track what changed after each action (grid diff)
- Form explicit hypotheses before acting
- Avoid random exploration; reason about cause and effect

# Game States
- NOT_FINISHED: Game in progress, keep playing
- WIN: Level completed successfully
- GAME_OVER: Failed (ran out of moves, died, etc.)

Your goal is to efficiently discover the rules and win the game.`;
```

---

## Storage Patterns

### Claude SDK Storage

**Files:**
- `config.json` → Current API key + scorecard ID
- `games.json` → Cached list of available games
- `sessions.json` → Active game sessions (guid, gameId, state, score, frameCount, actionCount)
- `scorecards.json` → Scorecard history (cardId, openedAt, metadata)
- `frames/[guid]/frame_0000.json` → Individual frame snapshots (deprecated location)
- `games/[game-id]/frames/frame_0000.json` → New location for game-specific frames
- `games/[game-id]/game.json` → Game metadata (hypotheses, strategies, observations)
- `notes/` → Markdown files for agent reasoning

**Frame Structure (frame_0000.json):**
```json
{
  "frameNumber": 0,
  "timestamp": "2025-01-02T10:30:00.000Z",
  "action": { "type": "RESET", "params": {} },
  "caption": "Game initialized",
  "state": "NOT_FINISHED",
  "score": 0,
  "winScore": 100,
  "frame": [[0, 0, 3, 3, ...], [0, 0, 3, 3, ...], ...],  // 64x64 grid
  "pixelChanges": 0,
  "guid": "abc123..."
}
```

### Our OpenAI Storage

**Database Tables:**
- `arc3_sessions` → Session metadata (sessionId, gameId, scorecardId, state, startedAt)
- `arc3_frames` → Frame snapshots (sessionId, frameIndex, frameData JSON, action, timestamp)
- `arc3_actions` → Action history (sessionId, actionType, coordinates, result, reasoningPayload)
- `llm_responses` → Stores OpenAI response metadata (responseId, inputTokens, outputTokens, model)

**Mapping:**
- `config.json` → Session state in memory + env vars for API keys
- `sessions.json` → `arc3_sessions` table
- `frames/[guid]/frame_*.json` → `arc3_frames` table (frameData column)
- `scorecards.json` → Embedded in `arc3_sessions` (scorecardId column)
- `games/[game-id]/game.json` → Not yet implemented (could add `arc3_game_metadata` table)
- `notes/` → Could use `arc3_agent_notes` table for reasoning logs

---

## Code Organization Comparison

### Claude SDK Structure

```
ARC-AGI-3-ClaudeCode-SDK/
├── CLAUDE.MD                  # System instructions for Claude Code
├── README.md                  # User-facing documentation
├── actions/                   # CLI scripts for manual actions
│   ├── list-games.js          # GET /api/games
│   ├── open-scorecard.js      # POST /api/scorecard/open
│   ├── start-game.js          # POST /api/cmd/RESET
│   ├── action.js              # POST /api/cmd/ACTION{1-6}
│   ├── reset-game.js          # POST /api/cmd/RESET
│   ├── status.js              # Show current frame/state
│   ├── get-scorecard.js       # Fetch scorecard data
│   └── close-scorecard.js     # Mark scorecard complete
├── helpers/                   # Reusable utilities
│   ├── frame-analysis.js      # compareFrames, getGrid, etc.
│   ├── grid-analysis.js       # analyzeColorDistribution, findConnectedComponents
│   └── grid-visualization.js  # gridToAscii, compareSideBySide
├── utils.js                   # makeRequest, readJSON, writeJSON, saveFrame
├── init.js                    # Initialize config.json with API key
├── play-arc-with-claude.js    # Automated solver using Claude Code
└── serve-visualizer.js        # Local web server for frame visualization
```

### Our OpenAI Implementation

```
arc-explainer/
├── server/services/arc3/
│   ├── Arc3ApiClient.ts           # HTTP client (equiv to utils.js makeRequest)
│   ├── Arc3AgentsRunner.ts        # Agent runner using OpenAI Agents SDK
│   ├── Arc3StreamService.ts       # SSE streaming coordination
│   ├── helpers/                   # TypeScript ports of Claude SDK helpers
│   │   ├── frameAnalysis.ts       # ✅ Ported
│   │   ├── gridAnalysis.ts        # ✅ Ported
│   │   └── gridVisualization.ts   # ✅ Ported
│   └── types.ts                   # TypeScript type definitions
├── server/routes/arc3.ts          # Express routes for /api/arc3/*
├── client/src/pages/
│   └── ARC3AgentPlayground.tsx    # Web UI for running agents
├── docs/reference/arc3/
│   ├── ARC3.md                    # Our ARC3 overview docs
│   ├── ARC3_Agent_Playbook.md     # Strategy guide (similar to CLAUDE.MD)
│   └── Claude_SDK_Reference.md    # This file
└── external/ARC-AGI-3-ClaudeCode-SDK/  # Reference implementation (submodule)
```

---

## Integration Points

### How Our Code Uses Claude SDK Patterns

1. **Action Execution Flow**
   ```typescript
   // Claude SDK: node actions/action.js --type 1
   // Our implementation:
   const action1Tool = tool({
     name: 'ACTION1',
     description: 'Execute ACTION1 (often move up or primary action)',
     parameters: {},
     execute: async () => {
       const frameData = await arc3Client.executeAction(gameId, gameGuid, { action: 'ACTION1' }, reasoningPayload, scorecardId);
       return frameData;  // Agent sees result and decides next action
     }
   });
   ```

2. **Frame Analysis**
   ```typescript
   // Claude SDK: writes scripts that import helpers/frame-analysis.js
   // Our implementation: provides analyze_frame tool
   const analyzeFrameTool = tool({
     name: 'analyze_frame',
     description: 'Analyze current grid using Claude SDK helper utilities',
     parameters: {},
     execute: async () => {
       const grid = getGrid(currentFrame);  // From frameAnalysis.ts
       const colors = analyzeColorDistribution(grid);  // From gridAnalysis.ts
       const ascii = gridToAscii(grid);  // From gridVisualization.ts
       return { colors, ascii, componentCount: findConnectedComponents(grid, 3).length };
     }
   });
   ```

3. **Scorecard Lifecycle**
   ```typescript
   // Both implementations follow identical flow:
   // 1. openScorecard() → card_id
   // 2. startGame(card_id) → guid
   // 3. executeAction(guid, card_id) → new frame
   // 4. Loop until WIN/GAME_OVER
   ```

---

## Future Enhancements

### Possible Additions

1. **CLI Tools** (optional, for debugging)
   - Create `server/scripts/arc3/` with TypeScript equivalents of `actions/` scripts
   - Useful for testing ARC3 API integration without running full agent

   ```bash
   npm run arc3:open-scorecard
   npm run arc3:start-game -- --game ls20
   npm run arc3:action -- --type 1
   npm run arc3:status
   ```

2. **Notes/Reasoning Log** (agent memory)
   - Add `arc3_agent_notes` table to store agent hypotheses
   - Equivalent to Claude SDK's `notes/` folder
   - Persist reasoning across turns for reflection

3. **Game Metadata** (strategy tracking)
   - Add `arc3_game_metadata` table
   - Store observations, hypotheses, strategies per game
   - Equivalent to `games/[game-id]/game.json`

4. **Local Frame Cache** (debugging)
   - Optional: write frames to `data/arc3/frames/` in addition to DB
   - Makes it easier to inspect frame history with Claude SDK's visualizer

---

## References

- **Official Claude SDK:** [external/ARC-AGI-3-ClaudeCode-SDK/](../../../external/ARC-AGI-3-ClaudeCode-SDK/)
- **ARC-AGI-3 API Docs:** https://docs.arcprize.org
- **OpenAI Agents SDK:** npm package `@openai/agents`
- **Our Implementation:**
  - [Arc3ApiClient.ts](../../../server/services/arc3/Arc3ApiClient.ts) - HTTP client
  - [Arc3AgentsRunner.ts](../../../server/services/arc3/Arc3AgentsRunner.ts) - Agent runner
  - [helpers/](../../../server/services/arc3/helpers/) - Ported utilities

---

**Last Updated:** 2026-01-02
**Maintainer:** Lead Developer
**Status:** Living Document (update as implementation evolves)
