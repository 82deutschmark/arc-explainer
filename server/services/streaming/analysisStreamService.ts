/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Coordinates streaming analysis sessions, bridging SSE connections with provider services, handling capability checks,
 * option parsing, and graceful lifecycle management while honoring the shared STREAMING_ENABLED feature flag.
 * SRP/DRY check: Pass — reuse of centralized streaming config avoids duplicate env parsing.
 *
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Coordinates streaming analysis sessions, bridging SSE connections with provider services, handling capability checks, option parsing, and graceful lifecycle management.
 * SRP/DRY check: Pass — no existing orchestration layer for SSE token streaming.
 * shadcn/ui: Pass — backend service only.
 */

import { nanoid } from "nanoid";
import type { Request } from "express";
import { puzzleAnalysisService } from "../puzzleAnalysisService";
import { sseStreamManager } from "./SSEStreamManager";
import { logger } from "../../utils/logger";
import { aiServiceFactory, canonicalizeModelKey } from "../aiServiceFactory";
import type { PromptOptions } from "../promptBuilder";
import type { ServiceOptions } from "../base/BaseAIService";
import { resolveStreamingConfig } from "@shared/config/streaming";
import { puzzleService } from "../puzzleService";
import { validateStreamingResult } from "../streamingValidator";

export interface StreamAnalysisPayload {
  taskId: string;
  modelKey: string;
  sessionId?: string;
  promptId?: string;
  options?: PromptOptions;
  serviceOpts?: ServiceOptions;
  temperature?: number;
  customPrompt?: string;
  captureReasoning?: boolean;
  retryMode?: boolean;
  originalExplanationId?: number;
  originalExplanation?: any;
  customChallenge?: string;
  createdAt?: number;
  expiresAt?: number;
  includeGridImages?: boolean;
}

export const PENDING_SESSION_TTL_SECONDS = 60;

export class AnalysisStreamService {
  private readonly pendingSessions: Map<string, StreamAnalysisPayload> = new Map();
  private readonly pendingSessionTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  savePendingPayload(payload: StreamAnalysisPayload, ttlMs: number = PENDING_SESSION_TTL_SECONDS * 1000): string {
    const sessionId = payload.sessionId ?? nanoid();
    const now = Date.now();
    const expirationTimestamp = ttlMs > 0 ? now + ttlMs : now;

    const enrichedPayload: StreamAnalysisPayload = {
      ...payload,
      sessionId,
      createdAt: now,
      expiresAt: expirationTimestamp,
    };

    this.pendingSessions.set(sessionId, enrichedPayload);
    this.scheduleExpiration(sessionId, ttlMs);
    return sessionId;
  }

