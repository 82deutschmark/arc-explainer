/**
 * JSON Schema for GEPA (Grid-Explicit Pattern Analysis) mode
 * 
 * GEPA mode focuses on essential database fields with explicit reasoning
 * and confidence. Uses different field naming conventions from standard
 * ARC schema for better downstream compatibility.
 * 
 * Key Differences from Standard Schema:
 * - Uses 'predicted_output_grid' instead of 'predictedOutput' for single test cases
 * - Minimal required fields focused on core prediction and confidence
 * - Optional pattern_description limited to 50 words
 * 
 * @author Cascade
 * @date September 8, 2025
 */

export const GEPA_JSON_SCHEMA = {
  name: "gepa_analysis",
  strict: true,
  schema: {
    type: "object",
    properties: {
      // Multi-prediction flag - must be first field
      multiplePredictedOutputs: {
        type: "boolean",
        description: "false for single-test puzzles; true for puzzles with multiple test cases"
      },
      
      // Single test case output (when multiplePredictedOutputs = false)
      predicted_output_grid: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "The predicted output grid (2D array) for single test case puzzles"
      },
      
      // Multiple test case outputs (when multiplePredictedOutputs = true)
      predictedOutput1: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "First predicted output grid for multiple test case puzzles, empty array if unused"
      },
      predictedOutput2: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Second predicted output grid for multiple test case puzzles, empty array if unused"
      },
      predictedOutput3: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Third predicted output grid for multiple test case puzzles, empty array if unused"
      },
      
      // Required confidence field
      confidence: {
        type: "integer",
        description: "Certainty level in predictions (0-100)"
      },
      
      // Optional explanatory text (limited to 50 words)
      pattern_description: {
        type: "string",
        description: "Brief explanation of the transformation pattern (50 words or less)"
      }
    },
    required: [
      "multiplePredictedOutputs",
      "predicted_output_grid",
      "predictedOutput1",
      "predictedOutput2", 
      "predictedOutput3",
      "confidence"
    ],
    additionalProperties: false
  }
} as const;

/**
 * Validate GEPA mode response structure
 */
export function validateGepaResponse(response: any): {
  isValid: boolean;
  errors: string[];
  predictedGrids: number[][][] | null;
} {
  const errors: string[] = [];
  let predictedGrids: number[][][] | null = null;
  
  if (!response || typeof response !== 'object') {
    errors.push('Response must be a JSON object');
    return { isValid: false, errors, predictedGrids };
  }
  
  // Check multiplePredictedOutputs flag
  if (typeof response.multiplePredictedOutputs !== 'boolean') {
    errors.push('multiplePredictedOutputs must be a boolean');
    return { isValid: false, errors, predictedGrids };
  }
  
  // Validate confidence
  if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 100) {
    errors.push('confidence must be a number between 0 and 100');
  }
  
  // Validate prediction fields based on multiplePredictedOutputs flag
  if (response.multiplePredictedOutputs === false) {
    // Single test case - validate predicted_output_grid
    if (!validateGrid(response.predicted_output_grid)) {
      errors.push('predicted_output_grid is not a valid 2D grid of integers 0-9');
    } else {
      predictedGrids = [response.predicted_output_grid];
    }
    
    // Ensure multiple output fields are empty arrays
    if (!Array.isArray(response.predictedOutput1) || response.predictedOutput1.length > 0) {
      errors.push('predictedOutput1 must be empty array for single test cases');
    }
    if (!Array.isArray(response.predictedOutput2) || response.predictedOutput2.length > 0) {
      errors.push('predictedOutput2 must be empty array for single test cases');
    }
    if (!Array.isArray(response.predictedOutput3) || response.predictedOutput3.length > 0) {
      errors.push('predictedOutput3 must be empty array for single test cases');
    }
  } else {
    // Multiple test cases - validate predictedOutput1, predictedOutput2, predictedOutput3
    const collectedGrids: number[][][] = [];
    
    if (validateGrid(response.predictedOutput1)) {
      collectedGrids.push(response.predictedOutput1);
    } else if (Array.isArray(response.predictedOutput1) && response.predictedOutput1.length > 0) {
      errors.push('predictedOutput1 is not a valid 2D grid of integers 0-9');
    }
    
    if (validateGrid(response.predictedOutput2)) {
      collectedGrids.push(response.predictedOutput2);
    } else if (Array.isArray(response.predictedOutput2) && response.predictedOutput2.length > 0) {
      errors.push('predictedOutput2 is not a valid 2D grid of integers 0-9');
    }
    
    if (validateGrid(response.predictedOutput3)) {
      collectedGrids.push(response.predictedOutput3);
    } else if (Array.isArray(response.predictedOutput3) && response.predictedOutput3.length > 0) {
      errors.push('predictedOutput3 is not a valid 2D grid of integers 0-9');
    }
    
    if (collectedGrids.length === 0) {
      errors.push('At least one valid prediction grid required for multiple test cases');
    } else {
      predictedGrids = collectedGrids;
    }
    
    // Ensure predicted_output_grid is empty array
    if (!Array.isArray(response.predicted_output_grid) || response.predicted_output_grid.length > 0) {
      errors.push('predicted_output_grid must be empty array for multiple test cases');
    }
  }
  
  // Validate optional pattern_description (50 words max)
  if (response.pattern_description !== undefined) {
    if (typeof response.pattern_description !== 'string') {
      errors.push('pattern_description must be a string');
    } else {
      const wordCount = response.pattern_description.trim().split(/\s+/).length;
      if (wordCount > 50) {
        errors.push('pattern_description must be 50 words or less');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    predictedGrids
  };
}

/**
 * Validate that a value is a proper ARC grid (2D array of integers 0-9)
 */
function validateGrid(grid: any): grid is number[][] {
  if (!Array.isArray(grid) || grid.length === 0) return false;
  
  for (const row of grid) {
    if (!Array.isArray(row) || row.length === 0) return false;
    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) return false;
    }
  }
  
  return true;
}

