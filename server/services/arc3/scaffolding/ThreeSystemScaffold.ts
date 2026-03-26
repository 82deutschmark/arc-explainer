/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: ThreeSystemScaffold — 3-LLM-call-per-turn scaffolding strategy.
Each turn runs three sequential LLM calls: Planner (what should we do?),
Actor (which concrete action to take?), Monitor (did it work as expected?).
The Monitor updates working memory, which feeds the next Planner call.
Modeled after sonpham-arc3/scaffolding-three-system.js.
SRP/DRY check: Pass — all three-system logic is self-contained here.
callLLM is imported from llmCaller.ts (Step 4); no duplicate HTTP code.
*/

import type { FrameData, GameAction } from '../Arc3ApiClient.ts';
import type { Arc3RunTimelineEntry } from '../types.ts';
import type { ScaffoldStrategy } from './types.ts';
import { callLLM, type LLMCallOptions } from '../llmCaller.ts';
import { extractGrid } from '../helpers/frameAnalysis.ts';

// Single-char color tokens (duplicated from LinearScaffold to keep this file self-contained)
const COLOR_TOKENS: Record<number, string> = {
  0:'K',1:'B',2:'R',3:'G',4:'Y',5:'S',6:'F',7:'O',
  8:'A',9:'M',10:'L',11:'T',12:'P',13:'W',14:'C',15:'I',
};

function gridToLexical(grid: number[][]): string {
  if (!grid || grid.length === 0) return '(empty grid)';
  return grid
    .map(row => (row ?? []).map(v => COLOR_TOKENS[v] ?? '?').join(''))
    .join('\n');
}

export interface ThreeSystemScaffoldOptions {
  /** Model identifier for all 3 LLM calls. Defaults to claude-haiku-4-6. */
  model?: string;
  /** Optional BYOK API key / OAuth token */
  apiKey?: string;
}

/**
 * Three-system scaffold: Planner → Actor → Monitor.
 *
 * buildPrompt() returns the Planner prompt (satisfies ScaffoldStrategy interface).
 * The full 3-call sequence is executed by runTurn(), which the game runner can call
 * directly when it detects a ThreeSystemScaffold instance.
 *
 * If the runner only knows about ScaffoldStrategy (interface), it will use
 * buildPrompt() + parseAction() which gives a single-call fallback (Planner only).
 */
export class ThreeSystemScaffold implements ScaffoldStrategy {
  private readonly model: string;
  private readonly apiKey: string | undefined;
  /** Working memory — updated by Monitor after each turn */
  private workingMemory: string[] = [];

  constructor(opts: ThreeSystemScaffoldOptions = {}) {
    this.model = opts.model ?? 'claude-haiku-4-6';
    this.apiKey = opts.apiKey;
  }

  // ── ScaffoldStrategy interface ──────────────────────────────────────────────

  buildPrompt(
    state: FrameData,
    history: Arc3RunTimelineEntry[],
  ): { system: string; user: string } {
    return this._plannerPrompt(state, history);
  }

  parseAction(
    response: string,
  ): { action: GameAction['action']; x?: number; y?: number } {
    return this._parseActionFromText(response);
  }

  // ── Full 3-call turn ────────────────────────────────────────────────────────

