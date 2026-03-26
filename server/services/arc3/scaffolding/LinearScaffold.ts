/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: LinearScaffold — single-turn observe→act scaffolding strategy.
Each game turn is one LLM call: the current frame is encoded as a lexical grid,
the last 5 history entries are appended, and the model returns a JSON action.
Modeled after sonpham-arc3/scaffolding-linear.js.
SRP/DRY check: Pass — one class, one concern: single-turn prompt generation and action parsing.
Reuses extractGrid() from helpers/frameAnalysis.ts; no duplicate grid logic.
*/

import type { FrameData, GameAction } from '../Arc3ApiClient.ts';
import type { Arc3RunTimelineEntry } from '../types.ts';
import type { ScaffoldStrategy } from './types.ts';
import { extractGrid } from '../helpers/frameAnalysis.ts';

// ARC3 color palette (values 0–15 → lexical codes)
const COLOR_NAMES: Record<number, string> = {
  0:  'black',
  1:  'blue',
  2:  'red',
  3:  'green',
  4:  'yellow',
  5:  'grey',
  6:  'fuchsia',
  7:  'orange',
  8:  'azure',
  9:  'maroon',
  10: 'lime',
  11: 'teal',
  12: 'purple',
  13: 'white',
  14: 'coral',
  15: 'pink',
};

// Single-character lexical tokens for compact grid encoding
const COLOR_TOKENS: Record<number, string> = {
  0:  'K', // blacK
  1:  'B', // Blue
  2:  'R', // Red
  3:  'G', // Green
  4:  'Y', // Yellow
  5:  'S', // Slate/grey
  6:  'F', // Fuchsia
  7:  'O', // Orange
  8:  'A', // Azure
  9:  'M', // Maroon
  10: 'L', // Lime
  11: 'T', // Teal
  12: 'P', // Purple
  13: 'W', // White
  14: 'C', // Coral
  15: 'I', // pInk
};

const VALID_ACTIONS: GameAction['action'][] = [
  'RESET', 'ACTION1', 'ACTION2', 'ACTION3',
  'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7',
];

/**
 * Convert a 2D grid of color values to a compact lexical string.
 * Each row is a sequence of single-char tokens, rows separated by newlines.
 * Example: "KKKB\nKRGK\n..."
 */
function gridToLexical(grid: number[][]): string {
  if (!grid || grid.length === 0) return '(empty grid)';
  return grid
    .map(row => (row ?? []).map(v => COLOR_TOKENS[v] ?? '?').join(''))
    .join('\n');
}

/**
 * Format the last N history entries as a compact summary for the user prompt.
 */
function formatHistory(history: Arc3RunTimelineEntry[], limit = 5): string {
  if (history.length === 0) return 'No prior actions this game.';
  const recent = history.slice(-limit);
  return recent
    .map(e => `[turn ${e.index}] ${e.label}: ${e.content.slice(0, 120)}`)
    .join('\n');
}

const SYSTEM_PROMPT = `You are playing an ARC-AGI-3 game. ARC-AGI-3 is a suite of visual reasoning puzzles.
Each puzzle presents a grid of colored cells. You must take actions to transform or manipulate the grid to reach the WIN state.

## Color Palette (token → color name)
${Object.entries(COLOR_TOKENS)
  .map(([v, t]) => `  ${t} = ${COLOR_NAMES[parseInt(v)]}`)
  .join('\n')}

## Available Actions
- ACTION1: Apply transformation 1
- ACTION2: Apply transformation 2
- ACTION3: Apply transformation at coordinates (requires x, y)
- ACTION4: Apply transformation 4
- ACTION5: Apply transformation 5
- ACTION6: Rotate or flip
- ACTION7: Advanced transformation
- RESET: Reset the game to initial state

## Response Format
You MUST respond with a single JSON object. No markdown fences, no explanation.

For actions without coordinates:
{"action": "ACTION1"}

For ACTION3 (coordinate-based):
{"action": "ACTION3", "x": 5, "y": 3}

Think step by step, then output ONLY the JSON.`;

/**
 * Single-turn linear scaffold: one LLM call per turn.
 * Encodes the current frame as a lexical grid and appends recent history.
 */
export class LinearScaffold implements ScaffoldStrategy {
  buildPrompt(
    state: FrameData,
    history: Arc3RunTimelineEntry[],
  ): { system: string; user: string } {
    const grid = extractGrid(state);
    const lexical = gridToLexical(grid);

    const user = [
      `## Current Frame`,
      `Score: ${state.score} / ${state.win_score}  |  State: ${state.state}  |  Step: ${state.action_counter ?? 0} / ${state.max_actions}`,
      ``,
      `Grid (${grid.length} rows × ${grid[0]?.length ?? 0} cols):`,
      lexical,
      ``,
      `## Recent History (last 5 turns)`,
      formatHistory(history, 5),
      ``,
      `What action should you take? Respond with JSON only.`,
    ].join('\n');

    return { system: SYSTEM_PROMPT, user };
  }

  parseAction(
    response: string,
  ): { action: GameAction['action']; x?: number; y?: number } {
    // Strip markdown code fences if present
    const cleaned = response
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // Extract first {...} block
    const match = cleaned.match(/\{[^}]*\}/s);
    if (!match) {
      console.warn('[LinearScaffold] No JSON object found in response, defaulting to ACTION1');
      return { action: 'ACTION1' };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.warn('[LinearScaffold] JSON parse failed, defaulting to ACTION1:', match[0]);
      return { action: 'ACTION1' };
    }

    const rawAction = String(parsed.action ?? '').toUpperCase() as GameAction['action'];
    const action = VALID_ACTIONS.includes(rawAction) ? rawAction : 'ACTION1';

    if (action === 'ACTION3' && parsed.x !== undefined && parsed.y !== undefined) {
      return {
        action,
        x: Number(parsed.x),
        y: Number(parsed.y),
      };
    }

    return { action };
  }
}
