/**
 * Author: Cascade
 * Date: 2025-12-19
 * PURPOSE: SSE controller for Worm Arena live matches.
 *          One session = one match. Prepares a session, streams status + frames,
 *          then persists sessionId -> gameId mapping so completed sessions can
 *          redirect to replay pages (durable share links).
 *
 *          Resolve behavior notes:
 *          - resolve() must NOT return "pending" for expired sessions; doing so
 *            causes the client to attempt an SSE connection that will fail.
 * SRP/DRY check: Pass — single-match streaming only, delegates to service layer.
 */

import type { Request, Response } from 'express';
import crypto from 'crypto';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { snakeBenchService } from '../services/snakeBenchService';
import { repositoryService } from '../repositories/RepositoryService.ts';
import type {
  SnakeBenchRunMatchRequest,
  WormArenaFinalSummary,
  WormArenaStreamStatus,
} from '../../shared/types';
import { logger } from '../utils/logger';

type PendingSession = {
  payload: SnakeBenchRunMatchRequest;
  createdAt: number;
  expiresAt: number;
};

// Completed session mapping: sessionId -> gameId (for replay redirect)
type CompletedSession = {
  gameId: string;
  modelA: string;
  modelB: string;
  completedAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes for pending sessions
const COMPLETED_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days for completed session mapping
const pendingSessions: Map<string, PendingSession> = new Map();
const completedSessions: Map<string, CompletedSession> = new Map();

function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Validates payload for single match (no batch mode).
 */
function validatePayload(body: any): { payload?: SnakeBenchRunMatchRequest; error?: string } {
  const { modelA, modelB } = body || {};
  if (!modelA || typeof modelA !== 'string') {
    return { error: 'modelA is required string.' };
  }
  if (!modelB || typeof modelB !== 'string' || modelB.trim().length === 0) {
    return { error: 'modelB is required string.' };
  }

  const req: SnakeBenchRunMatchRequest = {
    modelA: String(modelA).trim(),
    modelB: String(modelB).trim(),
  };
  if (body.width !== undefined) req.width = Number(body.width);
  if (body.height !== undefined) req.height = Number(body.height);
  if (body.maxRounds !== undefined) req.maxRounds = Number(body.maxRounds);
  if (body.numApples !== undefined) req.numApples = Number(body.numApples);
  if (body.apiKey && typeof body.apiKey === 'string') req.apiKey = body.apiKey;
  if (body.provider && typeof body.provider === 'string') {
    req.provider = body.provider as SnakeBenchRunMatchRequest['provider'];
  }
  return { payload: req };
}

/**
 * Periodically clean up expired completed sessions (runs on each resolve call).
 */
function cleanupExpiredCompletedSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of completedSessions.entries()) {
    if (now - session.completedAt > COMPLETED_TTL_MS) {
      completedSessions.delete(sessionId);
    }
  }
}

