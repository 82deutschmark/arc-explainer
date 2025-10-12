/**
 * REFACTORED SYSTEM PROMPTS - DRY ARCHITECTURE 
 * 
 * This file now uses composable components to eliminate 90% of code duplication.
 * All prompts are built from shared base components in ./components/
 * 
 * IMPORTANT TERMINOLOGY CLARIFICATION FOR DEVELOPERS:
 * 
 * This file handles "SYSTEM PROMPTS" in the LLM prompting system.
 * In LLM terminology:
 * - SYSTEM PROMPT (system role): Instructions for the AI about how to behave ← THIS FILE
 * - USER PROMPT (user role): The actual data/question sent to the AI (see userTemplates.ts)
 * - ASSISTANT PROMPT (assistant role): The AI's response to our question
 * 
 * WHAT OUR APP CALLS "CUSTOM PROMPTS" ARE MODIFYING THE SYSTEM PROMPT:
 * - App users provide custom instructions that replace our default templates for the system prompt
 * - Their "custom prompts" become part of the system role in LLM terms this is how the AI behaves
 * - This file provides users access to the "system role" that tells the AI how to behave
 * 
 * NEW ARCHITECTURE:
 * - Single source of truth for all prompt components
 * - Composable prompt building eliminates duplication
 * - Easy to maintain and modify
 * - Consistent behavior across all prompts
 * 
 * @author Claude Code
 * @date September 1, 2025 (Refactored)
 */

import { 
  buildCustomPrompt,
  buildSystemPrompt,
  buildDebatePrompt,
  buildDiscussionPrompt
} from './components/promptBuilder.js';
import { TASK_DESCRIPTIONS, ADDITIONAL_INSTRUCTIONS } from './components/basePrompts.js';

/**
 * System prompts - now DRY and maintainable!
 * Each prompt is built from reusable components, eliminating all duplication.
 */

/**
 * Map prompt template IDs to their corresponding system prompts
 * Now using the DRY architecture with Phase 12 test-count-aware instructions
 * 
 * @param testCount - Number of test cases in puzzle (for dynamic field instructions)
 * @param hasStructuredOutput - Whether provider uses schema enforcement
 */
export const SYSTEM_PROMPT_MAP = {
  solver: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.solver, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.solver,
      testCount,
      hasStructuredOutput
    }),
  standardExplanation: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.explanation, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.explanation,
      testCount,
      hasStructuredOutput
    }),
  alienCommunication: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.alienCommunication, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.alienCommunication,
      testCount,
      hasStructuredOutput
    }),
  educationalApproach: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.educational, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.educational,
      testCount,
      hasStructuredOutput
    }),
  gepa: (testCount?: number, hasStructuredOutput?: boolean) => 
    buildSystemPrompt({ 
      taskDescription: TASK_DESCRIPTIONS.gepa, 
      additionalInstructions: ADDITIONAL_INSTRUCTIONS.gepa,
      testCount,
      hasStructuredOutput
    }),
  debate: () => buildDebatePrompt(), // Uses special builder with debate instructions FIRST
  discussion: () => buildDiscussionPrompt(), // Uses special builder for AI self-refinement
  custom: () => buildCustomPrompt()
} as const;

/**
 * Get system prompt for a given template ID
 * Phase 12: Now accepts testCount and hasStructuredOutput for dynamic instructions
 * 
 * @param promptId - Template identifier (solver, explanation, etc.)
 * @param testCount - Number of test cases in puzzle (optional, defaults to 1)
 * @param hasStructuredOutput - Whether provider uses structured output (optional, defaults to false)
 * @returns Complete system prompt string with appropriate JSON instructions
 */
export function getSystemPrompt(
  promptId: string, 
  testCount?: number, 
  hasStructuredOutput?: boolean
): string {
  const promptBuilder = SYSTEM_PROMPT_MAP[promptId as keyof typeof SYSTEM_PROMPT_MAP] || SYSTEM_PROMPT_MAP.standardExplanation;
  return promptBuilder(testCount, hasStructuredOutput);
}

/**
 * Check if a prompt ID requires special alien communication handling
 */
export function isAlienCommunicationMode(promptId: string): boolean {
  return promptId === 'alienCommunication';
}

/**
 * Check if a prompt ID is solver mode (predicting answers)  NEED TO TREAT ALL PROMPTS AS SOLVER MODE!!!
 */
export function isSolverMode(promptId: string): boolean {
  return promptId === 'solver' || promptId === 'educationalApproach' || promptId === 'gepa' || promptId === 'debate' || promptId === 'custom' || promptId === 'standardExplanation' || promptId === 'alienCommunication' || promptId === 'externalHuggingFace' || promptId === 'external-huggingface' || promptId === 'discussion';
}

// All legacy commented code removed - now using clean DRY architecture