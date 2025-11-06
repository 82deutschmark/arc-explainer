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

### Phase 2: Streaming Infrastructure ALREADY EXISTS IN THE PROJECT!!!  Look at how the other Streaming services are implemented and match their logic exactly!!!!
**Tasks**:
1. Create `Arc3StreamingService.ts` - SSE events
2. Add streaming to runner - OpenAI Agents SDK streaming
3. Add `/stream` endpoint

**Files**:
```
✨ NEW: server/services/arc3/Arc3StreamingService.ts
🔧 MOD: server/services/arc3/Arc3RealGameRunner.ts
```

### Phase 3: POORLY NAMED!!  MUST REFERENCE ARC3  These grids are totally different from the ARC 1&2 grids!!!
**Tasks**:
1. Create `ARC3GridVisualization.tsx` - Canvas renderer
2. Port color mapping from Python reference
3. Add legend and stats

**Files**:
```
✨ NEW: client/src/components/arc3/GridVisualization.tsx
✨ NEW: client/src/utils/arc3Colors.ts
```

### Phase 4: Streaming Chat UI (Needs to be sourced directly from the openai-chatkit-advanced-samples project)
**Tasks**:
1. ????
2. ????
3. Add message types (reasoning, tool calls, results)

**Files**:
```
???
```

### Phase 5: Complete Page Rewrite (3 hours)
**Tasks**:
1. ????
2. Create NEW page with all components
3. Add game selection and config panel (config panel should reuse existing logic or components from elsewhere in the project!!!)

**Files**:
```

✨ NEW: client/src/pages/ARC3AgentPlayground.tsx (NEW)
✨ NEW: client/src/components/arc3/AgentConfigPanel.tsx (Code Already exists elsewhere!!!)
✨ NEW: client/src/components/arc3/GameBrowser.tsx
```

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

### Use Responses API for Reasoning  YOU WILL NEED TO REREAD THE DOCS ON THE RESPONSES API AND THE AGENTS SDK TO UNDERSTAND HOW TO USE IT PROPERLY!!!  DO NOT PROCEED WITH THIS TASK UNLESS YOU HAVE READ AND UNDERSTOOD THE DOCS and have the user confirm that you understand how to use it!!!
```typescript
const response = await openai.responses.create({
  model: "gpt-5-nano",
  input: messages,
  reasoning: { effort: "high", verbosity: "high", summary: "detailed" },
  previous_response_id: lastResponseId,  // Stateful!
  stream: true
});
```

**Why**: Preserves reasoning state between turns (critical for multi-turn games)

---

## 6. Environment Setup  (THINK HARDER!!  This is a production app, we store env vars on railway)

```bash
# .env
ARC_API_KEY=your_key_from_three.arcprize.org
OPENAI_API_KEY=your_openai_key
```

---

## 7. File Structure Summary

### Files to Create (14 new files)
```
server/services/arc3/Arc3ApiClient.ts
?????
client/src/utils/arc3Colors.ts
```

### Files to Modify (2 files)
```
server/routes/arc3.ts
.env.example
```

### Files to Rewrite (1 file)
```
client/src/pages/ARC3AgentPlayground.tsx  # COMPLETE REWRITE
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


