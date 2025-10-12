/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11
 * PURPOSE: Core schema builder providing single source of truth for ARC puzzle prediction schemas.
 * Dynamically generates JSON schemas based on actual test count, eliminating cognitive overhead
 * from models having to handle unused fields. Adapts to what we KNOW (test count from puzzle data)
 * rather than forcing models to output empty arrays or handle boolean flags.
 * 
 * KEY PRINCIPLE: Only the prediction grids are REQUIRED. Everything else is optional analysis.
 * 
 * SRP/DRY check: Pass - Single responsibility (schema generation), used by all provider wrappers
 * shadcn/ui: N/A (backend schema utility)
 */

/**
 * Grid schema definition - 2D array of integers 0-9 representing ARC puzzle grids
 */
export const GRID_SCHEMA = {
  type: "array",
  items: {
    type: "array",
    items: {
      type: "integer",
      minimum: 0,
      maximum: 9
    }
  },
  description: "2D grid of integers 0-9 representing an ARC puzzle grid"
} as const;

/**
 * Optional analysis fields that models can provide but are not required
 * These provide helpful context but the ONLY critical output is the prediction grid(s)
 */
export const OPTIONAL_ANALYSIS_FIELDS = {
  solvingStrategy: {
    type: "string",
    description: "Clear explanation of your solving approach that even a child could apply to similar puzzles"
  },
  patternDescription: {
    type: "string",
    description: "Description of the transformation rules you observed (1-2 short sentences)"
  },
  hints: {
    type: "array",
    items: { type: "string" },
    description: "3 helpful hints for understanding the transformation"
  },
  confidence: {
    type: "integer",
    description: "Confidence level in solution correctness (1-100)"
  }
} as const;

/**
 * Build core prediction schema adapted to actual test count
 * 
 * This is the ONLY place that defines what prediction fields exist and which are required.
 * All provider-specific wrappers use this function.
 * 
 * @param testCount - Actual number of test cases in the puzzle (from task.test.length)
 * @param includeOptionalFields - Whether to include optional analysis fields in schema (default: false for OpenAI strict mode)
 * @returns Schema object with properties and required fields
 * 
 * @example Single test (strict mode):
 * buildCoreSchema(1, false) 
 * // Returns schema requiring only "predictedOutput"
 * 
 * @example Multiple tests with optional fields:
 * buildCoreSchema(2, true)
 * // Returns schema with predictedOutput1, predictedOutput2 + optional analysis fields
 * // OpenAI strict mode requires ALL fields to be in required array, so set includeOptionalFields=false
 */
export function buildCoreSchema(testCount: number, includeOptionalFields: boolean = false) {
  if (testCount === 1) {
    // Single test case: only one prediction field needed
    const properties: Record<string, any> = {
      predictedOutput: {
        ...GRID_SCHEMA,
        description: "Your predicted output grid for the test case (2D array of integers 0-9)"
      }
    };
    
    const required: string[] = ["predictedOutput"];
    
    // Add optional fields if requested (NOT for OpenAI strict mode)
    if (includeOptionalFields) {
      Object.assign(properties, OPTIONAL_ANALYSIS_FIELDS);
      // OpenAI strict mode: if field is in properties, it MUST be in required
      required.push(...Object.keys(OPTIONAL_ANALYSIS_FIELDS));
    }
    
    return {
      properties,
      required
    };
  } else {
    // Multiple test cases: create exactly the fields we need
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    // Generate predictedOutput1, predictedOutput2, etc. based on actual count
    for (let i = 1; i <= testCount; i++) {
      const fieldName = `predictedOutput${i}`;
      properties[fieldName] = {
        ...GRID_SCHEMA,
        description: `Your predicted output grid for test case ${i} (2D array of integers 0-9)`
      };
      required.push(fieldName);
    }
    
    // Add optional analysis fields if requested
    if (includeOptionalFields) {
      Object.assign(properties, OPTIONAL_ANALYSIS_FIELDS);
      // OpenAI strict mode: if field is in properties, it MUST be in required
      required.push(...Object.keys(OPTIONAL_ANALYSIS_FIELDS));
    }
    
    return {
      properties,
      required
    };
  }
}

/**
 * Get human-readable description of what the schema expects
 * Useful for logging and debugging
 */
export function getSchemaDescription(testCount: number): string {
  if (testCount === 1) {
    return "Single-test schema: requires 'predictedOutput' field";
  } else {
    const fields = Array.from({length: testCount}, (_, i) => `predictedOutput${i + 1}`).join(', ');
    return `Multi-test schema (${testCount} tests): requires ${fields}`;
  }
}
