/**
 * Author: Cascade (ChatGPT 5.1 Codex)
 * Date: 2026-01-02
 * PURPOSE: Express routes for Codex-powered ARC-AGI-3 interactive gameplay.
 *          Provides start/continue/manual-action/cancel endpoints with SSE streaming.
 * SRP/DRY check: Pass — mirrors arc3.ts route patterns, reuses validators and SSE manager.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { formatResponse } from '../utils/responseFormatter';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { codexArc3StreamService } from '../services/arc3/CodexArc3StreamService';
import { Arc3ApiClient } from '../services/arc3/Arc3ApiClient';
import type { FrameData } from '../services/arc3/Arc3ApiClient';

const router = Router();

// Codex ARC3 API client for manual actions
const arc3ApiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || '');

// Validation schemas
const runSchema = z.object({
  agentName: z.string().trim().max(60).optional(),
  systemPrompt: z.string().trim().optional(),
  instructions: z
    .string({ required_error: 'instructions is required' })
    .trim()
    .min(1, 'instructions must not be empty'),
  model: z.string().trim().max(120).optional(),
  maxTurns: z.coerce.number().int().min(2).optional(),
  game_id: z.string().trim().max(120).optional(),
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  systemPromptPresetId: z.enum(['twitch', 'playbook', 'none']).optional(),
  skipDefaultSystemPrompt: z.boolean().optional(),
});

const manualActionSchema = z.object({
  game_id: z.string().trim(),
  guid: z.string().trim(),
  action: z.enum(['RESET', 'ACTION1', 'ACTION2', 'ACTION3', 'ACTION4', 'ACTION5', 'ACTION6']),
  coordinates: z.tuple([z.number().int(), z.number().int()]).optional(),
  card_id: z.string().trim().optional(),
});

const continueFrameSchema = z.object({
  frame: z.array(z.array(z.array(z.number().int()))),
  guid: z.string().trim(),
  game_id: z.string().trim(),
  score: z.number().int(),
  state: z.string().trim(),
  action_counter: z.number().int(),
  max_actions: z.number().int(),
  win_score: z.number().int(),
  full_reset: z.boolean().optional(),
});

/**
 * POST /api/arc3-codex/stream/prepare
 * Prepare a Codex streaming session (returns sessionId for SSE connection).
 */
router.post(
  '/stream/prepare',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_ERROR', parsed.error.errors.map(e => e.message).join('; '))
      );
    }

    const payload = parsed.data;
    const sessionId = codexArc3StreamService.savePendingPayload({
      game_id: payload.game_id || 'ls20',
      agentName: payload.agentName,
      systemPrompt: payload.systemPrompt,
      instructions: payload.instructions,
      model: payload.model,
      maxTurns: payload.maxTurns,
      reasoningEffort: payload.reasoningEffort,
      systemPromptPresetId: payload.systemPromptPresetId,
      skipDefaultSystemPrompt: payload.skipDefaultSystemPrompt,
    });

    res.json(formatResponse.success({ sessionId, provider: 'codex' }));
  }),
);

/**
 * GET /api/arc3-codex/stream/:sessionId
 * Open SSE connection for Codex ARC3 streaming.
 */
