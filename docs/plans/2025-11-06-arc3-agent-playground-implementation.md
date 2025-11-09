# ARC-AGI-3 Agent Playground Implementation Plan

**Author**: Claude (Windsurf Cascade)  
**Date**: 2025-11-06  
**Status**: Planning  
**Priority**: High  

## Executive Summary

Transform the ARC3 Agent Playground from a toy simulator into a full-featured chat interface where users can watch OpenAI Agents SDK agents attempt to solve REAL ARC-AGI-3 games (like ls20). Users customize agent instructions, see streaming gameplay, and compete for optimal prompt strategies.

---

## 1. Understanding ARC-AGI-3

### What Is ARC-AGI-3?
- **Competition**: Abstraction and Reasoning Corpus (https://three.arcprize.org/)
- **Format**: Grid-based puzzle games requiring pattern recognition and reasoning
- **Games**: Various scenarios (ls20 = "LockSmith", plus 100+ others)
- **API**: RESTful API requiring API key for game interaction
- **Goal**: Agents must learn game rules through experimentation and solve puzzles

### Game Mechanics
- **FrameData**: 3D array representing game state (grids of integers 0-15)
- **Actions**: RESET, ACTION1-7 (simple moves + coordinate-based ACTION6)
- **States**: NOT_PLAYED → IN_PROGRESS → WIN/GAME_OVER
- **Scoring**: 0-254 points, tracks performance
- **Max Actions**: Typically 400 turns per game

---

## 2. Current State Analysis

### Existing Backend (✅ Works but toy only)
- `Arc3GameSimulator.ts` - Fake "Color Hunt" game
- `Arc3AgentRunner.ts` - OpenAI Agents SDK runner
- **Problem**: No real ARC-AGI-3 API integration

### Existing Frontend (❌ Complete garbage)
- `ARC3AgentPlayground.tsx` - Marked as "SLOP"
- **Problem**: Mock/placeholder implementation, needs complete rewrite

---

## 3. Architecture Design

### 3.1 Backend Services

#### NEW: `Arc3ApiClient.ts`
```typescript
class Arc3ApiClient {
  constructor(apiKey: string);
  async listGames(): Promise<GameInfo[]>;
  async startGame(gameId: string): Promise<FrameData>;
  async executeAction(guid: string, action: GameAction): Promise<FrameData>;
  async getStatus(guid: string): Promise<GameStatus>;
}
```

#### ENHANCED: `Arc3RealGameRunner.ts`
```typescript
class Arc3RealGameRunner {
  constructor(apiClient: Arc3ApiClient);
  async runWithStreaming(
    config: Arc3AgentConfig,
    onEvent: (event: StreamEvent) => void
  ): Promise<Arc3AgentRunResult>;
}
```

#### NEW: `Arc3StreamingService.ts`
```typescript
class Arc3StreamingService {
  async streamAgentRun(config: Arc3AgentConfig, res: Response): Promise<void>;
}
```

### 3.2 API Routes

```
GET  /api/arc3/games                          # List games
POST /api/arc3/agent-playground/run           # Non-streaming
POST /api/arc3/agent-playground/stream        # NEW: SSE streaming
```

### 3.3 Frontend Components

#### Complete Rewrite: `ARC3AgentPlayground.tsx`
```
┌───────────────────────────────────────────────────┐
│ ARC-AGI-3 Agent Playground                        │
├───────────────────────────────────────────────────┤
│ [Game Selection] [Agent Config Panel] [Start Run] │
├───────────────────────────────────────────────────┤
│ ┌─────────────────┐  ┌──────────────────────────┐│
│ │ Grid Viz        │  │ Streaming Chat           ││
│ │ [8x8 colored]   │  │ 🤖 Analyzing grid...     ││
│ │ Score: 42       │  │ 🔧 Called ACTION1        ││
│ │ Actions: 5/24   │  │ ✅ Row scanner active    ││
│ └─────────────────┘  └──────────────────────────┘│
└───────────────────────────────────────────────────┘
```

#### NEW Components:
- `GridVisualization.tsx` - Colored grid renderer
- `StreamingChat.tsx` - Real-time chat interface
- `AgentConfigPanel.tsx` - Instructions + settings
- `GameBrowser.tsx` - Game selection
- `useArc3Streaming.ts` - SSE hook

---

## 4. Implementation Phases

### Phase 1: Backend Foundation (2-3 hours)
**Tasks**:
1. Create `Arc3ApiClient.ts` - HTTP client for three.arcprize.org
2. Update `Arc3AgentRunner.ts` - Use real API
3. Add routes for game list

**Files**:
```
✨ NEW: server/services/arc3/Arc3ApiClient.ts
✨ NEW: server/services/arc3/Arc3RealGameRunner.ts
🔧 MOD: server/routes/arc3.ts
ARC3_API_KEY="de61d386-c2e7-4c0f-9546-511c505a4381"  is in .env.example already!!!
```

### Phase 2: Integrate with Existing Streaming Infrastructure (1-2 hours)
**Pattern**: Follow `analysisStreamService.ts` + `SSEStreamManager.ts` pattern

**Tasks**:
1. Create `arc3StreamService.ts` matching `analysisStreamService.ts` structure
   - Use existing `SSEStreamManager` singleton (no new manager needed!)
   - Implement prepare/start pattern: POST creates session → GET streams via sessionId
   - Use same event types: `stream.init`, `stream.chunk`, `stream.status`, `stream.complete`
2. Update `Arc3RealGameRunner.ts` to emit events via `sseStreamManager.sendEvent()`
3. Add routes matching existing pattern:
   - POST `/api/arc3/stream/prepare` → returns sessionId
   - GET `/api/arc3/stream/:gameId/:sessionId` → SSE stream
   - POST `/api/arc3/stream/cancel/:sessionId` → abort

**Files**:
```
✨ NEW: server/services/arc3/arc3StreamService.ts
🔧 MOD: server/services/arc3/Arc3RealGameRunner.ts
🔧 MOD: server/routes/arc3.ts
```

**Reference Files** (DO NOT MODIFY, STUDY ONLY):
```
server/services/streaming/SSEStreamManager.ts
server/services/streaming/analysisStreamService.ts
server/controllers/streamController.ts
```

### Phase 3: ARC3 Grid Visualization (1-2 hours)
**Important**: ARC-AGI-3 grids are different from ARC1/2! Use different color palette.

**Tasks**:
1. Create `Arc3GridVisualization.tsx` - Canvas-based renderer for 0-15 integer cells
2. Port color mapping from `external/ARC3-solution/custom_agents/view_utils.py` (lines 7-24)
3. Add `Arc3GridLegend.tsx` showing color meanings
4. Add game stats display (score, actions, state)

**Files**:
```
✨ NEW: client/src/components/arc3/Arc3GridVisualization.tsx
✨ NEW: client/src/components/arc3/Arc3GridLegend.tsx
✨ NEW: client/src/utils/arc3Colors.ts
```

**Color Palette** (from Python reference):
```typescript
export const ARC3_COLORS: Record<number, string> = {
  0: '#FFFFFF', 1: '#CCCCCC', 2: '#999999', 3: '#666666',
  4: '#333333', 5: '#000000', 6: '#E53AA3', 7: '#FF7BCC',
  8: '#F93C31', 9: '#1E93FF', 10: '#88D8F1', 11: '#FFDC00',
  12: '#FF851B', 13: '#921231', 14: '#4FCC30', 15: '#A356D6'
};
```

### Phase 4: Client-Side Streaming Hook (2 hours)
**Pattern**: Follow `useSaturnProgress.ts` pattern exactly

**Tasks**:
1. Create `useArc3AgentStream.ts` hook matching `useSaturnProgress` structure:
   - State management for status, messages, frames, errors
   - SSE connection via EventSource
   - Event handlers for init/chunk/status/complete/error
   - Cleanup on unmount
2. Use existing `client/src/lib/streaming/analysisStream.ts` helpers
3. Handle OpenAI Agents SDK event types:
   - `agent_thinking` → reasoning display
   - `tool_call` → action execution
   - `tool_result` → game response
   - `frame_update` → grid state change

**Files**:
```
✨ NEW: client/src/hooks/useArc3AgentStream.ts
```

**Reference Files** (STUDY PATTERN):
```
client/src/hooks/useSaturnProgress.ts (lines 1-200)
client/src/lib/streaming/analysisStream.ts
```

### Phase 5: Frontend Integration (3-4 hours)
**Tasks**:
1. Rewrite `ARC3AgentPlayground.tsx` with proper integration:
   - Use `useArc3AgentStream` hook
   - Render `Arc3GridVisualization` with live game state
   - Display streaming chat messages
   - Show agent configuration panel
2. Create `Arc3AgentConfigPanel.tsx` adapting patterns from:
   - `components/model-examiner/ExaminerConfigPanel.tsx` (model selection)
   - `components/puzzle/PromptConfiguration.tsx` (instructions)
3. Create `Arc3GameSelector.tsx` for game browsing
4. Create `Arc3ChatTimeline.tsx` for message display

**Files**:
```
🔧 REWRITE: client/src/pages/ARC3AgentPlayground.tsx
✨ NEW: client/src/components/arc3/Arc3AgentConfigPanel.tsx
✨ NEW: client/src/components/arc3/Arc3GameSelector.tsx
✨ NEW: client/src/components/arc3/Arc3ChatTimeline.tsx
✨ NEW: client/src/components/arc3/Arc3MessageBubble.tsx
```

**UI Layout** (Use DaisyUI/shadcn components):
- Left sidebar: Game selector + Config panel
- Center: Arc3GridVisualization + Game stats
- Right: Arc3ChatTimeline with streaming messages

---

## 5. Key Technical Decisions

### Use OpenAI Agents SDK (TypeScript)
- ✅ Full-stack TypeScript
- ✅ Built-in streaming
- ✅ Responses API support

### Use Server-Sent Events (SSE)
- ✅ Simpler than WebSockets
- ✅ One-way server → client
- ✅ Auto-reconnection

### Use Responses API for Reasoning

**CRITICAL**: OpenAI Agents SDK uses Responses API internally. We must:
1. Configure agent with proper reasoning settings
2. Capture `response.id` from SDK events for conversation chaining
3. Pass `previous_response_id` via SDK configuration

**SDK Configuration** (NOT direct API calls):
```typescript
const agent = new Agent({
  name: 'ARC3 Player',
  model: 'gpt-5-nano',
  instructions: userInstructions,
  tools: [inspectTool, actionTools...],
});

const result = await run(agent, initialPrompt, {
  maxTurns: 24,
  stream: true,
  // Responses API settings passed through SDK:
  modelOptions: {
    reasoning: {
      effort: 'high',
      verbosity: 'high',
      summary: 'detailed'
    },
    previous_response_id: lastResponseId,
    max_output_tokens: 16920
  }
});
```

**Why Critical**: 
- Preserves reasoning state between turns (essential for multi-turn puzzles)
- Allows agent to build on previous observations
- Captures reasoning tokens separately for cost tracking

**Required Reading Before Implementation**:
- `docs/reference/api/ResponsesAPI.md` (complete file)
- `docs/reference/api/OpenAI_Responses_API_Streaming_Implementation.md`
- `external/openai-agents-js/README.md` (streaming section)
- `docs/reference/HowAgentsWork.md` (ReasoningAgent section, lines 217-254)

---

## 6. Environment Setup

**Development** (.env.local):
```bash
ARC3_API_KEY=de61d386-c2e7-4c0f-9546-511c505a4381  # Already in .env.example
OPENAI_API_KEY=your_openai_key
STREAMING_ENABLED=true  # Already configured
```

**Production** (Railway):
- Environment variables already configured on Railway
- No .env file changes needed for deployment
- `ARC3_API_KEY` already set in Railway dashboard

---

## 7. File Structure Summary

### Files to Create (~10-12 new files)
**Backend**:
```
server/services/arc3/Arc3ApiClient.ts
server/services/arc3/Arc3RealGameRunner.ts
server/services/arc3/arc3StreamService.ts
```

**Frontend**:
```
client/src/hooks/useArc3AgentStream.ts
client/src/components/arc3/Arc3GridVisualization.tsx
client/src/components/arc3/Arc3GridLegend.tsx
client/src/components/arc3/Arc3AgentConfigPanel.tsx
client/src/components/arc3/Arc3GameSelector.tsx
client/src/components/arc3/Arc3ChatTimeline.tsx
client/src/components/arc3/Arc3MessageBubble.tsx
client/src/utils/arc3Colors.ts
```

### Files to Modify
```
server/routes/arc3.ts (add streaming routes)
client/src/pages/ARC3AgentPlayground.tsx (complete rewrite)
```

### Reference Files (DO NOT MODIFY - STUDY ONLY)
**Streaming Patterns**:
```
server/services/streaming/SSEStreamManager.ts
server/services/streaming/analysisStreamService.ts
server/controllers/streamController.ts
client/src/hooks/useSaturnProgress.ts
client/src/lib/streaming/analysisStream.ts
```

**Config Panel Patterns**:
```
client/src/components/model-examiner/ExaminerConfigPanel.tsx
client/src/components/puzzle/PromptConfiguration.tsx
```

---

## 8. Success Criteria

### MVP
- ✅ Connect to real ARC-AGI-3 API
- ✅ Start ls20 game
- ✅ Agent executes actions
- ✅ Grid renders correctly
- ✅ Chat shows output
- ✅ Streaming works
- ✅ Users can start and customize instructions
- ✅ Multiple games supported
- ✅ Beautiful UI with Shadcn/UI


## 10. Reference Documentation

- ARC-AGI-3 API: https://three.arcprize.org/docs
- OpenAI Agents SDK: `external/openai-agents-js/README.md`
- Responses API: `docs/reference/api/ResponsesAPI.md`
- How Agents Work: `docs/reference/HowAgentsWork.md`
- Python Reference: `external/ARC3-solution/`
- OpenAI ChatKit Advanced Samples: `external/openai-chatkit-advanced-samples/`
- Python Agent Template: `external/ARC3-solution/ARC-AGI-3-Agents/agents/templates/reasoning_agent.py` 
- Python Agent Template: `external/ARC3-solution/ARC-AGI-3-Agents/agents/templates/llm_agent.py` 


