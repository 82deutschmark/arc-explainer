/**
 * Minimal JSON schema for ARC solver outputs aligned with HuggingFace dataset structure.
 *
 * Goal: accept the same shape we ingest externally (single grid or an ordered list of grids)
 * while allowing optional narrative metadata when models choose to provide it.
 *
 * Notes:
 * - Only prediction grids are required; all narrative fields are optional.
 * - Multi-test puzzles may return either numbered fields, a predictions array, or both.
 * - `multiplePredictedOutputs` supports legacy boolean usage and HF-style array payloads.
 */

import { GRID_SCHEMA } from './common.ts';

const SINGLE_PREDICTION_SCHEMA = {
  ...GRID_SCHEMA,
  description: "Predicted output grid as a 2D array of integers 0-9."
};

const MULTI_PREDICTIONS_SCHEMA = {
  type: "array",
  minItems: 1,
  items: GRID_SCHEMA,
  description: "Ordered list of predicted output grids for multi-test puzzles."
};

export const ARC_JSON_SCHEMA = {
  name: "arc_solver_minimal",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      multiplePredictedOutputs: {
        type: ["boolean", "array"],
        items: GRID_SCHEMA,
        description: "True when multiple test outputs are provided, or an array of predicted grids (HuggingFace compatibility)."
      },
      predictedOutput: SINGLE_PREDICTION_SCHEMA,
      predictedOutputs: MULTI_PREDICTIONS_SCHEMA,
      predictedOutput1: {
        ...GRID_SCHEMA,
        description: "First predicted output grid for multi-test puzzles (legacy alias)."
      },
      predictedOutput2: {
        ...GRID_SCHEMA,
        description: "Second predicted output grid for multi-test puzzles (legacy alias)."
      },
      predictedOutput3: {
        ...GRID_SCHEMA,
        description: "Third predicted output grid for multi-test puzzles (legacy alias)."
      },
      // Optional narrative metadata (retained for backward compatibility)
      solvingStrategy: {
        type: "string",
        description: "Optional explanation of the solving approach."
      },
      patternDescription: {
        type: "string",
        description: "Optional description of the transformation pattern."
      },
      hints: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of hints or insights."
      },
      reasoningItems: {
        type: "array",
        items: { type: "string" },
        description: "Optional breadcrumb reasoning steps."
      },
      confidence: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Optional confidence score (0-100)."
      }
    },
    anyOf: [
      { required: ["predictedOutput"] },
      { required: ["predictedOutputs"] },
      { required: ["predictedOutput1"] }
    ]
  }
} as const;
