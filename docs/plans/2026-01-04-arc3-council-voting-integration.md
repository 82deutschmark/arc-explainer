# Arc3 Council Voting Integration Plan

**Date:** 2026-01-04
**Author:** Sonnet 4.5
**Purpose:** Design and implement a council voting system that advises Arc3 agents on which action to take. Only one agent runs the game; the council provides multi-LLM consensus on action selection.

---

## Overview

Create a council service that integrates with existing Arc3 agents (Codex, OpenRouter, Haiku) to provide multi-LLM voting on action decisions:

1. **Action Query**: Playing agent sends game state to council before deciding on an action
2. **Parallel Voting**: Council queries multiple LLMs in parallel, each votes on which of the 7 actions to take
3. **Consensus Aggregation**: Council aggregates votes and returns the most recommended action
4. **Agent Execution**: Playing agent executes the council-recommended action

**Key Design Principle:** Simple voting system. Each LLM returns just an action name (ACTION1-7) + coordinates if needed. Council returns the winning action to the playing agent.

---

## Architecture

### Communication Flow

```
Playing Agent (Codex/OpenRouter/Haiku)
    ↓ "What action should I take?"
POST /api/arc3-council/vote
    ↓
Arc3CouncilService.ts (TypeScript)
    ↓
Parallel queries to OpenRouter API
    ↓
Multiple LLMs vote (ACTION1-7 + coordinates)
    ↓
Aggregate votes → return winner
    ↓
Playing Agent executes council-recommended action
```

### Simple Voting Process

**Input to Council:**
- Game state (3D grid frame)
- Available actions (ACTION1-7)
- Current score, turn, game state
- Optional: previous action history

**Each LLM Vote:**
- Receives game state as text description (or base64 image for vision models)
- Returns: `{ action: "ACTION3", coordinates: [x, y] or null, reasoning: "..." }`

**Council Aggregation:**
- Count votes per action
- Return winning action with highest vote count
- Break ties by random selection or confidence score
- Include vote breakdown for transparency

**Output to Agent:**
```json
{
  "recommended_action": "ACTION3",
  "coordinates": [5, 7],
  "confidence": 0.8,
  "vote_breakdown": {
    "ACTION1": 1,
    "ACTION2": 0,
    "ACTION3": 3,
    "ACTION4": 0,
    "ACTION5": 1,
    "ACTION6": 1,
    "ACTION7": 0
  },
  "total_votes": 6
}
```

---

## File Structure

### New Files to Create

```
server/services/arc3/Arc3CouncilService.ts        # Core voting service
server/routes/arc3Council.ts                      # HTTP endpoints
server/python/arc3_council_vote.py                # Python voting logic (optional, can be pure TS)
client/src/hooks/useArc3Council.ts                # React hook for council integration
```

### Files to Modify (Integration Points)

```
server/services/arc3/CodexArc3Runner.ts           # Add council query before action decision
server/services/arc3/Arc3OpenRouterStreamService.ts  # Add council query to Python runner
server/services/arc3/HaikuArc3StreamService.ts    # Add council query to Haiku agent
client/src/pages/Arc3CodexPlayground.tsx          # Add "Enable Council" toggle
client/src/pages/Arc3OpenRouterPlayground.tsx     # Add "Enable Council" toggle
client/src/pages/Arc3HaikuPlayground.tsx          # Add "Enable Council" toggle
```

---

## Implementation Plan

### Phase 1: Core Council Service (TypeScript)

**File: `server/services/arc3/Arc3CouncilService.ts`**

```typescript
/**
 * Arc3 Council Voting Service
 * Queries multiple LLMs in parallel to vote on which action to take.
 * Returns the winning action with vote breakdown.
 */

import { logger } from '../../utils/logger.ts';

export interface CouncilVoteRequest {
  game_id: string;
  turn: number;
  score: number;
  state: string;
  available_actions: string[];
  frame: number[][][];  // 3D grid
  action_history?: string[];
  council_models?: string[];  // Default: 3-4 models
  api_key?: string;
}

export interface LLMVote {
  model: string;
  action: string;
  coordinates: [number, number] | null;
  reasoning: string;
}

export interface CouncilVoteResult {
  recommended_action: string;
  coordinates: [number, number] | null;
  confidence: number;
  vote_breakdown: Record<string, number>;
  total_votes: number;
  all_votes: LLMVote[];
}

/**
 * Query a single LLM for its action vote
 */
async function queryLLMVoting(
  model: string,
  gameDescription: string,
  availableActions: string[],
  apiKey: string
): Promise<LLMVote> {
  const prompt = `You are playing an Arc3 puzzle game. Based on the game state, vote on which action to take.

