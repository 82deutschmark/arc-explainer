/**
 * Author: Claude Sonnet 4
 * Date: 2026-01-03
 * PURPOSE: Express routes for Haiku 4.5 ARC3 agent streaming.
 *          Endpoints: /stream/prepare, /stream/:sessionId, /stream/cancel/:sessionId, /health
 *          Pattern: arc3OpenRouter.ts routes
 * SRP/DRY check: Pass — HTTP route handling only, delegates to stream service.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { sseStreamManager } from '../services/streaming/SSEStreamManager.ts';
import { haikuArc3StreamService } from '../services/arc3/HaikuArc3StreamService.ts';
import { logger } from '../utils/logger.ts';

const router = Router();

// Validation schema for stream prepare request
const prepareSchema = z.object({
  game_id: z.string().min(1, 'game_id is required'),
  model: z.string().default('claude-3-5-haiku-20241022'),
  max_turns: z.number().int().min(1).max(500).optional().default(80),
  anthropic_api_key: z.string().optional(),   // Anthropic BYOK
  arc3_api_key: z.string().optional(),        // ARC3 API key BYOK
  agent_name: z.string().optional(),          // User-defined agent name for scorecard
  system_prompt: z.string().optional(),       // Optional custom system prompt
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
      `[Arc3Haiku] Preparing session for game=${payload.game_id}, model=${payload.model}`,
      'arc3-haiku'
    );

    const sessionId = haikuArc3StreamService.savePayload(payload);
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

    const payload = haikuArc3StreamService.getPayload(sessionId);
    if (!payload) {
      return res.status(404).json(
        formatResponse.error('SESSION_NOT_FOUND', `Session ${sessionId} not found or expired`)
      );
    }

    logger.info(
      `[Arc3Haiku] Starting streaming for session=${sessionId}`,
      'arc3-haiku'
    );

    // Register SSE connection
    sseStreamManager.register(sessionId, res);

    // Start streaming (non-blocking, events flow via SSE)
    await haikuArc3StreamService.startStreaming(req, { ...payload, sessionId });
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
      `[Arc3Haiku] Cancelling session=${sessionId}`,
      'arc3-haiku'
    );

    haikuArc3StreamService.cancel(sessionId);
    res.json(formatResponse.success({ cancelled: true, sessionId }));
  })
);

/**
 * GET /health
 * Health check endpoint for Haiku provider.
 */
router.get(
  '/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
    const hasArc3Key = Boolean(process.env.ARC3_API_KEY);

    res.json(formatResponse.success({
      status: 'healthy',
      provider: 'anthropic',
      model: 'claude-3-5-haiku-20241022',
      hasAnthropicKey,
      hasArc3Key,
      timestamp: Date.now(),
    }));
  })
);

export default router;
