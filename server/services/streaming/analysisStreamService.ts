/**
 *
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Coordinates streaming analysis sessions, bridging SSE connections with provider services, handling capability checks, option parsing, and graceful lifecycle management.
 * SRP/DRY check: Pass — no existing orchestration layer for SSE token streaming.
 * shadcn/ui: Pass — backend service only.
 */

import { isFeatureFlagEnabled } from "@shared/utils/featureFlags";

import { nanoid } from "nanoid";
import type { Request } from "express";
import { puzzleAnalysisService } from "../puzzleAnalysisService";
import { sseStreamManager } from "./SSEStreamManager";
import { logger } from "../../utils/logger";
import { aiServiceFactory } from "../aiServiceFactory";
import type { PromptOptions } from "../promptBuilder";
import type { ServiceOptions } from "../base/BaseAIService";

const STREAMING_ENABLED = isFeatureFlagEnabled(process.env.ENABLE_SSE_STREAMING);

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
}

export class AnalysisStreamService {
  async startStreaming(req: Request, payload: StreamAnalysisPayload): Promise<string> {
    const sessionId = payload.sessionId ?? nanoid();

    if (!sseStreamManager.has(sessionId)) {
      throw new Error("SSE session must be registered before starting analysis.");
    }

    if (!STREAMING_ENABLED) {
      sseStreamManager.error(sessionId, "STREAMING_DISABLED", "Streaming is disabled on this server.");
      return sessionId;
    }

    const { taskId, modelKey } = payload;
    const decodedModel = decodeURIComponent(modelKey);

    const aiService = aiServiceFactory.getService(decodedModel);
    if (!aiService?.supportsStreaming?.(decodedModel)) {
      logger.warn(`Streaming requested for unsupported model ${decodedModel}`, "stream-service");
      sseStreamManager.error(sessionId, "STREAMING_UNAVAILABLE", "Streaming is not enabled for this model.");
      return sessionId;
    }

    try {
      sseStreamManager.sendEvent(sessionId, "stream.status", { state: "starting" });
      const promptId = payload.promptId ?? "solver";
      const promptOptions = payload.options ?? {};
      const temperature = payload.temperature ?? 0.2;
      const customPrompt = payload.customPrompt;
      const captureReasoning = payload.captureReasoning ?? true;
      const retryMode = payload.retryMode ?? false;
      const streamHarness = {
        sessionId,
        emit: (chunk: any) => {
          sseStreamManager.sendEvent(sessionId, "stream.chunk", chunk);
        },
        end: (summary: any) => {
          sseStreamManager.close(sessionId, summary);
        },
        emitEvent: (event: string, data: any) => {
          sseStreamManager.sendEvent(sessionId, event, data);
        },
      };

      const baseServiceOpts: ServiceOptions = {
        ...(payload.serviceOpts ?? {}),
        stream: streamHarness,
      };

      await puzzleAnalysisService.analyzePuzzleStreaming(
        taskId,
        decodedModel,
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
        },
        streamHarness,
        baseServiceOpts
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Streaming analysis failed: ${message}`, "stream-service");
      sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
    }

    return sessionId;
  }
}

export const analysisStreamService = new AnalysisStreamService();


