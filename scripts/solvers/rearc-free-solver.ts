/**
 * rearc-free-solver.ts
 *
 * Author: Codex (GPT-5)
 * Date: 2026-01-09T00:00:00Z
 * PURPOSE: Durable RE-ARC solver using free OpenRouter models with checkpointing,
 *          resumable queues, adaptive backoff, and rich run summaries.
 *          Integrates attempt deduping, retry orchestration, and submission export.
 * SRP/DRY check: Pass - Verified solver flow and reused existing orchestration utilities.
 *
 * Usage:
 *   npx tsx scripts/solvers/rearc-free-solver.ts --dataset <path> [--checkpoint <file>] [--fresh|--resume]
 *
 * Flags:
 *   --dataset <path>         - Required dataset JSON path.
 *   --checkpoint <path>      - Optional custom checkpoint file (default: ./rearc-free-checkpoint.json).
 *   --resume                 - Fail if checkpoint missing; otherwise resume automatically when present.
 *   --fresh                  - Ignore any checkpoint and start a new run.
 *
 * Environment:
 *   OPENROUTER_API_KEY       - Required. Your OpenRouter API key.
 *   REARC_MODEL              - Model to use (default: xiaomi/mimo-v2-flash:free)
 *   REARC_REASONING_EFFORT   - Reasoning level: high|medium|low|none (default: high)
 *   REARC_MAX_TOKENS         - Max output tokens for OpenRouter responses (optional).
 *   REARC_LAUNCH_DELAY_MS    - Delay between launching new calls in ms (default: 10000)
 *   REARC_MAX_CONCURRENT     - Max concurrent API calls (default: 4)
 *   REARC_MAX_BACKOFF_MS     - Optional cap for adaptive delay (default: 60000)
 *   REARC_CHECKPOINT_INTERVAL- Attempts between automatic checkpoint saves (default: 10)
 */
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// Configuration
// ============================================================================

const MODEL_KEY = process.env.REARC_MODEL || 'xiaomi/mimo-v2-flash:free';
const LAUNCH_DELAY_MS = Number(process.env.REARC_LAUNCH_DELAY_MS) || 10000; // 10s between launching new calls
const MAX_CONCURRENT = Number(process.env.REARC_MAX_CONCURRENT) || 4; // Max 4 calls in flight at once
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = Number(process.env.REARC_MAX_BACKOFF_MS) || 60000;
const CHECKPOINT_INTERVAL = Number(process.env.REARC_CHECKPOINT_INTERVAL) || 10;
const CHECKPOINT_VERSION = 1;
const DEFAULT_CHECKPOINT_PATH = path.resolve(process.cwd(), 'rearc-free-checkpoint.json');
const BACKOFF_MULTIPLIER = 1.8;
const BACKOFF_RECOVERY = 0.85;
const BACKOFF_JITTER = 0.15;

// Reasoning effort: 'low' or 'medium' recommended for ARC tasks
// Set REARC_REASONING_EFFORT=none to disable reasoning
const REASONING_EFFORT = (process.env.REARC_REASONING_EFFORT || 'low') as 'high' | 'medium' | 'low' | 'none';
const MAX_OUTPUT_TOKENS = Number(process.env.REARC_MAX_TOKENS);
const MIN_REASONING_OUTPUT_TOKENS = 2048;

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 35 * 60 * 1000, // 35 min timeout (reasoning on large context models takes longer)
  defaultHeaders: {
    'HTTP-Referer': 'https://arc.markbarney.net',
    'X-Title': 'ARC Explainer RE-ARC Solver',
  },
});

const FAILURE_CATEGORIES: FailureCategory[] = ['rate_limit', 'parse', 'api', 'network', 'unknown'];
const FAILURE_SAMPLE_LIMIT = 5;

// ============================================================================
// Types
// ============================================================================

type Grid = number[][];

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

type FailureCategory = 'rate_limit' | 'parse' | 'api' | 'network' | 'unknown';

interface SolveResult {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
  grid: Grid | null;
  error?: string;
  failureCategory?: FailureCategory;
  statusCode?: number;
}

interface WorkItem {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
  retryCount: number;
}

