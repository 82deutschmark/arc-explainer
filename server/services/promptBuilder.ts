/**
 * server/services/promptBuilder.ts
 * 
 * Centralized prompt construction service for ARC-AGI puzzle analysis.
 * Handles template selection, emoji mapping, and prompt formatting across all AI providers.
 * This eliminates code duplication and provides a single source of truth for prompt logic.
 * 
 * Key Features:
 * - Unified prompt construction logic for all AI services
 * - Emoji mapping only for "alienCommunication" template
 * - Raw numeric grids for all other templates and custom prompts
 * - Integration with existing spaceEmojis system
 * - Template-specific formatting and JSON response structures
 * 
 * Additions: Dynamic emoji palette selection and optional omission of the 'Correct Answer' section
 * (researcher options), implemented by Cascade using GPT-5 (medium reasoning).
 * 
 * Original Author: Claude 4 Sonnet Thinking
 * Recent Changes Author: Cascade using GPT-5 (medium reasoning)
 */

import { ARCTask, PROMPT_TEMPLATES, PromptTemplate } from "../../shared/types";

/**
 * PromptOptions
 * 
 * Shared options passed from controllers/services to the prompt builder.
 * Centralizing this type avoids hardcoding option shapes across provider services.
 * Added by Cascade using GPT-5 (medium reasoning).
 */
export type PromptOptions = {
  emojiSetKey?: string;
  omitAnswer?: boolean;
};

/**
 * Server-side emoji palette registry.
 * Matches keys defined in `client/src/lib/spaceEmojis.ts`.
 * Default remains legacy_default for backward compatibility.
 * Added by Cascade using GPT-5 (medium reasoning).
 */
const SERVER_SPACE_EMOJI_SETS: Record<string, string[]> = {
  legacy_default: ['⬛', '✅', '👽', '👤', '🪐', '🌍', '🛸', '☄️', '♥️', '⚠️'],
  alien_language: ['🈵', '☮', '🈳', '🚯', '✴', '❗', '💹', '💟', '🔜', '🤗'],
  celestial_set1: ['⬛', '🌍', '🌎', '🌏', '⭐', '🌟', '✨', '💫', '🌠', '🪐'],
  celestial_set2: ['⬛', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '☀️'],
  tech_set1: ['⬛', '⚡', '🔋', '🔌', '⛽', '☢️', '⚛️', '🔗', '⚙️', '🔧'],
  tech_set2: ['⬛', '📡', '🛰️', '📱', '⌨️', '📶', '📋', '💻', '🎚️', '🎧'],
  nav_alerts: ['⬛', '⬆️', '⬇️', '⬅️', '➡️', '↗️', '↖️', '↘️', '↙️', '🧭'],
  status_alerts: ['⬛', '✅', '❌', '⚠️', '🚨', '🦺', '🔥', '❄️', '📍', '🎯'],
  weather_climate: ['⬛', '🌞', '🌝', '🌛', '🌜', '🌧️', '⛈️', '🌩️', '🌨️', '❄️'],
  status_emojis: ['⬛', '😂', '😶', '😐', '🙄', '😴', '😵', '🤗', '🤔', '😣'],
  ai_emojis: ['⬛', '🤖', '💡', '🧠', '🔗', '⚙️', '🔧', '🔄', '⚡', '🚫'],
  vague_symbols: ['⬛', '♊', '💕', '💢', '🆎', '🆒', '🈚', '🛃', '💠', '☣'],
  arc_colors: ['⬛', '🟦', '🟥', '🟩', '🟨', '⬜', '🟪', '🟧', '🟫', '🀄'],
  mahjong: ['⬛', '🀇', '🀈', '🀉', '🀊', '🀋', '🀌', '🀍', '🀎', '🀏'],
};

/** Get a specific emoji set by key, defaulting to legacy_default */
function getEmojiSetByKey(key?: string): string[] {
  if (key && SERVER_SPACE_EMOJI_SETS[key]) return SERVER_SPACE_EMOJI_SETS[key];
  return SERVER_SPACE_EMOJI_SETS["legacy_default"]; // fallback
}

