/*
Author: Claude Code using Sonnet 4.5
Date: 2025-11-06
PURPOSE: Express router exposing the ARC3 agent playground API backed by the OpenAI Agents SDK runner.
Manages scorecard lifecycle for the real ARC3 API integration.
SRP/DRY check: Pass — isolates HTTP contract and validation for ARC3 playground endpoints.
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
import { buildArc3DefaultPrompt } from '../services/arc3/prompts';
import { logger } from '../utils/logger';

const router = Router();

// Real ARC3 API client and runner
const arc3ApiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || '');
const realGameRunner = new Arc3RealGameRunner(arc3ApiClient);

// Initialize scorecard on server startup (required before any game operations)
let scorecardInitialized = false;
async function ensureScorecard() {
  if (!scorecardInitialized) {
    try {
      await arc3ApiClient.openScorecard(['arc-explainer', 'web-ui'], 'https://github.com/yourusername/arc-explainer');
      scorecardInitialized = true;
      console.log('✅ ARC3 scorecard opened:', arc3ApiClient.getCardId());
    } catch (error) {
      console.error('❌ Failed to open ARC3 scorecard:', error);
      throw error;
    }
  }
}

const runSchema = z.object({
  agentName: z.string().trim().max(60).optional(),
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
});

// NEW: Real ARC3 API endpoints

/**
 * GET /api/arc3/default-prompt
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
 * GET /api/arc3/games
 * List all available ARC3 games
 */
router.get(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureScorecard();  // Ensure scorecard is open before any operations
    const games = await arc3ApiClient.listGames();
    res.json(formatResponse.success(games));
  }),
);

/**
 * POST /api/arc3/start-game
 * Start a game to get initial grid state
 */
router.post(
  '/start-game',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureScorecard();  // Ensure scorecard is open before any operations
    const { game_id } = req.body;
    if (!game_id) {
      return res.status(400).json(formatResponse.error('MISSING_GAME_ID', 'game_id is required'));
    }
    const frameData = await arc3ApiClient.startGame(game_id);
    res.json(formatResponse.success(frameData));
  }),
);

const manualActionSchema = z.object({
  game_id: z.string().trim().max(120),
  guid: z.string().trim(),
  action: z.enum(['RESET', 'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']),
  coordinates: z.tuple([z.number().int().min(0).max(63), z.number().int().min(0).max(63)]).optional(),
});

/**
 * POST /api/arc3/manual-action
 * Execute a single manual action (for hybrid manual/autonomous mode)
 */
router.post(
  '/manual-action',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureScorecard();  // Ensure scorecard is open before any operations

    const { game_id, guid, action, coordinates } = manualActionSchema.parse(req.body);

    // Validate ACTION6 requires coordinates
    if (action === 'ACTION6' && !coordinates) {
      return res.status(400).json(
        formatResponse.error('MISSING_COORDINATES', 'ACTION6 requires coordinates [x, y]')
      );
    }

    // Execute action via API client
    const frameData = await arc3ApiClient.executeAction(game_id, guid, { action, coordinates });

    res.json(formatResponse.success(frameData));
  }),
);

/**
 * POST /api/arc3/real-game/run
 * Run agent against real ARC3 game
 */
router.post(
  '/real-game/run',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureScorecard();  // Ensure scorecard is open before starting game
    const payload = runSchema.parse(req.body);
    const result = await realGameRunner.run(payload);
    res.json(formatResponse.success(result));
  }),
);

// NEW: Streaming endpoints for ARC3

const streamRunSchema = z.object({
  game_id: z.string().trim().max(120).default('ls20'),  // Match API property name
  agentName: z.string().trim().max(60).optional(),
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
});

/**
 * POST /api/arc3/stream/prepare
 * Prepare a streaming session (returns sessionId)
 */
router.post(
  '/stream/prepare',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = streamRunSchema.parse(req.body);
    const sessionId = arc3StreamService.savePendingPayload(payload);
    res.json(formatResponse.success({ sessionId }));
  }),
);

/**
 * GET /api/arc3/stream/:sessionId
 * Start SSE streaming for a prepared session
 */
router.get(
  '/stream/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    await ensureScorecard();  // Ensure scorecard is open before starting stream
    const { sessionId } = req.params;
    const payload = arc3StreamService.getPendingPayload(sessionId);

    if (!payload) {
      return res
        .status(404)
        .json(formatResponse.error('SESSION_NOT_FOUND', 'Session not found or expired'));
    }

    // Register SSE connection
    sseStreamManager.register(sessionId, res);

    // Start streaming
    await arc3StreamService.startStreaming(req, { ...payload, sessionId });
  }),
);

/**
 * POST /api/arc3/stream/cancel/:sessionId
 * Cancel a streaming session
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

/**
 * POST /api/arc3/stream/:sessionId/continue
 * Prepare a continuation session (similar to /prepare, but updates existing payload)
 */
const frameSeedSchema = z.object({
  guid: z.string().trim(),
  game_id: z.string().trim(),
  frame: z.array(z.array(z.array(z.number().int()))),
  score: z.number().int(),
  state: z.string().trim(),
  action_counter: z.number().int(),
  max_actions: z.number().int(),
  win_score: z.number().int(),
  full_reset: z.boolean().optional(),
  available_actions: z.array(z.union([z.string(), z.number()])).optional(),
});

const continueSessionSchema = z.object({
  userMessage: z.string().trim().min(1, 'userMessage must not be empty'),
  previousResponseId: z.string().trim().min(1, 'previousResponseId is required for chained runs'),
  existingGameGuid: z.string().optional(), // Game session guid to continue (from previous run)
  lastFrame: frameSeedSchema.optional(),
});

router.post(
  '/stream/:sessionId/continue',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { userMessage, previousResponseId, existingGameGuid, lastFrame } = continueSessionSchema.parse(req.body);

    logger.info(`[ARC3 Continue] Preparing continuation with sessionId=${sessionId}, hasResponseId=${!!previousResponseId}, existingGameGuid=${existingGameGuid}`, 'arc3');

    // Get the existing session payload
    const payload = arc3StreamService.getPendingPayload(sessionId);
    if (!payload) {
      return res
        .status(404)
        .json(formatResponse.error('SESSION_NOT_FOUND', 'Session not found or expired'));
    }

    // Update the payload with continuation data
    const normalizedLastFrame: FrameData | undefined = lastFrame
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

    arc3StreamService.saveContinuationPayload(sessionId, payload, {
      userMessage,
      previousResponseId,
      existingGameGuid,
      lastFrame: normalizedLastFrame,
    });

    res.json(formatResponse.success({ sessionId, ready: true }));
  }),
);

/**
 * GET /api/arc3/stream/:sessionId/continue-stream
 * Start SSE streaming for a prepared continuation session
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

    // Register SSE connection for continued streaming
    sseStreamManager.register(sessionId, res);

    // Start continuation streaming
    await arc3StreamService.continueStreaming(req, continuationPayload);
  }),
);

export default router;
