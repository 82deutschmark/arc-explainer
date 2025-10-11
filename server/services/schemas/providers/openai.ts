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
 * @param testCount - Number of test cases in the puzzle (from task.test.length)
 * @returns OpenAI Responses API schema object
 * 
 * @example Single test:
 * getOpenAISchema(1)
 * // Returns: { name: "arc_analysis", strict: true, schema: { type: "object", properties: { predictedOutput: {...}, ...}, required: ["predictedOutput"] } }
 * 
 * @example Multiple tests:
 * getOpenAISchema(2)
 * // Returns: { name: "arc_analysis", strict: true, schema: { type: "object", properties: { predictedOutput1: {...}, predictedOutput2: {...}, ...}, required: ["predictedOutput1", "predictedOutput2"] } }
 */
export function getOpenAISchema(testCount: number) {
  const coreSchema = buildCoreSchema(testCount);
  
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
