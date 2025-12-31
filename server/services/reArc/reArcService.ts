/**
 * RE-ARC Dataset Generation and Evaluation Service
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: Python subprocess integration for RE-ARC dataset generation and evaluation.
 *          Streams tasks from Python lib.py, manages task ID encoding/decoding,
 *          and scores submissions against deterministically regenerated ground truth.
 *
 * SRP/DRY check: Pass - Single responsibility: RE-ARC Python integration
 *                        Refactored to eliminate duplication in spawn/timeout logic
 */

import { spawn, type ChildProcess } from 'child_process';
import * as readline from 'readline';
import path from 'path';
import { logger } from '../../utils/logger.ts';
import {
  generateTaskIds,
  decodeTaskIds,
  deriveSeed,
} from '../../utils/reArcCodec.ts';
import type { ARCSubmission } from '../../../shared/types.ts';

/**
 * Inactivity timeout for RE-ARC subprocess operations.
 * Process is killed if it produces no output for this duration.
 * 10 seconds is generous for a single task (should take < 1 second each).
 */
const INACTIVITY_TIMEOUT_MS = 10000;

// ============================================================================
// Shared Configuration & Utilities
// ============================================================================

/**
 * Check if dev mode is enabled via environment variable.
 * Dev mode uses --dev flag for faster generation with fewer tasks (testing only).
 */
function isDevMode(): boolean {
  return process.env.RE_ARC_DEV_MODE === 'true';
}


/**
 * Manages inactivity timeout for subprocess operations.
 * Automatically kills process if no output is received within timeout period.
 */
class InactivityTimeoutManager {
  private timeoutHandle: NodeJS.Timeout | null = null;
  private timedOut = false;

  constructor(
    private readonly child: ChildProcess,
    private readonly timeoutMs: number,
    private readonly errorMessage: string
  ) {}

  /**
   * Start the inactivity timeout.
   */
  start(): void {
    this.reset();
  }

  /**
   * Reset the inactivity timeout (call this when output is received).
   */
  reset(): void {
    this.clear();
    this.timeoutHandle = setTimeout(() => {
      this.timedOut = true;
      this.child.kill('SIGTERM');
      logger.error(this.errorMessage);
    }, this.timeoutMs);
  }

  /**
   * Clear the timeout without marking as timed out.
   */
  clear(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Check if the process has timed out.
   */
  hasTimedOut(): boolean {
    return this.timedOut;
  }
}

/**
 * Simple Least Recently Used (LRU) cache implementation.
 * Automatically evicts oldest entries when max size is exceeded.
 */
class SimpleLRU<K, V> {
  private cache = new Map<K, V>();

  constructor(public maxSize: number) {}

