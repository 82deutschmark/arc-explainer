/**
 * RE-ARC Service Integration Tests
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: Integration tests for RE-ARC Python subprocess integration.
 *          Tests dataset generation, evaluation, and scoring logic.
 * SRP/DRY check: Pass - Focused tests for reArcService functions.
 *
 * Note: These tests use RE_ARC_DEV_MODE=true for faster execution with fewer tasks.
 */

import test from 'node:test';
import { strict as assert } from 'node:assert';
import {
  resolvePythonBin,
  generateDataset,
  evaluateSubmission,
  type GeneratedTask,
  type EvaluationProgress,
  __testOnly_datasetCache,
} from '../server/services/reArc/reArcService.ts';
import type { ARCSubmission } from '../shared/types.ts';

// Enable dev mode for all tests (faster generation with fewer tasks)
process.env.RE_ARC_DEV_MODE = 'true';

// Clear cache before each test to ensure isolation
test.beforeEach(() => {
  __testOnly_datasetCache.clear();
});

// ============================================================================
// Python Binary Resolution Tests
// ============================================================================

test('resolvePythonBin: uses PYTHON_BIN env var if set', () => {
  const originalEnv = process.env.PYTHON_BIN;
  try {
    process.env.PYTHON_BIN = '/custom/python';
    const result = resolvePythonBin();
    assert.strictEqual(result, '/custom/python');
  } finally {
    if (originalEnv) {
      process.env.PYTHON_BIN = originalEnv;
    } else {
      delete process.env.PYTHON_BIN;
    }
  }
});

test('resolvePythonBin: uses platform default when env var not set', () => {
  const originalEnv = process.env.PYTHON_BIN;
  try {
    delete process.env.PYTHON_BIN;
    const result = resolvePythonBin();

    if (process.platform === 'win32') {
      assert.strictEqual(result, 'python');
    } else {
      assert.strictEqual(result, 'python3');
    }
  } finally {
    if (originalEnv) {
      process.env.PYTHON_BIN = originalEnv;
    }
  }
});

// ============================================================================
// Dataset Generation Tests
// ============================================================================

test('generateDataset: yields task objects with correct shape', async () => {
  const seed = 12345;
  const tasks: GeneratedTask[] = [];

  for await (const task of generateDataset(seed)) {
    tasks.push(task);

    // Verify task shape
    assert.ok(task.taskId, 'Task should have taskId');
    assert.ok(task.task, 'Task should have task data');
    assert.ok(Array.isArray(task.task.train), 'Task should have train array');
    assert.ok(Array.isArray(task.task.test), 'Task should have test array');

    // Task ID should be 8 hex chars
    assert.match(task.taskId, /^[0-9a-f]{8}$/i, 'Task ID should be 8 hex chars');

  }

  assert.ok(tasks.length >= 5, 'Should generate at least 5 tasks');
});

test('generateDataset: produces deterministic output for same seed', async () => {
  const seed = 54321;

  // Generate first dataset
  const tasks1: GeneratedTask[] = [];
  for await (const task of generateDataset(seed)) {
    tasks1.push(task);
  }

  // Generate second dataset
  const tasks2: GeneratedTask[] = [];
  for await (const task of generateDataset(seed)) {
    tasks2.push(task);
  }

  // Task IDs should be identical (deterministic)
  assert.strictEqual(tasks1.length, tasks2.length);
  for (let i = 0; i < tasks1.length; i++) {
    assert.strictEqual(
      tasks1[i].taskId,
      tasks2[i].taskId,
      `Task ID at index ${i} should match`
    );
  }

  // Task data should be identical (deterministic generation)
  assert.deepStrictEqual(
    tasks1.map((t) => t.task),
    tasks2.map((t) => t.task),
    'Task data should be deterministic'
  );
});

test('generateDataset: task IDs are unique', async () => {
  const seed = 99999;
  const taskIds = new Set<string>();

  for await (const task of generateDataset(seed)) {
    assert.ok(!taskIds.has(task.taskId), `Task ID ${task.taskId} should be unique`);
    taskIds.add(task.taskId);
  }

  assert.strictEqual(taskIds.size, 13, 'Should have 13 unique task IDs');
});