/**
 * ARC-AGI transformation types reference for all prompts
 */
const ARC_TRANSFORMATIONS = `# ARC-AGI Transformation Types

## Geometric Transformations
- Rotation (90°, 180°, 270°)
- Reflection (horizontal, vertical, diagonal)
- Translation (moving objects)
- Scaling (resize objects)

## Pattern Operations
- Pattern completion
- Pattern extension
- Pattern repetition
- Sequence prediction

## Logical Operations
- AND operations
- OR operations
- XOR operations
- NOT operations
- Conditional logic

## Grid Operations
- Grid splitting (horizontal, vertical, quadrant)
- Grid merging
- Grid overlay
- Grid subtraction

## Object Manipulation
- Object counting
- Object sorting
- Object filtering
- Object grouping

## Color Operations
- Color replacement
- Color mapping
- Color counting
- Color patterns

## Shape Operations
- Shape detection
- Shape transformation
- Shape completion
- Shape generation

## Spatial Relations
- Adjacency rules
- Containment
- Alignment
- Distance relationships

## Sequential Logic
- Temporal patterns
- Step-by-step transformations
- Progressive changes
- Rule application order`;

/**
 * Convert numeric grid to emoji representation using a provided palette (length-10 array).
 * Added by Cascade using GPT-5 (medium reasoning).
 */
function convertGridToEmojis(grid: number[][], emojiSet: string[]): string[][] {
  return grid.map(row => row.map(cell => emojiSet[cell] ?? '❓'));
}

/**
 * Format training examples based on template requirements
 */
function formatTrainingExamples(task: ARCTask, useEmojis: boolean, emojiSet?: string[]): string {
  return task.train
    .map((example, i) => {
      if (useEmojis) {
        const emojiInput = convertGridToEmojis(example.input, emojiSet ?? getEmojiSetByKey());
        const emojiOutput = convertGridToEmojis(example.output, emojiSet ?? getEmojiSetByKey());
        return `Example ${i + 1}:\nInput: ${JSON.stringify(emojiInput)}\nOutput: ${JSON.stringify(emojiOutput)}`;
      } else {
        return `Example ${i + 1}:\nInput: ${JSON.stringify(example.input)}\nOutput: ${JSON.stringify(example.output)}`;
      }
    })
    .join("\n\n");
}

/**
 * Format test case based on template requirements
 */
function formatTestCase(task: ARCTask, useEmojis: boolean, emojiSet?: string[]): { input: string, output: string } {
  if (useEmojis) {
    const emojiInput = convertGridToEmojis(task.test[0].input, emojiSet ?? getEmojiSetByKey());
    const emojiOutput = convertGridToEmojis(task.test[0].output, emojiSet ?? getEmojiSetByKey());
    return { input: JSON.stringify(emojiInput), output: JSON.stringify(emojiOutput) };
  } else {
    return { input: JSON.stringify(task.test[0].input), output: JSON.stringify(task.test[0].output) };
  }
}

/**
 * Build an emoji map section dynamically for the selected palette (0..9 listing).
 * Simplified to avoid hardcoded semantic labels that may not match custom palettes.
 * Added by Cascade using GPT-5 (medium reasoning).
 */
function getEmojiMapSection(emojiSet: string[]): string {
  const lines = emojiSet.map((e, i) => `${i}: ${e}`);
  return `

4. The aliens gave us this emoji map of the numbers 0-9. Recognize that the user sees the numbers 0-9 map to emojis like this:

${lines.join("\n")}`;
}

/**
 * Get JSON response format based on template
 */
function getJsonResponseFormat(selectedTemplate: PromptTemplate | null): object {
  const isAlienCommunication = selectedTemplate?.emojiMapIncluded || false;
  
  if (isAlienCommunication) {
    return {
      "patternDescription": "What the aliens are trying to communicate to us through this puzzle, based on the ARC-AGI transformation types",
      "solvingStrategy": "Step-by-step explain the thinking and reasoning required to solve this puzzle, for novices. If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
      "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
      "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation",
      "alienMeaning": "The aliens' message",
      "alienMeaningConfidence": "A confidence score between 0 and 100, how sure you are about the aliens' message"
    };
  } else {
    return {
      "patternDescription": "Clear description of the rules learned from the training examples",
      "solvingStrategy": "Explain the thinking and reasoning required to solve this puzzle, not specific steps",
      "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
      "confidence": "A confidence score between 0 and 100, how sure you are about your explanation and the transformation rules being applied"
    };
  }
}

