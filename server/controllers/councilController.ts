/**
 * Author: Claude Sonnet 4 (Cascade)
 * Date: 2026-01-02
 * PURPOSE: Controller for LLM Council endpoints. Exposes API for multi-model consensus
 *          evaluation of ARC puzzles.
 *          DEPLOYMENT: Endpoints gracefully return 503 if council service unavailable.
 *          Set COUNCIL_BASE_URL env var to point to deployed council service.
 * SRP/DRY check: Pass - Single responsibility: HTTP request handling for council routes.
 */

import type { Request, Response } from 'express';
import { councilService } from '../services/council/councilService.ts';
import { councilBridge } from '../services/council/councilBridge.ts';
import { formatResponse } from '../utils/responseFormatter.ts';
import { logger } from '../utils/logger.ts';

/**
 * Health check for the LLM Council service
 * GET /api/council/health
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    const isHealthy = await councilBridge.healthCheck();
    
    if (isHealthy) {
      res.json(formatResponse.success({
        status: 'healthy',
        service: 'llm-council',
        baseUrl: process.env.COUNCIL_BASE_URL || 'http://localhost:8001',
      }));
    } else {
      res.status(503).json(formatResponse.error(
        'COUNCIL_UNAVAILABLE',
        'LLM Council service is not available. Ensure it is running on port 8001.'
      ));
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Health check failed';
    logger.error('[CouncilController] Health check error:', errMsg);
    res.status(500).json(formatResponse.error(
      'HEALTH_CHECK_FAILED',
      errMsg
    ));
  }
}

/**
 * Get list of unsolved puzzles recommended for council assessment
 * GET /api/council/unsolved-puzzles
 */
export async function getUnsolvedPuzzles(req: Request, res: Response): Promise<void> {
  try {
    const puzzles = await councilService.getUnsolvedPuzzles();
    res.json(formatResponse.success({
      puzzles,
      count: puzzles.length,
      description: 'ARC2 Evaluation puzzles that remain unsolved - primary focus for council assessment',
    }));
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch unsolved puzzles';
    logger.error('[CouncilController] Failed to get unsolved puzzles:', errMsg);
    res.status(500).json(formatResponse.error(
      'FETCH_FAILED',
      errMsg
    ));
  }
}

/**
 * Get explanations for a puzzle that can be assessed
 * GET /api/council/puzzle/:taskId/explanations
 */
export async function getExplanationsForAssessment(req: Request, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!taskId) {
      res.status(400).json(formatResponse.error('MISSING_TASK_ID', 'Task ID is required'));
      return;
    }
    
    const explanations = await councilService.getExplanationsForAssessment(taskId, limit);
    
    res.json(formatResponse.success({
      taskId,
      explanations,
      count: explanations.length,
    }));
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch explanations';
    logger.error('[CouncilController] Failed to get explanations:', errMsg);
    res.status(500).json(formatResponse.error(
      'FETCH_FAILED',
      errMsg
    ));
  }
}

/**
 * Assess a puzzle using the LLM Council
 * POST /api/council/assess
 * Body: { taskId: string, mode: 'solve' | 'assess', explanationIds?: number[] }
 */
export async function assessPuzzle(req: Request, res: Response): Promise<void> {
  try {
    const { taskId, mode, explanationIds } = req.body;
    
    if (!taskId) {
      res.status(400).json(formatResponse.error('MISSING_TASK_ID', 'Task ID is required'));
      return;
    }
    
    if (!mode || !['solve', 'assess'].includes(mode)) {
      res.status(400).json(formatResponse.error(
        'INVALID_MODE',
        'Mode must be "solve" or "assess"'
      ));
      return;
    }
    
    if (mode === 'assess' && (!explanationIds || !Array.isArray(explanationIds) || explanationIds.length === 0)) {
      res.status(400).json(formatResponse.error(
        'MISSING_EXPLANATIONS',
        'Assessment mode requires explanationIds array'
      ));
      return;
    }
    
    logger.info(`[CouncilController] Starting ${mode} assessment for puzzle ${taskId}`);
    
    const result = await councilService.assessPuzzle({
      taskId,
      mode,
      explanationIds,
    });
    
    res.json(formatResponse.success(result));
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Assessment failed';
    logger.error('[CouncilController] Assessment failed:', errMsg);
    
    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('not available')) {
        res.status(503).json(formatResponse.error('COUNCIL_UNAVAILABLE', error.message));
        return;
      }
      if (error.message.includes('not found')) {
        res.status(404).json(formatResponse.error('NOT_FOUND', error.message));
        return;
      }
      if (error.message.includes('timed out')) {
        res.status(504).json(formatResponse.error('TIMEOUT', error.message));
        return;
      }
    }
    
    res.status(500).json(formatResponse.error(
      'ASSESSMENT_FAILED',
      errMsg
    ));
  }
}

/**
 * Stream assessment from the LLM Council (SSE endpoint)
 * POST /api/council/assess/stream
 * Body: { taskId: string, mode: 'solve' | 'assess', explanationIds?: number[] }
 */
export async function streamAssessment(req: Request, res: Response): Promise<void> {
  const { taskId, mode, explanationIds } = req.body;
  
  if (!taskId || !mode) {
    res.status(400).json(formatResponse.error('INVALID_REQUEST', 'taskId and mode are required'));
    return;
  }
  
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  
  try {
    // Check health first
    const isHealthy = await councilBridge.healthCheck();
    if (!isHealthy) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Council service unavailable' })}\n\n`);
      res.end();
      return;
    }
    
    // Create conversation
    const conversation = await councilBridge.createConversation();
    res.write(`data: ${JSON.stringify({ type: 'conversation_created', data: { id: conversation.id } })}\n\n`);
    
    // Build prompt (simplified - full implementation would use councilService)
    const prompt = `Assess ARC puzzle ${taskId} in ${mode} mode.`;
    
    // Stream the response
    for await (const event of councilBridge.streamMessage(conversation.id, prompt)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Stream failed';
    logger.error('[CouncilController] Stream assessment failed:', errMsg);
    res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
    res.end();
  }
}

export const councilController = {
  healthCheck,
  getUnsolvedPuzzles,
  getExplanationsForAssessment,
  assessPuzzle,
  streamAssessment,
};
