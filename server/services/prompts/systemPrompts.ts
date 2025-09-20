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
  buildSystemPrompt
} from './components/promptBuilder.js';
import { TASK_DESCRIPTIONS, ADDITIONAL_INSTRUCTIONS } from './components/basePrompts.js';

/**
 * System prompts - now DRY and maintainable!
 * Each prompt is built from reusable components, eliminating all duplication.
 */

/**
 * Map prompt template IDs to their corresponding system prompts
 * Now using the DRY architecture with dedicated custom prompt support
 */
export const SYSTEM_PROMPT_MAP = {
  solver: () => buildSystemPrompt({ taskDescription: TASK_DESCRIPTIONS.solver, additionalInstructions: ADDITIONAL_INSTRUCTIONS.solver }),
  standardExplanation: () => buildSystemPrompt({ taskDescription: TASK_DESCRIPTIONS.explanation, additionalInstructions: ADDITIONAL_INSTRUCTIONS.explanation }),
  alienCommunication: () => buildSystemPrompt({ taskDescription: TASK_DESCRIPTIONS.alienCommunication, additionalInstructions: ADDITIONAL_INSTRUCTIONS.alienCommunication }),
  educationalApproach: () => buildSystemPrompt({ taskDescription: TASK_DESCRIPTIONS.educational, additionalInstructions: ADDITIONAL_INSTRUCTIONS.educational }),
  gepa: () => buildSystemPrompt({ taskDescription: TASK_DESCRIPTIONS.gepa, additionalInstructions: ADDITIONAL_INSTRUCTIONS.gepa }),
  custom: () => buildCustomPrompt()
} as const;

/**
 * Get system prompt for a given template ID
 */
export function getSystemPrompt(promptId: string): string {
  const promptBuilder = SYSTEM_PROMPT_MAP[promptId as keyof typeof SYSTEM_PROMPT_MAP] || SYSTEM_PROMPT_MAP.standardExplanation;
  return promptBuilder();
}

/**
 * Check if a prompt ID requires special alien communication handling
 */
export function isAlienCommunicationMode(promptId: string): boolean {
  return promptId === 'alienCommunication';
}

/**
 * Check if a prompt ID is solver mode (predicting answers)
 */
export function isSolverMode(promptId: string): boolean {
  return promptId === 'solver' || promptId === 'educationalApproach' || promptId === 'gepa' || promptId === 'custom';
}

// All legacy commented code removed - now using clean DRY architecture