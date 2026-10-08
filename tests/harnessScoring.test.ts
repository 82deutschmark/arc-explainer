/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Regression tests for authoritative task denominators, missing/partial/duplicate
 *          stored attempts, complementary test answers, and recorded cost coverage.
 * SRP/DRY check: Pass - Focused on pure scoring helpers.
 */

/**
 * Author: Cascade
 * Date: 2025-12-16T00:00:00Z
 * PURPOSE: Unit tests for ARC-AGI harness scoring utilities.
 *          Verifies that dataset score is the average of puzzle scores (each puzzle weighted equally)
 *          and highlights how that differs from pair-weighted aggregation.
 * SRP/DRY check: Pass - Focused tests for pure scoring functions.
 */

import { test } from 'vitest';
import { strict as assert } from 'node:assert';

import { computeDatasetUnionScores, computePuzzleUnionScore, computeStoredAttemptUnion, extractStoredPairResults } from '../server/utils/harnessScoring.ts';

test('computeDatasetUnionScores: harness score differs from pair-weighted score when puzzles have different pair counts', () => {
  const result = computeDatasetUnionScores([
    // Puzzle A: 3 pairs, union solves 2/3
    { attempt1Pairs: [true, false, true], attempt2Pairs: [false, false, false] },
    // Puzzle B: 1 pair, union solves 1/1
    { attempt1Pairs: [false], attempt2Pairs: [true] },
    // Puzzle C: 2 pairs, union solves 0/2
    { attempt1Pairs: [false, false], attempt2Pairs: [false, false] },
  ]);

  // Harness: avg((2/3), (1/1), (0/2)) = 0.555555...
  assert.ok(Math.abs(result.harnessScore - (5 / 9)) < 1e-10);

  // Pair-weighted: 3 solved pairs / 6 total pairs = 0.5
  assert.ok(Math.abs(result.pairWeightedAccuracy - 0.5) < 1e-10);
});

test('computeDatasetUnionScores: harness score equals pair-weighted score when all puzzles have the same pair count', () => {
  const result = computeDatasetUnionScores([
    // 2 pairs each
    { attempt1Pairs: [true, false], attempt2Pairs: [false, false] }, // 1/2
    { attempt1Pairs: [true, true], attempt2Pairs: [false, false] }, // 2/2
    { attempt1Pairs: [false, false], attempt2Pairs: [false, true] }, // 1/2
  ]);

  const expectedHarness = ((1 / 2) + (2 / 2) + (1 / 2)) / 3;
  assert.ok(Math.abs(result.harnessScore - expectedHarness) < 1e-10);

  const expectedPairWeighted = (1 + 2 + 1) / (2 + 2 + 2);
  assert.ok(Math.abs(result.pairWeightedAccuracy - expectedPairWeighted) < 1e-10);

  assert.ok(Math.abs(result.harnessScore - result.pairWeightedAccuracy) < 1e-10);
});

const attemptModels: [string, string] = ['example-attempt1', 'example-attempt2'];

test('authoritative test count keeps missing pairs unsolved and ignores extra submitted pairs', () => {
  const partial = computePuzzleUnionScore({ numPairs: 3, attempt1Pairs: [true], attempt2Pairs: [] });
  assert.equal(partial.puzzleScore, 1 / 3);
  assert.equal(partial.fullySolved, false);
  const extra = computePuzzleUnionScore({ numPairs: 1, attempt1Pairs: [false, true, true], attempt2Pairs: [false] });
  assert.equal(extra.solvedPairs, 0);
  assert.equal(extra.numPairs, 1);
  assert.throws(() => computePuzzleUnionScore({ numPairs: 0, attempt1Pairs: [], attempt2Pairs: [] }));
});

test('full dataset includes missing tasks and failed single-test flags', () => {
  const counts = new Map([['solved', 1], ['failed', 1], ['missing', 3]]);
  const result = computeStoredAttemptUnion(counts, attemptModels, [
    { puzzle_id: 'solved', model_name: attemptModels[0], is_prediction_correct: true, multi_test_all_correct: null },
    // SQL false OR NULL used to turn this into null and skip the task entirely.
    { puzzle_id: 'failed', model_name: attemptModels[0], is_prediction_correct: false, multi_test_all_correct: null },
  ]);
  assert.equal(result.harnessScore, 1 / 3);
  assert.equal(result.puzzlesCounted, 3);
  assert.equal(result.attemptedPuzzleCount, 2);
  assert.equal(result.pairWeightedCorrectPairs, 1);
  assert.equal(result.pairWeightedTotalPairs, 5);
  assert.deepEqual(result.puzzlesFullySolvedIds, ['solved']);
});

