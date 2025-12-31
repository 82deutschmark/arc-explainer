/**
 * ErrorDisplay.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28 (Updated: 2025-12-28)
 * PURPOSE: Display component for RE-ARC evaluation errors.
 *          Renders validation errors using discriminated union pattern.
 *          Extracted from EvaluationSection for SRP compliance.
 *          Uses consistent error message patterns:
 *          - Pattern 1 (Format errors): Problem → Code example (if complex) → Next Steps
 *          - Pattern 2 (System errors): Explanation → Technical details → Next Steps
 *
 *          See docs/reference/frontend/ERROR_MESSAGE_GUIDELINES.md for detailed
 *          guidelines on writing new error messages.
 *
 * SRP/DRY check: Pass - Single responsibility: error message rendering
 *
 * Dev showcase: View all error variants at /dev/rearc/error-display (dev mode only)
 *
 * Guidelines for writing copy in client/src/pages/ReArc.tsx
 */

import { AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { ValidationError } from "@/utils/arcSubmissionValidator";

// File-level UI errors (before validation)
type FileError = { type: "invalid_json" };

// Server/network error types
type ServerError =
  // Server Validation Errors
  | { type: "malformed_task_ids" }
  | {
      type: "prediction_count_mismatch";
      mismatches: Array<{
        taskId: string;
        expectedPredictions: number;
        submittedPredictions: number;
      }>;
    }
  // Other Errors
  | { type: "server_error"; message: string }
  | { type: "network_error"; details: string }
  | { type: "incomplete_response" }
  | { type: "sse_parse_error" };

// Combined error type for this component
export type EvaluationError = FileError | ValidationError | ServerError;

/**
 * ErrorDisplay component - renders validation errors using discriminated union pattern
 */
export function ErrorDisplay({ error }: { error: EvaluationError }) {
  switch (error.type) {
    case "invalid_json":
      return (
        <>
          <AlertTitle>Invalid JSON file</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>The file you uploaded isn't valid JSON.</p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Refer to the Submission Format Guide
              for the correct structure, and ensure your solver is producing
              valid JSON.
            </p>
          </AlertDescription>
        </>
      );

    case "invalid_submission_format":
      return (
        <>
          <AlertTitle>Invalid submission format</AlertTitle>
          <AlertDescription>
            <p>
              The submission file structure is unrecognizable. This usually
              means the file isn't formatted as an object with task IDs as keys.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Please refer to the Submission Format
              Guide for the correct structure.
            </p>
          </AlertDescription>
        </>
      );

    case "empty_submission":
      return (
        <>
          <AlertTitle>Empty submission file</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              <strong>Found:</strong> Empty object <code>{'{}'}</code>
              <br />
              <strong>Expected:</strong> Object with task IDs as keys
            </p>
            <p className="mt-2">
              The submission file contains no tasks. Your solver needs to
              generate predictions for all tasks in the dataset.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Check that your solver is running
              correctly and producing output for each task.
            </p>
          </AlertDescription>
        </>
      );

    case "task_count_mismatch":
      return (
        <>
          <AlertTitle>
            {error.tooMany
              ? "This submission has too many tasks"
              : "This submission is missing tasks"}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              <strong>Found:</strong> {error.found} task{error.found === 1 ? "" : "s"}
              <br />
              <strong>Expected:</strong> {error.expected} task{error.expected === 1 ? "" : "s"}
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Ensure your submission contains exactly{" "}
              {error.expected} task{error.expected === 1 ? "" : "s"}, matching
              the dataset you downloaded.
            </p>
          </AlertDescription>
        </>
      );

    case "invalid_task_id":
      return (
        <>
          <AlertTitle>Unrecognized task ID: "{error.taskId}"</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Task IDs must be 8-character hexadecimal codes like "1a2b3c4d"
              (using only 0-9 and a-f).
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> This error usually means the task ID
              was modified after the dataset was generated. Make sure you're
              using the original task IDs from your downloaded dataset.
            </p>
          </AlertDescription>
        </>
      );

    case "dataset_file_detected":
      return (
        <>
          <AlertTitle>You uploaded the puzzle file instead of your predictions</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              This looks like the dataset file you downloaded (which contains the puzzles).
              You need to upload your solver's predictions instead.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Run your solver on the downloaded dataset,
              then upload the predictions file it generates. Check the Submission Format
              Guide above if you're not sure about the format.
            </p>
          </AlertDescription>
        </>
      );

    case "invalid_task_structure":
      return (
        <>
          <AlertTitle>Task "{error.taskId}" has invalid structure</AlertTitle>
          <AlertDescription className="space-y-2">
            {error.found === 'grid' ? (
              <>
                <p>
                  <strong>Found:</strong> A single grid (2D array)
                  <br />
                  <strong>Expected:</strong> An array of prediction objects
                </p>
                <p className="mt-2">
                  It looks like you submitted the grid directly. Each grid must
                  be wrapped in a prediction object with two attempts.
                </p>
              </>
            ) : error.found === 'grid_array' ? (
              <>
                <p>
                  <strong>Found:</strong> An array of grids
                  <br />
                  <strong>Expected:</strong> An array of prediction objects
                </p>
                <p className="mt-2">
                  You submitted raw grids instead of prediction objects. Each
                  grid must be wrapped with attempt_1 and attempt_2.
                </p>
              </>
            ) : (
              <>
                <p>
                  <strong>Found:</strong> A prediction object (not wrapped in an array)
                  <br />
                  <strong>Expected:</strong> An array of prediction objects
                </p>
                <p className="mt-2">
                  Even if this task has only 1 test input, the prediction must
                  be wrapped in an array.
                </p>
              </>
            )}
            <div className="bg-muted p-2 rounded font-mono text-sm mt-2">
              {'[{ "attempt_1": [[0,1],[2,3]], "attempt_2": [[0,1],[2,3]] }]'}
            </div>
            <p className="mt-2">
              <strong>Next Steps:</strong> Update your solver to wrap grids in
              the required prediction object structure.
            </p>
          </AlertDescription>
        </>
      );

    case "empty_predictions":
      return (
        <>
          <AlertTitle>Task "{error.taskId}" has no predictions</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              <strong>Found:</strong> Empty array <code>[]</code>
              <br />
              <strong>Expected:</strong> Array with prediction objects (one per test input)
            </p>
            <p className="mt-2">
              This task has no prediction attempts. Your solver needs to produce
              one prediction object per test input in the original task data.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Check your solver's logic for this
              task to ensure it generates predictions for each test input.
            </p>
          </AlertDescription>
        </>
      );

    case "invalid_prediction_object":
      return (
        <>
          <AlertTitle>
            Task "{error.taskId}"
            {error.predictionIndex !== undefined &&
              ` prediction ${error.predictionIndex}`}{" "}
            is invalid
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Each prediction must be an object containing two attempts.</p>
            <div className="bg-muted p-2 rounded font-mono text-sm mt-2">
              {'{ "attempt_1": [[0,1],[2,3]], "attempt_2": [[0,1],[2,3]] }'}
            </div>
            <p className="mt-2">
              <strong>Next Steps:</strong> Ensure each prediction in your
              submission is a valid object with both attempt_1 and attempt_2
              fields.
            </p>
          </AlertDescription>
        </>
      );

    case "invalid_attempt_structure":
      return (
        <>
          <AlertTitle>
            Task "{error.taskId}"
            {error.predictionIndex !== undefined &&
              ` prediction ${error.predictionIndex}`}{" "}
            must contain prediction attempts
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Each prediction object must contain both attempt_1 and attempt_2
              fields, each containing a 2D grid array.
            </p>
            <div className="bg-muted p-2 rounded font-mono text-sm mt-2">
              {'{ "attempt_1": [[0,1],[2,3]], "attempt_2": [[0,1],[2,3]] }'}
            </div>
            <p className="mt-2">
              <strong>Next Steps:</strong> Ensure your solver produces exactly 2
              attempts for each test input.
            </p>
          </AlertDescription>
        </>
      );

    case "invalid_grid": {
      const { taskId, predictionIndex, attemptName, issue } = error;

      return (
        <>
          <AlertTitle>
            Task "{taskId}"
            {predictionIndex !== undefined && ` prediction ${predictionIndex}`},{" "}
            {attemptName} has an invalid grid
          </AlertTitle>
          {(() => {
            switch (issue.kind) {
              case "empty":
                return (
                  <AlertDescription className="space-y-2">
                    <p>Grid must be a non-empty 2D array.</p>
                    <p className="mt-2">
                      <strong>Next Steps:</strong> Ensure your solver produces a
                      valid grid (at minimum 1×1) for each attempt.
                    </p>
                  </AlertDescription>
                );

              case "too_tall":
                return (
                  <AlertDescription className="space-y-2">
                    <p>
                      <strong>Found:</strong> Grid with {issue.height} rows
                      <br />
                      <strong>Maximum allowed:</strong> 30 rows
                    </p>
                    <p className="mt-2">
                      <strong>Next Steps:</strong> Check your solver's grid
                      generation logic to ensure grids respect the 30×30 size
                      limit.
                    </p>
                  </AlertDescription>
                );

              case "too_wide":
                return (
                  <AlertDescription className="space-y-2">
                    <p>
                      <strong>Found:</strong> Grid size {issue.height}×{issue.width}
                      <br />
                      <strong>Maximum allowed:</strong> 30×30
                    </p>
                    <p className="mt-2">
                      <strong>Next Steps:</strong> Check your solver's grid
                      generation logic to ensure grids respect the 30×30 size
                      limit.
                    </p>
                  </AlertDescription>
                );

              case "invalid_row":
                return (
                  <AlertDescription className="space-y-2">
                    <p>Row {issue.row} must be an array.</p>
                    <p className="mt-2">
                      <strong>Next Steps:</strong> Ensure all rows in your grid
                      are valid arrays of integers.
                    </p>
                  </AlertDescription>
                );

              case "invalid_cell":
                return (
                  <AlertDescription className="space-y-2">
                    <p>
                      <strong>Found:</strong> Cell value {issue.value}
                      <br />
                      <strong>Valid values:</strong> 0-9 (integers only)
                    </p>
                    <p className="mt-2">
                      <strong>Next Steps:</strong> Ensure all cells in your grid
                      contain integers between 0 and 9.
                    </p>
                  </AlertDescription>
                );

              default:
                return issue satisfies never;
            }
          })()}
        </>
      );
    }

    case "malformed_task_ids":
      return (
        <>
          <AlertTitle>
            This submission doesn't match a known RE-ARC dataset
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              The task IDs in your submission don't correspond to any dataset we
              have on file.
            </p>
            <div className="mt-2">
              <strong>Common causes:</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Task IDs were manually edited after generation</li>
                <li>You're submitting answers for a dataset created elsewhere</li>
              </ul>
            </div>
            <p className="mt-2">
              <strong>Next Steps:</strong> Make sure your submission uses the
              exact same task IDs as the dataset you downloaded from this site.
            </p>
          </AlertDescription>
        </>
      );

    case "prediction_count_mismatch":
      return (
        <>
          <AlertTitle>Wrong number of predictions for some tasks</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Some tasks have the wrong number of prediction objects:</p>
            <div className="bg-muted p-2 rounded mt-2 font-mono text-sm space-y-1">
              {error.mismatches.map((m) => (
                <div key={m.taskId}>
                  Task {m.taskId}: Expected {m.expectedPredictions}, got{" "}
                  {m.submittedPredictions}
                </div>
              ))}
            </div>
            <p className="mt-2">
              Each task needs exactly one prediction object per test input. Most
              tasks have 1 test input, but some have 2-3.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Check your solver's output—it should
              create one prediction for each test case in the original task
              data.
            </p>
          </AlertDescription>
        </>
      );

    case "server_error":
      return (
        <>
          <AlertTitle>Server error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>Something went wrong on our end.</p>
            <div className="bg-muted p-2 rounded mt-2 font-mono text-sm">
              {error.message}
            </div>
            <p className="mt-2">
              <strong>Next Steps:</strong> Please try again in a moment. If the
              problem persists, the issue may need to be reported.
            </p>
          </AlertDescription>
        </>
      );

    case "network_error":
      return (
        <>
          <AlertTitle>Connection problem</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>We couldn't complete the evaluation due to a network error.</p>
            <div className="bg-muted p-2 rounded mt-2 font-mono text-sm">
              {error.details}
            </div>
            <div className="mt-2">
              <strong>Next Steps:</strong>
              <ul className="list-disc ml-5 mt-1 space-y-1">
                <li>Check your internet connection</li>
                <li>Try uploading again in a few moments</li>
                <li>
                  If the problem persists, the server may be experiencing issues
                </li>
              </ul>
            </div>
          </AlertDescription>
        </>
      );

    case "incomplete_response":
      return (
        <>
          <AlertTitle>Evaluation didn't complete</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              The evaluation started but didn't finish properly. This might be a
              temporary server issue.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Please try uploading your submission
              again.
            </p>
          </AlertDescription>
        </>
      );

    case "sse_parse_error":
      return (
        <>
          <AlertTitle>Server communication error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              The server sent a response we couldn't understand while evaluating
              your submission. This is a problem on our end, not with your file.
            </p>
            <p className="mt-2">
              <strong>Next Steps:</strong> Please try uploading again in a
              moment. If the problem persists, the issue may need to be
              reported.
            </p>
          </AlertDescription>
        </>
      );

    default:
      return error satisfies never;
  }
}
