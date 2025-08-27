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
        description: "False if there is only one test input, true otherwise"
      },
      predictedOutput: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "Single output grid (2D array of integers) for tasks with only one test input, empty array if multiple test inputs"
      },
      predictedOutput1: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "If the task has more than a single test input, First predicted output grid for first test input"
      },
      predictedOutput2: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "If the task has more than a single test input, Second predicted output grid for second test input"
      },
      predictedOutput3: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "If the task has more than a single test input, Third predicted output grid for third test input"
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
        description: "Three hints for understanding the transformation rules, one as an algorithm, one as a description, and one as only emojis"
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
