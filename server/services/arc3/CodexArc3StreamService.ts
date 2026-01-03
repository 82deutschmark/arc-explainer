/**
 * Author: Cascade (ChatGPT 5.1 Codex)
 * Date: 2026-01-02
 * PURPOSE: Coordinates streaming Codex ARC3 agent sessions, bridging SSE connections with the real ARC3 API.
 *          Handles session management, JSONL recording persistence, and lifecycle management.
 * SRP/DRY check: Pass — follows established streaming patterns from Arc3StreamService.ts
 */

import { nanoid } from "nanoid";
import type { Request } from "express";
import { sseStreamManager } from "../streaming/SSEStreamManager";
import { logger } from "../../utils/logger";
import { resolveStreamingConfig } from "@shared/config/streaming";
import { Arc3ApiClient } from "./Arc3ApiClient";
import type { FrameData } from "./Arc3ApiClient";
import { CodexArc3Runner } from "./CodexArc3Runner";
import type { Arc3AgentRunConfig } from "./types";

export interface CodexStreamArc3Payload {
  game_id: string;
  agentName?: string;
  systemPrompt?: string;
  instructions: string;
  model?: string;
  maxTurns?: number;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  sessionId?: string;
  createdAt?: number;
  expiresAt?: number;
  existingGameGuid?: string;
  providerResponseId?: string | null;
  lastFrame?: FrameData;
  systemPromptPresetId?: 'twitch' | 'playbook' | 'none';
  skipDefaultSystemPrompt?: boolean;
}

export interface CodexContinueStreamPayload extends CodexStreamArc3Payload {
  userMessage: string;
  previousResponseId: string;
  lastFrame?: FrameData;
}

export const CODEX_SESSION_TTL_SECONDS = 900; // 15 minutes

export class CodexArc3StreamService {
  private readonly pendingSessions: Map<string, CodexStreamArc3Payload> = new Map();
  private readonly pendingSessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly continuationSessions: Map<string, CodexContinueStreamPayload> = new Map();
  private readonly continuationSessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly apiClient: Arc3ApiClient;
  private readonly gameRunner: CodexArc3Runner;

  constructor() {
    this.apiClient = new Arc3ApiClient(process.env.ARC3_API_KEY || '');
    this.gameRunner = new CodexArc3Runner(this.apiClient);
  }

  savePendingPayload(payload: CodexStreamArc3Payload, ttlMs: number = CODEX_SESSION_TTL_SECONDS * 1000): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const expirationTimestamp = ttlMs > 0 ? now + ttlMs : now;

