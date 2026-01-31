/*
 * Author: Cascade (Claude)
 * Date: 2026-01-31
 * PURPOSE: Archived ARC3 preview-era routes. Contains the original agent playground,
 *          streaming, and game management endpoints for historical reference.
 *          All endpoints mounted under /api/arc3-archive/* prefix.
 * SRP/DRY check: Pass — isolates archived HTTP endpoints for ARC3 preview functionality.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { Arc3RealGameRunner } from '../services/arc3/Arc3RealGameRunner';
import { Arc3ApiClient } from '../services/arc3/Arc3ApiClient';
import type { FrameData } from '../services/arc3/Arc3ApiClient';
import { arc3StreamService, type StreamArc3Payload } from '../services/arc3/Arc3StreamService';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { formatResponse } from '../utils/responseFormatter';
import { buildArc3DefaultPrompt, listArc3PromptPresets, getArc3PromptBody } from '../services/arc3/prompts';
import { logger } from '../utils/logger';
import { ARC3_GAMES } from '../../shared/arc3Games';
import { discoverLevelScreenshots, enrichGameWithScreenshots } from '../services/arc3ScreenshotService';
import { requiresUserApiKey } from '../utils/environmentPolicy.js';
import { openScorecard, getActiveScorecard } from '../services/arc3/scorecardService';

const router = Router();

// Real ARC3 API client and runner (archived preview functionality)
const arc3ApiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || '');
const realGameRunner = new Arc3RealGameRunner(arc3ApiClient);

const runSchema = z.object({
  agentName: z.string().trim().max(60).optional(),
  systemPrompt: z.string().trim().optional(),
  instructions: z
    .string({ required_error: 'instructions is required' })
    .trim()
    .min(1, 'instructions must not be empty'),
  model: z.string().trim().max(120).optional(),
  maxTurns: z
    .coerce.number()
    .int()
    .min(2)
    .optional(),
  game_id: z.string().trim().max(120).optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  systemPromptPresetId: z.enum(['twitch', 'playbook', 'none']).optional(),
  skipDefaultSystemPrompt: z.boolean().optional(),
  apiKey: z.string().trim().optional(),
});

// ============================================================================
// ARCHIVED ENDPOINTS - Original ARC3 Preview API
// ============================================================================

/**
 * GET /api/arc3-archive/default-prompt
 * Fetch the default system prompt for ARC3 agent (server-side, not hardcoded in UI)
 */
router.get(
  '/default-prompt',
  asyncHandler(async (req: Request, res: Response) => {
    const prompt = buildArc3DefaultPrompt();
    res.json(formatResponse.success({ prompt }));
  }),
);

/**
 * GET /api/arc3-archive/system-prompts
 * Return metadata for available ARC3 system prompt presets (no bodies).
 */
router.get(
  '/system-prompts',
  asyncHandler(async (req: Request, res: Response) => {
    const presets = listArc3PromptPresets();
    res.json(formatResponse.success(presets));
  }),
);

/**
 * GET /api/arc3-archive/system-prompts/:id
 * Return full prompt body and metadata for a specific preset.
 */
router.get(
  '/system-prompts/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (id !== 'twitch' && id !== 'playbook' && id !== 'none') {
      return res
        .status(404)
        .json(formatResponse.error('PRESET_NOT_FOUND', 'Unknown ARC3 system prompt preset id.'));
    }

    const presets = listArc3PromptPresets();
    const meta = presets.find((p) => p.id === id);
    if (!meta) {
      return res
        .status(404)
        .json(formatResponse.error('PRESET_NOT_FOUND', 'Unknown ARC3 system prompt preset id.'));
    }

    const body = getArc3PromptBody(id as any);
    res.json(
      formatResponse.success({
        id: meta.id,
        label: meta.label,
        description: meta.description,
        isDefault: meta.isDefault,
        body,
      }),
    );
  }),
);

/**
 * GET /api/arc3-archive/games
 * List all available ARC3 games (archived official games)
 */
router.get(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
    const games = await arc3ApiClient.listGames();
    res.json(formatResponse.success(games));
  }),
);

