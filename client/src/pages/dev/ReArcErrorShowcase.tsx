/**
 * ReArcErrorShowcase.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28
 * PURPOSE: Dev-only page to visually inspect all ErrorDisplay component variants
 *          from components/rearc/ErrorDisplay.tsx. Provides quick reference for
 *          developers working on error states without needing to trigger each
 *          validation error manually.
 *
 * SRP/DRY check: Pass - isolated dev tool, reuses ErrorDisplay component
 */

import { ErrorDisplay, type EvaluationError } from "@/components/rearc/ErrorDisplay";
import { Alert } from "@/components/ui/alert";

export default function ReArcErrorShowcase() {
  const errorScenarios: Array<{ title: string; error: EvaluationError }> = [
    // File-level errors
    {
      title: "File Error: Invalid JSON",
      error: { type: "invalid_json" },
    },

    // Validation errors - submission structure
    {
      title: "Validation: Invalid Submission Format",
      error: { type: "invalid_submission_format" },
    },
    {
      title: "Validation: Empty Submission",
      error: { type: "empty_submission" },
    },
    {
      title: "Validation: Task Count Mismatch (Too Few)",
      error: { type: "task_count_mismatch", found: 8, expected: 10, tooMany: false },
    },
    {
      title: "Validation: Task Count Mismatch (Too Many)",
      error: { type: "task_count_mismatch", found: 12, expected: 10, tooMany: true },
    },

    // Task-level validation
    {
      title: "Validation: Invalid Task ID",
      error: { type: "invalid_task_id", taskId: "invalid-xyz" },
    },
    {
      title: "Validation: Invalid Task Structure (Grid)",
      error: {
        type: "invalid_task_structure",
        taskId: "1a2b3c4d",
        found: "grid",
      },
    },
    {
      title: "Validation: Invalid Task Structure (Grid Array)",
      error: {
        type: "invalid_task_structure",
        taskId: "1a2b3c4d",
        found: "grid_array",
      },
    },
    {
      title: "Validation: Invalid Task Structure (Single Object)",
      error: {
        type: "invalid_task_structure",
        taskId: "1a2b3c4d",
        found: "object",
      },
    },
    {
      title: "Validation: Empty Predictions",
      error: { type: "empty_predictions", taskId: "1a2b3c4d" },
    },

    // Prediction-level validation
    {
      title: "Validation: Invalid Prediction Object",
      error: {
        type: "invalid_prediction_object",
        taskId: "1a2b3c4d",
      },
    },
    {
      title: "Validation: Invalid Attempt Structure",
      error: {
        type: "invalid_attempt_structure",
        taskId: "1a2b3c4d",
        predictionIndex: 0,
      },
    },

    // Grid validation errors
    {
      title: "Validation: Empty Grid",
      error: {
        type: "invalid_grid",
        taskId: "1a2b3c4d",
        attemptName: "attempt_1",
        issue: { kind: "empty" },
      },
    },
    {
      title: "Validation: Grid Too Tall",
      error: {
        type: "invalid_grid",
        taskId: "1a2b3c4d",
        predictionIndex: 0,
        attemptName: "attempt_1",
        issue: { kind: "too_tall", height: 45 },
      },
    },
    {
      title: "Validation: Grid Too Wide",
      error: {
        type: "invalid_grid",
        taskId: "1a2b3c4d",
        attemptName: "attempt_2",
        issue: { kind: "too_wide", height: 25, width: 40 },
      },
    },
    {
      title: "Validation: Invalid Row",
      error: {
        type: "invalid_grid",
        taskId: "1a2b3c4d",
        predictionIndex: 1,
        attemptName: "attempt_1",
        issue: { kind: "invalid_row", row: 5 },
      },
    },
    {
      title: "Validation: Invalid Cell Value",
      error: {
        type: "invalid_grid",
        taskId: "1a2b3c4d",
        predictionIndex: 0,
        attemptName: "attempt_2",
        issue: { kind: "invalid_cell", row: 0, col: 0, value: "12" },
      },
    },

    // Server validation errors
    {
      title: "Server: Malformed Task IDs",
      error: { type: "malformed_task_ids" },
    },
    {
      title: "Server: Prediction Count Mismatch",
      error: {
        type: "prediction_count_mismatch",
        mismatches: [
          { taskId: "1a2b3c4d", expectedPredictions: 2, submittedPredictions: 1 },
          { taskId: "5e6f7a8b", expectedPredictions: 1, submittedPredictions: 3 },
        ],
      },
    },

    // Network/system errors
    {
      title: "Server: Generic Server Error",
      error: {
        type: "server_error",
        message: "Internal server error: Database connection failed",
      },
    },
    {
      title: "Network: Connection Error",
      error: {
        type: "network_error",
        details: "Failed to fetch: net::ERR_CONNECTION_REFUSED",
      },
    },
    {
      title: "Network: Incomplete Response",
      error: { type: "incomplete_response" },
    },
    {
      title: "Network: SSE Parse Error",
      error: { type: "sse_parse_error" },
    },
  ];

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">RE-ARC ErrorDisplay Variants</h1>
        <p className="text-muted-foreground">
          Visual reference for all error states in{" "}
          <code className="text-sm bg-muted px-1 py-0.5 rounded">
            components/rearc/ErrorDisplay.tsx
          </code>
        </p>
      </div>

      <div className="space-y-6">
        {errorScenarios.map((scenario, i) => (
          <div key={i} className="space-y-2">
            <h3 className="text-sm font-mono text-muted-foreground">
              {scenario.title}
            </h3>
            <Alert variant="destructive">
              <ErrorDisplay error={scenario.error} />
            </Alert>
          </div>
        ))}
      </div>
    </div>
  );
}
