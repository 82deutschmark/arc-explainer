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

import { analysisStreamService } from "../server/services/streaming/analysisStreamService.ts";
import { sseStreamManager } from "../server/services/streaming/SSEStreamManager.ts";
import { aiServiceFactory } from "../server/services/aiServiceFactory.ts";
import { puzzleAnalysisService } from "../server/services/puzzleAnalysisService.ts";
import { normalizeModelKey } from "../server/services/openai/modelRegistry.ts";

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
    assert.equal(typeof stored?.expiresAt, "number");
    assert.ok(
      typeof stored?.createdAt === "number" && typeof stored?.expiresAt === "number"
        ? stored.expiresAt > stored.createdAt
        : false,
      "Expected expiration timestamp to be greater than creation time",
    );
  } finally {
    analysisStreamService.clearPendingPayload(sessionId);
    assert.equal(analysisStreamService.getPendingPayload(sessionId), undefined);
  }
});

test("startStreaming clears pending payload when model does not support streaming", async (t) => {
  const previousEnabled = process.env.STREAMING_ENABLED;
  process.env.STREAMING_ENABLED = "true";

  const sessionId = analysisStreamService.savePendingPayload({
    taskId: "task-unsupported",
    modelKey: "openai/gpt-non-streaming",
  });

  const originalHas = sseStreamManager.has;
  const originalSendEvent = sseStreamManager.sendEvent;
  const originalClose = sseStreamManager.close;
  const originalError = sseStreamManager.error;
  const originalGetService = aiServiceFactory.getService;

  const errorEvents: Array<{ code: string }> = [];

  sseStreamManager.has = () => true;
  sseStreamManager.sendEvent = (() => undefined) as typeof sseStreamManager.sendEvent;
  sseStreamManager.close = (() => undefined) as typeof sseStreamManager.close;
  sseStreamManager.error = ((incomingSessionId: string, code: string) => {
    if (incomingSessionId === sessionId) {
      errorEvents.push({ code });
    }
  }) as typeof sseStreamManager.error;
  aiServiceFactory.getService = (() => ({
    supportsStreaming: () => false,
  })) as typeof aiServiceFactory.getService;

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnabled;
    sseStreamManager.has = originalHas;
    sseStreamManager.sendEvent = originalSendEvent;
    sseStreamManager.close = originalClose;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
  });

  await analysisStreamService.startStreaming({} as any, {
    taskId: "task-unsupported",
    modelKey: "openai/gpt-non-streaming",
    sessionId,
  });

  assert.equal(
    analysisStreamService.getPendingPayload(sessionId),
    undefined,
    "Pending payload should be cleared",
  );
  assert.ok(
    errorEvents.some((event) => event.code === "STREAMING_UNAVAILABLE"),
    "Expected streaming unavailable error event",
  );
});

test("startStreaming streams when OpenAI-prefixed GPT-5 model is requested", async (t) => {
  const previousEnabled = process.env.STREAMING_ENABLED;
  const previousLegacyFlag = process.env.ENABLE_SSE_STREAMING;
  process.env.STREAMING_ENABLED = "true";
  process.env.ENABLE_SSE_STREAMING = "true";

  const sessionId = "session-openai-prefixed";
  const events: Array<{ event: string; payload: any }> = [];
  const completions: any[] = [];
  const errors: Array<{ code: string; message?: string }> = [];
  const factoryCalls: string[] = [];
  const supportsChecks: string[] = [];
  const puzzleCalls: Array<{ taskId: string; model: string }> = [];

  const originalHas = sseStreamManager.has;
  const originalSendEvent = sseStreamManager.sendEvent;
  const originalClose = sseStreamManager.close;
  const originalError = sseStreamManager.error;
  const originalGetService = aiServiceFactory.getService;
  const originalAnalyzePuzzleStreaming = puzzleAnalysisService.analyzePuzzleStreaming;

  sseStreamManager.has = (incomingSessionId: string) => incomingSessionId === sessionId;
  sseStreamManager.sendEvent = ((incomingSessionId: string, event: string, payload: any) => {
    if (incomingSessionId === sessionId) {
      events.push({ event, payload });
    }
  }) as typeof sseStreamManager.sendEvent;
  sseStreamManager.close = ((incomingSessionId: string, summary: any) => {
    if (incomingSessionId === sessionId) {
      completions.push(summary);
    }
  }) as typeof sseStreamManager.close;
  sseStreamManager.error = ((incomingSessionId: string, code: string, message?: string) => {
    if (incomingSessionId === sessionId) {
      errors.push({ code, message });
    }
  }) as typeof sseStreamManager.error;

  const streamingAwareService = {
    supportsStreaming: (model: string) => {
      supportsChecks.push(model);
      const normalized = normalizeModelKey(`openai/${model}`);
      return normalized === "gpt-5-mini-2025-08-07";
    },
  };

  aiServiceFactory.getService = ((model: string) => {
    factoryCalls.push(model);
    return streamingAwareService as any;
  }) as typeof aiServiceFactory.getService;

  puzzleAnalysisService.analyzePuzzleStreaming = (async (
    taskId,
    model,
    options,
    streamHarness,
    _overrides,
  ) => {
    puzzleCalls.push({ taskId, model });
    streamHarness?.emit?.({ type: "output_text_delta", delta: "hello" });
    streamHarness?.emitEvent?.("stream.status", { state: "completed" });
    streamHarness?.end?.({ status: "done" });
  }) as typeof puzzleAnalysisService.analyzePuzzleStreaming;

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnabled;
    process.env.ENABLE_SSE_STREAMING = previousLegacyFlag;
    sseStreamManager.has = originalHas;
    sseStreamManager.sendEvent = originalSendEvent;
    sseStreamManager.close = originalClose;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
    puzzleAnalysisService.analyzePuzzleStreaming = originalAnalyzePuzzleStreaming;
  });

  const returnedSessionId = await analysisStreamService.startStreaming({} as any, {
    taskId: "task-prefixed",
    modelKey: "openai/gpt-5-mini",
    sessionId,
  });

  assert.equal(returnedSessionId, sessionId, "should echo provided session id");
  assert.equal(errors.length, 0, "should not emit streaming error events");
  assert.ok(
    factoryCalls.includes("gpt-5-mini"),
    "Factory should receive canonical model key without provider prefix",
  );
  assert.ok(
    supportsChecks.includes("gpt-5-mini"),
    "OpenAIService.supportsStreaming should evaluate the canonical key",
  );
  assert.ok(
    puzzleCalls.some((call) => call.model === "gpt-5-mini"),
    "Puzzle analysis should run with canonical model key",
  );
  const statusEvent = events.find(
    (event) => event.event === "stream.status" && event.payload?.state === "starting",
  );
  assert.equal(
    statusEvent?.payload?.modelKey,
    "openai/gpt-5-mini",
    "Status event should report original prefixed key",
  );
  const chunkEvent = events.find((event) => event.event === "stream.chunk");
  assert.ok(chunkEvent, "Chunk events should be forwarded");
  assert.equal(chunkEvent?.payload?.metadata?.modelKey, "openai/gpt-5-mini");
  assert.equal(chunkEvent?.payload?.delta, "hello");
  assert.equal(completions.length, 1, "Streaming harness should close the session");
});