GAME STATE:
${gameDescription}

AVAILABLE ACTIONS: ${availableActions.join(', ')}

Return your vote as JSON:
{
  "action": "ACTION3",
  "coordinates": [x, y] or null,
  "reasoning": "brief explanation"
}

Only return the JSON, nothing else.`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://arc-explainer.com',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);

  return {
    model,
    action: parsed.action,
    coordinates: parsed.coordinates || null,
    reasoning: parsed.reasoning || '',
  };
}

/**
 * Build text description of game state for LLMs
 */
function buildGameDescription(request: CouncilVoteRequest): string {
  const frame = request.frame[0] || [];  // First layer
  const height = frame.length;
  const width = height > 0 ? frame[0].length : 0;

  let desc = `Game: ${request.game_id}\n`;
  desc += `Turn: ${request.turn}, Score: ${request.score}, State: ${request.state}\n`;
  desc += `Grid size: ${height}x${width}\n`;

  // Simple grid representation (can be enhanced)
  desc += 'Grid:\n';
  for (const row of frame) {
    desc += row.map(cell => cell.toString().padStart(2)).join(' ') + '\n';
  }

  if (request.action_history && request.action_history.length > 0) {
    desc += `Recent actions: ${request.action_history.slice(-5).join(', ')}\n`;
  }

  return desc;
}

/**
 * Aggregate votes and determine winner
 */
function aggregateVotes(votes: LLMVote[]): CouncilVoteResult {
  const voteBreakdown: Record<string, number> = {
    ACTION1: 0, ACTION2: 0, ACTION3: 0, ACTION4: 0,
    ACTION5: 0, ACTION6: 0, ACTION7: 0,
  };

  for (const vote of votes) {
    const action = vote.action.toUpperCase();
    if (voteBreakdown.hasOwnProperty(action)) {
      voteBreakdown[action]++;
    }
  }

  // Find winning action
  let maxVotes = 0;
  let winner = 'ACTION1';
  let winnerCoords: [number, number] | null = null;

  for (const [action, count] of Object.entries(voteBreakdown)) {
    if (count > maxVotes) {
      maxVotes = count;
      winner = action;
      // Use coordinates from first vote for winning action
      const winningVote = votes.find(v => v.action.toUpperCase() === action);
      winnerCoords = winningVote?.coordinates || null;
    }
  }

  const confidence = maxVotes / votes.length;

  return {
    recommended_action: winner,
    coordinates: winnerCoords,
    confidence,
    vote_breakdown: voteBreakdown,
    total_votes: votes.length,
    all_votes: votes,
  };
}

/**
 * Main voting function - queries multiple LLMs in parallel
 */
export async function voteOnAction(
  request: CouncilVoteRequest
): Promise<CouncilVoteResult> {
  const apiKey = request.api_key || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key required');
  }

  const councilModels = request.council_models || [
    'anthropic/claude-haiku-4.5',
    'google/gemini-2-flash-thinking-exp',
    'openai/gpt-5-mini',
  ];

  const gameDescription = buildGameDescription(request);

  logger.info(
    `[Arc3Council] Starting vote for ${request.game_id} turn ${request.turn} with ${councilModels.length} models`,
    'arc3-council'
  );

  // Query all models in parallel
  const votePromises = councilModels.map(model =>
    queryLLMVoting(model, gameDescription, request.available_actions, apiKey)
  );

  const votes = await Promise.all(votePromises);

  logger.info(
    `[Arc3Council] Received ${votes.length} votes for ${request.game_id}`,
    'arc3-council'
  );

  return aggregateVotes(votes);
}

export const arc3CouncilService = {
  voteOnAction,
};
```

---

### Phase 2: HTTP Endpoints

**File: `server/routes/arc3Council.ts`**

