/**
 * Author: Cascade
 * Date: 2026-01-02
 * PURPOSE: Session management and SSE emission for OpenRouter ARC3 agent.
 *          Prepares sessions, spawns Python agent, parses NDJSON events, forwards to SSE.
 *          Pattern: Arc3StreamService.ts + SnakeBenchStreamingRunner.ts
 * SRP/DRY check: Pass — session orchestration only, delegates to bridge and SSE manager.
 */

import { nanoid } from 'nanoid';
import type { Request } from 'express';
import { sseStreamManager } from '../streaming/SSEStreamManager.ts';
import { logger } from '../../utils/logger.ts';
import { resolveStreamingConfig } from '@shared/config/streaming.ts';
import {
  arc3OpenRouterPythonBridge,
  type Arc3OpenRouterPayload,
} from './Arc3OpenRouterPythonBridge.ts';

export interface OpenRouterStreamPayload {
  game_id: string;
  model: string;
  instructions?: string;
  systemPrompt?: string;
  maxTurns?: number;
  apiKey?: string;        // OpenRouter BYOK
  arc3ApiKey?: string;    // ARC3 API key (optional BYOK)
  sessionId?: string;
  createdAt?: number;
  expiresAt?: number;
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class Arc3OpenRouterStreamService {
  private readonly pending = new Map<string, OpenRouterStreamPayload>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Save a pending session payload and return sessionId.
   */
  savePayload(payload: OpenRouterStreamPayload, ttlMs: number = SESSION_TTL_MS): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const enriched: OpenRouterStreamPayload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.pending.set(sessionId, enriched);
    this.scheduleExpiration(sessionId, ttlMs);
    logger.debug(`[Arc3OpenRouter] Session ${sessionId} saved`, 'arc3-openrouter');
    return sessionId;
  }

  /**
   * Get a pending session payload.
   */
  getPayload(sessionId: string): OpenRouterStreamPayload | undefined {
    return this.pending.get(sessionId);
  }

  /**
   * Clear a session and its expiration timer.
   */
  clear(sessionId: string): void {
    this.pending.delete(sessionId);
    const timer = this.timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(sessionId);
    }
    logger.debug(`[Arc3OpenRouter] Session ${sessionId} cleared`, 'arc3-openrouter');
  }

  /**
   * Schedule session expiration.
   */
  private scheduleExpiration(sessionId: string, ttlMs: number): void {
    const existing = this.timers.get(sessionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.pending.delete(sessionId);
      this.timers.delete(sessionId);
      logger.debug(`[Arc3OpenRouter] Session ${sessionId} expired`, 'arc3-openrouter');
    }, ttlMs);

    if (typeof (timer as any).unref === 'function') {
      (timer as any).unref();
    }
    this.timers.set(sessionId, timer);
  }

  /**
   * Start streaming for a prepared session.
   * Spawns Python agent, parses NDJSON events, forwards to SSE.
   */
  async startStreaming(_req: Request, payload: OpenRouterStreamPayload): Promise<void> {
    const sessionId = payload.sessionId!;

    if (!sseStreamManager.has(sessionId)) {
      throw new Error('SSE session must be registered before starting streaming.');
    }

    const streamingConfig = resolveStreamingConfig();
    if (!streamingConfig.enabled) {
      sseStreamManager.error(sessionId, 'STREAMING_DISABLED', 'Streaming disabled on server.');
      return;
    }

    const { game_id, model, instructions, maxTurns, apiKey, arc3ApiKey } = payload;

    // Send initial status
    sseStreamManager.sendEvent(sessionId, 'stream.init', {
      state: 'starting',
      game_id,
      model,
      provider: 'openrouter',
    });

    sseStreamManager.sendEvent(sessionId, 'stream.status', {
      state: 'running',
      message: 'Spawning OpenRouter agent...',
      game_id,
    });

    // Build payload for Python runner
    const pythonPayload: Arc3OpenRouterPayload = {
      game_id,
      model,
      instructions,
      max_turns: maxTurns ?? 50,
      api_key: apiKey,
      arc3_api_key: arc3ApiKey || process.env.ARC3_API_KEY,
    };

    try {
      // Spawn Python agent and parse NDJSON events
      const { code } = await arc3OpenRouterPythonBridge.spawnAgent(
        pythonPayload,
        { timeoutMs: 10 * 60 * 1000 },  // 10 minute timeout
        (line: string) => {
          // Parse NDJSON line and forward to SSE
          this.handleStdoutLine(sessionId, line, game_id);
        },
        (line: string) => {
          // Log stderr
          logger.warn(`[Arc3OpenRouter] stderr: ${line}`, 'arc3-openrouter');
        }
      );

      if (code !== 0) {
        logger.error(
          `[Arc3OpenRouter] Python runner exited with code ${code}`,
          'arc3-openrouter'
        );
        sseStreamManager.error(sessionId, 'RUNNER_ERROR', `Agent exited with code ${code}`);
      }

      // Extend TTL for post-run reads
      this.scheduleExpiration(sessionId, 5 * 60 * 1000);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Arc3OpenRouter] Streaming failed: ${message}`, 'arc3-openrouter');
      sseStreamManager.error(sessionId, 'STREAMING_ERROR', message);
      this.clear(sessionId);
    }
  }

  /**
   * Parse NDJSON line from Python and forward as SSE event.
   */
  private handleStdoutLine(sessionId: string, line: string, game_id: string): void {
    if (!line.startsWith('{') || !line.endsWith('}')) {
      // Not JSON - emit as status message
      sseStreamManager.sendEvent(sessionId, 'stream.status', {
        state: 'running',
        message: line,
        game_id,
      });
      return;
    }

    try {
      const event = JSON.parse(line);
      const eventType = event.type || 'stream.chunk';

      // Enrich event with game_id if not present
      const enrichedEvent = {
        ...event,
        game_id: event.game_id || game_id,
      };
      delete enrichedEvent.type;  // Don't duplicate type in payload

      // Forward to SSE
      sseStreamManager.sendEvent(sessionId, eventType, enrichedEvent);

      // Handle completion
      if (eventType === 'agent.completed') {
        sseStreamManager.close(sessionId, enrichedEvent);
      }

      // Handle errors
      if (eventType === 'stream.error') {
        sseStreamManager.error(
          sessionId,
          enrichedEvent.code || 'RUNNER_ERROR',
          enrichedEvent.message || 'Unknown error'
        );
      }

    } catch (parseError) {
      // JSON parse failed - emit as status
      logger.warn(
        `[Arc3OpenRouter] Failed to parse NDJSON: ${line.slice(0, 100)}`,
        'arc3-openrouter'
      );
      sseStreamManager.sendEvent(sessionId, 'stream.status', {
        state: 'running',
        message: line,
        game_id,
      });
    }
  }

  /**
   * Cancel an active streaming session.
   */
  cancel(sessionId: string): void {
    if (sseStreamManager.has(sessionId)) {
      sseStreamManager.teardown(sessionId, 'cancelled');
    }
    this.clear(sessionId);
    logger.info(`[Arc3OpenRouter] Session ${sessionId} cancelled`, 'arc3-openrouter');
  }
}

export const arc3OpenRouterStreamService = new Arc3OpenRouterStreamService();
