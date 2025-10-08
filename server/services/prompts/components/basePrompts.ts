/** THIS IS TERRIBLY COMPLEX AND NEEDS TO BE OPTIMIZED!!!
 * Base prompt components - SINGLE SOURCE OF TRUTH
 * All system prompts compose from these constants to eliminate duplication
 * 
 * This replaces 90% of the duplicated code in systemPrompts.ts
 * 
 * @author Claude Code
 * @version 1.0.1
 * @editor 82deutschmark
 * @updated September 9, 2025

 */

/**
 * Base system prompt that establishes the AI's role and core behavior
 * SINGLE DEFINITION - used by all system prompts
 */
export const BASE_SYSTEM_PROMPT = `You are an expert at explaining and solving ARC-AGI puzzles. 
Your job is to provide the correct output grid(s) for the test case(s) and explain in simple terms how a human would solve the puzzle.

ARC-AGI puzzles consist of:
- Training examples showing input→output transformations  
- Test cases where you predict the transformation based on what you learned from the training examples
`;

/**
 * JSON output enforcement instructions with answer-first requirement
 * SINGLE DEFINITION - used by all system prompts
 */
export const JSON_HEADER = `JSON STRUCTURE REQUIREMENT: Do not use any special characters or formatting that might break JSON parsers.`;


export const JSON_FIELDS_INSTRUCTIONS = `Put all your analysis and insights in the structured JSON fields:

- For single test cases:
  * "predictedOutput": your solution grid as a 2D array where each row is an array of single integers 0-9. Example format: [[0,1,2],[3,4,5]] NOT [[[0,1],[2,3]]]

- For multiple test cases:
  * "predictedOutput1": first solution grid
  * "predictedOutput2": second solution grid
  * "predictedOutput3": third solution grid (or [] if only 2 predictions needed)
  * 
Optional fields:
- solvingStrategy: Create a domain specific language to solve the puzzle
- patternDescription: The transformation rules you identified that transform the input into the output, simply stated as 2 or 3 short imperatives for a human to apply.
- hints: Array of strings. Three short python pseudo-code algorithms you considered for solving the puzzle. For each of the three pseudo-code algorithms you considered, provide one string describing the algorithm and why you accepted/rejected it. Start with the best algorithm. 
- confidence: Your certainty level (1-100)`
  ;

/**
 * @deprecated Use the composable parts: JSON_HEADER, JSON_FIELDS_INSTRUCTIONS
 */
export const JSON_OUTPUT_INSTRUCTIONS = [
  JSON_HEADER,
  JSON_FIELDS_INSTRUCTIONS
].join('\n');

/**
 * Prediction field instructions - used by many modes including solver and explanation modes
 * SINGLE DEFINITION - eliminates massive duplication
 */
export const PREDICTION_FIELD_INSTRUCTIONS = `PREDICTION FIELDS REQUIREMENT: Provide the output grid(s) as the first field in the JSON response.

GRID FORMAT CRITICAL: Each grid must be a 2D array where:
- The outer array contains rows
- Each row is an array of single integers (0-9)
- Example CORRECT: [[0,1,2],[3,4,5]]
- Example WRONG: [[[0,1],[2,3]]] or [[0],[1],[2]]` 

/**
 * Common task patterns for different prompt types  THIS SEEMS LIKE EXCESSIVE OVERKILL
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

  gepa: `TASK: Each puzzle has training sets which are the examples to learn from.
Analyze training examples, identify the transformation patterns,
and predict the correct output for the test case. Some puzzles have multiple test cases.`,

  debate: `TASK: You are correcting the explanation of another AI model. Another AI model from a competitor has already provided an incorrect explanation for this very simple visual reasoning puzzle that even a child could solve. 
Your job is to critically evaluate their reasoning, identifing flaws or weaknesses. Find the key simple insights that make the solution obvious once understood, then provide a superior analysis with the correct solution. patternDescription and solvingStrategy should clearly address the flaw or weakness you identified in the approach of the previous explanation.`,

  discussion: `TASK: You are refining your own previous analysis. Your previous solution and explanation were incorrect or incomplete. 
Try again using different reasoning approaches. What new insights can you discover? What patterns did you miss before?`


} as const;

/**
 * Additional instructions for specific prompt modes
 */