```typescript
/**
 * HTTP endpoints for Arc3 council voting.
 */

import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { arc3CouncilService } from '../services/arc3/Arc3CouncilService.ts';
import { logger } from '../utils/logger.ts';
import { requiresUserApiKey } from '@shared/config/environmentPolicy.ts';

const router = express.Router();

const VoteSchema = z.object({
  game_id: z.string(),
  turn: z.number().int().min(0),
  score: z.number().int().min(0),
  state: z.string(),
  available_actions: z.array(z.string()),
  frame: z.array(z.array(z.array(z.number()))),  // 3D grid
  action_history: z.array(z.string()).optional().default([]),
  council_models: z.array(z.string()).optional(),
  api_key: z.string().optional(),
});

/**
 * POST /api/arc3-council/vote
 * Query council for action recommendation.
 */
router.post('/vote', async (req: Request, res: Response) => {
  try {
    const validated = VoteSchema.parse(req.body);

    // BYOK check
    const byokRequired = requiresUserApiKey();
    if (byokRequired && !validated.api_key) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API key required in production (BYOK)',
      });
    }

    logger.info(
      `[Arc3Council] Vote request for ${validated.game_id} turn ${validated.turn}`,
      'arc3-council'
    );

    const result = await arc3CouncilService.voteOnAction(validated);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error(
      `[Arc3Council] Vote failed: ${error instanceof Error ? error.message : String(error)}`,
      'arc3-council'
    );
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Vote failed',
    });
  }
});

export { router as arc3CouncilRouter };
```

---

### Phase 3: Agent Integration

**Integration Point: `server/services/arc3/CodexArc3Runner.ts`**

Add council query before action decision in the tool execution loop:

```typescript
// Inside CodexArc3Runner.runWithStreaming() method, before calling executeAction()

// Check if council voting is enabled
if (runConfig.enableCouncil) {
  try {
    const voteResult = await arc3CouncilService.voteOnAction({
      game_id: gameId,
      turn: currentFrameNumber,
      score: currentScore || 0,
      state: gameState,
      available_actions: availableActions,
      frame: currentFrame,
      action_history: actionHistory,
      council_models: runConfig.councilModels,
      api_key: runConfig.apiKey,
    });

    logger.info(
      `[CodexRunner] Council recommends ${voteResult.recommended_action} with confidence ${voteResult.confidence}`,
      'arc3-council'
    );

    // Emit council result to SSE for UI display
    streamHarness.emitEvent('council.vote_result', voteResult);

    // Store council recommendation for agent to consider
    streamState.councilRecommendation = voteResult;
  } catch (error) {
    logger.warn(`[CodexRunner] Council query failed, proceeding without: ${error}`, 'arc3-council');
  }
}

// Then agent makes its own decision (can optionally consider council recommendation)
const actionDecision = await agent.decideAction(currentFrame, availableActions, streamState.councilRecommendation);
```

**Integration Point: `server/python/arc3_openrouter_runner.py`**

Add council query before LLM action decision:

```python
# Inside Arc3OpenRouterAgent.decide_action() method

# Check if council voting is enabled
if self.enable_council:
    try:
        # Call TypeScript council service via HTTP
        vote_response = requests.post(
            'http://localhost:3000/api/arc3-council/vote',
            json={
                'game_id': self.game_id,
                'turn': self.turn,
                'score': self.score,
                'state': self.state,
                'available_actions': self.available_actions,
                'frame': self.current_frame,
                'action_history': self.action_history,
                'council_models': self.council_models,
                'api_key': self.api_key,
            },
            timeout=30
        )
        vote_result = vote_response.json()['data']

        print(f'[Council] Recommends {vote_result["recommended_action"]} (confidence: {vote_result["confidence"]})')

        # Include council recommendation in system prompt
        council_guidance = f"\n\nCOUNCIL RECOMMENDATION: {vote_result['recommended_action']} with {vote_result['confidence']:.0%} confidence.\nVote breakdown: {vote_result['vote_breakdown']}\n"
        system_prompt += council_guidance
    except Exception as e:
        print(f'[Council] Query failed: {e}, proceeding without council guidance')
```

---

### Phase 4: Frontend Integration

**File: `client/src/hooks/useArc3Council.ts`**

```typescript
/**
 * React hook for Arc3 council voting.
 * Simple blocking API - no SSE needed for voting.
 */

import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface CouncilVoteRequest {
  game_id: string;
  turn: number;
  score: number;
  state: string;
  available_actions: string[];
  frame: number[][][];
  action_history?: string[];
  council_models?: string[];
  api_key?: string;
}

export interface CouncilVoteResult {
  recommended_action: string;
  coordinates: [number, number] | null;
  confidence: number;
  vote_breakdown: Record<string, number>;
  total_votes: number;
  all_votes: Array<{
    model: string;
    action: string;
    coordinates: [number, number] | null;
    reasoning: string;
  }>;
}

export function useArc3Council() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = async (request: CouncilVoteRequest): Promise<CouncilVoteResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiRequest('POST', '/api/arc3-council/vote', request);
      const result = await response.json();
      return result.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Council vote failed';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { vote, isLoading, error };
}
```

