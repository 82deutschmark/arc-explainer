/**
 * EvaluationSection.tsx
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-28 (Refactored to extract ErrorDisplay, FormatGuide, SSE parsing)
 * PURPOSE: Submission evaluation section for RE-ARC page.
 *          Orchestrates file upload, validation, SSE streaming, and result display.
 *          Uses phase-based state management for cleaner logic and maintainability.
 * SRP/DRY check: Pass - Single responsibility: submission evaluation orchestration
 *
 * Guidelines for writing copy in client/src/pages/ReArc.tsx
 */

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { ARCSubmission, ReArcSSEEvent } from '@shared/types';
import { validateSubmission } from '@/utils/arcSubmissionValidator';
import { parseSSEEvents, SSEParseError } from '@/utils/sseParser';
import { ProgressDisplay } from './ProgressDisplay';
import { ErrorDisplay, type EvaluationError } from './ErrorDisplay';

/**
 * Recovers the generation timestamp from XOR-encoded task IDs
 */
function recoverTimestamp(taskIds: string[]): number {
  let xorValue = 0;
  for (const taskId of taskIds) {
    xorValue ^= parseInt(taskId, 16);
  }

  // XOR value should be the seed (timestamp in seconds)
  return xorValue;
}

interface EvaluationSectionProps {
  numTasks: number;
}

interface EvaluationResult {
  score: number;
  timestamp: number;
}

interface UploadProgress {
  loaded: number;
  total: number;
}

interface EvaluationProgress {
  current: number;
  total: number;
}

// Phase-based state machine for cleaner state management
type EvaluationPhase =
  | { type: 'idle' }
  | { type: 'uploading'; fileName: string; progress: UploadProgress | null }
  | { type: 'evaluating'; fileName: string; progress: EvaluationProgress | null }
  | { type: 'success'; fileName: string; result: EvaluationResult }
  | { type: 'error'; fileName: string | null; error: EvaluationError };

