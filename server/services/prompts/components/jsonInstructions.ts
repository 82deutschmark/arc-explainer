/**
 * server/services/prompts/components/jsonInstructions.ts
 * 
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-10-08
 * 
 * PURPOSE: 
 * Single source of truth for JSON output formatting rules.
 * Eliminates redundant grid format examples and JSON structure warnings
 * that were scattered across basePrompts.ts (lines 30, 33-47, 62-68)
 * and promptBuilder.ts (lines 128-131).
 * 
 * SRP/DRY Check: PASS
 * - Single responsibility: JSON output format specifications
 * - Eliminates 3 duplicate grid format examples
 * - Consolidates 3 scattered JSON structure warnings
 * 
 * Referenced Issues:
 * - docs/08102025-Prompt-Architecture-Analysis.md Section 3
 * - User concern: "Grid format repeated 3 times in single prompt"
 */

/**
 * Grid format specification - SINGLE DEFINITION
 * Used across all prompt modes to ensure consistent grid formatting
 */
export const GRID_FORMAT = {
  description: 'Each grid must be a 2D array where outer array contains rows, each row is array of integers 0-9',
  exampleCorrect: '[[0,1,2],[3,4,5]]',
  examplesWrong: ['[[[0,1],[2,3]]]', '[[0],[1],[2]]'],
  
  // Generate formatted instruction text
  toInstruction(): string {
    return `Grid format: 2D array where outer array contains rows, each row is array of integers 0-9
  * Example CORRECT: ${this.exampleCorrect}
  * Example WRONG: ${this.examplesWrong.join(' or ')}`;
  }
};

/**
 * JSON structure requirements - SINGLE DEFINITION
 * Ensures valid JSON output without markdown or code blocks
 */
export const JSON_STRUCTURE = {
  warning: 'Return valid JSON only (no markdown, code blocks, or special characters)',
  answerFirst: 'Put the prediction field FIRST in your JSON response',
  
  // Generate formatted instruction text
  toInstruction(): string {
    return `${this.warning}. ${this.answerFirst}.`;
  }
};

/**
 * Field definitions for JSON response
 */
export const JSON_FIELDS = {
  prediction: {
    single: 'predictedOutput',
    multi: ['predictedOutput1', 'predictedOutput2', 'predictedOutput3']
  },
  optional: [
    'solvingStrategy: Domain-specific language to solve the puzzle',
    'patternDescription: Transformation rules (2-3 short imperatives)',
    'hints: Array of 3 simple hints so even a child could understand how to solve the puzzle',
    'confidence: Your certainty level (1-100)'
  ],
  
  // Generate formatted instruction text
  toInstruction(isMultiTest: boolean = false): string {
    if (isMultiTest) {
      return `- Multi-test predictions: "${this.prediction.multi.join('", "')}"
- Optional: ${this.optional.join(', ')}`;
    }
    return `- Single-test prediction: "${this.prediction.single}": ${GRID_FORMAT.exampleCorrect}
- Optional: ${this.optional.join(', ')}`;
  }
};

/**
 * Build complete JSON instructions (consolidated from 3 separate constants)
 * Replaces: JSON_HEADER, JSON_FIELDS_INSTRUCTIONS, PREDICTION_FIELD_INSTRUCTIONS
 * 
 * @param includeExamples - Include grid format examples (default: true)
 * @param isMultiTest - Whether puzzle has multiple test cases (default: false)
 */
export function buildJsonInstructions(
  includeExamples: boolean = true,
  isMultiTest: boolean = false
): string {
  const parts = [
    `JSON OUTPUT REQUIREMENTS:`,
    `- ${JSON_STRUCTURE.warning}`,
    `- ${JSON_STRUCTURE.answerFirst}`,
  ];
  
  if (includeExamples) {
    parts.push(`- Grid format: 2D array where outer array contains rows, each row is array of integers 0-9`);
    
    // CRITICAL: Explain both single and multi-test scenarios
    parts.push(`- If puzzle has ONE test case:`);
    parts.push(`  Use field "predictedOutput" with your grid: ${GRID_FORMAT.exampleCorrect}`);
    parts.push(`- If puzzle has MULTIPLE test cases (2 or 3):`);
    parts.push(`  Use fields "predictedOutput1", "predictedOutput2", "predictedOutput3"`);
    parts.push(`  Provide a grid for EACH test case you see in the puzzle`);
  }
  
  parts.push(`- Optional fields: ${JSON_FIELDS.optional.map(f => f.split(':')[0]).join(', ')}`);
  
  // Enhanced: Add strict JSON enforcement for problematic models
  parts.push(`CRITICAL: Return ONLY valid JSON with no additional text, explanations, or formatting after the closing brace.`);
  
  return parts.join('\n');
}

/**
 * Build minimal JSON instructions for custom prompts
 * Replaces logic in promptBuilder.ts buildCustomPrompt()
 */
export function buildMinimalJsonInstructions(): string {
  return [
    JSON_STRUCTURE.toInstruction(),
    `Grid format: ${GRID_FORMAT.exampleCorrect}`,
    `IMPORTANT: Return ONLY valid JSON. Do not add explanatory text, comments, or markdown formatting after the JSON.`
  ].join('\n');
}
