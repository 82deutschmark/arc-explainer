/**
 * Author: Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Grover API controller - handles async iterative solver analysis requests.
 * Orchestrates Grover service to generate, execute, and grade Python programs iteratively
 * using conversation chaining and quantum-inspired amplitude amplification.
 * SRP/DRY check: Pass - Controller only, delegates all logic to groverService
 * shadcn/ui: Pass - Backend controller, no UI components
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter.js';
import { groverService } from '../services/grover.js';
import { puzzleLoader } from '../services/puzzleLoader.js';
import { randomUUID } from 'crypto';

export const groverController = {
  async analyze(req: Request, res: Response) {
    const { taskId, modelKey } = req.params as { taskId: string; modelKey: string };

    // Validate required parameters
    if (!taskId || !modelKey) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId or modelKey'));
    }

    // Load puzzle from dataset
    const task = await puzzleLoader.loadPuzzle(taskId);
    if (!task) {
      return res.status(404).json(formatResponse.error('not_found', `Puzzle ${taskId} not found`));
    }

    // Generate session ID for tracking
    const sessionId = randomUUID();

    // Extract options from request body
    const options = {
      temperature: typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2,
      maxSteps: typeof req.body?.maxIterations === 'number' ? req.body.maxIterations : 5,
      previousResponseId: req.body?.previousResponseId as string | undefined,
    };

    // Start async Grover analysis (non-blocking)
    setImmediate(async () => {
      try {
        const result = await groverService.analyzePuzzleWithModel(
          task,
          modelKey,
          taskId,
          options.temperature,
          undefined, // promptId - use default
          undefined, // customPrompt
          undefined, // PromptOptions
          {
            maxSteps: options.maxSteps,
            previousResponseId: options.previousResponseId
          }
        );

        // Save to database via explanationService
        const { explanationService } = await import('../services/explanationService.js');
        await explanationService.saveExplanation(taskId, {
          grover: result
        });

        console.log('[Grover] Analysis complete and saved:', {
          taskId,
          modelKey,
          iterationCount: result.iterationCount,
          confidence: result.confidence,
          sessionId
        });
      } catch (err) {
        console.error('[Grover] Analysis failed:', {
          taskId,
          modelKey,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    });

    // Return session info immediately
    return res.json(formatResponse.success({
      sessionId,
      message: 'Grover analysis started',
      taskId,
      modelKey,
      maxIterations: options.maxSteps
    }));
  }
};
