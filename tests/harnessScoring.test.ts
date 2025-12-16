/**
 * Author: Cascade
 * Date: 2025-12-16T00:00:00Z
 * PURPOSE: Unit tests for ARC-AGI harness scoring utilities.
 *          Verifies that dataset score is the average of puzzle scores (each puzzle weighted equally)
 *          and highlights how that differs from pair-weighted aggregation.
 * SRP/DRY check: Pass - Focused tests for pure scoring functions.
 */

import test from 'node:test';
import { strict as assert } from 'node:assert';

import { computeDatasetUnionScores } from '../server/utils/harnessScoring.ts';

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
