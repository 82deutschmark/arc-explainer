/**
 * server/controllers/saturnController.ts
 *
 * Saturn Visual Solver controller.
 * Provides endpoints to start an analysis job and poll current status.
 * Uses the wsService to broadcast real-time progress over WebSockets.
 *
 * Author: Cascade (model: Cascade)
 */

import type { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter';
import { saturnVisualService } from '../services/saturnVisualService';
import { getSessionSnapshot } from '../services/wsService';
import { randomUUID } from 'crypto';

export const saturnController = {
  async analyze(req: Request, res: Response) {
    // Starts a Saturn job asynchronously and returns a sessionId to the client immediately
    const { taskId } = req.params as { taskId: string };

    // Basic validation
    if (!taskId) {
      return res.status(400).json(formatResponse.error('bad_request', 'Missing taskId'));
    }

    // Generate a session id for tracking progress
    const sessionId = randomUUID();

    // Options may include model, temperature, cellSize, etc.
    const options = {
      model: (req.body?.model as string) || 'saturn-sim',
      temperature: typeof req.body?.temperature === 'number' ? req.body.temperature : 0.2,
      cellSize: typeof req.body?.cellSize === 'number' ? req.body.cellSize : 24,
      maxSteps: typeof req.body?.maxSteps === 'number' ? req.body.maxSteps : 8,
      captureReasoning: !!req.body?.captureReasoning,
    };

    // Kick off analysis async (non-blocking)
    setImmediate(() => {
      saturnVisualService
        .run(taskId, sessionId, options)
        .catch((err: unknown) => {
          console.error(`[Saturn] Run error for ${taskId}:`, err);
        });
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
};