export const wormArenaStreamController = {
  /**
   * Prepare a new live match session. Returns sessionId for SSE connection.
   */
  async prepare(req: Request, res: Response) {
    logger.info(`[WormArenaStream] PREPARE called with body: ${JSON.stringify(req.body)}`, 'worm-arena-stream');
    const { payload, error } = validatePayload(req.body);
    if (error || !payload) {
      logger.warn(`[WormArenaStream] Validation error: ${error}`, 'worm-arena-stream');
      res.status(422).json({ success: false, error: error ?? 'Invalid payload' });
      return;
    }

    const sessionId = generateSessionId();
    const now = Date.now();
    pendingSessions.set(sessionId, {
      payload,
      createdAt: now,
      expiresAt: now + PENDING_TTL_MS,
    });

    // Persist session to database for durable link resolution
    try {
      await repositoryService.wormArenaSessions.createPendingSession(
        sessionId,
        payload.modelA,
        payload.modelB,
        new Date(now + PENDING_TTL_MS)
      );
    } catch (dbErr) {
      logger.warn(`Failed to persist Worm Arena session ${sessionId}: ${dbErr}`, 'worm-arena-stream');
      // Continue anyway - in-memory will work for this session
    }

    logger.info(`[WormArenaStream] Session created: ${sessionId} for ${payload.modelA} vs ${payload.modelB}`, 'worm-arena-stream');

    res.json({
      success: true,
      sessionId,
      expiresAt: new Date(now + PENDING_TTL_MS).toISOString(),
    });
  },

  /**
   * SSE stream endpoint for live match. Runs one match and streams frames.
   */
  async stream(req: Request, res: Response) {
    const { sessionId } = req.params as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Missing sessionId' });
      return;
    }

    const pending = pendingSessions.get(sessionId);
    if (!pending) {
      res.status(404).json({ success: false, error: 'Session not found or expired' });
      return;
    }
    if (pending.expiresAt < Date.now()) {
      pendingSessions.delete(sessionId);
      res.status(410).json({ success: false, error: 'Session expired' });
      return;
    }

    const connection = sseStreamManager.register(sessionId, res);

    // Single match initialization
    sseStreamManager.sendEvent(sessionId, 'stream.init', {
      matchId: sessionId,
      sessionId,
      createdAt: new Date(connection.createdAt).toISOString(),
      payload: { modelA: pending.payload.modelA, modelB: pending.payload.modelB },
    });

    const sendStatus = (status: WormArenaStreamStatus) => {
      sseStreamManager.sendEvent(sessionId, 'stream.status', status);
    };

    try {
      // Run single match, streaming frames to SSE
      const result = await snakeBenchService.runMatchStreaming(pending.payload, {
        onStatus: sendStatus,
        onFrame: (frame) => {
          sseStreamManager.sendEvent(sessionId, 'stream.frame', frame);
        },
        onChunk: (chunk) => {
          sseStreamManager.sendEvent(sessionId, 'stream.chunk', chunk);
        },
      });

      // Persist sessionId -> gameId mapping for replay resolution
      completedSessions.set(sessionId, {
        gameId: result.gameId,
        modelA: result.modelA,
        modelB: result.modelB,
        completedAt: Date.now(),
      });

      // Also persist to database for durable link resolution
      try {
        await repositoryService.wormArenaSessions.markCompleted(sessionId, result.gameId);
      } catch (dbErr) {
        logger.warn(`Failed to persist completed Worm Arena session ${sessionId}: ${dbErr}`, 'worm-arena-stream');
        // Continue anyway - in-memory will work for this session
      }

      logger.info(`[WormArenaStream] Match completed: sessionId=${sessionId} -> gameId=${result.gameId}`, 'worm-arena-stream');

      const summary: WormArenaFinalSummary = {
        matchId: sessionId,
        gameId: result.gameId,
        modelA: result.modelA,
        modelB: result.modelB,
        scores: result.scores ?? {},
        results: result.results ?? {},
      };
      sendStatus({ state: 'completed', message: 'Match finished.' });
      sseStreamManager.sendEvent(sessionId, 'stream.complete', summary);
      sseStreamManager.close(sessionId);
    } catch (err: any) {
      const message = err?.message || 'Match failed';
      logger.error(`[WormArenaStream] Run failed: ${message}`, 'worm-arena-stream');
      sseStreamManager.error(sessionId, 'MATCH_FAILED', message);
    } finally {
      pendingSessions.delete(sessionId);
    }
  },

  /**
   * Resolve a sessionId to its completed match gameId (for replay redirect).
   * This enables durable share links - visitors to /worm-arena/live/:sessionId
   * after the match ends can be redirected to /worm-arena?matchId=:gameId.
   */
  async resolve(req: Request, res: Response) {
    const { sessionId } = req.params as { sessionId?: string };
    if (!sessionId) {
      res.status(400).json({ success: false, error: 'Missing sessionId' });
      return;
    }

    // Cleanup expired sessions periodically
    cleanupExpiredCompletedSessions();

    // Check if session is still pending (match in progress)
    const pending = pendingSessions.get(sessionId);
    if (pending) {
      // IMPORTANT: Pending sessions can expire even if the entry still exists.
      // If expired, treat as unknown so the client does not attempt SSE.
      if (pending.expiresAt < Date.now()) {
        pendingSessions.delete(sessionId);
        res.json({
          success: true,
          status: 'unknown',
          message: 'Session expired.',
        });
        return;
      }

      res.json({
        success: true,
        status: 'pending',
        message: 'Match is still in progress or waiting to start.',
      });
      return;
    }

    // Check if session completed and we have gameId mapping in memory
    const completed = completedSessions.get(sessionId);
    if (completed) {
      res.json({
        success: true,
        status: 'completed',
        gameId: completed.gameId,
        modelA: completed.modelA,
        modelB: completed.modelB,
        replayUrl: `/worm-arena?matchId=${encodeURIComponent(completed.gameId)}`,
      });
      return;
    }

    // Check database for persistent session resolution (durable links)
    try {
      const dbSession = await repositoryService.wormArenaSessions.getBySessionId(sessionId);
      if (dbSession) {
        if (dbSession.status === 'completed' && dbSession.game_id) {
          res.json({
            success: true,
            status: 'completed',
            gameId: dbSession.game_id,
            modelA: dbSession.model_a,
            modelB: dbSession.model_b,
            replayUrl: `/worm-arena?matchId=${encodeURIComponent(dbSession.game_id)}`,
          });
          return;
        }
        // If DB session exists but is not completed, treat as unknown (expired)
      }
    } catch (dbErr) {
      logger.warn(`Failed to check DB for Worm Arena session ${sessionId}: ${dbErr}`, 'worm-arena-resolve');
      // Continue with unknown response - DB issues shouldn't break the flow
    }

    // Session unknown - either never existed or expired
    res.json({
      success: true,
      status: 'unknown',
      message: 'Session not found. It may have expired or never existed.',
    });
  },
};
