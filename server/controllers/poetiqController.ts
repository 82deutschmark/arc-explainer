/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * PURPOSE: Poetiq solver API controller - handles HTTP requests for running the 
 *          Poetiq ARC-AGI solver and storing results in the database.
 * 
 * SRP and DRY check: Pass - Controller only, delegates to poetiqService for execution
 *                    and explanationService for persistence.
 * 
 * Endpoints:
 *   POST /api/poetiq/solve/:taskId - Run Poetiq solver on a puzzle
 *   POST /api/poetiq/batch - Run Poetiq solver on entire dataset
 *   GET  /api/poetiq/status/:sessionId - Get solver progress
 *   GET  /api/poetiq/models - List supported models
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter.js';
import { poetiqService } from '../services/poetiq/poetiqService.js';
import { puzzleLoader } from '../services/puzzleLoader.js';
import { broadcast, getSessionSnapshot } from '../services/wsService.js';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

// In-memory batch session storage
interface PoetiqBatchSession {
  id: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  dataset: string;
  model: string;
  puzzleIds: string[];
  currentIndex: number;
  results: Array<{
    puzzleId: string;
    status: 'pending' | 'running' | 'success' | 'failed';
    correct?: boolean;
    elapsedMs?: number;
    error?: string;
  }>;
  startedAt: Date;
  completedAt?: Date;
}

const poetiqBatchSessions = new Map<string, PoetiqBatchSession>();

/**
 * Get puzzle IDs from a dataset directory
 */
