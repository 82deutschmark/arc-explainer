/**
 * Author: Claude Code (original), Claude Code using Sonnet 4.5 (2025-09-30 audit & header update)
 * Date: 2025-08-22 (original), 2025-09-30 (audit completed)
 * PURPOSE: JSON schema definitions and validation functions for solver mode responses where AI
 * predicts puzzle answers. Enforces strict structure for OpenAI structured outputs and provides
 * validation for all providers. Critical for ensuring LLM responses contain properly formatted
 * prediction grids that can be extracted and validated against correct answers.
 *
 * AUDIT STATUS (2025-09-30): ✅ AUDITED - File reviewed as part of debate validation bug investigation.
 * No issues found in this file. The validation logic correctly handles single-test and multi-test
 * cases, supports both old (predictedOutputs) and new (multiplePredictedOutputs) field names for
 * backward compatibility, and properly extracts numbered prediction fields (predictedOutput1,
 * predictedOutput2, etc.) from multi-test responses.
 *
 * Key Features:
 * - Single-test schema (SINGLE_SOLVER_SCHEMA) for puzzles with one test case
 * - Multi-test schema (MULTI_SOLVER_SCHEMA) for puzzles with multiple test cases
 * - Schema selection helper (getSolverSchema) based on test case count
 * - Validation functions (validateSolverResponse, extractPredictions) for structure checking
 * - Grid validation (validateGrid) ensures 2D arrays of integers 0-9
 * - Backward compatibility with old 'predictedOutputs' field name
 * - Support for dynamic numbered fields (predictedOutput1, predictedOutput2, etc.)
 * - OpenAI structured outputs compatibility
 *
 * Used By:
 * - responseValidator.ts (imports extractPredictions for response parsing)
 * - All AI service providers for response structure enforcement
 * - Debate system for validating rebuttal predictions
 *
 * SRP/DRY check: Pass - Single responsibility (schema definition & validation for solver responses)
 */

import { 
  COMMON_PROPERTIES,
  PREDICTION_PROPERTIES,
  createSchema
} from './common.ts';

