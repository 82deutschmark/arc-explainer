/**
 * JSON Schema for ARC puzzle analysis structured output
 * Used with OpenAI's structured output format to ensure consistent parsing
 * This schema is used by both the solver and explanation modes and anytime the research mode omits the solution 
 * from the prompt.
 * 
 * The custom prompt mode allows the user to provide a custom prompt to the LLM. In this case only 
 * enforce the predictedOutput or multiplePredictedOutputs fields logic and validation.  Do not enforce
 * hints or confidence fields or solvingStrategy or patternDescription.
 * 
 * IMPORTANT:  The predictedOutput field is used in the database and frontend to display the predicted output grid.
 * It is also used in the explanation mode to evaluate the accuracy of the predicted output.  It is CRITICAL for the project!
 * 
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
        description: "If the task has more than a single test input, this is the second predicted output grid for second test input"
      },
      predictedOutput3: {
        type: "array",
        items: {
          type: "array",
          items: { type: "integer" }
        },
        description: "If the task has more than two test inputs, this is the third predicted output grid for third test input"
      },
      
      // Analysis fields
      solvingStrategy: {
        type: "string",
        description: "Clear explanation of the solving approach, written as pseudo-code"
      },

      // REASONING ITEMS - MAPS TO DATABASE reasoning_items JSONB FIELD BUT MAY NOT BE THE SAME
      // AS THE REASONING ITEMS RETURNED BY OPENAI  
      reasoningItems: {
        type: "array",
        items: { type: "string" },
        description: "Structured step-by-step reasoning process and insights"
      },

      // THIS IS CRITICAL FOR THE PROJECT!!!  IT IS USED IN THE DATABASE AND FRONTEND!!!
      patternDescription: {
        type: "string",
        description: "Description of the transformations identified. One or two short sentences even a small child could understand."
      },

      // THIS IS CRITICAL FOR THE PROJECT!!!  IT IS USED IN THE DATABASE AND FRONTEND!!!
      hints: {
        type: "array",
        items: { type: "string" },
        description: "Three hints for understanding the transformation rules."
      },

      // THIS IS CRITICAL FOR THE PROJECT!!!  IT IS USED IN THE DATABASE AND FRONTEND!!!
      confidence: {
        type: "integer", // No min/max because Grok doesn't like it...  
        description: "Confidence level in the solution being correct (1-100) return 0 if none"
      },
    },
    required: [
      "multiplePredictedOutputs",
      "predictedOutput", 
      "predictedOutput1",
      "predictedOutput2", 
      "predictedOutput3",
      "solvingStrategy",
      "reasoningItems",
      "patternDescription",
      "hints", 
      "confidence"
    ],
    additionalProperties: false
  }
} as const;
