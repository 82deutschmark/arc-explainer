# Arc3 Council Voting Integration Plan

**Date:** 2026-01-04
**Author:** Sonnet 4.5
**Purpose:** Design and implement a multi-agent council voting system for Arc3 gameplay that generates hypotheses about game rules, votes on strategies, and provides iterative feedback to the playing agent.

---

## Overview

Create a new Arc3-specific council system (inspired by but separate from the LLM-Council submodule) that:

1. **Initial Hypothesis Generation**: Send a screenshot of the game state to multiple AI models who each generate hypotheses about the game rules
2. **Voting/Ranking**: Council members vote on which hypotheses are most likely correct
3. **Consensus to Agent**: Pass the voted consensus to the Arc3 agent who uses it to choose an action
4. **Iterative Feedback Loop**: After the agent executes an action, send the outcome back to the council for hypothesis refinement

**Key Design Principle:** Do NOT modify the `llm-council/` submodule. Build a new Arc3-specific implementation that learns from its patterns but is purpose-built for game hypothesis generation.

---

## Architecture

### Communication Flow

```
Frontend (React)
    ↓
POST /api/arc3-council/prepare
    ↓
GET /api/arc3-council/stream/:sessionId (SSE)
    ↓
Arc3CouncilStreamService.ts (TypeScript)
    ↓
Arc3CouncilPythonBridge.ts (spawn subprocess)
    ↓
arc3_council_runner.py (Python)
    ↓
Arc3CouncilEngine.py (3-stage deliberation with vision)
    ↓
OpenRouter API (multimodal requests)
```

### Three-Stage Deliberation (Adapted for Games)

**Stage 1: Hypothesis Generation**
- Input: PNG screenshot of game state + game metadata (score, state, available actions)
- Each council model independently generates 3-5 hypotheses about:
  - What each action might do
  - What the win condition appears to be
  - Patterns/rules observed in the grid
- Output: List of `{model, hypotheses[]}` objects

**Stage 2: Hypothesis Ranking**
- Input: All hypotheses from Stage 1 (anonymized as "Hypothesis Set A, B, C...")
- Each council model ranks all hypothesis sets based on:
  - Specificity (are they testable?)
  - Evidence (are they grounded in observations?)
  - Parsimony (simplest explanations?)
- Output: Rankings + aggregate scores

**Stage 3: Action Recommendation**
- Input: Original game state + all hypotheses + all rankings
- Chairman model synthesizes consensus and recommends:
  - Top 3 most likely rules
  - Suggested next action to test the rules
  - Confidence level
- Output: `{rules[], suggested_action, confidence, reasoning}`

---

## File Structure

### New Files to Create

```
server/python/arc3_council_runner.py          # Main entry point (NDJSON protocol)
server/python/arc3_council_engine.py          # 3-stage deliberation engine
server/services/arc3/Arc3CouncilBridge.ts     # Subprocess management
server/services/arc3/Arc3CouncilStreamService.ts  # Session + SSE orchestration
server/routes/arc3Council.ts                  # HTTP endpoints
client/src/pages/Arc3CouncilPlayground.tsx    # UI for council mode
client/src/components/arc3/Arc3CouncilPanel.tsx  # Stage 1/2/3 visualization
client/src/hooks/useArc3CouncilStream.ts      # SSE state management
```

### Files to Reference (Do NOT Modify)

```
llm-council/backend/council.py                # Pattern reference for 3 stages
llm-council/backend/openrouter.py             # OpenRouter integration pattern
server/services/council/councilBridge.ts      # Subprocess pattern reference
server/python/arc3_openrouter_runner.py       # Arc3 agent pattern reference
server/services/arc3/arc3GridImageService.ts  # PNG rendering (reuse)
```

---

## Implementation Plan

### Phase 1: Python Council Engine (Backend Core)

**File: `server/python/arc3_council_engine.py`**