/**
 * JSON schema for single test case solver responses
 * NOTE: Supports multiple field names: predictedOutput, output, solution, answer, result
 * Field order does not matter - JSON parsers handle any order
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
 * NOTE: Supports multiple formats:
 * - multiplePredictedOutputs: true with numbered fields (predictedOutput1, predictedOutput2, etc.)
 * - Direct arrays in any field (output: [[grid1], [grid2]])
 * - Backward compatible with old predictedOutputs field
 * Field order does not matter - JSON parsers handle any order
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
  // Also support common field name aliases: output, solution, answer, result
  const singleFieldAliases = ['predictedOutput', 'output', 'solution', 'answer', 'result'];
  const hasSingle = singleFieldAliases.some(field => field in response);
  const hasNewMulti = 'multiplePredictedOutputs' in response;
  const hasOldMulti = 'predictedOutputs' in response; // For backward compatibility

  if (!hasSingle && !hasNewMulti && !hasOldMulti) {
    errors.push('Missing required prediction field (e.g., predictedOutput, output, solution, answer, result, multiplePredictedOutputs)');
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
  } else if (hasSingle) {
    // Find which single field alias was used
    const foundField = singleFieldAliases.find(field => response[field] != null);
    if (foundField && response[foundField] != null) {
      const fieldValue = response[foundField];

      // Handle array of grids (direct multi-test format using alias)
      if (Array.isArray(fieldValue) && fieldValue.every(item => validateGrid(item))) {
        predictedGrids = fieldValue;
      }
      // Handle single grid
      else if (validateGrid(fieldValue)) {
        predictedGrids = [fieldValue];
      }
      // Invalid grid format
      else {
        errors.push(`${foundField} is not a valid 2D grid of integers 0-9`);
      }
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
  console.log(`[EXTRACT] Extracting predictions for ${testCaseCount} test cases from response keys:`, Object.keys(response || {}));
  
  // Handle new multi-output format - check for boolean true flag or array
  if (response?.multiplePredictedOutputs === true || (response?.multiplePredictedOutputs && Array.isArray(response.multiplePredictedOutputs))) {
    const collectedGrids = [];
    let i = 1;
    
    // First try to collect individual numbered fields (predictedOutput1, predictedOutput2, etc.)
    while (`predictedOutput${i}` in response) {
      const grid = response[`predictedOutput${i}`];
      if (validateGrid(grid)) {
        collectedGrids.push(grid);
      }
      i++;
    }
    
    // If we found numbered fields, return them
    if (collectedGrids.length > 0) {
      console.log(`[EXTRACT] Found ${collectedGrids.length} grids from numbered fields`);
      return { predictedOutputs: collectedGrids };
    }
    
    // Fallback to the main array if individual keys are missing and it's an array
    if (Array.isArray(response.multiplePredictedOutputs)) {
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
        console.log(`[EXTRACT] Found ${extractedGrids.length} grids from array format`);
        return { predictedOutputs: extractedGrids };
    }
    
    console.log(`[EXTRACT] No valid grids found in multiplePredictedOutputs format`);
    return { predictedOutputs: [] };
  }

  // Handle old multi-output format for backward compatibility
  if (Array.isArray(response?.predictedOutputs)) {
    return { predictedOutputs: response.predictedOutputs };
  }

  // Handle single output format or TestCase array format with flexible field names
  // Support common aliases: predictedOutput, output, solution, answer, result
  const singleFieldNames = ['predictedOutput', 'output', 'solution', 'answer', 'result'];
  const foundField = singleFieldNames.find(name => response?.[name]);

  if (foundField && response[foundField]) {
    const fieldValue = response[foundField];

    // Log which field name was used (helpful for monitoring)
    if (foundField !== 'predictedOutput') {
      console.log(`[EXTRACT] Using alias field '${foundField}' as prediction`);
    }

    // Check if it's an array (could be multi-test or TestCase format)
    if (Array.isArray(fieldValue)) {
      // Check if it's an array of valid grids (direct multi-test format)
      if (fieldValue.every(item => validateGrid(item))) {
        console.log(`[EXTRACT] Found ${fieldValue.length} grids from direct array in '${foundField}'`);
        return { predictedOutputs: fieldValue };
      }

      // Check if it's an array of TestCase objects (OpenAI multi-test format)
      const extractedGrids = [];
      for (const item of fieldValue) {
        if (item && typeof item === 'object' && item.output) {
          // Extract the output grid from TestCase format: { "TestCase": 1, "output": [...] }
          if (validateGrid(item.output)) {
            extractedGrids.push(item.output);
          }
        } else if (validateGrid(item)) {
          // Direct grid format in array
          extractedGrids.push(item);
        }
      }

      if (extractedGrids.length > 0) {
        console.log(`[EXTRACT] Found ${extractedGrids.length} grids from TestCase format in '${foundField}'`);
        return { predictedOutputs: extractedGrids };
      }
    }

    // Handle single grid format
    if (validateGrid(fieldValue)) {
      return testCaseCount > 1
        ? { predictedOutputs: [fieldValue] }
        : { predictedOutput: fieldValue };
    }
  }

  console.log(`[EXTRACT] No valid prediction fields found. Checked: ${singleFieldNames.join(', ')}`);
  return {};
}

/**
 * Create a sample solver response for documentation/testing
 */
export function createSampleSolverResponse(testCaseCount: number = 1) {
  const base = {
    solvingStrategy: "Let me analyze this step by step:\n\n1. Looking at the training examples, I notice that each input grid undergoes a 90-degree clockwise rotation.\n2. In example 1: the 2x2 pattern [[1,0],[0,1]] becomes [[0,1],[1,0]] when rotated.\n3. This pattern is consistent across all training examples.\n4. Applying this transformation to the test input: I rotate the entire grid 90 degrees clockwise.\n5. The colors remain unchanged, only the spatial arrangement changes.\n\nTherefore, the solution involves applying this geometric transformation rule.",
    reasoningItems: [
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