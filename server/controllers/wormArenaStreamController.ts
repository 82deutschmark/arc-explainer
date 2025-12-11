/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-10
 * PURPOSE: SSE controller for Worm Arena matches (single and batch).
 *          Prepares a session, then streams status + results for each match.
 *          Supports batch runs with sequential match execution.
 * SRP/DRY check: Pass — orchestrates batch logic via runMatch loop,
 *                delegates match execution to service layer.
 */

import type { Request, Response } from 'express';
import crypto from 'crypto';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { snakeBenchService } from '../services/snakeBenchService';
import type {
  SnakeBenchRunMatchRequest,
  WormArenaFinalSummary,
  WormArenaStreamStatus,
  WormArenaBatchMatchStart,
  WormArenaBatchMatchComplete,
  WormArenaBatchComplete,
} from '../../shared/types';
import { logger } from '../utils/logger';

type PendingSession = {
  payload: SnakeBenchRunMatchRequest;
  count: number; // 1 for single match, > 1 for batch
  createdAt: number;
  expiresAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BATCH_COUNT = 10; // Safety limit for batch runs
const pendingSessions: Map<string, PendingSession> = new Map();

function generateSessionId(): string {
  return crypto.randomUUID();
}

function validatePayload(body: any): { payload?: SnakeBenchRunMatchRequest; count?: number; error?: string } {
  const { modelA, modelB, count: countRaw } = body || {};
  if (!modelA || !modelB || typeof modelA !== 'string' || typeof modelB !== 'string') {
    return { error: 'modelA and modelB are required strings.' };
  }

  // Parse and validate count (default 1 for single match)
  const count = countRaw !== undefined ? Math.floor(Number(countRaw)) : 1;
  if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH_COUNT) {
    return { error: `count must be between 1 and ${MAX_BATCH_COUNT}` };
  }

  const req: SnakeBenchRunMatchRequest = {
    modelA: String(modelA),
    modelB: String(modelB),
  };
  if (body.width !== undefined) req.width = Number(body.width);
  if (body.height !== undefined) req.height = Number(body.height);
  if (body.maxRounds !== undefined) req.maxRounds = Number(body.maxRounds);
  if (body.numApples !== undefined) req.numApples = Number(body.numApples);
  if (body.apiKey && typeof body.apiKey === 'string') req.apiKey = body.apiKey;
  if (body.provider && typeof body.provider === 'string') {
    req.provider = body.provider as SnakeBenchRunMatchRequest['provider'];
  }
  return { payload: req, count };
}

export const wormArenaStreamController = {
  async prepare(req: Request, res: Response) {
    const { payload, count, error } = validatePayload(req.body);
    if (error || !payload) {
      res.status(422).json({ success: false, error: error ?? 'Invalid payload' });
      return;
    }

    const sessionId = generateSessionId();
    const now = Date.now();
    pendingSessions.set(sessionId, {
      payload,
      count: count ?? 1,
      createdAt: now,
      expiresAt: now + PENDING_TTL_MS,
    });

    res.json({
      success: true,
      sessionId,
      expiresAt: new Date(now + PENDING_TTL_MS).toISOString(),
    });
  },

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
    const isBatch = pending.count > 1;

    if (isBatch) {
      // Batch initialization
      sseStreamManager.sendEvent(sessionId, 'batch.init', {
        totalMatches: pending.count,
        modelA: pending.payload.modelA,
        modelB: pending.payload.modelB,
      });
    } else {
      // Single match initialization (for backward compatibility)
      sseStreamManager.sendEvent(sessionId, 'stream.init', {
        sessionId,
        createdAt: new Date(connection.createdAt).toISOString(),
        payload: { modelA: pending.payload.modelA, modelB: pending.payload.modelB },
      });
    }

    const sendStatus = (status: WormArenaStreamStatus) => {
      sseStreamManager.sendEvent(sessionId, 'stream.status', status);
    };

    try {
      if (isBatch) {
        // Execute batch of matches
        const results: WormArenaBatchMatchComplete[] = [];
        let failedCount = 0;

        for (let i = 0; i < pending.count; i += 1) {
          const matchNum = i + 1; // 1-based for user display

          // Emit match start
          const matchStartEvent: WormArenaBatchMatchStart = {
            index: matchNum,
            total: pending.count,
            modelA: pending.payload.modelA,
            modelB: pending.payload.modelB,
          };
          sseStreamManager.sendEvent(sessionId, 'batch.match.start', matchStartEvent);
          sendStatus({
            state: 'in_progress',
            message: `Running match ${matchNum} of ${pending.count}...`,
          });

          try {
            // Run the match
            const result = await snakeBenchService.runMatch(pending.payload);

            // Emit match complete
            const matchCompleteEvent: WormArenaBatchMatchComplete = {
              index: matchNum,
              total: pending.count,
              gameId: result.gameId,
              modelA: result.modelA,
              modelB: result.modelB,
              scores: result.scores ?? {},
              results: result.results ?? {},
            };
            sseStreamManager.sendEvent(sessionId, 'batch.match.complete', matchCompleteEvent);
            results.push(matchCompleteEvent);
          } catch (err: any) {
            failedCount += 1;
            const message = err?.message || `Match ${matchNum} failed`;
            logger.error(`[WormArenaStream] Batch match ${matchNum} failed: ${message}`, 'worm-arena-stream');
            sseStreamManager.sendEvent(sessionId, 'batch.error', {
              index: matchNum,
              total: pending.count,
              error: message,
            });
          }
        }

        // Emit batch complete
        const batchCompleteEvent: WormArenaBatchComplete = {
          totalMatches: pending.count,
          completedMatches: results.length,
          failedMatches: failedCount,
        };
        sendStatus({
          state: 'completed',
          message: `Batch complete: ${results.length}/${pending.count} matches finished`,
        });
        sseStreamManager.sendEvent(sessionId, 'batch.complete', batchCompleteEvent);
        sseStreamManager.close(sessionId, batchCompleteEvent as unknown as Record<string, unknown>);
      } else {
        // Single match (legacy flow)
        sendStatus({ state: 'starting', message: 'Launching match...' });
        const result = await snakeBenchService.runMatch(pending.payload);
        const summary: WormArenaFinalSummary = {
          gameId: result.gameId,
          modelA: result.modelA,
          modelB: result.modelB,
          scores: result.scores ?? {},
          results: result.results ?? {},
        };
        sendStatus({ state: 'completed', message: 'Match finished.' });
        sseStreamManager.sendEvent(sessionId, 'stream.complete', summary);
        sseStreamManager.close(sessionId, summary as unknown as Record<string, unknown>);
      }
    } catch (err: any) {
      const message = err?.message || 'Match failed';
      logger.error(`[WormArenaStream] Run failed: ${message}`, 'worm-arena-stream');
      sseStreamManager.error(sessionId, 'MATCH_FAILED', message);
    } finally {
      pendingSessions.delete(sessionId);
    }
  },
};