/**
 * Get JSON response format for solver mode (predicting answers)
 * Uses same format as explanation mode for frontend compatibility
 */
function getSolverResponseFormat(): object {
  return {
    "patternDescription": "Clear description of what was learned from training examples",
    "solvingStrategy": "Step-by-step reasoning used to predict the answer, including the predicted output grid as a 2D array",
    "hints": [
      "Key reasoning insight 1",
      "Key reasoning insight 2", 
      "Key reasoning insight 3"
    ],
    "confidence": "A confidence score between 0 and 100, how sure you are about your predicted answer"
  };
}

/**
 * Build complete prompt for AI analysis
 */
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options?: PromptOptions
): {
  prompt: string;
  selectedTemplate: PromptTemplate | null;
} {
  // DEBUG: Log all parameters
  console.log(`[PromptBuilder] DEBUG - promptId: "${promptId}", customPrompt length: ${customPrompt?.length || 0}`);
  
  // Handle custom prompt - ONLY custom text + raw puzzle data, NO template wrapping
  if (promptId === "custom" || (customPrompt && customPrompt.trim())) {
    console.log(`[PromptBuilder] ✅ CUSTOM PROMPT DETECTED - RAW MODE ACTIVATED`);
    console.log(`[PromptBuilder] promptId === "custom": ${promptId === "custom"}`);
    console.log(`[PromptBuilder] customPrompt exists: ${!!(customPrompt && customPrompt.trim())}`);
    
    // If no custom prompt text provided, return just the puzzle data
    const customText = customPrompt && customPrompt.trim() ? customPrompt : "";
    
    // For custom prompts, use raw numeric grids (no emojis, no formatting)
    const trainingExamples = formatTrainingExamples(task, false);
    const testCase = formatTestCase(task, false);
    
    // Simple, clean format for custom prompts - ONLY custom text + raw puzzle data
    const prompt = customText ? 
      `${customText}

TRAINING EXAMPLES:
${trainingExamples}

TEST CASE:
Input: ${testCase.input}
Correct Answer: ${testCase.output}` :
      `TRAINING EXAMPLES:
${trainingExamples}

TEST CASE:
Input: ${testCase.input}
Correct Answer: ${testCase.output}`;

    console.log(`[PromptBuilder] ✅ RETURNING CUSTOM PROMPT (${prompt.length} chars) - NO TEMPLATE INSTRUCTIONS`);
    return {
      prompt,
      selectedTemplate: null // No template for custom prompts
    };
  }
  
  console.log(`[PromptBuilder] 📋 CUSTOM PROMPT NOT DETECTED - USING TEMPLATE MODE 📋`);

  // Use template-based prompt (existing logic)
  const selectedTemplate = PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation;
  const basePrompt = selectedTemplate.content;
  console.log(`[PromptBuilder] Using prompt template: ${selectedTemplate.name} (${promptId})`);
  
  // Determine if we should use emojis (only for alienCommunication template)
  const useEmojis = selectedTemplate?.emojiMapIncluded || false;
  // Resolve selected emoji palette for emoji-enabled templates
  const selectedEmojiSet = useEmojis ? getEmojiSetByKey(options?.emojiSetKey) : undefined;
  
  // Check if this is solver mode (no correct answer provided)
  const isSolverMode = promptId === "solver";
  // Researcher option: omit the explicit Correct Answer line in explanation mode
  const omitAnswer = !!options?.omitAnswer && !isSolverMode;
  
  // Format data based on emoji requirements
  const trainingExamples = formatTrainingExamples(task, useEmojis, selectedEmojiSet);
  const testCase = formatTestCase(task, useEmojis, selectedEmojiSet);
  
  // Build sections conditionally
  const emojiMapSection = useEmojis ? getEmojiMapSection(selectedEmojiSet!) : '';
  
  const trainingLabel = useEmojis 
    ? "TRAINING EXAMPLES (what the aliens taught us):"
    : "TRAINING EXAMPLES:";
    
  // Different test labels for solver vs explanation mode
  const testLabel = isSolverMode 
    ? "1. Analyze the transformations from the training examples.\n2. Apply what you learned to predict the correct answer that will satisfy the `Output` grid for the test case and output it in the same format as the `Input` grid at the top of your reply.\n3. Explain your reasoning step by step in simple terms anyone could understand.\n4. Explain why you are sure or unsure about your answer."
    : omitAnswer
      ? (useEmojis
          ? "TEST CASE (the aliens' question; correct answer withheld):"
          : "TEST CASE (input only; correct answer withheld):")
      : (useEmojis 
          ? "TEST CASE (the aliens' question and our correct answer, but we don't understand why the answer is correct):"
          : "TEST CASE (input and correct answer for analysis):");
      
  // Different instructions for solver vs explanation mode
  const analysisInstructions = isSolverMode
    ? "1. Analyze the transformations from the training examples.\n2. Apply what you learned to predict the correct answer that will satisfy the `Output` grid for the test case and output it in the same format as the `Input` grid at the top of your reply.\n3. Explain your reasoning step by step.\n4. Explain why you are sure or unsure about your answer. \n5. Here is the test input, now predict the output grid."
    : useEmojis
      ? "2. Explain it in simple terms anyone could understand. The user sees the puzzle as emojis, NOT AS NUMBERS.\n3. Make a creative guess for the user about what the aliens might be trying to communicate based on the transformation type you think is involved."
      : "2. Explain it in simple terms for novices to understand.";
      
  const responsePrefix = useEmojis ? "Respond" : "Please respond";
  
  // Build complete prompt - different format for solver mode
  let prompt: string;
  
  if (isSolverMode) {
    // Solver mode: NO correct answer provided, ask AI to predict
    prompt = `${basePrompt}

${trainingLabel}
${trainingExamples}

${testLabel}
Input: ${testCase.input}

Your task:
${analysisInstructions}

Reply with your prediction of the test output grid. 
If you are able to, consider including:
- Pattern Description: What you learned from the training examples
- Solving Strategy: Your reasoning process, briefly 
- Key Insights: Important observations that led to your conclusion
- Confidence: How sure you are about your prediction

Example JSON structure (optional):
${JSON.stringify(getSolverResponseFormat(), null, 2)}`;
  } else {
    // Explanation mode: correct answer provided, ask AI to explain
    prompt = `${basePrompt}

${trainingLabel}
${trainingExamples}

${testLabel}
Input: ${testCase.input}
${omitAnswer ? '' : `Correct Answer: ${testCase.output}`}

Your job:
1. Speculate about WHY this solution is correct by understanding these critical concepts:
${ARC_TRANSFORMATIONS}

${analysisInstructions}${emojiMapSection}

Reply with your prediction of the test output grid. 
If you are able to, consider including:
- Pattern Description: What you learned from the training examples
- Solving Strategy: Your reasoning process, briefly 
- Key Insights: Important observations that led to your conclusion
- Confidence: How sure you are about your prediction

Example JSON structure (optional):
${JSON.stringify(getJsonResponseFormat(selectedTemplate), null, 2)}`;
  }

  return {
    prompt,
    selectedTemplate
  };
}

/**
 * Get default prompt ID that uses numeric grids (not emojis)
 */
export function getDefaultPromptId(): string {
  return "solver";
}

/**
 * Check if a prompt uses emoji mapping
 */
export function promptUsesEmojis(promptId: string, customPrompt?: string): boolean {
  if (customPrompt) {
    return false; // Custom prompts never use emojis
  }
  
  const template = PROMPT_TEMPLATES[promptId];
  return template?.emojiMapIncluded || false;
}
