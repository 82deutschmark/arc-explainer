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
  SnakeBenchRunBatchRequest,
  SnakeBenchRunBatchResponse,
  SnakeBenchListGamesResponse,
  SnakeBenchGameDetailResponse,
  SnakeBenchHealthResponse,
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
      apiKey: body.apiKey,
      provider: body.provider,
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

export async function runBatch(req: Request, res: Response) {
  try {
    const body = (req.body || {}) as Partial<SnakeBenchRunBatchRequest>;
    const { modelA, modelB, count } = body;

    if (!modelA || !modelB) {
      const response: SnakeBenchRunBatchResponse = {
        success: false,
        error: 'modelA and modelB are required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const parsedCount = count != null ? Number(count) : NaN;
    if (!Number.isFinite(parsedCount)) {
      const response: SnakeBenchRunBatchResponse = {
        success: false,
        error: 'count must be a number',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const request: SnakeBenchRunBatchRequest = {
      modelA: String(modelA),
      modelB: String(modelB),
      width: body.width != null ? Number(body.width) : undefined,
      height: body.height != null ? Number(body.height) : undefined,
      maxRounds: body.maxRounds != null ? Number(body.maxRounds) : undefined,
      numApples: body.numApples != null ? Number(body.numApples) : undefined,
      count: parsedCount,
      apiKey: body.apiKey,
      provider: body.provider,
    };

    const batch = await snakeBenchService.runBatch(request);

    const response: SnakeBenchRunBatchResponse = {
      success: true,
      batch,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench runBatch failed: ${message}`, 'snakebench-controller');

    const response: SnakeBenchRunBatchResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export async function listGames(req: Request, res: Response) {
  try {
    const limitRaw = req.query.limit as string | undefined;
    const limit = limitRaw != null ? Number(limitRaw) : undefined;

    const { games, total } = await snakeBenchService.listGames(limit);

    const response: SnakeBenchListGamesResponse = {
      success: true,
      games,
      total,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench listGames failed: ${message}`, 'snakebench-controller');

    const response: SnakeBenchListGamesResponse = {
      success: false,
      games: [],
      total: 0,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export async function getGame(req: Request, res: Response) {
  try {
    const { gameId } = req.params as { gameId: string };

    if (!gameId) {
      const response: SnakeBenchGameDetailResponse = {
        success: false,
        gameId: '',
        error: 'gameId is required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const data = await snakeBenchService.getGame(gameId);

    const response: SnakeBenchGameDetailResponse = {
      success: true,
      gameId,
      data,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench getGame failed: ${message}`, 'snakebench-controller');

    const { gameId = '' } = req.params as { gameId?: string };

    const response: SnakeBenchGameDetailResponse = {
      success: false,
      gameId,
      error: message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export async function health(req: Request, res: Response) {
  try {
    const healthResult = await snakeBenchService.healthCheck();
    const response: SnakeBenchHealthResponse = healthResult;
    return res.status(healthResult.status === 'error' ? 500 : 200).json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench health check failed: ${message}`, 'snakebench-controller');

    const response: SnakeBenchHealthResponse = {
      success: false,
      status: 'error',
      pythonAvailable: false,
      backendDirExists: false,
      runnerExists: false,
      message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export async function recentActivity(req: Request, res: Response) {
  try {
    const daysQuery = req.query.days;
    const days = Number.isFinite(Number(daysQuery)) ? Math.max(1, Math.min(Number(daysQuery), 90)) : 7;

    const result = await snakeBenchService.getRecentActivity(days);

    return res.json({
      success: true,
      result,
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench recentActivity failed: ${message}`, 'snakebench-controller');

    return res.status(500).json({
      success: false,
      error: message,
      timestamp: Date.now(),
    });
  }
}

export async function basicLeaderboard(req: Request, res: Response) {
  try {
    const limitQuery = req.query.limit;
    const sortByQuery = req.query.sortBy;
    const limit = Number.isFinite(Number(limitQuery)) ? Math.max(1, Math.min(Number(limitQuery), 100)) : 10;
    const sortBy = sortByQuery === 'winRate' ? 'winRate' : 'gamesPlayed';

    const result = await snakeBenchService.getBasicLeaderboard(limit, sortBy);

    return res.json({
      success: true,
      result,
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench basicLeaderboard failed: ${message}`, 'snakebench-controller');

    return res.status(500).json({
      success: false,
      error: message,
      timestamp: Date.now(),
    });
  }
}

export const snakeBenchController = {
  runMatch,
  runBatch,
  listGames,
  getGame,
  health,
  recentActivity,
  basicLeaderboard,
};
