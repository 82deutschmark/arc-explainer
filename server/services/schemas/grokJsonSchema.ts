/**
 * Author: Buffy the Base Agent (Codebuff)
 * Date: 2025-10-07
 * PURPOSE: Minimal, Grok-4-compatible JSON schema for structured outputs via xAI Responses API.
 *          Focus on essential prediction fields with shallow nesting; avoid unsupported constraints.
 * SRP/DRY check: Pass — single responsibility schema; reuses shared pattern conventions without heavy fields.
 * shadcn/ui: Pass — backend only
 */

export const GROK_JSON_SCHEMA = {
  // Keep name/strict out — xAI docs indicate using response_format.json_schema without these.
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      multiplePredictedOutputs: { type: "boolean", description: "True if multiple test inputs; else false" },

      // Single-test output grid. If multiple tests, this may be an empty array.
      predictedOutput: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "2D integer grid for single-test tasks; empty array if multiple tests"
      },

      // Optional multi-test outputs. Keep optional to avoid complex conditionals/anyOf.
      predictedOutput1: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "First predicted output grid if multiple tests"
      },
      predictedOutput2: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Second predicted output grid if multiple tests"
      },
      predictedOutput3: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Third predicted output grid if multiple tests"
      },

      // Keep auxiliary fields minimal and optional
      confidence: { type: "integer", description: "Model confidence 1-100; 0 if unknown" }
    },
    // Keep requirements minimal to reduce grammar complexity
    required: ["multiplePredictedOutputs", "predictedOutput"]
  }
} as const;
