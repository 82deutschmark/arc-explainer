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
  opponents?: string[]; // Array of opponent model IDs for multi-opponent batch; undefined for single match
  createdAt: number;
  expiresAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BATCH_COUNT = 10; // Safety limit for batch runs
const pendingSessions: Map<string, PendingSession> = new Map();

function generateSessionId(): string {
  return crypto.randomUUID();
}

function validatePayload(body: any): { payload?: SnakeBenchRunMatchRequest; opponents?: string[]; error?: string } {
  const { modelA, opponents: opponentsRaw, count: countRaw } = body || {};
  if (!modelA || typeof modelA !== 'string') {
    return { error: 'modelA is required string.' };
  }

  // Determine opponents: either from explicit array or legacy count parameter
  let opponents: string[] | undefined;

  if (opponentsRaw && Array.isArray(opponentsRaw)) {
    // New format: explicit opponent list
    opponents = opponentsRaw
      .filter((op) => typeof op === 'string' && op.trim().length > 0)
      .map((op) => op.trim());

    if (opponents.length === 0) {
      return { error: 'opponents array must contain at least one model' };
    }
    if (opponents.length > MAX_BATCH_COUNT) {
      return { error: `opponents array cannot exceed ${MAX_BATCH_COUNT} models` };
    }
  } else if (countRaw !== undefined) {
    // Legacy format: count parameter (for backward compatibility)
    // In legacy mode with count, modelB is required
    const { modelB } = body || {};
    if (!modelB || typeof modelB !== 'string') {
      return { error: 'Legacy count mode requires modelB' };
    }

    const count = Math.floor(Number(countRaw));
    if (!Number.isFinite(count) || count < 1 || count > MAX_BATCH_COUNT) {
      return { error: `count must be between 1 and ${MAX_BATCH_COUNT}` };
    }

    // Convert legacy count to repeated opponents array
    if (count > 1) {
      opponents = Array(count).fill(modelB);
    }
    // If count === 1, leave opponents undefined for single match
  } else {
    return { error: 'Either "opponents" array or "count" number must be provided' };
  }

  const req: SnakeBenchRunMatchRequest = {
    modelA: String(modelA),
    // Note: modelB will be set per-opponent in stream() method, not here
    modelB: '', // Placeholder; will be overridden for batch mode
  };
  if (body.width !== undefined) req.width = Number(body.width);
  if (body.height !== undefined) req.height = Number(body.height);
  if (body.maxRounds !== undefined) req.maxRounds = Number(body.maxRounds);
  if (body.numApples !== undefined) req.numApples = Number(body.numApples);
  if (body.apiKey && typeof body.apiKey === 'string') req.apiKey = body.apiKey;
  if (body.provider && typeof body.provider === 'string') {
    req.provider = body.provider as SnakeBenchRunMatchRequest['provider'];
  }
  return { payload: req, opponents };
}

export const wormArenaStreamController = {
  async prepare(req: Request, res: Response) {
    const { payload, opponents, error } = validatePayload(req.body);
    if (error || !payload) {
      res.status(422).json({ success: false, error: error ?? 'Invalid payload' });
      return;
    }

    const sessionId = generateSessionId();
    const now = Date.now();
    pendingSessions.set(sessionId, {
      payload,
      opponents,
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
    const isBatch = pending.opponents && pending.opponents.length > 0;

    if (isBatch) {
      // Batch initialization with opponent list
      sseStreamManager.sendEvent(sessionId, 'batch.init', {
        totalMatches: pending.opponents!.length,
        modelA: pending.payload.modelA,
        opponents: pending.opponents,
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
        // Execute batch of matches with different opponents
        const opponents = pending.opponents!;
        const results: WormArenaBatchMatchComplete[] = [];
        let failedCount = 0;

        for (let i = 0; i < opponents.length; i += 1) {
          const matchNum = i + 1; // 1-based for user display
          const currentOpponent = opponents[i];

          // Create match payload with current opponent
          const matchPayload: SnakeBenchRunMatchRequest = {
            ...pending.payload,
            modelB: currentOpponent,
          };

          // Emit match start with specific opponent
          const matchStartEvent: WormArenaBatchMatchStart = {
            index: matchNum,
            total: opponents.length,
            modelA: pending.payload.modelA,
            modelB: currentOpponent,
          };
          sseStreamManager.sendEvent(sessionId, 'batch.match.start', matchStartEvent);
          sendStatus({
            state: 'in_progress',
            message: `Running match ${matchNum} of ${opponents.length}: ${pending.payload.modelA} vs ${currentOpponent}...`,
          });

          try {
            // Run the match with current opponent
            const result = await snakeBenchService.runMatch(matchPayload);

            // Emit match complete
            const matchCompleteEvent: WormArenaBatchMatchComplete = {
              index: matchNum,
              total: opponents.length,
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
            logger.error(`[WormArenaStream] Multi-opponent match ${matchNum} (${currentOpponent}) failed: ${message}`, 'worm-arena-stream');
            sseStreamManager.sendEvent(sessionId, 'batch.error', {
              index: matchNum,
              total: opponents.length,
              error: message,
            });
            // Continue with next opponent despite error
          }
        }

        // Emit batch complete
        const batchCompleteEvent: WormArenaBatchComplete = {
          totalMatches: opponents.length,
          completedMatches: results.length,
          failedMatches: failedCount,
        };
        sendStatus({
          state: 'completed',
          message: `Batch complete: ${results.length}/${opponents.length} matches finished`,
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
