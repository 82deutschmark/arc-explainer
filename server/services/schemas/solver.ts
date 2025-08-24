/**
 * server/services/schemas/solver.ts
 * 
 * JSON schema for solver mode responses where AI predicts puzzle answers.
 * Enforces strict structure for OpenAI structured outputs and provides
 * validation for other providers.
 * 
 * Key Features:
 * - Prediction fields (predictedOutput/predictedOutputs)
 * - Reasoning capture in structured format
 * - Single and multi-test case support
 * - OpenAI structured outputs compatibility
 * 
 * @author Claude Code
 * @date August 22, 2025
 */

import { 
  COMMON_PROPERTIES,
  PREDICTION_PROPERTIES,
  createSchema
} from './common.js';

/**
 * JSON schema for single test case solver responses
 * NOTE: predictedOutput should be first field per system prompt instructions
 */
export const SINGLE_SOLVER_SCHEMA = createSchema(
  {
    predictedOutput: PREDICTION_PROPERTIES.predictedOutput,
    ...COMMON_PROPERTIES
  },
  ["predictedOutput"], // Additional required fields beyond base
  "arc_solver_single"
);

/**
 * JSON schema for multi test case solver responses
 * NOTE: predictedOutputs should be first field per system prompt instructions  
 */
/**
 * JSON schema for multi test case solver responses
 * NOTE: multiplePredictedOutputs should be first field per system prompt instructions
 * The schema also allows for dynamic keys like predictedOutput1, predictedOutput2, etc.
 * which are handled in the custom validation logic.
 */
export const MULTI_SOLVER_SCHEMA = createSchema(
  {
    multiplePredictedOutputs: PREDICTION_PROPERTIES.predictedOutputs, // Renamed from predictedOutputs
    ...COMMON_PROPERTIES
  },
  ["multiplePredictedOutputs"], // Additional required fields beyond base
  "arc_solver_multi"
);

/**
 * Select appropriate solver schema based on test case count
 */
export function getSolverSchema(testCaseCount: number) {
  return testCaseCount > 1 ? MULTI_SOLVER_SCHEMA : SINGLE_SOLVER_SCHEMA;
}

/**
 * Validate solver response structure
 */
