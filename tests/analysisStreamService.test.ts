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
});
