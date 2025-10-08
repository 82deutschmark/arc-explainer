/**
 * Composable prompt builder - eliminates all duplication
 * Single function builds all system prompts from reusable components
 * 
 * This replaces the massive duplication in systemPrompts.ts with a clean,
 * maintainable architecture where prompts are composed from base components.
 * 
 * @author Claude Code  
 * @date September 1, 2025
 */

import { 
  BASE_SYSTEM_PROMPT, 
  TASK_DESCRIPTIONS,
  ADDITIONAL_INSTRUCTIONS
} from './basePrompts.js';
import { buildJsonInstructions, buildMinimalJsonInstructions } from './jsonInstructions.js';

/**
 * Configuration for building system prompts
 */
export interface PromptConfig {
  /** Base prompt establishing AI role (defaults to BASE_SYSTEM_PROMPT) */
  basePrompt?: string;
  /** Task description for this prompt mode */
  taskDescription: string;
  /** Prediction field requirements (defaults to PREDICTION_FIELD_INSTRUCTIONS) */
  predictionInstructions?: string;
  /** Additional mode-specific instructions */
  additionalInstructions?: string;
}

/**
 * Compose system prompts from reusable components
 * ELIMINATES all duplication - single function builds all prompts
 * 
 * @param config Configuration specifying which components to use
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(config: PromptConfig): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,
    taskDescription,
    predictionInstructions, // Now optional - use consolidated JSON instructions if not provided
    additionalInstructions = ''
  } = config;

  // Use consolidated JSON instructions (eliminates redundancy)
  // Only use predictionInstructions if explicitly provided (for backwards compatibility)
  const jsonInstructions = predictionInstructions || buildJsonInstructions(true, false);

  // Compose all sections, filtering out empty ones
  return [
    basePrompt,
    taskDescription,
    jsonInstructions,
    additionalInstructions
  ]
  .filter(section => section.trim().length > 0)
  .join('\n\n');
}

/**
 * Quick builder functions for each prompt type
 * These provide convenient shortcuts while maintaining the composable architecture
 */

export function buildSolverPrompt(): string {
  return buildSystemPrompt({
    taskDescription: TASK_DESCRIPTIONS.solver,
    additionalInstructions: ADDITIONAL_INSTRUCTIONS.solver
  });
}

export function buildExplanationPrompt(): string {
  return buildSystemPrompt({
    taskDescription: TASK_DESCRIPTIONS.explanation,
    additionalInstructions: ADDITIONAL_INSTRUCTIONS.explanation
  });
}

export function buildAlienCommunicationPrompt(): string {
  return buildSystemPrompt({
    taskDescription: TASK_DESCRIPTIONS.alienCommunication,
    additionalInstructions: ADDITIONAL_INSTRUCTIONS.alienCommunication
  });
}

export function buildEducationalPrompt(): string {
  return buildSystemPrompt({
    taskDescription: TASK_DESCRIPTIONS.educational,
    additionalInstructions: ADDITIONAL_INSTRUCTIONS.educational
  });
}

/**
 * Build debate prompt with debate instructions FIRST, then ARC rules
 * The challenger AI needs context about its role before learning puzzle rules
 */
export function buildDebatePrompt(): string {
  return buildSystemPrompt({
    basePrompt: ADDITIONAL_INSTRUCTIONS.debate, // Debate instructions FIRST
    taskDescription: TASK_DESCRIPTIONS.debate,
    additionalInstructions: BASE_SYSTEM_PROMPT // ARC rules come AFTER debate context
  });
}

/**
 * Build discussion prompt for AI self-refinement
 * Similar to debate but focused on self-critique and iterative improvement
 */
export function buildDiscussionPrompt(): string {
  return buildSystemPrompt({
    basePrompt: ADDITIONAL_INSTRUCTIONS.discussion, // Self-refinement instructions FIRST
    taskDescription: TASK_DESCRIPTIONS.discussion,
    additionalInstructions: BASE_SYSTEM_PROMPT // ARC rules come AFTER discussion context
  });
}

/**
 * Build custom prompt with minimal JSON enforcement
 * Used for custom prompts to ensure structured output while preserving flexibility
 * Note: Reasoning instructions are handled at the service level based on model capabilities
 */
export function buildCustomPrompt(): string {
  // Use consolidated minimal JSON instructions (eliminates redundancy)
  const jsonInstructions = buildMinimalJsonInstructions();

  return buildSystemPrompt({
    basePrompt: `You are an expert at analyzing ARC-AGI puzzles.\nThe user will provide custom analysis instructions.`,
    taskDescription: `TASK: Follow the user's custom analysis instructions while ensuring structured output.`,
    predictionInstructions: jsonInstructions,
    additionalInstructions: ``
  });
}