  /**
   * Get value from cache. Moves entry to end (most recently used).
   * @returns Value if found, undefined otherwise
   */
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  /**
   * Set value in cache. Evicts oldest entry if max size exceeded.
   */
  set(key: K, value: V): void {
    // Remove if exists (to update position)
    this.cache.delete(key);
    // Add to end
    this.cache.set(key, value);
    // Evict oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Get current cache size (for testing).
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all entries (for test cleanup).
   */
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Dataset cache for RE-ARC evaluation.
 * Caches test outputs by seed to avoid regenerating during evaluation.
 * Structure: Array of tasks, each task has array of test pairs with outputs.
 * Max 50 datasets, LRU eviction.
 *
 * Exported with __testOnly_ prefix for test access only.
 */
export const __testOnly_datasetCache = new SimpleLRU<number, { output: number[][] }[][]>(50);

/**
 * Configuration for running a re-arc subprocess.
 */
interface SubprocessRunnerConfig<T> {
  /** Random seed for dataset generation */
  seed: number;
  /** Use --task-ids flag */
  taskIds?: boolean;
  /** Context name for error messages (e.g., "re-arc --task-ids") */
  contextName: string;
  /** Expected number of lines (optional, for validation) */
  expectedCount?: number;
  /** Process each line and optionally yield a result */
  processLine: (line: string, lineIndex: number) => T | void;
}

/**
 * Generic subprocess runner for re-arc Python processes.
 * Handles common patterns: spawn, timeout, stderr collection, line processing, error handling.
 *
 * @yields Results from processLine callback (if non-void)
 * @throws Error if subprocess fails, times out, or line count doesn't match expected
 */
async function* runReArcSubprocess<T>(
  config: SubprocessRunnerConfig<T>
): AsyncGenerator<T> {
  const { seed, taskIds, contextName, expectedCount, processLine } = config;

  // Build Python arguments
  const reArcDir = path.join(process.cwd(), 'external', 're-arc');
  const libPath = path.join(reArcDir, 'lib.py');
  const args = [libPath, '--seed', seed.toString()];

  if (isDevMode()) {
    args.push('--dev');
  }

  if (taskIds) {
    args.push('--task-ids');
  }

  // Spawn Python subprocess
  const pythonBin = resolvePythonBin();
  const child = spawn(pythonBin, args, {
    cwd: reArcDir,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (!child.stdout || !child.stderr) {
    throw new Error('Failed to create subprocess stdio streams');
  }

  const timeoutManager = new InactivityTimeoutManager(
    child,
    INACTIVITY_TIMEOUT_MS,
    `[${contextName}] Process timed out after ${INACTIVITY_TIMEOUT_MS}ms of inactivity`
  );
  timeoutManager.start();

  try {
    let lineIndex = 0;
    const errors: string[] = [];

    const rl = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity,
    });

    // Collect stderr
    child.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      logger.error(`[${contextName} stderr] ${msg}`);
      errors.push(msg);
    });

    // Process each line
    for await (const line of rl) {
      timeoutManager.reset();

      if (!line.trim()) continue;

      try {
        const result = processLine(line, lineIndex);
        lineIndex++;

        // Yield result if non-void
        if (result !== undefined) {
          yield result as T;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(`[${contextName}] Failed to process line: ${line}`, errorMsg);
        throw new Error(
          `Failed to process line at index ${lineIndex}: ${errorMsg}`
        );
      }
    }

    // Wait for process to complete
    await new Promise<void>((resolve, reject) => {
      child.on('close', (code) => {
        timeoutManager.clear();

        if (timeoutManager.hasTimedOut()) {
          reject(
            new Error(
              `${contextName} timed out after ${INACTIVITY_TIMEOUT_MS}ms of inactivity`
            )
          );
          return;
        }

        if (code !== 0) {
          reject(
            new Error(
              `Python process exited with code ${code}${errors.length ? `: ${errors.join('; ')}` : ''}`
            )
          );
          return;
        }

        if (expectedCount !== undefined && lineIndex !== expectedCount) {
          reject(
            new Error(`Expected ${expectedCount} lines, but processed ${lineIndex}`)
          );
          return;
        }

        resolve();
      });

      child.on('error', (err) => {
        timeoutManager.clear();
        reject(new Error(`Python process error: ${err.message}`));
      });
    });
  } catch (err) {
    timeoutManager.clear();
    child.kill('SIGTERM');
    throw err;
  }
}

/**
 * Progress callback for streaming evaluation events.
 */
export interface EvaluationProgress {
  current: number;
  total: number;
}

/**
 * Information about a prediction count mismatch during evaluation.
 * Occurs when submission has different number of predictions than dataset has test inputs.
 */
export interface PredictionCountMismatch {
  taskId: string;
  taskIndex: number;
  expectedPredictions: number;
  submittedPredictions: number;
}

/**
 * Evaluation result: score, mismatches, or malformed submission.
 */
export type EvaluationResult =
  | { type: 'score'; score: number }
  | { type: 'mismatches'; mismatches: PredictionCountMismatch[] }
  | { type: 'malformed'; error: string };

/**
 * Task object yielded during generation.
 */
export interface GeneratedTask {
  taskId: string;
  task: {
    train: { input: number[][]; output: number[][] }[];
    test: { input: number[][]; output?: number[][] }[];
  };
}

/**
 * Resolve Python binary path from environment or platform default.
 * Follows pattern from SnakeBenchPythonBridge.ts
 */
export function resolvePythonBin(): string {
  if (process.env.PYTHON_BIN) {
    return process.env.PYTHON_BIN;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Get the number of tasks for a given seed by calling lib.py --task-ids.
 *
 * @param seed - Random seed for dataset generation
 * @returns Number of tasks in the dataset
 * @throws Error if Python subprocess fails
 */
async function getTaskCount(seed: number): Promise<number> {
  let taskCount = 0;

  // Count non-empty lines (each line is a task ID)
  for await (const _ of runReArcSubprocess({
    seed,
    taskIds: true,
    contextName: 're-arc --task-ids',
    processLine: (line) => {
      if (line.trim()) {
        taskCount++;
      }
    },
  })) {
    // No-op: just counting lines
  }

  return taskCount;
}

/**
 * Generate RE-ARC dataset with encoded task IDs.
 *
 * Spawns Python subprocess to generate tasks deterministically, replaces
 * re-arc task IDs with our encoded task IDs, and yields tasks incrementally
 * for streaming.
 *
 * **Important**: Python generates a fixed set of tasks for each seed (determined by
 * the re-arc library's filtering logic). The task count is queried from Python before
 * generation begins.
 *
 * **Security**: Task IDs encode the public seedId but use server-secret-derived
 * internalSeed for PRNG patterns (prevents external regeneration).
 *
 * **Caching**: Populates the dataset cache with test outputs during generation,
 * allowing subsequent evaluation calls to skip Python subprocess regeneration.
 *
 * @param seedId - Public seed identifier (typically Unix timestamp in seconds)
 * @yields Objects with {taskId, task} for each generated task
 * @throws Error if Python subprocess fails, times out, or RE_ARC_SEED_PEPPER not configured
 */
export async function* generateDataset(
  seedId: number,
): AsyncGenerator<GeneratedTask> {
  // Derive internal seed for Python RNG (prevents external regeneration)
  const pepper = process.env.RE_ARC_SEED_PEPPER;
  if (!pepper) {
    throw new Error('RE_ARC_SEED_PEPPER environment variable not configured');
  }
  const internalSeed = deriveSeed(seedId, pepper);

  // Step 1: Get task count from Python using internal seed
  const taskCount = await getTaskCount(internalSeed);

  // Step 2: Generate task IDs (seedId encoded, internalSeed for PRNG)
  const ourTaskIds = generateTaskIds(seedId, internalSeed, taskCount);

  // Step 3: Collect test outputs for caching during generation
  const testOutputs: { output: number[][] }[][] = [];

  // Step 4: Spawn Python for dataset generation using internal seed
  yield* runReArcSubprocess<GeneratedTask>({
    seed: internalSeed,
    contextName: 're-arc generateDataset',
    expectedCount: taskCount,
    processLine: (line, taskIndex) => {
      // Parse task JSON
      const task = JSON.parse(line);

      // Extract and cache test outputs for evaluation reuse
      const taskTestOutputs = task.test.map((testPair: { output: number[][] }) => ({
        output: testPair.output,
      }));
      testOutputs.push(taskTestOutputs);

      // Return with our generated task ID (by sequence order)
      return {
        taskId: ourTaskIds[taskIndex],
        task,
      };
    },
  });

  // Step 5: Cache the collected test outputs (keyed by public seedId)
  __testOnly_datasetCache.set(seedId, testOutputs);
}

/**
 * Evaluate a submission against deterministically regenerated ground truth.
 *
 * Recovers seedId from task IDs, derives internalSeed, regenerates the dataset,
 * compares submission predictions against ground truth, and streams progress.
 *
 * Scoring: A test input is solved if ANY of the 2 prediction attempts match the output.
 * Task score = (solved test inputs / total test inputs). Overall score = average of task scores.
 *
 * @param submission - Submission object mapping task IDs to predictions
 * @param onProgress - Optional callback for progress updates
 * @returns Evaluation result:
 *   - { type: 'score', score } if submission is valid and scored
 *   - { type: 'mismatches', mismatches } if prediction counts don't match test input counts
 *   - { type: 'malformed', error } if task IDs can't be decoded or RE_ARC_SEED_PEPPER not configured
 */
export async function evaluateSubmission(
  submission: ARCSubmission,
  onProgress?: (progress: EvaluationProgress) => void,
): Promise<EvaluationResult> {
  // Step 1: Recover seedId and derive internalSeed from task IDs
  let decoded;
  try {
    const pepper = process.env.RE_ARC_SEED_PEPPER;
    if (!pepper) {
      return {
        type: 'malformed',
        error: 'RE_ARC_SEED_PEPPER not configured on server',
      };
    }
    decoded = decodeTaskIds(Object.keys(submission), pepper);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      type: 'malformed',
      error: errorMessage,
    };
  }

  const { seedId, internalSeed, orderedTaskIds } = decoded;
  const numTasks = orderedTaskIds.length;

  // Step 2: Build ordered submission array
  const submissionInOrder = orderedTaskIds.map((taskId) => submission[taskId]);

  // Step 3: Check cache for this seedId (public identifier)
  const cachedTestOutputs = __testOnly_datasetCache.get(seedId);
  let totalScore = 0;
  const mismatches: PredictionCountMismatch[] = [];

  // Helper: Process a single task (shared between cache hit/miss paths)
  const processTask = (
    taskIndex: number,
    testPairs: { output: number[][] }[],
  ): void => {
    const submittedPredictions = submissionInOrder[taskIndex];
    const taskId = orderedTaskIds[taskIndex];

    if (!submittedPredictions) {
      throw new Error(`Missing submission for task ${taskId} at index ${taskIndex}`);
    }

    // Check prediction count (must match number of test inputs)
    if (submittedPredictions.length !== testPairs.length) {
      mismatches.push({
        taskId,
        taskIndex,
        expectedPredictions: testPairs.length,
        submittedPredictions: submittedPredictions.length,
      });
    } else {
      // Score this task
      const taskScore = scoreTask(testPairs, submittedPredictions);
      totalScore += taskScore;
    }

    // Emit progress
    if (onProgress) {
      onProgress({ current: taskIndex + 1, total: numTasks });
    }
  };

  if (cachedTestOutputs) {
    // Cache HIT: Score against cached data (no Python subprocess)
    for (let taskIndex = 0; taskIndex < numTasks; taskIndex++) {
      processTask(taskIndex, cachedTestOutputs[taskIndex]);
    }
  } else {
    // Cache MISS: Stream from Python, score as we go, collect for caching
    const testOutputs: { output: number[][] }[][] = [];

    for await (const _ of runReArcSubprocess({
      seed: internalSeed,
      contextName: 're-arc evaluateSubmission',
      expectedCount: numTasks,
      processLine: (line, taskIndex) => {
        const groundTruth = JSON.parse(line);

        // Extract and cache test outputs
        const testPairs = groundTruth.test;
        const taskTestOutputs = testPairs.map((testPair: { output: number[][] }) => ({
          output: testPair.output,
        }));
        testOutputs.push(taskTestOutputs);

        // Score this task (streaming)
        processTask(taskIndex, testPairs);

        // No need to yield anything (void return)
      },
    })) {
      // No-op: just processing for side effects (scoring + collecting)
    }

    // Cache the collected dataset (keyed by public seedId)
    __testOnly_datasetCache.set(seedId, testOutputs);
  }

  // Step 4: Return mismatches if any, otherwise return score
  if (mismatches.length > 0) {
    return { type: 'mismatches', mismatches };
  }

  const overallScore = totalScore / numTasks;
  return { type: 'score', score: overallScore };
}

/**
 * Score a single task by comparing predictions against ground truth test pairs.
 *
 * A test input is considered solved if ANY of the 2 prediction attempts match the ground truth output.
 * Task score = (number of solved test inputs) / (total test inputs).
 *
 * IMPORTANT: Caller must ensure predictions.length === testPairs.length before calling.
 *
 * @param testPairs - Ground truth test pairs from dataset
 * @param predictions - Array of predictions from submission (must match testPairs.length)
 * @returns Task score between 0.0 and 1.0
 */
function scoreTask(
  testPairs: { output: number[][] }[],
  predictions: { attempt_1: number[][]; attempt_2: number[][] }[],
): number {
  if (testPairs.length === 0) return 0;

  let solvedTestInputs = 0;

  for (let i = 0; i < testPairs.length; i++) {
    const groundTruth = testPairs[i].output;
    const { attempt_1, attempt_2 } = predictions[i];

    // Check if either prediction attempt matches ground truth
    const attempt1Correct = gridsEqual(attempt_1, groundTruth);
    const attempt2Correct = gridsEqual(attempt_2, groundTruth);

    if (attempt1Correct || attempt2Correct) {
      solvedTestInputs++;
    }
  }

  return solvedTestInputs / testPairs.length;
}

/**
 * Deep equality check for 2D grids.
 *
 * @param grid1 - First grid
 * @param grid2 - Second grid
 * @returns true if grids are identical
 */
function gridsEqual(grid1: number[][], grid2: number[][]): boolean {
  if (grid1.length !== grid2.length) return false;

  for (let row = 0; row < grid1.length; row++) {
    if (grid1[row].length !== grid2[row].length) return false;

    for (let col = 0; col < grid1[row].length; col++) {
      if (grid1[row][col] !== grid2[row][col]) return false;
    }
  }

  return true;
}