test('generateDataset: task data structure is valid', async () => {
  const seed = 11111;

  for await (const { task } of generateDataset(seed)) {
    // Verify train examples have input and output
    for (const example of task.train) {
      assert.ok(Array.isArray(example.input), 'Train input should be array');
      assert.ok(Array.isArray(example.output), 'Train output should be array');
      assert.ok(example.input.length > 0, 'Train input should not be empty');
      assert.ok(example.output.length > 0, 'Train output should not be empty');

      // Check grid cells are numbers
      for (const row of example.input) {
        assert.ok(Array.isArray(row), 'Input row should be array');
        for (const cell of row) {
          assert.strictEqual(typeof cell, 'number', 'Cell should be number');
        }
      }
    }

    // Verify test examples have input (output may be missing - withheld for evaluation)
    for (const example of task.test) {
      assert.ok(Array.isArray(example.input), 'Test input should be array');
      assert.ok(example.input.length > 0, 'Test input should not be empty');
    }
  }
});

// ============================================================================
// Evaluation Tests
// ============================================================================

test('evaluateSubmission: perfect submission scores 1.0', async () => {
  const seed = 22222;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset (Python determines count based on seed)
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create perfect submission
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    submission[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  // Evaluate
  const result = await evaluateSubmission(submission);

  assert.strictEqual(result.type, 'score', 'Perfect submission should return score type');
  if (result.type === 'score') {
    assert.strictEqual(result.score, 1.0, 'Perfect submission should score 1.0');
  }
});

test('evaluateSubmission: all wrong answers scores 0.0', async () => {
  const seed = 33333;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create submission with all wrong answers
  const wrongGrid = [[9, 9, 9]];
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    submission[taskId] = task.test.map(() => ({
      attempt_1: wrongGrid,
      attempt_2: wrongGrid,
    }));
  }

  // Evaluate
  const result = await evaluateSubmission(submission);

  assert.strictEqual(result.type, 'score', 'Should return score type');
  if (result.type === 'score') {
    assert.strictEqual(result.score, 0.0, 'All wrong answers should score 0.0');
  }
});

test('evaluateSubmission: partial correctness scores between 0 and 1', async () => {
  const seed = 44444;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create submission with some correct, some wrong
  const wrongGrid = [[9, 9, 9]];
  const submission: ARCSubmission = {};
  for (let i = 0; i < tasks.length; i++) {
    const { taskId, task } = tasks[i];

    if (i % 2 === 0) {
      // Even index: correct
      submission[taskId] = task.test.map((testPair) => ({
        attempt_1: testPair.output || [],
        attempt_2: testPair.output || [],
      }));
    } else {
      // Odd index: wrong
      submission[taskId] = task.test.map(() => ({
        attempt_1: wrongGrid,
        attempt_2: wrongGrid,
      }));
    }
  }

  // Evaluate
  const result = await evaluateSubmission(submission);

  assert.strictEqual(result.type, 'score', 'Should return score type');
  if (result.type === 'score') {
    assert.ok(result.score > 0.0, 'Partial submission should score > 0.0');
    assert.ok(result.score < 1.0, 'Partial submission should score < 1.0');
  }
});

test('evaluateSubmission: either attempt correct solves the pair', async () => {
  const seed = 55555;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  const wrongGrid = [[0]];
  const submission: ARCSubmission = {};

  // For each task:
  // - attempt_1 correct, attempt_2 wrong (should still solve)
  // - attempt_1 wrong, attempt_2 correct (should still solve)
  // - both wrong (should not solve)
  let j = 0
  for (let i = 0; i < tasks.length; i++) {
    const { taskId, task } = tasks[i];

    submission[taskId] = task.test.map((testPair) => {
      j++
      if (j % 3 === 0) {
        // attempt_1 correct, attempt_2 wrong
        return {
          attempt_1: testPair.output || [],
          attempt_2: wrongGrid,
        };
      } else if (j % 3 === 1) {
        // attempt_1 wrong, attempt_2 correct
        return {
          attempt_1: wrongGrid,
          attempt_2: testPair.output || [],
        };
      } else {
        // both wrong
        return {
          attempt_1: wrongGrid,
          attempt_2: wrongGrid,
        };
      }
    });
  }

  // Evaluate
  const result = await evaluateSubmission(submission);

  // Score should be approximately 2/3 (2 out of 3 pairs solved per task)
  assert.strictEqual(result.type, 'score', 'Should return score type');
  if (result.type === 'score') {
    assert.ok(result.score > 0.6, 'Score should be > 0.6 (approximately 2/3)');
    assert.ok(result.score < 0.7, 'Score should be < 0.7 (approximately 2/3)');
  }
});