test("startStreaming clears pending payload even when SSE session is missing", async (t) => {
  const previousEnabled = process.env.STREAMING_ENABLED;
  const previousFlag = process.env.ENABLE_SSE_STREAMING;
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
    process.env.STREAMING_ENABLED = previousEnabled;
    process.env.ENABLE_SSE_STREAMING = previousFlag;
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
  const observedTtls: number[] = [];
  const originalSave = analysisStreamService.savePendingPayload;

  analysisStreamService.savePendingPayload = ((payload, ttlMs) => {
    savedPayloads.push(payload);
    observedTtls.push(ttlMs ?? PENDING_SESSION_TTL_SECONDS * 1000);
    return originalSave.call(analysisStreamService, payload, ttlMs);
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
  const json = getJson<{ sessionId: string; expiresInSeconds: number; expiresAt?: string }>();
  assert.equal(typeof json.sessionId, "string");
  assert.ok(json.sessionId.length > 0);
  assert.equal(observedTtls.length, 1);
  assert.equal(observedTtls[0], PENDING_SESSION_TTL_SECONDS * 1000);
  assert.ok(json.expiresInSeconds <= PENDING_SESSION_TTL_SECONDS);
  assert.ok(
    json.expiresInSeconds >= PENDING_SESSION_TTL_SECONDS - 1,
    "Expected handshake expiry seconds to be within one second of configured TTL",
  );
  assert.equal(typeof json.expiresAt, "string");
  const expiresAtMs = Date.parse(json.expiresAt ?? "");
  assert.ok(Number.isFinite(expiresAtMs), "expiresAt should be an ISO timestamp");
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
  const storedPayload = analysisStreamService.getPendingPayload(json.sessionId);
  assert.ok(storedPayload, "Expected pending payload to be retrievable after handshake");
  assert.equal(typeof storedPayload?.createdAt, "number");
  assert.equal(typeof storedPayload?.expiresAt, "number");
  if (storedPayload?.createdAt && storedPayload?.expiresAt) {
    const ttlWindow = storedPayload.expiresAt - storedPayload.createdAt;
    assert.ok(
      ttlWindow <= PENDING_SESSION_TTL_SECONDS * 1000 &&
        ttlWindow >= PENDING_SESSION_TTL_SECONDS * 1000 - 1000,
      `Expected TTL window to remain near configured duration. Observed: ${ttlWindow}ms`,
    );
  }

  analysisStreamService.clearPendingPayload(json.sessionId);
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
  const shortLivedPayload = analysisStreamService.getPendingPayload(shortLivedSession);
  assert.equal(typeof shortLivedPayload?.expiresAt, "number");
  if (shortLivedPayload?.expiresAt && shortLivedPayload?.createdAt) {
    const ttlWindow = shortLivedPayload.expiresAt - shortLivedPayload.createdAt;
    assert.ok(ttlWindow <= 15 && ttlWindow >= 0, `Expected TTL window <= 15ms, observed ${ttlWindow}ms`);
  }

  await new Promise((resolve) => setTimeout(resolve, 40));

  assert.equal(
    analysisStreamService.getPendingPayload(shortLivedSession),
    undefined,
    "Expired payload should be removed automatically",
  );
});

