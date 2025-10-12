/**
 * server/services/prompts/components/jsonInstructions.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11
 * 
 * PURPOSE:
 * Context-aware JSON instruction builder that adapts to:
 * 1. Test count (single vs multi-test puzzles)
 * 2. Provider capabilities (structured output vs prompt-based)
 * 
 * For structured output providers (OpenAI, Grok): Minimal instructions (schema enforces structure)
 * For prompt-based providers (Anthropic, Gemini, DeepSeek): Detailed field-specific instructions
 * 
 * SRP/DRY Check: PASS - Single responsibility (JSON format instructions generation)
 */

/**
 * Build context-aware JSON instructions based on test count and provider capabilities
 * 
 * @param testCount - Number of test cases in the puzzle (from task.test.length)
 * @param hasStructuredOutput - Whether provider uses structured output (schema enforcement)
 * @returns JSON format instructions string
 */
export function buildJsonInstructions(testCount: number, hasStructuredOutput: boolean): string {
  // Structured output providers have schema enforcement - minimal instructions needed
  if (hasStructuredOutput) {
    return buildMinimalJsonInstructions();
  }
  
  // Prompt-based providers need detailed field-specific instructions
  return buildDetailedJsonInstructions(testCount);
}

/**
 * Minimal JSON instructions for structured output providers (OpenAI, Grok)
 * Schema handles structure enforcement - just remind about JSON format
 */
export function buildMinimalJsonInstructions(): string {
  return `OUTPUT FORMAT: Return ONLY valid JSON. Your response must be parseable JSON with all required fields.`;
}

/**
 * Detailed JSON instructions for prompt-based providers (Anthropic, Gemini, DeepSeek)
 * Must explicitly describe all fields since no schema enforcement exists
 */
function buildDetailedJsonInstructions(testCount: number): string {
  const predictionFields = buildPredictionFieldInstructions(testCount);
  
  return `OUTPUT FORMAT: Return ONLY valid JSON with the following structure:

${predictionFields}

Analysis Fields (optional but recommended):
- "solvingStrategy": Clear explanation of your solving approach
- "patternDescription": Description of transformation rules (1-2 sentences)
- "hints": Array of 3 helpful hints for understanding the transformation
- "confidence": Integer 1-100 indicating confidence in solution correctness

CRITICAL: Your entire response must be valid, parseable JSON. Do not include markdown, explanations, or text outside the JSON object.`;
}

/**
 * Build prediction field instructions based on test count
 */
function buildPredictionFieldInstructions(testCount: number): string {
  if (testCount === 1) {
    return `Required Prediction Field:
"predictedOutput" - Your predicted output grid as 2D array of integers 0-9`;
  } else {
    const fields = Array.from({length: testCount}, (_, i) => 
      `"predictedOutput${i + 1}" - Your predicted output grid for test case ${i + 1} (2D array of integers 0-9)`
    ).join('\n');
    
    return `Required Prediction Fields (one per test case):
${fields}`;
  }
}
