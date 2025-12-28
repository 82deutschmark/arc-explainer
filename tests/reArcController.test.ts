/**
 * RE-ARC Controller Endpoint Tests
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: Integration tests for RE-ARC HTTP endpoints.
 *          Tests generation streaming download and verification SSE streaming.
 * SRP/DRY check: Pass - Focused tests for reArcController endpoints.
 *
 * Note: These tests use RE_ARC_DEV_MODE=true for faster execution with fewer tasks.
 */

import test from 'node:test';
import { strict as assert } from 'node:assert';
import type { Request, Response } from 'express';
import { generate, verify } from '../server/controllers/reArcController.ts';
import type { ARCSubmission } from '../shared/types.ts';
import { generateDataset } from '../server/services/reArc/reArcService.ts';

// Enable dev mode for all tests (faster generation with fewer tasks)
process.env.RE_ARC_DEV_MODE = 'true';

// ============================================================================
// Mock Response Helpers
// ============================================================================

/**
 * Create a mock Express Response for testing
 */
function createMockResponse(): Response & {
  statusCode: number;
  headers: Record<string, string>;
  chunks: Buffer[];
  ended: boolean;
  writableEnded: boolean;
} {
  const chunks: Buffer[] = [];
  const headers: Record<string, string> = {};
  const listeners: Map<string, Function[]> = new Map();

  const mock: any = {
    statusCode: 200,
    headers,
    chunks,
    ended: false,
    writableEnded: false,
    writable: true,
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
      return mock;
    },
    flushHeaders() {},
    write(chunk: any, encoding?: any, callback?: any) {
      if (mock.ended) return false;
      chunks.push(Buffer.from(chunk));
      if (typeof encoding === 'function') {
        encoding();
      } else if (typeof callback === 'function') {
        callback();
      }
      return true;
    },
    end(chunk?: any, encoding?: any, callback?: any) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      mock.ended = true;
      mock.writableEnded = true;
      mock.writable = false;

      // Call finish listeners
      const finishListeners = listeners.get('finish') || [];
      for (const listener of finishListeners) {
        listener();
      }

      if (typeof encoding === 'function') {
        encoding();
      } else if (typeof callback === 'function') {
        callback();
      }
      return mock;
    },
    status(code: number) {
      mock.statusCode = code;
      return mock;
    },
    json(data: any) {
      mock.setHeader('content-type', 'application/json');
      mock.write(JSON.stringify(data));
      mock.end();
      return mock;
    },
    on(event: string, handler: Function) {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(handler);
      return mock;
    },
    once(event: string, handler: Function) {
      const wrapper = (...args: any[]) => {
        handler(...args);
        mock.removeListener(event, wrapper);
      };
      return mock.on(event, wrapper);
    },
    emit(event: string, ...args: any[]) {
      const eventListeners = listeners.get(event) || [];
      for (const listener of eventListeners) {
        listener(...args);
      }
      return true;
    },
    removeListener(event: string, handler: Function) {
      const eventListeners = listeners.get(event) || [];
      const index = eventListeners.indexOf(handler);
      if (index >= 0) {
        eventListeners.splice(index, 1);
      }
      return mock;
    },
  };

  return mock;
}

// ============================================================================
// Generation Endpoint Tests
// ============================================================================

test('generate: sets correct download headers', async () => {
  const req = {} as Request;
  const res = createMockResponse();

  // Start generation without awaiting - just verify it starts
  generate(req, res);

  // Wait a bit for headers to be set
  await new Promise(resolve => setTimeout(resolve, 100));

  assert.strictEqual(res.headers['content-type'], 'application/json');
  assert.strictEqual(res.headers['transfer-encoding'], 'chunked');
  assert.strictEqual(res.headers['content-encoding'], 'gzip');
  assert.strictEqual(res.headers['cache-control'], 'no-cache, no-store');
  assert.ok(res.headers['content-disposition']?.startsWith('attachment; filename="re-arc_test_challenges-'));
});

test('generate: controller function exists and is callable', async () => {
  // Simple smoke test - just verify the function is exported and callable
  assert.strictEqual(typeof generate, 'function', 'generate should be a function');
});

// ============================================================================
// Verification Endpoint Tests
// ============================================================================

test('verify: rejects empty submission', async () => {
  const req = { body: {} } as Request;
  const res = createMockResponse();

  await verify(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.ended);
});

test('verify: rejects malformed submission (non-array attempts)', async () => {
  const req = {
    body: {
      '12345678': 'invalid',
    },
  } as Request;
  const res = createMockResponse();

  await verify(req, res);

  assert.strictEqual(res.statusCode, 400);
});

test('verify: rejects submission with missing attempt_1/attempt_2', async () => {
  const req = {
    body: {
      '12345678': [{ invalid: true }],
    },
  } as Request;
  const res = createMockResponse();

  await verify(req, res);

  assert.strictEqual(res.statusCode, 400);
});

test('verify: rejects submission with non-2D grid arrays', async () => {
  const req = {
    body: {
      '12345678': [
        {
          attempt_1: ['not', 'a', '2d', 'array'], // Invalid - array of strings instead of array of arrays
          attempt_2: [[0]],
        },
      ],
    },
  } as Request;
  const res = createMockResponse();

  await verify(req, res);

  assert.strictEqual(res.statusCode, 400);
  const responseData = JSON.parse(Buffer.concat(res.chunks).toString());
  assert.ok(responseData.message.includes('must be an array'), 'Should mention array validation in error');
});

