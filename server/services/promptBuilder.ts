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
 * @author Claude 4 Sonnet Thinking
 */

import { ARCTask, PROMPT_TEMPLATES, PromptTemplate } from "../../shared/types";

/**
 * Emoji mapping for the alien communication template
 * Uses the legacy_default emoji set from the client-side emoji system
 */
const ALIEN_COMMUNICATION_EMOJI_MAP = {
  0: '⬛', // no/nothing/negative
  1: '✅', // yes/positive/agreement  
  2: '👽', // alien/them/we
  3: '👤', // human/us/you
  4: '🪐', // their planet/home
  5: '🌍', // human planet/Earth
  6: '🛸', // their ships/travel
  7: '☄️', // danger/bad/problem
  8: '♥', // peace/friendship/good
  9: '⚠️', // warning/attention/important
};

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
 * Convert numeric grid to emoji representation for alien communication template
 */
function convertGridToEmojis(grid: number[][]): string[][] {
  return grid.map(row => 
    row.map(cell => ALIEN_COMMUNICATION_EMOJI_MAP[cell as keyof typeof ALIEN_COMMUNICATION_EMOJI_MAP] || '❓')
  );
}

/**
 * Format training examples based on template requirements
 */
function formatTrainingExamples(task: ARCTask, useEmojis: boolean): string {
  return task.train
    .map((example, i) => {
      if (useEmojis) {
        const emojiInput = convertGridToEmojis(example.input);
        const emojiOutput = convertGridToEmojis(example.output);
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
function formatTestCase(task: ARCTask, useEmojis: boolean): { input: string, output: string } {
  if (useEmojis) {
    const emojiInput = convertGridToEmojis(task.test[0].input);
    const emojiOutput = convertGridToEmojis(task.test[0].output);
    return {
      input: JSON.stringify(emojiInput),
      output: JSON.stringify(emojiOutput)
    };
  } else {
    return {
      input: JSON.stringify(task.test[0].input),
      output: JSON.stringify(task.test[0].output)
    };
  }
}

/**
 * Get emoji map section for alien communication template
 */
function getEmojiMapSection(): string {
  return `

4. The aliens gave us this emoji map of the numbers 0-9. Recognize that the user sees the numbers 0-9 map to emojis like this:

0: ⬛ (no/nothing/negative)
1: ✅ (yes/positive/agreement)
2: 👽 (alien/them/we)
3: 👤 (human/us/you)
4: 🪐 (their planet/home)
5: 🌍 (human planet/Earth)
6: 🛸 (their ships/travel)
7: ☄️ (danger/bad/problem)
8: ♥ (peace/friendship/good)
9: ⚠️ (warning/attention/important)`;
}

/**
 * Get JSON response format based on template
 */
function getJsonResponseFormat(selectedTemplate: PromptTemplate | null): object {
  const isAlienCommunication = selectedTemplate?.emojiMapIncluded || false;
  
  if (isAlienCommunication) {
    return {
      "patternDescription": "What the aliens are trying to communicate to us through this puzzle",
      "solvingStrategy": "Step-by-step how to solve it, for novices. If they need to switch to thinking of the puzzle as numbers and not emojis, then mention that!",
      "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
      "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation"
    };
  } else {
    return {
      "patternDescription": "Clear description of the pattern or transformation rule",
      "solvingStrategy": "Step-by-step how to solve it, for novices to understand",
      "hints": ["Key insight 1", "Key insight 2", "Key insight 3"],
      "confidence": "A confidence score between 0 and 100, how sure you are about your answer and your explanation"
    };
  }
}

/**
 * Build complete prompt for AI analysis
 */
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "standardExplanation",
  customPrompt?: string
): {
  prompt: string;
  selectedTemplate: PromptTemplate | null;
} {
  // Use custom prompt if provided, otherwise use selected template
  let basePrompt: string;
  let selectedTemplate: PromptTemplate | null = null;
  
  if (customPrompt) {
    basePrompt = customPrompt;
    console.log(`[PromptBuilder] Using custom prompt (${customPrompt.length} characters)`);
  } else {
    selectedTemplate = PROMPT_TEMPLATES[promptId] || PROMPT_TEMPLATES.standardExplanation;
    basePrompt = selectedTemplate.content;
    console.log(`[PromptBuilder] Using prompt template: ${selectedTemplate.name} (${promptId})`);
  }
  
  // Determine if we should use emojis (only for alienCommunication template)
  const useEmojis = selectedTemplate?.emojiMapIncluded || false;
  
  // Format data based on emoji requirements
  const trainingExamples = formatTrainingExamples(task, useEmojis);
  const testCase = formatTestCase(task, useEmojis);
  
  // Build sections conditionally
  const emojiMapSection = useEmojis ? getEmojiMapSection() : '';
  
  const trainingLabel = useEmojis 
    ? "TRAINING EXAMPLES (what the aliens taught us):"
    : "TRAINING EXAMPLES:";
    
  const testLabel = useEmojis 
    ? "TEST CASE (the aliens' question and our correct answer, but we don't understand why the answer is correct):"
    : "TEST CASE (input and correct answer for analysis):";
    
  const analysisInstructions = useEmojis
    ? "2. Explain it in simple terms an idiot could understand. The user sees the puzzle as emojis, NOT AS NUMBERS.\n3. Make a creative guess for the user about what the aliens might be trying to communicate based on the transformation type you think is involved."
    : "2. Explain it in simple terms for novices to understand.";
    
  const responsePrefix = useEmojis ? "Respond" : "Please respond";
  
  // Build complete prompt
  const prompt = `${basePrompt}

${trainingLabel}
${trainingExamples}

${testLabel}
Input: ${testCase.input}
Correct Answer: ${testCase.output}

Your job:
1. Speculate about WHY this solution is correct by understanding these critical concepts:
${ARC_TRANSFORMATIONS}

${analysisInstructions}${emojiMapSection}

${responsePrefix} in this JSON format:
${JSON.stringify(getJsonResponseFormat(selectedTemplate), null, 2)}`;

  return {
    prompt,
    selectedTemplate
  };
}

/**
 * Get default prompt ID that uses numeric grids (not emojis)
 */
export function getDefaultPromptId(): string {
  return "standardExplanation";
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
