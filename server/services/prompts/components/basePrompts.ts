/**
 * server/services/prompts/components/basePrompts.ts
 * 
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-10-08 (Cleaned up)
 * 
 * PURPOSE:
 * Base prompt components providing TASK_DESCRIPTIONS and ADDITIONAL_INSTRUCTIONS
 * for all prompt modes. Single source of truth for mode-specific content.
 * 
 * CLEANUP HISTORY (Oct 8, 2025):
 * - Removed deprecated JSON constants (moved to jsonInstructions.ts)
 * - Consolidated ARC structure explanation (was repeated 3x, now DRY)
 * - Reduced file from 158 lines to ~110 lines
 * 
 * SRP/DRY Check: PASS (Improved)
 * - Single responsibility: Mode definitions for system prompts
 * - JSON rules moved to jsonInstructions.ts (DRY)
 * - ARC structure consolidated into ARC_STRUCTURE constant (DRY)
 * 
 * FUTURE OPTIMIZATION (Phase 3):
 * - Could merge TASK_DESCRIPTIONS and ADDITIONAL_INSTRUCTIONS into MODE_REGISTRY
 * - Could extract mode configs to separate mode definition files
 * - Not urgent - current structure is maintainable
 */
export const BASE_SYSTEM_PROMPT = `Use careful reasoning and think hard about your answer.
`;

/**
 * Common ARC structure explanation - DRY compliance
 * Used across multiple task descriptions to maintain consistency
 */
const ARC_STRUCTURE = `Each puzzle has training examples (the examples to learn from). Analyze training examples, identify the transformation patterns`;

/**
 * Common task patterns for different prompt types
 * NOTE: JSON formatting rules have been moved to jsonInstructions.ts for DRY compliance
 */
export const TASK_DESCRIPTIONS = {
  solver: `TASK: ${ARC_STRUCTURE}, and predict the correct output for the test case. Some puzzles have multiple test cases.`,

  explanation: `TASK: ${ARC_STRUCTURE}, and explain the correct output for the test case. Some puzzles have multiple test cases.`,

  alienCommunication: `SPECIAL CONTEXT: This puzzle comes from alien visitors who communicate through spatial patterns. The user sees these puzzles as emoji symbols representing their communication attempt.

TASK: Explain the transformation pattern AND interpret what the aliens might be trying to communicate.`,

  educational: `TASK: Your goal is to solve the puzzle using a structured, algorithm-driven educational method. You must generate three distinct pseudo-code algorithms, evaluate them, select the best one, and use it to generate the final answer.`,

  gepa: `TASK: ${ARC_STRUCTURE}, and predict the correct output for the test case. Some puzzles have multiple test cases.`,

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
- First, check for simple rules. Is there a global transformation (e.g., rotation, reflection)? Is the output a subgrid of the input? Is a single color being replaced?
- Check if the grid is partitioned by separator lines (e.g., rows or columns that are all one color, usually black). The transformation might be applied to each section independently.
- Group contiguous non-background pixels into objects. Analyze how these objects are created, destroyed, or modified. Consider their properties: color, shape, size, position.
- Look for special 'marker' pixels (e.g., a uniquely colored pixel) that might define the geometry of an operation, like the corners of a shape to be drawn.
- How do the properties of the input grid (dimensions, colors, object counts) relate to the output grid?
-  Propose the simplest rule that explains ALL training examples. Do not suggest overly complex mathematical or recursive patterns unless absolutely necessary and supported by every example.

Apply the discovered pattern to predict the output for the test case.`,

  debate: `DEBATE CHALLENGE INSTRUCTIONS:

You will be shown:
1. The original AI model's explanation (pattern description, strategy, hints)
2. Whether their prediction was correct or incorrect
3. Optional human guidance on what to focus on in your challenge

Your challenge response must:
1.Critique the original explanation: Identify specific flaws, gaps, or incorrect reasoning that led to the wrong answer
2. Provide superior analysis: Offer a clearer, more accurate understanding of the transformation pattern
3. Deliver the correct solution: Predict the output with proper reasoning
4. Justify your approach: Explain why your analysis is better than the original


Be thorough in identifying weaknesses in the other AI explanation. Your goal is to demonstrate superior reasoning and problem-solving.`,

  discussion: `SELF-REFINEMENT INSTRUCTIONS:

You will be shown:
1. Your previous analysis attempt (pattern description, strategy, hints)
2. Whether your prediction was correct or incorrect
3. Optional human guidance on what to reconsider

Your refined response must:
1. Self-critique: Identify what you got wrong or missed in your previous attempt
2. Fresh perspective: Apply different reasoning strategies you didn't try before
3. New solution: Predict the output with improved reasoning
4. Explain improvements: Show how your new analysis addresses previous gaps

Be thorough in reconsidering your assumptions. Your goal is to demonstrate learning and improved problem-solving through iterative refinement.`
} as const;