```python
"""
Arc3-specific council deliberation engine.
Handles hypothesis generation, ranking, and action synthesis with vision support.
"""

import asyncio
import base64
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass

@dataclass
class GameContext:
    """Game state context for council deliberation."""
    game_id: str
    turn: int
    score: int
    state: str  # IN_PROGRESS, WIN, GAME_OVER
    available_actions: List[str]
    frame_image_b64: str  # Base64 PNG
    action_history: List[str]
    previous_hypotheses: List[str]  # From prior turns

@dataclass
class HypothesisSet:
    """A model's generated hypotheses."""
    model: str
    hypotheses: List[str]
    confidence: float

@dataclass
class ActionRecommendation:
    """Final council recommendation."""
    suggested_action: str
    reasoning: str
    top_rules: List[str]
    confidence: float
    coordinates: Tuple[int, int] | None


async def stage1_generate_hypotheses(
    context: GameContext,
    council_models: List[str],
    api_key: str
) -> List[HypothesisSet]:
    """
    Stage 1: Each council model generates hypotheses from game screenshot.

    Prompt focuses on:
    - Observable patterns in the grid
    - Possible action effects
    - Win condition theories

    Uses multimodal messages (text + image).
    """
    # Build multimodal prompt
    prompt = build_hypothesis_prompt(context)

    # Query all models in parallel with vision
    tasks = [
        query_model_with_vision(model, prompt, context.frame_image_b64, api_key)
        for model in council_models
    ]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # Parse hypotheses from responses
    hypothesis_sets = []
    for model, response in zip(council_models, responses):
        if isinstance(response, Exception):
            continue
        hypotheses = parse_hypotheses(response['content'])
        hypothesis_sets.append(HypothesisSet(
            model=model,
            hypotheses=hypotheses,
            confidence=0.5  # Default
        ))

    return hypothesis_sets


async def stage2_rank_hypotheses(
    context: GameContext,
    hypothesis_sets: List[HypothesisSet],
    council_models: List[str],
    api_key: str
) -> Tuple[List[Dict], Dict[str, str]]:
    """
    Stage 2: Each model ranks anonymized hypothesis sets.

    Returns: (rankings, label_to_model mapping)
    """
    # Anonymize hypothesis sets as "Set A, B, C..."
    labels = [chr(65 + i) for i in range(len(hypothesis_sets))]
    label_to_model = {
        f"Set {label}": hs.model
        for label, hs in zip(labels, hypothesis_sets)
    }

    # Build ranking prompt
    prompt = build_ranking_prompt(context, hypothesis_sets, labels)

    # Query all models in parallel (text-only, no vision needed)
    tasks = [
        query_model(model, prompt, api_key)
        for model in council_models
    ]
    responses = await asyncio.gather(*tasks, return_exceptions=True)

    # Parse rankings
    rankings = []
    for model, response in zip(council_models, responses):
        if isinstance(response, Exception):
            continue
        parsed_ranking = parse_ranking(response['content'])
        rankings.append({
            'model': model,
            'ranking_text': response['content'],
            'parsed_ranking': parsed_ranking
        })

    return rankings, label_to_model


async def stage3_synthesize_action(
    context: GameContext,
    hypothesis_sets: List[HypothesisSet],
    rankings: List[Dict],
    chairman_model: str,
    api_key: str
) -> ActionRecommendation:
    """
    Stage 3: Chairman synthesizes consensus and recommends action.

    Considers:
    - All hypothesis sets
    - Peer rankings
    - Previous action outcomes (if available)

    Returns structured action recommendation.
    """
    prompt = build_synthesis_prompt(context, hypothesis_sets, rankings)

    # Query chairman with structured output for reliable parsing
    response = await query_model_structured(
        chairman_model,
        prompt,
        ActionRecommendation,
        api_key
    )

    return response


def build_hypothesis_prompt(context: GameContext) -> str:
    """Build prompt for hypothesis generation (Stage 1)."""

    history_text = ", ".join(context.action_history[-10:]) if context.action_history else "None yet"

    return f"""You are analyzing a puzzle game. Look at the game state image provided.

GAME CONTEXT:
- Current score: {context.score}
- Game state: {context.state}
- Available actions: {', '.join(context.available_actions)}
- Recent actions: {history_text}

YOUR TASK:
Generate 3-5 specific, testable hypotheses about the game mechanics.

Focus on:
1. What patterns do you observe in the grid?
2. What might each available action do?
3. What appears to be the win condition?
4. What rules govern score changes?

Format your response as a numbered list of hypotheses.
Be specific and concrete - avoid vague statements.

Example good hypothesis: "ACTION1 moves the blue object upward one cell"
Example bad hypothesis: "Actions affect the game state"

Your hypotheses:"""


def build_ranking_prompt(
    context: GameContext,
    hypothesis_sets: List[HypothesisSet],
    labels: List[str]
) -> str:
    """Build prompt for hypothesis ranking (Stage 2)."""

    # Anonymize and present hypothesis sets
    sets_text = "\n\n".join([
        f"Set {label}:\n" + "\n".join([f"  {i+1}. {h}" for i, h in enumerate(hs.hypotheses)])
        for label, hs in zip(labels, hypothesis_sets)
    ])

    return f"""You are evaluating different hypothesis sets about a puzzle game.

GAME CONTEXT:
- Score: {context.score}
- State: {context.state}

HYPOTHESIS SETS (anonymized):

{sets_text}

YOUR TASK:
Rank these hypothesis sets from best to worst based on:
1. Specificity - Are they concrete and testable?
2. Evidence - Are they grounded in observable patterns?
3. Coverage - Do they explain available actions and outcomes?
4. Parsimony - Are they the simplest explanations?

IMPORTANT: End your response with:
FINAL RANKING:
1. Set X
2. Set Y
3. Set Z

Now provide your evaluation and ranking:"""


def build_synthesis_prompt(
    context: GameContext,
    hypothesis_sets: List[HypothesisSet],
    rankings: List[Dict]
) -> str:
    """Build prompt for chairman synthesis (Stage 3)."""

    # Format all hypotheses
    hyp_text = "\n\n".join([
        f"Model: {hs.model}\nHypotheses:\n" + "\n".join([f"  - {h}" for h in hs.hypotheses])
        for hs in hypothesis_sets
    ])

    # Format rankings
    rank_text = "\n\n".join([
        f"Model: {r['model']}\n{r['ranking_text']}"
        for r in rankings
    ])

    return f"""You are the Chairman synthesizing game rule hypotheses from multiple AI models.

GAME CONTEXT:
- Score: {context.score}
- State: {context.state}
- Available actions: {', '.join(context.available_actions)}

STAGE 1 - Individual Hypotheses:
{hyp_text}

STAGE 2 - Peer Rankings:
{rank_text}

YOUR TASK:
1. Identify the most likely game rules based on consensus
2. Recommend the next action to test these rules
3. Provide confidence level (0.0-1.0)

Return your synthesis as JSON:
{{
  "top_rules": ["rule 1", "rule 2", "rule 3"],
  "suggested_action": "ACTION1",
  "coordinates": [x, y] or null,
  "reasoning": "why this action tests our hypotheses",
  "confidence": 0.8
}}"""


async def query_model_with_vision(
    model: str,
    prompt: str,
    image_b64: str,
    api_key: str
) -> Dict[str, Any]:
    """Query OpenRouter model with multimodal message (text + image)."""
    import aiohttp

    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{image_b64}"}}
        ]
    }]

    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://arc-explainer.com",
            },
            json={
                "model": model,
                "messages": messages,
                "temperature": 0.7,
            }
        ) as response:
            data = await response.json()
            return {
                'content': data['choices'][0]['message']['content']
            }
```

