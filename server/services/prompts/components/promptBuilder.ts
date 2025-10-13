/**
 * server/services/prompts/components/promptBuilder.ts
 * 
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-10-08 (Cleaned up)
 * 
 * PURPOSE:
 * Composable prompt builder providing core buildSystemPrompt() function
 * and specialized builders for debate/discussion/custom modes.
 * 
 * CLEANUP HISTORY (Oct 8, 2025):
 * - Removed unused convenience functions (buildSolverPrompt, etc.)
 * - Kept only actively-used builders (buildDebatePrompt, buildDiscussionPrompt, buildCustomPrompt)
 * - Reduced file from 135 lines to ~105 lines
 * 
 * SRP/DRY Check: PASS
 * - Single responsibility: System prompt composition
 * - Composes from basePrompts.ts and jsonInstructions.ts
 * - Used by systemPrompts.ts to build all mode-specific prompts
 */

import { 
  BASE_SYSTEM_PROMPT, 
  TASK_DESCRIPTIONS,
  ADDITIONAL_INSTRUCTIONS
} from './basePrompts.js';
import { buildJsonInstructions, buildMinimalJsonInstructions } from './jsonInstructions.js';

/**
 * Configuration for building system prompts
 * REFACTORED: taskDescription removed - belongs in USER prompt, not SYSTEM prompt
 */
export interface PromptConfig {
  /** Base prompt establishing AI role (defaults to BASE_SYSTEM_PROMPT) */
  basePrompt?: string;
  /** Prediction field requirements (defaults to PREDICTION_FIELD_INSTRUCTIONS) */
  predictionInstructions?: string;
  /** Additional mode-specific instructions */
  additionalInstructions?: string;
  /** Number of test cases in the puzzle (for test-count-aware instructions) */
  testCount?: number;
  /** Whether provider uses structured output (schema enforcement) */
  hasStructuredOutput?: boolean;
}

/**
 * Compose system prompts from reusable components
 * ELIMINATES all duplication - single function builds all prompts
 * 
 * ARCHITECTURE: System prompts contain ONLY AI role + JSON schema + mode rules
 * Task descriptions now go in USER prompts (OpenAI Responses API best practice)
 * 
 * @param config Configuration specifying which components to use
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(config: PromptConfig): string {
  const {
    basePrompt = BASE_SYSTEM_PROMPT,
    predictionInstructions, // Optional - use consolidated JSON instructions if not provided
    additionalInstructions = '',
    testCount = 1,  // Default to single test case
    hasStructuredOutput = false  // Default to prompt-based (no schema enforcement)
  } = config;

  // Use test-count-aware JSON instructions (Phase 12 integration)
  // If predictionInstructions explicitly provided, use those (for backwards compatibility)
  // Otherwise, use buildJsonInstructions which adapts to testCount and provider capabilities
  const jsonInstructions = predictionInstructions || buildJsonInstructions(testCount, hasStructuredOutput);

  // Compose all sections, filtering out empty ones
  // NOTE: taskDescription removed - now goes in user prompt only
  return [
    basePrompt,           // AI role and behavior
    jsonInstructions,     // JSON schema enforcement
    additionalInstructions // Mode-specific rules
  ]
  .filter(section => section.trim().length > 0)
  .join('\n\n');
}

/**
 * Build debate prompt with debate instructions FIRST, then ARC rules
 * The challenger AI needs context about its role before learning puzzle rules
 * Task description goes in user prompt, not here
 */
export function buildDebatePrompt(): string {
  return buildSystemPrompt({
    basePrompt: ADDITIONAL_INSTRUCTIONS.debate, // Debate instructions FIRST
    additionalInstructions: BASE_SYSTEM_PROMPT // ARC rules come AFTER debate context
  });
}

/**
 * Build discussion prompt for AI self-refinement
 * Similar to debate but focused on self-critique and iterative improvement
 * Task description goes in user prompt, not here
 */
export function buildDiscussionPrompt(): string {
  return buildSystemPrompt({
    basePrompt: ADDITIONAL_INSTRUCTIONS.discussion, // Self-refinement instructions FIRST
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
    basePrompt: `Learn the rules of the puzzle and produce the correct output grid for the test case(s).`,
    predictionInstructions: jsonInstructions,
    additionalInstructions: ``
  });
}