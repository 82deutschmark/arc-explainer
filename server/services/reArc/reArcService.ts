/**
 * RE-ARC Dataset Generation and Verification Service
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: Python subprocess integration for RE-ARC dataset generation and verification.
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
} from '../../utils/reArcCodec.ts';
import type { ARCSubmission } from '../../../shared/types.ts';

/**
 * Inactivity timeout for RE-ARC subprocess operations.
 * Process is killed if it produces no output for this duration.
 * 5 seconds is generous for a single task (should take < 1 second each).
 */
const INACTIVITY_TIMEOUT_MS = 5000;

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
 * Configuration for running a re-arc subprocess.
 */
interface SubprocessRunnerConfig<T> {
  /** Random seed for dataset generation */
  seed: number;
  /** Use --ids-only flag */
  idsOnly?: boolean;
  /** Context name for error messages (e.g., "re-arc --ids-only") */
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
  const { seed, idsOnly, contextName, expectedCount, processLine } = config;

  // Build Python arguments
  const reArcDir = path.join(process.cwd(), 'external', 're-arc');
  const libPath = path.join(reArcDir, 'lib.py');
  const args = [libPath, '--seed', seed.toString()];

  if (isDevMode()) {
    args.push('--dev');
  }

  if (idsOnly) {
    args.push('--ids-only');
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
 * Progress callback for streaming verification events.
 */
export interface VerificationProgress {
  current: number;
  total: number;
}

/**
 * Information about a test pair count mismatch during verification.
 */
export interface TestPairMismatch {
  taskId: string;
  taskIndex: number;
  expectedPairs: number;
  submittedPairs: number;
}

/**
 * Verification result: score, mismatches, or malformed submission.
 */
export type VerificationResult =
  | { type: 'score'; score: number }
  | { type: 'mismatches'; mismatches: TestPairMismatch[] }
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
 * Get the number of tasks for a given seed by calling lib.py --ids-only.
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
    idsOnly: true,
    contextName: 're-arc --ids-only',
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
 * **Seed as timestamp**: In this iteration, the seed should be the Unix timestamp
 * (seconds) at generation time. This allows recovery during verification without
 * separate timestamp encoding.
 *
 * @param seed - Random seed for deterministic generation (typically Unix timestamp in seconds)
 * @yields Objects with {taskId, task} for each generated task
 * @throws Error if Python subprocess fails or times out
 */
export async function* generateDataset(
  seed: number,
): AsyncGenerator<GeneratedTask> {
  // Step 1: Get task count from Python (seed determines count)
  const taskCount = await getTaskCount(seed);

  // Step 2: Generate our task IDs (no message encoding in this iteration)
  const ourTaskIds = generateTaskIds(seed, taskCount);

  // Step 3: Spawn Python for dataset generation and yield tasks
  yield* runReArcSubprocess<GeneratedTask>({
    seed,
    contextName: 're-arc generateDataset',
    expectedCount: taskCount,
    processLine: (line, taskIndex) => {
      // Parse: first 8 chars = re-arc task ID (unused), rest = JSON
      const jsonStr = line.slice(8);

      // Parse task JSON
      const task = JSON.parse(jsonStr);

      // Return with our generated task ID (by sequence order)
      return {
        taskId: ourTaskIds[taskIndex],
        task,
      };
    },
  });
}

/**
 * Verify a submission against deterministically regenerated ground truth.
 *
 * Recovers seed from task IDs, regenerates the dataset,
 * compares submission attempts against ground truth, and streams progress.
 *
 * Scoring: Each test pair is solved if ANY of the 2 attempts match the output.
 * Task score = (solved pairs / total pairs). Overall score = average of task scores.
 *
 * @param submission - Submission object mapping task IDs to attempts
 * @param onProgress - Optional callback for progress updates
 * @returns Verification result:
 *   - { type: 'score', score } if submission is valid and scored
 *   - { type: 'mismatches', mismatches } if test pair counts don't match
 *   - { type: 'malformed', error } if task IDs can't be decoded
 */
export async function verifySubmission(
  submission: ARCSubmission,
  onProgress?: (progress: VerificationProgress) => void,
): Promise<VerificationResult> {
  // Step 1: Recover seed and ordered task IDs
  let decoded;
  try {
    decoded = decodeTaskIds(Object.keys(submission));
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      type: 'malformed',
      error: errorMessage,
    };
  }

  const { seed, orderedTaskIds } = decoded;
  const numTasks = orderedTaskIds.length;

  // Step 2: Build ordered submission array
  const submissionInOrder = orderedTaskIds.map((taskId) => submission[taskId]);

  // Step 3: Spawn Python and stream verification
  let totalScore = 0;
  const mismatches: TestPairMismatch[] = [];

  for await (const _ of runReArcSubprocess({
    seed,
    contextName: 're-arc verifySubmission',
    expectedCount: numTasks,
    processLine: (line, taskIndex) => {
      // Parse ground truth task (skip first 8 chars = re-arc task ID)
      const jsonStr = line.slice(8);
      const groundTruth = JSON.parse(jsonStr);

      // Get corresponding submission
      const submittedAttempts = submissionInOrder[taskIndex];
      const taskId = orderedTaskIds[taskIndex];

      if (!submittedAttempts) {
        // Missing submission for this task is a malformed submission
        throw new Error(`Missing submission for task ${taskId} at index ${taskIndex}`);
      }

      // Check test pair count
      const testPairs = groundTruth.test;
      if (submittedAttempts.length !== testPairs.length) {
        // Collect mismatch and skip scoring
        mismatches.push({
          taskId,
          taskIndex,
          expectedPairs: testPairs.length,
          submittedPairs: submittedAttempts.length,
        });
      } else {
        // Score this task
        const taskScore = scoreTask(testPairs, submittedAttempts);
        totalScore += taskScore;
      }

      // Emit progress
      if (onProgress) {
        onProgress({ current: taskIndex + 1, total: numTasks });
      }

      // No need to yield anything (void return)
    },
  })) {
    // No-op: just processing for side effects (scoring + progress)
  }

  // Step 4: Return mismatches if any, otherwise return score
  if (mismatches.length > 0) {
    return { type: 'mismatches', mismatches };
  }

  const overallScore = totalScore / numTasks;
  return { type: 'score', score: overallScore };
}

/**
 * Score a single task by comparing test pairs against submission attempts.
 *
 * A test pair is considered solved if ANY of the 2 attempts match the ground truth output.
 * Task score = (number of solved pairs) / (total pairs).
 *
 * IMPORTANT: Caller must ensure attempts.length === testPairs.length before calling.
 *
 * @param testPairs - Ground truth test pairs
 * @param attempts - Array of attempt pairs from submission (must match testPairs.length)
 * @returns Task score between 0.0 and 1.0
 */
function scoreTask(
  testPairs: { input: number[][]; output: number[][] }[],
  attempts: { attempt_1: number[][]; attempt_2: number[][] }[],
): number {
  if (testPairs.length === 0) return 0;

  let solvedPairs = 0;

  for (let i = 0; i < testPairs.length; i++) {
    const groundTruth = testPairs[i].output;
    const { attempt_1, attempt_2 } = attempts[i];

    // Check if either attempt matches ground truth
    const attempt1Correct = gridsEqual(attempt_1, groundTruth);
    const attempt2Correct = gridsEqual(attempt_2, groundTruth);

    if (attempt1Correct || attempt2Correct) {
      solvedPairs++;
    }
  }

  return solvedPairs / testPairs.length;
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