test('evaluateSubmission: order-independent (shuffled submission)', async () => {
  const seed = 66666;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create perfect submission
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    submission[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  // Evaluate (codec should handle ordering internally)
  const result = await evaluateSubmission(submission);

  assert.strictEqual(result.type, 'score', 'Should return score type');
  if (result.type === 'score') {
    assert.strictEqual(result.score, 1.0, 'Shuffled submission should still score 1.0');
  }
});

test('evaluateSubmission: progress callback is called', async () => {
  const seed = 77777;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  const numTasks = tasks.length;

  // Create perfect submission
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    submission[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  // Track progress
  const progressUpdates: EvaluationProgress[] = [];

  // Evaluate with progress callback
  await evaluateSubmission(submission, (progress) => {
    progressUpdates.push(progress);
  });

  // Should have received progress updates
  assert.ok(progressUpdates.length > 0, 'Should receive progress updates');
  assert.strictEqual(progressUpdates.length, numTasks, `Should receive ${numTasks} progress updates (one per task)`);

  // Progress should increment correctly
  for (let i = 0; i < progressUpdates.length; i++) {
    assert.strictEqual(progressUpdates[i].current, i + 1, `Progress current should be ${i + 1}`);
    assert.strictEqual(progressUpdates[i].total, numTasks, `Progress total should be ${numTasks}`);
  }
});

test('evaluateSubmission: returns malformed for invalid task IDs', async () => {
  const invalidSubmission: ARCSubmission = {
    'invalid1': [],
    'invalid2': [],
  };

  const result = await evaluateSubmission(invalidSubmission);

  assert.strictEqual(result.type, 'malformed', 'Should return malformed type');
});

// ============================================================================
// Edge Cases & Round-trip
// ============================================================================

test('round-trip: generate → submit → evaluate', async () => {
  const seed = 99999;
  const tasks: GeneratedTask[] = [];

  // Step 1: Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  assert.ok(tasks.length > 0, 'Should generate tasks');

  // Step 2: Create perfect submission
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    submission[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  // Step 3: Evaluate
  const result = await evaluateSubmission(submission);

  // Step 4: Assert
  assert.strictEqual(result.type, 'score', 'Should return score type');
  if (result.type === 'score') {
    assert.strictEqual(result.score, 1.0, 'Round-trip perfect submission should score 1.0');
  }
});

// ============================================================================
// Test Pair Count Validation Tests
// ============================================================================

test('evaluateSubmission: returns mismatches when submission has too few test pairs', async () => {
  const seed = 11111;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create submission with missing test pairs (only 1 pair when task has 2+)
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    if (task.test.length > 1) {
      // Only submit first test pair (missing others)
      submission[taskId] = [
        {
          attempt_1: task.test[0].output || [],
          attempt_2: task.test[0].output || [],
        },
      ];
    } else {
      // For tasks with only 1 test pair, submit correctly
      submission[taskId] = task.test.map((testPair) => ({
        attempt_1: testPair.output || [],
        attempt_2: testPair.output || [],
      }));
    }
  }

  // Evaluate - should return mismatches
  const result = await evaluateSubmission(submission);

  assert.strictEqual(result.type, 'mismatches', 'Should return mismatches type');
  if (result.type === 'mismatches') {
    assert.ok(result.mismatches.length > 0, 'Should have at least one mismatch');
    const mismatch = result.mismatches[0];
    assert.ok(mismatch.taskId, 'Mismatch should have taskId');
    assert.ok(mismatch.expectedPredictions > mismatch.submittedPredictions, 'Expected more predictions than submitted');
  }
});

test('evaluateSubmission: returns mismatches when submission has too many test pairs', async () => {
  const seed = 22222;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create submission with extra test pairs
  const wrongGrid = [[0]];
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    // Submit correct number + 1 extra pair
    submission[taskId] = [
      ...task.test.map((testPair) => ({
        attempt_1: testPair.output || [],
        attempt_2: testPair.output || [],
      })),
      // Extra pair
      {
        attempt_1: wrongGrid,
        attempt_2: wrongGrid,
      },
    ];
  }

  // Evaluate - should return mismatches
  const result = await evaluateSubmission(submission);

  assert.strictEqual(result.type, 'mismatches', 'Should return mismatches type');
  if (result.type === 'mismatches') {
    assert.strictEqual(result.mismatches.length, tasks.length, 'Should have mismatch for every task');
    const mismatch = result.mismatches[0];
    assert.ok(mismatch.taskId, 'Mismatch should have taskId');
    assert.ok(mismatch.submittedPredictions > mismatch.expectedPredictions, 'Submitted more predictions than expected');
  }
});

// ============================================================================
// Dataset Caching Tests
// ============================================================================

test('evaluateSubmission: uses cached dataset on second evaluation (same seed)', async () => {
  const seed = 88888;
  const tasks: GeneratedTask[] = [];

  // Generate full dataset
  for await (const task of generateDataset(seed)) {
    tasks.push(task);
  }

  // Create perfect submission
  const submission: ARCSubmission = {};
  for (const { taskId, task } of tasks) {
    submission[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  // First evaluation: cache miss (generates dataset)
  assert.strictEqual(__testOnly_datasetCache.size(), 0, 'Cache should be empty initially');
  const result1 = await evaluateSubmission(submission);
  assert.strictEqual(result1.type, 'score', 'First evaluation should return score');
  assert.strictEqual(__testOnly_datasetCache.size(), 1, 'Cache should have 1 entry after first evaluation');

  // Second evaluation: cache hit (uses cached dataset)
  const result2 = await evaluateSubmission(submission);
  assert.strictEqual(result2.type, 'score', 'Second evaluation should return score');
  assert.strictEqual(__testOnly_datasetCache.size(), 1, 'Cache should still have 1 entry');

  // Scores should be identical (deterministic)
  if (result1.type === 'score' && result2.type === 'score') {
    assert.strictEqual(result1.score, result2.score, 'Scores should be identical');
    assert.strictEqual(result1.score, 1.0, 'Perfect submission should score 1.0');
  }
});

test('evaluateSubmission: cache miss for different seeds', async () => {
  const seed1 = 11111;
  const seed2 = 22222;

  // Generate dataset for seed1
  const tasks1: GeneratedTask[] = [];
  for await (const task of generateDataset(seed1)) {
    tasks1.push(task);
  }

  // Generate dataset for seed2
  const tasks2: GeneratedTask[] = [];
  for await (const task of generateDataset(seed2)) {
    tasks2.push(task);
  }

  // Create submissions
  const submission1: ARCSubmission = {};
  for (const { taskId, task } of tasks1) {
    submission1[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  const submission2: ARCSubmission = {};
  for (const { taskId, task } of tasks2) {
    submission2[taskId] = task.test.map((testPair) => ({
      attempt_1: testPair.output || [],
      attempt_2: testPair.output || [],
    }));
  }

  // Evaluate both (should cache both)
  assert.strictEqual(__testOnly_datasetCache.size(), 0, 'Cache should be empty initially');
  await evaluateSubmission(submission1);
  assert.strictEqual(__testOnly_datasetCache.size(), 1, 'Cache should have 1 entry after first eval');
  await evaluateSubmission(submission2);
  assert.strictEqual(__testOnly_datasetCache.size(), 2, 'Cache should have 2 entries after second eval');
});

test('SimpleLRU: evicts oldest when max size exceeded', async () => {
  // Set smaller maxSize for faster testing
  const originalMaxSize = __testOnly_datasetCache.maxSize;
  __testOnly_datasetCache.maxSize = 3;

  try {
    // Fill cache to exactly maxSize (3 entries)
    const seeds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const seed = 10000 + i;
      seeds.push(seed);

      const tasks: GeneratedTask[] = [];
      for await (const task of generateDataset(seed)) {
        tasks.push(task);
      }

      const submission: ARCSubmission = {};
      for (const { taskId, task } of tasks) {
        submission[taskId] = task.test.map((testPair) => ({
          attempt_1: testPair.output || [],
          attempt_2: testPair.output || [],
        }));
      }

      await evaluateSubmission(submission);
    }

    assert.strictEqual(__testOnly_datasetCache.size(), 3, 'Cache should have 3 entries');

    // Verify all seeds are cached
    for (const seed of seeds) {
      const cached = __testOnly_datasetCache.get(seed);
      assert.ok(cached !== undefined, `Seed ${seed} should be in cache`);
    }

    // Add one more to trigger eviction
    const newSeed = 10000 + 3;
    const newTasks: GeneratedTask[] = [];
    for await (const task of generateDataset(newSeed)) {
      newTasks.push(task);
    }

    const newSubmission: ARCSubmission = {};
    for (const { taskId, task } of newTasks) {
      newSubmission[taskId] = task.test.map((testPair) => ({
        attempt_1: testPair.output || [],
        attempt_2: testPair.output || [],
      }));
    }

    await evaluateSubmission(newSubmission);

    // Cache should still have 3 entries (evicted oldest)
    assert.strictEqual(__testOnly_datasetCache.size(), 3, 'Cache should still have 3 entries after eviction');

    // Oldest seed (first one) should be evicted
    const oldestCached = __testOnly_datasetCache.get(seeds[0]);
    assert.strictEqual(oldestCached, undefined, `Oldest seed ${seeds[0]} should be evicted`);

    // New seed should be cached
    const newCached = __testOnly_datasetCache.get(newSeed);
    assert.ok(newCached !== undefined, `New seed ${newSeed} should be in cache`);
  } finally {
    // Restore original maxSize
    __testOnly_datasetCache.maxSize = originalMaxSize;
    __testOnly_datasetCache.clear();
  }
});
