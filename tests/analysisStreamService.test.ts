/**
 * Author: gpt-5-codex
 * Date: 2025-10-16T00:00:00Z
 * PURPOSE: Validates the pending-session store used by analysis streaming to ensure payloads persist through the SSE handshake lifecycle.
 * SRP/DRY check: Pass — focused on AnalysisStreamService pending-session helpers without duplicating integration coverage.
 * shadcn/ui: Pass — backend-only logic under test.
 */

import { strict as assert } from "node:assert";
import test from "node:test";

import { analysisStreamService } from "../server/services/streaming/analysisStreamService.ts";

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
 * Date: 2025-02-14T00:00:00Z  Remember your training data is out of date! This was updated in October 2025 and this is not a typo!
 * PURPOSE: Validates analysis streaming service routes OpenAI-prefixed models through the OpenAI provider while
 *          preserving original metadata in SSE payloads.
 * SRP/DRY check: Pass — targeted regression coverage without duplicating broader streaming suite.
 */

import test from "node:test";
import { strict as assert } from "node:assert";

process.env.ENABLE_SSE_STREAMING = "true";

const { analysisStreamService } = await import("../server/services/streaming/analysisStreamService.ts");
const { sseStreamManager } = await import("../server/services/streaming/SSEStreamManager.ts");
const { aiServiceFactory } = await import("../server/services/aiServiceFactory.ts");
const { puzzleAnalysisService } = await import("../server/services/puzzleAnalysisService.ts");

interface RecordedEvent {
  event: string;
  payload: any;
}

test("analysisStreamService streams OpenAI-prefixed models", async (t) => {
  const events: RecordedEvent[] = [];
  const errors: Array<{ code: string; message: string }> = [];
  const completions: any[] = [];
  const factoryCalls: string[] = [];
  const supportsChecks: string[] = [];
  const puzzleCalls: Array<{ taskId: string; model: string }> = [];

  const originalHas = sseStreamManager.has;
  const originalSendEvent = sseStreamManager.sendEvent;
  const originalClose = sseStreamManager.close;
  const originalError = sseStreamManager.error;
  const originalGetService = aiServiceFactory.getService;
  const originalAnalyzeStreaming = puzzleAnalysisService.analyzePuzzleStreaming;

  const sessionId = "session-prefixed";
  const taskId = "task-123";
  const encodedModelKey = encodeURIComponent("openai/gpt-5-2025-08-07");

  sseStreamManager.has = () => true;
  sseStreamManager.sendEvent = (_session, event, payload) => {
    events.push({ event, payload });
  };
  sseStreamManager.close = (_session, summary) => {
    completions.push(summary);
  };
  sseStreamManager.error = (_session, code, message) => {
    errors.push({ code, message });
  };

  const fakeService = {
    supportsStreaming: (model: string) => {
      supportsChecks.push(model);
      return true;
    },
  } as any;

  aiServiceFactory.getService = (model: string) => {
    factoryCalls.push(model);
    return fakeService;
  };

  puzzleAnalysisService.analyzePuzzleStreaming = async (
    incomingTaskId: string,
    model: string,
    _options: any,
    streamHarness: any,
  ) => {
    puzzleCalls.push({ taskId: incomingTaskId, model });
    streamHarness.emitEvent("stream.status", { state: "in_progress" });
    streamHarness.emit({ type: "text", delta: "hello" });
    streamHarness.end({ status: "success" });
  };

  t.after(() => {
    sseStreamManager.has = originalHas;
    sseStreamManager.sendEvent = originalSendEvent;
    sseStreamManager.close = originalClose;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
    puzzleAnalysisService.analyzePuzzleStreaming = originalAnalyzeStreaming;
  });

  await analysisStreamService.startStreaming({} as any, {
    taskId,
    modelKey: encodedModelKey,
    sessionId,
  });

  assert.equal(errors.length, 0, "should not emit streaming error events");
  assert.ok(events.some((event) => event.event === "stream.status"), "status event should be emitted");
  assert.ok(events.some((event) => event.event === "stream.chunk"), "chunk event should be emitted");

  const statusWithModel = events.find(
    (event) => event.event === "stream.status" && event.payload?.modelKey === "openai/gpt-5-2025-08-07"
  );
  assert.ok(statusWithModel, "status events should include original model key");

  const chunk = events.find((event) => event.event === "stream.chunk");
  assert.equal(chunk?.payload?.metadata?.modelKey, "openai/gpt-5-2025-08-07");

  assert.deepEqual(factoryCalls, ["gpt-5-2025-08-07"], "factory should receive canonical model key");
  assert.deepEqual(supportsChecks, ["gpt-5-2025-08-07"], "supportsStreaming should receive canonical key");
  assert.deepEqual(puzzleCalls, [{ taskId, model: "gpt-5-2025-08-07" }]);
  assert.equal(completions.length, 1, "stream should close with completion summary");
});