export function validateSolverResponse(response: any, testCaseCount: number): {
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
  
  // Check required base fields
  const requiredFields = ['solvingStrategy', 'confidence', 'patternDescription', 'hints'];
  const missingBase = requiredFields.filter(field => !(field in response));
  if (missingBase.length > 0) {
    errors.push(`Missing required fields: ${missingBase.join(', ')}`);
  }
  
  // Check prediction fields: accept single, new multi, or old multi format
  const hasSingle = 'predictedOutput' in response;
  const hasNewMulti = 'multiplePredictedOutputs' in response;
  const hasOldMulti = 'predictedOutputs' in response; // For backward compatibility

  if (!hasSingle && !hasNewMulti && !hasOldMulti) {
    errors.push('Missing required prediction field (e.g., predictedOutput, multiplePredictedOutputs)');
  } else if (hasNewMulti) {
    const collectedGrids = [];
    let i = 1;
    while (`predictedOutput${i}` in response) {
      const grid = response[`predictedOutput${i}`];
      if (validateGrid(grid)) {
        collectedGrids.push(grid);
      } else {
        errors.push(`predictedOutput${i} is not a valid 2D grid of integers 0-9`);
      }
      i++;
    }
    if (collectedGrids.length === 0 && Array.isArray(response.multiplePredictedOutputs)) {
        // Fallback to the main array if individual ones aren't found
        for (let j = 0; j < response.multiplePredictedOutputs.length; j++) {
            const grid = response.multiplePredictedOutputs[j];
            if (!validateGrid(grid)) {
                errors.push(`multiplePredictedOutputs[${j}] is not a valid 2D grid of integers 0-9`);
            } else {
                collectedGrids.push(grid);
            }
        }
    }
    if (errors.length === 0) {
      predictedGrids = collectedGrids;
    }
  } else if (hasOldMulti && Array.isArray(response.predictedOutputs)) {
    // Handle old format for backward compatibility
    for (let i = 0; i < response.predictedOutputs.length; i++) {
      const grid = response.predictedOutputs[i];
      if (!validateGrid(grid)) {
        errors.push(`predictedOutputs[${i}] is not a valid 2D grid of integers 0-9`);
      }
    }
    if (errors.length === 0) {
      predictedGrids = response.predictedOutputs;
    }
  } else if (hasSingle && response.predictedOutput != null) {
    if (!validateGrid(response.predictedOutput)) {
      errors.push('predictedOutput is not a valid 2D grid of integers 0-9');
    } else {
      predictedGrids = [response.predictedOutput];
    }
  }
  
  // Validate confidence
  if (typeof response.confidence !== 'number' || response.confidence < 0 || response.confidence > 100) {
    errors.push('confidence must be a number between 0 and 100');
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
  if (!Array.isArray(grid)) return false;
  
  for (const row of grid) {
    if (!Array.isArray(row)) return false;
    for (const cell of row) {
      if (!Number.isInteger(cell) || cell < 0 || cell > 9) return false;
    }
  }
  
  return true;
}

/**
 * Extract prediction data from validated solver response
 */
export function extractPredictions(response: any, testCaseCount: number): {
  predictedOutput?: number[][];
  predictedOutputs?: number[][][];
} {
  // Handle new multi-output format
  if (response?.multiplePredictedOutputs) {
    const collectedGrids = [];
    let i = 1;
    console.log(`[EXTRACT-DEBUG] Looking for individual predictedOutput fields, expected testCaseCount: ${testCaseCount}`);
    while (`predictedOutput${i}` in response) {
      const grid = response[`predictedOutput${i}`];
      console.log(`[EXTRACT-DEBUG] Found predictedOutput${i}, validating...`);
      if (validateGrid(grid)) {
        console.log(`[EXTRACT-DEBUG] predictedOutput${i} is valid, adding to collection`);
        collectedGrids.push(grid);
      } else {
        console.log(`[EXTRACT-DEBUG] predictedOutput${i} failed validation:`, grid);
      }
      i++;
    }
    console.log(`[EXTRACT-DEBUG] Collected ${collectedGrids.length} grids from individual fields`);
    // Fallback to the main array if individual keys are missing
    if (collectedGrids.length === 0 && Array.isArray(response.multiplePredictedOutputs)) {
        // Check if it's structured format with testCase/predictedOutput objects
        const extractedGrids = [];
        for (const item of response.multiplePredictedOutputs) {
          if (item && typeof item === 'object' && item.predictedOutput) {
            // Extract the predictedOutput grid from structured format
            if (validateGrid(item.predictedOutput)) {
              extractedGrids.push(item.predictedOutput);
            }
          } else if (validateGrid(item)) {
            // Direct grid format
            extractedGrids.push(item);
          }
        }
        return { predictedOutputs: extractedGrids };
    }
    return { predictedOutputs: collectedGrids };
  }

  // Handle old multi-output format for backward compatibility
  if (Array.isArray(response?.predictedOutputs)) {
    return { predictedOutputs: response.predictedOutputs };
  }

  // Handle single output format
  if (response?.predictedOutput) {
    return testCaseCount > 1
      ? { predictedOutputs: [response.predictedOutput] }
      : { predictedOutput: response.predictedOutput };
  }

  return {};
}

/**
 * Create a sample solver response for documentation/testing
 */
export function createSampleSolverResponse(testCaseCount: number = 1) {
  const base = {
    solvingStrategy: "I analyzed the training examples and found a pattern where...",
    keySteps: [
      "Identified transformation pattern in training examples",
      "Applied pattern logic to test case input", 
      "Generated predicted output grid"
    ],
    confidence: 73,
    patternDescription: "The rule transforms input by rotating 90 degrees clockwise",
    hints: [
      "Pattern involves geometric rotation",
      "All training examples follow same rotation rule",
      "Colors remain unchanged during transformation"
    ]
  };
  
  if (testCaseCount > 1) {
    return {
      ...base,
      predictedOutputs: [
        [[1, 0], [1, 1]],
        [[0, 1], [1, 0]]
      ]
    };
  } else {
    return {
      ...base,
      predictedOutput: [[1, 0], [1, 1]]
    };
  }
}