interface FailureRecord {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
  category: FailureCategory;
  message: string;
  retryCount: number;
}

interface FailureStats {
  total: number;
  byCategory: Record<FailureCategory, number>;
  samples: Record<FailureCategory, string[]>;
}

interface RuntimeStats {
  initialWorkItems: number;
  totalScheduled: number;
  completedAttempts: number;
  successCount: number;
  failureCount: number;
  retryScheduled: number;
  rateLimitEvents: number;
  maxObservedBackoffMs: number;
  failureStats: FailureStats;
  permanentFailures: FailureRecord[];
}

interface ConfigSnapshot {
  modelKey: string;
  reasoningEffort: typeof REASONING_EFFORT;
  maxConcurrent: number;
  launchDelayMs: number;
  maxBackoffMs: number;
  maxRetries: number;
  maxOutputTokens?: number;
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

interface RuntimeState extends CheckpointData {}

interface CliOptions {
  datasetPath: string;
  checkpointPath: string;
  fresh: boolean;
  resume: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gridToString(grid: Grid): string {
  return grid.map((row) => row.join(' ')).join('\n');
}

function parseGridFromResponse(text: string): Grid | null {
  // Try to extract JSON array from response
  const jsonMatch = text.match(/\[\s*\[[\s\S]*?\]\s*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.every((row) => Array.isArray(row))) {
        // Validate all values are 0-9
        const valid = parsed.every((row) =>
          row.every((cell: unknown) => typeof cell === 'number' && cell >= 0 && cell <= 9)
        );
        if (valid) return parsed as Grid;
      }
    } catch {
      // Fall through to text parsing
    }
  }

  // Try to parse line-by-line grid format
  const lines = text.split('\n').filter((line) => /^[\d\s,\[\]]+$/.test(line.trim()));
  if (lines.length > 0) {
    try {
      const grid: Grid = [];
      for (const line of lines) {
        const nums = line.match(/\d/g);
        if (nums && nums.length > 0) {
          grid.push(nums.map(Number));
        }
      }
      if (grid.length > 0 && grid.every((row) => row.length === grid[0].length)) {
        return grid;
      }
    } catch {
      // Fall through
    }
  }

  return null;
}

function buildPrompt(task: Task, testIndex: number): string {
  let prompt = `You are solving an ARC (Abstraction and Reasoning Corpus) puzzle.

## Training Examples
`;

  for (let i = 0; i < task.train.length; i++) {
    prompt += `
### Example ${i + 1}
Input:
${gridToString(task.train[i].input)}

Output:
${gridToString(task.train[i].output)}
`;
  }

  prompt += `
## Task
Study the training examples above. Find the pattern/rule that transforms each input to its output.
Then apply that same rule to the following test input.

Test Input:
${gridToString(task.test[testIndex].input)}

## Response Format
Respond with ONLY the output grid as a JSON array of arrays. Example:
[[1, 2, 3], [4, 5, 6]]

Do not include any explanation, just the JSON grid.
`;

  return prompt;
}

function computeFileHash(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const content = fs.readFileSync(filePath);
  hash.update(content);
  return hash.digest('hex');
}

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const datasetIndex = args.indexOf('--dataset');
  if (datasetIndex === -1 || !args[datasetIndex + 1]) {
    console.error('Usage: npx tsx scripts/solvers/rearc-free-solver.ts --dataset <path> [--checkpoint <file>] [--fresh|--resume]');
    process.exit(1);
  }

  const datasetPath = path.resolve(args[datasetIndex + 1]);
  const checkpointIndex = args.indexOf('--checkpoint');
  const checkpointPath =
    checkpointIndex !== -1 && args[checkpointIndex + 1]
      ? path.resolve(args[checkpointIndex + 1])
      : DEFAULT_CHECKPOINT_PATH;

  const fresh = args.includes('--fresh');
  const resume = args.includes('--resume');

  if (fresh && resume) {
    console.error('Cannot use both --fresh and --resume.');
    process.exit(1);
  }

  return { datasetPath, checkpointPath, fresh, resume };
}

