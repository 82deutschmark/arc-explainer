/**
 * JSON Schema for ARC puzzle analysis structured output (OpenAI format)
 * 
 * DEPRECATED: This file is now a thin wrapper for backward compatibility.
 * Use getOpenAISchema(testCount) from './providers/openai.ts' directly for dynamic schema generation.
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11 (refactored to use dynamic core schema)
 * PURPOSE: Legacy compatibility wrapper. Real implementation in providers/openai.ts
 * 
 * Migration: Replace imports of ARC_JSON_SCHEMA with:
 *   import { getOpenAISchema } from './schemas/providers/openai.js';
 *   const schema = getOpenAISchema(task.test.length);
 */

import { getOpenAISchema } from './providers/openai.js';

/**
 * @deprecated Use getOpenAISchema(testCount) for dynamic schema generation
 * This constant remains for backward compatibility but will be removed in future version
 */
export const ARC_JSON_SCHEMA = {
  _deprecated: true,
  _message: "Use getOpenAISchema(testCount) from './providers/openai.js' for dynamic schema generation",
  
  // Legacy fallback for code that directly accesses ARC_JSON_SCHEMA properties
  // Returns a single-test schema by default
  ...getOpenAISchema(1)
} as const;

// Re-export the dynamic function for convenience
export { getOpenAISchema };
