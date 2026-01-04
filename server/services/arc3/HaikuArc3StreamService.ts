/**
 * Author: Claude Sonnet 4
 * Date: 2026-01-03
 * PURPOSE: Session management and SSE emission for Haiku 4.5 ARC3 agent.
 *          Prepares sessions, spawns Python agent, parses NDJSON events, forwards to SSE.
 *          Pattern: Arc3OpenRouterStreamService.ts
 * SRP/DRY check: Pass — session orchestration only, delegates to bridge and SSE manager.
 */

import { nanoid } from 'nanoid';
import type { Request } from 'express';
import { sseStreamManager } from '../streaming/SSEStreamManager.ts';
import { logger } from '../../utils/logger.ts';
import { resolveStreamingConfig } from '@shared/config/streaming.ts';
import {
  arc3HaikuPythonBridge,
  type Arc3HaikuPayload,
} from './Arc3HaikuPythonBridge.ts';

export interface HaikuStreamPayload {
  game_id: string;
  model?: string;                // Default: claude-3-5-haiku-20241022
  max_turns?: number;
  anthropic_api_key?: string;    // Anthropic API key (BYOK)
  arc3_api_key?: string;         // ARC3 API key (optional BYOK)
  sessionId?: string;
  createdAt?: number;
  expiresAt?: number;
  agent_name?: string;           // User-defined agent name for scorecard
  system_prompt?: string;        // Optional custom system prompt
}

const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class HaikuArc3StreamService {
  private readonly pending = new Map<string, HaikuStreamPayload>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Save a pending session payload and return sessionId.
   */
  savePayload(payload: HaikuStreamPayload, ttlMs: number = SESSION_TTL_MS): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const enriched: HaikuStreamPayload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.pending.set(sessionId, enriched);
    this.scheduleExpiration(sessionId, ttlMs);
    logger.debug(`[Arc3Haiku] Session ${sessionId} saved`, 'arc3-haiku');
    return sessionId;
  }

  /**
   * Get a pending session payload.
   */
  getPayload(sessionId: string): HaikuStreamPayload | undefined {
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
    logger.debug(`[Arc3Haiku] Session ${sessionId} cleared`, 'arc3-haiku');
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
      logger.debug(`[Arc3Haiku] Session ${sessionId} expired`, 'arc3-haiku');
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
  async startStreaming(_req: Request, payload: HaikuStreamPayload): Promise<void> {
    const sessionId = payload.sessionId!;

    if (!sseStreamManager.has(sessionId)) {
      throw new Error('SSE session must be registered before starting streaming.');
    }

    const streamingConfig = resolveStreamingConfig();
    if (!streamingConfig.enabled) {
      sseStreamManager.error(sessionId, 'STREAMING_DISABLED', 'Streaming disabled on server.');
      return;
    }

    const {
      game_id, model, max_turns,
      anthropic_api_key, arc3_api_key, agent_name, system_prompt
    } = payload;

    // Send initial status
    sseStreamManager.sendEvent(sessionId, 'stream.init', {
      state: 'starting',
      game_id,
      model: model || 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      agentName: agent_name || 'Haiku 4.5 Agent',
    });

    sseStreamManager.sendEvent(sessionId, 'stream.status', {
      state: 'running',
      message: 'Spawning Haiku 4.5 agent (vision-first mode)...',
      game_id,
    });

    // Build payload for Python runner
    const pythonPayload: Arc3HaikuPayload = {
      game_id,
      model: model || 'claude-3-5-haiku-20241022',
      max_turns: max_turns ?? 80,
      anthropic_api_key: anthropic_api_key,
      arc3_api_key: arc3_api_key || process.env.ARC3_API_KEY,
      agent_name: agent_name || 'Haiku 4.5 Agent',
      system_prompt,
    };

    try {
      // Spawn Python agent and parse NDJSON events
      const { code } = await arc3HaikuPythonBridge.spawnAgent(
        pythonPayload,
        { timeoutMs: 10 * 60 * 1000 },  // 10 minute timeout
        (line: string) => {
          // Parse NDJSON line and forward to SSE
          this.handleStdoutLine(sessionId, line, game_id);
        },
        (line: string) => {
          // Log stderr
          logger.warn(`[Arc3Haiku] stderr: ${line}`, 'arc3-haiku');
        }
      );

      if (code !== 0) {
        logger.error(
          `[Arc3Haiku] Python runner exited with code ${code}`,
          'arc3-haiku'
        );
        sseStreamManager.error(sessionId, 'RUNNER_ERROR', `Agent exited with code ${code}`);
      }

      // Extend TTL for post-run reads
      this.scheduleExpiration(sessionId, 5 * 60 * 1000);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[Arc3Haiku] Streaming failed: ${message}`, 'arc3-haiku');
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
        `[Arc3Haiku] Failed to parse NDJSON: ${line.slice(0, 100)}`,
        'arc3-haiku'
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
    logger.info(`[Arc3Haiku] Session ${sessionId} cancelled`, 'arc3-haiku');
  }
}

export const haikuArc3StreamService = new HaikuArc3StreamService();
