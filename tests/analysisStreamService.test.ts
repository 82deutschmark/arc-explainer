/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Validates the analysis streaming pending-session handshake and ensures lifecycle cleanup prevents payload leaks.
 * SRP/DRY check: Pass — focused coverage on AnalysisStreamService cache helpers and lifecycle behaviours without duplicating integration tests.
 * shadcn/ui: Pass — backend service coverage only.
 */

import test from "node:test";
import { strict as assert } from "node:assert";

import {
  analysisStreamService,
  PENDING_SESSION_TTL_SECONDS,
} from "../server/services/streaming/analysisStreamService.ts";
import { sseStreamManager } from "../server/services/streaming/SSEStreamManager.ts";
import { aiServiceFactory } from "../server/services/aiServiceFactory.ts";
import { streamController } from "../server/controllers/streamController.ts";

function createMockResponse() {
  let statusCode: number | undefined;
  let jsonPayload: any;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: any) {
      jsonPayload = payload;
      return this;
    },
  } as unknown as import("express").Response;

  return {
    res,
    getStatus: () => statusCode ?? 200,
    getJson: <T>() => jsonPayload as T,
  };
}

const basePayload = {
  taskId: "T123",
  modelKey: "gpt-5-mini",
  temperature: 0.4,
  captureReasoning: true,
};

test("AnalysisStreamService stores and clears pending payloads", () => {
  const sessionId = analysisStreamService.savePendingPayload(basePayload);
  try {
    const stored = analysisStreamService.getPendingPayload(sessionId);
    assert.ok(stored, "Expected payload to be cached during handshake");
    assert.equal(stored?.taskId, basePayload.taskId);
    assert.equal(stored?.modelKey, basePayload.modelKey);
    assert.equal(typeof stored?.createdAt, "number");
  } finally {
    analysisStreamService.clearPendingPayload(sessionId);
    assert.equal(analysisStreamService.getPendingPayload(sessionId), undefined);
  }
});

test("startStreaming clears pending payload when model does not support streaming", async (t) => {
  process.env.STREAMING_ENABLED = "true";

  const sessionId = analysisStreamService.savePendingPayload({
    taskId: "task-unsupported",
    modelKey: "openai/gpt-non-streaming",
  });

  const originalHas = sseStreamManager.has;
  const originalError = sseStreamManager.error;
  const originalGetService = aiServiceFactory.getService;

  const errorEvents: Array<{ code: string }> = [];

  sseStreamManager.has = () => true;
  sseStreamManager.error = ((incomingSessionId: string, code: string) => {
    if (incomingSessionId === sessionId) {
      errorEvents.push({ code });
    }
  }) as typeof sseStreamManager.error;
  aiServiceFactory.getService = (() => ({
    supportsStreaming: () => false,
  })) as typeof aiServiceFactory.getService;

  t.after(() => {
    sseStreamManager.has = originalHas;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
  });

  await analysisStreamService.startStreaming({} as any, {
    taskId: "task-unsupported",
    modelKey: "openai/gpt-non-streaming",
    sessionId,
  });

  assert.equal(analysisStreamService.getPendingPayload(sessionId), undefined, "Pending payload should be cleared");
  assert.ok(
    errorEvents.some((event) => event.code === "STREAMING_UNAVAILABLE"),
    "Expected streaming unavailable error event",
  );
});

test("startStreaming clears pending payload even when SSE session is missing", async (t) => {
  process.env.STREAMING_ENABLED = "true";

  const sessionId = analysisStreamService.savePendingPayload({
    taskId: "task-missing-session",
    modelKey: "openai/gpt-5-2025",
  });

  const originalHas = sseStreamManager.has;
  const originalError = sseStreamManager.error;

  const errorEvents: Array<{ code: string }> = [];

  sseStreamManager.has = () => false;
  sseStreamManager.error = ((incomingSessionId: string, code: string) => {
    if (incomingSessionId === sessionId) {
      errorEvents.push({ code });
    }
  }) as typeof sseStreamManager.error;

  t.after(() => {
    sseStreamManager.has = originalHas;
    sseStreamManager.error = originalError;
  });

  await analysisStreamService.startStreaming({} as any, {
    taskId: "task-missing-session",
    modelKey: "openai/gpt-5-2025",
    sessionId,
  });

  assert.equal(analysisStreamService.getPendingPayload(sessionId), undefined, "Pending payload should be cleared");
  assert.ok(
    errorEvents.some((event) => event.code === "STREAMING_FAILED"),
    "Expected streaming failed error event",
  );
});