    const enrichedPayload: CodexStreamArc3Payload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: expirationTimestamp,
    };

    this.pendingSessions.set(sessionId, enrichedPayload);
    this.scheduleExpiration(sessionId, ttlMs);
    return sessionId;
  }

  getPendingPayload(sessionId: string): CodexStreamArc3Payload | undefined {
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

  updatePendingPayload(sessionId: string, updates: Partial<CodexStreamArc3Payload>): void {
    const existingPayload = this.pendingSessions.get(sessionId);
    if (!existingPayload) return;

    const mergedPayload: CodexStreamArc3Payload = {
      ...existingPayload,
      ...updates,
      sessionId: existingPayload.sessionId,
      createdAt: existingPayload.createdAt,
      expiresAt: updates.expiresAt ?? existingPayload.expiresAt,
    };

    this.pendingSessions.set(sessionId, mergedPayload);
  }

  saveContinuationPayload(
    sessionId: string,
    basePayload: CodexStreamArc3Payload,
    continuationData: {
      userMessage: string;
      previousResponseId: string;
      existingGameGuid?: string;
      lastFrame?: FrameData;
    },
    ttlMs: number = CODEX_SESSION_TTL_SECONDS * 1000
  ): void {
    if (!continuationData.previousResponseId) {
      throw new Error('Continuation payload requires a previousResponseId.');
    }

    const now = Date.now();
    const expirationTimestamp = ttlMs > 0 ? now + ttlMs : now;

    const continuationPayload: CodexContinueStreamPayload = {
      ...basePayload,
      sessionId,
      userMessage: continuationData.userMessage,
      previousResponseId: continuationData.previousResponseId,
      existingGameGuid: continuationData.existingGameGuid,
      lastFrame: continuationData.lastFrame ?? basePayload.lastFrame,
      createdAt: now,
      expiresAt: expirationTimestamp,
    };

    this.continuationSessions.set(sessionId, continuationPayload);
    this.scheduleContinuationExpiration(sessionId, ttlMs);
  }

  getContinuationPayload(sessionId: string): CodexContinueStreamPayload | undefined {
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
    if (existingTimer) clearTimeout(existingTimer);

    if (ttlMs <= 0) {
      this.clearContinuationPayload(sessionId);
      return;
    }

    const timer = setTimeout(() => {
      this.continuationSessions.delete(sessionId);
      this.continuationSessionTimers.delete(sessionId);
      logger.debug(`[Codex ARC3 Streaming] Continuation payload for session ${sessionId} expired`, "codex-arc3-stream");
    }, ttlMs);

    if (typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }

    this.continuationSessionTimers.set(sessionId, timer);
  }

  private scheduleExpiration(sessionId: string, ttlMs: number): void {
    const existingTimer = this.pendingSessionTimers.get(sessionId);
    if (existingTimer) clearTimeout(existingTimer);

    if (ttlMs <= 0) {
      this.clearPendingPayload(sessionId);
      return;
    }

    const timer = setTimeout(() => {
      this.pendingSessions.delete(sessionId);
      this.pendingSessionTimers.delete(sessionId);
      logger.debug(`[Codex ARC3 Streaming] Pending payload for session ${sessionId} expired`, "codex-arc3-stream");
    }, ttlMs);

    if (typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }

    this.pendingSessionTimers.set(sessionId, timer);
  }

  async startStreaming(_req: Request, payload: CodexStreamArc3Payload): Promise<string> {
    const sessionId = payload.sessionId ?? nanoid();

    try {
      if (!sseStreamManager.has(sessionId)) {
        throw new Error("SSE session must be registered before starting Codex ARC3 streaming.");
      }

      const streamingConfig = resolveStreamingConfig();
      if (!streamingConfig.enabled) {
        sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming is disabled on this server.");
        return sessionId;
      }

      const { game_id, agentName, systemPrompt, instructions, model, maxTurns, reasoningEffort, systemPromptPresetId, skipDefaultSystemPrompt } = payload;

      // Send initial status
      sseStreamManager.sendEvent(sessionId, "stream.init", {
        state: "starting",
        game_id,
        agentName: agentName || 'Codex ARC3 Agent',
        provider: 'codex',
        timestamp: Date.now(),
      });

      // Create streaming harness
      const streamHarness = {
        sessionId,
        emit: (chunk: any) => {
          const enrichedChunk = {
            ...(chunk ?? {}),
            metadata: {
              ...(chunk?.metadata ?? {}),
              game_id,
              agentName: agentName || 'Codex ARC3 Agent',
              provider: 'codex',
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
              ? { ...data, game_id, agentName: agentName || 'Codex ARC3 Agent', provider: 'codex' }
              : { game_id, agentName: agentName || 'Codex ARC3 Agent', provider: 'codex' };
          sseStreamManager.sendEvent(sessionId, event, enrichedEvent);
        },
        metadata: {
          game_id,
          agentName: agentName || 'Codex ARC3 Agent',
        },
      };

      // Run config
      const runConfig: Arc3AgentRunConfig = {
        game_id,
        agentName,
        systemPrompt,
        instructions,
        model,
        maxTurns,
        reasoningEffort,
        storeResponse: true,
        sessionId,
        systemPromptPresetId,
        skipDefaultSystemPrompt,
      };

      // Send status update
      sseStreamManager.sendEvent(sessionId, "stream.status", {
        state: "running",
        game_id,
        message: "Codex agent is starting to play the game...",
        provider: 'codex',
        timestamp: Date.now(),
      });

      // Run the Codex agent with streaming
      const runResult = await this.gameRunner.runWithStreaming(runConfig, streamHarness);

      const finalFrame = Array.isArray(runResult.frames) && runResult.frames.length > 0
        ? (runResult.frames[runResult.frames.length - 1] as FrameData)
        : payload.lastFrame;

      logger.info(`[Codex ARC3 Streaming] Caching final frame for session ${sessionId}; frame index=${runResult.frames?.length ?? 0}`, 'codex-arc3-stream');

      // Persist response metadata for future continuations
      this.updatePendingPayload(sessionId, {
        existingGameGuid: runResult.gameGuid,
        providerResponseId: runResult.providerResponseId ?? null,
        lastFrame: finalFrame,
      });

      // Extend session TTL for continuation
      const extendedTTL = 300000; // 5 minutes
      this.scheduleExpiration(sessionId, extendedTTL);
      logger.info(
        `[Codex ARC3 Streaming] Session ${sessionId} completed, extended TTL to ${extendedTTL}ms`,
        "codex-arc3-stream"
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Codex ARC3 streaming failed: ${message}`, "codex-arc3-stream");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
      this.clearPendingPayload(sessionId);
    }

    return sessionId;
  }

  async continueStreaming(_req: Request, payload: CodexContinueStreamPayload): Promise<string> {
    const sessionId = payload.sessionId ?? nanoid();

    try {
      if (!sseStreamManager.has(sessionId)) {
        throw new Error("SSE session must be registered before continuing Codex ARC3 streaming.");
      }

      const streamingConfig = resolveStreamingConfig();
      if (!streamingConfig.enabled) {
        sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming is disabled on this server.");
        return sessionId;
      }

      const { game_id, agentName, systemPrompt, instructions, model, maxTurns, reasoningEffort, userMessage, previousResponseId, existingGameGuid, systemPromptPresetId, skipDefaultSystemPrompt } = payload;

      if (!previousResponseId) {
        throw new Error('Codex ARC3 continuation requires a previousResponseId.');
      }

      // Send initial status
      sseStreamManager.sendEvent(sessionId, "stream.init", {
        state: "continuing",
        game_id,
        agentName: agentName || 'Codex ARC3 Agent',
        hasPreviousResponse: !!previousResponseId,
        isContinuingGame: !!existingGameGuid,
        provider: 'codex',
        timestamp: Date.now(),
      });

      // Create streaming harness
      const streamHarness = {
        sessionId,
        emit: (chunk: any) => {
          const enrichedChunk = {
            ...(chunk ?? {}),
            metadata: {
              ...(chunk?.metadata ?? {}),
              game_id,
              agentName: agentName || 'Codex ARC3 Agent',
              provider: 'codex',
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
              ? { ...data, game_id, agentName: agentName || 'Codex ARC3 Agent', provider: 'codex' }
              : { game_id, agentName: agentName || 'Codex ARC3 Agent', provider: 'codex' };
          sseStreamManager.sendEvent(sessionId, event, enrichedEvent);
        },
        metadata: {
          game_id,
          agentName: agentName || 'Codex ARC3 Agent',
        },
      };

      // Send status update
      sseStreamManager.sendEvent(sessionId, "stream.status", {
        state: "running",
        game_id,
        message: existingGameGuid
          ? `Codex continuing existing game ${existingGameGuid} with user message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`
          : `Codex continuing with user message: "${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}"`,
        provider: 'codex',
        timestamp: Date.now(),
      });

      logger.info(
        `[Codex ARC3 Continue] Running with userMessage (${userMessage.length} chars), previousResponseId=${!!previousResponseId}, existingGameGuid=${existingGameGuid}`,
        "codex-arc3-stream"
      );

      // Run config for continuation
      const runConfig: Arc3AgentRunConfig = {
        game_id,
        agentName,
        systemPrompt,
        instructions: `${instructions}\n\nUser feedback: ${userMessage}`,
        model,
        maxTurns,
        reasoningEffort,
        existingGameGuid,
        previousResponseId,
        seedFrame: payload.lastFrame,
        storeResponse: true,
        sessionId,
        systemPromptPresetId,
        skipDefaultSystemPrompt,
      };

      // Run the continuation
      const runResult = await this.gameRunner.runWithStreaming(runConfig, streamHarness);

      const finalFrame = Array.isArray(runResult.frames) && runResult.frames.length > 0
        ? (runResult.frames[runResult.frames.length - 1] as FrameData)
        : payload.lastFrame;

      logger.info(`[Codex ARC3 Streaming] Caching continuation frame for session ${sessionId}`, 'codex-arc3-stream');

      this.updatePendingPayload(sessionId, {
        existingGameGuid: runResult.gameGuid,
        providerResponseId: runResult.providerResponseId ?? null,
        lastFrame: finalFrame,
      });

      // Extend TTL for further continuation
      const extendedTTL = 300000;
      this.scheduleExpiration(sessionId, extendedTTL);
      logger.info(
        `[Codex ARC3 Streaming] Continuation ${sessionId} completed, extended TTL`,
        "codex-arc3-stream"
      );

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Codex ARC3 continuation failed: ${message}`, "codex-arc3-stream");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
      this.clearPendingPayload(sessionId);
    } finally {
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

// Singleton export
export const codexArc3StreamService = new CodexArc3StreamService();
