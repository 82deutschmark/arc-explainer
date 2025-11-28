/**
 * Author: Cascade (Claude Sonnet 4)
 * Date: 2025-11-25
 * Updated: 2025-11-27 - Removed duplicate WebSocket broadcasting (now handled by poetiqService)
 *                       Controller callback now only logs to console for all event types.
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
import { MODELS } from '../config/models.js';
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

// The 94 untested puzzles from ARC Prize 2025 evaluation set
// Source: poetiq-solver/docs/puzzle_status_2025-11-25.md
const ARC2_EVAL_UNTESTED = [
  '20270e3b', '20a9e565', '21897d95', '221dfab4', '247ef758',
  '269e22fb', '271d71e2', '28a6681f', '291dc1e1', '2b83f449',
  '2ba387bc', '2c181942', '2d0172a1', '31f7f899', '332f06d7',
  '35ab12c3', '36a08778', '38007db0', '3a25b0d8', '3dc255db',
  '3e6067c3', '409aa875', '446ef5d2', '45a5af55', '4a21e3da',
  '4c3d4a41', '4c416de3', '4c7dc4dd', '4e34c42c', '53fb4810',
  '5545f144', '581f7754', '58490d8a', '58f5dbd5', '5961cc34',
  '5dbc8537', '62593bfd', '64efde09', '65b59efc', '67e490f4',
  '6e453dd6', '6e4f6532', '6ffbe589', '71e489b6', '7491f3cf',
  '7666fa5d', '78332cb0', '7b0280bc', '7b3084d4', '7b5033c1',
  '7b80bb43', '7c66cb00', '7ed72f31', '800d221b', '80a900e0',
  '8698868d', '88bcf3b4', '88e364bc', '89565ca0', '898e7135',
  '8b7bacbf', '8b9c3697', '8e5c0c38', '8f215267', '8f3a5a89',
  '9385bd28', '97d7923e', '981571dc', '9aaea919', '9bbf930d',
  'a251c730', 'a25697e4', 'a32d8b75', 'a395ee82', 'a47bf94d',
  'a6f40cea', 'aa4ec2a5', 'abc82100', 'b0039139', 'b10624e5',
  'b5ca7ac4', 'b6f77b65', 'b99e7126', 'b9e38dc0', 'bf45cf4b',
  'c4d067a0', 'c7f57c3e', 'cb2d8a2c', 'cbebaa4b', 'd35bdbdc',
  'd59b0160', 'da515329', 'e87109e9', 'f560132c',
];

/**
 * Get puzzle IDs from a dataset or predefined list
 */
