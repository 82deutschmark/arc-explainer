/**
 * server/services/saturnVisualService.ts
 *
 * Real Saturn Visual Solver service.
 * - Spawns the Python Saturn wrapper via `pythonBridge`.
 * - Streams NDJSON events to clients over WebSocket using `wsService`.
 * - Aggregates generated image paths during the run.
 * - Persists the final explanation to PostgreSQL via `dbService` so it
 *   appears in existing explanation views alongside other AI models.
 *
 * Important: Saturn runs autonomously on its dedicated UI page. We do NOT
 * send custom prompts or alien-meaning inputs here. This service only
 * orchestrates the run, broadcasts progress, and saves final results.
 *
 * Author: Cascade (model: Cascade)
 *
 * Change log (Cascade):
 * - 2025-08-15: Enforce DB connectivity as a hard requirement. Persist
 *   `saturnLog` (verbose stdout/stderr) and optional `saturnEvents` when
 *   available from `pythonBridge` final event augmentation. Treat save
 *   failures as hard errors.
 * - 2025-08-15: Increase overall Saturn run timeout to 30 minutes to
 *   accommodate longer analyses without premature termination.
 */

import fs from 'fs';
import path from 'path';
import { broadcast, clearSession } from './wsService';
import { pythonBridge } from './pythonBridge';
import { repositoryService } from '../repositories/RepositoryService';
import { puzzleLoader } from './puzzleLoader';

interface SaturnOptions {
  /** Provider id (e.g., 'openai'). Python wrapper validates support. */
  provider?: string;
  model: string;
  temperature: number;
  cellSize: number;
  maxSteps: number;
  captureReasoning: boolean;
  /** Reasoning effort level for GPT-5 models ('medium' or 'high') */
  reasoningEffort?: string;
}

interface SaturnResponsesOptions extends SaturnOptions {
  /** Enable reasoning summary capture */
  reasoningSummary: boolean;
  /** Previous response ID for chaining */
  previousResponseId?: string;
}