test('verify: streams SSE events for valid submission', async () => {
  // Generate a small dataset
  const seed = 99999;
  const tasks: any[] = [];
  const taskIds: string[] = [];

  for await (const { taskId, task } of generateDataset(seed)) {
    tasks.push(task);
    taskIds.push(taskId);
  }

  // Build perfect submission (all correct answers)
  const submission: ARCSubmission = {};
  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];
    const task = tasks[i];

    submission[taskId] = task.test.map((testPair: any) => ({
      attempt_1: testPair.output,
      attempt_2: testPair.output,
    }));
  }

  const req = { body: submission } as Request;
  const res = createMockResponse();

  await verify(req, res);

  assert.ok(res.ended, 'Response should be ended');
  assert.strictEqual(res.headers['content-type'], 'text/event-stream');
  assert.strictEqual(res.headers['cache-control'], 'no-cache');

  // Parse SSE events from chunks
  const sseText = Buffer.concat(res.chunks).toString('utf-8');
  const events = sseText
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event:'));
      const dataLine = lines.find((l) => l.startsWith('data:'));

      if (!eventLine || !dataLine) return null;

      const event = eventLine.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      return { event, data };
    })
    .filter(Boolean);

  // Verify progress events
  const progressEvents = events.filter((e) => e?.event === 'progress');
  assert.ok(progressEvents.length > 0, 'Should have progress events');

  // Verify progress is incremental
  for (let i = 0; i < progressEvents.length; i++) {
    const { current, total } = progressEvents[i]!.data;
    assert.ok(current >= 1 && current <= total, `Progress ${i}: current=${current}, total=${total}`);
  }

  // Verify completion event
  const completeEvents = events.filter((e) => e?.event === 'complete');
  assert.strictEqual(completeEvents.length, 1, 'Should have exactly one complete event');

  const completeData = completeEvents[0]!.data;
  assert.strictEqual(completeData.type, 'score', 'Should complete with score');
  assert.strictEqual(completeData.score, 1.0, 'Perfect submission should score 1.0');
});

test('verify: returns mismatches for incorrect test pair count', async () => {
  // Generate a small dataset
  const seed = 88888;
  const tasks: any[] = [];
  const taskIds: string[] = [];

  for await (const { taskId, task } of generateDataset(seed)) {
    tasks.push(task);
    taskIds.push(taskId);
  }

  // Build submission with wrong number of test pairs for first task
  const submission: ARCSubmission = {};
  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];
    const task = tasks[i];

    if (i === 0) {
      // Wrong number of pairs for first task
      submission[taskId] = [
        {
          attempt_1: [[0]],
          attempt_2: [[0]],
        },
      ];
    } else {
      // Correct for other tasks
      submission[taskId] = task.test.map((testPair: any) => ({
        attempt_1: testPair.output,
        attempt_2: testPair.output,
      }));
    }
  }

  const req = { body: submission } as Request;
  const res = createMockResponse();

  await verify(req, res);

  // Parse SSE events
  const sseText = Buffer.concat(res.chunks).toString('utf-8');
  const events = sseText
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event:'));
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (!eventLine || !dataLine) return null;
      return {
        event: eventLine.slice(6).trim(),
        data: JSON.parse(dataLine.slice(5).trim()),
      };
    })
    .filter(Boolean);

  const completeEvents = events.filter((e) => e?.event === 'complete');
  assert.strictEqual(completeEvents.length, 1);

  const completeData = completeEvents[0]!.data;
  assert.strictEqual(completeData.type, 'mismatches', 'Should complete with mismatches');
  assert.ok(Array.isArray(completeData.mismatches), 'Should have mismatches array');
  assert.ok(completeData.mismatches.length >= 1, 'Should have at least one mismatch');

  // Verify mismatch structure (excludes taskIndex per plan)
  const mismatch = completeData.mismatches[0];
  assert.ok(mismatch.taskId, 'Mismatch should have taskId');
  assert.strictEqual(typeof mismatch.expectedPairs, 'number', 'Should have expectedPairs');
  assert.strictEqual(typeof mismatch.submittedPairs, 'number', 'Should have submittedPairs');
  assert.strictEqual(mismatch.taskIndex, undefined, 'Should not include taskIndex in event data');
});

test('verify: returns malformed for invalid task IDs', async () => {
  const submission: ARCSubmission = {
    '1234abcd': [
      {
        attempt_1: [[0]],
        attempt_2: [[0]],
      },
    ],
    'deadbeef': [
      {
        attempt_1: [[0]],
        attempt_2: [[0]],
      },
    ],
  };

  const req = { body: submission } as Request;
  const res = createMockResponse();

  await verify(req, res);

  // Parse SSE events
  const sseText = Buffer.concat(res.chunks).toString('utf-8');
  const events = sseText
    .split('\n\n')
    .filter((block) => block.trim())
    .map((block) => {
      const lines = block.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event:'));
      const dataLine = lines.find((l) => l.startsWith('data:'));
      if (!eventLine || !dataLine) return null;
      return {
        event: eventLine.slice(6).trim(),
        data: JSON.parse(dataLine.slice(5).trim()),
      };
    })
    .filter(Boolean);

  const completeEvents = events.filter((e) => e?.event === 'complete');
  assert.strictEqual(completeEvents.length, 1);

  const completeData = completeEvents[0]!.data;
  assert.strictEqual(completeData.type, 'malformed', 'Should complete with malformed');
});