/**
 * Extract prediction data from validated GEPA response
 */
export function extractGepaPredictions(response: any): {
  predictedOutput?: number[][];
  predictedOutputs?: number[][][];
} {
  if (!response) return {};
  
  if (response.multiplePredictedOutputs === false) {
    // Single test case
    return { predictedOutput: response.predicted_output_grid };
  } else {
    // Multiple test cases - collect non-empty grids
    const grids: number[][][] = [];
    
    if (validateGrid(response.predictedOutput1)) {
      grids.push(response.predictedOutput1);
    }
    if (validateGrid(response.predictedOutput2)) {
      grids.push(response.predictedOutput2);
    }
    if (validateGrid(response.predictedOutput3)) {
      grids.push(response.predictedOutput3);
    }
    
    return { predictedOutputs: grids };
  }
}

/**
 * Create GEPA instructions for prompt construction
 */
export const GEPA_SCHEMA_INSTRUCTIONS = `Your task is to analyze ARC-AGI puzzles and produce valid JSON output, focusing only on the database fields essential for downstream use. Only include the strictly required fields listed below. Ensure your analysis reflects explicit reasoning before final predictions and confidence where applicable.

**Required JSON Fields (strictly in this order):**
1. \`multiplePredictedOutputs\`: boolean — \`false\` for single-test puzzles; \`true\` for puzzles with multiple test cases.
2. For single-test cases:
   - \`predicted_output_grid\`: The predicted output grid (2D array) corresponding to the answer.
   For multiple-test cases:
   - \`predictedOutput1\`, \`predictedOutput2\`, \`predictedOutput3\`: The predicted grids for up to three test cases, using empty arrays (\`[]\`) for unused slots.
3. \`confidence\`: An integer (0–100) representing your certainty in the predictions.

**Output Field Rules:**
- For single test case puzzles:
  - Set \`"multiplePredictedOutputs": false\`.
  - Set \`"predicted_output_grid"\` to the predicted output (2D array).
  - Omit \`predictedOutput1\`, \`predictedOutput2\`, \`predictedOutput3\`.
- For puzzles with multiple test cases:
  - Set \`"multiplePredictedOutputs": true\`.
  - Set \`"predictedOutput1"\`, \`"predictedOutput2"\`, \`"predictedOutput3"\` to the corresponding output grid for each test case (up to three).
  - Use an empty array (\`[]\`) for any unused \`predictedOutput\` fields.
  - Omit \`predicted_output_grid\`.
- Always include \`"confidence"\` as the next field as a number between 1 and 100
- You may include an explanatory text of 50 words or less in the \`pattern_description\` as a text object.`;
