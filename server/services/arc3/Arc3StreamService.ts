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
import type { FrameData } from "./Arc3ApiClient";
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

export interface ContinueStreamArc3Payload extends StreamArc3Payload {
  userMessage: string;  // New user message to chain
  previousResponseId?: string;  // From last response for Responses API chaining
  existingGameGuid?: string;  // Game session guid to continue (from previous run)
  lastFrame?: FrameData; // Cached frame from client to seed continuation state
}

export const PENDING_ARC3_SESSION_TTL_SECONDS = 60;

export class Arc3StreamService {
  private readonly pendingSessions: Map<string, StreamArc3Payload> = new Map();
  private readonly pendingSessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly continuationSessions: Map<string, ContinueStreamArc3Payload> = new Map();
  private readonly continuationSessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
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

  saveContinuationPayload(
    sessionId: string,
    basePayload: StreamArc3Payload,
    continuationData: {
      userMessage: string;
      previousResponseId?: string;
      existingGameGuid?: string;
      lastFrame?: FrameData;
    },
    ttlMs: number = PENDING_ARC3_SESSION_TTL_SECONDS * 1000
  ): void {
    const now = Date.now();
    const expirationTimestamp = ttlMs > 0 ? now + ttlMs : now;

    const continuationPayload: ContinueStreamArc3Payload = {
      ...basePayload,
      sessionId,
      userMessage: continuationData.userMessage,
      previousResponseId: continuationData.previousResponseId,
      existingGameGuid: continuationData.existingGameGuid,
      lastFrame: continuationData.lastFrame,
      createdAt: now,
      expiresAt: expirationTimestamp,
    };

    this.continuationSessions.set(sessionId, continuationPayload);
    this.scheduleContinuationExpiration(sessionId, ttlMs);
  }

  getContinuationPayload(sessionId: string): ContinueStreamArc3Payload | undefined {
    return this.continuationSessions.get(sessionId);
  }

  clearContinuationPayload(sessionId: string): void {
    this.continuationSessions.delete(sessionId);
    const timer = this.continuationSessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.continuationSessionTimers.delete(sessionId);
    }
  }

  private scheduleContinuationExpiration(sessionId: string, ttlMs: number): void {
    const existingTimer = this.continuationSessionTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    if (ttlMs <= 0) {
      this.clearContinuationPayload(sessionId);
      return;
    }

    const timer = setTimeout(() => {
      this.continuationSessions.delete(sessionId);
      this.continuationSessionTimers.delete(sessionId);
      logger.debug(
        `[ARC3 Streaming] Continuation payload for session ${sessionId} expired after ${ttlMs}ms`,
        "arc3-stream-service"
      );
    }, ttlMs);

    if (typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }

    this.continuationSessionTimers.set(sessionId, timer);
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
        storeResponse: true,
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

      // After successful streaming, extend the session TTL to allow continuation
      // This gives the user time to send a follow-up message
      const extendedTTL = 300000; // 5 minutes
      this.scheduleExpiration(sessionId, extendedTTL);
      logger.info(
        `[ARC3 Streaming] Session ${sessionId} completed, extended TTL to ${extendedTTL}ms for potential continuation`,
        "arc3-stream-service"
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`ARC3 streaming failed: ${message}`, "arc3-stream-service");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
      // Clear payload on error since continuation won't be possible
      this.clearPendingPayload(sessionId);
    }

    return sessionId;
  }

  async continueStreaming(_req: Request, payload: ContinueStreamArc3Payload): Promise<string> {
    const sessionId = payload.sessionId ?? nanoid();

    try {
      await this.ensureScorecard();

      if (!sseStreamManager.has(sessionId)) {
        throw new Error("SSE session must be registered before continuing ARC3 streaming.");
      }

      const streamingConfig = resolveStreamingConfig();
      if (!streamingConfig.enabled) {
        sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming is disabled on this server.");
        return sessionId;
      }

      const { game_id, agentName, systemPrompt, instructions, model, maxTurns, reasoningEffort, userMessage, previousResponseId, existingGameGuid } = payload;

      // Send initial status
      sseStreamManager.sendEvent(sessionId, "stream.init", {
        state: "continuing",
        game_id,
        agentName: agentName || 'ARC3 Agent',
        hasPreviousResponse: !!previousResponseId,
        isContinuingGame: !!existingGameGuid,
        timestamp: Date.now(),
      });

      // Create streaming harness for the continued game runner
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

      // Send status update
      sseStreamManager.sendEvent(sessionId, "stream.status", {
        state: "running",
        game_id,
        message: existingGameGuid
          ? `Agent continuing existing game ${existingGameGuid} with user message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`
          : `Agent continuing with user message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`,
        timestamp: Date.now(),
      });

      logger.info(
        `[ARC3 Continue] Running with userMessage (${userMessage.length} chars), previousResponseId=${!!previousResponseId}, existingGameGuid=${existingGameGuid}`,
        "arc3-stream-service"
      );

      // Run the continued agent with streaming
      // NOTE: The gameRunner will handle the previous_response_id and store: true parameters
      // via the Responses API when calling OpenAI
      const runConfig: Arc3AgentRunConfig = {
        game_id,
        agentName,
        systemPrompt,
        instructions: `${instructions}\n\nUser feedback: ${userMessage}`,  // Append user message to instructions
        model,
        maxTurns,
        reasoningEffort,
        existingGameGuid,  // Pass the game session guid to continue
        previousResponseId,
        storeResponse: true,
      };

      // Override the game runner to emit streaming events
      // The previous_response_id will be passed to the Responses API to chain conversations
      await this.gameRunner.runWithStreaming(runConfig, streamHarness);

      // After successful continuation, extend the base session TTL again for potential further continuation
      const extendedTTL = 300000; // 5 minutes
      this.scheduleExpiration(sessionId, extendedTTL);
      logger.info(
        `[ARC3 Streaming] Continuation ${sessionId} completed, extended TTL to ${extendedTTL}ms for potential further continuation`,
        "arc3-stream-service"
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`ARC3 continuation failed: ${message}`, "arc3-stream-service");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
      // Clear both payloads on error
      this.clearPendingPayload(sessionId);
    } finally {
      // Always clear the continuation payload after use (but keep the base payload for further continuations)
      this.clearContinuationPayload(sessionId);
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