/**
 * GET /api/arc3-archive/metadata/games
 * Get all archived games with auto-discovered level screenshots
 */
router.get(
  '/metadata/games',
  asyncHandler(async (req: Request, res: Response) => {
    const gamesWithScreenshots = Object.entries(ARC3_GAMES).map(([gameId, game]) => {
      return enrichGameWithScreenshots(game);
    });
    res.json(formatResponse.success(gamesWithScreenshots));
  }),
);

/**
 * GET /api/arc3-archive/metadata/games/:gameId
 * Get a specific archived game with auto-discovered level screenshots
 */
router.get(
  '/metadata/games/:gameId',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const game = ARC3_GAMES[gameId];
    
    if (!game) {
      return res.status(404).json(formatResponse.error('GAME_NOT_FOUND', 'Game not found'));
    }

    const gameWithScreenshots = enrichGameWithScreenshots(game);
    res.json(formatResponse.success(gameWithScreenshots));
  }),
);

/**
 * GET /api/arc3-archive/metadata/games/:gameId/screenshots
 * Get level screenshots for a specific archived game
 */
router.get(
  '/metadata/games/:gameId/screenshots',
  asyncHandler(async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const screenshots = discoverLevelScreenshots(gameId);
    
    res.json(formatResponse.success({
      gameId,
      screenshots,
      count: screenshots.length
    }));
  }),
);

/**
 * POST /api/arc3-archive/start-game
 * Start a new ARC3 game with scorecard tracking (archived)
 */
router.post(
  '/start-game',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = runSchema.pick({ game_id: true }).parse(req.body);
    const game_id = parsed.game_id || 'ls20';
    
    let scorecardId: string;
    try {
      const activeScorecard = await getActiveScorecard();
      if (activeScorecard) {
        scorecardId = activeScorecard.cardId;
      } else {
        scorecardId = await openScorecard(
          'https://github.com/arc-explainer/arc-explainer',
          ['arc-explainer', 'web-ui', 'archive'],
          { source: 'arc-explainer', mode: 'archive', game_id }
        );
      }
    } catch (error) {
      logger.error(`Failed to get/create scorecard: ${error instanceof Error ? error.message : String(error)}`, 'arc3-archive');
      return res.status(500).json(formatResponse.error('SCORECARD_ERROR', 'Failed to initialize scorecard'));
    }

    const frameData = await arc3ApiClient.startGame(game_id, undefined, scorecardId);
    res.json(formatResponse.success({ ...frameData, card_id: scorecardId }));
  }),
);

const manualActionSchema = z.object({
  game_id: z.string().trim().max(120),
  guid: z.string().trim(),
  action: z.enum(['RESET', 'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6', 'ACTION7']),
  coordinates: z.tuple([z.number().int().min(0).max(63), z.number().int().min(0).max(63)]).optional(),
  card_id: z.string().trim().optional(),
});

/**
 * POST /api/arc3-archive/manual-action
 * Execute a single manual action (archived)
 */
router.post(
  '/manual-action',
  asyncHandler(async (req: Request, res: Response) => {
    const { game_id, guid, action, coordinates, card_id } = manualActionSchema.parse(req.body);

    if (action === 'ACTION6' && !coordinates) {
      return res.status(400).json(
        formatResponse.error('MISSING_COORDINATES', 'ACTION6 requires coordinates [x, y]')
      );
    }

    if (action === 'RESET' && !card_id) {
      return res.status(400).json(
        formatResponse.error('MISSING_CARD_ID', 'RESET requires card_id from the start-game response')
      );
    }

    const frameData = await arc3ApiClient.executeAction(
      game_id,
      guid,
      { action, coordinates },
      undefined,
      card_id ?? undefined,
    );

    res.json(formatResponse.success(frameData));
  }),
);

/**
 * POST /api/arc3-archive/real-game/run
 * Run agent against real ARC3 game (archived)
 */