export function EvaluationSection({ numTasks }: EvaluationSectionProps) {
  const [phase, setPhase] = useState<EvaluationPhase>({ type: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [showScoringGuide, setShowScoringGuide] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      // Phase 1: Start uploading
      setPhase({ type: 'uploading', fileName: file.name, progress: null });

      try {
        // Read and parse file
        const text = await file.text();
        let submission: ARCSubmission;

        try {
          submission = JSON.parse(text);
        } catch {
          setPhase({
            type: 'error',
            fileName: file.name,
            error: { type: 'invalid_json' },
          });
          return;
        }

        // Client-side validation
        const validationError = validateSubmission(submission, numTasks);
        if (validationError) {
          setPhase({
            type: 'error',
            fileName: file.name,
            error: validationError,
          });
          return;
        }

        // File validated, now upload with progress tracking
        const jsonBody = JSON.stringify(submission);

        // Use XHR for upload progress + SSE streaming
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/rearc/evaluate');
          xhr.setRequestHeader('Content-Type', 'application/json');

          let lastProcessedIndex = 0;
          let hasCompletionEvent = false;

          // Track upload progress
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setPhase({
                type: 'uploading',
                fileName: file.name,
                progress: { loaded: event.loaded, total: event.total },
              });
            }
          };

          // When upload finishes, transition to evaluation mode
          // BUT don't overwrite if we've already transitioned to a terminal state (success/error)
          xhr.upload.onloadend = () => {
            setPhase((currentPhase) => {
              // Don't overwrite success or error states (race condition with instant responses)
              if (currentPhase.type === 'success' || currentPhase.type === 'error') {
                return currentPhase;
              }
              return {
                type: 'evaluating',
                fileName: file.name,
                progress: { current: 0, total: numTasks },
              };
            });
          };

          // Process SSE events as they arrive
          xhr.onreadystatechange = () => {
            // Check for headers received
            if (xhr.readyState === xhr.HEADERS_RECEIVED) {
              if (xhr.status !== 200) {
                let errorData: any = {};
                try {
                  errorData = JSON.parse(xhr.responseText);
                } catch {}
                setPhase({
                  type: 'error',
                  fileName: file.name,
                  error: {
                    type: 'server_error',
                    message: errorData.message || xhr.statusText,
                  },
                });
                reject(new Error(errorData.message || xhr.statusText));
                return;
              }
            }

            // Process streaming data
            if (xhr.readyState === xhr.LOADING || xhr.readyState === xhr.DONE) {
              const newText = xhr.responseText.substring(lastProcessedIndex);
              lastProcessedIndex = xhr.responseText.length;

              // Process new SSE events if any
              if (newText) {
                let events: ReturnType<typeof parseSSEEvents<ReArcSSEEvent>>;

                try {
                  events = parseSSEEvents<ReArcSSEEvent>(newText);
                } catch (parseError) {
                  // Handle malformed SSE events
                  if (parseError instanceof SSEParseError) {
                    hasCompletionEvent = true;
                    setPhase({
                      type: 'error',
                      fileName: file.name,
                      error: { type: 'sse_parse_error' },
                    });
                    reject(parseError);
                    return;
                  }
                  // Re-throw unexpected errors
                  throw parseError;
                }

                for (const event of events) {
                  if (event.type === 'progress') {
                    // TypeScript narrows event.data to { current: number; total: number }
                    setPhase({
                      type: 'evaluating',
                      fileName: file.name,
                      progress: event.data,
                    });
                  } else if (event.type === 'complete') {
                    hasCompletionEvent = true;
                    // TypeScript narrows to completion data union

                    if (event.data.type === 'score') {
                      // Success with score
                      const taskIds = Object.keys(submission);
                      const timestamp = recoverTimestamp(taskIds);

                      setPhase({
                        type: 'success',
                        fileName: file.name,
                        result: {
                          score: event.data.score,
                          timestamp: timestamp,
                        },
                      });
                    } else if (event.data.type === 'mismatches') {
                      // Failed due to prediction count mismatches
                      setPhase({
                        type: 'error',
                        fileName: file.name,
                        error: {
                          type: 'prediction_count_mismatch',
                          mismatches: event.data.mismatches,
                        },
                      });
                    } else if (event.data.type === 'malformed') {
                      // Failed due to malformed task IDs
                      setPhase({
                        type: 'error',
                        fileName: file.name,
                        error: { type: 'malformed_task_ids' },
                      });
                    }
                  } else if (event.type === 'error') {
                    hasCompletionEvent = true;
                    // TypeScript narrows event.data to { message: string }
                    setPhase({
                      type: 'error',
                      fileName: file.name,
                      error: {
                        type: 'server_error',
                        message: event.data.message,
                      },
                    });
                  }
                }
              }

              // Check for completion regardless of whether there was new text
              if (xhr.readyState === xhr.DONE) {
                // If we never received a completion event, something went wrong
                if (!hasCompletionEvent) {
                  setPhase({
                    type: 'error',
                    fileName: file.name,
                    error: { type: 'incomplete_response' },
                  });
                }
                resolve();
              }
            }
          };

          xhr.onerror = () => reject(new Error('Network error'));
          xhr.onabort = () => reject(new Error('Upload aborted'));

          xhr.send(jsonBody);
        });
      } catch (err) {
        setPhase({
          type: 'error',
          fileName: file.name,
          error: {
            type: 'network_error',
            details: err instanceof Error ? err.message : 'Unknown error occurred',
          },
        });
      }
    },
    [numTasks]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/json') {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluate Submission</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Success State */}
        {phase.type === 'success' && (
          <div className="space-y-4 mb-6">
            <Alert className="border-green-500 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                <div className="font-semibold text-lg">
                  Score: {(phase.result.score * 100).toFixed(2)}%
                </div>
                {phase.result.timestamp && (
                  <div className="text-sm mt-1">
                    Generated: {new Date(phase.result.timestamp * 1000).toLocaleString()}
                  </div>
                )}
                {phase.result.score === 0 && (
                  <div className="text-sm mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded">
                    <strong>Note:</strong> A 0% score is normal and expected. RE-ARC tasks
                    are challenging, and most submissions score 0%. Your submission format
                    was validated successfully - this result just means the predictions didn't match
                    the ground truth outputs.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Error State */}
        {phase.type === 'error' && (
          <Alert variant="destructive" className="mb-4">
            <XCircle className="h-4 w-4" />
            <ErrorDisplay error={phase.error} />
          </Alert>
        )}

        {/* Upload Progress */}
        {phase.type === 'uploading' && (
          <div className="space-y-4 mb-6">
            <Alert className="border-blue-500 bg-blue-500/10">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>Uploading:</strong> {phase.fileName}
                </div>
              </AlertDescription>
            </Alert>
            {phase.progress && (
              <ProgressDisplay
                label="Uploading submission..."
                current={phase.progress.loaded}
                total={phase.progress.total}
                formatValue={(bytes) => `${(bytes / 1024).toFixed(1)} KB`}
              />
            )}
          </div>
        )}

        {/* Evaluation Progress */}
        {phase.type === 'evaluating' && (
          <div className="space-y-4 mb-6">
            <Alert className="border-blue-500 bg-blue-500/10">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>Processing:</strong> {phase.fileName}
                </div>
              </AlertDescription>
            </Alert>
            {phase.progress && (
              <ProgressDisplay
                label="Evaluating submission..."
                current={phase.progress.current}
                total={phase.progress.total}
              />
            )}
          </div>
        )}

        {/* Upload Interface - always show except during active upload/evaluation */}
        {(phase.type === 'idle' || phase.type === 'success' || phase.type === 'error') && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg mb-2">Drop submission.json here</p>
            <p className="text-sm text-muted-foreground mb-4">or</p>
            <Button onClick={() => fileInputRef.current?.click()} variant="outline">
              Choose File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
