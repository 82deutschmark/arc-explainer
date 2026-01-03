# ARC3 OpenRouter Integration Plan

**Author:** Cascade  
**Date:** 2026-01-02  
**Status:** APPROVED FOR IMPLEMENTATION  
**Model:** `xiaomi/mimo-v2-flash:free` via OpenRouter  

---

## Overview

Integrate OpenRouter as an alternative LLM provider for ARC3 Agent Playground using the LangGraph thinking agent pattern from `external/ARC-AGI-3-Agents2/`. This enables users to play ARC-AGI-3 games with free/low-cost models via OpenRouter.

**Key Insight:** This is NOT about "solving" games - it's about **playing and discovering rules**. The agent explores, learns, and adapts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                             │
│  useArc3AgentStream.ts → provider='openrouter' → /api/arc3-openrouter│
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Backend (TypeScript/Express)                     │
│  arc3OpenRouter.ts routes → Arc3OpenRouterStreamService.ts          │
│       │                              │                               │
│       ▼                              ▼                               │
│  Arc3OpenRouterPythonBridge.ts ──► spawn Python subprocess          │
│       │                              │                               │
│       └── stdin: JSON payload        └── stdout: NDJSON events      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Python Runner (LangGraph)                         │
│  server/python/arc3_openrouter_runner.py                            │
│       │                                                              │
│       ├── Uses LangGraph thinking agent pattern                      │
│       ├── ChatOpenAI with openai_api_base=OpenRouter                │
│       ├── Model: xiaomi/mimo-v2-flash:free                          │
│       └── Emits NDJSON events to stdout                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ARC3 API (three.arcprize.org)                   │
│  /api/scorecards, /api/games, /api/action                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Event Flow (NDJSON Protocol)

Python emits JSON objects (one per line) that TypeScript parses and forwards as SSE events:

```json
{"type": "agent.starting", "message": "Initializing LangGraph agent..."}
{"type": "agent.ready", "model": "xiaomi/mimo-v2-flash:free"}
{"type": "game.frame_update", "frame": {...}, "turn": 1}
{"type": "agent.tool_call", "tool": "ACTION1", "reasoning": "..."}
{"type": "agent.tool_result", "result": "Action executed"}
{"type": "agent.reasoning", "content": "Analyzing frame delta..."}
{"type": "agent.completed", "finalState": "WIN", "totalTurns": 15}
```

**Critical:** These events MUST match what the frontend expects (same as Arc3RealGameRunner).

---

## Files to Create

### 1. Python Runner: `server/python/arc3_openrouter_runner.py`

```python
#!/usr/bin/env python3
"""
ARC3 OpenRouter Runner using LangGraph Thinking Agent pattern.
Reads JSON config from stdin, emits NDJSON events to stdout.
Model: xiaomi/mimo-v2-flash:free
"""
import sys
import json
from langchain_openai import ChatOpenAI
# ... LangGraph workflow implementation
```

**Key features:**
- Reads config from stdin (game_id, model, instructions, apiKey)
- Uses `ChatOpenAI(openai_api_base="https://openrouter.ai/api/v1", model="xiaomi/mimo-v2-flash:free")`
- Implements LangGraph workflow: init → check_key → analyze_frame_delta → act
- Emits NDJSON events to stdout for each step
- Handles ARC3 API calls (open scorecard, start game, execute action)

### 2. TypeScript Bridge: `server/services/arc3/Arc3OpenRouterPythonBridge.ts`

```typescript
/**
 * Spawn Python subprocess for OpenRouter agent.
 * Pattern: SnakeBenchPythonBridge
 */
export class Arc3OpenRouterPythonBridge {
  async spawnAgent(
    payload: Arc3OpenRouterPayload,
    onStdoutLine: (line: string) => void,
    onStderrLine: (line: string) => void
  ): Promise<{ stdout: string; stderr: string; code: number | null }>
}
```

### 3. Stream Service: `server/services/arc3/Arc3OpenRouterStreamService.ts`

```typescript
/**
 * Session management + SSE emission for OpenRouter agent.
 * Pattern: Arc3StreamService (existing)
 */
export class Arc3OpenRouterStreamService {
  savePayload(payload): string  // Returns sessionId
  startStreaming(req, payload): Promise<void>
  cancel(sessionId): void
}
```

### 4. Routes: `server/routes/arc3OpenRouter.ts`

```typescript
// POST /api/arc3-openrouter/stream/prepare
// GET  /api/arc3-openrouter/stream/:sessionId
// POST /api/arc3-openrouter/stream/cancel/:sessionId
// GET  /api/arc3-openrouter/health
```

