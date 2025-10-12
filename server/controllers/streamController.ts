/**
 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Handles SSE analysis streaming requests by validating parameters, opening SSE channels, and delegating to the streaming service orchestrator.
 * SRP/DRY check: Pass — no prior controller for SSE analysis streaming.
 * shadcn/ui: Pass — backend controller only.
 */

import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { analysisStreamService } from "../services/streaming/analysisStreamService";
import { sseStreamManager } from "../services/streaming/SSEStreamManager";
import { logger } from "../utils/logger";
import type { PromptOptions } from "../services/promptBuilder";
import type { ServiceOptions } from "../services/base/BaseAIService";

function parseNumber(value: unknown, fallback?: number): number | undefined {
  if (value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseBoolean(value: unknown, fallback?: boolean): boolean | undefined {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.toLowerCase();
    if (["true", "1", "yes"].includes(lowered)) return true;
    if (["false", "0", "no"].includes(lowered)) return false;
  }
  return fallback;
}

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

export const streamController = {
  async cancel(req: Request, res: Response) {
    const { sessionId } = req.params as { sessionId: string };

    if (!sessionId) {
      res.status(400).json({ error: 'Missing sessionId' });
      return;
    }

    try {
      sseStreamManager.error(sessionId, 'CANCELLED_BY_USER', 'Analysis cancelled by user');
      sseStreamManager.close(sessionId, {
        status: 'aborted',
        metadata: { reason: 'user_cancelled' }
      });

      logger.info(`[StreamCancel] Session ${sessionId} cancelled by user`, 'stream-cancel');

      res.json({
        success: true,
        data: {
          sessionId,
          status: 'cancelled'
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[StreamCancel] Failed to cancel session ${sessionId}: ${message}`, 'stream-cancel');

      res.status(500).json({
        error: `Failed to cancel: ${message}`
      });
    }
  },

  async startAnalysisStream(req: Request, res: Response) {
    const { taskId, modelKey } = req.params;
    if (!taskId || !modelKey) {
      res.status(400).json({ error: "Missing taskId or modelKey." });
      return;
    }

    const providedSessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : undefined;
    const sessionId = providedSessionId ?? nanoid();

    const connection = sseStreamManager.register(sessionId, res);
    sseStreamManager.sendEvent(sessionId, "stream.init", {
      sessionId,
      taskId,
      modelKey: decodeURIComponent(modelKey),
      createdAt: new Date(connection.createdAt).toISOString(),
    });

    try {
      const temperature = parseNumber(req.query.temperature, 0.2);
      const topP = parseNumber(req.query.topP);
      const candidateCount = parseNumber(req.query.candidateCount);
      const thinkingBudget = parseNumber(req.query.thinkingBudget);
      const captureReasoning = parseBoolean(req.query.captureReasoning, true);
      const omitAnswer = parseBoolean(req.query.omitAnswer, true);
      const retryMode = parseBoolean(req.query.retryMode, false);
      const originalExplanationId = parseNumber(req.query.originalExplanationId);
      const originalExplanation = parseJson(req.query.originalExplanation);
      const customChallenge = typeof req.query.customChallenge === "string" ? req.query.customChallenge : undefined;

      const promptOptions: PromptOptions = {};
      if (typeof req.query.emojiSetKey === "string") {
        promptOptions.emojiSetKey = req.query.emojiSetKey;
      }
      if (typeof omitAnswer === "boolean") {
        promptOptions.omitAnswer = omitAnswer;
      }
      if (typeof topP === "number") {
        promptOptions.topP = topP;
      }
      if (typeof candidateCount === "number") {
        promptOptions.candidateCount = candidateCount;
      }
      if (typeof thinkingBudget === "number") {
        promptOptions.thinkingBudget = thinkingBudget;
      }
      if (retryMode === true) {
        promptOptions.retryMode = true;
      }
      if (originalExplanation) {
        promptOptions.originalExplanation = originalExplanation;
      }
      if (customChallenge) {
        promptOptions.customChallenge = customChallenge;
      }

      const serviceOpts: ServiceOptions = {
        sessionId,
        captureReasoning,
      };
      if (typeof req.query.reasoningEffort === "string") {
        serviceOpts.reasoningEffort = req.query.reasoningEffort as ServiceOptions["reasoningEffort"];
      }
      if (typeof req.query.reasoningVerbosity === "string") {
        serviceOpts.reasoningVerbosity = req.query.reasoningVerbosity as ServiceOptions["reasoningVerbosity"];
      }
      if (typeof req.query.reasoningSummaryType === "string") {
        serviceOpts.reasoningSummaryType = req.query.reasoningSummaryType as ServiceOptions["reasoningSummaryType"];
      }
      if (typeof req.query.systemPromptMode === "string") {
        serviceOpts.systemPromptMode = req.query.systemPromptMode as ServiceOptions["systemPromptMode"];
      }
      if (typeof req.query.previousResponseId === "string") {
        serviceOpts.previousResponseId = req.query.previousResponseId;
      }

      const promptId = typeof req.query.promptId === "string" ? req.query.promptId : "solver";
      const customPrompt = typeof req.query.customPrompt === "string" ? req.query.customPrompt : undefined;

      analysisStreamService
        .startStreaming(req, {
          taskId,
          modelKey,
          sessionId,
          promptId,
          options: promptOptions,
          serviceOpts,
          temperature,
          customPrompt,
          captureReasoning,
          retryMode,
          originalExplanationId,
          originalExplanation,
          customChallenge,
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Streaming orchestration failed: ${message}`, "stream-controller");
          sseStreamManager.error(sessionId, "STREAMING_FAILED", message);
        });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize stream: ${message}`, "stream-controller");
      sseStreamManager.error(sessionId, "STREAM_INIT_FAILED", message);
    }
  },
};
