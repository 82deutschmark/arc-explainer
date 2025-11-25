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
 *   GET  /api/poetiq/status/:sessionId - Get solver progress
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter.js';
import { poetiqService } from '../services/poetiq/poetiqService.js';
import { puzzleLoader } from '../services/puzzleLoader.js';
import { broadcast, getSessionSnapshot } from '../services/wsService.js';
import { randomUUID } from 'crypto';

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
};