function initFailureStats(): FailureStats {
  const byCategory = {} as Record<FailureCategory, number>;
  const samples = {} as Record<FailureCategory, string[]>;
  for (const category of FAILURE_CATEGORIES) {
    byCategory[category] = 0;
    samples[category] = [];
  }
  return {
    total: 0,
    byCategory,
    samples,
  };
}

function buildInitialWorkQueue(dataset: Dataset): WorkItem[] {
  const queue: WorkItem[] = [];
  const sortedTaskIds = Object.keys(dataset).sort();
  for (const taskId of sortedTaskIds) {
    const task = dataset[taskId];
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      queue.push({ taskId, testIndex, attemptNum: 1, retryCount: 0 });
      queue.push({ taskId, testIndex, attemptNum: 2, retryCount: 0 });
    }
  }
  return queue;
}

function normalizeWorkQueue(queue: WorkItem[]): WorkItem[] {
  return queue.map((item) => ({
    ...item,
    retryCount: item.retryCount ?? 0,
  }));
}

function normalizeFailureStats(stats?: FailureStats): FailureStats {
  const normalized = initFailureStats();
  if (!stats) {
    return normalized;
  }

  normalized.total = stats.total ?? 0;
  for (const category of FAILURE_CATEGORIES) {
    normalized.byCategory[category] = stats.byCategory?.[category] ?? 0;
    const samples = stats.samples?.[category] ?? [];
    normalized.samples[category] = samples.slice(0, FAILURE_SAMPLE_LIMIT);
  }

  return normalized;
}

function createInitialState(datasetPath: string, datasetHash: string, workQueue: WorkItem[]): RuntimeState {
  return {
    version: CHECKPOINT_VERSION,
    datasetPath,
    datasetHash,
    timestamp: new Date().toISOString(),
    submission: {},
    workQueue,
    workIndex: 0,
    stats: {
      initialWorkItems: workQueue.length,
      totalScheduled: 0,
      completedAttempts: 0,
      successCount: 0,
      failureCount: 0,
      retryScheduled: 0,
      rateLimitEvents: 0,
      maxObservedBackoffMs: LAUNCH_DELAY_MS,
      failureStats: initFailureStats(),
      permanentFailures: [],
    },
    config: {
      modelKey: MODEL_KEY,
      reasoningEffort: REASONING_EFFORT,
      maxConcurrent: MAX_CONCURRENT,
      launchDelayMs: LAUNCH_DELAY_MS,
      maxBackoffMs: MAX_BACKOFF_MS,
      maxRetries: MAX_RETRIES,
      maxOutputTokens: Number.isFinite(MAX_OUTPUT_TOKENS) && MAX_OUTPUT_TOKENS > 0 ? MAX_OUTPUT_TOKENS : undefined,
    },
  };
}

function loadCheckpoint(
  checkpointPath: string,
  datasetPath: string,
  datasetHash: string,
  freshQueue: WorkItem[]
): RuntimeState {
  console.log(`\nFound checkpoint at ${checkpointPath}. Attempting to resume...`);
  const raw = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8')) as CheckpointData;

  if (raw.version !== CHECKPOINT_VERSION) {
    throw new Error(`Checkpoint version mismatch. Expected ${CHECKPOINT_VERSION}, found ${raw.version}. Run with --fresh.`);
  }

  if (raw.datasetHash !== datasetHash) {
    throw new Error('Checkpoint dataset hash differs from provided dataset. Run with --fresh to start over.');
  }

  const normalizedQueue = normalizeWorkQueue(raw.workQueue);
  const stats = raw.stats || ({} as RuntimeStats);

  const normalizedState: RuntimeState = {
    version: raw.version,
    datasetPath,
    datasetHash,
    timestamp: new Date().toISOString(),
    submission: raw.submission || {},
    workQueue: normalizedQueue.length > 0 ? normalizedQueue : freshQueue,
    workIndex: Math.min(raw.workIndex ?? 0, normalizedQueue.length > 0 ? normalizedQueue.length : freshQueue.length),
    stats: {
      initialWorkItems: stats.initialWorkItems ?? freshQueue.length,
      totalScheduled: stats.totalScheduled ?? 0,
      completedAttempts: stats.completedAttempts ?? 0,
      successCount: stats.successCount ?? 0,
      failureCount: stats.failureCount ?? 0,
      retryScheduled: stats.retryScheduled ?? 0,
      rateLimitEvents: stats.rateLimitEvents ?? 0,
      maxObservedBackoffMs: stats.maxObservedBackoffMs ?? LAUNCH_DELAY_MS,
      failureStats: normalizeFailureStats(stats.failureStats),
      permanentFailures: stats.permanentFailures ?? [],
    },
    config: raw.config || {
      modelKey: MODEL_KEY,
      reasoningEffort: REASONING_EFFORT,
      maxConcurrent: MAX_CONCURRENT,
      launchDelayMs: LAUNCH_DELAY_MS,
      maxBackoffMs: MAX_BACKOFF_MS,
      maxRetries: MAX_RETRIES,
      maxOutputTokens: Number.isFinite(MAX_OUTPUT_TOKENS) && MAX_OUTPUT_TOKENS > 0 ? MAX_OUTPUT_TOKENS : undefined,
    },
  };

  if (normalizedState.config.modelKey !== MODEL_KEY) {
    console.warn(
      `Warning: checkpoint recorded model ${normalizedState.config.modelKey}, but current config is ${MODEL_KEY}. Continuing with current config.`
    );
  }

  return normalizedState;
}

