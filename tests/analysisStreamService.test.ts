/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Validate AnalysisStreamService pending-session handshake, lifecycle cleanup,
 *          and streaming fallbacks without running full HTTP flows.
 * SRP/DRY check: Pass - Focused service and controller behavior only.
 */

import { test, expect } from 'vitest';
import type { Response } from 'express';

import {
  analysisStreamService,
  PENDING_SESSION_TTL_SECONDS,
} from '../server/services/streaming/analysisStreamService.ts';
import { sseStreamManager } from '../server/services/streaming/SSEStreamManager.ts';
import { aiServiceFactory } from '../server/services/aiServiceFactory.ts';
import { streamController } from '../server/controllers/streamController.ts';
import { puzzleAnalysisService } from '../server/services/puzzleAnalysisService.ts';
import { normalizeModelKey } from '../server/services/openai/modelRegistry.ts';

const basePayload = {
  taskId: 'T123',
  modelKey: 'gpt-5-mini',
  temperature: 0.4,
  captureReasoning: true,
};

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
  } as unknown as Response;

  return {
    res,
    getStatus: () => statusCode ?? 200,
    getJson: <T>() => jsonPayload as T,
  };
}

test('AnalysisStreamService stores and clears pending payloads', () => {
  const sessionId = analysisStreamService.savePendingPayload(basePayload);
  try {
    const stored = analysisStreamService.getPendingPayload(sessionId);
    expect(stored).toBeTruthy();
    expect(stored?.taskId).toBe(basePayload.taskId);
    expect(stored?.modelKey).toBe(basePayload.modelKey);
    expect(typeof stored?.createdAt).toBe('number');
    expect(typeof stored?.expiresAt).toBe('number');
    if (typeof stored?.createdAt === 'number' && typeof stored?.expiresAt === 'number') {
      expect(stored.expiresAt).toBeGreaterThan(stored.createdAt);
    }
  } finally {
    analysisStreamService.clearPendingPayload(sessionId);
    expect(analysisStreamService.getPendingPayload(sessionId)).toBeUndefined();
  }
});

test('startStreaming clears pending payload when model does not support streaming', async () => {
  const previousEnabled = process.env.STREAMING_ENABLED;
  process.env.STREAMING_ENABLED = 'true';

  const sessionId = analysisStreamService.savePendingPayload({
    taskId: 'task-unsupported',
    modelKey: 'openai/gpt-non-streaming',
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

  try {
    await analysisStreamService.startStreaming({} as any, {
      taskId: 'task-unsupported',
      modelKey: 'openai/gpt-non-streaming',
      sessionId,
    });

    expect(analysisStreamService.getPendingPayload(sessionId)).toBeUndefined();
    expect(errorEvents.some((event) => event.code === 'STREAMING_UNAVAILABLE')).toBe(true);
  } finally {
    process.env.STREAMING_ENABLED = previousEnabled;
    sseStreamManager.has = originalHas;
    sseStreamManager.sendEvent = originalSendEvent;
    sseStreamManager.close = originalClose;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
  }
});

test('startStreaming streams when OpenAI-prefixed GPT-5 model is requested', async () => {
  const previousEnabled = process.env.STREAMING_ENABLED;
  const previousLegacyFlag = process.env.ENABLE_SSE_STREAMING;
  process.env.STREAMING_ENABLED = 'true';
  process.env.ENABLE_SSE_STREAMING = 'true';

  const sessionId = 'session-openai-prefixed';
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
      return normalized === 'gpt-5-mini-2025-08-07';
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
    streamHarness?.emit?.({ type: 'output_text_delta', delta: 'hello' });
    streamHarness?.emitEvent?.('stream.status', { state: 'completed' });
    streamHarness?.end?.({ status: 'done' });
  }) as typeof puzzleAnalysisService.analyzePuzzleStreaming;

  try {
    const returnedSessionId = await analysisStreamService.startStreaming({} as any, {
      taskId: 'task-prefixed',
      modelKey: 'openai/gpt-5-mini',
      sessionId,
    });

    expect(returnedSessionId).toBe(sessionId);
    expect(errors.length).toBe(0);
    expect(factoryCalls.includes('gpt-5-mini')).toBe(true);
    expect(supportsChecks.includes('gpt-5-mini')).toBe(true);
    expect(puzzleCalls.some((call) => call.model === 'gpt-5-mini')).toBe(true);

    const statusEvent = events.find(
      (event) => event.event === 'stream.status' && event.payload?.state === 'starting',
    );
    expect(statusEvent?.payload?.modelKey).toBe('openai/gpt-5-mini');

    const chunkEvent = events.find((event) => event.event === 'stream.chunk');
    expect(chunkEvent).toBeTruthy();
    expect(chunkEvent?.payload?.metadata?.modelKey).toBe('openai/gpt-5-mini');
    expect(chunkEvent?.payload?.delta).toBe('hello');
    expect(completions.length).toBe(1);
  } finally {
    process.env.STREAMING_ENABLED = previousEnabled;
    process.env.ENABLE_SSE_STREAMING = previousLegacyFlag;
    sseStreamManager.has = originalHas;
    sseStreamManager.sendEvent = originalSendEvent;
    sseStreamManager.close = originalClose;
    sseStreamManager.error = originalError;
    aiServiceFactory.getService = originalGetService;
    puzzleAnalysisService.analyzePuzzleStreaming = originalAnalyzePuzzleStreaming;
  }
});

