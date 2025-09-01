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
  buildSolverPrompt,
  buildExplanationPrompt,
  buildAlienCommunicationPrompt,
  buildEducationalPrompt,
  buildCustomPrompt
} from './components/promptBuilder.js';

/**
 * System prompts - now DRY and maintainable!
 * Each prompt is built from reusable components, eliminating all duplication.
 */
export const SOLVER_SYSTEM_PROMPT = buildSolverPrompt();

export const EXPLANATION_SYSTEM_PROMPT = buildExplanationPrompt();

export const ALIEN_COMMUNICATION_SYSTEM_PROMPT = buildAlienCommunicationPrompt();

export const EDUCATIONAL_SYSTEM_PROMPT = buildEducationalPrompt();

export const CUSTOM_SYSTEM_PROMPT = buildCustomPrompt();

/**
 * Map prompt template IDs to their corresponding system prompts
 * Now using the DRY architecture with dedicated custom prompt support
 */
export const SYSTEM_PROMPT_MAP = {
  solver: SOLVER_SYSTEM_PROMPT,
  standardExplanation: EXPLANATION_SYSTEM_PROMPT,
  alienCommunication: ALIEN_COMMUNICATION_SYSTEM_PROMPT,
  educationalApproach: EDUCATIONAL_SYSTEM_PROMPT,
  custom: CUSTOM_SYSTEM_PROMPT // Now has proper custom prompt support!
} as const;

/**
 * Get system prompt for a given template ID
 */
export function getSystemPrompt(promptId: string): string {
  return SYSTEM_PROMPT_MAP[promptId as keyof typeof SYSTEM_PROMPT_MAP] || EXPLANATION_SYSTEM_PROMPT;
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
  return promptId === 'solver' || promptId === 'educationalApproach';
}

// All legacy commented code removed - now using clean DRY architecture