  /**
   * Execute a full Planner→Actor→Monitor turn.
   * Returns the parsed action and updates working memory.
   *
   * The game runner should call this instead of buildPrompt/parseAction when
   * it needs the full three-system behavior.
   */
  async runTurn(
    state: FrameData,
    history: Arc3RunTimelineEntry[],
  ): Promise<{ action: GameAction['action']; x?: number; y?: number }> {
    const llmOpts: Omit<LLMCallOptions, 'system' | 'user'> = {
      model: this.model,
      apiKey: this.apiKey,
      maxTokens: 512,
    };

    // ── 1. Planner ──────────────────────────────────────────────────────────
    const plannerPrompt = this._plannerPrompt(state, history);
    const plannerResult = await callLLM({ ...llmOpts, ...plannerPrompt });
    const plan = plannerResult.text;

    // ── 2. Actor ────────────────────────────────────────────────────────────
    const actorPrompt = this._actorPrompt(state, plan);
    const actorResult = await callLLM({ ...llmOpts, ...actorPrompt });
    const parsedAction = this._parseActionFromText(actorResult.text);

    // ── 3. Monitor ──────────────────────────────────────────────────────────
    // Note: state here is the BEFORE state. After the action executes the caller
    // will have the next state. The monitor runs on the plan vs. action taken.
    const monitorPrompt = this._monitorPrompt(state, plan, actorResult.text);
    const monitorResult = await callLLM({ ...llmOpts, ...monitorPrompt });
    this._updateWorkingMemory(monitorResult.text, state, parsedAction);

    return parsedAction;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _plannerPrompt(
    state: FrameData,
    history: Arc3RunTimelineEntry[],
  ): { system: string; user: string } {
    const grid = extractGrid(state);
    const lexical = gridToLexical(grid);
    const memoryBlock = this.workingMemory.length > 0
      ? `\n## Working Memory (Monitor observations)\n${this.workingMemory.slice(-5).join('\n')}`
      : '';

    const system = `You are the Planner in a three-system ARC-AGI-3 agent.
Your role: analyze the game state and describe WHAT should be done this turn.
Be concise. Do NOT output a game action directly — the Actor handles that.
Describe your reasoning and the goal in 2-3 sentences.${memoryBlock}`;

    const recentHistory = history.slice(-3)
      .map(e => `[${e.index}] ${e.label}: ${e.content.slice(0, 80)}`)
      .join('\n') || 'None yet.';

    const user = [
      `Grid (${grid.length}×${grid[0]?.length ?? 0}):`,
      lexical,
      ``,
      `Score: ${state.score}/${state.win_score}  State: ${state.state}  Step: ${state.action_counter ?? 0}/${state.max_actions}`,
      ``,
      `Recent actions:`,
      recentHistory,
      ``,
      `What is your plan for this turn?`,
    ].join('\n');

    return { system, user };
  }

  private _actorPrompt(
    state: FrameData,
    plan: string,
  ): { system: string; user: string } {
    const grid = extractGrid(state);
    const lexical = gridToLexical(grid);

    const system = `You are the Actor in a three-system ARC-AGI-3 agent.
The Planner has given you a plan. Your role: select the exact game action.

Available actions: RESET, ACTION1, ACTION2, ACTION3, ACTION4, ACTION5, ACTION6, ACTION7
ACTION3 requires coordinates: {"action": "ACTION3", "x": <col>, "y": <row>}

Respond with ONLY a JSON object. No markdown, no explanation.
Examples:
  {"action": "ACTION1"}
  {"action": "ACTION3", "x": 5, "y": 3}`;

    const user = [
      `Planner's plan: ${plan}`,
      ``,
      `Current grid (${grid.length}×${grid[0]?.length ?? 0}):`,
      lexical,
      ``,
      `Output the action JSON:`,
    ].join('\n');

    return { system, user };
  }

  private _monitorPrompt(
    state: FrameData,
    plan: string,
    actorResponse: string,
  ): { system: string; user: string } {
    const system = `You are the Monitor in a three-system ARC-AGI-3 agent.
Your role: assess whether the Actor's chosen action aligns with the Planner's plan.
Write 1-2 sentences for the working memory. Focus on what to remember for next turn.`;

    const user = [
      `Plan: ${plan}`,
      `Actor output: ${actorResponse}`,
      `Game state before action: score=${state.score}/${state.win_score}, state=${state.state}, step=${state.action_counter ?? 0}`,
      ``,
      `What should be remembered for the next turn?`,
    ].join('\n');

    return { system, user };
  }

  private _updateWorkingMemory(
    monitorObservation: string,
    state: FrameData,
    action: { action: GameAction['action']; x?: number; y?: number },
  ): void {
    const entry = `step=${state.action_counter ?? 0} action=${action.action}${action.x !== undefined ? ` x=${action.x} y=${action.y}` : ''}: ${monitorObservation.slice(0, 120)}`;
    this.workingMemory.push(entry);
    // Keep memory bounded
    if (this.workingMemory.length > 20) {
      this.workingMemory = this.workingMemory.slice(-20);
    }
  }

  private _parseActionFromText(
    response: string,
  ): { action: GameAction['action']; x?: number; y?: number } {
    const VALID_ACTIONS: GameAction['action'][] = [
      'RESET', 'ACTION1', 'ACTION2', 'ACTION3',
      'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7',
    ];

    const cleaned = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    const match = cleaned.match(/\{[^}]*\}/s);
    if (!match) {
      console.warn('[ThreeSystemScaffold] No JSON in response, defaulting to ACTION1');
      return { action: 'ACTION1' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.warn('[ThreeSystemScaffold] JSON parse failed:', match[0]);
      return { action: 'ACTION1' };
    }

    const rawAction = String(parsed.action ?? '').toUpperCase() as GameAction['action'];
    const action = VALID_ACTIONS.includes(rawAction) ? rawAction : 'ACTION1';

    if (action === 'ACTION3' && parsed.x !== undefined && parsed.y !== undefined) {
      return { action, x: Number(parsed.x), y: Number(parsed.y) };
    }

    return { action };
  }
}