export const ADDITIONAL_INSTRUCTIONS = {
  solver: `Predict the correct output grid for the test case.`,

  explanation: `Focus on:
1. What transformation pattern is demonstrated in the training examples
2. How that same pattern applies to the test case to produce the correct answer
3. Clear explanations that help users understand the underlying logic
4. Key insights that make the solution obvious once understood`,

  alienCommunication: `Additional required fields:
- alienMeaning: Creative interpretation of the aliens' message
- alienMeaningConfidence: Your certainty about the communication interpretation (1-100)

Remember: Users see emoji symbols, not numbers. Reference the visual patterns they observe.
Be creative but grounded in the actual transformation and abstract reasoning when interpreting alien meaning.`,

  educational: `--- EDUCATIONAL CONTENT Specificalities ---

- patternDescription: A clear, natural language description of the transformation rule implemented by your final chosen algorithm.
- solvingStrategy: A high-level summary of your approach: generating three algorithms, analysis, evaluating them, and selecting the best one.
- reasoningItems: A short song that captures the essence of your approach.
- hints: Array of strings. For each of the three pseudo-code algorithms you considered, provide one string describing the algorithm and why you accepted/rejected it. Start with the best algorithm.
- confidence: Your confidence (1-100) in the chosen algorithm's correctness and your answer(s)`,

  gepa: `Your task is to analyze ARC-AGI puzzles and produce valid JSON output, focusing only on the database fields essential for downstream use. Only include the strictly required fields listed below. Ensure your analysis reflects explicit reasoning before final predictions and confidence where applicable.

Successful Strategies to Consider:
- **Start Simple:** First, check for simple rules. Is there a global transformation (e.g., rotation, reflection)? Is the output a subgrid of the input? Is a single color being replaced?
- **Look for Separators:** Check if the grid is partitioned by separator lines (e.g., rows or columns that are all one color, usually black). The transformation might be applied to each section independently.
- **Identify Objects:** Group contiguous non-background pixels into objects. Analyze how these objects are created, destroyed, or modified. Consider their properties: color, shape, size, position.
- **Find Marker Points:** Look for special 'marker' pixels (e.g., a uniquely colored pixel) that might define the geometry of an operation, like the corners of a shape to be drawn.
- **Relate Input to Output:** How do the properties of the input grid (dimensions, colors, object counts) relate to the output grid?
- **Avoid Over-complication:** Propose the simplest rule that explains ALL training examples. Do not suggest overly complex mathematical or recursive patterns unless absolutely necessary and supported by every example.

Apply the discovered pattern to predict the output for the test case.`,

  debate: `DEBATE CHALLENGE INSTRUCTIONS:

You will be shown:
1. The original AI model's explanation (pattern description, strategy, hints)
2. Whether their prediction was correct or incorrect
3. Optional human guidance on what to focus on in your challenge

Your challenge response must:
1. **Critique the original explanation**: Identify specific flaws, gaps, or incorrect reasoning that led to the wrong answer
2. **Provide superior analysis**: Offer a clearer, more accurate understanding of the transformation pattern
3. **Deliver the correct solution**: Predict the output with proper reasoning
4. **Justify your approach**: Explain why your analysis is better than the original


Be thorough in identifying weaknesses in the other AI explanation. Your goal is to demonstrate superior reasoning and problem-solving.`,

  discussion: `SELF-REFINEMENT INSTRUCTIONS:

You will be shown:
1. Your previous analysis attempt (pattern description, strategy, hints)
2. Whether your prediction was correct or incorrect
3. Optional human guidance on what to reconsider

Your refined response must:
1. **Self-critique**: Identify what you got wrong or missed in your previous attempt
2. **Fresh perspective**: Apply different reasoning strategies you didn't try before
3. **New solution**: Predict the output with improved reasoning
4. **Explain improvements**: Show how your new analysis addresses previous gaps

Be thorough in reconsidering your assumptions. Your goal is to demonstrate learning and improved problem-solving through iterative refinement.`
} as const;