function getDatasetPuzzleIds(dataset: string): string[] {
  const dataDir = path.join(process.cwd(), 'data');
  let targetDir: string;
  
  // Map dataset names to actual directory paths
  switch (dataset.toLowerCase()) {
    case 'arc1':
      targetDir = path.join(dataDir, 'training');       // 400 puzzles
      break;
    case 'arc1-eval':
      targetDir = path.join(dataDir, 'evaluation');     // 400 puzzles
      break;
    case 'arc2':
      targetDir = path.join(dataDir, 'training2');      // 1000 puzzles
      break;
    case 'arc2-eval':
      targetDir = path.join(dataDir, 'evaluation2');    // 120 puzzles
      break;
    case 'arc-heavy':
      targetDir = path.join(dataDir, 'arc-heavy');      // 300 puzzles
      break;
    case 'concept-arc':
      targetDir = path.join(dataDir, 'concept-arc');    // 179 puzzles
      break;
    default:
      throw new Error(`Unknown dataset: ${dataset}. Valid options: arc1, arc1-eval, arc2, arc2-eval, arc-heavy, concept-arc`);
  }
  
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Dataset directory not found: ${targetDir}`);
  }
  
  const files = fs.readdirSync(targetDir);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

export const poetiqController = {
  /**
   * POST /api/poetiq/solve/:taskId
   * 
   * Run the Poetiq solver on a specific puzzle.
   * Returns immediately with a sessionId for progress tracking via WebSocket.
   */
  async solve(req: Request, res: Response) {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId'));
    }

    // Load puzzle from dataset
    const task = await puzzleLoader.loadPuzzle(taskId);
    if (!task) {
      return res.status(404).json(formatResponse.error('not_found', `Puzzle ${taskId} not found`));
    }

    // Generate session ID for progress tracking
    const sessionId = randomUUID();

    // Extract options from request body
    const options = {
      model: req.body?.model as string | undefined,               // LiteLLM model ID
      maxIterations: typeof req.body?.maxIterations === 'number' ? req.body.maxIterations : 10,
      numExperts: typeof req.body?.numExperts === 'number' ? req.body.numExperts : 1,
      temperature: typeof req.body?.temperature === 'number' ? req.body.temperature : 1.0,
      sessionId,
    };

    // Broadcast initial state immediately
    console.log('[Poetiq] Broadcasting initial state for sessionId:', sessionId);
    broadcast(sessionId, {
      status: 'running',
      phase: 'initializing',
      iteration: 0,
      totalIterations: options.maxIterations,
      message: 'Starting Poetiq solver...',
      taskId,
      config: {
        model: options.model || 'gemini/gemini-3-pro-preview',
        maxIterations: options.maxIterations,
        numExperts: options.numExperts,
        temperature: options.temperature,
      }
    });

    // Start async solver (non-blocking)
    setImmediate(async () => {
      try {
        console.log(`[Poetiq] Starting solver for ${taskId}`);

        const result = await poetiqService.solvePuzzle(
          taskId,
          task,
          options,
          (event) => {
            // Forward events to WebSocket
            if (event.type === 'progress') {
              broadcast(sessionId, {
                status: 'running',
                phase: event.phase,
                iteration: event.iteration,
                message: event.message,
              });
            } else if (event.type === 'log') {
              console.log(`[Poetiq ${event.level}] ${event.message}`);
            }
          }
        );

        // Transform result to explanation format
        const explanationData = poetiqService.transformToExplanationData(result);

        // Save to database
        const { explanationService } = await import('../services/explanationService.js');
        await explanationService.saveExplanation(taskId, {
          [explanationData.modelName]: {
            ...explanationData,
            result: explanationData, // For transformRawExplanation compatibility
          },
        });

        // Broadcast completion
        broadcast(sessionId, {
          status: 'completed',
          phase: 'done',
          message: `Poetiq solver complete! ${result.success ? 'Success' : 'Failed'}`,
          result: {
            success: result.success,
            isPredictionCorrect: result.isPredictionCorrect,
            accuracy: result.accuracy,
            iterationCount: result.iterationCount,
            bestTrainScore: result.bestTrainScore,
            generatedCode: result.generatedCode,
            elapsedMs: result.elapsedMs,
          },
        });

        console.log('[Poetiq] Analysis complete and saved:', {
          taskId,
          success: result.success,
          isPredictionCorrect: result.isPredictionCorrect,
          iterationCount: result.iterationCount,
          elapsedMs: result.elapsedMs,
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        broadcast(sessionId, {
          status: 'error',
          phase: 'error',
          message: errorMessage,
        });

        console.error('[Poetiq] Solver failed:', {
          taskId,
          error: errorMessage,
        });
      }
    });

    // Return session info immediately
    return res.json(formatResponse.success({
      sessionId,
      message: 'Poetiq solver started',
      taskId,
      config: {
        model: options.model || 'gemini/gemini-3-pro-preview',
        maxIterations: options.maxIterations,
        numExperts: options.numExperts,
        temperature: options.temperature,
      }
    }));
  },

  /**
   * GET /api/poetiq/status/:sessionId
   * 
   * Get the current status of a Poetiq solver run.
   */
  async getStatus(req: Request, res: Response) {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing sessionId'));
    }

    const snapshot = getSessionSnapshot(sessionId);
    return res.json(formatResponse.success({ sessionId, snapshot }));
  },

  /**
   * GET /api/poetiq/models
   * 
   * Get the list of supported Poetiq models.
   */
  async getModels(_req: Request, res: Response) {
    // These are the models supported by Poetiq via LiteLLM
    const models = [
      { id: 'gemini/gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'Google' },
      { id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google' },
      { id: 'openai/gpt-5', name: 'GPT-5', provider: 'OpenAI' },
      { id: 'openai/gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI' },
      { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic' },
      { id: 'anthropic/claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'Anthropic' },
      { id: 'xai/grok-4', name: 'Grok 4', provider: 'xAI' },
      { id: 'xai/grok-4-fast', name: 'Grok 4 Fast', provider: 'xAI' },
    ];

    return res.json(formatResponse.success({ models }));
  },

  /**
   * POST /api/poetiq/batch
   * 
   * Run Poetiq solver on an entire dataset (e.g., all ARC2 puzzles).
   * Processes puzzles sequentially to avoid overwhelming the API.
   * 
   * Body: { dataset: 'arc2' | 'arc2-eval' | 'arc1' | 'arc1-eval', model?: string, maxIterations?: number }
   */
  async startBatch(req: Request, res: Response) {
    const { dataset, model, maxIterations = 10 } = req.body as {
      dataset: string;
      model?: string;
      maxIterations?: number;
    };

    if (!dataset) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing dataset parameter'));
    }

    // Get puzzle IDs from dataset
    let puzzleIds: string[];
    try {
      puzzleIds = getDatasetPuzzleIds(dataset);
    } catch (err) {
      return res.status(400).json(formatResponse.error('bad_request', (err as Error).message));
    }

    if (puzzleIds.length === 0) {
      return res.status(400).json(formatResponse.error('bad_request', 'No puzzles found in dataset'));
    }

    // Create batch session
    const sessionId = randomUUID();
    const session: PoetiqBatchSession = {
      id: sessionId,
      status: 'running',
      dataset,
      model: model || 'gemini/gemini-3-pro-preview',
      puzzleIds,
      currentIndex: 0,
      results: puzzleIds.map(id => ({ puzzleId: id, status: 'pending' as const })),
      startedAt: new Date(),
    };
    poetiqBatchSessions.set(sessionId, session);

    console.log(`[Poetiq Batch] Starting batch ${sessionId}: ${puzzleIds.length} puzzles from ${dataset}`);

    // Broadcast initial state
    broadcast(sessionId, {
      status: 'running',
      phase: 'batch_start',
      dataset,
      total: puzzleIds.length,
      completed: 0,
      successful: 0,
      failed: 0,
      message: `Starting Poetiq batch: ${puzzleIds.length} puzzles from ${dataset}`,
    });

    // Process puzzles sequentially (async, non-blocking)
    setImmediate(async () => {
      for (let i = 0; i < puzzleIds.length; i++) {
        if (session.status !== 'running') break;

        const puzzleId = puzzleIds[i];
        session.currentIndex = i;
        session.results[i].status = 'running';

        broadcast(sessionId, {
          status: 'running',
          phase: 'solving',
          currentPuzzle: puzzleId,
          currentIndex: i,
          total: puzzleIds.length,
          completed: i,
          successful: session.results.filter(r => r.status === 'success' && r.correct).length,
          failed: session.results.filter(r => r.status === 'failed').length,
          message: `Solving puzzle ${i + 1}/${puzzleIds.length}: ${puzzleId}`,
        });

        try {
          const task = await puzzleLoader.loadPuzzle(puzzleId);
          if (!task) {
            session.results[i] = { puzzleId, status: 'failed', error: 'Puzzle not found' };
            continue;
          }

          const startTime = Date.now();
          const result = await poetiqService.solvePuzzle(puzzleId, task, {
            model: session.model,
            maxIterations,
          });
          const elapsedMs = Date.now() - startTime;

          // Save to database
          const explanationData = poetiqService.transformToExplanationData(result);
          const { explanationService } = await import('../services/explanationService.js');
          await explanationService.saveExplanation(puzzleId, {
            [explanationData.modelName]: {
              ...explanationData,
              result: explanationData,
            },
          });

          session.results[i] = {
            puzzleId,
            status: 'success',
            correct: result.isPredictionCorrect || false,
            elapsedMs,
          };

          console.log(`[Poetiq Batch] ${puzzleId}: ${result.isPredictionCorrect ? 'CORRECT' : 'INCORRECT'} (${Math.round(elapsedMs / 1000)}s)`);

        } catch (err) {
          session.results[i] = {
            puzzleId,
            status: 'failed',
            error: (err as Error).message,
          };
          console.error(`[Poetiq Batch] ${puzzleId}: FAILED - ${(err as Error).message}`);
        }
      }

      // Batch complete
      session.status = 'completed';
      session.completedAt = new Date();

      const successful = session.results.filter(r => r.status === 'success' && r.correct).length;
      const failed = session.results.filter(r => r.status === 'failed').length;
      const incorrect = session.results.filter(r => r.status === 'success' && !r.correct).length;

      broadcast(sessionId, {
        status: 'completed',
        phase: 'done',
        total: puzzleIds.length,
        successful,
        incorrect,
        failed,
        accuracy: (successful / puzzleIds.length * 100).toFixed(2),
        message: `Batch complete: ${successful}/${puzzleIds.length} correct (${(successful / puzzleIds.length * 100).toFixed(1)}%)`,
      });

      console.log(`[Poetiq Batch] Complete: ${successful}/${puzzleIds.length} correct (${(successful / puzzleIds.length * 100).toFixed(1)}%)`);
    });

    return res.json(formatResponse.success({
      sessionId,
      message: 'Poetiq batch started',
      dataset,
      puzzleCount: puzzleIds.length,
      model: session.model,
    }));
  },

  /**
   * GET /api/poetiq/batch/:sessionId
   * 
   * Get batch progress and results.
   */
  async getBatchStatus(req: Request, res: Response) {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing sessionId'));
    }

    const session = poetiqBatchSessions.get(sessionId);
    if (!session) {
      // Try WebSocket snapshot
      const snapshot = getSessionSnapshot(sessionId);
      return res.json(formatResponse.success({ sessionId, snapshot }));
    }

    const successful = session.results.filter(r => r.status === 'success' && r.correct).length;
    const failed = session.results.filter(r => r.status === 'failed').length;
    const incorrect = session.results.filter(r => r.status === 'success' && !r.correct).length;
    const pending = session.results.filter(r => r.status === 'pending').length;

    return res.json(formatResponse.success({
      sessionId,
      status: session.status,
      dataset: session.dataset,
      model: session.model,
      progress: {
        total: session.puzzleIds.length,
        completed: session.currentIndex + (session.status === 'completed' ? 1 : 0),
        successful,
        incorrect,
        failed,
        pending,
        percentage: ((session.currentIndex + 1) / session.puzzleIds.length * 100).toFixed(1),
      },
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      // Include first 100 results for summary
      results: session.results.slice(0, 100),
    }));
  },
};