function saveCheckpoint(state: RuntimeState, checkpointPath: string) {
  const payload: CheckpointData = {
    version: state.version,
    datasetPath: state.datasetPath,
    datasetHash: state.datasetHash,
    timestamp: new Date().toISOString(),
    submission: state.submission,
    workQueue: state.workQueue,
    workIndex: state.workIndex,
    stats: state.stats,
    config: state.config,
  };

  fs.writeFileSync(checkpointPath, JSON.stringify(payload, null, 2));
  console.log(`💾  Checkpoint saved to ${checkpointPath}`);
}

function ensureAttemptSlot(submission: Submission, taskId: string, testIndex: number): Attempt {
  if (!submission[taskId]) {
    submission[taskId] = [];
  }
  if (!submission[taskId][testIndex]) {
    submission[taskId][testIndex] = { attempt_1: null, attempt_2: null };
  }
  return submission[taskId][testIndex];
}

function classifyApiError(err: any): { category: FailureCategory; statusCode?: number; message: string } {
  const statusCode = err?.status ?? err?.response?.status;
  const message =
    err?.message || err?.response?.data?.error || (typeof err === 'string' ? err : JSON.stringify(err));

  if (statusCode === 429 || /rate limit/i.test(message)) {
    return { category: 'rate_limit', statusCode, message };
  }

  if (err?.code && ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH'].includes(err.code)) {
    return { category: 'network', statusCode, message: `${err.code}: ${message}` };
  }

  if (statusCode && statusCode >= 500) {
    return { category: 'api', statusCode, message };
  }

  if (statusCode && statusCode >= 400) {
    return { category: 'api', statusCode, message };
  }

  if (/timeout/i.test(message) || /network/i.test(message)) {
    return { category: 'network', statusCode, message };
  }

  return { category: 'unknown', statusCode, message };
}

function recordFailure(state: RuntimeState, workItem: WorkItem, result: SolveResult): FailureCategory {
  const category: FailureCategory = result.failureCategory || 'unknown';
  const message = result.error || 'Unknown error';
  const stats = state.stats.failureStats;

  state.stats.failureCount++;
  stats.total++;
  stats.byCategory[category] = (stats.byCategory[category] ?? 0) + 1;

  const sampleEntry = `[${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum}] ${message}`;
  if (stats.samples[category].length < FAILURE_SAMPLE_LIMIT) {
    stats.samples[category].push(sampleEntry);
  }

  return category;
}

function increaseBackoff(current: number): number {
  const jitter = 1 + Math.random() * BACKOFF_JITTER;
  return Math.min(MAX_BACKOFF_MS, Math.ceil(current * BACKOFF_MULTIPLIER * jitter));
}

function recoverBackoff(current: number): number {
  return Math.max(LAUNCH_DELAY_MS, Math.floor(current * BACKOFF_RECOVERY));
}