router.post(
  '/real-game/run',
  asyncHandler(async (req: Request, res: Response) => {
    const userApiKey = req.body?.apiKey?.trim?.() || '';
    if (requiresUserApiKey() && !userApiKey) {
      return res.status(400).json(
        formatResponse.error(
          'API_KEY_REQUIRED',
          'Production requires your API key. Your key is used for this session only and is never stored.'
        )
      );
    }

    const payload = runSchema.parse(req.body);
    const result = await realGameRunner.run(payload);
    res.json(formatResponse.success(result));
  }),
);

// ============================================================================
// ARCHIVED STREAMING ENDPOINTS
// ============================================================================

const streamRunSchema = z.object({
  game_id: z.string().trim().max(120).default('ls20'),
  agentName: z.string().trim().max(60).optional(),
  systemPrompt: z.string().trim().optional(),
  instructions: z
    .string({ required_error: 'instructions is required' })
    .trim()
    .min(1, 'instructions must not be empty'),
  model: z.string().trim().max(120).optional(),
  maxTurns: z
    .coerce.number()
    .int()
    .min(2)
    .optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  systemPromptPresetId: z.enum(['twitch', 'playbook', 'none']).optional(),
  skipDefaultSystemPrompt: z.boolean().optional(),
  apiKey: z.string().trim().optional(),
});

/**
 * POST /api/arc3-archive/stream/prepare
 * Prepare a streaming session (returns sessionId) - archived
 */
router.post(
  '/stream/prepare',
  asyncHandler(async (req: Request, res: Response) => {
    const userApiKey = req.body?.apiKey?.trim?.() || '';
    if (requiresUserApiKey() && !userApiKey) {
      return res.status(400).json(
        formatResponse.error(
          'API_KEY_REQUIRED',
          'Production requires your API key. Your key is used for this session only and is never stored.'
        )
      );
    }

    const payload = streamRunSchema.parse(req.body);
    const sessionId = arc3StreamService.savePendingPayload(payload);
    res.json(formatResponse.success({ sessionId }));
  }),
);

/**
 * GET /api/arc3-archive/stream/:sessionId
 * Start SSE streaming for a prepared session - archived
 */
router.get(
  '/stream/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const payload = arc3StreamService.getPendingPayload(sessionId);

    if (!payload) {
      return res
        .status(404)
        .json(formatResponse.error('SESSION_NOT_FOUND', 'Session not found or expired'));
    }

    sseStreamManager.register(sessionId, res);
    await arc3StreamService.startStreaming(req, { ...payload, sessionId });
  }),
);

/**
 * POST /api/arc3-archive/stream/cancel/:sessionId
 * Cancel a streaming session - archived
 */
router.post(
  '/stream/cancel/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    arc3StreamService.cancelSession(sessionId);
    res.json(formatResponse.success({ cancelled: true }));
  }),
);

const normalizeAvailableActions = (tokens?: Array<string | number>): string[] | undefined => {
  if (!tokens || tokens.length === 0) {
    return undefined;
  }

  const normalized = tokens
    .map((token) => {
      if (typeof token === 'number') {
        return token === 0 ? 'RESET' : `ACTION${token}`;
      }

      const trimmed = token.trim();
      if (!trimmed) {
        return null;
      }

      const upper = trimmed.toUpperCase();
      if (upper === 'RESET') {
        return 'RESET';
      }

      if (/^ACTION\d+$/.test(upper)) {
        return upper;
      }

      if (/^\d+$/.test(upper)) {
        return upper === '0' ? 'RESET' : `ACTION${upper}`;
      }

      return upper;
    })
    .filter((value): value is string => value !== null);

  return normalized.length > 0 ? normalized : undefined;
};

const frameSeedSchema = z.object({
  guid: z.string().trim(),
  game_id: z.string().trim(),
  frame: z.array(z.array(z.array(z.number().int()))),
  score: z.number().int(),
  state: z.string().trim(),
  action_counter: z.number().int().optional(),
  max_actions: z.number().int().optional(),
  win_score: z.number().int().optional(),
  full_reset: z.boolean().optional(),
  available_actions: z.array(z.union([z.string(), z.number()])).optional(),
});

