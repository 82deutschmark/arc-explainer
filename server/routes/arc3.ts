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
import { buildArc3DefaultPrompt, listArc3PromptPresets, getArc3PromptBody } from '../services/arc3/prompts';
import { logger } from '../utils/logger';

const router = Router();

// Real ARC3 API client and runner
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
 * GET /api/arc3/system-prompts
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
 * GET /api/arc3/system-prompts/:id
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
 * GET /api/arc3/games
 * List all available ARC3 games
 */
router.get(
  '/games',
  asyncHandler(async (req: Request, res: Response) => {
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
    const { game_id } = req.body;
    if (!game_id) {
      return res.status(400).json(formatResponse.error('MISSING_GAME_ID', 'game_id is required'));
    }

    const scorecardId = await arc3ApiClient.openScorecard(
      ['arc-explainer', 'web-ui'],
      'https://github.com/yourusername/arc-explainer',
      { source: 'arc-explainer', mode: 'web-ui', game_id }
    );
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
 * POST /api/arc3/manual-action
 * Execute a single manual action (for hybrid manual/autonomous mode)
 */
router.post(
  '/manual-action',
  asyncHandler(async (req: Request, res: Response) => {
    const { game_id, guid, action, coordinates, card_id } = manualActionSchema.parse(req.body);

    // Validate ACTION6 requires coordinates
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

    // Execute action via API client
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
 * POST /api/arc3/real-game/run
 * Run agent against real ARC3 game
 */
router.post(
  '/real-game/run',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = runSchema.parse(req.body);
    const result = await realGameRunner.run(payload);
    res.json(formatResponse.success(result));
  }),
);

// NEW: Streaming endpoints for ARC3

const streamRunSchema = z.object({
  game_id: z.string().trim().max(120).default('ls20'),  // Match API property name
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
  action_counter: z.number().int().optional(),
  max_actions: z.number().int().optional(),
  win_score: z.number().int().optional(),
  full_reset: z.boolean().optional(),
  available_actions: z.array(z.union([z.string(), z.number()])).optional(),
});

const continueSessionSchema = z.object({
  userMessage: z.string().trim().min(1, 'userMessage must not be empty'),
  previousResponseId: z.string().trim().min(1).optional(),
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

    const effectivePreviousResponseId = previousResponseId || payload.providerResponseId;
    if (!effectivePreviousResponseId) {
      return res
        .status(400)
        .json(formatResponse.error('MISSING_PREVIOUS_RESPONSE_ID', 'previousResponseId is required to chain Responses API runs. Restart the ARC3 agent to create a new chain.'));
    }

    // Update the payload with continuation data
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
      logger.warn(`[ARC3 Continue] Ignoring incomplete client frame, using cached frame. Missing counters in client frame for session ${sessionId}`, 'arc3');
    }

    const normalizedLastFrame: FrameData | undefined = clientComplete
      ? (clientFrame as FrameData)
      : cachedFrame;

    logger.info(`[ARC3 Continue] Frame source for session ${sessionId}: ${clientComplete ? 'client' : cachedFrame ? 'cached' : 'none'}`, 'arc3');

    let continuationGameGuid = existingGameGuid;
    if (existingGameGuid && (!normalizedLastFrame || normalizedLastFrame.action_counter === undefined || normalizedLastFrame.max_actions === undefined)) {
      logger.warn(`[ARC3 Continue] Missing usable seed frame; falling back to fresh session (existingGameGuid cleared) for session ${sessionId}`, 'arc3');
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