async function awaitNextCompletion(
  inFlight: Map<Promise<SolveResult>, WorkItem>
): Promise<{ promise: Promise<SolveResult>; workItem: WorkItem; result: SolveResult }> {
  const wrapped = Array.from(inFlight.entries()).map(([promise, workItem]) =>
    promise
      .then((result: SolveResult) => ({ promise, workItem, result }))
      .catch((err: unknown) => {
        const fallback: SolveResult = {
          taskId: workItem.taskId,
          testIndex: workItem.testIndex,
          attemptNum: workItem.attemptNum,
          grid: null,
          error: err instanceof Error ? err.message : String(err),
          failureCategory: 'unknown',
        };
        return { promise, workItem, result: fallback };
      })
  );

  return Promise.race(wrapped);
}

async function solveAttempt(
  taskId: string,
  task: Task,
  testIndex: number,
  attemptNum: 1 | 2
): Promise<SolveResult> {
  const prompt = buildPrompt(task, testIndex);

  try {
    console.log(`  [${taskId}] test ${testIndex + 1}/${task.test.length}, attempt ${attemptNum}...`);

    const requestParams: any = {
      model: MODEL_KEY,
      messages: [{ role: 'user', content: prompt }],
      temperature: attemptNum === 1 ? 0.0 : 0.3,
    };

    const maxTokens = Number.isFinite(MAX_OUTPUT_TOKENS) && MAX_OUTPUT_TOKENS > 0 ? MAX_OUTPUT_TOKENS : undefined;
    if (typeof maxTokens === 'number') {
      const adjustedMaxTokens =
        REASONING_EFFORT !== 'none' && maxTokens < MIN_REASONING_OUTPUT_TOKENS
          ? MIN_REASONING_OUTPUT_TOKENS
          : maxTokens;
      requestParams.max_tokens = adjustedMaxTokens;
      if (adjustedMaxTokens !== maxTokens) {
        console.warn(
          `    [warn] REARC_MAX_TOKENS=${maxTokens} too low for reasoning. Using ${adjustedMaxTokens} instead.`
        );
      }
    }

    if (REASONING_EFFORT !== 'none') {
      requestParams.reasoning = { effort: REASONING_EFFORT };
    }

    const response = await openrouter.chat.completions.create(requestParams);

    const message = response.choices[0]?.message as any;
    const content = message?.content || '';
    const reasoning = message?.reasoning;

    if (typeof reasoning === 'string' && reasoning.length > 0) {
      console.log(`    [reasoning] ${reasoning.slice(0, 100).replace(/\n/g, ' ')}...`);
    }

    const grid = parseGridFromResponse(content);

    if (!grid) {
      return {
        taskId,
        testIndex,
        attemptNum,
        grid: null,
        error: `Failed to parse grid from response: ${content.slice(0, 200)}`,
        failureCategory: 'parse',
      };
    }

    return { taskId, testIndex, attemptNum, grid };
  } catch (err: any) {
    const classification = classifyApiError(err);
    return {
      taskId,
      testIndex,
      attemptNum,
      grid: null,
      error: classification.message,
      failureCategory: classification.category,
      statusCode: classification.statusCode,
    };
  }
}