  getPendingPayload(sessionId: string): StreamAnalysisPayload | undefined {
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
        `[Streaming] Pending payload for session ${sessionId} expired after ${ttlMs}ms`,
        "stream-service"
      );
    }, ttlMs);

    if (typeof (timer as any).unref === "function") {
      (timer as any).unref();
    }

    this.pendingSessionTimers.set(sessionId, timer);
  }

  async startStreaming(_req: Request, payload: StreamAnalysisPayload): Promise<string> {
    const sessionId = payload.sessionId ?? nanoid();

    try {
      if (!sseStreamManager.has(sessionId)) {
        throw new Error("SSE session must be registered before starting analysis.");
      }

      const streamingConfig = resolveStreamingConfig();
      if (!streamingConfig.enabled) {
        sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming is disabled on this server.");
        return sessionId;
      }

      const { taskId, modelKey } = payload;
      const decodedModel = decodeURIComponent(modelKey);
      const { original: originalModelKey, normalized: canonicalModelKey } = canonicalizeModelKey(decodedModel);

      const aiService = aiServiceFactory.getService(canonicalModelKey);
      if (!aiService?.supportsStreaming?.(canonicalModelKey)) {
        logger.warn(
          `Streaming requested for unsupported model ${originalModelKey} (normalized: ${canonicalModelKey})`,
          "stream-service"
        );
        sseStreamManager.error(
          sessionId,
          "STREAMING_UNAVAILABLE",
          "Streaming is not enabled for this model.",
          { modelKey: originalModelKey }
        );
        return sessionId;
      }

      sseStreamManager.sendEvent(sessionId, "stream.status", {
        state: "starting",
        modelKey: originalModelKey,
        taskId,
      });
      const promptId = payload.promptId ?? "solver";
      const promptOptions = payload.options ?? {};
      const temperature = payload.temperature ?? 0.2;
      const customPrompt = payload.customPrompt;
      const captureReasoning = payload.captureReasoning ?? true;
      const retryMode = payload.retryMode ?? false;

      // Load puzzle for validation
      const puzzle = await puzzleService.getPuzzleById(taskId);

      const baseHarness = {
        sessionId,
        emit: (chunk: any) => {
          const enrichedChunk = {
            ...(chunk ?? {}),
            metadata: {
              ...(chunk?.metadata ?? {}),
              modelKey: originalModelKey,
              taskId,
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
              ? { ...data, modelKey: originalModelKey, taskId }
              : { modelKey: originalModelKey, taskId };
          sseStreamManager.sendEvent(sessionId, event, enrichedEvent);
        },
        metadata: {
          taskId,
          modelKey: originalModelKey,
        },
      };

      // Wrap base harness with validation (matches Saturn pattern)
      const streamHarness = {
        sessionId: baseHarness.sessionId,
        emit: baseHarness.emit,
        emitEvent: baseHarness.emitEvent,
        metadata: baseHarness.metadata,
        end: async (summary: any) => {
          // Validate streaming result before sending completion
          if (summary?.responseSummary?.analysis) {
            try {
              logger.debug('[AnalysisStream] Validating streaming result before completion', 'stream-service');
              const validatedAnalysis = validateStreamingResult(
                summary.responseSummary.analysis,
                puzzle,
                promptId
              );
              summary.responseSummary.analysis = validatedAnalysis;
            } catch (validationError) {
              const message = validationError instanceof Error ? validationError.message : String(validationError);
              logger.logError(
                `[AnalysisStream] Validation failed, sending unvalidated result: ${message}`,
                { error: validationError, context: 'stream-service' }
              );
            }
          }

          await baseHarness.end(summary);
        },
      };

      const baseServiceOpts: ServiceOptions = {
        ...(payload.serviceOpts ?? {}),
        stream: streamHarness,
      };

      await puzzleAnalysisService.analyzePuzzleStreaming(
        taskId,
        canonicalModelKey,
        {
          temperature,
          captureReasoning,
          promptId,
          customPrompt,
          emojiSetKey: promptOptions.emojiSetKey as string | undefined,
          omitAnswer: promptOptions.omitAnswer as boolean | undefined,
          topP: promptOptions.topP as number | undefined,
          candidateCount: promptOptions.candidateCount as number | undefined,
          thinkingBudget: promptOptions.thinkingBudget as number | undefined,
          reasoningEffort: baseServiceOpts.reasoningEffort,
          reasoningVerbosity: baseServiceOpts.reasoningVerbosity,
          reasoningSummaryType: baseServiceOpts.reasoningSummaryType,
          systemPromptMode: baseServiceOpts.systemPromptMode,
          retryMode,
          originalExplanation: payload.originalExplanation,
          originalExplanationId: payload.originalExplanationId,
          customChallenge: payload.customChallenge,
          previousResponseId: baseServiceOpts.previousResponseId,
          includeGridImages: payload.includeGridImages,
        },
        streamHarness,
        baseServiceOpts
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Streaming analysis failed: ${message}`, "stream-service");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
    } finally {
      this.clearPendingPayload(sessionId);
    }

    return sessionId;
  }
}

export const analysisStreamService = new AnalysisStreamService();


