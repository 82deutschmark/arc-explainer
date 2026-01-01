/**
 * EvaluationSection.tsx
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-31
 * PURPOSE: Submission evaluation section for RE-ARC page.
 *          Orchestrates file upload, validation, SSE streaming, and result display.
 *          Auto-saves evaluations to backend. Optional label input for user reference.
 *          Supports compact mode for dense layouts.
 * SRP/DRY check: Pass - Single responsibility: submission evaluation orchestration
 */

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  /** When true, renders without Card wrapper for dense layouts */
  compact?: boolean;
}

interface MatchingSubmission {
  id: number;
  solverName: string;
  score: number;
}

interface EvaluationResult {
  score: number;
  timestamp: number;
  submissionId: number | null;
  matchingSubmissions: MatchingSubmission[];
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

export function EvaluationSection({ numTasks, compact = false }: EvaluationSectionProps) {
  const [phase, setPhase] = useState<EvaluationPhase>({ type: 'idle' });
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      // Reset submission state
      setHasSubmitted(false);

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
        const jsonBody = JSON.stringify({
          submission,
        });

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
                      const data = event.data as {
                        type: 'score';
                        score: number;
                        submissionId?: number | null;
                        matchingSubmissions?: MatchingSubmission[];
                      };

                      setPhase({
                        type: 'success',
                        fileName: file.name,
                        result: {
                          score: data.score,
                          timestamp: timestamp,
                          submissionId: data.submissionId ?? null,
                          matchingSubmissions: data.matchingSubmissions ?? [],
                        },
                      });

                      // Auto-submit evaluation to backend
                      if (data.score > 0) {
                        fetch('/api/rearc/submit', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            submission,
                          }),
                        })
                          .catch((err) => {
                            console.error('Auto-save error:', err);
                          });
                      }
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

  const content = (
    <>
      {/* Success State */}
      {phase.type === 'success' && (
        <div className={compact ? "mb-3" : "space-y-4 mb-6"}>
          <Alert className={compact ? "border-emerald-500/50 bg-emerald-500/5" : "border-green-500 bg-green-500/10"}>
            <CheckCircle2 className={compact ? "h-3.5 w-3.5 text-emerald-500" : "h-4 w-4 text-green-500"} />
            <AlertDescription>
              <div className={compact ? "font-mono font-bold text-base" : "font-semibold text-lg"}>
                Score: {(phase.result.score * 100).toFixed(2)}%
              </div>
              {phase.result.timestamp && (
                <div className={compact ? "text-xs mt-0.5 text-muted-foreground" : "text-sm mt-1"}>
                  Generated: {new Date(phase.result.timestamp * 1000).toLocaleString()}
                </div>
              )}
              {phase.result.score === 0 && !compact && (
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
        <Alert variant="destructive" className={compact ? "mb-3" : "mb-4"}>
          <XCircle className="h-4 w-4" />
          <ErrorDisplay error={phase.error} />
        </Alert>
      )}

      {/* Upload Progress */}
      {phase.type === 'uploading' && (
        <div className={compact ? "mb-3" : "space-y-4 mb-6"}>
          <Alert className={compact ? "border-blue-500/50 bg-blue-500/5" : "border-blue-500 bg-blue-500/10"}>
            <Loader2 className={compact ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
            <AlertDescription>
              <div className={compact ? "text-xs font-mono" : "text-sm"}>
                Uploading: {phase.fileName}
              </div>
            </AlertDescription>
          </Alert>
          {phase.progress && !compact && (
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
        <div className={compact ? "mb-3" : "space-y-4 mb-6"}>
          <Alert className={compact ? "border-blue-500/50 bg-blue-500/5" : "border-blue-500 bg-blue-500/10"}>
            <Loader2 className={compact ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
            <AlertDescription>
              <div className={compact ? "text-xs font-mono" : "text-sm"}>
                Processing: {phase.fileName}
                {compact && phase.progress && (
                  <span className="ml-2 text-muted-foreground">
                    {phase.progress.current}/{phase.progress.total}
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
          {phase.progress && !compact && (
            <ProgressDisplay
              label="Evaluating submission..."
              current={phase.progress.current}
              total={phase.progress.total}
            />
          )}
        </div>
      )}

      {/* Upload Interface - always visible, disabled during upload/evaluation */}
      <div
        onDragOver={phase.type === 'uploading' || phase.type === 'evaluating' ? undefined : handleDragOver}
        onDragLeave={phase.type === 'uploading' || phase.type === 'evaluating' ? undefined : handleDragLeave}
        onDrop={phase.type === 'uploading' || phase.type === 'evaluating' ? undefined : handleDrop}
        className={`border-2 border-dashed rounded-sm text-center transition-colors ${
          compact ? "p-4" : "rounded-lg p-12"
        } ${
          phase.type === 'uploading' || phase.type === 'evaluating'
            ? 'border-muted-foreground/10 bg-muted/30 opacity-50 pointer-events-none'
            : isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
      >
        <Upload className={compact ? "mx-auto h-6 w-6 text-muted-foreground mb-2" : "mx-auto h-12 w-12 text-muted-foreground mb-4"} />
        <p className={compact ? "text-xs font-mono mb-1.5" : "text-lg mb-2"}>
          {compact ? "Drop submission.json" : "Drop submission.json here"}
        </p>
        {!compact && <p className="text-sm text-muted-foreground mb-4">or</p>}
        <Button
          onClick={() => fileInputRef.current?.click()}
          variant="outline"
          size={compact ? "sm" : "default"}
          className={compact ? "text-xs font-mono" : ""}
          disabled={phase.type === 'uploading' || phase.type === 'evaluating'}
        >
          {compact ? "Browse" : "Choose File"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={phase.type === 'uploading' || phase.type === 'evaluating'}
        />
      </div>
    </>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluate Your Solution</CardTitle>
        <CardDescription>
          Upload your submission to see your score
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
