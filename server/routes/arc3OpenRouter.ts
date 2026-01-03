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

// Validation schema for stream prepare request (competition-emulation mode)
const prepareSchema = z.object({
  game_id: z.string().min(1, 'game_id is required'),
  model: z.string().default('xiaomi/mimo-v2-flash:free'),
  instructions: z.string().optional(),           // User prompt / operator guidance
  systemPrompt: z.string().optional(),           // User's genius system prompt
  maxTurns: z.number().int().min(1).max(500).optional().default(80),  // Match ARC-AGI-3-Agents2 MAX_ACTIONS
  apiKey: z.string().optional(),                 // OpenRouter BYOK
  arc3ApiKey: z.string().optional(),             // ARC3 API key BYOK
  agentName: z.string().optional(),              // User-defined agent name for scorecard
  reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high', 'xhigh']).optional().default('low'),  // OpenRouter reasoning.effort per docs
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

/**
 * POST /credits
 * Fetch OpenRouter credits for the provided API key.
 * BYOK: User must provide their API key - we never store it.
 * 
 * OpenRouter API: GET https://openrouter.ai/api/v1/auth/key
 * Returns: { data: { label, usage, limit, is_free_tier, rate_limit } }
 */
router.post(
  '/credits',
  asyncHandler(async (req: Request, res: Response) => {
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json(
        formatResponse.error('API_KEY_REQUIRED', 'OpenRouter API key is required to fetch credits')
      );
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`[Arc3OpenRouter] Credits fetch failed: ${response.status} ${errorText}`, 'arc3-openrouter');
        return res.status(response.status).json(
          formatResponse.error('OPENROUTER_ERROR', `OpenRouter API error: ${response.status}`)
        );
      }
      
      const data = await response.json();
      
      // OpenRouter returns: { data: { label, usage, limit, is_free_tier, rate_limit } }
      // usage and limit are in USD cents (or null for unlimited)
      const keyData = data.data || data;
      
      // Calculate remaining credits
      const usage = keyData.usage ?? 0;  // Amount used in USD
      const limit = keyData.limit;        // Credit limit (null = unlimited)
      const remaining = limit !== null && limit !== undefined ? limit - usage : null;
      
      res.json(formatResponse.success({
        label: keyData.label || 'API Key',
        usage: usage,
        limit: limit,
        remaining: remaining,
        isFreeTier: keyData.is_free_tier ?? false,
        rateLimit: keyData.rate_limit || null,
        timestamp: Date.now(),
      }));
      
    } catch (error) {
      logger.error(`[Arc3OpenRouter] Credits fetch error: ${error}`, 'arc3-openrouter');
      return res.status(500).json(
        formatResponse.error('FETCH_ERROR', 'Failed to fetch credits from OpenRouter')
      );
    }
  })
);

export default router;
