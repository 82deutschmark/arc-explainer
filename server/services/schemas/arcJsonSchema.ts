/**
 * JSON Schema for ARC puzzle analysis structured output
 * Used with OpenAI's structured output format to ensure consistent parsing
 * 
 * @author Cascade
 */

export const ARC_JSON_SCHEMA = {
  name: "arc_analysis", 
  strict: true,
  schema: {
    type: "object",
    properties: {
      // Multi-prediction support
      multiplePredictedOutputs: {
        type: "boolean",
        description: "True if providing multiple predictions"
      },
      predictedOutput: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Single predicted output grid (2D array of integers)"
      },
      predictedOutput1: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "First predicted output grid"
      },
      predictedOutput2: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Second predicted output grid"
      },
      predictedOutput3: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Third predicted output grid"
      },
      
      // Analysis fields
      solvingStrategy: {
        type: "string",
        description: "Detailed explanation of the solving approach"
      },
      keySteps: {
        type: "array",
        items: { type: "string" },
        description: "Key steps in the solution process"
      },
      patternDescription: {
        type: "string",
        description: "Description of the pattern identified"
      },
      hints: {
        type: "array",
        items: { type: "string" },
        description: "Hints for understanding the pattern"
      },
      confidence: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Confidence level in the solution (0-100)"
      }
    },
    required: [
      "multiplePredictedOutputs",
      "predictedOutput", 
      "predictedOutput1",
      "predictedOutput2", 
      "predictedOutput3",
      "solvingStrategy",
      "keySteps",
      "patternDescription",
      "hints", 
      "confidence"
    ],
    additionalProperties: false
  }
} as const;
