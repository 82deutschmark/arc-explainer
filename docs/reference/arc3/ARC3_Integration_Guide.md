# ARC3 Integration Guide

**Author:** Claude Code (Sonnet 4.5)  
**Date:** 2025-11-06  
**Purpose:** Comprehensive guide for integrating with ARC-AGI-3 API using OpenAI Agents SDK

## Overview

This guide documents the correct approach to integrate the ARC-AGI-3 competition API (https://three.arcprize.org) with the OpenAI Agents SDK in TypeScript, based on the official Python reference implementation.

## Key References

### Python Reference Implementation
Located in `external/ARC3-solution/ARC-AGI-3-Agents/`:

1. **`agents/structs.py`** - Core data structures
   - `FrameData`: Game state representation
   - `GameAction`: Available actions (RESET, ACTION1-ACTION7)
   - `GameState`: Enum values (NOT_PLAYED, IN_PROGRESS, WIN, GAME_OVER)

2. **`agents/templates/reasoning_agent.py`** - EXACT format for ARC3 interaction
   - Shows how to build tool definitions
   - Demonstrates structured output parsing
   - Implements reasoning capture and metadata

3. **`agents/templates/llm_agents.py`** - Base LLM agent patterns
   - Message history management
   - Tool calling with function definitions
   - Observation and action phases

### TypeScript Streaming Reference
- **`server/services/streaming/saturnStreamService.ts`** - Correct streaming implementation
  - Uses StreamingHarness pattern
  - Properly handles SSE events
  - Implements database persistence

## ARC3 API Data Structures

### FrameData (from API)
```typescript
interface FrameData {
  guid: string;              // Game session ID
  game_id: string;           // Game identifier (e.g., "ls20")
  frame: number[][][];       // 3D array [layer][height][width] with values 0-15
  score: number;             // Current score
  state: string;             // "NOT_PLAYED" | "IN_PROGRESS" | "WIN" | "GAME_OVER"
  action_counter: number;    // Number of actions taken
  max_actions: number;       // Maximum allowed actions
  win_score: number;         // Score needed to win
}
```

### GameAction
```typescript
interface GameAction {
  action: 'RESET' | 'ACTION1' | 'ACTION2' | 'ACTION3' | 'ACTION4' | 'ACTION5' | 'ACTION6';
  coordinates?: [number, number];  // Required for ACTION6 only
}
```

### GameState Mapping
The API returns string values that must be mapped to our type system:
```typescript
const mapState = (state: string): Arc3GameState => {
  if (state === 'NOT_PLAYED') return 'NOT_PLAYED';
  if (state === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (state === 'WIN') return 'WIN';
  if (state === 'GAME_OVER') return 'GAME_OVER';
  return 'NOT_STARTED';  // Default fallback for simulator
};
```

## OpenAI Agents SDK Integration

### Basic Agent Setup
```typescript
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

// Define tools
const inspectTool = tool({
  name: 'inspect_game_state',
  description: 'Inspect current game state',
  parameters: z.object({
    note: z.string().optional()
  }),
  execute: async (input) => {
    return currentFrame; // Return cached FrameData
  }
});

const actionTool = tool({
  name: 'execute_game_action',
  description: 'Execute a game action',
  parameters: z.object({
    action: z.enum(['RESET', 'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']),
    coordinates: z.tuple([z.number(), z.number()]).optional()
  }),
  execute: async ({ action, coordinates }) => {
    // Call ARC3 API
    const frame = await apiClient.executeAction(gameGuid, { action, coordinates });
    return frame;
  }
});

// Create agent
const agent = new Agent({
  name: 'ARC3 Real Game Operator',
  instructions: baseInstructions,
  model: 'gpt-5-nano',
  tools: [inspectTool, actionTool]
});
```

### Non-Streaming Execution
```typescript
const result = await run(
  agent,
  'Start playing the ARC-AGI-3 game "ls20"...',
  { maxTurns: 24 }
);

// Access results
const usage = result.state._context.usage;
const finalOutput = extractAllTextOutput(result.newItems);
const timeline = result.newItems; // Array of RunItem objects
```

### Streaming Execution
```typescript
const result = await run(
  agent,
  'Start playing...',
  { 
    maxTurns: 24,
    stream: true  // Enable streaming
  }
);

// Process streaming events
for await (const event of result) {
  switch (event.type) {
    case 'raw_model_stream_event':
      // Model output chunks
      streamHarness.emitEvent('model.stream_event', event.data);
      break;
      
    case 'run_item_stream_event':
      // Tool calls, messages, etc.
      streamHarness.emitEvent('agent.run_item', event.item);
      break;
      
    case 'agent_updated_stream_event':
      // Agent handoffs
      streamHarness.emitEvent('agent.updated', event.agent);
      break;
  }
}

// Wait for completion
await result.completed;
```

## Critical Implementation Details

### 1. State Management
- **Current Frame Caching**: ARC3 API doesn't have separate status endpoints. Cache the latest `FrameData` from each action.
- **Frame History**: Maintain array of all frames for timeline reconstruction.

### 2. Type Safety
```typescript
// ❌ WRONG - Accessing wrong object
const state = result.state.state;  // result.state is RunState, not FrameData

// ✅ CORRECT - Access currentFrame
const state = currentFrame.state;
```

### 3. OpenAI SDK Streaming
```typescript
// ❌ WRONG - StreamedRunResult doesn't have runId
return { runId: result.runId };

// ✅ CORRECT - Generate UUID
return { runId: randomUUID() };
```

### 4. Frame Type Compatibility
```typescript
// Arc3AgentRunResult.frames accepts any[]
return {
  frames: frames as any[],  // FrameData[] → any[]
  // ...
};
```

## Agent Instructions Pattern

Based on `reasoning_agent.py`, effective instructions should:

1. **Explain the game context**
   - Grid-based interface with color values 0-15
   - Actions affect game state
   - Goal is to understand mechanics

2. **Define available actions clearly**
   - RESET: Start/restart game
   - ACTION1-ACTION5: Simple actions
   - ACTION6: Coordinate-based action

3. **Provide strategy guidance**
   - Start with RESET
   - Use inspect_game_state to observe
   - Experiment to learn rules
   - Track grid changes

4. **Set clear termination conditions**
   - Stop on WIN
   - Stop when no useful actions remain

## Common Pitfalls Fixed

### Issue 1: Wrong Object Property Access
```typescript
// ❌ WRONG
const summary = {
  state: result.state.state,     // result is StreamedRunResult
  score: result.score,           // Doesn't exist
  stepsTaken: result.action_counter  // Doesn't exist
};

// ✅ CORRECT
const summary = {
  state: mapState(currentFrame.state),
  score: currentFrame.score,
  stepsTaken: currentFrame.action_counter
};
```

### Issue 2: Type Mismatches
```typescript
// ❌ WRONG - Direct cast causes type error
state: currentFrame.state as Arc3GameState

// ✅ CORRECT - Use mapping function
state: mapState(currentFrame.state)
```

### Issue 3: Config Property Names
```typescript
// ❌ WRONG
const gameId = config.scenarioId;

// ✅ CORRECT
const gameId = config.game_id;
```

## Integration Checklist

- [ ] Implement Arc3ApiClient with proper FrameData types
- [ ] Create tool definitions matching ARC3 actions
- [ ] Add state mapping function for API response strings
- [ ] Cache currentFrame for inspect operations
- [ ] Generate UUIDs for runId (StreamedRunResult doesn't provide)
- [ ] Cast frames array to any[] for Arc3AgentRunResult
- [ ] Implement streaming event forwarding if needed
- [ ] Handle scorecard lifecycle (openScorecard before startGame)
- [ ] Add proper error handling for API failures
- [ ] Test with real ARC3 API credentials

## Testing

```typescript
// Test with LockSmith game (ls20)
const config: Arc3AgentRunConfig = {
  game_id: 'ls20',
  agentName: 'Test Agent',
  instructions: 'Custom instructions here',
  model: 'gpt-5-nano',
  maxTurns: 24
};

const result = await runner.run(config);
console.log(`Final state: ${result.summary.state}`);
console.log(`Score: ${result.summary.score}`);
console.log(`Steps: ${result.summary.stepsTaken}`);
```

## Resources

- ARC-AGI-3 Website: https://three.arcprize.org
- Official Python SDK: https://github.com/arcprize/ARC-AGI-3-Agents
- OpenAI Agents SDK: https://www.npmjs.com/package/@openai/agents
- Documentation: https://three.arcprize.org/docs

## See Also

- `server/services/arc3/Arc3RealGameRunner.ts` - TypeScript implementation
- `server/services/arc3/Arc3ApiClient.ts` - API client
- `server/services/streaming/saturnStreamService.ts` - Streaming reference
- `external/ARC3-solution/ARC-AGI-3-Agents/` - Python reference implementation
