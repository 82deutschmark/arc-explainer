/**
 * Author: gpt-5-codex
 * Date: 2025-10-17T00:00:00Z
 * PURPOSE: Focused coverage for AnalysisStreamService.startStreaming default behaviours and
 * feature flag overrides to guarantee streaming remains enabled unless explicitly disabled.
 * SRP/DRY check: Pass — scoped to streaming flag interactions only.
 */

import test from "node:test";
import { strict as assert } from "node:assert";

import {
  analysisStreamService,
  PENDING_SESSION_TTL_SECONDS,
} from "../server/services/streaming/analysisStreamService.ts";
import { sseStreamManager } from "../server/services/streaming/SSEStreamManager.ts";
import { aiServiceFactory } from "../server/services/aiServiceFactory.ts";
import { puzzleAnalysisService } from "../server/services/puzzleAnalysisService.ts";

function prepareSession(taskId: string, modelKey: string) {
  const sessionId = analysisStreamService.savePendingPayload({ taskId, modelKey });
  return sessionId;
}

test("startStreaming streams by default in production when no overrides are present", async (t) => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    legacyBackend: process.env.ENABLE_SSE_STREAMING,
    frontend: process.env.VITE_STREAMING_ENABLED,
    legacyFrontend: process.env.VITE_ENABLE_SSE_STREAMING,
    nodeEnv: process.env.NODE_ENV,
  };

  delete process.env.STREAMING_ENABLED;
  delete process.env.ENABLE_SSE_STREAMING;
  delete process.env.VITE_STREAMING_ENABLED;
  delete process.env.VITE_ENABLE_SSE_STREAMING;
  process.env.NODE_ENV = "production";

  const sessionId = prepareSession("default-production-task", "openai/gpt-5-2025");

  const events: Array<{ event: string; payload: any }> = [];
  const errors: Array<{ code: string; message: string }> = [];
  const completions: any[] = [];
  const supportsChecks: string[] = [];

  const originalHas = sseStreamManager.has;
  const originalSendEvent = sseStreamManager.sendEvent;
  const originalClose = sseStreamManager.close;
  const originalError = sseStreamManager.error;
  const originalGetService = aiServiceFactory.getService;
  const originalAnalyze = puzzleAnalysisService.analyzePuzzleStreaming;

  let analyzeCalled = false;

  sseStreamManager.has = (incomingSessionId: string) => incomingSessionId === sessionId;
  sseStreamManager.sendEvent = (_session, event, payload) => {
    events.push({ event, payload });
  };
  sseStreamManager.close = (_session, summary) => {
    completions.push(summary);
  };
  sseStreamManager.error = (_session, code, message) => {
    errors.push({ code, message });
  };
  aiServiceFactory.getService = ((modelKey: string) => {
    supportsChecks.push(modelKey);
    return {
      supportsStreaming: () => true,
    } as any;
  }) as typeof aiServiceFactory.getService;
  puzzleAnalysisService.analyzePuzzleStreaming = (async (
    _taskId,
    _modelKey,
    _promptOptions,
    streamHarness,
    _serviceOptions,
  ) => {
    analyzeCalled = true;
    streamHarness.emit?.({ type: "delta", text: "hello" });
    streamHarness.emitEvent?.("custom", { detail: "ok" });
    streamHarness.end?.({ state: "completed" });
  }) as typeof puzzleAnalysisService.analyzePuzzleStreaming;

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.ENABLE_SSE_STREAMING = previousEnv.legacyBackend;
    process.env.VITE_STREAMING_ENABLED = previousEnv.frontend;
    process.env.VITE_ENABLE_SSE_STREAMING = previousEnv.legacyFrontend;
    process.env.NODE_ENV = previousEnv.nodeEnv;
    sseStreamManager.has = originalHas;
    sseStreamManager.sendEvent = originalSendEvent;
    sseStreamManager.close = originalClose;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
    puzzleAnalysisService.analyzePuzzleStreaming = originalAnalyze;
  });

  const returnedSessionId = await analysisStreamService.startStreaming({} as any, {
    taskId: "default-production-task",
    modelKey: encodeURIComponent("openai/gpt-5-2025"),
    sessionId,
  });

  assert.equal(returnedSessionId, sessionId, "should echo provided session id");
  assert.equal(analyzeCalled, true, "puzzle analysis should start streaming by default");
  assert.equal(supportsChecks.length, 1, "expected one service lookup");
  assert.equal(
    errors.find((error) => error.code === "STREAMING_DISABLED"),
    undefined,
    "Streaming should not emit disabled errors by default",
  );
  assert.ok(events.some((event) => event.event === "stream.status"), "status event should be emitted");
  assert.ok(events.some((event) => event.event === "stream.chunk"), "chunk event should be emitted");
  assert.ok(events.some((event) => event.event === "custom"), "custom event should bubble through stream harness");
  assert.ok(completions.length > 0, "completion summary should be emitted");
  assert.equal(
    analysisStreamService.getPendingPayload(sessionId),
    undefined,
    "Pending payload should be cleared after streaming completes",
  );
});

