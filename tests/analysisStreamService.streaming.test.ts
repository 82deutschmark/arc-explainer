/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Validate AnalysisStreamService streaming defaults, flag overrides,
 *          and pending-session TTL behavior.
 * SRP/DRY check: Pass - Scoped to streaming defaults and lifecycle only.
 */

import { test, expect } from 'vitest';

import {
  analysisStreamService,
  PENDING_SESSION_TTL_SECONDS,
} from '../server/services/streaming/analysisStreamService.ts';
import { sseStreamManager } from '../server/services/streaming/SSEStreamManager.ts';
import { aiServiceFactory } from '../server/services/aiServiceFactory.ts';
import { puzzleAnalysisService } from '../server/services/puzzleAnalysisService.ts';

function prepareSession(taskId: string, modelKey: string) {
  const sessionId = analysisStreamService.savePendingPayload({ taskId, modelKey });
  return sessionId;
}

test('startStreaming streams by default in production when no overrides are present', async () => {
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
  process.env.NODE_ENV = 'production';

  const sessionId = prepareSession('default-production-task', 'openai/gpt-5-2025');

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
    streamHarness.emit?.({ type: 'delta', text: 'hello' });
    streamHarness.emitEvent?.('custom', { detail: 'ok' });
    streamHarness.end?.({ state: 'completed' });
  }) as typeof puzzleAnalysisService.analyzePuzzleStreaming;

  try {
    const returnedSessionId = await analysisStreamService.startStreaming({} as any, {
      taskId: 'default-production-task',
      modelKey: encodeURIComponent('openai/gpt-5-2025'),
      sessionId,
    });

    expect(returnedSessionId).toBe(sessionId);
    expect(analyzeCalled).toBe(true);
    expect(supportsChecks.length).toBe(1);
    expect(errors.find((error) => error.code === 'STREAMING_DISABLED')).toBeUndefined();
    expect(events.some((event) => event.event === 'stream.status')).toBe(true);
    expect(events.some((event) => event.event === 'stream.chunk')).toBe(true);
    expect(events.some((event) => event.event === 'custom')).toBe(true);
    expect(completions.length).toBeGreaterThan(0);
    expect(analysisStreamService.getPendingPayload(sessionId)).toBeUndefined();
  } finally {
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
  }
});

test('startStreaming emits STREAMING_DISABLED when the feature flag explicitly disables streaming', async () => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    legacyBackend: process.env.ENABLE_SSE_STREAMING,
    nodeEnv: process.env.NODE_ENV,
  };

  process.env.STREAMING_ENABLED = 'false';
  delete process.env.ENABLE_SSE_STREAMING;
  process.env.NODE_ENV = 'production';

  const sessionId = prepareSession('disabled-flag-task', 'openai/gpt-5-2025');

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

  try {
    await analysisStreamService.startStreaming({} as any, {
      taskId: 'disabled-flag-task',
      modelKey: 'openai/gpt-5-2025',
      sessionId,
    });

    expect(errors.some((event) => event.code === 'STREAMING_DISABLED')).toBe(true);
    expect(analyzeCalled).toBe(false);
    expect(analysisStreamService.getPendingPayload(sessionId)).toBeUndefined();
  } finally {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.ENABLE_SSE_STREAMING = previousEnv.legacyBackend;
    process.env.NODE_ENV = previousEnv.nodeEnv;
    sseStreamManager.has = originalHas;
    sseStreamManager.error = originalError;
    puzzleAnalysisService.analyzePuzzleStreaming = originalAnalyze;
  }
});

test('startStreaming respects legacy default TTL when cleanup runs', async () => {
  const previousEnv = {
    streamingEnabled: process.env.STREAMING_ENABLED,
    nodeEnv: process.env.NODE_ENV,
  };

  delete process.env.STREAMING_ENABLED;
  process.env.NODE_ENV = 'production';

  const sessionId = prepareSession('ttl-cleanup', 'openai/gpt-5-2025');
  const ttlMs = analysisStreamService.getPendingPayload(sessionId)?.expiresAt ?? 0;

  try {
    expect(ttlMs).toBeGreaterThan(0);
    expect(
      ttlMs - (analysisStreamService.getPendingPayload(sessionId)?.createdAt ?? 0)
    ).toBeLessThanOrEqual(PENDING_SESSION_TTL_SECONDS * 1000);
  } finally {
    process.env.STREAMING_ENABLED = previousEnv.streamingEnabled;
    process.env.NODE_ENV = previousEnv.nodeEnv;
    analysisStreamService.clearPendingPayload(sessionId);
  }
});