**File: `server/python/arc3_council_runner.py`**

```python
"""
NDJSON protocol wrapper for Arc3 council deliberation.
Reads game context from stdin, emits stage events to stdout.
"""

import json
import sys
import asyncio
from arc3_council_engine import (
    GameContext, stage1_generate_hypotheses,
    stage2_rank_hypotheses, stage3_synthesize_action
)

def emit_event(event_type: str, data: dict = None):
    """Emit NDJSON event to stdout."""
    event = {"type": event_type}
    if data:
        event.update(data)
    print(json.dumps(event), flush=True)

async def run_council_deliberation(config: dict):
    """Main council loop."""

    # Parse game context
    context = GameContext(
        game_id=config['game_id'],
        turn=config.get('turn', 0),
        score=config.get('score', 0),
        state=config.get('state', 'IN_PROGRESS'),
        available_actions=config.get('available_actions', []),
        frame_image_b64=config['frame_image_b64'],
        action_history=config.get('action_history', []),
        previous_hypotheses=config.get('previous_hypotheses', [])
    )

    council_models = config.get('council_models', [
        "anthropic/claude-haiku-4.5",
        "google/gemini-3-flash-preview",
        "openai/gpt-5-mini",
        "x-ai/grok-4.1-fast"
    ])

    chairman_model = config.get('chairman_model', council_models[0])
    api_key = config.get('api_key') or os.getenv('OPENROUTER_API_KEY')

    emit_event("council.start", {"turn": context.turn, "council_size": len(council_models)})

    # Stage 1: Generate hypotheses
    emit_event("council.stage1_start", {})
    hypothesis_sets = await stage1_generate_hypotheses(context, council_models, api_key)
    emit_event("council.stage1_complete", {
        "hypothesis_sets": [
            {"model": hs.model, "hypotheses": hs.hypotheses}
            for hs in hypothesis_sets
        ],
        "count": len(hypothesis_sets)
    })

    # Stage 2: Rank hypotheses
    emit_event("council.stage2_start", {})
    rankings, label_to_model = await stage2_rank_hypotheses(
        context, hypothesis_sets, council_models, api_key
    )
    emit_event("council.stage2_complete", {
        "rankings": rankings,
        "label_to_model": label_to_model
    })

    # Stage 3: Synthesize action
    emit_event("council.stage3_start", {})
    recommendation = await stage3_synthesize_action(
        context, hypothesis_sets, rankings, chairman_model, api_key
    )
    emit_event("council.stage3_complete", {
        "recommendation": {
            "suggested_action": recommendation.suggested_action,
            "reasoning": recommendation.reasoning,
            "top_rules": recommendation.top_rules,
            "confidence": recommendation.confidence,
            "coordinates": recommendation.coordinates
        }
    })

    # Final result
    emit_event("council.completed", {
        "recommendation": recommendation.__dict__
    })

def main():
    try:
        input_data = sys.stdin.read()
        config = json.loads(input_data)
        asyncio.run(run_council_deliberation(config))
    except Exception as e:
        emit_event("stream.error", {"code": "COUNCIL_ERROR", "message": str(e)})
        sys.exit(1)

if __name__ == "__main__":
    main()
```

