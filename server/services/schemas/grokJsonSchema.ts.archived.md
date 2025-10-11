/**
 * JSON Schema for ARC puzzle analysis structured output (xAI/Grok format)
 * 
 * DEPRECATED: This file is now a thin wrapper for backward compatibility.
 * Use getGrokSchema(testCount) from './providers/grok.ts' directly for dynamic schema generation.
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-10-11 (refactored to use dynamic core schema)
 * PURPOSE: Legacy compatibility wrapper. Real implementation in providers/grok.ts
 * 
 * Migration: Replace imports of GROK_JSON_SCHEMA with:
 *   import { getGrokSchema } from './schemas/providers/grok.js';
 *   const schema = getGrokSchema(task.test.length);
 */

import { getGrokSchema } from './providers/grok.js';

/**
 * @deprecated Use getGrokSchema(testCount) for dynamic schema generation
 * This constant remains for backward compatibility but will be removed in future version
 */
export const GROK_JSON_SCHEMA = {
  _deprecated: true,
  _message: "Use getGrokSchema(testCount) from './providers/grok.js' for dynamic schema generation",
  
  // Legacy fallback for code that directly accesses GROK_JSON_SCHEMA properties
  // Returns a single-test schema by default
  ...getGrokSchema(1)
} as const;

// Re-export the dynamic function for convenience
export { getGrokSchema };
