/**
 * server/controllers/saturnController.ts
 *
 * Saturn Visual Solver controller.
 * Routes requests to the new saturnService which integrates with TypeScript
 * service layer (grok.ts/openai.ts) instead of direct Python API calls.
 *
 * Author: Sonnet 4.5 (Updated 2025-10-09)
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter';
import { saturnService } from '../services/saturnService';
import { saturnVisualService } from '../services/saturnVisualService';
import { puzzleLoader } from '../services/puzzleLoader';
import { explanationService } from '../services/explanationService';
import { getSessionSnapshot } from '../services/wsService';
import { randomUUID } from 'crypto';

export const saturnController = {
  async analyze(req: Request, res: Response) {
    // Starts a Saturn job asynchronously using new saturnService
    const { taskId } = req.params as { taskId: string };

    // Basic validation
    if (!taskId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId'));
    }

    // Generate a session id for tracking progress
    const sessionId = randomUUID();

    // Saturn model key (maps to underlying provider model - RESPONSES API compatible only)
    // saturn-grok-4-fast-reasoning, saturn-gpt-5-nano, saturn-gpt-5-mini
    const modelKey = (req.body?.modelKey as string) || 'saturn-gpt-5-nano';
    const temperature = typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2;
    const promptId = (req.body?.promptId as string) || 'solver';

    // Service options for conversation chaining and reasoning
    const serviceOpts = {
      sessionId, // For WebSocket broadcasting
      previousResponseId: req.body?.previousResponseId as string | undefined,
      reasoningEffort: (req.body?.reasoningEffort as 'minimal' | 'low' | 'medium' | 'high') || 'high',
      reasoningVerbosity: (req.body?.reasoningVerbosity as 'low' | 'medium' | 'high') || 'high',
      reasoningSummaryType: (req.body?.reasoningSummaryType as 'auto' | 'detailed') || 'detailed',
      captureReasoning: req.body?.captureReasoning !== false,
    };

    // Kick off analysis async (non-blocking)
    setImmediate(async () => {
      try {
        // Load puzzle
        const task = await puzzleLoader.loadPuzzle(taskId);
        if (!task) {
          console.error(`[Saturn] Puzzle not found: ${taskId}`);
          return;
        }

        // Run Saturn analysis
        const result = await saturnService.analyzePuzzleWithModel(
          task,
          modelKey,
          taskId,
          temperature,
          promptId,
          undefined, // customPrompt
          undefined, // PromptOptions
          serviceOpts
        );

        // Save to database
        await explanationService.saveExplanation(taskId, {
          [modelKey]: result
        });

        console.log(`[Saturn] Analysis complete for ${taskId}, cost: $${result.estimatedCost?.toFixed(4)}`);

      } catch (err: unknown) {
        console.error(`[Saturn] Run error for ${taskId}:`, err);
      }
    });

    // Return session info immediately
    return res.json(formatResponse.success({ sessionId }));
  },

  async getStatus(req: Request, res: Response) {
    const { sessionId } = req.params as { sessionId: string };
    if (!sessionId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing sessionId'));
    }

    const snapshot = getSessionSnapshot(sessionId);
    return res.json(formatResponse.success({ sessionId, snapshot }));
  },

  async analyzeWithModel(req: Request, res: Response) {
    // Explicit model selection endpoint (same as analyze but with explicit model parameter)
    const { taskId, modelKey } = req.params as { taskId: string; modelKey: string };

    if (!taskId || !modelKey) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId or modelKey'));
    }

    // Validate Saturn model key
    if (!modelKey.startsWith('saturn-')) {
      return res.status(400).json(formatResponse.error('bad_request', 'Invalid Saturn model key. Must start with "saturn-"'));
    }

    const sessionId = randomUUID();
    const temperature = typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2;
    const promptId = (req.body?.promptId as string) || 'solver';

    const serviceOpts = {
      sessionId,
      previousResponseId: req.body?.previousResponseId as string | undefined,
      reasoningEffort: (req.body?.reasoningEffort as 'minimal' | 'low' | 'medium' | 'high') || 'high',
      reasoningVerbosity: (req.body?.reasoningVerbosity as 'low' | 'medium' | 'high') || 'medium',
      captureReasoning: true,
    };

    setImmediate(async () => {
      try {
        const task = await puzzleLoader.loadPuzzle(taskId);
        if (!task) {
          console.error(`[Saturn] Puzzle not found: ${taskId}`);
          return;
        }

        const result = await saturnService.analyzePuzzleWithModel(
          task,
          modelKey,
          taskId,
          temperature,
          promptId,
          undefined,
          undefined,
          serviceOpts
        );

        await explanationService.saveExplanation(taskId, {
          [modelKey]: result
        });

        console.log(`[Saturn] Analysis complete for ${taskId} with ${modelKey}`);

      } catch (err: unknown) {
        console.error(`[Saturn] Analysis error for ${taskId}:`, err);
      }
    });

    return res.json(formatResponse.success({ sessionId, modelKey }));
  },

  async analyzeWithReasoning(req: Request, res: Response) {
    const { taskId } = req.params as { taskId: string };
    if (!taskId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId'));
    }

    const sessionId = randomUUID();

    const model = typeof req.body?.model === 'string' && req.body.model.trim().length > 0
      ? req.body.model.trim()
      : 'gpt-5';
    const provider = typeof req.body?.provider === 'string' && req.body.provider.trim().length > 0
      ? req.body.provider.trim()
      : undefined;
    const temperature = typeof req.body?.temperature === 'number'
      ? req.body.temperature
      : 0.2;
    const cellSize = typeof req.body?.cellSize === 'number'
      ? req.body.cellSize
      : 24;
    const maxSteps = typeof req.body?.maxSteps === 'number'
      ? req.body.maxSteps
      : 8;
    const captureReasoning = req.body?.captureReasoning !== false;

    const reasoningEffortRaw = req.body?.reasoningEffort;
    const allowedEffort = new Set(['minimal', 'low', 'medium', 'high']);
    const reasoningEffort = typeof reasoningEffortRaw === 'string' && allowedEffort.has(reasoningEffortRaw)
      ? reasoningEffortRaw as 'minimal' | 'low' | 'medium' | 'high'
      : undefined;

    setImmediate(async () => {
      try {
        await saturnVisualService.run(taskId, sessionId, {
          provider,
          model,
          temperature,
          cellSize,
          maxSteps,
          captureReasoning,
          reasoningEffort
        });
      } catch (error) {
        console.error('[Saturn] Visual solver run failed:', error);
      }
    });

    return res.json(formatResponse.success({
      sessionId,
      model,
      provider
    }));
  },
};