---

### Phase 2: TypeScript Bridge & Service

**File: `server/services/arc3/Arc3CouncilBridge.ts`**

```typescript
/**
 * Subprocess bridge for Arc3 council deliberation.
 * Pattern: Arc3OpenRouterPythonBridge.ts + councilBridge.ts
 */

import { spawn, type ChildProcessSpawnOptions } from 'child_process';
import path from 'path';
import * as readline from 'readline';
import { logger } from '../../utils/logger.ts';

export interface Arc3CouncilPayload {
  game_id: string;
  turn: number;
  score: number;
  state: string;
  available_actions: string[];
  frame_image_b64: string;  // Base64 PNG from arc3GridImageService
  action_history: string[];
  previous_hypotheses?: string[];
  council_models?: string[];
  chairman_model?: string;
  api_key?: string;
}

export interface Arc3CouncilSpawnOptions {
  timeoutMs?: number;
}

export class Arc3CouncilBridge {
  private activeChildren = new Map<string, ReturnType<typeof spawn>>();

  resolvePythonBin(): string {
    return process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  }

  resolveRunnerPath(): string {
    return path.join(process.cwd(), 'server', 'python', 'arc3_council_runner.py');
  }

  async spawnCouncil(
    payload: Arc3CouncilPayload,
    onStdoutLine: (line: string) => void,
    onStderrLine: (line: string) => void,
    sessionId?: string,
    opts: Arc3CouncilSpawnOptions = {}
  ): Promise<{ code: number | null }> {
    const pythonBin = this.resolvePythonBin();
    const runnerPath = this.resolveRunnerPath();
    const timeoutMs = opts.timeoutMs ?? 5 * 60 * 1000; // 5 min default

    const spawnOpts: ChildProcessSpawnOptions = {
      cwd: process.cwd(),
      env: {
        ...process.env as Record<string, string>,
        PYTHONUNBUFFERED: '1',
        OPENROUTER_API_KEY: payload.api_key || process.env.OPENROUTER_API_KEY || '',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    return new Promise((resolve, reject) => {
      logger.info(`[Arc3Council] Spawning council: ${pythonBin} ${runnerPath}`, 'arc3-council');

      const child = spawn(pythonBin, [runnerPath], spawnOpts);
      if (sessionId) {
        this.activeChildren.set(sessionId, child);
      }

      if (!child.stdout || !child.stderr || !child.stdin) {
        return reject(new Error('Council process streams not available'));
      }

      const timeoutHandle = setTimeout(() => {
        child.kill('SIGTERM');
        logger.error(`[Arc3Council] Timeout after ${timeoutMs}ms`, 'arc3-council');
        reject(new Error(`Council timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');

      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
      });

      rl.on('line', (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          onStdoutLine(trimmed);
        }
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            onStderrLine(trimmed);
          }
        }
      });

      child.on('close', (code: number | null) => {
        clearTimeout(timeoutHandle);
        rl.close();
        if (sessionId) {
          this.activeChildren.delete(sessionId);
        }
        resolve({ code });
      });

      child.on('error', (err) => {
        clearTimeout(timeoutHandle);
        rl.close();
        if (sessionId) {
          this.activeChildren.delete(sessionId);
        }
        reject(err);
      });

      // Send payload via stdin
      try {
        child.stdin.setDefaultEncoding('utf8');
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (err) {
        clearTimeout(timeoutHandle);
        rl.close();
        child.kill();
        if (sessionId) {
          this.activeChildren.delete(sessionId);
        }
        reject(err);
      }
    });
  }

  cancel(sessionId: string): void {
    const child = this.activeChildren.get(sessionId);
    if (child && !child.killed) {
      child.kill('SIGTERM');
      logger.info(`[Arc3Council] Killed for session ${sessionId}`, 'arc3-council');
    }
    this.activeChildren.delete(sessionId);
  }
}