const continueSessionSchema = z.object({
  userMessage: z.string().trim().min(1, 'userMessage must not be empty'),
  previousResponseId: z.string().trim().min(1).optional(),
  existingGameGuid: z.string().optional(),
  lastFrame: frameSeedSchema.optional(),
});

/**
 * POST /api/arc3-archive/stream/:sessionId/continue
 * Prepare a continuation session - archived
 */
router.post(
  '/stream/:sessionId/continue',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { userMessage, previousResponseId, existingGameGuid, lastFrame } = continueSessionSchema.parse(req.body);

    logger.info(`[ARC3 Archive Continue] Preparing continuation with sessionId=${sessionId}, hasResponseId=${!!previousResponseId}, existingGameGuid=${existingGameGuid}`, 'arc3-archive');

    const payload = arc3StreamService.getPendingPayload(sessionId);
    if (!payload) {
      return res
        .status(404)
        .json(formatResponse.error('SESSION_NOT_FOUND', 'Session not found or expired'));
    }

    const effectivePreviousResponseId = previousResponseId || payload.providerResponseId;
    if (!effectivePreviousResponseId) {
      return res
        .status(400)
        .json(formatResponse.error('MISSING_PREVIOUS_RESPONSE_ID', 'previousResponseId is required to chain Responses API runs. Restart the ARC3 agent to create a new chain.'));
    }

    const cachedFrame = payload.lastFrame;
    const clientFrame = lastFrame
      ? {
          guid: lastFrame.guid,
          game_id: lastFrame.game_id,
          frame: lastFrame.frame,
          score: lastFrame.score,
          state: lastFrame.state,
          action_counter: lastFrame.action_counter,
          max_actions: lastFrame.max_actions,
          win_score: lastFrame.win_score,
          full_reset: lastFrame.full_reset,
          available_actions: normalizeAvailableActions(lastFrame.available_actions),
        }
      : undefined;

    const clientComplete = Boolean(
      clientFrame &&
      clientFrame.action_counter !== undefined &&
      clientFrame.max_actions !== undefined &&
      clientFrame.win_score !== undefined
    );

    if (clientFrame && !clientComplete && cachedFrame) {
      logger.warn(`[ARC3 Archive Continue] Ignoring incomplete client frame, using cached frame. Missing counters in client frame for session ${sessionId}`, 'arc3-archive');
    }

    const normalizedLastFrame: FrameData | undefined = clientComplete
      ? (clientFrame as FrameData)
      : cachedFrame;

    logger.info(`[ARC3 Archive Continue] Frame source for session ${sessionId}: ${clientComplete ? 'client' : cachedFrame ? 'cached' : 'none'}`, 'arc3-archive');

    let continuationGameGuid = existingGameGuid;
    if (existingGameGuid && (!normalizedLastFrame || normalizedLastFrame.action_counter === undefined || normalizedLastFrame.max_actions === undefined)) {
      logger.warn(`[ARC3 Archive Continue] Missing usable seed frame; falling back to fresh session (existingGameGuid cleared) for session ${sessionId}`, 'arc3-archive');
      continuationGameGuid = undefined;
    }

    arc3StreamService.saveContinuationPayload(sessionId, payload, {
      userMessage,
      previousResponseId: effectivePreviousResponseId,
      existingGameGuid: continuationGameGuid,
      lastFrame: normalizedLastFrame,
    });

    res.json(formatResponse.success({ sessionId, ready: true }));
  }),
);

/**
 * GET /api/arc3-archive/stream/:sessionId/continue-stream
 * Start SSE streaming for a prepared continuation session - archived
 */
router.get(
  '/stream/:sessionId/continue-stream',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const continuationPayload = arc3StreamService.getContinuationPayload(sessionId);

    if (!continuationPayload) {
      return res
        .status(404)
        .json(formatResponse.error('SESSION_NOT_FOUND', 'Continuation session not found or expired'));
    }

    sseStreamManager.register(sessionId, res);
    await arc3StreamService.continueStreaming(req, continuationPayload);
  }),
);

export default router;
