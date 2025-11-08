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
    .max(400)
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
    .max(400)
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

/**
 * POST /api/arc3/stream/:sessionId/continue
 * Continue a paused agent session with a new user message (message chaining with Responses API)
 */
const continueSessionSchema = z.object({
  userMessage: z.string().trim().min(1, 'userMessage must not be empty'),
  previousResponseId: z.string().optional(), // From last response (stored in DB)
  existingGameGuid: z.string().optional(), // Game session guid to continue (from previous run)
});

router.post(
  '/stream/:sessionId/continue',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { userMessage, previousResponseId, existingGameGuid } = continueSessionSchema.parse(req.body);

    logger.info(`[ARC3 Continue] Starting continuation with sessionId=${sessionId}, hasResponseId=${!!previousResponseId}, existingGameGuid=${existingGameGuid}`, 'arc3');

    // Get the session payload
    const payload = arc3StreamService.getPendingPayload(sessionId);
    if (!payload) {
      return res
        .status(404)
        .json(formatResponse.error('SESSION_NOT_FOUND', 'Session not found or expired'));
    }

    // Register SSE connection for continued streaming
    sseStreamManager.register(sessionId, res);

    // Start continuation streaming
    await arc3StreamService.continueStreaming(req, {
      ...payload,
      sessionId,
      userMessage,
      previousResponseId,
      existingGameGuid,  // Pass the existing game guid for session continuation
    });
  }),
);

export default router;