export const arc3CouncilBridge = new Arc3CouncilBridge();
```

**File: `server/services/arc3/Arc3CouncilStreamService.ts`**

```typescript
/**
 * Session management and SSE emission for Arc3 council deliberation.
 * Pattern: Arc3OpenRouterStreamService.ts
 */

import { nanoid } from 'nanoid';
import type { Request } from 'express';
import { sseStreamManager } from '../streaming/SSEStreamManager.ts';
import { logger } from '../../utils/logger.ts';
import { arc3CouncilBridge, type Arc3CouncilPayload } from './Arc3CouncilBridge.ts';

export interface Arc3CouncilStreamPayload extends Arc3CouncilPayload {
  sessionId?: string;
  createdAt?: number;
  expiresAt?: number;
}

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class Arc3CouncilStreamService {
  private readonly pending = new Map<string, Arc3CouncilStreamPayload>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  savePayload(payload: Arc3CouncilStreamPayload): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const enriched: Arc3CouncilStreamPayload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    this.pending.set(sessionId, enriched);
    this.scheduleExpiration(sessionId, SESSION_TTL_MS);
    return sessionId;
  }

  getPayload(sessionId: string): Arc3CouncilStreamPayload | undefined {
    return this.pending.get(sessionId);
  }

  clear(sessionId: string): void {
    this.pending.delete(sessionId);
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
  }

  private scheduleExpiration(sessionId: string, ttlMs: number): void {
    const existing = this.timers.get(sessionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pending.delete(sessionId);
      this.timers.delete(sessionId);
    }, ttlMs);

    if (typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
    this.timers.set(sessionId, timer);
  }

  async startStreaming(_req: Request, payload: Arc3CouncilStreamPayload): Promise<void> {
    const sessionId = payload.sessionId!;

    if (!sseStreamManager.has(sessionId)) {
      throw new Error('SSE session must be registered before starting council.');
    }

    sseStreamManager.sendEvent(sessionId, 'council.init', {
      state: 'starting',
      turn: payload.turn,
      game_id: payload.game_id,
    });

    sseStreamManager.createStream(sessionId, {
      onDisconnect: () => {
        arc3CouncilBridge.cancel(sessionId);
        this.clear(sessionId);
      },
    });

    try {
      const { code } = await arc3CouncilBridge.spawnCouncil(
        payload,
        (line: string) => this.handleStdoutLine(sessionId, line),
        (line: string) => logger.warn(`[Arc3Council] stderr: ${line}`, 'arc3-council'),
        sessionId
      );

      if (code !== 0) {
        sseStreamManager.error(sessionId, 'COUNCIL_ERROR', `Council exited with code ${code}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Arc3Council] Failed: ${message}`, 'arc3-council');
      sseStreamManager.error(sessionId, 'COUNCIL_ERROR', message);
      this.clear(sessionId);
    } finally {
      sseStreamManager.closeStream(sessionId);
    }
  }

  private handleStdoutLine(sessionId: string, line: string): void {
    if (!line.startsWith('{') || !line.endsWith('}')) {
      sseStreamManager.sendEvent(sessionId, 'council.status', { message: line });
      return;
    }

    try {
      const event = JSON.parse(line);
      const eventType = event.type || 'council.chunk';
      const enrichedEvent = { ...event };
      delete enrichedEvent.type;

      sseStreamManager.sendEvent(sessionId, eventType, enrichedEvent);

      if (eventType === 'council.completed') {
        sseStreamManager.close(sessionId, enrichedEvent);
      }
    } catch (err) {
      logger.warn(`[Arc3Council] Failed to parse: ${line.slice(0, 100)}`, 'arc3-council');
    }
  }

  cancel(sessionId: string): void {
    if (sseStreamManager.has(sessionId)) {
      sseStreamManager.teardown(sessionId, 'cancelled');
    }
    this.clear(sessionId);
  }
}

export const arc3CouncilStreamService = new Arc3CouncilStreamService();
```

---

### Phase 3: HTTP Endpoints

**File: `server/routes/arc3Council.ts`**

```typescript
/**
 * HTTP endpoints for Arc3 council deliberation.
 */

