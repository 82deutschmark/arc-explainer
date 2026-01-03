/*
Author: Cascade (Claude Opus 4.5)
Date: 2026-01-03
PURPOSE: Shared helper functions for Arc3RealGameRunner run() and runWithStreaming().
         Eliminates duplication of system prompt selection and state mapping logic.
SRP/DRY check: Pass — focused on run-mode-agnostic utilities.
*/

import type { Arc3GameState, Arc3AgentRunConfig, Arc3RunSummary } from '../types.ts';
import type { FrameData } from '../Arc3ApiClient.ts';
import { buildArc3DefaultPrompt } from '../prompts.ts';

/**
 * Select system prompt based on config options.
 * - If skipDefaultSystemPrompt is true, use only explicit prompt (may be empty)
 * - If explicit prompt provided, use it
 * - Otherwise, use default ARC3 prompt
 */
export function selectSystemPrompt(config: Arc3AgentRunConfig): string {
  const explicit = config.systemPrompt?.trim() || '';
  const skipDefault = config.skipDefaultSystemPrompt === true;

  if (skipDefault) {
    return explicit;
  }

  if (explicit) {
    return explicit;
  }

  return buildArc3DefaultPrompt();
}

/**
 * Build combined instructions from base system prompt and operator guidance.
 */
export function buildCombinedInstructions(config: Arc3AgentRunConfig): string {
  const baseSystemPrompt = selectSystemPrompt(config);
  const operatorGuidance = config.instructions?.trim();

  if (operatorGuidance) {
    return baseSystemPrompt
      ? `${baseSystemPrompt}\n\nOperator guidance: ${operatorGuidance}`
      : operatorGuidance;
  }

  return baseSystemPrompt || '';
}

/**
 * Map ARC3 API state strings to Arc3GameState type.
 * Throws error for unexpected states.
 */
export function mapState(state: string): Arc3GameState {
  switch (state) {
    case 'NOT_PLAYED':
      return 'NOT_PLAYED';
    case 'IN_PROGRESS':
      return 'IN_PROGRESS';
    case 'WIN':
      return 'WIN';
    case 'GAME_OVER':
      return 'GAME_OVER';
    case 'NOT_FINISHED':
      return 'NOT_FINISHED';
    default:
      throw new Error(`Unexpected game state from ARC3 API: ${state}`);
  }
}

/**
 * Build run summary from final frame data.
 */
export function buildRunSummary(
  currentFrame: FrameData,
  gameId: string,
  framesCount: number
): Arc3RunSummary {
  return {
    state: mapState(currentFrame.state),
    score: currentFrame.score,
    stepsTaken: currentFrame.action_counter ?? Math.max(0, framesCount - 1),
    simpleActionsUsed: [],  // ARC3 doesn't track this the same way
    coordinateGuesses: 0,   // ARC3 doesn't track this separately
    scenarioId: gameId,
    scenarioName: gameId,   // Use gameId as name for now
  };
}
