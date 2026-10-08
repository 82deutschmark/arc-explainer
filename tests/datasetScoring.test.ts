/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Validate the authoritative scoring accessor against the shipped ARC2 evaluation tasks.
 * SRP/DRY check: Pass — exercises real dataset files and the shared scorer without a database.
 */
import { test, expect } from 'vitest';
import { ModelDatasetRepository } from '../server/repositories/ModelDatasetRepository';
import { computeStoredAttemptUnion } from '../server/utils/harnessScoring';
import { MetricsRepository } from '../server/repositories/MetricsRepository';
import { AccuracyRepository } from '../server/repositories/AccuracyRepository';

test('ARC2 evaluation scoring includes all 120 real tasks and 167 test cases', () => {
  const repo = new ModelDatasetRepository();
  const counts = repo.getDatasetTestPairCounts('evaluation2');
  expect(counts.size).toBe(120);
  expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(167);
  const singleTask = [...counts].find(([, count]) => count === 1)![0];
  const score = computeStoredAttemptUnion(counts, ['one-attempt1', 'one-attempt2'], [{
    puzzle_id: singleTask, model_name: 'one-attempt1', is_prediction_correct: true,
  }]);
  expect(score.harnessScore).toBeCloseTo(1 / 120, 12);
  expect(score.pairWeightedTotalPairs).toBe(167);
  expect(score.puzzlesCounted).toBe(120);
  expect(score.puzzlesFullySolved).toBe(1);
});

test('comparison and accuracy endpoints use the same full-dataset score and two-attempt costs', async () => {
  const counts = new ModelDatasetRepository().getDatasetTestPairCounts('evaluation2');
  const puzzleId = [...counts].find(([, count]) => count === 2)![0];
  const rows = [
    { id: 1, puzzle_id: puzzleId, model_name: 'example-attempt1', is_correct: false,
      is_prediction_correct: null, multi_test_all_correct: false,
      multi_test_results: [{ index: 0, isPredictionCorrect: true }], estimated_cost: 2 },
    { id: 2, puzzle_id: puzzleId, model_name: 'example-attempt2', is_correct: false,
      is_prediction_correct: null, multi_test_all_correct: false,
      multi_test_results: [{ index: 1, isPredictionCorrect: true }], estimated_cost: 3 },
  ];
  // Replace only the database boundary; production repository orchestration and
  // authoritative dataset reads both execute. These fixtures represent partial imports.
  class ComparisonFixture extends MetricsRepository {
    protected isConnected() { return true; }
    protected async query<T = any>() { return { rows: rows as T[], rowCount: rows.length }; }
  }
  class AccuracyFixture extends AccuracyRepository {
    protected isConnected() { return true; }
    protected async query<T = any>() { return { rows: rows as T[], rowCount: rows.length }; }
  }
  const comparison = await new ComparisonFixture().getModelComparison(['example-attempt1', 'example-attempt2'], 'evaluation2');
  const accuracy = await new AccuracyFixture().getHarnessAlignedAccuracyStats('example', 'evaluation2');
  const union = comparison.summary.attemptUnionStats[0];
  expect(union.unionAccuracyPercentage).toBe(0.83);
  expect(union.puzzlesCounted).toBe(120);
  expect(union.totalTestPairs).toBe(167);
  expect(union.unionCorrectCount).toBe(2);
  expect(union.puzzlesFullySolvedIds).toEqual([puzzleId]);
  expect(union.costMetrics?.recordedTotalCost).toBe(5);
  expect(union.costMetrics?.costPerSolvedPuzzle).toBe(5);
  expect(accuracy.harnessScorePercentage).toBe(union.unionAccuracyPercentage);
  expect(accuracy.puzzlesCounted).toBe(union.puzzlesCounted);
  expect(accuracy.pairWeightedTotalPairs).toBe(union.totalTestPairs);
  expect(accuracy.pairWeightedCorrectPairs).toBe(union.unionCorrectCount);
});