import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { sseStreamManager } from '../services/streaming/SSEStreamManager.ts';
import { arc3CouncilStreamService } from '../services/arc3/Arc3CouncilStreamService.ts';
import { renderArc3FrameToPng } from '../services/arc3/arc3GridImageService.ts';
import { logger } from '../utils/logger.ts';
import { requiresUserApiKey } from '@shared/config/environmentPolicy.ts';

const router = express.Router();

const PrepareSchema = z.object({
  game_id: z.string(),
  turn: z.number().int().min(0),
  score: z.number().int().min(0),
  state: z.string(),
  available_actions: z.array(z.string()),
  frame: z.array(z.array(z.array(z.number()))),  // 3D grid
  action_history: z.array(z.string()).optional().default([]),
  previous_hypotheses: z.array(z.string()).optional(),
  council_models: z.array(z.string()).optional(),
  chairman_model: z.string().optional(),
  api_key: z.string().optional(),
});

/**
 * POST /api/arc3-council/prepare
 * Prepare a council deliberation session and return sessionId for streaming.
 */
router.post('/prepare', async (req: Request, res: Response) => {
  try {
    const validated = PrepareSchema.parse(req.body);

    // Render frame to PNG for vision models
    const imageResult = await renderArc3FrameToPng(validated.frame);
    if (!imageResult?.dataUrl) {
      return res.status(500).json({
        success: false,
        error: 'Failed to render game frame to image',
      });
    }

    // Extract base64 (strip data URL prefix)
    const frame_image_b64 = imageResult.dataUrl.split(',')[1];

    // BYOK check
    const byokRequired = requiresUserApiKey();
    if (byokRequired && !validated.api_key) {
      return res.status(400).json({
        success: false,
        error: 'OpenRouter API key required in production (BYOK)',
      });
    }

    const payload = {
      game_id: validated.game_id,
      turn: validated.turn,
      score: validated.score,
      state: validated.state,
      available_actions: validated.available_actions,
      frame_image_b64,
      action_history: validated.action_history,
      previous_hypotheses: validated.previous_hypotheses,
      council_models: validated.council_models,
      chairman_model: validated.chairman_model,
      api_key: validated.api_key || process.env.OPENROUTER_API_KEY,
    };

    const sessionId = arc3CouncilStreamService.savePayload(payload);

    logger.info(
      `[Arc3Council] Prepared session ${sessionId} for game ${validated.game_id} turn ${validated.turn}`,
      'arc3-council'
    );

    res.json({
      success: true,
      data: { sessionId },
    });
  } catch (error) {
    logger.error(
      `[Arc3Council] Prepare failed: ${error instanceof Error ? error.message : String(error)}`,
      'arc3-council'
    );
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Prepare failed',
    });
  }
});

/**
 * GET /api/arc3-council/stream/:sessionId
 * SSE stream for council deliberation events.
 */
router.get('/stream/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  const payload = arc3CouncilStreamService.getPayload(sessionId);
  if (!payload) {
    return res.status(404).json({
      success: false,
      error: 'Session not found or expired',
    });
  }

  sseStreamManager.registerStream(sessionId, req, res);

  await arc3CouncilStreamService.startStreaming(req, payload);
});

/**
 * DELETE /api/arc3-council/cancel/:sessionId
 * Cancel an active council session.
 */
router.delete('/cancel/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  arc3CouncilStreamService.cancel(sessionId);
  res.json({ success: true });
});

export { router as arc3CouncilRouter };
```

---

### Phase 4: Frontend Integration

**File: `client/src/hooks/useArc3CouncilStream.ts`**

```typescript
/**
 * React hook for Arc3 council deliberation SSE stream.
 * Pattern: useArc3AgentStream.ts
 */