// Resolve the on-disk path to the ARC task JSON. We don't inject any content;
// we simply provide the file path to the Python wrapper.
function resolveTaskPath(taskId: string): string | null {
  const base = process.cwd();
  const candidates = [
    path.join(base, 'data', 'evaluation2', `${taskId}.json`),
    path.join(base, 'data', 'training2', `${taskId}.json`),
    path.join(base, 'data', 'evaluation', `${taskId}.json`),
    path.join(base, 'data', 'training', `${taskId}.json`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

class SaturnVisualService {
  async runWithResponses(taskId: string, sessionId: string, options: SaturnResponsesOptions) {
    // This method shouldn't exist - Saturn should only use the Python solver wrapper
    // Redirect to the proper Saturn run method
    console.warn('[SATURN] runWithResponses is deprecated - using standard Python solver wrapper');
    return this.run(taskId, sessionId, options);
  }

  async run(taskId: string, sessionId: string, options: SaturnOptions) {
    // Enforce DB as a hard requirement (no memory-only mode for Saturn).
    if (!repositoryService.isConnected()) {
      broadcast(sessionId, {
        status: 'error',
        phase: 'init',
        message: 'Database not connected. Saturn runs require DB persistence.',
      });
      return;
    }

    // Validate the task exists for client metadata (counts only)
    const task = await puzzleLoader.loadPuzzle(taskId);
    if (!task) {
      broadcast(sessionId, {
        status: 'error',
        phase: 'init',
        message: `Task ${taskId} not found`,
      });
      return;
    }

    const taskPath = resolveTaskPath(taskId);
    if (!taskPath) {
      broadcast(sessionId, {
        status: 'error',
        phase: 'init',
        message: `Task file path not found for ${taskId}`,
      });
      return;
    }

    // We'll aggregate all generated image file paths for persistence.
    const imagePaths: string[] = [];

    // Initial snapshot to clients
    broadcast(sessionId, {
      status: 'running',
      phase: 'initializing',
      step: 0,
      taskId,
      model: options.model,
      metadata: {
        trainCount: task.train?.length || 0,
        testCount: task.test?.length || 0,
      },
      message: 'Initializing Saturn analysis…',
    });

    // Start the Python subprocess and stream events as they arrive
    // Extended timeout for long-running analyses - configurable via environment
    const defaultTimeoutMinutes = 60; // Increased from 30 to 60 minutes
    const configuredTimeout = process.env.SATURN_TIMEOUT_MINUTES ? 
      parseInt(process.env.SATURN_TIMEOUT_MINUTES) : defaultTimeoutMinutes;
    const timeoutMs = Math.max(30, configuredTimeout) * 60 * 1000; // Minimum 30 minutes
    
    let timeoutHandle: NodeJS.Timeout | null = null;
    let warningHandle: NodeJS.Timeout | null = null;
    let isCompleted = false;
    
    // Add warning at 75% of timeout duration
    const warningTimeMs = timeoutMs * 0.75;
    const warningPromise = new Promise<void>((resolve) => {
      warningHandle = setTimeout(() => {
        if (!isCompleted) {
          const remainingMinutes = Math.ceil((timeoutMs - warningTimeMs) / (60 * 1000));
          broadcast(sessionId, {
            status: 'running',
            phase: 'warning',
            message: `Long-running analysis detected. Will timeout in ${remainingMinutes} minutes if not completed.`,
          });
        }
        resolve();
      }, warningTimeMs);
    });
    
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        if (!isCompleted) {
          const timeoutMinutes = Math.ceil(timeoutMs / (60 * 1000));
          console.log(`[SATURN-DEBUG] Timeout after ${timeoutMs}ms (${timeoutMinutes}min) for session ${sessionId}`);
          broadcast(sessionId, {
            status: 'error',
            phase: 'timeout',
            message: `Saturn analysis timed out after ${timeoutMinutes} minutes. Process terminated. Consider increasing SATURN_TIMEOUT_MINUTES if needed.`,
          });
          setTimeout(() => clearSession(sessionId), 5000);
          reject(new Error('Saturn analysis timeout'));
        }
      }, timeoutMs);
    });
    
    const analysisPromise = pythonBridge.runSaturnAnalysis(
      { taskPath, options },
      async (evt) => {
        try {
          switch (evt.type) {
            case 'api_call_start': {
              // Forward API call start event for timeline UI
              broadcast(sessionId, {
                status: 'running',
                phase: 'api_call_start',
                message: `API call start: ${((evt as any).provider || 'provider')} ${(evt as any).model || ''} ${(evt as any).endpoint ? '→ ' + (evt as any).endpoint : ''}`.trim(),
                api: {
                  event: 'start',
                  ts: (evt as any).ts || Date.now(),
                  provider: (evt as any).provider,
                  model: (evt as any).model,
                  endpoint: (evt as any).endpoint,
                  requestId: (evt as any).requestId,
                  attempt: (evt as any).attempt,
                  params: (evt as any).params,
                  images: (evt as any).images,
                  source: (evt as any).source || 'python',
                }
              });
              break;
            }
            case 'api_call_end': {
              // Forward API call end event for timeline UI
              broadcast(sessionId, {
                status: 'running',
                phase: 'api_call_end',
                message: `API call ${(evt as any).status || 'end'} (${(evt as any).httpStatus ?? 'n/a'}) in ${(evt as any).latencyMs ?? '?'}ms`,
                api: {
                  event: 'end',
                  ts: (evt as any).ts || Date.now(),
                  requestId: (evt as any).requestId,
                  status: (evt as any).status,
                  latencyMs: (evt as any).latencyMs,
                  httpStatus: (evt as any).httpStatus,
                  providerResponseId: (evt as any).providerResponseId,
                  reasoningSummary: (evt as any).reasoningSummary,
                  tokenUsage: (evt as any).tokenUsage,
                  error: (evt as any).error,
                  source: (evt as any).source || 'python',
                }
              });
              break;
            }
            case 'start': {
              broadcast(sessionId, {
                status: 'running',
                phase: 'initializing',
                step: 0,
                message: 'Saturn solver started',
                metadata: evt.metadata || {},
              });
              break;
            }
            case 'progress': {
              if (Array.isArray(evt.images)) {
                for (const im of evt.images) {
                  if (im?.path) imagePaths.push(im.path);
                }
              }
              broadcast(sessionId, {
                status: 'running',
                phase: evt.phase,
                step: evt.step,
                totalSteps: evt.totalSteps,
                message: evt.message,
                images: evt.images,
                progress: evt.totalSteps ? evt.step / evt.totalSteps : undefined,
                // Stream reasoning logs if available
                reasoningLog: (evt as any).reasoningLog ?? null,
              });
              break;
            }
            case 'log': {
              // Forward logs as non-intrusive updates
              broadcast(sessionId, {
                status: 'running',
                phase: 'log',
                message: `[${evt.level}] ${evt.message}`,
              });
              break;
            }
            case 'final': {
              if (Array.isArray(evt.images)) {
                for (const im of evt.images) {
                  if (im?.path) imagePaths.push(im.path);
                }
              }

              // Prepare the explanation object for DB persistence
              const reasoningLog: string | null = (evt as any).result?.reasoningLog ?? null;
              const saturnLog: string | null = (evt as any).saturnLog ?? null;
              // Attach optional event trace if provided by pythonBridge, store as TEXT
              const saturnEventsText: string | null = (evt as any).eventTrace
                ? (() => { try { return JSON.stringify((evt as any).eventTrace); } catch { return null; } })()
                : null;
              // Normalize confidence to integer percent (0–100) for DB INTEGER column
              const rawConf = (evt as any).result?.confidence;
              const normalizedConfidence = typeof rawConf === 'number'
                ? (rawConf <= 1 && rawConf >= 0 ? Math.round(rawConf * 100) : Math.round(rawConf))
                : 0;

              const explanation = {
                patternDescription: (evt as any).result?.patternDescription || '',
                solvingStrategy: (evt as any).result?.solvingStrategy || '',
                hints: Array.isArray((evt as any).result?.hints) ? (evt as any).result.hints : [],
                alienMeaning: (evt as any).result?.alienMeaning || '',
                confidence: normalizedConfidence,
                alienMeaningConfidence: undefined,
                modelName: `Saturn Visual Solver (${options.model})`,
                reasoningLog,
                hasReasoningLog: !!reasoningLog,
                apiProcessingTimeMs: (evt as any).timingMs,
                saturnImages: Array.from(new Set(imagePaths)),
                saturnLog,
                saturnEvents: saturnEventsText,
                saturnSuccess: typeof (evt as any).success === 'boolean' ? (evt as any).success : null,
              } as const;

              let explanationId: number | null = null;
              try {
                const explanationWithTaskId = {
                  ...explanation,
                  taskId: taskId
                };
                const savedExplanation = await repositoryService.explanations.saveExplanation(explanationWithTaskId);
                explanationId = savedExplanation.id;
              } catch (saveErr) {
                broadcast(sessionId, {
                  status: 'error',
                  phase: 'persistence',
                  message: `Failed to save Saturn results: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
                });
              }

              if (explanationId == null) {
                broadcast(sessionId, {
                  status: 'error',
                  phase: 'persistence',
                  message: 'Database returned null explanation ID; aborting run.',
                });
                setTimeout(() => clearSession(sessionId), 5 * 60 * 1000);
                break;
              }

              broadcast(sessionId, {
                status: 'completed',
                phase: 'done',
                message: 'Saturn analysis completed.',
                result: {
                  puzzleId: taskId,
                  success: !!(evt as any).success,
                  prediction: (evt as any).prediction ?? null,
                  explanationId,
                  processingTimeMs: (evt as any).timingMs,
                },
              });

              // Mark as completed and cleanup timers
              isCompleted = true;
              if (timeoutHandle) clearTimeout(timeoutHandle);
              if (warningHandle) clearTimeout(warningHandle);
              
              // Cleanup in-memory session cache later
              setTimeout(() => clearSession(sessionId), 5 * 60 * 1000);
              break;
            }
            case 'error': {
              // Mark as completed and cleanup timers on error
              isCompleted = true;
              if (timeoutHandle) clearTimeout(timeoutHandle);
              if (warningHandle) clearTimeout(warningHandle);
              
              broadcast(sessionId, {
                status: 'error',
                phase: 'runtime',
                message: evt.message,
              });
              break;
            }
          }
        } catch (innerErr) {
          // Surface handler errors to the client stream
          broadcast(sessionId, {
            status: 'error',
            phase: 'handler',
            message: innerErr instanceof Error ? innerErr.message : String(innerErr),
          });
        }
      }
    );
    
    try {
      await Promise.race([analysisPromise, timeoutPromise]);
    } catch (error) {
      console.error(`[SATURN-DEBUG] Analysis error or timeout for session ${sessionId}:`, error);
      // Ensure cleanup happens even on timeout/error
      isCompleted = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (warningHandle) clearTimeout(warningHandle);
    }

    // Fallback: If the Python process exited but we never observed a 'final' or 'error'
    // event (isCompleted remains false), emit an error to unblock the UI and clear timers.
    // This covers edge cases where the child exits cleanly without sending a terminal event.
    if (!isCompleted) {
      let code: number | null = null;
      try {
        const res = await analysisPromise; // already resolved if race completed via analysis
        code = (res as any)?.code ?? null;
      } catch {}

      isCompleted = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (warningHandle) clearTimeout(warningHandle);

      console.warn(`[SATURN-DEBUG] Fallback completion for session ${sessionId}: Python exited without 'final' event (code=${code ?? 'unknown'})`);
      broadcast(sessionId, {
        status: 'error',
        phase: 'runtime',
        message: `Saturn analysis finished (code ${code ?? 'unknown'}) but no 'final' event was received. Aborting and cleaning up.`,
      });
      // Cleanup in-memory session cache later to allow clients to read final snapshot
      setTimeout(() => clearSession(sessionId), 5 * 60 * 1000);
    }
  }

}

export const saturnVisualService = new SaturnVisualService();
