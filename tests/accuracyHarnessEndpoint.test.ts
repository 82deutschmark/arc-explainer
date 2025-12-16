/**
 * Author: Cascade
 * Date: 2025-12-16T00:00:00Z
 * PURPOSE: Unit tests for the public GET /api/accuracy/harness controller.
 *          Validates query parsing and verifies we delegate to AccuracyRepository.
 * SRP/DRY check: Pass - Focused controller tests; avoids DB and HTTP server setup.
 */

import test from 'node:test';
import { strict as assert } from 'node:assert';

import type { Request, Response } from 'express';

import { getHarnessAlignedAccuracy } from '../server/controllers/accuracyController.ts';
import { repositoryService } from '../server/repositories/RepositoryService.ts';

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

test('GET /api/accuracy/harness returns 400 when baseModelName is missing', async () => {
  const { res, getStatus, getJson } = createMockResponse();

  const req = {
    query: {},
  } as unknown as Request;

  await getHarnessAlignedAccuracy(req, res);

  assert.equal(getStatus(), 400);
  assert.deepEqual(getJson<{ success: boolean; message: string }>(), {
    success: false,
    message: 'baseModelName required',
  });
});

test('GET /api/accuracy/harness delegates to AccuracyRepository with default dataset when not provided', async (t) => {
  const originalAccuracy = (repositoryService as any).accuracyRepository;

  const calls: Array<{ baseModelName: string; dataset: string }> = [];

  (repositoryService as any).accuracyRepository = {
    getHarnessAlignedAccuracyStats: async (baseModelName: string, dataset: string) => {
      calls.push({ baseModelName, dataset });
      return {
        baseModelName,
        attempt1ModelName: `${baseModelName}-attempt1`,
        attempt2ModelName: `${baseModelName}-attempt2`,
        dataset,
        puzzlesCounted: 1,
        puzzlesFullySolved: 0,
        harnessScore: 0.5,
        harnessScorePercentage: 50,
        pairWeightedCorrectPairs: 1,
        pairWeightedTotalPairs: 2,
        pairWeightedAccuracy: 0.5,
        pairWeightedAccuracyPercentage: 50,
      };
    },
  };

  t.after(() => {
    (repositoryService as any).accuracyRepository = originalAccuracy;
  });

  const { res, getStatus, getJson } = createMockResponse();

  const req = {
    query: {
      baseModelName: 'Example_Model',
    },
  } as unknown as Request;

  await getHarnessAlignedAccuracy(req, res);

  assert.equal(getStatus(), 200);

  const payload = getJson<{ success: boolean; data: any }>();
  assert.equal(payload.success, true);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    baseModelName: 'Example_Model',
    dataset: 'evaluation2',
  });

  assert.equal(payload.data.baseModelName, 'Example_Model');
  assert.equal(payload.data.dataset, 'evaluation2');
});

test('GET /api/accuracy/harness uses explicit dataset when provided', async (t) => {
  const originalAccuracy = (repositoryService as any).accuracyRepository;

  const calls: Array<{ baseModelName: string; dataset: string }> = [];

  (repositoryService as any).accuracyRepository = {
    getHarnessAlignedAccuracyStats: async (baseModelName: string, dataset: string) => {
      calls.push({ baseModelName, dataset });
      return {
        baseModelName,
        attempt1ModelName: `${baseModelName}-attempt1`,
        attempt2ModelName: `${baseModelName}-attempt2`,
        dataset,
        puzzlesCounted: 0,
        puzzlesFullySolved: 0,
        harnessScore: 0,
        harnessScorePercentage: 0,
        pairWeightedCorrectPairs: 0,
        pairWeightedTotalPairs: 0,
        pairWeightedAccuracy: 0,
        pairWeightedAccuracyPercentage: 0,
      };
    },
  };

  t.after(() => {
    (repositoryService as any).accuracyRepository = originalAccuracy;
  });

  const { res, getStatus, getJson } = createMockResponse();

  const req = {
    query: {
      baseModelName: 'Example_Model',
      dataset: 'training2',
    },
  } as unknown as Request;

  await getHarnessAlignedAccuracy(req, res);

  assert.equal(getStatus(), 200);

  const payload = getJson<{ success: boolean; data: any }>();
  assert.equal(payload.success, true);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    baseModelName: 'Example_Model',
    dataset: 'training2',
  });

  assert.equal(payload.data.dataset, 'training2');
});
