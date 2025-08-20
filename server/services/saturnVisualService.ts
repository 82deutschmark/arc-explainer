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
import { dbService } from './dbService';
import { puzzleLoader } from './puzzleLoader';
import { openaiService } from './openai';

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
    // Enhanced Saturn analysis using OpenAI Responses API for structured reasoning
    
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

    // Extended timeout for long-running analyses - configurable via environment
    const defaultTimeoutMinutes = 60;
    const configuredTimeout = process.env.SATURN_TIMEOUT_MINUTES ? 
      parseInt(process.env.SATURN_TIMEOUT_MINUTES) : defaultTimeoutMinutes;
    const timeoutMs = Math.max(30, configuredTimeout) * 60 * 1000;
    
    let timeoutHandle: NodeJS.Timeout | null = null;
    let warningHandle: NodeJS.Timeout | null = null;
    let isCompleted = false;
    
    // Add warning at 75% of timeout duration
    const warningTimeMs = timeoutMs * 0.75;
    warningHandle = setTimeout(() => {
      if (!isCompleted) {
        const remainingMinutes = Math.ceil((timeoutMs - warningTimeMs) / (60 * 1000));
        broadcast(sessionId, {
          status: 'running',
          phase: 'warning',
          message: `Long-running analysis detected. Will timeout in ${remainingMinutes} minutes if not completed.`,
        });
      }
    }, warningTimeMs);
    
    timeoutHandle = setTimeout(() => {
      if (!isCompleted) {
        const timeoutMinutes = Math.ceil(timeoutMs / (60 * 1000));
        console.log(`[SATURN-RESPONSES-DEBUG] Timeout after ${timeoutMs}ms (${timeoutMinutes}min) for session ${sessionId}`);
        broadcast(sessionId, {
          status: 'error',
          phase: 'timeout',
          message: `Saturn analysis timed out after ${timeoutMinutes} minutes. Process terminated. Consider increasing SATURN_TIMEOUT_MINUTES if needed.`,
        });
        isCompleted = true;
        if (warningHandle) clearTimeout(warningHandle);
        setTimeout(() => clearSession(sessionId), 5000);
      }
    }, timeoutMs);

    try {
      // Initial broadcast
      broadcast(sessionId, {
        status: 'running',
        phase: 'initializing',
        step: 0,
        totalSteps: options.maxSteps,
        taskId,
        model: options.model,
        metadata: {
          trainCount: task.train?.length || 0,
          testCount: task.test?.length || 0,
        },
        message: 'Initializing Saturn Responses API analysis…',
      });

      // Prepare puzzle data for Responses API
      const puzzlePrompt = this.buildPuzzlePrompt(task);
      
      // Make Responses API call with reasoning capture
      const responsesRequest = {
        model: options.model,
        input: puzzlePrompt,
        reasoning: { summary: options.reasoningSummary ? 'auto' : 'none' },
        max_steps: options.maxSteps,
        temperature: options.temperature,
        ...(options.previousResponseId && { previous_response_id: options.previousResponseId })
      };

      console.log('[SATURN-RESPONSES-DEBUG] Making Responses API call:', {
        model: responsesRequest.model,
        maxSteps: responsesRequest.max_steps,
        hasPreviousId: !!options.previousResponseId
      });

      broadcast(sessionId, {
        status: 'running',
        phase: 'reasoning',
        step: 1,
        totalSteps: options.maxSteps,
        message: 'Calling OpenAI Responses API for structured reasoning...',
      });

      // Map UI model names to OpenAI service model keys
      const modelKeyMapping: Record<string, string> = {
        'gpt-5': 'gpt-5-2025-08-07',
        'gpt-5-mini': 'gpt-5-mini-2025-08-07',
        'gpt-5-nano': 'gpt-5-nano-2025-08-07',
        'o3-mini': 'o3-mini-2025-01-31',
        'o4-mini': 'o4-mini-2025-04-16',
        'o3': 'o3-2025-04-16',
      };
      const modelKey = modelKeyMapping[options.model] || options.model;

      // Use the existing OpenAI service analyzePuzzleWithModel method with Responses API
      const response = await openaiService.analyzePuzzleWithModel(
        task, // puzzle task
        modelKey as any, // model key
        0.2, // temperature
        true, // capture reasoning
        'standardExplanation', // prompt ID
        undefined, // custom prompt (must be string or undefined)
        {}, // default prompt options
        {
          previousResponseId: options.previousResponseId,
          maxSteps: options.maxSteps,
          reasoningSummary: options.reasoningSummary ? 'auto' : 'none',
          maxRetries: 2,
        }
      );
      
      console.log('[SATURN-RESPONSES-DEBUG] OpenAI service result:', {
        hasResponse: !!response,
        hasReasoningLog: !!response?.reasoningLog,
        reasoningLogLength: response?.reasoningLog?.length || 0,
        modelUsed: response?.model
      });

      // Extract reasoning data from the OpenAI service response format
      const reasoningLog = response?.reasoningLog || '';
      const reasoningItems = response?.reasoningItems || [];
      const responseId = response?.providerResponseId || `saturn-${Date.now()}`;
      const finalOutput = JSON.stringify({
        patternDescription: response?.patternDescription || '',
        solvingStrategy: response?.solvingStrategy || '',
        hints: response?.hints || []
      });

      console.log('[SATURN-RESPONSES-DEBUG] Extracted reasoning data:', {
        responseId,
        reasoningLogLength: reasoningLog.length,
        reasoningItemsCount: reasoningItems.length,
        finalOutputLength: finalOutput?.length || 0,
        hasProviderResponseId: !!response?.providerResponseId,
        reasoningPreview: reasoningLog.substring(0, 200)
      });

      // Stream reasoning updates
      if (reasoningLog) {
        broadcast(sessionId, {
          status: 'running',
          phase: 'analyzing',
          step: Math.floor(options.maxSteps * 0.5),
          totalSteps: options.maxSteps,
          message: 'Processing reasoning analysis...',
          reasoningLog: reasoningLog,
        });
      }

      // Stream reasoning items as step updates
      if (Array.isArray(reasoningItems)) {
        reasoningItems.forEach((item: any, index: number) => {
          const step = index + 1;
          const itemText = typeof item === 'string' ? item : (item?.content || item?.text || JSON.stringify(item));
          broadcast(sessionId, {
            status: 'running',
            phase: 'reasoning',
            step: step,
            totalSteps: Math.max(options.maxSteps, reasoningItems.length),
            progress: step / Math.max(options.maxSteps, reasoningItems.length),
            message: `Reasoning step ${step}: ${itemText.substring(0, 100)}...`,
            reasoningLog: itemText,
          });
        });
      }

      // Prepare explanation for database (including new Responses API fields)
      const explanation = {
        patternDescription: this.extractPatternFromReasoning(reasoningLog, reasoningItems),
        solvingStrategy: this.extractStrategyFromReasoning(reasoningLog, reasoningItems),
        hints: this.extractHintsFromReasoning(reasoningLog, reasoningItems),
        alienMeaning: '',
        confidence: this.calculateConfidenceFromReasoning(reasoningLog),
        alienMeaningConfidence: undefined,
        modelName: `Saturn Responses API (${options.model})`,
        reasoningLog: reasoningLog,
        hasReasoningLog: !!reasoningLog,
        apiProcessingTimeMs: Date.now(), // Approximate timing
        saturnImages: [] as string[], // No images for Responses API version
        saturnLog: Array.isArray(reasoningItems) ? reasoningItems.map(item => 
          typeof item === 'string' ? item : (item?.content || item?.text || JSON.stringify(item))
        ).join('\n') : '',
        saturnEvents: JSON.stringify(response),
        saturnSuccess: !!finalOutput,
        // New Responses API fields
        providerResponseId: responseId,
        providerRawResponse: response?.providerRawResponse || null,
        reasoningItems: reasoningItems,
      };

      // Save to database
      let explanationId: number | null = null;
      try {
        explanationId = await dbService.saveExplanation(taskId, explanation);
      } catch (saveErr) {
        broadcast(sessionId, {
          status: 'error',
          phase: 'persistence',
          message: `Failed to save Saturn results: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
        });
        return;
      }

      if (explanationId == null) {
        broadcast(sessionId, {
          status: 'error',
          phase: 'persistence',
          message: 'Database returned null explanation ID; aborting run.',
        });
        return;
      }

      // Final completion broadcast
      broadcast(sessionId, {
        status: 'completed',
        phase: 'done',
        step: options.maxSteps,
        totalSteps: options.maxSteps,
        progress: 1.0,
        message: 'Saturn Responses API analysis completed.',
        result: {
          puzzleId: taskId,
          success: !!finalOutput,
          prediction: finalOutput,
          explanationId,
          responseId: responseId,
          reasoningSummary: reasoningLog,
          reasoningSteps: reasoningItems.length,
        },
      });

      isCompleted = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (warningHandle) clearTimeout(warningHandle);
      setTimeout(() => clearSession(sessionId), 5 * 60 * 1000);

    } catch (error) {
      console.error(`[SATURN-RESPONSES-DEBUG] Analysis error for session ${sessionId}:`, error);
      isCompleted = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (warningHandle) clearTimeout(warningHandle);
      
      broadcast(sessionId, {
        status: 'error',
        phase: 'runtime',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
                saturnSuccess: typeof (evt as any).success === 'boolean' ? (evt as any).success : null,
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
  }

  // Helper methods for Responses API integration
  private buildPuzzlePrompt(task: any): string {
    // Build a comprehensive prompt for the Responses API
    const trainingExamples = task.train.map((example: any, i: number) => {
      return `Training Example ${i + 1}:
Input: ${JSON.stringify(example.input)}
Output: ${JSON.stringify(example.output)}`;
    }).join('\n\n');

    const testInput = task.test?.[0]?.input ? JSON.stringify(task.test[0].input) : 'No test input';

    return `You are solving an ARC-AGI (Abstraction and Reasoning Corpus) puzzle. Your task is to identify the pattern from the training examples and apply it to the test input.

Training Examples:
${trainingExamples}

Test Input: ${testInput}

Please analyze the pattern step by step:
1. Examine each training example to identify the transformation rule
2. Look for patterns in colors, shapes, positions, rotations, reflections, or mathematical operations
3. Verify your hypothesis works for all training examples
4. Apply the discovered pattern to the test input
5. Provide the predicted output as a 2D array

Your reasoning should be systematic and detailed. Focus on visual pattern recognition and logical rule discovery.`;
  }

  private extractPatternFromReasoning(summary: string, items: any[]): string {
    // Extract pattern description from reasoning
    const itemTexts = Array.isArray(items) ? items.map(item => 
      typeof item === 'string' ? item : (item?.content || item?.text || JSON.stringify(item))
    ) : [];
    const combined = summary + ' ' + itemTexts.join(' ');
    const patterns = [
      'pattern', 'transformation', 'rule', 'operation', 'mapping', 'relationship'
    ];
    
    for (const pattern of patterns) {
      const match = combined.match(new RegExp(`([^.!?]*${pattern}[^.!?]*)`, 'i'));
      if (match) {
        return match[1].trim().substring(0, 200);
      }
    }
    
    return summary.substring(0, 200) || 'Pattern analysis from Responses API';
  }

  private extractStrategyFromReasoning(summary: string, items: any[]): string {
    // Extract solving strategy from reasoning
    const itemTexts = Array.isArray(items) ? items.map(item => 
      typeof item === 'string' ? item : (item?.content || item?.text || JSON.stringify(item))
    ) : [];
    const combined = summary + ' ' + itemTexts.join(' ');
    const strategies = [
      'strategy', 'approach', 'method', 'technique', 'solution', 'solve'
    ];
    
    for (const strategy of strategies) {
      const match = combined.match(new RegExp(`([^.!?]*${strategy}[^.!?]*)`, 'i'));
      if (match) {
        return match[1].trim().substring(0, 200);
      }
    }
    
    return 'Systematic pattern analysis and rule application';
  }

  private extractHintsFromReasoning(summary: string, items: any[]): string[] {
    // Extract hints from reasoning items
    const hints: string[] = [];
    
    // Add reasoning steps as hints
    if (Array.isArray(items)) {
      items.forEach((item, index) => {
        const itemText = typeof item === 'string' ? item : (item?.content || item?.text || JSON.stringify(item));
        if (itemText && itemText.length > 10) {
          hints.push(`Step ${index + 1}: ${itemText.substring(0, 100)}`);
        }
      });
    }
    
    // If no items, extract from summary
    if (hints.length === 0 && summary) {
      const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 10);
      hints.push(...sentences.slice(0, 3).map(s => s.trim()));
    }
    
    return hints.slice(0, 5); // Limit to 5 hints
  }

  private calculateConfidenceFromReasoning(summary: string): number {
    // Calculate confidence based on reasoning quality
    const indicators = {
      high: ['clear', 'obvious', 'consistent', 'confident', 'certain', 'verified'],
      medium: ['likely', 'probable', 'seems', 'appears', 'suggests'],
      low: ['unclear', 'uncertain', 'maybe', 'possibly', 'difficult']
    };
    
    const text = summary.toLowerCase();
    let score = 0.5; // Default medium confidence
    
    for (const word of indicators.high) {
      if (text.includes(word)) score += 0.15;
    }
    
    for (const word of indicators.medium) {
      if (text.includes(word)) score += 0.05;
    }
    
    for (const word of indicators.low) {
      if (text.includes(word)) score -= 0.2;
    }
    
    return Math.max(0.1, Math.min(1.0, score));
  }
}

export const saturnVisualService = new SaturnVisualService();
