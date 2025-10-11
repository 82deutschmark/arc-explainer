/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11
 * PURPOSE: Grok (xAI) specific schema wrapper for Responses API structured output.
 * Wraps core schema with xAI's required format: {schema} (no name/strict wrapper).
 * Dynamically generates schema based on test count.
 * 
 * CRITICAL: Grok does NOT support min/max constraints on integers - uses simple { type: "integer" }
 * 
 * SRP/DRY check: Pass - Thin wrapper around core schema, single responsibility
 * shadcn/ui: N/A (backend schema utility)
 */

import { OPTIONAL_ANALYSIS_FIELDS } from '../core.js';

/**
 * Grid schema for Grok - NO min/max constraints (Grok doesn't support them)
 */
const GROK_GRID_SCHEMA = {
  type: "array",
  items: {
    type: "array",
    items: { type: "integer" }  // No minimum/maximum - Grok limitation
  }
} as const;

/**
 * Generate xAI Responses API compatible schema for ARC puzzle analysis
 * 
 * xAI uses simplified format without name/strict wrapper:
 * - schema: The actual JSON schema object (direct)
 * 
 * Used in response_format as:
 * response_format: { type: "json_schema", json_schema: getGrokSchema(testCount).schema }
 * 
 * @param testCount - Number of test cases in puzzle (from task.test.length)
 * @returns xAI-formatted schema object ready for Responses API
 * 
 * @example
 * const schema = getGrokSchema(2);
 * // Use in API call:
 * response_format: { type: "json_schema", json_schema: schema.schema }
 */
export function getGrokSchema(testCount: number) {
  const properties: Record<string, any> = {};
  const required: string[] = [];
  
  if (testCount === 1) {
    // Single test case
    properties.predictedOutput = {
      ...GROK_GRID_SCHEMA,
      description: "Your predicted output grid for the test case as a 2D array of integers."
    };
    required.push("predictedOutput");
  } else {
    // Multiple test cases - generate numbered fields
    for (let i = 1; i <= testCount; i++) {
      const fieldName = `predictedOutput${i}`;
      properties[fieldName] = {
        ...GROK_GRID_SCHEMA,
        description: `Your predicted output grid for test case ${i} as a 2D array of integers.`
      };
      required.push(fieldName);
    }
  }
  
  // Add optional analysis fields
  Object.assign(properties, OPTIONAL_ANALYSIS_FIELDS);
  
  return {
    schema: {
      type: "object",
      additionalProperties: false,
      properties,
      required
    }
  };
}

/**
 * Legacy export for backward compatibility
 * @deprecated Use getGrokSchema() function instead
 */
export const GROK_JSON_SCHEMA = {
  _deprecated: true,
  _message: "Use getGrokSchema(testCount) for dynamic schema generation"
};