---

## LangGraph Integration Details

### Using OpenRouter with LangChain

```python
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="xiaomi/mimo-v2-flash:free",
    openai_api_base="https://openrouter.ai/api/v1",
    openai_api_key=os.getenv("OPENROUTER_API_KEY"),
    default_headers={
        "HTTP-Referer": "https://arc-explainer.com",
        "X-Title": "ARC Explainer"
    }
)
```

### Workflow Nodes (from LangGraph thinking agent)

1. **init** - Check game state, reset if needed
2. **check_key** - Vision analysis of key/door match (multimodal)
3. **analyze_frame_delta** - Compare frames, detect changes
4. **act** - Choose action using tools + LLM reasoning

### Event Emission Pattern

```python
def emit_event(event_type: str, data: dict):
    """Emit NDJSON event to stdout for TypeScript to parse."""
    event = {"type": event_type, **data}
    print(json.dumps(event), flush=True)

# Usage in workflow nodes:
emit_event("agent.starting", {"message": "Initializing..."})
emit_event("agent.tool_call", {"tool": "ACTION1", "reasoning": "..."})
emit_event("game.frame_update", {"frame": frame_data, "turn": turn})
```

---

## Frontend Integration

### Provider Selection in `useArc3AgentStream.ts`

```typescript
// Line ~136: Add OpenRouter path
const apiBasePath = options.provider === 'openrouter' 
  ? '/api/arc3-openrouter'
  : '/api/arc3';  // Default to existing working routes
```

### ARC3AgentPlayground.tsx Provider Dropdown

Add `openrouter` option to provider selection with model `xiaomi/mimo-v2-flash:free`.

---

## Implementation Phases

### Phase 1: Python Runner (2 hours)
- [ ] Create `server/python/arc3_openrouter_runner.py`
- [ ] Implement LangGraph workflow with OpenRouter
- [ ] Add NDJSON event emission
- [ ] Test standalone: `echo '{"game_id":"ls20"}' | python arc3_openrouter_runner.py`

### Phase 2: TypeScript Bridge (1 hour)
- [ ] Create `Arc3OpenRouterPythonBridge.ts`
- [ ] Implement `spawnAgent()` with readline parsing
- [ ] Handle timeout, cleanup, error cases

### Phase 3: Stream Service + Routes (1 hour)
- [ ] Create `Arc3OpenRouterStreamService.ts`
- [ ] Create `arc3OpenRouter.ts` routes
- [ ] Register in `server/routes.ts`

### Phase 4: Frontend Integration (30 min)
- [ ] Update `useArc3AgentStream.ts` for provider routing
- [ ] Add OpenRouter to provider dropdown
- [ ] Test end-to-end streaming

---

## Environment Variables

```bash
# Required for OpenRouter
OPENROUTER_API_KEY=sk-or-...

# Optional: Custom Python binary
PYTHON_BIN=python3
```

---

## Testing Checklist

```bash
# 1. Test Python runner standalone
cd server/python
echo '{"game_id":"ls20","model":"xiaomi/mimo-v2-flash:free"}' | python arc3_openrouter_runner.py

# 2. Test backend health endpoint
curl http://localhost:5000/api/arc3-openrouter/health

# 3. Test full streaming via UI
npm run dev
# Open http://localhost:5173/arc3-agent-playground
# Select "OpenRouter" provider
# Click "Start Agent"
# Verify SSE events flow and UI updates
```

---

## Key Differences from Arc3RealGameRunner

| Aspect | Arc3RealGameRunner | Arc3OpenRouterRunner |
|--------|-------------------|---------------------|
| **LLM Provider** | OpenAI Agents SDK | OpenRouter via LangChain |
| **Model** | gpt-4o, o1-mini | xiaomi/mimo-v2-flash:free |
| **Architecture** | TypeScript-native | Python subprocess |
| **Framework** | OpenAI Agents SDK | LangGraph (LangChain) |
| **Cost** | $$$$ | FREE |

---

## References

- `external/ARC-AGI-3-Agents2/agents/templates/langgraph_thinking/` - LangGraph pattern
- `server/services/snakeBench/SnakeBenchPythonBridge.ts` - Python subprocess pattern
- `server/services/snakeBench/SnakeBenchStreamingRunner.ts` - NDJSON parsing pattern
- `docs/reference/arc3/KNOWN_ISSUES.md` - Event type requirements