import { useState, useRef, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface Arc3CouncilState {
  status: 'idle' | 'preparing' | 'streaming' | 'completed' | 'error';
  sessionId: string | null;
  turn: number;

  // Stage 1: Hypothesis generation
  stage1: Array<{ model: string; hypotheses: string[] }> | null;

  // Stage 2: Rankings
  stage2: Array<{ model: string; ranking_text: string }> | null;
  label_to_model: Record<string, string> | null;

  // Stage 3: Final recommendation
  recommendation: {
    suggested_action: string;
    reasoning: string;
    top_rules: string[];
    confidence: number;
    coordinates: [number, number] | null;
  } | null;

  error: string | null;
  streamingMessage: string;
}

export function useArc3CouncilStream() {
  const [state, setState] = useState<Arc3CouncilState>({
    status: 'idle',
    sessionId: null,
    turn: 0,
    stage1: null,
    stage2: null,
    label_to_model: null,
    recommendation: null,
    error: null,
    streamingMessage: '',
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const startDeliberation = useCallback(async (payload: {
    game_id: string;
    turn: number;
    score: number;
    state: string;
    available_actions: string[];
    frame: number[][][];
    action_history: string[];
    previous_hypotheses?: string[];
    api_key?: string;
  }) => {
    setState((prev) => ({ ...prev, status: 'preparing', turn: payload.turn }));

    try {
      // Prepare session
      const prepareRes = await apiRequest('POST', '/api/arc3-council/prepare', payload);
      const { sessionId } = await prepareRes.json().then((d) => d.data);

      setState((prev) => ({ ...prev, sessionId, status: 'streaming' }));

      // Connect to SSE stream
      const eventSource = new EventSource(`/api/arc3-council/stream/${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('council.stage1_complete', (evt) => {
        const data = JSON.parse(evt.data);
        setState((prev) => ({
          ...prev,
          stage1: data.hypothesis_sets,
          streamingMessage: 'Stage 1 complete: Hypotheses generated',
        }));
      });

      eventSource.addEventListener('council.stage2_complete', (evt) => {
        const data = JSON.parse(evt.data);
        setState((prev) => ({
          ...prev,
          stage2: data.rankings,
          label_to_model: data.label_to_model,
          streamingMessage: 'Stage 2 complete: Rankings collected',
        }));
      });

      eventSource.addEventListener('council.stage3_complete', (evt) => {
        const data = JSON.parse(evt.data);
        setState((prev) => ({
          ...prev,
          recommendation: data.recommendation,
          streamingMessage: 'Stage 3 complete: Action recommended',
        }));
      });

      eventSource.addEventListener('council.completed', (evt) => {
        setState((prev) => ({
          ...prev,
          status: 'completed',
          streamingMessage: 'Council deliberation completed',
        }));
        eventSource.close();
      });

      eventSource.addEventListener('stream.error', (evt) => {
        const data = JSON.parse(evt.data);
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: data.message,
        }));
        eventSource.close();
      });

      eventSource.onerror = () => {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'SSE connection lost',
        }));
        eventSource.close();
      };
    } catch (error) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start council',
      }));
    }
  }, []);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (state.sessionId) {
      apiRequest('DELETE', `/api/arc3-council/cancel/${state.sessionId}`).catch(() => {});
    }
    setState((prev) => ({ ...prev, status: 'idle' }));
  }, [state.sessionId]);

  return { state, startDeliberation, cancel };
}
```

**File: `client/src/components/arc3/Arc3CouncilPanel.tsx`**

```tsx
/**
 * Visualization component for council deliberation stages.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Arc3CouncilPanelProps {
  stage1: Array<{ model: string; hypotheses: string[] }> | null;
  stage2: Array<{ model: string; ranking_text: string }> | null;
  recommendation: {
    suggested_action: string;
    reasoning: string;
    top_rules: string[];
    confidence: number;
  } | null;
}

export function Arc3CouncilPanel({ stage1, stage2, recommendation }: Arc3CouncilPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Council Deliberation</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="stage3">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="stage1">Hypotheses</TabsTrigger>
            <TabsTrigger value="stage2">Rankings</TabsTrigger>
            <TabsTrigger value="stage3">Recommendation</TabsTrigger>
          </TabsList>

          <TabsContent value="stage1" className="space-y-3">
            {stage1 ? (
              stage1.map((set, idx) => (
                <div key={idx} className="border-l-2 border-blue-400 pl-3">
                  <div className="text-xs font-semibold text-blue-600">{set.model}</div>
                  <ul className="text-xs space-y-1 mt-1">
                    {set.hypotheses.map((h, i) => (
                      <li key={i}>• {h}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">Waiting for hypotheses...</div>
            )}
          </TabsContent>

          <TabsContent value="stage2" className="space-y-3">
            {stage2 ? (
              stage2.map((rank, idx) => (
                <div key={idx} className="border-l-2 border-amber-400 pl-3">
                  <div className="text-xs font-semibold text-amber-600">{rank.model}</div>
                  <div className="text-xs whitespace-pre-wrap mt-1">{rank.ranking_text}</div>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">Waiting for rankings...</div>
            )}
          </TabsContent>

          <TabsContent value="stage3">
            {recommendation ? (
              <div className="space-y-3">
                <div>
                  <Badge variant="default" className="text-xs">
                    {recommendation.suggested_action}
                  </Badge>
                  <span className="text-xs ml-2 text-muted-foreground">
                    Confidence: {(recommendation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold">Top Rules:</div>
                  <ul className="text-xs space-y-1 mt-1">
                    {recommendation.top_rules.map((rule, i) => (
                      <li key={i}>• {rule}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold">Reasoning:</div>
                  <div className="text-xs mt-1">{recommendation.reasoning}</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Waiting for recommendation...</div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

---

## Integration with Existing Arc3 Agent

### Option A: Standalone Council Mode

Create a new playground page (`Arc3CouncilPlayground.tsx`) that runs ONLY the council (no agent execution). The council provides recommendations, user reviews them, then manually triggers the agent.

**Flow:**
1. User selects game
2. Council deliberates on initial frame
3. Display recommendation
4. User manually clicks "Execute Recommended Action"
5. Game state updates
6. Council deliberates again on new frame
7. Repeat

**Pros:**
- Simple, clear separation
- User can review council reasoning
- Easy to debug

**Cons:**
- Not fully automated
- Requires manual intervention

### Option B: Integrated Agent + Council Loop

Modify `arc3_openrouter_runner.py` to call the council before each action decision.

**In `choose_action()` method:**

```python
# Before analyzing frame, consult council
if self.use_council:
    council_result = await self.run_council_deliberation(frame_data)

    # Add council recommendation to observations
    self.add_observation(f"Council consensus: {council_result.top_rules}")
    self.add_thought(f"Council suggests: {council_result.suggested_action} ({council_result.confidence})")

    # Use council recommendation if high confidence
    if council_result.confidence > 0.75:
        return (
            council_result.suggested_action,
            f"Following council: {council_result.reasoning}",
            council_result.coordinates
        )

# Otherwise, fall back to solo agent decision
result = self.analyze_frame(frame_data)
```

**Pros:**
- Fully automated
- Council + agent synergy

**Cons:**
- Much slower (each turn requires full 3-stage deliberation)
- Complex to debug
- Expensive (3-5 models per turn)

### Recommended Approach: **Option A** (Standalone Council Mode)

Start with a standalone council playground to validate the hypothesis generation and voting works well. If successful, integrate into the main agent later.

---

## Testing Strategy

1. **Unit tests** for hypothesis parsing (`parse_hypotheses()`, `parse_ranking()`)
2. **Integration test** with mock OpenRouter responses
3. **Manual test** on game `ls20`:
   - Does council generate sensible hypotheses?
   - Do rankings make sense?
   - Does chairman synthesize coherently?
4. **A/B comparison**: Council vs. solo agent on 5 games

---

## Configuration

Add to `server/config/arc3.ts`:

```typescript
export const ARC3_COUNCIL_CONFIG = {
  defaultCouncilModels: [
    'anthropic/claude-haiku-4.5',
    'google/gemini-3-flash-preview',
    'openai/gpt-5-mini',
    'x-ai/grok-4.1-fast',
  ],
  defaultChairman: 'anthropic/claude-haiku-4.5',
  timeoutMs: 5 * 60 * 1000,  // 5 minutes
  maxHypothesesPerModel: 5,
};
```

---

## Success Criteria

1. ✅ Council generates 3-5 testable hypotheses per model
2. ✅ Rankings correctly identify most plausible hypothesis sets
3. ✅ Chairman synthesis produces valid action recommendations
4. ✅ Frontend displays all 3 stages in real-time
5. ✅ Iterative feedback loop works (turn N hypotheses inform turn N+1)

---

## Future Enhancements

- **Hypothesis persistence**: Store hypotheses in database for replay/analysis
- **Confidence tracking**: Track which hypotheses were correct post-hoc
- **Council ELO**: Rank council models by hypothesis quality over time
- **Adaptive council size**: Use fewer models for simple games, more for complex
- **Hybrid mode**: Council only on "critical turns" (score changes, state transitions)

---

## Estimated Effort

- **Phase 1 (Python)**: 8-10 hours
- **Phase 2 (TypeScript)**: 6-8 hours
- **Phase 3 (Endpoints)**: 3-4 hours
- **Phase 4 (Frontend)**: 6-8 hours
- **Testing & Polish**: 4-6 hours

**Total**: ~30-40 hours for complete implementation

---

## Notes

- **Do NOT modify `llm-council/` submodule** - this is a separate, general-purpose tool
- **Reuse arc3GridImageService** for PNG rendering - already battle-tested
- **Follow Arc3OpenRouter patterns** for consistency with existing agent infrastructure
- **Keep council prompts game-agnostic** - don't mention "ARC-AGI" or puzzle-specific terms that might bias models
