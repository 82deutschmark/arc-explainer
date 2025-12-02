/**
 * server/controllers/snakeBenchController.ts
 *
 * Author: Cascade
 * Date: 2025-12-02
 * PURPOSE: HTTP API controller for SnakeBench single-match runs.
 *          Exposes a small public endpoint that runs a single game between
 *          two models via the SnakeBench backend and returns a concise
 *          summary for UI consumption.
 * SRP/DRY check: Pass — controller-only logic, delegates execution to
 *                snakeBenchService.
 */

import type { Request, Response } from 'express';

import { snakeBenchService } from '../services/snakeBenchService';
import { logger } from '../utils/logger';
import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResponse,
} from '../../shared/types.js';

export async function runMatch(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Partial<SnakeBenchRunMatchRequest>;
    const { modelA, modelB } = body;

    if (!modelA || !modelB) {
      const response: SnakeBenchRunMatchResponse = {
        success: false,
        error: 'modelA and modelB are required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const width = body.width != null ? Number(body.width) : undefined;
    const height = body.height != null ? Number(body.height) : undefined;
    const maxRounds = body.maxRounds != null ? Number(body.maxRounds) : undefined;
    const numApples = body.numApples != null ? Number(body.numApples) : undefined;

    const request: SnakeBenchRunMatchRequest = {
      modelA: String(modelA),
      modelB: String(modelB),
      width,
      height,
      maxRounds,
      numApples,
    };

    const result = await snakeBenchService.runMatch(request);

    const response: SnakeBenchRunMatchResponse = {
      success: true,
      result,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench runMatch failed: ${message}`, 'snakebench-controller');

    const response: SnakeBenchRunMatchResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export const snakeBenchController = {
  runMatch,
};
