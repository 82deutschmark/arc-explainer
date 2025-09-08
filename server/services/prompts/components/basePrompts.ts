/**
 * Base prompt components - SINGLE SOURCE OF TRUTH
 * All system prompts compose from these constants to eliminate duplication
 * 
 * This replaces 90% of the duplicated code in systemPrompts.ts
 * 
 * @author Claude Code
 * @date September 1, 2025
 */

/**
 * Base system prompt that establishes the AI's role and core behavior
 * SINGLE DEFINITION - used by all system prompts
 */
export const BASE_SYSTEM_PROMPT = `You are an expert at analyzing ARC-AGI puzzles. 
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
 * SINGLE DEFINITION - used by all system prompts
 */
export const JSON_HEADER = `CRITICAL: Return only valid JSON. No markdown formatting. No code blocks. No extra text.

JSON STRUCTURE REQUIREMENT: The predictedOutput or multiplePredictedOutputs field must be THE FIRST field in your JSON response.`;

export const JSON_REASONING_INSTRUCTION = `- reasoningItems: Array of strings detailing the step-by-step analysis, insights, and even incorrect approaches explored.`;

export const JSON_FIELDS_INSTRUCTIONS = `Put all your analysis and insights in the structured JSON fields:
- solvingStrategy: Create a domain specific language to solve the puzzle
- patternDescription: The transformation rules you identified, simply stated.
- hints: Array of strings. For each of the three pseudo-code algorithms you considered, provide one string describing the algorithm and why you accepted/rejected it. Start with the best algorithm. 
- confidence: Your certainty level (0-100)`;

/**
 * @deprecated Use the composable parts: JSON_HEADER, JSON_REASONING_INSTRUCTION, JSON_FIELDS_INSTRUCTIONS
 */
export const JSON_OUTPUT_INSTRUCTIONS = [
  JSON_HEADER,
  JSON_FIELDS_INSTRUCTIONS,
  JSON_REASONING_INSTRUCTION
].join('\n');

/**
 * Prediction field instructions - used by both solver and explanation modes
 * SINGLE DEFINITION - eliminates massive duplication
 */
export const PREDICTION_FIELD_INSTRUCTIONS = `PREDICTION FIELDS REQUIREMENT: 
- For single test cases: 
  * "multiplePredictedOutputs": false (must be first field)
  * "predictedOutput": your solution grid (2D array)
  * "predictedOutput1": [] (empty array)
  * "predictedOutput2": [] (empty array) 
  * "predictedOutput3": [] (empty array)
- For multiple test cases:
  * "multiplePredictedOutputs": true (must be first field)
  * "predictedOutput": [] (empty array)
  * "predictedOutput1": first solution grid
  * "predictedOutput2": second solution grid
  * "predictedOutput3": third solution grid (or [] if only 2 predictions needed)`;

/**
 * Common task patterns for different prompt types
 */
export const TASK_DESCRIPTIONS = {
  solver: `TASK: Each puzzle has training which are the examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and predict the correct output for the test case. Some puzzles have multiple test cases.`,

  explanation: `TASK: Each puzzle has training which are the examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and explain the correct output for the test case. Some puzzles have multiple test cases.`,

  alienCommunication: `SPECIAL CONTEXT: This puzzle comes from alien visitors who communicate through spatial patterns. The user sees these puzzles as emoji symbols representing their communication attempt.

TASK: Explain the transformation pattern AND interpret what the aliens might be trying to communicate.`,

  educational: `TASK: Your goal is to solve the puzzle using a structured, algorithm-driven educational method. You must generate three distinct pseudo-code algorithms, evaluate them, select the best one, and use it to generate the final answer.`,

  gepa: `TASK: Each puzzle has training which are the examples to learn from. 
Analyze training examples, identify the transformation patterns, 
and predict the correct output for the test case. Some puzzles have multiple test cases.`
} as const;

/**
 * Additional instructions for specific prompt modes
 */
export const ADDITIONAL_INSTRUCTIONS = {
  solver: `Example analysis approach:
1. Examine each training example to understand input→output transformation
2. Identify consistent patterns across all training examples
3. Apply the discovered pattern to the test case input
4. Generate the predicted output grid following the same transformation rule`,

  explanation: `Focus on:
1. What transformation pattern is demonstrated in the training examples
2. How that same pattern applies to the test case to produce the correct answer
3. Clear explanations that help users understand the underlying logic
4. Key insights that make the solution obvious once understood`,

  alienCommunication: `Additional required fields:
- alienMeaning: Creative interpretation of the aliens' message
- alienMeaningConfidence: Your certainty about the communication interpretation (0-100)

Remember: Users see emoji symbols, not numbers. Reference the visual patterns they observe.
Be creative but grounded in the actual transformation and abstract reasoning when interpreting alien meaning.`,

  educational: `--- EDUCATIONAL CONTENT Specificalities ---

- **patternDescription**: A clear, natural language description of the transformation rule implemented by your final chosen algorithm.
- **solvingStrategy**: A high-level summary of your approach: generating three algorithms, analysis, evaluating them, and selecting the best one.
- **reasoningItems**: A short song that captures the essence of your approach.
- **hints**: Array of strings. For each of the three pseudo-code algorithms you considered, provide one string describing the algorithm and why you accepted/rejected it. Start with the best algorithm.
- **confidence**: Your confidence (0-100) in the chosen algorithm's correctness and your answer(s)`,

  gepa: `**Successful Strategies to Consider:**
- **Start Simple:** First, check for simple rules. Is there a global transformation (e.g., rotation, reflection)? Is the output a subgrid of the input? Is a single color being replaced?
- **Look for Separators:** Check if the grid is partitioned by separator lines (e.g., rows or columns that are all one color, usually black). The transformation might be applied to each section independently.
- **Identify Objects:** Group contiguous non-background pixels into objects. Analyze how these objects are created, destroyed, or modified. Consider their properties: color, shape, size, position.
- **Find Marker Points:** Look for special 'marker' pixels (e.g., a uniquely colored pixel) that might define the geometry of an operation, like the corners of a shape to be drawn.
- **Relate Input to Output:** How do the properties of the input grid (dimensions, colors, object counts) relate to the output grid?
- **Avoid Over-complication:** Propose the simplest rule that explains ALL training examples. Do not suggest overly complex mathematical or recursive patterns unless absolutely necessary and supported by every example.

Apply the discovered pattern to predict the output for the test case.`
} as const;