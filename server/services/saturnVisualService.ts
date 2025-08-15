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
 */

import fs from 'fs';
import path from 'path';
import { broadcast, clearSession } from './wsService';
import { pythonBridge } from './pythonBridge';
import { dbService } from './dbService';
import { puzzleLoader } from './puzzleLoader';

interface SaturnOptions {
  model: string;
  temperature: number;
  cellSize: number;
  maxSteps: number;
  captureReasoning: boolean;
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
  async run(taskId: string, sessionId: string, options: SaturnOptions) {
    // Enforce DB as a hard requirement (no memory-only mode for Saturn).
    if (!dbService.isConnected()) {
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
    await pythonBridge.runSaturnAnalysis(
      { taskPath, options },
      async (evt) => {
        try {
          switch (evt.type) {
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
              const explanation = {
                patternDescription: (evt as any).result?.patternDescription || '',
                solvingStrategy: (evt as any).result?.solvingStrategy || '',
                hints: Array.isArray((evt as any).result?.hints) ? (evt as any).result.hints : [],
                alienMeaning: (evt as any).result?.alienMeaning || '',
                confidence: typeof (evt as any).result?.confidence === 'number' ? (evt as any).result.confidence : 0,
                alienMeaningConfidence: undefined,
                modelName: `Saturn Visual Solver (${options.model})`,
                reasoningLog,
                hasReasoningLog: !!reasoningLog,
                apiProcessingTimeMs: (evt as any).timingMs,
                saturnImages: Array.from(new Set(imagePaths)),
                saturnLog,
                saturnEvents: saturnEventsText,
              } as const;

              let explanationId: number | null = null;
              try {
                explanationId = await dbService.saveExplanation(taskId, explanation);
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

              // Cleanup in-memory session cache later
              setTimeout(() => clearSession(sessionId), 5 * 60 * 1000);
              break;
            }
            case 'error': {
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
  }
}

export const saturnVisualService = new SaturnVisualService();
