/**
 * server/controllers/snakeBenchController.ts
 *
 * Author: Codex (GPT-5)
 * Date: 2025-12-20
 * Updated: 2025-12-25 - Environment-aware BYOK: production requires user API keys
 * PURPOSE: HTTP API controller for SnakeBench match runs, replay access, and model insights reporting.
 * SRP/DRY check: Pass - controller-only logic, delegates execution to snakeBenchService.
 */

import type { Request, Response } from 'express';

import { snakeBenchService } from '../services/snakeBenchService';
import { snakeBenchIngestQueue } from '../services/snakeBenchIngestQueue';
import { loadWormArenaPromptTemplateBundle } from '../services/snakeBench/SnakeBenchLlmPlayerPromptTemplate.ts';
import { logger } from '../utils/logger';
import { requiresUserApiKey } from '../utils/environmentPolicy.js';
import type {
  SnakeBenchRunMatchRequest,
  SnakeBenchRunMatchResponse,
  SnakeBenchRunBatchRequest,
  SnakeBenchRunBatchResponse,
  SnakeBenchListGamesResponse,
  SnakeBenchGameDetailResponse,
  SnakeBenchMatchSearchQuery,
  SnakeBenchMatchSearchResponse,
  SnakeBenchHealthResponse,
  SnakeBenchStatsResponse,
  SnakeBenchModelRatingResponse,
  SnakeBenchModelHistoryResponse,
  SnakeBenchTrueSkillLeaderboardResponse,
  WormArenaGreatestHitsResponse,
  WormArenaSuggestMatchupsResponse,
  WormArenaSuggestMode,
  SnakeBenchLlmPlayerPromptTemplateResponse,
  WormArenaModelInsightsResponse,
  WormArenaRunLengthDistributionResponse,
} from '../../shared/types.js';

