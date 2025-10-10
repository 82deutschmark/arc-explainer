const STREAMING_ENABLED = process.env.ENABLE_SSE_STREAMING === 'true';

/**
 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Coordinates streaming analysis sessions, bridging SSE connections with provider services, handling capability checks, option parsing, and graceful lifecycle management.
 * SRP/DRY check: Pass — no existing orchestration layer for SSE token streaming.
 * shadcn/ui: Pass — backend service only.
 */

import { nanoid } from "nanoid";
import type { Request } from "express";
import { aiServiceFactory } from "../aiServiceFactory";
import { puzzleService } from "../puzzleService";
import { sseStreamManager } from "./SSEStreamManager";
import { logger } from "../../utils/logger";
import type { PromptOptions } from "../promptBuilder";
import type { ServiceOptions } from "../base/BaseAIService";

export interface StreamAnalysisPayload {
  taskId: string;
  modelKey: string;
  sessionId?: string;
  promptId?: string;
  options?: PromptOptions;
  serviceOpts?: ServiceOptions;
  temperature?: number;
  customPrompt?: string;
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
      const puzzle = await puzzleService.getPuzzleById(taskId);
      const promptId = payload.promptId ?? "solver";
      const promptOptions = payload.options ?? {};
      const temperature = payload.temperature ?? 0.2;
      const customPrompt = payload.customPrompt;
      const serviceOpts: ServiceOptions = {
        ...(payload.serviceOpts ?? {}),
        stream: {
          sessionId,
          emit: (chunk) => {
            sseStreamManager.sendEvent(sessionId, "stream.chunk", chunk);
          },
          end: (summary) => {
            sseStreamManager.close(sessionId, summary);
          },
          emitEvent: (event, data) => {
            sseStreamManager.sendEvent(sessionId, event, data);
          },
        },
      };

      await aiService.analyzePuzzleWithStreaming(
        puzzle,
        decodedModel,
        taskId,
        temperature,
        promptId,
        customPrompt,
        promptOptions,
        serviceOpts
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