test('complementary partial attempts solve one task without counting extra or duplicate indices', () => {
  const counts = new Map([['multi', 3]]);
  const result = computeStoredAttemptUnion(counts, attemptModels, [
    { puzzle_id: 'multi', model_name: attemptModels[0], multi_test_results: [
      { index: 2, isPredictionCorrect: true }, { index: 0, isPredictionCorrect: true },
      { index: 0, isPredictionCorrect: true }, { index: 10, isPredictionCorrect: true },
    ] },
    { puzzle_id: 'multi', model_name: attemptModels[1], multi_test_results: JSON.stringify([
      { index: 1, isPredictionCorrect: true },
    ]) },
  ]);
  assert.equal(result.harnessScore, 1);
  assert.equal(result.pairWeightedCorrectPairs, 3);
  assert.equal(result.puzzlesFullySolved, 1);
  assert.deepEqual(result.puzzlesFullySolvedIds, ['multi']);
});

test('malformed flags remain unsolved; single-test fallback does not mark every test correct', () => {
  const row = { puzzle_id: 'multi', model_name: attemptModels[0] };
  assert.deepEqual(extractStoredPairResults({ ...row, multi_test_results: '{bad json' }, 3), [false, false, false]);
  assert.deepEqual(extractStoredPairResults({ ...row, is_prediction_correct: true }, 3), [true, false, false]);
  assert.deepEqual(extractStoredPairResults({ ...row, multi_test_all_correct: true }, 3), [true, true, true]);
  assert.deepEqual(extractStoredPairResults({ ...row, multi_test_results: [{ index: -1, isPredictionCorrect: true }] }, 3), [false, false, false]);
});

test('only latest rows of two distinct attempts affect scores and combined costs', () => {
  const rows = [
    { id: 1, puzzle_id: 'one', model_name: attemptModels[0], created_at: '2026-10-01', is_prediction_correct: true, estimated_cost: 100 },
    { id: 2, puzzle_id: 'one', model_name: attemptModels[0], created_at: '2026-10-02', is_prediction_correct: false, estimated_cost: '2', api_processing_time_ms: 1000 },
    { id: 3, puzzle_id: 'one', model_name: attemptModels[1], created_at: '2026-10-02', is_prediction_correct: true, estimated_cost: '3', api_processing_time_ms: 3000 },
    { id: 4, puzzle_id: 'one', model_name: 'example-attempt3', is_prediction_correct: true, estimated_cost: 500 },
    { id: 5, puzzle_id: 'other-dataset', model_name: attemptModels[0], is_prediction_correct: true, estimated_cost: 500 },
  ];
  const result = computeStoredAttemptUnion(new Map([['one', 1]]), attemptModels, rows);
  assert.equal(result.harnessScore, 1);
  assert.deepEqual(result.costMetrics, {
    totalAttempts: 2, costedAttempts: 2, timedAttempts: 2,
    recordedTotalCost: 5, avgRecordedCostPerAttempt: 2.5,
    costPerSolvedPuzzle: 5, avgRecordedTimeMs: 2000,
  });
  const failedLatest = computeStoredAttemptUnion(new Map([['one', 1]]), attemptModels, [
    ...rows, { id: 6, puzzle_id: 'one', model_name: attemptModels[1], created_at: '2026-10-02', is_prediction_correct: false, estimated_cost: 4 },
  ]);
  assert.equal(failedLatest.harnessScore, 0);
  assert.equal(failedLatest.costMetrics.recordedTotalCost, 6);
  assert.equal(failedLatest.costMetrics.costPerSolvedPuzzle, null);
  assert.throws(() => computeStoredAttemptUnion(new Map([['one', 1]]), [attemptModels[0], attemptModels[0]], rows));
});

test('missing cost metadata is unknown, while recorded zero is a real zero', () => {
  const result = computeStoredAttemptUnion(new Map([['one', 1]]), attemptModels, [
    { puzzle_id: 'one', model_name: attemptModels[0], is_prediction_correct: true, estimated_cost: 0, api_processing_time_ms: 0 },
    { puzzle_id: 'one', model_name: attemptModels[1], is_prediction_correct: false, estimated_cost: null },
  ]);
  assert.equal(result.costMetrics.recordedTotalCost, 0);
  assert.equal(result.costMetrics.costedAttempts, 1);
  assert.equal(result.costMetrics.totalAttempts, 2);
  assert.equal(result.costMetrics.costPerSolvedPuzzle, null);
  assert.equal(result.costMetrics.avgRecordedTimeMs, 0);
  const missing = computeStoredAttemptUnion(new Map([['one', 1]]), attemptModels, []);
  assert.equal(missing.costMetrics.recordedTotalCost, null);
  assert.equal(missing.costMetrics.avgRecordedTimeMs, null);
});