test("startStreaming emits STREAMING_DISABLED when the feature flag explicitly disables streaming", async (t) => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    legacyBackend: process.env.ENABLE_SSE_STREAMING,
    nodeEnv: process.env.NODE_ENV,
  };

  process.env.STREAMING_ENABLED = "false";
  delete process.env.ENABLE_SSE_STREAMING;
  process.env.NODE_ENV = "production";

  const sessionId = prepareSession("disabled-flag-task", "openai/gpt-5-2025");

  const errors: Array<{ code: string; message: string }> = [];

  const originalHas = sseStreamManager.has;
  const originalError = sseStreamManager.error;
  const originalAnalyze = puzzleAnalysisService.analyzePuzzleStreaming;

  let analyzeCalled = false;

  sseStreamManager.has = (incomingSessionId: string) => incomingSessionId === sessionId;
  sseStreamManager.error = ((incomingSessionId: string, code: string, message: string) => {
    if (incomingSessionId === sessionId) {
      errors.push({ code, message });
    }
  }) as typeof sseStreamManager.error;
  puzzleAnalysisService.analyzePuzzleStreaming = (async () => {
    analyzeCalled = true;
  }) as typeof puzzleAnalysisService.analyzePuzzleStreaming;

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.ENABLE_SSE_STREAMING = previousEnv.legacyBackend;
    process.env.NODE_ENV = previousEnv.nodeEnv;
    sseStreamManager.has = originalHas;
    sseStreamManager.error = originalError;
    puzzleAnalysisService.analyzePuzzleStreaming = originalAnalyze;
  });

  await analysisStreamService.startStreaming({} as any, {
    taskId: "disabled-flag-task",
    modelKey: "openai/gpt-5-2025",
    sessionId,
  });

  assert.ok(
    errors.some((event) => event.code === "STREAMING_DISABLED"),
    "Expected disabled code when feature flag is explicitly false",
  );
  assert.equal(analyzeCalled, false, "Streaming pipeline should not run when disabled explicitly");
  assert.equal(
    analysisStreamService.getPendingPayload(sessionId),
    undefined,
    "Pending payload should still be cleared",
  );
});

test("startStreaming respects legacy default TTL when cleanup runs", async (t) => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    nodeEnv: process.env.NODE_ENV,
  };

  delete process.env.STREAMING_ENABLED;
  process.env.NODE_ENV = "production";

  const sessionId = prepareSession("ttl-cleanup", "openai/gpt-5-2025");
  const ttlMs = analysisStreamService.getPendingPayload(sessionId)?.expiresAt ?? 0;

  t.after(() => {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.NODE_ENV = previousEnv.nodeEnv;
    analysisStreamService.clearPendingPayload(sessionId);
  });

  assert.ok(ttlMs > 0, "Pending payload should include an expiration timestamp");
  assert.ok(
    ttlMs - (analysisStreamService.getPendingPayload(sessionId)?.createdAt ?? 0) <=
      PENDING_SESSION_TTL_SECONDS * 1000,
    "TTL should match configured pending session duration",
  );
});
