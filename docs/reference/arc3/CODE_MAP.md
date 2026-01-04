# ARC-3 Agent Implementation Code Map

**Author:** Claude Haiku (Explore Agent)
**Date:** 2025-12-20 (Updated 2026-01-03)
**PURPOSE:** A comprehensive developer guide explaining the ARC-3 agent implementation architecture, data flow, key files, patterns, and how to extend the system.
**SRP/DRY Check:** PASS — This document consolidates scattered information into a single source of truth for developers. No code duplication; modular design patterns are explained and referenced.

---

## Quick Navigation

- [System Architecture](#system-architecture)
- [Core Components](#core-components)
- [Data Flow & Execution](#data-flow--execution)
- [Key File Locations](#key-file-locations)
- [Database Schema](#database-schema)
- [Frontend Integration](#frontend-integration)
- [Common Tasks](#common-tasks)
- [Patterns & Best Practices](#patterns--best-practices)
- [Debugging & Troubleshooting](#debugging--troubleshooting)

---

## System Architecture

The ARC-3 agent is a **streaming, multi-step game solver** that uses the **OpenAI Agents SDK** to orchestrate intelligent gameplay against the official **ARC-AGI-3 API** (https://three.arcprize.org).

### High-Level Stack

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (React/TypeScript)                                 │
│ - Pages: ARC3AgentPlayground, Arc3GamesBrowser              │
│ - Components: Grid visualization, controls, reasoning view  │
│ - Hook: useArc3AgentStream (SSE + state management)         │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│ Express Routes (server/routes/arc3.ts)                      │
│ - POST /api/arc3/stream/prepare (session setup; BYOK allowed/required in prod) │
│ - GET  /api/arc3/stream/:sessionId (SSE endpoint)           │
│ - POST /api/arc3/stream/cancel/:sessionId (cancel)          │
│ - POST /api/arc3/real-game/run (non-stream fallback)        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│ Service Layer (server/services/arc3/)                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Arc3StreamService.ts - Session lifecycle & SSE control  │ │
│ │ Arc3RealGameRunner.ts - Agent + Tools orchestration    │ │
│ │ Arc3ApiClient.ts - HTTP wrapper for ARC-AGI-3 API      │ │
│ │ frameUnpacker.ts - 3D/4D detection + unpack            │ │
│ │ helpers/runHelpers.ts - mapState, prompt selection     │ │
│ │ Persistence layer - Session & frame storage            │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│ External APIs & Storage                                     │
│ - ARC-AGI-3 API (https://three.arcprize.org)               │
│ - PostgreSQL (session + frame history)                      │
│ - OpenAI API (gpt-5-streaming or other models)             │
└─────────────────────────────────────────────────────────────┘
```

### Core Design Principles

1. **Session-Based Continuity**: Game state is tracked via `guid` (ARC API session ID) and `providerResponseId` (Responses API chaining).
2. **Streaming First**: All agent runs support real-time SSE streaming with granular events (reasoning deltas, tool calls, frame updates).
3. **State Collapse**: UI controls disappear during execution, revealing live feedback only.
4. **Modular Tools**: Agent tools are composable and map 1:1 to ARC-AGI-3 actions (ACTION1-6) plus grid analysis.
5. **Persistence**: Every frame and session is logged to PostgreSQL for replay, analysis, and continuity.

---

## Core Components

### 1. Arc3RealGameRunner.ts (1000+ lines)

**Location:** `server/services/arc3/Arc3RealGameRunner.ts`

The **heart of the agent orchestration**. Manages the game loop using OpenAI Agents SDK.

#### Key Responsibilities
- Instantiate an `Agent` with system prompt, tools, and model config
- Execute agent via `run()` (sync) or `runWithStreaming()` (async streaming)
- Implement 8 tools: `inspect_game_state`, `analyze_grid`, `reset_game`, ACTION1-7
- Stream reasoning deltas and tool events to clients
- Persist frames to PostgreSQL

#### Main Methods

| Method | Purpose |
|--------|---------|
| `constructor(config: Arc3GameRunnerConfig)` | Initialize with model, system prompt, game ID |
| `run(input: string): Promise<Agent_Result>` | Synchronous (blocking) agent execution |
| `runWithStreaming(input: string, emitter: EventEmitter)` | Async streaming with event emission |
| `inspectTool()` | Tool: Render grid as PNG data URL, analyze changes |
| `analyzeGridTool(code: string)` | Tool: Execute Python code in sandbox |
| `actionTool(action: ActionType)` | Tool: Execute ACTION1-7, track pixels changed |
| `resetTool()` | Tool: Restart game via ARC API RESET |
| `sendAction(action: string, params?: object)` | Call Arc3ApiClient, handle response |

#### Critical Pattern: Game Continuation

```typescript
// If continuing an existing game:
// 1. Pass existingGameGuid to avoid state corruption
// 2. Validate lastFrame to ensure safe resumption
// 3. Responses API chaining via previousResponseId

async runWithStreaming(input, emitter, {
  existingGameGuid,
  lastFrame,
  previousResponseId
}) {
  // Guards against: mid-action interruption, stale frames
  if (!existingGameGuid) {
    // New game: call RESET to initialize
  } else if (!lastFrame) {
    throw new Error('Cannot continue without cached lastFrame');
  }
  // Responses API handles previousResponseId automatically
}
```

#### Agent Tool System

Tools are exposed to the agent as callable functions with descriptions. The agent decides when/how to use them:

1. **inspect_game_state** → Calls `inspectTool()`, returns PNG data URL
2. **analyze_grid** → Sandboxed Python with numpy, scipy helpers
3. **reset_game** → Issues RESET to ARC API
4. **action1–5** → Simple actions (directional, interact, etc.)
5. **action6** → Coordinate-based action (click, tap, point)
6. **action7** → Undo (if supported by game)
7. Actions normalized from numeric tokens to canonical strings server-side

---

### 2. Arc3StreamService.ts (460 lines)

**Location:** `server/services/arc3/Arc3StreamService.ts`

Manages **SSE (Server-Sent Events) streaming sessions** between client and game runner.

#### Key Responsibilities
- Coordinate session lifecycle (init → running → complete)
- Cache pending and continuation payloads (15-minute TTL)
- Handle Responses API chaining via `previousResponseId`
- Emit granular events: reasoning deltas, tool calls, frame updates
- Support game continuation with safety guards

#### Main Methods

| Method | Purpose |
|--------|---------|
| `createSession()` | Allocate new streaming session ID |
| `getSession(sessionId)` | Retrieve active session state |
| `setSessionPayload(sessionId, payload)` | Cache agent config/continuation data |
| `emitEvent(sessionId, event)` | Queue event for SSE dispatch |
| `flushEvents(sessionId): Event[]` | Return buffered events (called by GET endpoint) |
| `completeSession(sessionId)` | Finalize session, clean up resources |

#### Event Emission Pattern

```typescript
// Typical event flow during streaming:
emitter.on('stream.init', (payload) => service.emitEvent(sessionId, {
  type: 'stream.init',
  data: { sessionId, gameId, guid }
}));

emitter.on('agent.reasoning', (text) => service.emitEvent(sessionId, {
  type: 'agent.reasoning',
  data: { delta: text }
}));

emitter.on('game.frame_update', (frame) => service.emitEvent(sessionId, {
  type: 'game.frame_update',
  data: frame
}));
```

---

### 3. Arc3ApiClient.ts (220 lines)

**Location:** `server/services/arc3/Arc3ApiClient.ts`

Direct **HTTP wrapper** for the ARC-AGI-3 API.

#### Key Endpoints Wrapped

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/scorecard/open` | POST | Create a scorecard (required before games) |
| `/api/games` | GET | List all available games |
| `/api/cmd/RESET` | POST | Start/restart game, get initial frame |
| `/api/cmd/ACTION{1-7}` | POST | Execute action, get response frame(s) |

#### Response Normalization

The ARC API returns numeric action tokens; Arc3ApiClient normalizes them:
- `0` → `RESET`
- `1–6` → `ACTION1–6`
- `7` → `ACTION7` (Undo)

#### Frame Data Structure (from ARC API)

```typescript
interface FrameData {
  frames: Frame[];           // 1–N frames per action response
  state: 'NOT_FINISHED' | 'WIN' | 'GAME_OVER';
  score?: number;
  guid: string;              // Game session identifier
  available_actions: number[];
  action_counter: number;
  max_actions?: number;
  win_score?: number;
  // Layer support: both 3D and 4D arrays
  pixels?: number[][][];     // 3D: [layer][height][width]
                             // or [frameIdx][layer][height][width]
}
```

---

### 4. Persistence Layer

#### sessionManager.ts (234 lines)

**Location:** `server/services/arc3/persistence/sessionManager.ts`

**Arc3 Session CRUD operations.**

| Method | Purpose |
|--------|---------|
| `createSession(gameId, guid)` | Insert into arc3_sessions table |
| `getSessionById(id)` | Query by primary key |
| `getSessionByGuid(guid)` | Query by ARC API session GUID |
| `listSessions(gameId, limit)` | Paginated session history |
| `updateSessionState(id, state, score)` | Update final state/score |
| `deleteSession(id)` | Cascade delete frames |

#### framePersistence.ts (218 lines)

**Location:** `server/services/arc3/persistence/framePersistence.ts`

**Frame storage and querying.**

| Method | Purpose |
|--------|---------|
| `saveFrame(sessionId, frame, action, caption)` | Insert into arc3_frames |
| `loadFrame(sessionId, frameNumber)` | Query by session + index |
| `getFrameHistory(sessionId)` | Fetch all frames in order |
| `getPixelChanges(sessionId, frameNumber)` | Analyze diff from previous |
| `deleteFrames(sessionId)` | Clean up session history |

---

## Data Flow & Execution

### Starting a New Game

```mermaid
User Selection (game_id, model, system_prompt)
                    ↓
        POST /api/arc3/stream/prepare
                    ↓
        Arc3StreamService.createSession()
                    ↓
        Return sessionId to client
                    ↓
        GET /api/arc3/stream/:sessionId (EventSource)
                    ↓
        Arc3StreamService → Arc3RealGameRunner
                    ↓
        Arc3ApiClient.openScorecard()
                    ↓
        Arc3ApiClient.sendAction('RESET')
                    ↓
        Emit 'stream.init' + 'game.started' events
                    ↓
        Agent begins loop: inspect → reason → decide → action
                    ↓
        Stream events: agent.reasoning, game.frame_update, tool_call
                    ↓
        On WIN/GAME_OVER: emit agent.completed summary
```

### Game Continuation (Responses API Chaining)

```mermaid
User clicks "Continue Playing"
                    ↓
        Frontend sends: userMessage, previousResponseId, lastFrame
                    ↓
        POST /api/arc3/stream/:sessionId/continue
                    ↓
        Arc3StreamService.setSessionPayload()
                    ↓
        GET /api/arc3/stream/:sessionId/continue-stream
                    ↓
        Arc3RealGameRunner.runWithStreaming({
          existingGameGuid,
          lastFrame,
          previousResponseId  ← Passed to Responses API
        })
                    ↓
        Agent continues from game GUID + previous response context
                    ↓
        Responses API chains reasoning across turns
```

### Manual Action Injection (Hybrid Mode)

```mermaid
Agent paused or waiting
                    ↓
        User clicks ACTION1–6 button
                    ↓
        POST /api/arc3/manual-action
                    ↓
        Arc3RealGameRunner.actionTool() executes directly
                    ↓
        Arc3ApiClient.sendAction()
                    ↓
        Frame updates in-place
                    ↓
        Agent can be resumed or continue
```

---

## Key File Locations

### Backend Services

| File | Lines | Responsibility |
|------|-------|-----------------|
| [server/services/arc3/Arc3RealGameRunner.ts](../../server/services/arc3/Arc3RealGameRunner.ts) | 1007 | Agent orchestration, tools, game loop |
| [server/services/arc3/Arc3StreamService.ts](../../server/services/arc3/Arc3StreamService.ts) | 461 | SSE session management, event queuing |
| [server/services/arc3/Arc3ApiClient.ts](../../server/services/arc3/Arc3ApiClient.ts) | 224 | HTTP wrapper for ARC-AGI-3 API |
| [server/services/arc3/types.ts](../../server/services/arc3/types.ts) | 120+ | Type definitions (agent config, frame data, etc.) |
| [server/services/arc3/prompts.ts](../../server/services/arc3/prompts.ts) | 100+ | System prompt presets (Twitch, Playbook, Custom) |
| [server/services/arc3/persistence/sessionManager.ts](../../server/services/arc3/persistence/sessionManager.ts) | 234 | Session CRUD |
| [server/services/arc3/persistence/framePersistence.ts](../../server/services/arc3/persistence/framePersistence.ts) | 218 | Frame storage & querying |
| [server/services/arc3/helpers/frameAnalysis.ts](../../server/services/arc3/helpers/frameAnalysis.ts) | 150+ | Grid diff, pixel analysis |
| [server/services/arc3/helpers/captionGenerator.ts](../../server/services/arc3/helpers/captionGenerator.ts) | 80+ | Auto-generate action descriptions |
| [server/services/arc3/helpers/gridAnalyzer.ts](../../server/services/arc3/helpers/gridAnalyzer.ts) | 100+ | Python sandbox for grid analysis |

### Routes & Controllers

| File | Lines | Responsibility |
|------|-------|-----------------|
| [server/routes/arc3.ts](../../server/routes/arc3.ts) | 428 | All ARC-3 HTTP endpoints |

### Frontend Pages & Components

| File | Purpose |
|------|---------|
| [client/src/pages/ARC3AgentPlayground.tsx](../../client/src/pages/ARC3AgentPlayground.tsx) | Minimal UI for agent gameplay |
| [client/src/pages/Arc3GamesBrowser.tsx](../../client/src/pages/Arc3GamesBrowser.tsx) | Game list, discovery, metadata |
| [client/src/pages/Arc3GameSpoiler.tsx](../../client/src/pages/Arc3GameSpoiler.tsx) | Per-game documentation |
| [client/src/components/arc3/Arc3GridVisualization.tsx](../../client/src/components/arc3/Arc3GridVisualization.tsx) | Canvas-based grid rendering (0–15 colors) |
| [client/src/components/arc3/Arc3ConfigurationPanel.tsx](../../client/src/components/arc3/Arc3ConfigurationPanel.tsx) | Model & reasoning settings |
| [client/src/components/arc3/Arc3ReasoningViewer.tsx](../../client/src/components/arc3/Arc3ReasoningViewer.tsx) | Displays agent reasoning text |
| [client/src/components/arc3/Arc3ToolTimeline.tsx](../../client/src/components/arc3/Arc3ToolTimeline.tsx) | Chronological tool call log |
| [client/src/components/arc3/Arc3GamePanel.tsx](../../client/src/components/arc3/Arc3GamePanel.tsx) | Current game state & frame display |

### React Hooks

| File | Lines | Purpose |
|------|-------|---------|
| [client/src/hooks/useArc3AgentStream.ts](../../client/src/hooks/useArc3AgentStream.ts) | 600+ | SSE EventSource management + state accumulation |

### Shared Types & Configuration

| File | Purpose |
|------|---------|
| [shared/types.ts](../../shared/types.ts) | Global type definitions (exported by all services) |
| [shared/arc3Games.ts](../../shared/arc3Games.ts) | Centralized game metadata, mechanics, hints, screenshots |
| [shared/config/arc3Colors.ts](../../shared/config/arc3Colors.ts) | 16-color palette (0–15 → color names) |

### Database

| Table | Schema File |
|-------|-------------|
| `arc3_sessions` | [server/repositories/database/DatabaseSchema.ts](../../server/repositories/database/DatabaseSchema.ts) lines 244–268 |
| `arc3_frames` | [server/repositories/database/DatabaseSchema.ts](../../server/repositories/database/DatabaseSchema.ts) lines 270–288 |

---

## Database Schema

### arc3_sessions Table

```sql
CREATE TABLE arc3_sessions (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  guid VARCHAR(255) UNIQUE NOT NULL,
  state VARCHAR(50),  -- NOT_PLAYED|IN_PROGRESS|WIN|GAME_OVER
  final_score INT,
  win_score INT,
  total_frames INT,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Key Fields:**
- `guid`: ARC-AGI-3 API session identifier (returned from RESET command)
- `state`: Game outcome (NOT_PLAYED if never started, WIN/GAME_OVER if finished)
- `total_frames`: Count of frames generated by agent

### arc3_frames Table

```sql
CREATE TABLE arc3_frames (
  id SERIAL PRIMARY KEY,
  session_id INT REFERENCES arc3_sessions(id) ON DELETE CASCADE,
  frame_number INT NOT NULL,
  action_type VARCHAR(50),  -- RESET|ACTION1-6|ACTION7
  action_params JSONB,      -- {coordinates: [x, y]} for ACTION6
  caption TEXT,
  state VARCHAR(50),
  score INT,
  win_score INT,
  frame_data JSONB,         -- Full FrameData from API
  pixels_changed INT,       -- Diff count
  timestamp TIMESTAMP DEFAULT NOW(),
  UNIQUE(session_id, frame_number)
);
```

**Key Fields:**
- `session_id`: Foreign key to arc3_sessions
- `frame_number`: Index in session sequence (0, 1, 2, ...)
- `action_type`: Action that produced this frame
- `action_params`: For ACTION6, contains `{ coordinates: [x, y] }`
- `frame_data`: Full API response (pixels, state, available_actions, etc.)
- `pixels_changed`: Diff from previous frame (helps identify no-ops)

---

## Frontend Integration

### useArc3AgentStream Hook (600+ lines)

**Location:** `client/src/hooks/useArc3AgentStream.ts`

Manages **EventSource subscription** and **state accumulation** for streaming agent runs.

#### Key State Variables

```typescript
const [frames, setFrames] = useState<Arc3FrameSnapshot[]>([]);
const [timeline, setTimeline] = useState<Arc3RunTimelineEntry[]>([]);
const [reasoning, setReasoning] = useState<string>('');
const [gameGuid, setGameGuid] = useState<string | null>(null);
const [sessionId, setSessionId] = useState<string>('');
const [lastResponseId, setLastResponseId] = useState<string | null>(null);
```

#### Hook Methods

| Method | Purpose |
|--------|---------|
| `startStream(gameId, config)` | Open EventSource, begin SSE subscription |
| `sendManualAction(action, params)` | Inject action while paused |
| `continueStream(userMessage)` | Resume with Responses API chaining |
| `cancelStream()` | Close EventSource and cleanup |
| `getRunSummary()` | Return final stats (frames, score, efficiency) |

#### Event Handler Pattern

```typescript
useEffect(() => {
  if (!eventSource) return;

  eventSource.addEventListener('stream.init', (e) => {
    const { sessionId, gameId } = JSON.parse(e.data);
    setSessionId(sessionId);
  });

  eventSource.addEventListener('agent.reasoning', (e) => {
    const { delta } = JSON.parse(e.data);
    setReasoning(prev => prev + delta);
  });

  eventSource.addEventListener('game.frame_update', (e) => {
    const frame = JSON.parse(e.data);
    setFrames(prev => [...prev, frame]);
  });

  eventSource.addEventListener('agent.completed', (e) => {
    const { summary } = JSON.parse(e.data);
    setGameGuid(summary.gameGuid);
    setLastResponseId(summary.providerResponseId);
    closeStream();
  });
}, [eventSource]);
```

#### Race Condition Prevention

```typescript
// Synchronous refs prevent race conditions between threads
const gameGuidRef = useRef<string | null>(null);
const sessionIdRef = useRef<string>('');

// When continuing, use refs to ensure guid/sessionId are current
const continueStream = useCallback(async (userMessage: string) => {
  const response = await fetch(`/api/arc3/stream/${sessionIdRef.current}/continue`, {
    method: 'POST',
    body: JSON.stringify({
      userMessage,
      previousResponseId: lastResponseId,
      lastFrame: frames[frames.length - 1]
    })
  });
  // ...
}, []);
```

---

## Common Tasks

### Adding a New System Prompt Preset

**Files to modify:**
1. [server/services/arc3/prompts.ts](../../server/services/arc3/prompts.ts)
2. [server/routes/arc3.ts](../../server/routes/arc3.ts) (endpoint validation)

**Steps:**

```typescript
// In prompts.ts, add new preset:
export const systemPrompts: Record<string, SystemPromptPreset> = {
  'my-custom-preset': {
    id: 'my-custom-preset',
    name: 'My Custom Agent',
    description: 'A specialized agent for...',
    systemPrompt: `You are a specialized ARC-AGI-3 agent...`,
    category: 'custom'
  },
  // ... existing presets
};

// In routes/arc3.ts, update validation:
const systemPromptId = z.enum(['twitch', 'playbook', 'none', 'my-custom-preset'])
  .parse(req.body.systemPromptId);
```

### Integrating a New Model

**Files to modify:**
1. [server/config/models.ts](../../server/config/models.ts) (add model config)
2. [server/services/arc3/Arc3RealGameRunner.ts](../../server/services/arc3/Arc3RealGameRunner.ts) (optional tool adjustments)

**Steps:**

```typescript
// In models.ts, add model:
export const models = [
  // ...
  {
    key: 'openai/gpt-5-streaming',
    apiModelName: 'gpt-5-streaming',
    name: 'GPT-5 Streaming',
    provider: 'openai',
    supportsResponses: true,
    supportsStreaming: true,
    maxTokens: 200000,
    reasoning: {
      supported: true,
      effortLevels: ['low', 'medium', 'high']
    }
  },
  // ... your new model
];

// In Arc3RealGameRunner, model is passed via config:
const agent = new Agent({
  model: config.model, // Already selected from models.ts
  // ...
});
```

### Adding a New Tool to the Agent

**File to modify:** [server/services/arc3/Arc3RealGameRunner.ts](../../server/services/arc3/Arc3RealGameRunner.ts)

**Pattern:**

```typescript
// 1. Define the tool using OpenAI Agents SDK tool() helper
import { tool } from '@openai/agents';

const myNewTool = tool({
  name: 'my_tool_name',
  description: 'What this tool does for the agent',
  parameters: z.object({
    param1: z.string().describe('Parameter 1'),
    param2: z.number().describe('Parameter 2')
  }),
  async execute({ param1, param2 }) {
    // Implementation
    return { result: '...' };
  }
});

// 2. Add to agent tools array:
const agent = new Agent({
  tools: [
    inspectGameStateTool,
    analyzeGridTool,
    resetGameTool,
    action1Tool,
    // ... other tools
    myNewTool  // ← Add here
  ]
});
```

### Extending Frame Analysis

**File to modify:** [server/services/arc3/helpers/frameAnalysis.ts](../../server/services/arc3/helpers/frameAnalysis.ts)

**Example: Add symmetry detection**

```typescript
export function detectSymmetry(grid: number[][]): SymmetryType {
  const height = grid.length;
  const width = grid[0].length;

  // Check vertical symmetry
  // Check horizontal symmetry
  // Check rotational symmetry
  // Return SymmetryType enum
}

// Use in Arc3RealGameRunner.analyzeGridTool():
const analysis = {
  connected_components: ...,
  symmetry: detectSymmetry(grid),
  bounding_boxes: ...
};
```

---

## Patterns & Best Practices

### 1. Session Continuation Safety

**Pattern:** Always cache the last frame before allowing continuations.

```typescript
// ❌ Bad: loses frame data
async function continueGame(sessionId: string, message: string) {
  const response = await runWithStreaming(message, {
    existingGameGuid: gameGuid  // What about the current frame state?
  });
}

// ✅ Good: preserves frame continuity
async function continueGame(sessionId: string, message: string) {
  const lastFrame = frames[frames.length - 1];
  const response = await runWithStreaming(message, {
    existingGameGuid: gameGuid,
    lastFrame,  // ← Required for safety
    previousResponseId: lastResponseId
  });
}
```

### 2. Responses API Chaining

**Pattern:** Only chain within the same provider.

```typescript
// ❌ Bad: mixing providers
const result1 = await openai.responses.create(...);
const responseId = result1.id;  // OpenAI response ID

const result2 = await xai.responses.create({
  previous_response_id: responseId  // ← WRONG provider!
});

// ✅ Good: consistent provider
const result1 = await openai.responses.create(...);
const responseId = result1.id;

const result2 = await openai.responses.create({
  previous_response_id: responseId  // ← Same provider
});
```

### 3. Reasoning Effort Configuration

**Pattern:** Set appropriate reasoning effort based on game complexity.

```typescript
const config = {
  model: 'gpt-5-streaming',
  reasoning: {
    effort: 'high',  // For complex games (ls20)
    summary: 'detailed',
    maxOutputTokens: 16000  // Let reasoning flow
  }
};

// For simpler games:
const config = {
  reasoning: {
    effort: 'medium',  // Faster for easier games (ft09)
    summary: 'basic'
  }
};
```

### 4. State Collapse During Execution

**Pattern:** Hide UI controls once streaming starts.

```typescript
// In component render:
return (
  <div>
    {isRunning ? (
      <>
        {/* Only show live feedback during execution */}
        <Arc3GridVisualization frames={frames} />
        <Arc3ReasoningViewer reasoning={reasoning} />
        <Arc3ToolTimeline timeline={timeline} />
      </>
    ) : (
      <>
        {/* Show controls before execution */}
        <Arc3ConfigurationPanel />
        <Arc3GameSelector />
        <button onClick={startStream}>Start Agent</button>
      </>
    )}
  </div>
);
```

### 5. Action Validation

**Pattern:** Validate actions at the boundary (route/service layer).

```typescript
// ❌ Bad: silent failure
async sendAction(action: string, x?: number, y?: number) {
  return await apiClient.sendAction(action, { x, y });
}

// ✅ Good: validate before sending
async sendAction(action: string, x?: number, y?: number) {
  if (action === 'ACTION6') {
    if (x === undefined || y === undefined) {
      throw new Error('ACTION6 requires coordinates');
    }
    if (x < 0 || x > 63 || y < 0 || y > 63) {
      throw new Error('Coordinates must be in range [0, 63]');
    }
  }
  return await apiClient.sendAction(action, { x, y });
}
```

---

## Debugging & Troubleshooting

### Common Issues

#### 1. Scorecard Auto-Closes Before Run Completes

**Symptom:** "Scorecard expired" error mid-game

**Cause:** ARC-AGI-3 API scorecards auto-close after ~15 minutes. Long exploration exhausts time.

**Solution:** Implement scorecard refresh or wrap long runs in multiple shorter scorecards.

```typescript
async function refreshScorecard(sessionId: string) {
  const newCardId = await apiClient.openScorecard();
  await sessionManager.updateScorecard(sessionId, newCardId);
}
```

#### 2. ACTION6 Coordinates Out of Bounds

**Symptom:** "Invalid coordinates" 400 error from ARC API

**Cause:** Grid is 64×64 but coordinates passed are > 63.

**Solution:** Validate and clamp coordinates.

```typescript
function validateCoordinates(x: number, y: number) {
  if (x < 0 || x > 63 || y < 0 || y > 63) {
    throw new Error(`Coordinates out of bounds: (${x}, ${y})`);
  }
}
```

#### 3. Frames Not Persisting to Database

**Symptom:** Sessions exist but no frames in arc3_frames table

**Cause:** Foreign key constraint or session not in database.

**Solution:** Check session exists before saving frames.

```typescript
async function saveFrame(sessionId: number, frameData: FrameData) {
  const session = await sessionManager.getSessionById(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  await framePersistence.saveFrame(sessionId, frameData);
}
```

#### 4. SSE Connection Drops Mid-Stream

**Symptom:** Agent reasoning stops appearing in UI

**Cause:** Long-running agent (>30s) or network timeout

**Solution:** Increase timeout in useArc3AgentStream and implement reconnect logic.

```typescript
const eventSource = new EventSource(
  `/api/arc3/stream/${sessionId}`,
  { withCredentials: true }
);

eventSource.addEventListener('error', () => {
  // Reconnect with lastFrame for safety
  continueStream('Resume');
});
```

### Debugging Tools

#### 1. PostgreSQL Inspection

```sql
-- Check recent sessions
SELECT id, game_id, guid, state, total_frames, started_at
FROM arc3_sessions
ORDER BY started_at DESC
LIMIT 10;

-- Check frames for a session
SELECT frame_number, action_type, state, pixels_changed
FROM arc3_frames
WHERE session_id = ?
ORDER BY frame_number;
```

#### 2. Network Inspection

- Open DevTools → Network tab
- Filter by `/api/arc3/stream`
- Inspect EventSource messages in real-time

#### 3. Agent Reasoning Logs

```typescript
// In Arc3RealGameRunner.runWithStreaming():
console.log('Agent thinking:', reasoning);
console.log('Tool call:', toolName, params);
console.log('Frame delta:', pixelsChanged);
```

---

## Future Extensions

### 1. Multi-Agent Swarms

Extend Arc3StreamService to coordinate multiple agents on the same game (consensus voting, divide-and-conquer).

### 2. Offline Simulator

Local ARC-AGI-3 engine (currently discussed in ARC docs). Would eliminate API rate limits and enable fast training loops.

### 3. Agent Skill Transfer

Learn skills from completed games and reuse on similar games (e.g., transfer locomotion from ls20 → future navigation games).

### 4. Interactive Debugging UI

Break-and-inspect mode: pause agent, allow human to inject actions, resume agent with updated context.

### 5. Replay Rendering

MP4 video generation from frame sequences with agent commentary overlay.

---

## Glossary

| Term | Definition |
|------|-----------|
| **Scorecard** | ARC-AGI-3 API session tracking object; must be opened before playing games |
| **GUID** | Unique game session identifier returned by ARC API RESET command |
| **Frame** | Observation from environment after an action (grid + metadata) |
| **Tool** | Agent-callable function (inspect_game_state, analyze_grid, ACTION1-6, etc.) |
| **Tool Call** | Agent decides to use a tool and specifies parameters |
| **Tool Result** | Output from tool execution; agent uses to inform next decision |
| **Responses API** | OpenAI endpoint for reasoning models (vs Chat Completions API) |
| **Reasoning Deltas** | Incremental pieces of agent thinking streamed during inference |
| **State Collapse** | UI hiding controls/options during execution to focus user on live feedback |
| **SSE** | Server-Sent Events (one-way streaming from server → browser) |
| **EventSource** | Browser API for subscribing to SSE streams |
| **Action Efficiency** | Score = (human baseline actions) / (agent actions) |

---

## References

- [ARC3.md](./ARC3.md) — ARC-AGI-3 specification and benchmark details
- [docs/DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md) — General development setup
- [docs/reference/api/ResponsesAPI.md](../api/ResponsesAPI.md) — Responses API details
- [docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md](../api/OpenAI_Responses_API_Streaming_Implementation.md) — Streaming patterns

---

**Last Updated:** 2025-12-20
**Status:** Current
**Maintainer:** Development Team
