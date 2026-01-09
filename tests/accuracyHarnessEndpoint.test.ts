/**
 * Author: GPT-5 Codex
 * Date: 2026-01-08T20:25:33-05:00
 * PURPOSE: Unit tests for GET /api/accuracy/harness query validation and repository
 *          delegation without spinning up HTTP or database connections.
 * SRP/DRY check: Pass - Focused controller behavior only.
 */

import { test, expect } from 'vitest';

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

  expect(getStatus()).toBe(400);
  expect(getJson<{ success: boolean; message: string }>()).toEqual({
    success: false,
    message: 'baseModelName required',
  });
});

test('GET /api/accuracy/harness delegates to AccuracyRepository with default dataset when not provided', async () => {
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

  try {
    const { res, getStatus, getJson } = createMockResponse();

    const req = {
      query: {
        baseModelName: 'Example_Model',
      },
    } as unknown as Request;

    await getHarnessAlignedAccuracy(req, res);

    expect(getStatus()).toBe(200);

    const payload = getJson<{ success: boolean; data: any }>();
    expect(payload.success).toBe(true);

    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({
      baseModelName: 'Example_Model',
      dataset: 'evaluation2',
    });

    expect(payload.data.baseModelName).toBe('Example_Model');
    expect(payload.data.dataset).toBe('evaluation2');
  } finally {
    (repositoryService as any).accuracyRepository = originalAccuracy;
  }
});

test('GET /api/accuracy/harness uses explicit dataset when provided', async () => {
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

  try {
    const { res, getStatus, getJson } = createMockResponse();

    const req = {
      query: {
        baseModelName: 'Example_Model',
        dataset: 'training2',
      },
    } as unknown as Request;

    await getHarnessAlignedAccuracy(req, res);

    expect(getStatus()).toBe(200);

    const payload = getJson<{ success: boolean; data: any }>();
    expect(payload.success).toBe(true);

    expect(calls.length).toBe(1);
    expect(calls[0]).toEqual({
      baseModelName: 'Example_Model',
      dataset: 'training2',
    });

    expect(payload.data.dataset).toBe('training2');
  } finally {
    (repositoryService as any).accuracyRepository = originalAccuracy;
  }
});
