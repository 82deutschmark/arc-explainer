/**
 * VerificationSection.tsx
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-31
 * PURPOSE: Verification-only section for RE-ARC page.
 *          Allows users to verify someone else's submission without saving to leaderboard.
 *          Shows matching submissions if the same file was already submitted.
 *          Supports compact mode for dense layouts.
 * SRP/DRY check: Pass - Single responsibility: submission verification UI
 */

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, Shield } from 'lucide-react';
import type { ARCSubmission, ReArcSSEEvent } from '@shared/types';
import { validateSubmission } from '@/utils/arcSubmissionValidator';
import { parseSSEEvents, SSEParseError } from '@/utils/sseParser';
import { ProgressDisplay } from './ProgressDisplay';
import { ErrorDisplay, type EvaluationError } from './ErrorDisplay';

interface VerificationSectionProps {
  numTasks: number;
  /** When true, renders without Card wrapper for dense layouts */
  compact?: boolean;
}

interface MatchingSubmission {
  id: number;
  solverName: string;
  score: number;
  evaluatedAt: string;
}

interface VerificationResult {
  score: number;
  matchingSubmissions: MatchingSubmission[];
}

interface UploadProgress {
  loaded: number;
  total: number;
}

interface VerificationProgress {
  current: number;
  total: number;
}

// Phase-based state machine for cleaner state management
type VerificationPhase =
  | { type: 'idle' }
  | { type: 'uploading'; fileName: string; progress: UploadProgress | null }
  | { type: 'verifying'; fileName: string; progress: VerificationProgress | null }
  | { type: 'success'; fileName: string; result: VerificationResult }
  | { type: 'error'; fileName: string | null; error: EvaluationError };

export function VerificationSection({ numTasks, compact = false }: VerificationSectionProps) {
  const [phase, setPhase] = useState<VerificationPhase>({ type: 'idle' });
  const [isDragging, setIsDragging] = useState(false);
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
        const jsonBody = JSON.stringify({ submission });

        // Use XHR for upload progress + SSE streaming
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/api/rearc/verify');
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

          // When upload finishes, transition to verification mode
          xhr.upload.onloadend = () => {
            setPhase((currentPhase) => {
              // Don't overwrite success or error states
              if (currentPhase.type === 'success' || currentPhase.type === 'error') {
                return currentPhase;
              }
              return {
                type: 'verifying',
                fileName: file.name,
                progress: { current: 0, total: numTasks },
              };
            });
          };

          // Process SSE events as they arrive
          xhr.onreadystatechange = () => {
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

              if (newText) {
                let events: ReturnType<typeof parseSSEEvents<ReArcSSEEvent>>;

                try {
                  events = parseSSEEvents<ReArcSSEEvent>(newText);
                } catch (parseError) {
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
                  throw parseError;
                }

                for (const event of events) {
                  if (event.type === 'progress') {
                    setPhase({
                      type: 'verifying',
                      fileName: file.name,
                      progress: event.data,
                    });
                  } else if (event.type === 'complete') {
                    hasCompletionEvent = true;

                    if (event.data.type === 'score') {
                      const data = event.data as {
                        type: 'score';
                        score: number;
                        matchingSubmissions?: MatchingSubmission[];
                      };

                      setPhase({
                        type: 'success',
                        fileName: file.name,
                        result: {
                          score: data.score,
                          matchingSubmissions: data.matchingSubmissions ?? [],
                        },
                      });
                    } else if (event.data.type === 'mismatches') {
                      setPhase({
                        type: 'error',
                        fileName: file.name,
                        error: {
                          type: 'prediction_count_mismatch',
                          mismatches: (event.data as any).mismatches,
                        },
                      });
                    } else if (event.data.type === 'malformed') {
                      setPhase({
                        type: 'error',
                        fileName: file.name,
                        error: { type: 'malformed_task_ids' },
                      });
                    }
                  } else if (event.type === 'error') {
                    hasCompletionEvent = true;
                    setPhase({
                      type: 'error',
                      fileName: file.name,
                      error: {
                        type: 'server_error',
                        message: (event.data as any).message,
                      },
                    });
                  }
                }
              }

              if (xhr.readyState === xhr.DONE) {
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
              {phase.result.matchingSubmissions.length > 0 ? (
                <div className={compact ? "text-xs mt-2 p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-sm" : "text-sm mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded"}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Shield className={compact ? "h-3 w-3 text-blue-500" : "h-4 w-4 text-blue-500"} />
                    <strong>Verified:</strong>
                  </div>
                  <span className={compact ? "text-xs" : "text-sm"}>
                    This submission matches {phase.result.matchingSubmissions.length} existing{' '}
                    {phase.result.matchingSubmissions.length === 1 ? 'entry' : 'entries'}:
                  </span>
                  {compact ? (
                    <div className="ml-4.5 mt-1 space-y-0.5">
                      {phase.result.matchingSubmissions.map((m) => (
                        <div key={m.id} className="text-xs font-mono">
                          {m.solverName} ({(m.score * 100).toFixed(2)}%)
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="mt-1 ml-4 list-disc space-y-0.5">
                      {phase.result.matchingSubmissions.map((m) => (
                        <li key={m.id} className="text-sm">
                          {m.solverName} ({(m.score * 100).toFixed(2)}%) on{' '}
                          {new Date(m.evaluatedAt).toLocaleDateString()}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <div className={compact ? "text-xs mt-2 p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-sm" : "text-sm mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded"}>
                  <strong>No matches found</strong> — This submission is unique (or the original hasn't been verified yet)
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

      {/* Verification Progress */}
      {phase.type === 'verifying' && (
        <div className={compact ? "mb-3" : "space-y-4 mb-6"}>
          <Alert className={compact ? "border-blue-500/50 bg-blue-500/5" : "border-blue-500 bg-blue-500/10"}>
            <Loader2 className={compact ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
            <AlertDescription>
              <div className={compact ? "text-xs font-mono" : "text-sm"}>
                Verifying: {phase.fileName}
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
              label="Verifying submission..."
              current={phase.progress.current}
              total={phase.progress.total}
            />
          )}
        </div>
      )}

      {/* Upload Interface */}
      {(phase.type === 'idle' || phase.type === 'success' || phase.type === 'error') && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-sm text-center transition-colors ${
            compact ? "p-4" : "rounded-lg p-12"
          } ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }`}
        >
          <Shield className={compact ? "mx-auto h-6 w-6 text-muted-foreground mb-2" : "mx-auto h-12 w-12 text-muted-foreground mb-4"} />
          <p className={compact ? "text-xs font-mono mb-1.5" : "text-lg mb-2"}>
            {compact ? "Drop submission.json to verify" : "Drop submission.json here to verify"}
          </p>
          {!compact && <p className="text-sm text-muted-foreground mb-4">or</p>}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            size={compact ? "sm" : "default"}
            className={compact ? "text-xs font-mono" : ""}
          >
            {compact ? "Browse" : "Choose File"}
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
    </>
  );

  if (compact) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Verify Someone Else's Solution
        </CardTitle>
        <CardDescription>
          Check if a submission matches existing entries (verification only)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