test("prepareAnalysisStream validates payloads and stores pending session", async (t) => {
  const savedPayloads: any[] = [];
  const originalSave = analysisStreamService.savePendingPayload;

  analysisStreamService.savePendingPayload = ((payload, ttlMs) => {
    savedPayloads.push(payload);
    assert.equal(ttlMs ?? PENDING_SESSION_TTL_SECONDS * 1000, PENDING_SESSION_TTL_SECONDS * 1000);
    return "session-mock-123";
  }) as typeof analysisStreamService.savePendingPayload;

  t.after(() => {
    analysisStreamService.savePendingPayload = originalSave;
  });

  const { res, getStatus, getJson } = createMockResponse();

  await streamController.prepareAnalysisStream(
    {
      body: {
        taskId: "task-handshake",
        modelKey: "gpt-5-mini",
        temperature: 0.25,
        options: {
          emojiSetKey: "alien",
          candidateCount: 1,
          useStructuredOutput: true,
          omitAnswer: false,
        },
        serviceOpts: {
          reasoningEffort: "low",
          captureReasoning: false,
          maxOutputTokens: "2048",
          store: "true",
          reasoningSummary: "detailed",
        },
        candidateCount: 3,
        thinkingBudget: 9,
        omitAnswer: true,
        reasoningEffort: "medium",
        reasoningVerbosity: "high",
        reasoningSummaryType: "detailed",
        systemPromptMode: "ARC",
        previousResponseId: "resp-123",
        captureReasoning: true,
        customChallenge: "Focus on corners",
      },
    } as any,
    res,
  );

  assert.equal(getStatus(), 200, "Handshake should respond with HTTP 200");
  const json = getJson<{ sessionId: string; expiresInSeconds: number }>();
  assert.deepEqual(json, {
    sessionId: "session-mock-123",
    expiresInSeconds: PENDING_SESSION_TTL_SECONDS,
  });
  assert.equal(savedPayloads.length, 1, "Handshake should store payload once");
  assert.equal(savedPayloads[0].taskId, "task-handshake");
  assert.equal(savedPayloads[0].modelKey, "gpt-5-mini");
  assert.equal(savedPayloads[0].captureReasoning, true);
  assert.equal(savedPayloads[0].customChallenge, "Focus on corners");
  assert.deepEqual(savedPayloads[0].options, {
    emojiSetKey: "alien",
    candidateCount: 3,
    useStructuredOutput: true,
    omitAnswer: true,
    thinkingBudget: 9,
  });
  assert.deepEqual(savedPayloads[0].serviceOpts, {
    captureReasoning: true,
    reasoningEffort: "medium",
    reasoningVerbosity: "high",
    reasoningSummaryType: "detailed",
    systemPromptMode: "ARC",
    previousResponseId: "resp-123",
    reasoningSummary: "detailed",
    maxOutputTokens: 2048,
    store: true,
  });
});

test("prepareAnalysisStream rejects invalid payloads", async (t) => {
  let saveCalled = false;
  const originalSave = analysisStreamService.savePendingPayload;

  analysisStreamService.savePendingPayload = ((payload, ttlMs) => {
    saveCalled = true;
    return originalSave.call(analysisStreamService, payload, ttlMs);
  }) as typeof analysisStreamService.savePendingPayload;

  t.after(() => {
    analysisStreamService.savePendingPayload = originalSave;
  });

  const { res, getStatus, getJson } = createMockResponse();

  await streamController.prepareAnalysisStream(
    {
      body: {
        modelKey: "gpt-5-mini",
      },
    } as any,
    res,
  );

  assert.equal(getStatus(), 422, "Invalid handshake should return HTTP 422");
  const json = getJson<{ error: string; details: string[] }>();
  assert.equal(json.error, "Invalid stream request payload.");
  assert.ok(json.details.includes("taskId is required and must be a non-empty string."));
  assert.equal(saveCalled, false, "Handshake should not store payload when validation fails");
});

test("pending payloads expire automatically when handshake is abandoned", async () => {
  const shortLivedSession = analysisStreamService.savePendingPayload(
    {
      taskId: "abandoned-task",
      modelKey: "gpt-5-mini",
    },
    15,
  );

  assert.ok(
    analysisStreamService.getPendingPayload(shortLivedSession),
    "Payload should be cached immediately after handshake",
  );

  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.equal(
    analysisStreamService.getPendingPayload(shortLivedSession),
    undefined,
    "Expired payload should be removed automatically",
  );
});

