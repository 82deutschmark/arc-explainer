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
  JSON_OUTPUT_INSTRUCTIONS, 
  PREDICTION_FIELD_INSTRUCTIONS,
  TASK_DESCRIPTIONS,
  ADDITIONAL_INSTRUCTIONS
} from './basePrompts.js';

/**
 * Configuration for building system prompts
 */
export interface PromptConfig {
  /** Base prompt establishing AI role (defaults to BASE_SYSTEM_PROMPT) */
  basePrompt?: string;
  /** Task description for this prompt mode */
  taskDescription: string;
  /** JSON output instructions (defaults to JSON_OUTPUT_INSTRUCTIONS) */
  jsonInstructions?: string;
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
    jsonInstructions = JSON_OUTPUT_INSTRUCTIONS,
    predictionInstructions = PREDICTION_FIELD_INSTRUCTIONS,
    additionalInstructions = ''
  } = config;

  // Compose all sections, filtering out empty ones
  return [
    basePrompt,
    taskDescription,
    jsonInstructions,
    predictionInstructions,
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
 * Build custom prompt with minimal JSON enforcement
 * Used for custom prompts to ensure structured output while preserving flexibility
 */
export function buildCustomPrompt(): string {
  return buildSystemPrompt({
    basePrompt: `You are an expert at analyzing ARC-AGI puzzles.
The user will provide custom analysis instructions.`,
    taskDescription: `TASK: Follow the user's custom analysis instructions while ensuring structured output.`,
    jsonInstructions: `CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.

JSON STRUCTURE REQUIREMENT: The predictedOutput or multiplePredictedOutputs field must be THE FIRST field in your JSON response.

Include any analysis in additional JSON fields as appropriate for the user's request.`,
    additionalInstructions: `You may include additional analysis fields beyond the required prediction fields, based on what the user's custom prompt requests.`
  });
}