/**
 * Author: gpt-5-codex
 * Date: 2025-03-09T00:00:00Z
 * PURPOSE: Validates streaming analysis requests, manages SSE session lifecycle hooks, and delegates orchestration to the analysis streaming service.
 * SRP/DRY check: Pass — shares helpers with existing streaming utilities and verified via `npm run check`.
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

function ensureString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pruneUndefined<T extends object>(value: T): Partial<T> | undefined {
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return undefined;
  }
  return Object.fromEntries(entries) as Partial<T>;
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
  const includeGridImages = parseBoolean(body?.includeGridImages);

  const rawPromptOptions = isPlainObject(body?.options) ? (body.options as Record<string, unknown>) : undefined;
  const promptOptions: PromptOptions = {};
  if (rawPromptOptions) {
    const rawEmojiSetKey = ensureString(rawPromptOptions["emojiSetKey"]);
    if (rawEmojiSetKey) {
      promptOptions.emojiSetKey = rawEmojiSetKey;
    }
    const rawOmitAnswer = parseBoolean(rawPromptOptions["omitAnswer"]);
    if (typeof rawOmitAnswer === "boolean") {
      promptOptions.omitAnswer = rawOmitAnswer;
    }
    const rawTopP = parseNumber(rawPromptOptions["topP"]);
    if (typeof rawTopP === "number") {
      promptOptions.topP = rawTopP;
    }
    const rawCandidateCount = parseNumber(rawPromptOptions["candidateCount"]);
    if (typeof rawCandidateCount === "number") {
      promptOptions.candidateCount = rawCandidateCount;
    }
    const rawThinkingBudget = parseNumber(rawPromptOptions["thinkingBudget"]);
    if (typeof rawThinkingBudget === "number") {
      promptOptions.thinkingBudget = rawThinkingBudget;
    }
    const rawRetryMode = parseBoolean(rawPromptOptions["retryMode"]);
    if (typeof rawRetryMode === "boolean") {
      promptOptions.retryMode = rawRetryMode;
    }
    const rawTemperature = parseNumber(rawPromptOptions["temperature"]);
    if (typeof rawTemperature === "number") {
      promptOptions.temperature = rawTemperature;
    }
    const rawSystemPromptMode = ensureString(rawPromptOptions["systemPromptMode"]);
    if (rawSystemPromptMode) {
      promptOptions.systemPromptMode = rawSystemPromptMode as PromptOptions["systemPromptMode"];
    }
    const rawCustomChallenge = ensureString(rawPromptOptions["customChallenge"]);
    if (rawCustomChallenge) {
      promptOptions.customChallenge = rawCustomChallenge;
    }
    if (rawPromptOptions["previousAnalysis"] !== undefined) {
      promptOptions.previousAnalysis = rawPromptOptions["previousAnalysis"];
    }
    if (rawPromptOptions["originalExplanation"] !== undefined) {
      promptOptions.originalExplanation = rawPromptOptions["originalExplanation"];
    }
    if (Array.isArray(rawPromptOptions["badFeedback"])) {
      promptOptions.badFeedback = rawPromptOptions["badFeedback"] as any[];
    }
    const rawUseStructuredOutput = parseBoolean(rawPromptOptions["useStructuredOutput"]);
    if (typeof rawUseStructuredOutput === "boolean") {
      promptOptions.useStructuredOutput = rawUseStructuredOutput;
    }
  }

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

  if (originalExplanation !== undefined) {
    promptOptions.originalExplanation = promptOptions.originalExplanation ?? originalExplanation;
  }

  const promptId = ensureString(body?.promptId) ?? "solver";
  const customPrompt = ensureString(body?.customPrompt);

  const rawServiceOpts = isPlainObject(body?.serviceOpts) ? (body.serviceOpts as Record<string, unknown>) : undefined;
  const serviceOpts: ServiceOptions = {};
  if (rawServiceOpts) {
    const rawCaptureReasoning = parseBoolean(rawServiceOpts["captureReasoning"]);
    if (typeof rawCaptureReasoning === "boolean") {
      serviceOpts.captureReasoning = rawCaptureReasoning;
    }
    const rawReasoningEffort = ensureString(rawServiceOpts["reasoningEffort"]);
    if (rawReasoningEffort) {
      serviceOpts.reasoningEffort = rawReasoningEffort as ServiceOptions["reasoningEffort"];
    }
    const rawReasoningVerbosity = ensureString(rawServiceOpts["reasoningVerbosity"]);
    if (rawReasoningVerbosity) {
      serviceOpts.reasoningVerbosity = rawReasoningVerbosity as ServiceOptions["reasoningVerbosity"];
    }
    const rawReasoningSummaryType = ensureString(rawServiceOpts["reasoningSummaryType"]);
    if (rawReasoningSummaryType) {
      serviceOpts.reasoningSummaryType = rawReasoningSummaryType as ServiceOptions["reasoningSummaryType"];
    }
    const rawSystemPromptMode = ensureString(rawServiceOpts["systemPromptMode"]);
    if (rawSystemPromptMode) {
      serviceOpts.systemPromptMode = rawSystemPromptMode as ServiceOptions["systemPromptMode"];
    }
    const rawPreviousResponseId = ensureString(rawServiceOpts["previousResponseId"]);
    if (rawPreviousResponseId) {
      serviceOpts.previousResponseId = rawPreviousResponseId;
    }
    const rawReasoningSummary = ensureString(rawServiceOpts["reasoningSummary"]);
    if (rawReasoningSummary) {
      serviceOpts.reasoningSummary = rawReasoningSummary as ServiceOptions["reasoningSummary"];
    }
    const rawMaxSteps = parseNumber(rawServiceOpts["maxSteps"]);
    if (typeof rawMaxSteps === "number") {
      serviceOpts.maxSteps = rawMaxSteps;
    }
    const rawMaxRetries = parseNumber(rawServiceOpts["maxRetries"]);
    if (typeof rawMaxRetries === "number") {
      serviceOpts.maxRetries = rawMaxRetries;
    }
    const rawMaxOutputTokens = parseNumber(rawServiceOpts["maxOutputTokens"]);
    if (typeof rawMaxOutputTokens === "number") {
      serviceOpts.maxOutputTokens = rawMaxOutputTokens;
    }
    const rawStore = parseBoolean(rawServiceOpts["store"]);
    if (typeof rawStore === "boolean") {
      serviceOpts.store = rawStore;
    }
    const rawSessionId = ensureString(rawServiceOpts["sessionId"]);
    if (rawSessionId) {
      serviceOpts.sessionId = rawSessionId;
    }
  }

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

  const normalizedPromptOptions = pruneUndefined(promptOptions);
  const normalizedServiceOpts = pruneUndefined(serviceOpts);

  const payload: StreamAnalysisPayload = {
    taskId: taskId ?? "",
    modelKey: modelKey ?? "",
    promptId,
    temperature,
    options: normalizedPromptOptions,
    serviceOpts: normalizedServiceOpts,
    customPrompt,
    captureReasoning,
    retryMode,
    originalExplanationId,
    originalExplanation,
    customChallenge,
    includeGridImages: includeGridImages === true,
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
      const cachedPayload = analysisStreamService.getPendingPayload(sessionId);
      const expiresAtMs = cachedPayload?.expiresAt;
      const expiresInSeconds = typeof expiresAtMs === "number"
        ? Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000))
        : PENDING_SESSION_TTL_SECONDS;
      const expiresAtIso = typeof expiresAtMs === "number" ? new Date(expiresAtMs).toISOString() : undefined;
      logger.info(
        `[StreamPrepare] Prepared analysis session ${sessionId} for task ${payload.taskId} (${payload.modelKey})`,
        "stream-controller",
      );
      res.status(200).json({
        sessionId,
        expiresInSeconds,
        expiresAt: expiresAtIso,
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
      expiresAt: typeof pendingPayload.expiresAt === "number" ? new Date(pendingPayload.expiresAt).toISOString() : undefined,
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
