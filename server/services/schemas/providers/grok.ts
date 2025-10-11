/**
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11
 * PURPOSE: Grok (xAI) specific schema wrapper for Responses API structured output.
 * Wraps core schema with xAI's required format: {schema} (no name/strict wrapper).
 * Dynamically generates schema based on test count.
 * 
 * SRP/DRY check: Pass - Thin wrapper around core schema, single responsibility
 * shadcn/ui: N/A (backend schema utility)
 */

import { buildCoreSchema, getSchemaDescription } from '../core.js';

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
  const core = buildCoreSchema(testCount);
  
  return {
    schema: {
      type: "object",
      additionalProperties: false,
      properties: core.properties,
      required: core.required
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