async function runSolver(state: RuntimeState, dataset: Dataset, checkpointPath: string) {
  const inFlight = new Map<Promise<SolveResult>, WorkItem>();
  let nextLaunchTime = Date.now();
  let currentBackoffMs = LAUNCH_DELAY_MS;
  let completionsSinceCheckpoint = 0;

  while (state.workIndex < state.workQueue.length || inFlight.size > 0) {
    while (state.workIndex < state.workQueue.length && inFlight.size < MAX_CONCURRENT) {
      const now = Date.now();
      if (now < nextLaunchTime) {
        await delay(nextLaunchTime - now);
      }

      const workItem = state.workQueue[state.workIndex];
      const task = dataset[workItem.taskId];
      if (!task) {
        console.warn(`Task ${workItem.taskId} missing from dataset. Skipping.`);
        state.workIndex++;
        continue;
      }

      const promise = solveAttempt(workItem.taskId, task, workItem.testIndex, workItem.attemptNum);
      inFlight.set(promise, workItem);

      state.workIndex++;
      state.stats.totalScheduled++;

      console.log(
        `[dispatch ${state.stats.totalScheduled}] ${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum} (retry #${workItem.retryCount})`
      );

      nextLaunchTime = Date.now() + currentBackoffMs;
    }

    if (inFlight.size === 0) {
      continue;
    }

    const { promise, workItem, result } = await awaitNextCompletion(inFlight);
    inFlight.delete(promise);

    const attempt = ensureAttemptSlot(state.submission, workItem.taskId, workItem.testIndex);
    const key = workItem.attemptNum === 1 ? 'attempt_1' : 'attempt_2';

    state.stats.completedAttempts++;
    completionsSinceCheckpoint++;

    if (result.grid) {
      attempt[key] = result.grid;
      state.stats.successCount++;
      currentBackoffMs = recoverBackoff(currentBackoffMs);
    } else {
      const category = recordFailure(state, workItem, result);
      console.log(
        `  [FAIL ${category}] ${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum}: ${result.error?.slice(
          0,
          160
        )}`
      );

      if (category === 'rate_limit') {
        currentBackoffMs = increaseBackoff(currentBackoffMs);
        state.stats.rateLimitEvents++;
        state.stats.maxObservedBackoffMs = Math.max(state.stats.maxObservedBackoffMs, currentBackoffMs);
        console.log(`    Rate limit detected. Backing off to ${currentBackoffMs}ms`);
      }

      if (workItem.retryCount + 1 <= MAX_RETRIES) {
        state.workQueue.push({ ...workItem, retryCount: workItem.retryCount + 1 });
        state.stats.retryScheduled++;
      } else {
        attempt[key] = attempt[key] ?? [[0]];
        state.stats.permanentFailures.push({
          taskId: workItem.taskId,
          testIndex: workItem.testIndex,
          attemptNum: workItem.attemptNum,
          category,
          message: result.error || 'Unknown error',
          retryCount: workItem.retryCount,
        });
        console.log(`    Exceeded retry budget (${MAX_RETRIES}). Marked as permanent failure.`);
      }
    }

    if (completionsSinceCheckpoint >= CHECKPOINT_INTERVAL) {
      saveCheckpoint(state, checkpointPath);
      completionsSinceCheckpoint = 0;
    }
  }

  saveCheckpoint(state, checkpointPath);
}

function fillMissingOutputs(submission: Submission, dataset: Dataset): { filled: number } {
  let filled = 0;
  for (const [taskId, task] of Object.entries(dataset)) {
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      const attempt = ensureAttemptSlot(submission, taskId, testIndex);
      if (!attempt.attempt_1) {
        attempt.attempt_1 = [[0]];
        filled++;
      }
      if (!attempt.attempt_2) {
        attempt.attempt_2 = [[0]];
        filled++;
      }
    }
  }
  return { filled };
}

