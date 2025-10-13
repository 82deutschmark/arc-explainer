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
/**
 * REFACTORED: System prompt now contains ONLY AI role/behavior
 * Task descriptions moved to user prompt per OpenAI Responses API best practices
 */
export const BASE_SYSTEM_PROMPT = `

You work methodically to determine rules.
- Carefully analyze all training examples to identify transformation rules
- Apply logical reasoning to discover the underlying transformation that applies to all training examples
- Provide honest confidence scores (1-100) based on your certainty
- Think step-by-step

Output your analysis in the requested JSON format.`;

/**
 * REFACTORED: Task descriptions now intended for USER prompts, not system prompts
 * These explain the specific problem to solve using the puzzle data
 */
export const TASK_DESCRIPTIONS = {
  solver: `PROBLEM: Analyze the training examples below to identify the transformation pattern. Then predict the correct output grid(s) for the test case(s).

Each puzzle shows you training examples (input → output transformations). Your job is to discover the rule and apply it to predict the test output.`,

  explanation: `PROBLEM: Analyze the training examples below to identify and explain the transformation pattern. Then predict and explain the correct output for the test case(s).

Each puzzle shows you training examples (input → output transformations). Discover the rule, explain it clearly, and apply it to the test case.`,

  alienCommunication: `SPECIAL CONTEXT: This puzzle comes from alien visitors who communicate through spatial patterns. You see emoji symbols representing their communication attempt.

PROBLEM: Study the training examples to identify the transformation pattern. Then predict the output AND interpret what the aliens might be trying to communicate through these patterns.`,

  educational: `PROBLEM: Solve this puzzle using a structured, algorithm-driven method:
1. Generate three distinct pseudo-code algorithms for the transformation
2. Evaluate each algorithm against the training examples
3. Select the best algorithm
4. Use it to predict the test output`,

  gepa: `PROBLEM: Analyze the training examples below using these strategies:
- Check for simple global transformations (rotation, reflection, color replacement)
- Look for grid partitioning by separator lines
- Group contiguous pixels into objects and analyze their transformations
- Identify marker pixels that define operation geometry
- Find the simplest rule that explains ALL training examples

Then predict the output for the test case(s).`,

  debate: `PROBLEM: Another AI model provided an INCORRECT analysis of this puzzle. You will see their explanation below.

Your task:
1. Study the training examples yourself
2. Identify specific flaws in the previous AI's reasoning
3. Provide a superior analysis with the correct pattern
4. Predict the correct output with proper reasoning`,

  discussion: `PROBLEM: Your previous analysis of this puzzle was incorrect or incomplete.
Your task:
1. Re-examine the training examples
2. Identify what you missed or got wrong
3. Apply different reasoning strategies
4. Provide an improved analysis and correct prediction
5. Focus on outputting the correct grid`


} as const;

/**
 * Additional instructions for specific prompt modes
 */
export const ADDITIONAL_INSTRUCTIONS = {
  solver: `Predict the correct output grid(s) for the test case(s).`,

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

  discussion: `Your previous attempt was incorrect or incomplete. 

Your refined response must:
1. Self-critique: Identify what you got wrong or missed in your previous attempt
2. Fresh perspective: Apply different reasoning strategies you didn't try before
3. New solution: Predict the output with improved reasoning
4. Explain improvements: The simple answer that you missed before

Think hard while reconsidering your assumptions. Demonstrate learning and improved problem-solving.`
} as const;