export async function getLlmPlayerPromptTemplate(req: Request, res: Response) {
  try {
    const result = await loadWormArenaPromptTemplateBundle();

    const response: SnakeBenchLlmPlayerPromptTemplateResponse = {
      success: true,
      result,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench getLlmPlayerPromptTemplate failed: ${message}`, 'snakebench-controller');

    const response: SnakeBenchLlmPlayerPromptTemplateResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

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

    // Environment-aware BYOK enforcement: production requires user API key
    if (requiresUserApiKey() && (!body.apiKey || String(body.apiKey).trim().length === 0)) {
      const response: SnakeBenchRunMatchResponse = {
        success: false,
        error: 'Production requires your API key. Your key is used for this session only and is never stored.',
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

/**
 * GET /api/snakebench/games/:gameId/proxy
 *
 * Server-side replay proxy. Intended as a fallback when the browser cannot fetch
 * replay JSON directly from remote URLs (most commonly due to CORS).
 */
export async function getGameProxy(req: Request, res: Response) {
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

    const result = await snakeBenchService.getGameProxy(gameId);

    const response: SnakeBenchGameDetailResponse = {
      success: true,
      gameId,
      data: result.data,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench getGameProxy failed: ${message}`, 'snakebench-controller');

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

export async function searchMatches(req: Request, res: Response) {
  try {
    const modelRaw = (req.query.model as string | undefined) ?? '';
    const model = modelRaw.trim();

    if (!model) {
      const response: SnakeBenchMatchSearchResponse = {
        success: false,
        model: '',
        rows: [],
        total: 0,
        error: 'model query parameter is required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const query: SnakeBenchMatchSearchQuery = {
      model,
      opponent: typeof req.query.opponent === 'string' ? req.query.opponent : undefined,
      result: typeof req.query.result === 'string' ? (req.query.result as any) : undefined,
      deathReason: typeof req.query.deathReason === 'string' ? (req.query.deathReason as any) : undefined,
      minRounds: typeof req.query.minRounds === 'string' ? Number(req.query.minRounds) : undefined,
      maxRounds: typeof req.query.maxRounds === 'string' ? Number(req.query.maxRounds) : undefined,
      minScore: typeof req.query.minScore === 'string' ? Number(req.query.minScore) : undefined,
      maxScore: typeof req.query.maxScore === 'string' ? Number(req.query.maxScore) : undefined,
      minCost: typeof req.query.minCost === 'string' ? Number(req.query.minCost) : undefined,
      maxCost: typeof req.query.maxCost === 'string' ? Number(req.query.maxCost) : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      sortBy: typeof req.query.sortBy === 'string' ? (req.query.sortBy as any) : undefined,
      sortDir: typeof req.query.sortDir === 'string' ? (req.query.sortDir as any) : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      offset: typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined,
    };

    const { rows, total } = await snakeBenchService.searchMatches(query);

    const response: SnakeBenchMatchSearchResponse = {
      success: true,
      model,
      rows,
      total,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench searchMatches failed: ${message}`, 'snakebench-controller');

    const modelRaw = (req.query.model as string | undefined) ?? '';
    const response: SnakeBenchMatchSearchResponse = {
      success: false,
      model: modelRaw.trim(),
      rows: [],
      total: 0,
      error: message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export async function getWormArenaGreatestHits(req: Request, res: Response) {
  try {
    const rawLimit = req.query.limitPerDimension as string | undefined;
    let limit: number | undefined;

    if (typeof rawLimit === 'string' && rawLimit.trim().length > 0) {
      const parsed = Number(rawLimit.trim());
      if (Number.isFinite(parsed)) {
        limit = parsed;
      }
    }

    const games = await snakeBenchService.getWormArenaGreatestHits(limit ?? 5);

    const response: WormArenaGreatestHitsResponse = {
      success: true,
      games,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench getWormArenaGreatestHits failed: ${message}`, 'snakebench-controller');

    const response: WormArenaGreatestHitsResponse = {
      success: false,
      games: [],
      error: message,
      timestamp: Date.now(),
    };

    return res.status(500).json(response);
  }
}

export async function trueSkillLeaderboard(req: Request, res: Response) {
  try {
    const limitQuery = req.query.limit as string | undefined;
    const minGamesQuery = req.query.minGames as string | undefined;

    const parsedLimit = limitQuery != null && Number.isFinite(Number(limitQuery)) ? Number(limitQuery) : undefined;
    const parsedMinGames =
      minGamesQuery != null && Number.isFinite(Number(minGamesQuery)) ? Number(minGamesQuery) : undefined;

    const entries = await snakeBenchService.getTrueSkillLeaderboard(parsedLimit ?? 150, parsedMinGames ?? 3);

    const response: SnakeBenchTrueSkillLeaderboardResponse = {
      success: true,
      entries,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench trueSkillLeaderboard failed: ${message}`, 'snakebench-controller');
    const response: SnakeBenchTrueSkillLeaderboardResponse = {
      success: false,
      entries: [],
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

/**
 * GET /api/snakebench/games/:gameId
 *
 * Returns replay data in one of two ways (matching upstream SnakeBench pattern):
 * - { data: <JSON> } when local file is available (local dev)
 * - { replayUrl: <string> } when client should fetch directly from URL (deployment)
 *
 * This eliminates server-side JSON proxy truncation issues in deployment.
 */
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

    const result = await snakeBenchService.getGame(gameId);

    // Service now always returns { data } directly (server-side fetch)
    const response: SnakeBenchGameDetailResponse = {
      success: true,
      gameId,
      data: result.data,
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
    const daysRaw = req.query.days as string | undefined;
    let days: number | undefined;

    if (typeof daysRaw === 'string') {
      const trimmed = daysRaw.trim().toLowerCase();
      if (trimmed === 'all') {
        days = 0;
      } else if (trimmed.length > 0) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          days = parsed;
        }
      }
    }

    const effectiveDays = days === undefined ? 7 : days;

    const result = await snakeBenchService.getRecentActivity(effectiveDays);

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
    const limit = Number.isFinite(Number(limitQuery)) ? Math.max(1, Math.min(Number(limitQuery), 150)) : 10;
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

export async function stats(req: Request, res: Response) {
  try {
    const stats = await snakeBenchService.getArcExplainerStats();
    const response: SnakeBenchStatsResponse = {
      success: true,
      stats,
      timestamp: Date.now(),
    };
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench stats failed: ${message}`, 'snakebench-controller');
    const response: SnakeBenchStatsResponse = {
      success: false,
      stats: { totalGames: 0, activeModels: 0, topApples: 0, totalCost: 0 },
      error: message as any,
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}

export async function modelRating(req: Request, res: Response) {
  try {
    const modelSlugRaw = (req.query.modelSlug as string | undefined) ?? '';
    const modelSlug = modelSlugRaw.trim();

    if (!modelSlug) {
      const response: SnakeBenchModelRatingResponse = {
        success: false,
        error: 'modelSlug query parameter is required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const rating = await snakeBenchService.getModelRating(modelSlug);
    const response: SnakeBenchModelRatingResponse = {
      success: true,
      rating,
      timestamp: Date.now(),
    };
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench modelRating failed: ${message}`, 'snakebench-controller');
    const response: SnakeBenchModelRatingResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}

export async function modelHistory(req: Request, res: Response) {
  try {
    const modelSlugRaw = (req.query.modelSlug as string | undefined) ?? '';
    const modelSlug = modelSlugRaw.trim();
    const limitQuery = req.query.limit as string | undefined;
    const limit = limitQuery != null && Number.isFinite(Number(limitQuery)) ? Number(limitQuery) : undefined;

    if (!modelSlug) {
      const response: SnakeBenchModelHistoryResponse = {
        success: false,
        modelSlug: '',
        history: [],
        timestamp: Date.now(),
        error: 'modelSlug query parameter is required' as any,
      };
      return res.status(400).json(response);
    }

    const history = await snakeBenchService.getModelMatchHistory(modelSlug, limit);
    const response: SnakeBenchModelHistoryResponse = {
      success: true,
      modelSlug,
      history,
      timestamp: Date.now(),
    };
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench modelHistory failed: ${message}`, 'snakebench-controller');
    const response: SnakeBenchModelHistoryResponse = {
      success: false,
      modelSlug: '',
      history: [],
      timestamp: Date.now(),
      error: message as any,
    };
    return res.status(500).json(response);
  }
}

export async function suggestMatchups(req: Request, res: Response) {
  try {
    const modeQuery = req.query.mode as string | undefined;
    const limitQuery = req.query.limit as string | undefined;
    const minGamesQuery = req.query.minGames as string | undefined;

    // Validate mode
    let mode: WormArenaSuggestMode = 'ladder';
    if (modeQuery === 'entertainment') {
      mode = 'entertainment';
    } else if (modeQuery && modeQuery !== 'ladder') {
      const response: WormArenaSuggestMatchupsResponse = {
        success: false,
        mode: 'ladder',
        matchups: [],
        totalCandidates: 0,
        error: `Invalid mode '${modeQuery}'. Must be 'ladder' or 'entertainment'.`,
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const parsedLimit = limitQuery != null && Number.isFinite(Number(limitQuery)) ? Number(limitQuery) : 20;
    const parsedMinGames = minGamesQuery != null && Number.isFinite(Number(minGamesQuery)) ? Number(minGamesQuery) : 3;

    const result = await snakeBenchService.suggestMatchups(mode, parsedLimit, parsedMinGames);

    const response: WormArenaSuggestMatchupsResponse = {
      success: true,
      mode: result.mode,
      matchups: result.matchups,
      totalCandidates: result.totalCandidates,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench suggestMatchups failed: ${message}`, 'snakebench-controller');
    const response: WormArenaSuggestMatchupsResponse = {
      success: false,
      mode: 'ladder',
      matchups: [],
      totalCandidates: 0,
      error: message,
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}

export async function ingestQueueStatus(req: Request, res: Response) {
  try {
    const pendingJobs = snakeBenchIngestQueue.getPendingJobCount();
    
    return res.json({
      success: true,
      pendingJobs,
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench ingestQueueStatus failed: ${message}`, 'snakebench-controller');
    
    return res.status(500).json({
      success: false,
      pendingJobs: 0,
      error: message,
      timestamp: Date.now(),
    });
  }
}

/**
 * GET /api/snakebench/models-with-games
 * Returns only models that have actually played games.
 * Used by the Model Match History page picker.
 */
export async function modelsWithGames(req: Request, res: Response) {
  try {
    const models = await snakeBenchService.getModelsWithGames();

    return res.json({
      success: true,
      models,
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench modelsWithGames failed: ${message}`, 'snakebench-controller');

    return res.status(500).json({
      success: false,
      models: [],
      error: message,
      timestamp: Date.now(),
    });
  }
}

/**
 * GET /api/snakebench/model-history-full?modelSlug=...
 * Returns ALL match history for a model (unbounded).
 * Used by the Model Match History page to show every game a model has ever played.
 */
export async function modelHistoryFull(req: Request, res: Response) {
  try {
    const modelSlugRaw = (req.query.modelSlug as string | undefined) ?? '';
    const modelSlug = modelSlugRaw.trim();

    if (!modelSlug) {
      return res.status(400).json({
        success: false,
        modelSlug: '',
        history: [],
        error: 'modelSlug query parameter is required',
        timestamp: Date.now(),
      });
    }

    const history = await snakeBenchService.getModelMatchHistoryUnbounded(modelSlug);

    // Also get the model's aggregate stats for the header
    const rating = await snakeBenchService.getModelRating(modelSlug);

    return res.json({
      success: true,
      modelSlug,
      history,
      rating,
      timestamp: Date.now(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench modelHistoryFull failed: ${message}`, 'snakebench-controller');

    return res.status(500).json({
      success: false,
      modelSlug: '',
      history: [],
      error: message,
      timestamp: Date.now(),
    });
  }
}

/**
 * GET /api/snakebench/model-insights?modelSlug=...
 * Returns an actionable insights report for a specific model.
 */
export async function modelInsightsReport(req: Request, res: Response) {
  try {
    const modelSlugRaw = (req.query.modelSlug as string | undefined) ?? '';
    const modelSlug = modelSlugRaw.trim();

    if (!modelSlug) {
      const response: WormArenaModelInsightsResponse = {
        success: false,
        modelSlug: '',
        error: 'modelSlug query parameter is required',
        timestamp: Date.now(),
      };
      return res.status(400).json(response);
    }

    const report = await snakeBenchService.getModelInsightsReport(modelSlug);

    if (!report) {
      const response: WormArenaModelInsightsResponse = {
        success: false,
        modelSlug,
        error: 'No insights available for this model',
        timestamp: Date.now(),
      };
      return res.status(404).json(response);
    }

    const response: WormArenaModelInsightsResponse = {
      success: true,
      modelSlug: report.modelSlug,
      report,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench modelInsightsReport failed: ${message}`, 'snakebench-controller');
    const response: WormArenaModelInsightsResponse = {
      success: false,
      modelSlug: '',
      error: message,
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}

export async function runLengthDistribution(req: Request, res: Response) {
  try {
    // Parse and validate query parameters
    const minGamesParam = req.query.minGames;
    let minGames = 10; // default

    if (minGamesParam !== undefined) {
      const parsed = parseInt(String(minGamesParam), 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        const response: { success: boolean; error: string; timestamp: number } = {
          success: false,
          error: 'minGames must be a non-negative integer',
          timestamp: Date.now(),
        };
        return res.status(400).json(response);
      }
      if (parsed > 1000) {
        const response: { success: boolean; error: string; timestamp: number } = {
          success: false,
          error: 'minGames cannot exceed 1000',
          timestamp: Date.now(),
        };
        return res.status(400).json(response);
      }
      minGames = parsed;
    }

    // Call service to get distribution data
    const data = await snakeBenchService.getRunLengthDistribution(minGames);

    const response: WormArenaRunLengthDistributionResponse = {
      success: true,
      data,
      timestamp: Date.now(),
    };

    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`SnakeBench runLengthDistribution failed: ${message}`, 'snakebench-controller');
    const response: WormArenaRunLengthDistributionResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };
    return res.status(500).json(response);
  }
}

export const snakeBenchController = {
  runMatch,
  runBatch,
  listGames,
  getGame,
  getGameProxy,
  searchMatches,
  health,
  recentActivity,
  basicLeaderboard,
  stats,
  modelRating,
  modelHistory,
  modelHistoryFull,
  modelInsightsReport,
  modelsWithGames,
  trueSkillLeaderboard,
  getWormArenaGreatestHits,
  suggestMatchups,
  ingestQueueStatus,
  getLlmPlayerPromptTemplate,
  runLengthDistribution,
};