router.get(
  '/stream/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const payload = codexArc3StreamService.getPendingPayload(sessionId);
    if (!payload) {
      return res.status(404).json(
        formatResponse.error('SESSION_NOT_FOUND', 'No pending Codex ARC3 session found for this ID.')
      );
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register SSE connection before flushing
    sseStreamManager.register(sessionId, res);

    // Flush headers after registration
    res.flushHeaders();

    // Start streaming with error handling
    try {
      await codexArc3StreamService.startStreaming(req, { ...payload, sessionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sseStreamManager.error(sessionId, 'STREAMING_ERROR', message);
    }
  }),
);

/**
 * POST /api/arc3-codex/manual-action
 * Execute a manual action during/after Codex agent run.
 */
router.post(
  '/manual-action',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = manualActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_ERROR', parsed.error.errors.map(e => e.message).join('; '))
      );
    }

    const { game_id, guid, action, coordinates, card_id } = parsed.data;

    // Validate ACTION6 requires coordinates
    if (action === 'ACTION6' && !coordinates) {
      return res.status(400).json(
        formatResponse.error('MISSING_COORDINATES', 'ACTION6 requires coordinates [x, y].')
      );
    }

    // Validate RESET requires card_id
    if (action === 'RESET' && !card_id) {
      return res.status(400).json(
        formatResponse.error('MISSING_CARD_ID', 'RESET requires card_id from openScorecard.')
      );
    }

    // Execute action via API client
    const frameData = await arc3ApiClient.executeAction(
      game_id,
      guid,
      {
        action,
        coordinates: coordinates ? [coordinates[0], coordinates[1]] : undefined,
      },
      undefined,
      card_id
    );

    res.json(formatResponse.success({
      frameData,
      action,
      coordinates,
      provider: 'codex',
    }));
  }),
);

/**
 * POST /api/arc3-codex/stream/:sessionId/continue
 * Prepare continuation with user message.
 */
router.post(
  '/stream/:sessionId/continue',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const basePayload = codexArc3StreamService.getPendingPayload(sessionId);
    if (!basePayload) {
      return res.status(404).json(
        formatResponse.error('SESSION_NOT_FOUND', 'No Codex ARC3 session found for continuation.')
      );
    }

    const bodySchema = z.object({
      userMessage: z.string().trim().min(1).max(2000),
      previousResponseId: z.string().trim(),
      existingGameGuid: z.string().trim().optional(),
      lastFrame: continueFrameSchema.optional(),
    });

    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_ERROR', parsed.error.errors.map(e => e.message).join('; '))
      );
    }

    const { userMessage, previousResponseId, existingGameGuid, lastFrame } = parsed.data;

    // Normalize lastFrame if provided
    let normalizedFrame: FrameData | undefined;
    if (lastFrame) {
      normalizedFrame = {
        frame: lastFrame.frame,
        guid: lastFrame.guid,
        game_id: lastFrame.game_id,
        score: lastFrame.score,
        state: lastFrame.state,
        action_counter: lastFrame.action_counter,
        max_actions: lastFrame.max_actions,
        win_score: lastFrame.win_score,
        full_reset: lastFrame.full_reset ?? false,
      };
    }

    codexArc3StreamService.saveContinuationPayload(sessionId, basePayload, {
      userMessage,
      previousResponseId,
      existingGameGuid,
      lastFrame: normalizedFrame,
    });

    res.json(formatResponse.success({ sessionId, provider: 'codex', continuation: true }));
  }),
);

/**
 * GET /api/arc3-codex/stream/:sessionId/continue-stream
 * Open SSE connection for continuation.
 */
router.get(
  '/stream/:sessionId/continue-stream',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const continuationPayload = codexArc3StreamService.getContinuationPayload(sessionId);
    if (!continuationPayload) {
      return res.status(404).json(
        formatResponse.error('CONTINUATION_NOT_FOUND', 'No continuation payload found. Call /continue first.')
      );
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Register SSE connection before flushing
    sseStreamManager.register(sessionId, res);

    // Flush headers after registration
    res.flushHeaders();

    // Continue streaming with error handling
    try {
      await codexArc3StreamService.continueStreaming(req, continuationPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sseStreamManager.error(sessionId, 'STREAMING_ERROR', message);
    }
  }),
);

/**
 * POST /api/arc3-codex/stream/:sessionId/cancel
 * Cancel an active Codex session.
 */
router.post(
  '/stream/:sessionId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    codexArc3StreamService.cancelSession(sessionId);

    res.json(formatResponse.success({ sessionId, cancelled: true, provider: 'codex' }));
  }),
);

/**
 * GET /api/arc3-codex/health
 * Health check for Codex ARC3 service.
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(formatResponse.success({
      status: 'healthy',
      provider: 'codex',
      model: process.env.CODEX_ARC_MODEL || 'gpt-5.1-codex-mini',
      timestamp: Date.now(),
    }));
  }),
);

export default router;
