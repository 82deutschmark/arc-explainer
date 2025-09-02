/**
 * server/services/schemas/common.ts
 * 
 * Shared JSON schema components and utilities for ARC puzzle analysis responses.
 * Used across solver and explanation modes to ensure consistent structure.
 * 
 * Key Features:
 * - Common field definitions (confidence, grids, arrays)
 * - Schema validation utilities
 * - Type-safe JSON schema construction
 * - OpenAI structured outputs compatibility
 * 
 * @author Claude Code
 * @date August 22, 2025
 */

/**
 * Common JSON schema properties used across all response types
 */
export const COMMON_PROPERTIES = {
  // Core analysis fields
  solvingStrategy: {
    type: "string",
    description: "Detailed reasoning and analysis process. For OpenAI reasoning models, this captures the complete reasoning log."
  },
  reasoningItems: {
    type: "array",
    items: { type: "string" },
    description: "Step-by-step breadcrumbs showing the analysis progression"
  },
  confidence: {
    type: "integer",
    minimum: 0,
    maximum: 100,
    description: "Confidence score from 0-100 about the analysis accuracy"
  },
  patternDescription: {
    type: "string", 
    description: "Clear description of the transformation rules learned from training examples"
  },
  hints: {
    type: "array",
    items: { type: "string" },
    maxItems: 5,
    description: "Key insights and observations that led to the solution"
  }
} as const;

/**
 * Grid schema for 2D integer arrays (ARC puzzle grids)
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
 * Prediction fields for solver mode
 */
export const PREDICTION_PROPERTIES = {
  predictedOutput: {
    ...GRID_SCHEMA,
    description: "Single predicted output grid for solver mode (2D array of integers 0-9)"
  },
  predictedOutputs: {
    type: "array",
    items: GRID_SCHEMA,
    description: "Multiple predicted output grids for multi-test cases (array of 2D grids)"
  }
} as const;

/**
 * Alien communication specific fields
 */
export const ALIEN_PROPERTIES = {
  alienMeaning: {
    type: "string",
    description: "Creative interpretation of what the aliens might be trying to communicate"
  },
  alienMeaningConfidence: {
    type: "integer",
    minimum: 0,
    maximum: 100,
    description: "Confidence score for the alien communication interpretation"
  }
} as const;

/**
 * Base schema structure that all response schemas inherit from
 */
export const BASE_SCHEMA_STRUCTURE = {
  type: "object",
  additionalProperties: false,
  required: ["solvingStrategy", "confidence", "patternDescription", "hints"]
} as const;

/**
 * Create a complete JSON schema with the given properties and required fields
 */
export function createSchema(
  properties: Record<string, any>,
  required: string[],
  schemaName: string
) {
  return {
    name: schemaName,
    strict: true,
    schema: {
      ...BASE_SCHEMA_STRUCTURE,
      properties,
      required: [...BASE_SCHEMA_STRUCTURE.required, ...required]
    }
  };
}

/**
 * Validate that a response object matches expected schema structure
 */
export function validateResponseStructure(
  response: any,
  requiredFields: string[]
): { isValid: boolean; missingFields: string[] } {
  if (!response || typeof response !== 'object') {
    return { isValid: false, missingFields: requiredFields };
  }
  
  const missingFields = requiredFields.filter(field => !(field in response));
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Extract reasoning information from structured response
 */
export function extractReasoningLog(response: any): {
  reasoningLog: string;
  reasoningItems: string[];
} {
  const reasoningLog = response.solvingStrategy || '';
  const reasoningItems = response.reasoningItems || [];
  
  return {
    reasoningLog,
    reasoningItems
  };
}

/**
 * Common schema validation error messages
 */
export const SCHEMA_ERRORS = {
  MISSING_FIELDS: (fields: string[]) => `Missing required fields: ${fields.join(', ')}`,
  INVALID_TYPE: (field: string, expected: string) => `Field '${field}' must be of type ${expected}`,
  INVALID_CONFIDENCE: 'Confidence must be an integer between 0 and 100',
  INVALID_GRID: 'Grid must be a 2D array of integers 0-9',
  PARSE_ERROR: 'Response is not valid JSON'
} as const;