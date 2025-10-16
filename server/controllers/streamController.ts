/**
 * 
 * Author: Codex using GPT-5-high
 * Date: 2025-10-09T00:00:00Z
 * PURPOSE: Handles SSE analysis streaming requests by validating parameters, opening SSE channels, and delegating to the streaming service orchestrator.
 * SRP/DRY check: Pass — no prior controller for SSE analysis streaming.
 * shadcn/ui: Pass — backend controller only.
 */

import type { Request, Response } from "express";
import {
  analysisStreamService,
  PENDING_SESSION_TTL_SECONDS,
  type StreamAnalysisPayload,
} from "../services/streaming/analysisStreamService";
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

function ensureString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceOriginalExplanation(value: unknown): any | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return value;
  return parseJson<any>(value);
}

function buildPayloadFromBody(body: any): { payload?: StreamAnalysisPayload; errors: string[] } {
  const errors: string[] = [];

  const taskId = ensureString(body?.taskId);
  const modelKey = ensureString(body?.modelKey);

  if (!taskId) {
    errors.push("taskId is required and must be a non-empty string.");
  }
  if (!modelKey) {
    errors.push("modelKey is required and must be a non-empty string.");
  }

  const temperature = parseNumber(body?.temperature);
  const topP = parseNumber(body?.topP);
  const candidateCount = parseNumber(body?.candidateCount);
  const thinkingBudget = parseNumber(body?.thinkingBudget);
  const captureReasoning = parseBoolean(body?.captureReasoning, true);
  const omitAnswer = parseBoolean(body?.omitAnswer);
  const retryMode = parseBoolean(body?.retryMode);
  const originalExplanationId = parseNumber(body?.originalExplanationId);
  const customChallenge = ensureString(body?.customChallenge);

  const promptOptions: PromptOptions = {};
  const emojiSetKey = ensureString(body?.emojiSetKey);
  if (emojiSetKey) {
    promptOptions.emojiSetKey = emojiSetKey;
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

  const originalExplanation = coerceOriginalExplanation(body?.originalExplanation);
  if (body?.originalExplanation !== undefined && originalExplanation === undefined) {
    errors.push("originalExplanation must be a JSON object or JSON string.");
  }

  const promptId = ensureString(body?.promptId) ?? "solver";
  const customPrompt = ensureString(body?.customPrompt);

  const serviceOpts: ServiceOptions = {};
  if (typeof captureReasoning === "boolean") {
    serviceOpts.captureReasoning = captureReasoning;
  }
  const reasoningEffort = ensureString(body?.reasoningEffort);
  if (reasoningEffort) {
    serviceOpts.reasoningEffort = reasoningEffort as ServiceOptions["reasoningEffort"];
  }
  const reasoningVerbosity = ensureString(body?.reasoningVerbosity);
  if (reasoningVerbosity) {
    serviceOpts.reasoningVerbosity = reasoningVerbosity as ServiceOptions["reasoningVerbosity"];
  }
  const reasoningSummaryType = ensureString(body?.reasoningSummaryType);
  if (reasoningSummaryType) {
    serviceOpts.reasoningSummaryType = reasoningSummaryType as ServiceOptions["reasoningSummaryType"];
  }
  const systemPromptMode = ensureString(body?.systemPromptMode);
  if (systemPromptMode) {
    serviceOpts.systemPromptMode = systemPromptMode as ServiceOptions["systemPromptMode"];
  }
  const previousResponseId = ensureString(body?.previousResponseId);
  if (previousResponseId) {
    serviceOpts.previousResponseId = previousResponseId;
  }

  const payload: StreamAnalysisPayload = {
    taskId: taskId ?? "",
    modelKey: modelKey ?? "",
    promptId,
    temperature,
    options: Object.keys(promptOptions).length > 0 ? promptOptions : undefined,
    serviceOpts: Object.keys(serviceOpts).length > 0 ? serviceOpts : undefined,
    customPrompt,
    captureReasoning,
    retryMode,
    originalExplanationId,
    originalExplanation,
    customChallenge,
  };

  return { payload, errors };
}

export const streamController = {
  async prepareAnalysisStream(req: Request, res: Response) {
    const { payload, errors } = buildPayloadFromBody(req.body);

    if (errors.length > 0 || !payload) {
      res.status(422).json({
        error: "Invalid stream request payload.",
        details: errors,
      });
      return;
    }

    try {
      const sessionId = analysisStreamService.savePendingPayload(payload);
      logger.info(
        `[StreamPrepare] Prepared analysis session ${sessionId} for task ${payload.taskId} (${payload.modelKey})`,
        "stream-controller",
      );
      res.status(200).json({
        sessionId,
        expiresInSeconds: PENDING_SESSION_TTL_SECONDS,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to prepare analysis stream: ${message}`, "stream-controller");
      res.status(500).json({ error: "Failed to prepare analysis stream." });
    }
  },

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

      analysisStreamService.clearPendingPayload(sessionId);

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
    const { taskId, modelKey, sessionId } = req.params as {
      taskId?: string;
      modelKey?: string;
      sessionId?: string;
    };

    if (!taskId || !modelKey || !sessionId) {
      res.status(400).json({ error: "Missing taskId, modelKey, or sessionId." });
      return;
    }

    const pendingPayload = analysisStreamService.getPendingPayload(sessionId);
    if (!pendingPayload) {
      res.status(404).json({ error: "No pending analysis payload found for session." });
      return;
    }

    const decodedModelKey = decodeURIComponent(modelKey);
    const pendingModelKey = decodeURIComponent(pendingPayload.modelKey);

    if (pendingPayload.taskId !== taskId || pendingModelKey !== decodedModelKey) {
      analysisStreamService.clearPendingPayload(sessionId);
      res.status(400).json({ error: "Session parameters do not match pending payload." });
      return;
    }

    const connection = sseStreamManager.register(sessionId, res);
    sseStreamManager.sendEvent(sessionId, "stream.init", {
      sessionId,
      taskId,
      modelKey: decodedModelKey,
      createdAt: new Date(connection.createdAt).toISOString(),
    });

    try {
      analysisStreamService
        .startStreaming(req, {
          ...pendingPayload,
          sessionId,
          modelKey: pendingPayload.modelKey,
          serviceOpts: {
            ...(pendingPayload.serviceOpts ?? {}),
            sessionId,
            captureReasoning: pendingPayload.captureReasoning ?? pendingPayload.serviceOpts?.captureReasoning,
          },
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
