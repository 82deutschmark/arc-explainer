/*
Author: gpt-5-codex
Date: 2025-11-06
PURPOSE: Express router exposing the ARC3 agent playground API backed by the OpenAI Agents SDK runner.
SRP/DRY check: Pass — isolates HTTP contract and validation for ARC3 playground endpoints.
*/

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { Arc3AgentRunner } from '../services/arc3/Arc3AgentRunner';
import { Arc3RealGameRunner } from '../services/arc3/Arc3RealGameRunner';
import { Arc3ApiClient } from '../services/arc3/Arc3ApiClient';
import { arc3StreamService, type StreamArc3Payload } from '../services/arc3/arc3StreamService';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { formatResponse } from '../utils/responseFormatter';

const router = Router();
const runner = new Arc3AgentRunner();

// Real ARC3 API client and runner
const arc3ApiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || '');
const realGameRunner = new Arc3RealGameRunner(arc3ApiClient);

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
    .max(24)
    .optional(),
  scenarioId: z.string().trim().max(120).optional(),
});

router.post(
  '/agent-playground/run',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = runSchema.parse(req.body);
    const result = await runner.run(payload);
    res.json(formatResponse.success(result));
  }),
);

// NEW: Real ARC3 API endpoints

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
  gameId: z.string().trim().max(120).default('ls20'),
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

export default router;
