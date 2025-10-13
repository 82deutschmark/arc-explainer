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
 * Generate user prompt WITH task description (refactored architecture)
 * User prompt now contains: PROBLEM statement + puzzle data
 * System prompt contains: AI role/behavior only
 */
export function buildUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {},
  customText?: string,
  taskDescription?: string  // NEW: Task description from TASK_DESCRIPTIONS
): string {
  const {
    emojiSetKey,
    omitAnswer = true,  // CRITICAL: Default is HIDE ANSWERS for research integrity
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
  const testSection = formatTestSection(task, useEmojis, emojiPalette, omitAnswer, isSolverMode);
  const { trainingLabel, testLabel } = getSectionLabels(useEmojis, isSolverMode, omitAnswer);

  // Build the user prompt with puzzle data FIRST, then task description
  let userPrompt = '';

  // PUZZLE DATA FIRST: Show training examples and test cases
  userPrompt += `${trainingLabel}
${trainingExamples}

${testLabel}
${testSection}`;

  // Add emoji legend if using emojis
  if (useEmojis && emojiPalette) {
    const emojiLegend = createEmojiMapLegend(emojiPalette);
    userPrompt += `\n${emojiLegend}`;
  }

  // TASK DESCRIPTION AFTER: Instructions come after showing the data
  if (taskDescription) {
    userPrompt += `\n\n${taskDescription}`;
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
  const { isSolverMode = false, omitAnswer = true } = options;  // CRITICAL: Default is HIDE ANSWERS
  
  // Always use raw numeric data for custom prompts
  const trainingExamples = formatTrainingExamples(task, false);
  const testSection = formatTestSection(task, false, undefined, omitAnswer, isSolverMode);
  
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
 * Generate discussion mode user prompt (self-refinement)
 */
export function buildDiscussionUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {},
  originalExplanation?: any,
  customChallenge?: string,
  taskDescription?: string
): string {
  let prompt = '';

  // TASK DESCRIPTION FIRST
  if (taskDescription) {
    prompt += `${taskDescription}\n\n`;
  }

  // PREVIOUS ANALYSIS CONTEXT
  if (originalExplanation) {
    prompt += `YOUR PREVIOUS ANALYSIS (INCORRECT/INCOMPLETE):\n`;
    prompt += `Pattern Description: ${originalExplanation.patternDescription}\n`;
    prompt += `Solving Strategy: ${originalExplanation.solvingStrategy}\n`;

    if (originalExplanation.hints && originalExplanation.hints.length > 0) {
      prompt += `Hints: ${originalExplanation.hints.join(', ')}\n`;
    }

    if (customChallenge && customChallenge.trim()) {
      prompt += `\nFOCUS ON: ${customChallenge.trim()}\n`;
    }

    prompt += `\n---\n\n`;
  }

  // Add the puzzle data
  prompt += buildUserPrompt(task, options);

  return prompt;
}

/**
 * Generate debate mode user prompt with original explanation context
 */
export function buildDebateUserPrompt(
  task: ARCTask,
  options: UserPromptOptions = {},
  originalExplanation?: any,
  customChallenge?: string,
  taskDescription?: string
): string {
  let prompt = '';

  // TASK DESCRIPTION FIRST
  if (taskDescription) {
    prompt += `${taskDescription}\n\n`;
  }

  // DEBATE CONTEXT - AI needs to see the flawed explanation
  if (originalExplanation) {
    prompt += `PREVIOUS AI EXPLANATION TO CRITIQUE:\n`;
    prompt += `Pattern Description: ${originalExplanation.patternDescription}\n`;
    prompt += `Solving Strategy: ${originalExplanation.solvingStrategy}\n`;

    if (originalExplanation.hints && originalExplanation.hints.length > 0) {
      prompt += `Hints: ${originalExplanation.hints.join(', ')}\n`;
    }

    if (customChallenge && customChallenge.trim()) {
      prompt += `\nHUMAN GUIDANCE FOR YOUR ANALYSIS: ${customChallenge.trim()}\n`;
    }

    // Add separator before puzzle data
    prompt += `\n---\n\n`;
  }

  // Add the puzzle data (training examples)
  prompt += buildSolverUserPrompt(task, options);

  // PREDICTED OUTPUT COMES AFTER TRAINING EXAMPLES
  // This lets the AI see the pattern first, THEN critique the wrong prediction
  if (originalExplanation) {
    const hasMultiTest = originalExplanation.hasMultiplePredictions === true;

    prompt += `\n\nPREVIOUS AI PREDICTED OUTPUT (INCORRECT):\n`;

    if (hasMultiTest) {
      // Multi-test puzzle - use multiple_predicted_outputs or multi_test_prediction_grids
      const predictions = originalExplanation.multiplePredictedOutputs || originalExplanation.multiTestPredictionGrids;

      if (predictions && Array.isArray(predictions) && predictions.length > 0) {
        predictions.forEach((grid: any, index: number) => {
          if (grid && Array.isArray(grid) && grid.length > 0) {
            prompt += `Test ${index + 1} Predicted Output: ${JSON.stringify(grid)}\n`;
          } else {
            prompt += `Test ${index + 1} Predicted Output: No valid prediction\n`;
          }
        });
      } else {
        prompt += `No valid predictions were provided\n`;
      }
    } else {
      // Single-test puzzle - use predicted_output_grid
      const prediction = originalExplanation.predictedOutputGrid;

      if (prediction && Array.isArray(prediction) && prediction.length > 0) {
        prompt += `${JSON.stringify(prediction)}\n`;
      } else {
        prompt += `No valid prediction was provided\n`;
      }
    }
  }

  return prompt;
}

/**
 * Template mapping for different prompt types
 */
export const USER_TEMPLATE_BUILDERS = {
  solver: buildSolverUserPrompt,
  standardExplanation: buildExplanationUserPrompt,
  educationalApproach: buildExplanationUserPrompt,
  alienCommunication: buildAlienUserPrompt,
  gepa: buildSolverUserPrompt,
  debate: buildDebateUserPrompt
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
 * NOW includes task description in user prompt (refactored architecture)
 */
export function buildUserPromptForTemplate(
  task: ARCTask,
  promptId: string,
  options: UserPromptOptions = {},
  customText?: string,
  originalExplanation?: any,
  customChallenge?: string,
  taskDescription?: string  // NEW: Pass task description from TASK_DESCRIPTIONS
): string {
  // Handle custom prompt mode
  if (promptId === 'custom' && customText) {
    return buildCustomUserPrompt(task, customText, options);
  }

  // Handle debate mode with explanation context
  if (promptId === 'debate') {
    return buildDebateUserPrompt(task, options, originalExplanation, customChallenge, taskDescription);
  }

  // Handle discussion mode
  if (promptId === 'discussion') {
    return buildDiscussionUserPrompt(task, options, originalExplanation, customChallenge, taskDescription);
  }

  // Standard template builders with task description
  return buildUserPrompt(task, options, customText, taskDescription);
}