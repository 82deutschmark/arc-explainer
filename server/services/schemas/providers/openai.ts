/**
 * server/services/schemas/providers/openai.ts
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11
 * 
 * PURPOSE:
 * OpenAI-specific schema wrapper that formats core schemas for OpenAI's Responses API format.
 * OpenAI expects: { name: string, strict: boolean, schema: {...} }
 * 
 * This wraps the dynamic core schema builder with OpenAI's required format.
 * 
 * SRP/DRY Check: PASS
 * - Single responsibility: OpenAI schema format wrapper
 * - Delegates actual schema logic to core.ts
 * - Used exclusively by openai.ts service
 */

import { buildCoreSchema } from '../core.js';

/**
 * Generate OpenAI-formatted schema for structured outputs
 * 
 * CRITICAL: OpenAI's strict mode requires ALL fields in properties to be in required array.
 * We exclude optional analysis fields from the schema to avoid this constraint.
 * The AI can still return solvingStrategy, hints, etc. - they just won't be schema-enforced.
 * 
 * @param testCount - Number of test cases in the puzzle (from task.test.length)
 * @returns OpenAI Responses API schema object
 * 
 * @example Single test:
 * getOpenAISchema(1)
 * // Returns: { name: "arc_analysis", strict: true, schema: { type: "object", properties: { predictedOutput: {...} }, required: ["predictedOutput"] } }
 * 
 * @example Multiple tests:
 * getOpenAISchema(2)
 * // Returns: { name: "arc_analysis", strict: true, schema: { type: "object", properties: { predictedOutput1: {...}, predictedOutput2: {...} }, required: ["predictedOutput1", "predictedOutput2"] } }
 */
export function getOpenAISchema(testCount: number) {
  // includeOptionalFields = false: OpenAI strict mode doesn't support truly optional fields
  // Prediction grids are enforced by schema, analysis fields come through in raw response
  const coreSchema = buildCoreSchema(testCount, false);
  
  return {
    name: "arc_analysis",
    strict: true,
    schema: {
      type: "object",
      properties: coreSchema.properties,
      required: coreSchema.required,
      additionalProperties: false
    }
  };
}
