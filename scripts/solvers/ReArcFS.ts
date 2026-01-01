/**
 * Author: Claude (Haiku 4.5)
 * Date: 2025-12-31
 * PURPOSE: Durable RE-ARC solver using free OpenRouter models with checkpointing,
 *          resumable queues, adaptive exponential backoff with jitter, error taxonomy,
 *          and comprehensive run summaries. Replaces rearc-free-solver.ts with
 *          hardened, production-ready implementation.
 * SRP/DRY check: Pass — Reviewed existing ARC solvers, composed new modular architecture
 *          with separate checkpoint, backoff, and stats modules.
 *
 * Usage:
 *   npx tsx scripts/solvers/ReArcFS.ts --dataset <path> [--checkpoint <file>] [--fresh|--resume]
 *
 * Flags:
 *   --dataset <path>         - Required dataset JSON path (tasks to solve)
 *   --checkpoint <path>      - Custom checkpoint file (default: ./rearc-fs-checkpoint.json)
 *   --resume                 - Require checkpoint to exist; fail if missing
 *   --fresh                  - Ignore any checkpoint and start a new run
 *
 * Environment:
 *   OPENROUTER_API_KEY          - Required
 *   REARC_MODEL                 - Model to use (default: xiaomi/mimo-v2-flash:free)
 *   REARC_REASONING_EFFORT      - high|medium|low|none (default: high)
 *   REARC_LAUNCH_DELAY_MS       - Delay between launches (default: 10000)
 *   REARC_MAX_CONCURRENT        - Max concurrent calls (default: 4)
 *   REARC_MAX_BACKOFF_MS        - Cap for adaptive delay (default: 60000)
 *   REARC_CHECKPOINT_INTERVAL   - Save checkpoint every N completions (default: 10)
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  modelKey: process.env.REARC_MODEL || 'xiaomi/mimo-v2-flash:free',
  reasoningEffort: (process.env.REARC_REASONING_EFFORT || 'high') as 'high' | 'medium' | 'low' | 'none',
  launchDelayMs: Number(process.env.REARC_LAUNCH_DELAY_MS) || 10000,
  maxConcurrent: Number(process.env.REARC_MAX_CONCURRENT) || 4,
  maxBackoffMs: Number(process.env.REARC_MAX_BACKOFF_MS) || 60000,
  checkpointIntervalMs: Number(process.env.REARC_CHECKPOINT_INTERVAL) || 10,
  maxRetries: 3,
};

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 35 * 60 * 1000, // 35 min timeout
  defaultHeaders: {
    'HTTP-Referer': 'https://arc.markbarney.net',
    'X-Title': 'ARC Explainer RE-ARC FS Solver',
  },
});

// ============================================================================
// Types
// ============================================================================

type Grid = number[][];
type FailureCategory = 'rate_limit' | 'parse' | 'api' | 'network' | 'unknown';

interface TrainPair {
  input: Grid;
  output: Grid;
}

interface TestCase {
  input: Grid;
}

interface Task {
  train: TrainPair[];
  test: TestCase[];
}

interface Dataset {
  [taskId: string]: Task;
}

interface Attempt {
  attempt_1: Grid | null;
  attempt_2: Grid | null;
}

interface Submission {
  [taskId: string]: Attempt[];
}

interface WorkItem {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
  retryCount: number;
}

interface SolveResult {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
  grid: Grid | null;
  error?: string;
  failureCategory?: FailureCategory;
  statusCode?: number;
}

interface FailureRecord {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
  category: FailureCategory;
  message: string;
  retryCount: number;
  timestamp: string;
}

interface FailureStats {
  total: number;
  byCategory: Record<FailureCategory, number>;
  samples: Record<FailureCategory, string[]>;
}

interface RuntimeStats {
  tasksProcessed: number;
  totalWorkItems: number;
  completedAttempts: number;
  successCount: number;
  failureCount: number;
  rateLimitEvents: number;
  maxObservedBackoffMs: number;
  failureStats: FailureStats;
  permanentFailures: FailureRecord[];
}

interface ConfigSnapshot {
  modelKey: string;
  reasoningEffort: typeof CONFIG.reasoningEffort;
  maxConcurrent: number;
  launchDelayMs: number;
  maxBackoffMs: number;
  maxRetries: number;
}

interface CheckpointData {
  version: number;
  datasetPath: string;
  datasetHash: string;
  timestamp: string;
  submission: Submission;
  workQueue: WorkItem[];
  workIndex: number;
  stats: RuntimeStats;
  config: ConfigSnapshot;
}

interface CliOptions {
  datasetPath: string;
  checkpointPath: string;
  fresh: boolean;
  resume: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashDataset(data: Dataset): string {
  const json = JSON.stringify(data);
  return crypto.createHash('sha256').update(json).digest('hex');
}

function parseGridFromResponse(text: string): Grid | null {
  // 1. Try LaTeX \boxed{} extraction (for models that use it)
  const boxedMatch = text.match(/\\boxed\{([\s\S]*?)\}/);
  if (boxedMatch) {
    try {
      const boxedContent = boxedMatch[1].trim();
      const parsed = JSON.parse(boxedContent);
      if (isValidGrid(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to backscan
    }
  }

  // 2. Backscan JSON parser: find the LAST valid JSON array by scanning backward
  // This handles responses with explanatory text before the answer
  let depth = 0;
  let bracketStart = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ']') {
      depth++;
      if (bracketStart === -1) {
        bracketStart = i;
      }
    } else if (char === '[') {
      depth--;
      if (depth === 0 && bracketStart !== -1) {
        // Found complete array structure
        const candidate = text.substring(i, bracketStart + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (isValidGrid(parsed)) {
            return parsed;
          }
        } catch {
          // Continue scanning
        }
        bracketStart = -1;
      }
    }
  }

  return null;
}

function isValidGrid(parsed: unknown): parsed is Grid {
  if (!Array.isArray(parsed)) return false;
  if (parsed.length === 0) return false;
  return parsed.every(
    (row) =>
      Array.isArray(row) &&
      row.length > 0 &&
      row.every((cell) => typeof cell === 'number' && cell >= 0 && cell <= 9)
  );
}

// ============================================================================
// Failure Categorization
// ============================================================================

function categorizeError(error: string, statusCode?: number): FailureCategory {
  if (statusCode === 429 || error.includes('429') || error.includes('rate limit') || error.includes('Too Many Requests')) {
    return 'rate_limit';
  }
  if (error.includes('JSON') || error.includes('parse') || error.includes('expected')) {
    return 'parse';
  }
  if (error.includes('ECONNREFUSED') || error.includes('ETIMEDOUT') || error.includes('EHOSTUNREACH')) {
    return 'network';
  }
  if (statusCode && statusCode >= 400) {
    return 'api';
  }
  return 'unknown';
}

function recordFailure(
  failures: FailureRecord[],
  taskId: string,
  testIndex: number,
  attemptNum: 1 | 2,
  category: FailureCategory,
  message: string,
  retryCount: number
): void {
  failures.push({
    taskId,
    testIndex,
    attemptNum,
    category,
    message: message.slice(0, 200),
    retryCount,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// Adaptive Backoff with Jitter
// ============================================================================

class AdaptiveBackoff {
  private baseMs: number;
  private currentMs: number;
  private maxMs: number;
  private multiplier: number;

  constructor(baseMs: number, maxMs: number) {
    this.baseMs = baseMs;
    this.currentMs = baseMs;
    this.maxMs = maxMs;
    this.multiplier = 1.5;
  }

  getRateLimit(): number {
    return this.currentMs;
  }

  onRateLimit(): void {
    this.currentMs = Math.min(this.maxMs, this.currentMs * this.multiplier);
  }

  onSuccess(): void {
    this.currentMs = Math.max(this.baseMs, this.currentMs * 0.95);
  }

  getWithJitter(): number {
    const jitter = this.currentMs * 0.1 * (Math.random() - 0.5);
    return Math.max(this.baseMs, this.currentMs + jitter);
  }
}

// ============================================================================
// Checkpoint Module
// ============================================================================

class CheckpointManager {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  save(data: CheckpointData): void {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  load(): CheckpointData | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as CheckpointData;
    } catch (err) {
      console.error(`Failed to load checkpoint: ${err}`);
      return null;
    }
  }

  validateCompatibility(checkpoint: CheckpointData, dataset: Dataset, datasetPath: string): boolean {
    // Check dataset path
    if (checkpoint.datasetPath !== datasetPath) {
      console.warn(`Checkpoint dataset path differs: checkpoint="${checkpoint.datasetPath}" vs current="${datasetPath}"`);
      return false;
    }

    // Check dataset hash
    const currentHash = hashDataset(dataset);
    if (checkpoint.datasetHash !== currentHash) {
      console.warn('Checkpoint dataset hash mismatch—data may have changed');
      return false;
    }

    return true;
  }
}

// ============================================================================
// Solver
// ============================================================================

function buildPrompt(task: Task, testIndex: number): string {
  // Build training examples in official arc-agi-benchmarking format (JSON arrays)
  let trainingExamples = '';
  for (let i = 0; i < task.train.length; i++) {
    trainingExamples += `--Example ${i}-- \n\n INPUT: \n\n`;
    trainingExamples += JSON.stringify(task.train[i].input) + '\n\n';
    trainingExamples += `OUTPUT: \n\n`;
    trainingExamples += JSON.stringify(task.train[i].output) + '\n\n';
  }

  // Official system prompt from arc-agi-benchmarking
  const prompt = `You are participating in a puzzle solving competition. You are an expert at solving puzzles.

Below is a list of input and output pairs with a pattern. Your goal is to identify the pattern or transformation in the training examples that maps the input to the output, then apply that pattern to the test input to give a final output.

Respond in the format of the training output examples

--Training Examples--
${trainingExamples}--End of Training Examples--

--Test Input--

${JSON.stringify(task.test[testIndex].input)}

--End of Test Input--

Your response:`;

  return prompt;
}

async function solveAttempt(
  taskId: string,
  task: Task,
  testIndex: number,
  attemptNum: 1 | 2
): Promise<SolveResult> {
  const prompt = buildPrompt(task, testIndex);

  try {
    const requestParams: any = {
      model: CONFIG.modelKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Reasoning models need temperature for quality
    };

    if (CONFIG.reasoningEffort !== 'none') {
      requestParams.reasoning = { effort: CONFIG.reasoningEffort };
    }

    const response = await openrouter.chat.completions.create(requestParams);
    const message = response.choices[0]?.message as any;
    const content = message?.content || '';
    const reasoning = message?.reasoning;

    if (reasoning) {
      console.log(`    [reasoning] ${reasoning.slice(0, 80).replace(/\n/g, ' ')}...`);
    }

    const grid = parseGridFromResponse(content);
    if (!grid) {
      return {
        taskId,
        testIndex,
        attemptNum,
        grid: null,
        error: `Failed to parse grid: ${content.slice(0, 150)}`,
        failureCategory: 'parse',
      };
    }

    return { taskId, testIndex, attemptNum, grid };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    const statusCode = err.status;
    const category = categorizeError(errorMsg, statusCode);

    return {
      taskId,
      testIndex,
      attemptNum,
      grid: null,
      error: errorMsg,
      failureCategory: category,
      statusCode,
    };
  }
}

// ============================================================================
// CLI Parsing
// ============================================================================

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const datasetIndex = args.indexOf('--dataset');

  if (datasetIndex === -1 || !args[datasetIndex + 1]) {
    console.error('Usage: npx tsx scripts/solvers/ReArcFS.ts --dataset <path> [--checkpoint <file>] [--fresh|--resume]');
    process.exit(1);
  }

  const datasetPath = args[datasetIndex + 1];
  if (!fs.existsSync(datasetPath)) {
    console.error(`Dataset file not found: ${datasetPath}`);
    process.exit(1);
  }

  const checkpointIndex = args.indexOf('--checkpoint');
  const checkpointPath = checkpointIndex !== -1 ? args[checkpointIndex + 1] : 'rearc-fs-checkpoint.json';

  const fresh = args.includes('--fresh');
  const resume = args.includes('--resume');

  return { datasetPath, checkpointPath, fresh, resume };
}

// ============================================================================
// Statistics & Summary
// ============================================================================

function createEmptyStats(totalWorkItems: number): RuntimeStats {
  return {
    tasksProcessed: 0,
    totalWorkItems,
    completedAttempts: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitEvents: 0,
    maxObservedBackoffMs: 0,
    failureStats: {
      total: 0,
      byCategory: {
        rate_limit: 0,
        parse: 0,
        api: 0,
        network: 0,
        unknown: 0,
      },
      samples: {
        rate_limit: [],
        parse: [],
        api: [],
        network: [],
        unknown: [],
      },
    },
    permanentFailures: [],
  };
}

function printSummary(
  stats: RuntimeStats,
  dataset: Dataset,
  checkpointPath: string,
  outputPath: string,
  elapsedMs: number
): void {
  console.log('\n' + '='.repeat(70));
  console.log('RUN SUMMARY');
  console.log('='.repeat(70));
  console.log(`Tasks in dataset:        ${Object.keys(dataset).length}`);
  console.log(`Total work items:        ${stats.totalWorkItems}`);
  console.log(`Completed attempts:      ${stats.completedAttempts}`);
  console.log(`Successful grids:        ${stats.successCount}`);
  console.log(`Failed attempts:         ${stats.failureCount}`);
  console.log(`Rate limit events:       ${stats.rateLimitEvents}`);
  console.log(`Max backoff observed:    ${stats.maxObservedBackoffMs}ms`);
  console.log(`\nFailure breakdown:`);
  console.log(`  Rate limit:            ${stats.failureStats.byCategory.rate_limit}`);
  console.log(`  Parse errors:          ${stats.failureStats.byCategory.parse}`);
  console.log(`  API errors:            ${stats.failureStats.byCategory.api}`);
  console.log(`  Network errors:        ${stats.failureStats.byCategory.network}`);
  console.log(`  Unknown:               ${stats.failureStats.byCategory.unknown}`);
  console.log(`\nArtifacts:`);
  console.log(`  Checkpoint:            ${checkpointPath}`);
  console.log(`  Submission:            ${outputPath}`);
  console.log(`\nElapsed time:            ${(elapsedMs / 1000).toFixed(1)}s`);
  console.log('='.repeat(70));

  if (stats.permanentFailures.length > 0) {
    console.log(`\nPermanent failures (${stats.permanentFailures.length}):`);
    for (const fail of stats.permanentFailures.slice(0, 10)) {
      console.log(`  ${fail.taskId} test${fail.testIndex + 1} attempt${fail.attemptNum}: [${fail.category}] ${fail.message}`);
    }
    if (stats.permanentFailures.length > 10) {
      console.log(`  ... and ${stats.permanentFailures.length - 10} more`);
    }
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const startTime = Date.now();
  const opts = parseCliOptions();
  let isInterrupted = false;

  // Graceful shutdown handler
  process.on('SIGINT', () => {
    console.log('\n[SIGINT] Shutting down gracefully...');
    isInterrupted = true;
  });

  // Load dataset
  console.log(`Loading dataset: ${opts.datasetPath}`);
  const dataset: Dataset = JSON.parse(fs.readFileSync(opts.datasetPath, 'utf-8'));
  const taskIds = Object.keys(dataset);
  const datasetHash = hashDataset(dataset);
  console.log(`Found ${taskIds.length} tasks`);

  // Initialize checkpoint manager
  const checkpointMgr = new CheckpointManager(opts.checkpointPath);
  let submission: Submission = {};
  let workQueue: WorkItem[] = [];
  let workIndex = 0;
  let stats: RuntimeStats;

  // Handle resume/checkpoint logic
  if (!opts.fresh) {
    const checkpoint = checkpointMgr.load();
    if (checkpoint) {
      if (checkpointMgr.validateCompatibility(checkpoint, dataset, opts.datasetPath)) {
        console.log(`Resuming from checkpoint: ${opts.checkpointPath}`);
        submission = checkpoint.submission;
        workQueue = checkpoint.workQueue;
        workIndex = checkpoint.workIndex;
        stats = checkpoint.stats;
      } else {
        console.warn('Checkpoint incompatible; starting fresh');
        submission = {};
        workQueue = [];
        workIndex = 0;
        stats = createEmptyStats(0);
      }
    } else if (opts.resume) {
      console.error(`--resume flag set but no checkpoint found at: ${opts.checkpointPath}`);
      process.exit(1);
    } else {
      submission = {};
      workQueue = [];
      workIndex = 0;
      stats = createEmptyStats(0);
    }
  } else {
    submission = {};
    workQueue = [];
    workIndex = 0;
    stats = createEmptyStats(0);
  }

  // Build initial work queue if starting fresh or if queue is empty
  if (workQueue.length === 0) {
    for (const taskId of taskIds) {
      const task = dataset[taskId];
      for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
        workQueue.push({ taskId, testIndex, attemptNum: 1, retryCount: 0 });
        workQueue.push({ taskId, testIndex, attemptNum: 2, retryCount: 0 });
      }
    }
    stats.totalWorkItems = workQueue.length;
  }

  // Initialize submission structure
  for (const taskId of taskIds) {
    if (!submission[taskId]) {
      const task = dataset[taskId];
      submission[taskId] = Array(task.test.length).fill(null).map(() => ({
        attempt_1: null,
        attempt_2: null,
      }));
    }
  }

  console.log(`\nStarting solve with model: ${CONFIG.modelKey}`);
  console.log(`Reasoning effort: ${CONFIG.reasoningEffort}`);
  console.log(`Max concurrent: ${CONFIG.maxConcurrent}, Launch delay: ${CONFIG.launchDelayMs}ms`);
  console.log(`Work items: ${workQueue.length}, Progress: ${workIndex}/${workQueue.length}`);
  console.log('='.repeat(70));

  // Main solving loop
  const backoff = new AdaptiveBackoff(CONFIG.launchDelayMs, CONFIG.maxBackoffMs);
  const inFlight = new Map<Promise<SolveResult>, WorkItem>();
  let nextLaunchTime = Date.now();
  let checkpointCounter = 0;

  while ((workIndex < workQueue.length || inFlight.size > 0) && !isInterrupted) {
    // Launch new calls
    while (workIndex < workQueue.length && inFlight.size < CONFIG.maxConcurrent && !isInterrupted) {
      const now = Date.now();
      if (now < nextLaunchTime) {
        await delay(nextLaunchTime - now);
      }

      const workItem = workQueue[workIndex];
      const task = dataset[workItem.taskId];

      const promise = solveAttempt(workItem.taskId, task, workItem.testIndex, workItem.attemptNum);
      inFlight.set(promise, workItem);

      console.log(
        `[${workIndex + 1}/${workQueue.length}] ${workItem.taskId} test${workItem.testIndex + 1} ` +
        `attempt${workItem.attemptNum} (retry ${workItem.retryCount})`
      );

      workIndex++;
      nextLaunchTime = Date.now() + backoff.getWithJitter();
    }

    // Wait for completion
    if (inFlight.size > 0) {
      const wrapped = Array.from(inFlight.entries()).map(([promise, workItem]) =>
        promise
          .then((result) => ({ result, workItem, success: true }))
          .catch((error) => ({
            result: {
              taskId: workItem.taskId,
              testIndex: workItem.testIndex,
              attemptNum: workItem.attemptNum,
              grid: null,
              error: error instanceof Error ? error.message : String(error),
              failureCategory: 'unknown' as FailureCategory,
            },
            workItem,
            success: false,
          }))
      );

      const settled = await Promise.race(wrapped);
      const { result, workItem } = settled;

      // Find and delete from inFlight
      const promiseToDelete = Array.from(inFlight.entries()).find(([_, item]) => item === workItem)?.[0];
      if (promiseToDelete) inFlight.delete(promiseToDelete);

      stats.completedAttempts++;

      if (result && result.grid) {
        submission[workItem.taskId][workItem.testIndex][
          workItem.attemptNum === 1 ? 'attempt_1' : 'attempt_2'
        ] = result.grid;
        stats.successCount++;
        backoff.onSuccess();
      } else {
        stats.failureCount++;
        const category = result.failureCategory || 'unknown';
        stats.failureStats.byCategory[category]++;
        stats.failureStats.total++;

        if (stats.failureStats.samples[category].length < 3) {
          stats.failureStats.samples[category].push(result.error || 'Unknown error');
        }

        if (category === 'rate_limit') {
          stats.rateLimitEvents++;
          backoff.onRateLimit();
          stats.maxObservedBackoffMs = Math.max(stats.maxObservedBackoffMs, backoff.getRateLimit());
          console.log(`  [RATE LIMIT] Backing off to ${backoff.getRateLimit()}ms`);
        }

        // Queue for retry if under max retries
        if (workItem.retryCount < CONFIG.maxRetries) {
          workQueue.push({ ...workItem, retryCount: workItem.retryCount + 1 });
        } else {
          recordFailure(
            stats.permanentFailures,
            workItem.taskId,
            workItem.testIndex,
            workItem.attemptNum,
            category,
            result.error || 'Unknown',
            workItem.retryCount
          );
        }

        console.log(`  [FAIL] ${category}: ${result.error?.slice(0, 80)}`);
      }

      // Checkpoint save
      checkpointCounter++;
      if (checkpointCounter >= CONFIG.checkpointIntervalMs) {
        const checkpoint: CheckpointData = {
          version: 1,
          datasetPath: opts.datasetPath,
          datasetHash,
          timestamp: new Date().toISOString(),
          submission,
          workQueue,
          workIndex,
          stats,
          config: {
            modelKey: CONFIG.modelKey,
            reasoningEffort: CONFIG.reasoningEffort,
            maxConcurrent: CONFIG.maxConcurrent,
            launchDelayMs: CONFIG.launchDelayMs,
            maxBackoffMs: CONFIG.maxBackoffMs,
            maxRetries: CONFIG.maxRetries,
          },
        };
        checkpointMgr.save(checkpoint);
        checkpointCounter = 0;
        console.log(`  [CHECKPOINT] Saved to ${opts.checkpointPath}`);
      }
    }
  }

  // Final checkpoint
  const finalCheckpoint: CheckpointData = {
    version: 1,
    datasetPath: opts.datasetPath,
    datasetHash,
    timestamp: new Date().toISOString(),
    submission,
    workQueue: [],
    workIndex: workQueue.length,
    stats,
    config: {
      modelKey: CONFIG.modelKey,
      reasoningEffort: CONFIG.reasoningEffort,
      maxConcurrent: CONFIG.maxConcurrent,
      launchDelayMs: CONFIG.launchDelayMs,
      maxBackoffMs: CONFIG.maxBackoffMs,
      maxRetries: CONFIG.maxRetries,
    },
  };
  checkpointMgr.save(finalCheckpoint);

  // Write submission
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = `rearc-submission-${timestamp}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(submission, null, 2));

  const elapsedMs = Date.now() - startTime;
  printSummary(stats, dataset, opts.checkpointPath, outputPath, elapsedMs);

  if (isInterrupted) {
    console.log('\nRun interrupted. Resume with: npx tsx scripts/solvers/ReArcFS.ts --dataset <path> --checkpoint <checkpoint-file>');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
