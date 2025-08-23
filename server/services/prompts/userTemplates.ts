/**
 * server/services/prompts/userTemplates.ts
 * 
 * IMPORTANT TERMINOLOGY CLARIFICATION FOR DEVELOPERS:
 * 
 * This file handles "USER PROMPTS" in the LLM prompting system - NOT app user prompts!
 * In LLM terminology:
 * - SYSTEM PROMPT (system role): Instructions for the AI about how to behave
 * - USER PROMPT (user role): The actual data/question sent to the AI
 * - ASSISTANT PROMPT (assistant role): The AI's response
 * 
 * WHAT OUR APP USERS CALL "CUSTOM PROMPTS" are actually:
 * - Combined system + user prompts that get sent to the LLM
 * - These replace the default template instructions
 * - The user is essentially providing both AI instructions AND puzzle data formatting
 * 
 * This file specifically handles the "user role" part that delivers clean puzzle data.
 * The AI role/behavior instructions come from systemPrompts.ts (system role).
 * 
 * Key Features:
 * - Clean puzzle data presentation for the LLM
 * - Minimal formatting instructions
 * - Template-specific data variations (emoji vs numeric)
 * - Support for custom prompts with raw puzzle data
 * 
 * @author Claude Code
 * @date August 22, 2025
 */

import { ARCTask } from "../../../shared/types";
import { 
  formatTrainingExamples, 
  formatTestSection, 
  getSectionLabels, 
  createEmojiMapLegend,
  getEmojiPalette
} from "../formatters/grids.js";

/**
 * Options for user prompt generation
 */
export interface UserPromptOptions {
  emojiSetKey?: string;
  omitAnswer?: boolean;
  useEmojis?: boolean;
  isSolverMode?: boolean;
  isMultiTest?: boolean;
}

/**
 * Generate clean user prompt with just puzzle data
 */
export function buildUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {},
  customText?: string
): string {
  const {
    emojiSetKey,
    omitAnswer = false,
    useEmojis = false,
    isSolverMode = false,
    isMultiTest = false
  } = options;

  // For custom prompts, return minimal data presentation
  if (customText && customText.trim()) {
    return buildCustomUserPrompt(task, customText, options);
  }

  // Get formatted sections
  const emojiPalette = useEmojis ? getEmojiPalette(emojiSetKey) : undefined;
  const trainingExamples = formatTrainingExamples(task, useEmojis, emojiPalette);
  const testSection = formatTestSection(task, useEmojis, emojiPalette, !omitAnswer, isSolverMode);
  const { trainingLabel, testLabel } = getSectionLabels(useEmojis, isSolverMode, omitAnswer);

  // Build the core prompt
  let userPrompt = `${trainingLabel}
${trainingExamples}

${testLabel}
${testSection}`;

  // Add emoji legend if using emojis
  if (useEmojis && emojiPalette) {
    const emojiLegend = createEmojiMapLegend(emojiPalette);
    userPrompt += `\n${emojiLegend}`;
  }

  return userPrompt;
}

/**
 * Build custom user prompt with raw puzzle data
 */
function buildCustomUserPrompt(
  task: ARCTask,
  customText: string,
  options: UserPromptOptions = {}
): string {
  const { isSolverMode = false } = options;
  
  // Always use raw numeric data for custom prompts
  const trainingExamples = formatTrainingExamples(task, false);
  const testSection = formatTestSection(task, false, undefined, !isSolverMode, isSolverMode);
  
  const isMulti = task.test.length > 1;
  const testLabel = isSolverMode ? "TEST CASE:" : "TEST CASE:";
  
  return `${customText}

TRAINING EXAMPLES:
${trainingExamples}

${testLabel}
${testSection}`;
}

/**
 * Generate solver mode user prompt
 */
export function buildSolverUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {}
): string {
  return buildUserPrompt(task, {
    ...options,
    isSolverMode: true,
    isMultiTest: task.test.length > 1
  });
}

/**
 * Generate explanation mode user prompt
 */
export function buildExplanationUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {}
): string {
  return buildUserPrompt(task, {
    ...options,
    isSolverMode: false,
    isMultiTest: task.test.length > 1
  });
}

/**
 * Generate alien communication user prompt
 */
export function buildAlienUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {}
): string {
  return buildUserPrompt(task, {
    ...options,
    useEmojis: true,
    isSolverMode: false,
    isMultiTest: task.test.length > 1
  });
}

/**
 * Generate minimal custom user prompt
 */
export function buildCustomUserPromptSimple(
  task: ARCTask,
  customText: string
): string {
  return buildCustomUserPrompt(task, customText, {
    isSolverMode: false
  });
}

/**
 * Template mapping for different prompt types
 */
export const USER_TEMPLATE_BUILDERS = {
  solver: buildSolverUserPrompt,
  standardExplanation: buildExplanationUserPrompt,
  educationalApproach: buildExplanationUserPrompt,
  alienCommunication: buildAlienUserPrompt
} as const;

/**
 * Get user prompt builder function for template ID
 */
export function getUserPromptBuilder(
  promptId: string
): (task: ARCTask, options?: UserPromptOptions) => string {
  const builder = USER_TEMPLATE_BUILDERS[promptId as keyof typeof USER_TEMPLATE_BUILDERS];
  return builder ?? buildExplanationUserPrompt;
}

/**
 * Quick helper to build user prompt for any template
 */
export function buildUserPromptForTemplate(
  task: ARCTask,
  promptId: string,
  options: UserPromptOptions = {},
  customText?: string
): string {
  const builderFn: (task: ARCTask, options?: UserPromptOptions) => string = getUserPromptBuilder(promptId);
  
  if (promptId === 'custom' && customText) {
    return buildCustomUserPromptSimple(task, customText);
  }
  
  return builderFn(task, options);
}