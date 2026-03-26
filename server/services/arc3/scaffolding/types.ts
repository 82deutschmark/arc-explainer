/*
Author: Claude Sonnet 4.6 (Bubba)
Date: 25-March-2026
PURPOSE: ScaffoldStrategy interface — defines the contract for all ARC3 scaffolding implementations.
Each scaffold strategy knows how to turn a game state into an LLM prompt and how to parse
the LLM response back into a concrete game action. Decouples prompt engineering from the
game loop in Arc3RealGameRunner.
SRP/DRY check: Pass — interface only, no logic. One reason to change: scaffolding contract changes.
*/

import type { FrameData } from '../Arc3ApiClient.ts';
import type { Arc3RunTimelineEntry } from '../types.ts';
import type { GameAction } from '../Arc3ApiClient.ts';

/**
 * Contract for all ARC3 scaffolding strategies.
 *
 * A ScaffoldStrategy translates game state into LLM prompts and parses
 * LLM responses back into executable game actions. The game runner calls
 * buildPrompt() each turn, sends the result to an LLM, then calls parseAction()
 * on the response to get the next move.
 */
export interface ScaffoldStrategy {
  /**
   * Build a system + user prompt pair from the current game state and turn history.
   * @param state   Current frame from Arc3ApiClient (includes grid, score, state)
   * @param history All prior timeline entries for this run (bounded by runner's maxTurns)
   * @returns       { system, user } strings ready to send to an LLM
   */
  buildPrompt(
    state: FrameData,
    history: Arc3RunTimelineEntry[],
  ): { system: string; user: string };

  /**
   * Parse the raw LLM response text into a structured game action.
   * Must handle malformed/partial JSON gracefully — default to a safe action on parse failure.
   * @param response  Raw text string from the LLM (may contain markdown fences)
   * @returns         Parsed action name plus optional coordinates for ACTION3
   */
  parseAction(
    response: string,
  ): { action: GameAction['action']; x?: number; y?: number };
}