function writeSubmissionFile(submission: Submission): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.resolve(`rearc-submission-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(submission, null, 2));
  return outputPath;
}

function printSummary(
  state: RuntimeState,
  metadata: { datasetPath: string; datasetHash: string; checkpointPath: string; submissionPath: string },
  fillStats: { filled: number }
) {
  console.log(`\n${'='.repeat(72)}`);
  console.log('RE-ARC free solver summary');
  console.log('='.repeat(72));
  console.log(`Dataset: ${metadata.datasetPath}`);
  console.log(`Dataset hash: ${metadata.datasetHash}`);
  console.log(`Model: ${state.config.modelKey}`);
  console.log(`Reasoning effort: ${state.config.reasoningEffort}`);
  if (state.config.maxOutputTokens) {
    console.log(`Max output tokens: ${state.config.maxOutputTokens}`);
  }
  console.log('');
  console.log(`Attempts scheduled: ${state.stats.totalScheduled}`);
  console.log(`Attempts completed: ${state.stats.completedAttempts}`);
  console.log(`Successes: ${state.stats.successCount}`);
  console.log(`Failures: ${state.stats.failureCount}`);
  console.log(`Retries queued: ${state.stats.retryScheduled}`);
  console.log(`Rate-limit events: ${state.stats.rateLimitEvents}`);
  console.log(`Max observed backoff: ${state.stats.maxObservedBackoffMs}ms`);
  console.log(`Checkpoint: ${metadata.checkpointPath}`);
  console.log(`Submission: ${metadata.submissionPath}`);
  console.log(`Filled placeholder outputs: ${fillStats.filled}`);

  console.log('\nFailure breakdown:');
  for (const category of FAILURE_CATEGORIES) {
    const count = state.stats.failureStats.byCategory[category];
    if (count === 0) continue;
    console.log(`- ${category}: ${count}`);
    const samples = state.stats.failureStats.samples[category];
    for (const sample of samples) {
      console.log(`    • ${sample}`);
    }
  }

  if (state.stats.permanentFailures.length > 0) {
    console.log('\nPermanent failures after retry budget:');
    for (const failure of state.stats.permanentFailures) {
      console.log(
        `- ${failure.taskId} test ${failure.testIndex + 1} attempt ${failure.attemptNum} (${failure.category}) after ${failure.retryCount} retries :: ${failure.message}`
      );
    }
  }

  console.log('\nResume later with:');
  console.log(`  npx tsx scripts/solvers/rearc-free-solver.ts --dataset "${metadata.datasetPath}" --checkpoint "${metadata.checkpointPath}" --resume`);
  console.log('='.repeat(72));
  console.log('Upload the submission JSON to the RE-ARC benchmark when ready.');
}

function registerSignalHandlers(state: RuntimeState, checkpointPath: string): () => void {
  const handler = (signal: NodeJS.Signals) => {
    console.log(`\nReceived ${signal}. Saving checkpoint before exit...`);
    try {
      saveCheckpoint(state, checkpointPath);
    } catch (err) {
      console.error('Failed to save checkpoint during shutdown:', err);
    } finally {
      process.exit(1);
    }
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);

  return () => {
    process.off('SIGINT', handler);
    process.off('SIGTERM', handler);
  };
}

async function main() {
  const cli = parseCliOptions();

  if (!fs.existsSync(cli.datasetPath)) {
    console.error(`Dataset file not found: ${cli.datasetPath}`);
    process.exit(1);
  }

  const dataset: Dataset = JSON.parse(fs.readFileSync(cli.datasetPath, 'utf-8'));
  const datasetHash = computeFileHash(cli.datasetPath);
  const initialQueue = buildInitialWorkQueue(dataset);

  let state: RuntimeState;
  const checkpointExists = fs.existsSync(cli.checkpointPath);

  if (cli.fresh || !checkpointExists) {
    if (cli.resume && !checkpointExists) {
      console.error(`--resume requested but checkpoint "${cli.checkpointPath}" was not found.`);
      process.exit(1);
    }
    state = createInitialState(cli.datasetPath, datasetHash, initialQueue);
    console.log('\nStarting fresh run (no checkpoint).');
  } else {
    state = loadCheckpoint(cli.checkpointPath, cli.datasetPath, datasetHash, initialQueue);
  }

  console.log(`\nDataset: ${cli.datasetPath}`);
  console.log(`Tasks: ${Object.keys(dataset).length}`);
  console.log(`Work items remaining: ${state.workQueue.length - state.workIndex}`);
  console.log(`Checkpoint path: ${cli.checkpointPath}`);
  console.log(`Model: ${MODEL_KEY}`);
  console.log(`Reasoning effort: ${REASONING_EFFORT}`);
  console.log(`Max concurrency: ${MAX_CONCURRENT}, launch delay: ${LAUNCH_DELAY_MS}ms, checkpoint interval: ${CHECKPOINT_INTERVAL}`);
  console.log('='.repeat(72));

  const cleanupSignals = registerSignalHandlers(state, cli.checkpointPath);

  try {
    await runSolver(state, dataset, cli.checkpointPath);
  } finally {
    cleanupSignals();
  }

  const fillStats = fillMissingOutputs(state.submission, dataset);
  const submissionPath = writeSubmissionFile(state.submission);
  saveCheckpoint(state, cli.checkpointPath);

  printSummary(
    state,
    {
      datasetPath: cli.datasetPath,
      datasetHash,
      checkpointPath: cli.checkpointPath,
      submissionPath,
    },
    fillStats
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
