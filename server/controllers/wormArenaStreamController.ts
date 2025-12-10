/**
 * Author: Cascade
 * Date: 2025-12-09
 * PURPOSE: Lightweight SSE controller for Worm Arena matches.
 *          Prepares a session, then streams status + final summary.
 * SRP/DRY check: Pass — self-contained pending store + SSE wiring.
 */

import type { Request, Response } from 'express';
import crypto from 'crypto';
import { sseStreamManager } from '../services/streaming/SSEStreamManager';
import { snakeBenchService } from '../services/snakeBenchService';
import type { SnakeBenchRunMatchRequest, WormArenaFinalSummary, WormArenaStreamStatus } from '../../shared/types';
import { logger } from '../utils/logger';

type PendingSession = {
  payload: SnakeBenchRunMatchRequest;
  createdAt: number;
  expiresAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000; // 5 minutes
const pendingSessions: Map<string, PendingSession> = new Map();

function generateSessionId(): string {
  return crypto.randomUUID();
}

function validatePayload(body: any): { payload?: SnakeBenchRunMatchRequest; error?: string } {
  const { modelA, modelB } = body || {};
  if (!modelA || !modelB || typeof modelA !== 'string' || typeof modelB !== 'string') {
    return { error: 'modelA and modelB are required strings.' };
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
  return { payload: req };
}

export const wormArenaStreamController = {
  async prepare(req: Request, res: Response) {
    const { payload, error } = validatePayload(req.body);
    if (error || !payload) {
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
    sseStreamManager.sendEvent(sessionId, 'stream.init', {
      sessionId,
      createdAt: new Date(connection.createdAt).toISOString(),
      payload: { modelA: pending.payload.modelA, modelB: pending.payload.modelB },
    });

    const sendStatus = (status: WormArenaStreamStatus) => {
      sseStreamManager.sendEvent(sessionId, 'stream.status', status);
    };

    sendStatus({ state: 'starting', message: 'Launching match...' });

    try {
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
      // Close with summary as generic record to satisfy typing
      sseStreamManager.close(sessionId, summary as unknown as Record<string, unknown>);
    } catch (err: any) {
      const message = err?.message || 'Match failed';
      logger.error(`[WormArenaStream] Run failed: ${message}`, 'worm-arena-stream');
      sseStreamManager.error(sessionId, 'MATCH_FAILED', message);
    } finally {
      pendingSessions.delete(sessionId);
    }
  },
};