test('startStreaming clears pending payload even when SSE session is missing', async () => {
  const previousEnabled = process.env.STREAMING_ENABLED;
  const previousFlag = process.env.ENABLE_SSE_STREAMING;
  process.env.STREAMING_ENABLED = 'true';

  const sessionId = analysisStreamService.savePendingPayload({
    taskId: 'task-missing-session',
    modelKey: 'openai/gpt-5-2025',
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

  try {
    await analysisStreamService.startStreaming({} as any, {
      taskId: 'task-missing-session',
      modelKey: 'openai/gpt-5-2025',
      sessionId,
    });

    expect(analysisStreamService.getPendingPayload(sessionId)).toBeUndefined();
    expect(errorEvents.some((event) => event.code === 'STREAMING_FAILED')).toBe(true);
  } finally {
    process.env.STREAMING_ENABLED = previousEnabled;
    process.env.ENABLE_SSE_STREAMING = previousFlag;
    sseStreamManager.has = originalHas;
    sseStreamManager.error = originalError;
  }
});

test('prepareAnalysisStream validates payloads and stores pending session', async () => {
  const savedPayloads: any[] = [];
  const observedTtls: number[] = [];
  const originalSave = analysisStreamService.savePendingPayload;

  analysisStreamService.savePendingPayload = ((payload, ttlMs) => {
    savedPayloads.push(payload);
    observedTtls.push(ttlMs ?? PENDING_SESSION_TTL_SECONDS * 1000);
    return originalSave.call(analysisStreamService, payload, ttlMs);
  }) as typeof analysisStreamService.savePendingPayload;

  try {
    const { res, getStatus, getJson } = createMockResponse();

    await streamController.prepareAnalysisStream(
      {
        body: {
          taskId: 'task-handshake',
          modelKey: 'gpt-5-mini',
          temperature: 0.25,
          options: {
            emojiSetKey: 'alien',
            candidateCount: 1,
            useStructuredOutput: true,
            omitAnswer: false,
          },
          serviceOpts: {
            reasoningEffort: 'low',
            captureReasoning: false,
            maxOutputTokens: '2048',
            store: 'true',
            reasoningSummary: 'detailed',
          },
          candidateCount: 3,
          thinkingBudget: 9,
          omitAnswer: true,
          reasoningEffort: 'medium',
          reasoningVerbosity: 'high',
          reasoningSummaryType: 'detailed',
          systemPromptMode: 'ARC',
          previousResponseId: 'resp-123',
          captureReasoning: true,
          customChallenge: 'Focus on corners',
        },
      } as any,
      res,
    );

    expect(getStatus()).toBe(200);
    const json = getJson<{ sessionId: string; expiresInSeconds: number; expiresAt?: string }>();
    expect(typeof json.sessionId).toBe('string');
    expect(json.sessionId.length).toBeGreaterThan(0);
    expect(observedTtls.length).toBe(1);
    expect(observedTtls[0]).toBe(PENDING_SESSION_TTL_SECONDS * 1000);
    expect(json.expiresInSeconds).toBeLessThanOrEqual(PENDING_SESSION_TTL_SECONDS);
    expect(json.expiresInSeconds).toBeGreaterThanOrEqual(PENDING_SESSION_TTL_SECONDS - 1);
    expect(typeof json.expiresAt).toBe('string');

    const expiresAtMs = Date.parse(json.expiresAt ?? '');
    expect(Number.isFinite(expiresAtMs)).toBe(true);
    expect(savedPayloads.length).toBe(1);
    expect(savedPayloads[0].taskId).toBe('task-handshake');
    expect(savedPayloads[0].modelKey).toBe('gpt-5-mini');
    expect(savedPayloads[0].captureReasoning).toBe(true);
    expect(savedPayloads[0].customChallenge).toBe('Focus on corners');
    expect(savedPayloads[0].options).toEqual({
      emojiSetKey: 'alien',
      candidateCount: 3,
      useStructuredOutput: true,
      omitAnswer: true,
      thinkingBudget: 9,
    });
    expect(savedPayloads[0].serviceOpts).toEqual({
      captureReasoning: true,
      reasoningEffort: 'medium',
      reasoningVerbosity: 'high',
      reasoningSummaryType: 'detailed',
      systemPromptMode: 'ARC',
      previousResponseId: 'resp-123',
      reasoningSummary: 'detailed',
      maxOutputTokens: 2048,
      store: true,
    });

    const storedPayload = analysisStreamService.getPendingPayload(json.sessionId);
    expect(storedPayload).toBeTruthy();
    expect(typeof storedPayload?.createdAt).toBe('number');
    expect(typeof storedPayload?.expiresAt).toBe('number');
    if (storedPayload?.createdAt && storedPayload?.expiresAt) {
      const ttlWindow = storedPayload.expiresAt - storedPayload.createdAt;
      expect(ttlWindow).toBeLessThanOrEqual(PENDING_SESSION_TTL_SECONDS * 1000);
      expect(ttlWindow).toBeGreaterThanOrEqual(PENDING_SESSION_TTL_SECONDS * 1000 - 1000);
    }

    analysisStreamService.clearPendingPayload(json.sessionId);
  } finally {
    analysisStreamService.savePendingPayload = originalSave;
  }
});

test('prepareAnalysisStream rejects invalid payloads', async () => {
  let saveCalled = false;
  const originalSave = analysisStreamService.savePendingPayload;

  analysisStreamService.savePendingPayload = ((payload, ttlMs) => {
    saveCalled = true;
    return originalSave.call(analysisStreamService, payload, ttlMs);
  }) as typeof analysisStreamService.savePendingPayload;

  try {
    const { res, getStatus, getJson } = createMockResponse();

    await streamController.prepareAnalysisStream(
      {
        body: {
          modelKey: 'gpt-5-mini',
        },
      } as any,
      res,
    );

    expect(getStatus()).toBe(422);
    const json = getJson<{ error: string; details: string[] }>();
    expect(json.error).toBe('Invalid stream request payload.');
    expect(json.details.includes('taskId is required and must be a non-empty string.')).toBe(true);
    expect(saveCalled).toBe(false);
  } finally {
    analysisStreamService.savePendingPayload = originalSave;
  }
});

test('pending payloads expire automatically when handshake is abandoned', async () => {
  const shortLivedSession = analysisStreamService.savePendingPayload(
    {
      taskId: 'abandoned-task',
      modelKey: 'gpt-5-mini',
    },
    15,
  );

  expect(analysisStreamService.getPendingPayload(shortLivedSession)).toBeTruthy();
  const shortLivedPayload = analysisStreamService.getPendingPayload(shortLivedSession);
  expect(typeof shortLivedPayload?.expiresAt).toBe('number');
  if (shortLivedPayload?.expiresAt && shortLivedPayload?.createdAt) {
    const ttlWindow = shortLivedPayload.expiresAt - shortLivedPayload.createdAt;
    expect(ttlWindow).toBeLessThanOrEqual(15);
    expect(ttlWindow).toBeGreaterThanOrEqual(0);
  }

  await new Promise((resolve) => setTimeout(resolve, 40));

  expect(analysisStreamService.getPendingPayload(shortLivedSession)).toBeUndefined();
});
