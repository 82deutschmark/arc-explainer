/**
 * Author: Cascade
 * Date: 2026-01-02
 * PURPOSE: Express routes for OpenRouter ARC3 agent streaming.
 *          Endpoints: /stream/prepare, /stream/:sessionId, /stream/cancel/:sessionId, /health
 *          Pattern: arc3OpenAI.ts routes
 * SRP/DRY check: Pass — HTTP route handling only, delegates to stream service.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { sseStreamManager } from '../services/streaming/SSEStreamManager.ts';
import { arc3OpenRouterStreamService } from '../services/arc3/Arc3OpenRouterStreamService.ts';
import { logger } from '../utils/logger.ts';

const router = Router();

// Validation schema for stream prepare request
const prepareSchema = z.object({
  game_id: z.string().min(1, 'game_id is required'),
  model: z.string().default('xiaomi/mimo-v2-flash:free'),
  instructions: z.string().optional(),
  systemPrompt: z.string().optional(),
  maxTurns: z.number().int().min(1).max(200).optional().default(50),
  apiKey: z.string().optional(),  // OpenRouter BYOK
  arc3ApiKey: z.string().optional(),  // ARC3 API key BYOK
});

// Helper for consistent response format
const formatResponse = {
  success: <T>(data: T) => ({ success: true, data }),
  error: (code: string, message: string) => ({ success: false, error: { code, message } }),
};

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response) => Promise<any>) => {
  return (req: Request, res: Response, next: any) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
};

/**
 * POST /stream/prepare
 * Prepare a streaming session, returns sessionId for SSE connection.
 */
router.post(
  '/stream/prepare',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = prepareSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(
        formatResponse.error('VALIDATION_ERROR', parsed.error.errors.map(e => e.message).join('; '))
      );
    }

    const payload = parsed.data;
    logger.info(
      `[Arc3OpenRouter] Preparing session for game=${payload.game_id}, model=${payload.model}`,
      'arc3-openrouter'
    );

    const sessionId = arc3OpenRouterStreamService.savePayload(payload);
    res.json(formatResponse.success({ sessionId }));
  })
);

/**
 * GET /stream/:sessionId
 * Start SSE streaming for a prepared session.
 */
router.get(
  '/stream/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    const payload = arc3OpenRouterStreamService.getPayload(sessionId);
    if (!payload) {
      return res.status(404).json(
        formatResponse.error('SESSION_NOT_FOUND', `Session ${sessionId} not found or expired`)
      );
    }

    logger.info(
      `[Arc3OpenRouter] Starting streaming for session=${sessionId}`,
      'arc3-openrouter'
    );

    // Register SSE connection
    sseStreamManager.register(sessionId, res);

    // Start streaming (non-blocking, events flow via SSE)
    await arc3OpenRouterStreamService.startStreaming(req, { ...payload, sessionId });
  })
);

/**
 * POST /stream/cancel/:sessionId
 * Cancel an active streaming session.
 */
router.post(
  '/stream/cancel/:sessionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    logger.info(
      `[Arc3OpenRouter] Cancelling session=${sessionId}`,
      'arc3-openrouter'
    );

    arc3OpenRouterStreamService.cancel(sessionId);
    res.json(formatResponse.success({ cancelled: true, sessionId }));
  })
);

/**
 * GET /health
 * Health check endpoint for OpenRouter provider.
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY);
    const hasArc3Key = Boolean(process.env.ARC3_API_KEY);

    res.json(formatResponse.success({
      status: 'healthy',
      provider: 'openrouter',
      model: 'xiaomi/mimo-v2-flash:free',
      hasOpenRouterKey,
      hasArc3Key,
      timestamp: Date.now(),
    }));
  })
);

export default router;
