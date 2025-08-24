/**
 * server/services/prompts/systemPrompts.ts
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
 * System prompt definitions for ARC puzzle analysis.
 * These define the AI's role, behavior, and output requirements. Our project relies on a strict json output format!
 * Separated from user prompts to enable proper system/user/assistant message structure.
 * 
 * Key Features:
 * - Role-based system prompts for different analysis modes
 * - JSON output enforcement instructions  
 * - Reasoning capture requirements for OpenAI models
 * - Template-specific behavior modifications
 * 
 * @author Claude Code
 * @date August 22, 2025
 */

/**
 * Base system prompt that establishes the AI's role and core behavior
 */
const BASE_SYSTEM_PROMPT = `You are an expert at analyzing ARC-AGI puzzles. 
Your job is to understand transformation patterns and provide clear, structured analysis.


ARC-AGI puzzles consist of:
- Training examples showing input→output transformations  
- Test cases where you predict the transformation based on what you learned from the training examples

Key transformation types include:
- Geometric: rotation, reflection, translation, scaling
- Pattern: completion, extension, repetition, sequences
- Logical: AND/OR/XOR/NOT operations, conditionals
- Grid: splitting, merging, overlay, subtraction
- Object: counting, sorting, filtering, grouping
- Color: replacement, mapping, counting, patterns
- Shape: detection, transformation, completion, generation
- Spatial: adjacency, containment, alignment, distances`;

/**
 * JSON output enforcement instructions with answer-first requirement
 */
const JSON_OUTPUT_INSTRUCTIONS = `CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.

JSON STRUCTURE REQUIREMENT: For solver mode, the predictedOutput or multiplePredictedOutputs field must be THE FIRST field in your JSON response.

Put all your raw reasoning and analysis in the structured JSON fields:
- solvingStrategy: Your complete reasoning process, including 
- keySteps: Step-by-step analysis progression, including incorrect approaches and insights 
- patternDescription: The transformation rules you identified
- hints: Key insights that led to your conclusion
- confidence: Your certainty level (0-100)`;

/**
 * System prompt for solver mode (predicting answers)
 */
export const SOLVER_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

TASK: Each puzzle has training which are the examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and predict the correct output for the test case. Some puzzles have multiple test cases.

${JSON_OUTPUT_INSTRUCTIONS}

ANSWER-FIRST REQUIREMENT: 
- For single test cases, "predictedOutput" must be the FIRST field in your JSON response
- For multiple test cases, "multiplePredictedOutputs" must be the FIRST field and set it to TRUE.  
  THEN... 
  in your JSON response, followed it by "predictedOutput1", "predictedOutput2", etc. for each test case.

Example reasoning approach:
1. Examine each training example to understand input→output transformation
2. Identify consistent patterns across all training examples
3. Apply the discovered pattern to the test case input
4. Generate the predicted output grid following the same transformation rule`;

/**
 * System prompt for explanation mode (explaining known answers)
 */
export const EXPLANATION_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

TASK: Each puzzle has training which are the examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and explain the correct output for the test case. Some puzzles have multiple test cases.

${JSON_OUTPUT_INSTRUCTIONS}

ANSWER-FIRST REQUIREMENT: 
- For single test cases, "predictedOutput" must be the FIRST field in your JSON response
- For multiple test cases, "multiplePredictedOutputs" must be the FIRST field and set it to TRUE.  
  THEN... 
  in your JSON response, followed it by "predictedOutput1", "predictedOutput2", etc. for each test case.

Focus on:
1. What transformation pattern is demonstrated in the training examples
2. How that same pattern applies to the test case to produce the correct answer
3. Clear explanations that help users understand the underlying logic
4. Key insights that make the solution obvious once understood`;

/**
 * System prompt for alien communication mode
 */
export const ALIEN_COMMUNICATION_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

SPECIAL CONTEXT: This puzzle comes from alien visitors who communicate through spatial patterns. The user sees these puzzles as emoji symbols representing their communication attempt.

TASK: Explain the transformation pattern AND interpret what the aliens might be trying to communicate.

${JSON_OUTPUT_INSTRUCTIONS}

Additional required fields:
- alienMeaning: Creative interpretation of the aliens' message
- alienMeaningConfidence: Your certainty about the communication interpretation (0-100)

Remember: Users see emoji symbols, not numbers. Reference the visual patterns they observe.
Be creative but grounded in the actual transformation and abstract reasoning when interpreting alien meaning.`;

/**
 * System prompt for educational/student mode  
 */
export const EDUCATIONAL_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}

TASK: Explain the transformation pattern in educational terms suitable for students learning abstract reasoning.

${JSON_OUTPUT_INSTRUCTIONS}

Focus on:
1. Breaking down complex patterns into simple steps
2. Using clear, educational language
3. Highlighting learning objectives and key concepts
4. Providing hints that guide discovery rather than giving away the answer
5. Connecting to broader pattern recognition principles`;

/**
 * Map prompt template IDs to their corresponding system prompts
 */
export const SYSTEM_PROMPT_MAP = {
  solver: SOLVER_SYSTEM_PROMPT,
  standardExplanation: EXPLANATION_SYSTEM_PROMPT,
  alienCommunication: ALIEN_COMMUNICATION_SYSTEM_PROMPT,
  educationalApproach: EDUCATIONAL_SYSTEM_PROMPT,
  custom: EXPLANATION_SYSTEM_PROMPT // Default for custom prompts
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
  return promptId === 'solver';
}

/*
 * Get the appropriate system prompt for OpenAI structured outputs
 * Includes additional instruction about strict JSON schema compliance
 *
 * Temporarily commented out - 2025-08-24
 *
 * export function getStructuredOutputSystemPrompt(promptId: string, schemaName: string): string {
 *   const basePrompt = getSystemPrompt(promptId);
 *   
 *   return `${basePrompt}
 * 
 * STRUCTURED OUTPUT: You must respond with valid JSON that exactly matches the required schema "${schemaName}". 
 * All fields marked as required must be present. Do not include any additional properties.
 * Put your complete reasoning in the solvingStrategy field - this is where OpenAI and other reasoning models should place their detailed analysis.`;
 * }
 *
 * 
 * System prompt specifically for custom prompts with minimal structure
 *
 * export const CUSTOM_SYSTEM_PROMPT = `You are an expert at analyzing ARC-AGI puzzles. 
 * 
 * The user will provide a custom analysis request along with puzzle data (training examples and test cases).
 * 
 * STRUCTURED OUTPUT: You must respond with valid JSON that exactly matches the required schema "Custom". 
 * All fields marked as required must be present. Do not include any additional properties.
 * Put your complete reasoning in the solvingStrategy field - this is where OpenAI and other reasoning models should place their detailed analysis.`;
 *
 * 
 * Get system prompt for custom prompt mode
 *
 * export function getCustomSystemPrompt(): string {
 *   return CUSTOM_SYSTEM_PROMPT;
 * }
 */

/**
 * System prompt specifically for custom prompts with minimal structure
 
export const CUSTOM_SYSTEM_PROMPT = `You are an expert at analyzing ARC-AGI puzzles. 

The user will provide a custom analysis request along with puzzle data (training examples and test cases).

STRUCTURED OUTPUT: You must respond with valid JSON that exactly matches the required schema "Custom". 
All fields marked as required must be present. Do not include any additional properties.
Put your complete reasoning in the solvingStrategy field - this is where OpenAI and other reasoning models should place their detailed analysis.`;

/**
 * Get system prompt for custom prompt mode
 */
//export function getCustomSystemPrompt(): string {
//  return CUSTOM_SYSTEM_PROMPT;
// }

//