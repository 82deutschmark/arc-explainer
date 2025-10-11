/**
 * Author: Cascade using Claude Sonnet 3.5
 * Date: 2025-10-11
 * PURPOSE: Grok-4-compatible JSON schema matching OpenAI's ARC_JSON_SCHEMA field set for consistent structured outputs.
 *          Uses xAI Responses API format (no name/strict wrapper) but enforces same field requirements as OpenAI.
 *          CRITICAL: Schema content must match arcJsonSchema.ts to ensure consistent analysis across all providers.
 * SRP/DRY check: Pass — Mirrors ARC_JSON_SCHEMA field definitions while adapting to xAI API requirements.
 * shadcn/ui: Pass — backend only
 */

export const GROK_JSON_SCHEMA = {
  // Keep name/strict out — xAI docs indicate using response_format.json_schema without these.
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      /* Multi-prediction support THIS IS WRONG!!!!  WE DONT WANT TO BE COMPLICATING THIS!!!
      multiplePredictedOutputs: {
        type: "boolean",
        description: "False if there is only one test input, true otherwise"
      },
      */
      predictedOutput: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Your predicted output grid for the first test case as a 2D array of integers."
      },
      predictedOutput1: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Your predicted output grid for the second test case, if there is one."
      },
      predictedOutput2: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Your predicted output grid for the third test case, if there is one."
      },
      predictedOutput3: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Your predicted output grid for the fourth test case, if there is one."
      },

      // Analysis fields (matches OpenAI schema)
      solvingStrategy: {
        type: "string",
        description: "Clear explanation of the solving approach, simple enough that a child could understand."
      },
      patternDescription: {
        type: "string",
        description: "Description of the transformations identified. One or two short sentences even a small child could understand."
      },
      hints: {
        type: "array",
        items: { type: "string" },
        description: "Three hints even a child could use for understanding the transformation rules."
      },
      confidence: {
        type: "integer",
        description: "Confidence level in the solution being correct (1-100) return 1 if no confidence in your answer, 100 if you are totally certain"
      }
    },
    // Match OpenAI required fields for consistency across providers
    required: [
      "predictedOutput",
      "predictedOutput1",
      "predictedOutput2",
      "predictedOutput3",
      "solvingStrategy",
      "patternDescription",
      "hints",
      "confidence"
    ]
  }
} as const;