**Frontend Toggle Integration (Example: `Arc3CodexPlayground.tsx`)**

```typescript
// Add to playground configuration panel
const [enableCouncil, setEnableCouncil] = useState(false);

// Pass to backend when starting game
const startResult = await apiRequest('POST', '/api/arc3-codex/stream/prepare', {
  game_id: gameId,
  agentName,
  enableCouncil,  // NEW
  councilModels: ['anthropic/claude-haiku-4.5', 'google/gemini-2-flash-thinking-exp', 'openai/gpt-5-mini'],
  // ... other config
});

// Display council vote results in UI
{state.councilVoteResult && (
  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
    <h4 className="font-semibold text-purple-900 flex items-center gap-2">
      <Users className="w-4 h-4" />
      Council Recommendation
    </h4>
    <div className="mt-2 space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-purple-700">Action:</span>
        <span className="font-mono font-bold text-purple-900">
          {state.councilVoteResult.recommended_action}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-purple-700">Confidence:</span>
        <span className="text-purple-900">
          {(state.councilVoteResult.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-purple-200">
        <span className="text-sm text-purple-600">Vote Breakdown:</span>
        <div className="grid grid-cols-7 gap-1 mt-2">
          {Object.entries(state.councilVoteResult.vote_breakdown).map(([action, count]) => (
            <div key={action} className="text-center">
              <div className="text-xs text-purple-600">{action}</div>
              <div className="font-bold text-purple-900">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
```

---

## Implementation Phases

### Phase 1: Core Service (2 hours)
- Create `Arc3CouncilService.ts` with voting logic
- Create `arc3Council.ts` routes
- Add route to `server/routes.ts`
- Test with curl/Postman

### Phase 2: Agent Integration (3 hours)
- Integrate into `CodexArc3Runner.ts`
- Integrate into `arc3_openrouter_runner.py`
- Add `enableCouncil` flag to run configs
- Test council voting in both agents

### Phase 3: Frontend (2 hours)
- Create `useArc3Council.ts` hook
- Add "Enable Council" toggle to all three playgrounds
- Display council vote results in UI
- Test end-to-end

### Phase 4: Polish (1 hour)
- Add council vote history to timeline
- Improve game description for LLMs
- Add configurable council models
- Update CHANGELOG

**Total Estimated Time: 8 hours**

---

## Testing Strategy

1. **Unit Tests**: Test vote aggregation logic
2. **Integration Tests**: Test council service with mock LLM responses
3. **E2E Tests**: Test full agent run with council enabled
4. **Manual Tests**: Run ls20 game with council, observe vote patterns

---

## Future Enhancements

- **Vision Models**: Use base64 PNG images instead of text grid description
- **Weighted Voting**: Give some models more weight based on historical accuracy
- **Learning**: Track which council votes lead to successful actions, adjust model weights
- **Multi-Turn Memory**: Council remembers previous hypotheses across turns
- **Explainability**: Detailed reasoning from each LLM voter

---

## Configuration

Add to `server/config/arc3.ts`:

```typescript
export const ARC3_COUNCIL_CONFIG = {
  defaultCouncilModels: [
    'anthropic/claude-haiku-4.5',
    'google/gemini-2-flash-thinking-exp',
    'openai/gpt-5-mini',
  ],
  timeoutMs: 30 * 1000,  // 30 seconds per vote
};
```

---

## Success Criteria

1. ✅ Council queries 3+ LLMs in parallel
2. ✅ Vote aggregation returns winning action with confidence
3. ✅ Agent integrates council recommendation into decision
4. ✅ Frontend displays council vote breakdown
5. ✅ Council failures are graceful (agent proceeds without council)

---

## Notes

- **Simple blocking API** - no SSE needed for voting
- **Only 7 actions** - keep prompts focused and simple
- **Graceful degradation** - council failures shouldn't stop the agent
- **BYOK support** - respects production API key requirements
- **Cost consideration** - each council vote costs 3x API calls (3 models)
