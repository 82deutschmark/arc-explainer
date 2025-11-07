/**
 * Author: Claude (Windsurf Cascade)
 * Date: 2025-11-06
 * PURPOSE: Coordinates streaming ARC3 agent sessions, bridging SSE connections with the real ARC3 API, handling session management,
 * and graceful lifecycle management while honoring the shared STREAMING_ENABLED feature flag.
 * SRP/DRY check: Pass — follows established streaming patterns from analysisStreamService.ts
 */

import { nanoid } from "nanoid";
import type { Request } from "express";
import { sseStreamManager } from "../streaming/SSEStreamManager";
import { logger } from "../../utils/logger";
import { resolveStreamingConfig } from "@shared/config/streaming";
import { Arc3ApiClient } from "./Arc3ApiClient";
import { Arc3RealGameRunner } from "./Arc3RealGameRunner";
import type { Arc3AgentRunConfig } from "./types";

export interface StreamArc3Payload {
  game_id: string;  // Match ARC3 API property naming
  agentName?: string;
  systemPrompt?: string;  // Base system instructions (overrides default)
  instructions: string;   // User/operator guidance
  model?: string;
  maxTurns?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  sessionId?: string;
  createdAt?: number;
  expiresAt?: number;
}

export const PENDING_ARC3_SESSION_TTL_SECONDS = 60;

export class Arc3StreamService {
  private readonly pendingSessions: Map<string, StreamArc3Payload> = new Map();
  private readonly pendingSessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly apiClient: Arc3ApiClient;
  private readonly gameRunner: Arc3RealGameRunner;
  private scorecardInitialized = false;

  constructor() {
    this.apiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || '');
    this.gameRunner = new Arc3RealGameRunner(this.apiClient);
  }

  private async ensureScorecard(): Promise<void> {
    if (this.scorecardInitialized) {
      return;
    }

    try {
      await this.apiClient.openScorecard(
        ['arc-explainer', 'streaming'],
        'https://github.com/arc-explainer/arc-explainer',
      );
      this.scorecardInitialized = true;
      logger.info(
        '[ARC3 Streaming] Scorecard opened for streaming runner',
        'arc3-stream-service',
      );
    } catch (error) {
      this.scorecardInitialized = false;
      logger.error(
        `Failed to open ARC3 scorecard for streaming: ${error instanceof Error ? error.message : String(error)}`,
        'arc3-stream-service',
      );
      throw error;
    }
  }

  savePendingPayload(payload: StreamArc3Payload, ttlMs: number = PENDING_ARC3_SESSION_TTL_SECONDS * 1000): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const expirationTimestamp = ttlMs > 0 ? now + ttlMs : now;

    const enrichedPayload: StreamArc3Payload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: expirationTimestamp,
    };

    this.pendingSessions.set(sessionId, enrichedPayload);
    this.scheduleExpiration(sessionId, ttlMs);
    return sessionId;
  }

  getPendingPayload(sessionId: string): StreamArc3Payload | undefined {
    return this.pendingSessions.get(sessionId);
  }

  clearPendingPayload(sessionId: string): void {
    this.pendingSessions.delete(sessionId);
    const timer = this.pendingSessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.pendingSessionTimers.delete(sessionId);
    }
  }

  private scheduleExpiration(sessionId: string, ttlMs: number): void {
    const existingTimer = this.pendingSessionTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (ttlMs <= 0) {
      this.clearPendingPayload(sessionId);
      return;
    }

    const timer = setTimeout(() => {
      this.pendingSessions.delete(sessionId);
      this.pendingSessionTimers.delete(sessionId);
      logger.debug(
        `[ARC3 Streaming] Pending payload for session ${sessionId} expired after ${ttlMs}ms`,
        "arc3-stream-service"
      );
    }, ttlMs);

    if (typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }

    this.pendingSessionTimers.set(sessionId, timer);
  }

  async startStreaming(_req: Request, payload: StreamArc3Payload): Promise<string> {
    const sessionId = payload.sessionId ?? nanoid();

    try {
      await this.ensureScorecard();

      if (!sseStreamManager.has(sessionId)) {
        throw new Error("SSE session must be registered before starting ARC3 streaming.");
      }

      const streamingConfig = resolveStreamingConfig();
      if (!streamingConfig.enabled) {
        sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming is disabled on this server.");
        return sessionId;
      }

      const { game_id, agentName, systemPrompt, instructions, model, maxTurns, reasoningEffort } = payload;

      // Send initial status
      sseStreamManager.sendEvent(sessionId, "stream.init", {
        state: "starting",
        game_id,
        agentName: agentName || 'ARC3 Agent',
        timestamp: Date.now(),
      });

      // Create streaming harness for the game runner
      const streamHarness = {
        sessionId,
        emit: (chunk: any) => {
          const enrichedChunk = {
            ...(chunk ?? {}),
            metadata: {
              ...(chunk?.metadata ?? {}),
              game_id,
              agentName: agentName || 'ARC3 Agent',
            },
          };
          sseStreamManager.sendEvent(sessionId, "stream.chunk", enrichedChunk);
        },
        end: (summary: any) => {
          sseStreamManager.close(sessionId, summary);
        },
        emitEvent: (event: string, data: any) => {
          const enrichedEvent =
            data && typeof data === "object"
              ? { ...data, game_id, agentName: agentName || 'ARC3 Agent' }
              : { game_id, agentName: agentName || 'ARC3 Agent' };
          sseStreamManager.sendEvent(sessionId, event, enrichedEvent);
        },
        metadata: {
          game_id,
          agentName: agentName || 'ARC3 Agent',
        },
      };

      // Run the agent with streaming
      const runConfig: Arc3AgentRunConfig = {
        game_id,
        agentName,
        systemPrompt,
        instructions,
        model,
        maxTurns,
        reasoningEffort,
      };

      // Send status update
      sseStreamManager.sendEvent(sessionId, "stream.status", {
        state: "running",
        game_id,
        message: "Agent is starting to play the game...",
        timestamp: Date.now(),
      });

      // Override the game runner to emit streaming events
      await this.gameRunner.runWithStreaming(runConfig, streamHarness);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`ARC3 streaming failed: ${message}`, "arc3-stream-service");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
    } finally {
      this.clearPendingPayload(sessionId);
    }

    return sessionId;
  }

  cancelSession(sessionId: string): void {
    if (sseStreamManager.has(sessionId)) {
      sseStreamManager.teardown(sessionId, "cancelled");
    }
    this.clearPendingPayload(sessionId);
  }
}

export const arc3StreamService = new Arc3StreamService();