function getDatasetPuzzleIds(dataset: string): string[] {
  // Special case: the 94 untested puzzles from ARC2 eval
  if (dataset.toLowerCase() === 'arc2-eval-untested') {
    return [...ARC2_EVAL_UNTESTED];  // 94 puzzles
  }

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
    case 'arc2-eval':
      targetDir = path.join(dataDir, 'evaluation2');    // 120 puzzles (full set)
      break;
    case 'arc-heavy':
      targetDir = path.join(dataDir, 'arc-heavy');      // 300 puzzles
      break;
    case 'concept-arc':
      targetDir = path.join(dataDir, 'concept-arc');    // 179 puzzles
      break;
    default:
      throw new Error(`Unknown dataset: ${dataset}. Valid options: arc2-eval-untested (94), arc2-eval (120), arc1, arc1-eval, arc-heavy, concept-arc`);
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

    // Extract BYO API key (optional - falls back to env vars)
    const apiKey = req.body?.apiKey as string | undefined;
    const provider = req.body?.provider as 'gemini' | 'openrouter' | undefined;

    // Determine if using fallback (no API key provided)
    const usingFallback = !apiKey || apiKey.trim().length === 0;
    if (usingFallback) {
      console.log('[Poetiq] No BYO API key provided - using server environment variables');
    }

    // Extract options from request body
    const options = {
      model: req.body?.model as string | undefined,               // LiteLLM model ID
      maxIterations: typeof req.body?.maxIterations === 'number' ? req.body.maxIterations : 10,
      numExperts: typeof req.body?.numExperts === 'number' ? req.body.numExperts : 1,
      temperature: typeof req.body?.temperature === 'number' ? req.body.temperature : 1.0,
      reasoningEffort: req.body?.reasoningEffort as 'low' | 'medium' | 'high' | undefined,  // For GPT-5.x models
      sessionId,
      apiKey,           // BYO API key (never stored)
      provider,         // Which provider the key is for
    };

    // Broadcast initial state immediately
    console.log('[Poetiq] Broadcasting initial state for sessionId:', sessionId, usingFallback ? '(using fallback API key)' : '');
    broadcast(sessionId, {
      status: 'running',
      phase: 'initializing',
      iteration: 0,
      totalIterations: options.maxIterations,
      message: usingFallback 
        ? 'Starting Poetiq solver (using server API key)...' 
        : 'Starting Poetiq solver...',
      taskId,
      usingFallback,
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
            // WebSocket broadcasting is now handled directly by poetiqService
            // This callback is for controller-level logging only
            if (event.type === 'progress') {
              console.log(`[Poetiq] Phase: ${event.phase}, Iteration: ${event.iteration}, Message: ${event.message}`);
            } else if (event.type === 'log') {
              console.log(`[Poetiq ${event.level}] ${event.message}`);
            } else if (event.type === 'start') {
              console.log(`[Poetiq] Solver started with metadata:`, (event as any).metadata);
            } else if (event.type === 'error') {
              console.error(`[Poetiq] Error: ${event.message}`);
            }
          }
        );

        // Transform result to explanation format
        const explanationData = poetiqService.transformToExplanationData(result, task);

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

    // Return session info immediately (never include API key in response)
    return res.json(formatResponse.success({
      sessionId,
      message: usingFallback 
        ? 'Poetiq solver started (using server API key)' 
        : 'Poetiq solver started',
      taskId,
      usingFallback,
      config: {
        model: options.model || 'gemini/gemini-3-pro-preview',
        maxIterations: options.maxIterations,
        numExperts: options.numExperts,
        temperature: options.temperature,
        provider: options.provider || 'gemini',
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
    // Models supported by Poetiq via LiteLLM
    // All models route through OpenRouter (server key) or require BYO API key for direct access
    // Label format: "Model Name" + routing info to avoid confusion
    const models = [
      // SOTA Models (Featured in Blog) - via OpenRouter
      { id: 'openrouter/google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'OpenRouter', recommended: true, routing: 'openrouter' },
      { id: 'openai/gpt-5.1', name: 'GPT-5.1', provider: 'OpenRouter', recommended: true, routing: 'openrouter' },
      { id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast', provider: 'OpenRouter', recommended: true, routing: 'openrouter' },
      { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B', provider: 'OpenRouter', recommended: true, routing: 'openrouter' },

      // Direct API access (requires BYO API key)
      { id: 'gemini/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google', recommended: false, routing: 'direct', requiresBYO: true },
      { id: 'gpt-5.1-codex-mini', name: 'GPT-5.1 Codex Mini', provider: 'OpenAI', recommended: false, routing: 'direct', requiresBYO: true },
      { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast Reasoning', provider: 'xAI', recommended: false, routing: 'direct', requiresBYO: true },
      { id: 'anthropic/claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', recommended: false, routing: 'direct', requiresBYO: true },

      // Other via OpenRouter
      { id: 'openrouter/google/gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash', provider: 'OpenRouter', recommended: false, routing: 'openrouter' },
      { id: 'openrouter/anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'OpenRouter', recommended: false, routing: 'openrouter' },
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
          const explanationData = poetiqService.transformToExplanationData(result, task);
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

  /**
   * GET /api/poetiq/community-progress
   * 
   * Get community progress on ARC2-Eval puzzles for the Poetiq solver.
   * Returns ALL 120 puzzles from the evaluation2 directory (not deduplicated by puzzle loader)
   * with their Poetiq-specific status (solved/attempted/unattempted).
   * 
   * This endpoint directly reads from file system to get all 120 puzzle IDs,
   * then queries the database for Poetiq-specific explanations only.
   */
  async getCommunityProgress(_req: Request, res: Response) {
    try {
      // Read ALL puzzle IDs directly from evaluation2 directory (all 120)
      const arc2EvalDir = path.join(process.cwd(), 'data', 'evaluation2');
      
      if (!fs.existsSync(arc2EvalDir)) {
        return res.status(500).json(formatResponse.error('server_error', 'ARC2-Eval directory not found'));
      }

      const files = fs.readdirSync(arc2EvalDir);
      const allPuzzleIds = files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));

      // Query database for Poetiq-specific explanations only
      // Using raw SQL to filter by model_name LIKE 'poetiq-%'
      const { repositoryService } = await import('../repositories/RepositoryService.js');
      
      // Get all Poetiq explanations for these puzzles
      const poetiqExplanations = await repositoryService.explanations.getPoetiqExplanationsForPuzzles(allPuzzleIds);

      // Build status map
      const puzzleStatuses = allPuzzleIds.map(puzzleId => {
        const poetiqExp = poetiqExplanations.find(e => e.puzzleId === puzzleId);
        
        if (!poetiqExp) {
          return {
            puzzleId,
            status: 'unattempted' as const,
            modelName: null,
            createdAt: null,
            isPredictionCorrect: null,
            iterationCount: null,
            elapsedMs: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            estimatedCost: null,
          };
        }

        // Check if solved (correct prediction)
        const isSolved = poetiqExp.isPredictionCorrect === true || poetiqExp.multiTestAllCorrect === true;

        return {
          puzzleId,
          status: isSolved ? 'solved' as const : 'attempted' as const,
          modelName: poetiqExp.modelName,
          createdAt: poetiqExp.createdAt,
          isPredictionCorrect: poetiqExp.isPredictionCorrect,
          iterationCount: poetiqExp.iterationCount || null,
          elapsedMs: poetiqExp.apiProcessingTimeMs || null,
          inputTokens: poetiqExp.inputTokens || null,
          outputTokens: poetiqExp.outputTokens || null,
          totalTokens: poetiqExp.totalTokens || null,
          estimatedCost: poetiqExp.estimatedCost || null,
        };
      });

      // Calculate stats
      const solved = puzzleStatuses.filter(p => p.status === 'solved').length;
      const attempted = puzzleStatuses.filter(p => p.status === 'attempted').length;
      const unattempted = puzzleStatuses.filter(p => p.status === 'unattempted').length;
      const total = allPuzzleIds.length;
      const completionPercentage = total > 0 ? Math.round((solved / total) * 100) : 0;

      return res.json(formatResponse.success({
        puzzles: puzzleStatuses,
        total,
        solved,
        attempted,
        unattempted,
        completionPercentage,
      }));

    } catch (error) {
      console.error('[Poetiq] Community progress error:', error);
      return res.status(500).json(formatResponse.error('server_error', 
        error instanceof Error ? error.message : 'Failed to get community progress'));
    }
  },
};
