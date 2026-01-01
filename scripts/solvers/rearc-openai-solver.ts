/**
 * Author: Cascade (ChatGPT)
 * Date: 2025-12-31
 * PURPOSE: OpenAI-native RE-ARC solver that mirrors the hardened ReArcFS flow
 *          while calling gpt-5.1-codex-mini via the OpenAI Responses API.
 *          Handles checkpointing, resumable queues, adaptive backoff, and
 *          structured failure reporting for the REARC2026.json dataset.
 * SRP/DRY check: Pass — new script encapsulates OpenAI integration without
 *          altering existing OpenRouter solvers; helpers keep concerns isolated.
 *
 * Usage:
 *   npx tsx scripts/solvers/rearc-openai-solver.ts --dataset <path>
 *        [--checkpoint <file>] [--fresh|--resume]
 *
 * Required env:
 *   OPENAI_API_KEY          - OpenAI native API key
 *
 * Optional env:
 *   REARC_MODEL             - Defaults to gpt-5.1-codex-mini
 *   REARC_REASONING_EFFORT  - high|medium|low|none (default: high)
 *   REARC_LAUNCH_DELAY_MS   - Base delay between launches (default: 7500)
 *   REARC_MAX_CONCURRENT    - Max concurrent calls (default: 4)
 *   REARC_MAX_BACKOFF_MS    - Cap for adaptive backoff (default: 60000)
 *   REARC_CHECKPOINT_INTERVAL - Attempts between checkpoint saves (default: 12)
 */

import OpenAI from 'openai';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CONFIG = {
  modelKey: process.env.REARC_MODEL || 'gpt-5.1-codex-mini',
  reasoningEffort: (process.env.REARC_REASONING_EFFORT || 'high') as 'high' | 'medium' | 'low' | 'none',
  launchDelayMs: Number(process.env.REARC_LAUNCH_DELAY_MS) || 7500,
  maxConcurrent: Number(process.env.REARC_MAX_CONCURRENT) || 4,
  maxBackoffMs: Number(process.env.REARC_MAX_BACKOFF_MS) || 60000,
  checkpointInterval: Number(process.env.REARC_CHECKPOINT_INTERVAL) || 12,
  maxRetries: 3,
};

const DEFAULT_DATASET = path.resolve(process.cwd(), 'REARC2026.json');
const DEFAULT_CHECKPOINT_PATH = path.resolve(process.cwd(), 'rearc-openai-checkpoint.json');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 35 * 60 * 1000,
});

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY. Set it before running the solver.');
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

interface RuntimeState extends CheckpointData {}

interface CliOptions {
  datasetPath: string;
  checkpointPath: string;
  fresh: boolean;
  resume: boolean;
}

const FAILURE_SAMPLE_LIMIT = 5;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeFileHash(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function gridToString(grid: Grid): string {
  return grid.map((row) => row.join(' ')).join('\n');
}

function parseGridFromResponse(text: string): Grid | null {
  const jsonMatch = text.match(/\[\s*\[[\s\S]*?\]\s*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.every((row) => Array.isArray(row))) {
        const valid = parsed.every((row) =>
          row.every((cell: unknown) => typeof cell === 'number' && cell >= 0 && cell <= 9)
        );
        if (valid) {
          return parsed as Grid;
        }
      }
    } catch {
      // fallthrough
    }
  }

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
      // fallthrough
    }
  }

  return null;
}

function extractResponseText(response: any): string {
  if (!response) return '';

  if (typeof response.output_text === 'string' && response.output_text.trim().length > 0) {
    return response.output_text;
  }

  if (Array.isArray(response.output_text) && response.output_text.length > 0) {
    return response.output_text.join('\n');
  }

  if (Array.isArray(response.output)) {
    for (const block of response.output) {
      if (block.type === 'output_text' && typeof block.text === 'string') {
        return block.text;
      }
      if (block.type === 'message' && Array.isArray(block.content)) {
        const textChunk = block.content.find((part: any) => part.type === 'output_text');
        if (textChunk?.text) {
          return textChunk.text;
        }
      }
      if (block.type === 'text' && typeof block.text === 'string') {
        return block.text;
      }
    }
  }

  if (Array.isArray(response.content)) {
    const textChunk = response.content.find((part: any) => typeof part.text === 'string');
    if (textChunk?.text) {
      return textChunk.text;
    }
  }

  return '';
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
Study the training examples above. Find the rule that transforms each input into its output.
Then apply that rule to the following test input.

Test Input:
${gridToString(task.test[testIndex].input)}

## Response Format
Respond with ONLY the output grid as a JSON array of arrays, e.g.:
[[1,2,3],[4,5,6]]

No narration or explanation.
`;

  return prompt;
}

// -----------------------------------------------------------------------------
// Failure Categorization
// -----------------------------------------------------------------------------

function classifyApiError(err: unknown): { category: FailureCategory; statusCode?: number; message: string } {
  const anyErr = err as any;
  const statusCode = anyErr?.status ?? anyErr?.response?.status ?? anyErr?.statusCode;
  const message =
    anyErr?.message ||
    anyErr?.error?.message ||
    anyErr?.response?.data?.error?.message ||
    JSON.stringify(anyErr);

  if (statusCode === 429 || /rate limit/i.test(message)) {
    return { category: 'rate_limit', statusCode, message };
  }
  if (/ECONNRESET|ETIMEDOUT|ENETUNREACH|EAI_AGAIN/.test(message)) {
    return { category: 'network', statusCode, message };
  }
  if (statusCode && statusCode >= 500) {
    return { category: 'api', statusCode, message };
  }
  if (statusCode && statusCode >= 400) {
    return { category: 'api', statusCode, message };
  }
  if (/parse error|JSON/i.test(message)) {
    return { category: 'parse', statusCode, message };
  }
  return { category: 'unknown', statusCode, message };
}

function recordFailure(stats: RuntimeState['stats'], workItem: WorkItem, category: FailureCategory, message: string) {
  stats.failureCount++;
  stats.failureStats.total++;
  stats.failureStats.byCategory[category]++;
  const entry = `[${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum}] ${message}`;
  if (stats.failureStats.samples[category].length < FAILURE_SAMPLE_LIMIT) {
    stats.failureStats.samples[category].push(entry);
  }
}

// -----------------------------------------------------------------------------
// Adaptive Backoff
// -----------------------------------------------------------------------------

class AdaptiveBackoff {
  private current: number;

  constructor(
    private readonly baseMs: number,
    private readonly maxMs: number,
    private readonly multiplier = 1.8,
    private readonly recovery = 0.9
  ) {
    this.current = baseMs;
  }

  onSuccess() {
    this.current = Math.max(this.baseMs, Math.floor(this.current * this.recovery));
  }

  onRateLimit() {
    this.current = Math.min(this.maxMs, Math.ceil(this.current * this.multiplier));
  }

  getDelayWithJitter(): number {
    const jitter = this.current * 0.15 * (Math.random() - 0.5);
    return Math.max(this.baseMs, this.current + jitter);
  }

  getCurrent(): number {
    return this.current;
  }
}

// -----------------------------------------------------------------------------
// CLI + State Helpers
// -----------------------------------------------------------------------------

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const datasetIndex = args.indexOf('--dataset');

  if (datasetIndex === -1 || !args[datasetIndex + 1]) {
    console.error('Usage: npx tsx scripts/solvers/rearc-openai-solver.ts --dataset <path> [--checkpoint <file>] [--fresh|--resume]');
    process.exit(1);
  }

  const datasetPath = path.resolve(args[datasetIndex + 1] || DEFAULT_DATASET);
  const checkpointIndex = args.indexOf('--checkpoint');
  const checkpointPath =
    checkpointIndex !== -1 && args[checkpointIndex + 1]
      ? path.resolve(args[checkpointIndex + 1])
      : DEFAULT_CHECKPOINT_PATH;

  const fresh = args.includes('--fresh');
  const resume = args.includes('--resume');

  if (fresh && resume) {
    console.error('Cannot use --fresh and --resume simultaneously.');
    process.exit(1);
  }

  return { datasetPath, checkpointPath, fresh, resume };
}

function initFailureStats(): FailureStats {
  return {
    total: 0,
    byCategory: { rate_limit: 0, parse: 0, api: 0, network: 0, unknown: 0 },
    samples: { rate_limit: [], parse: [], api: [], network: [], unknown: [] },
  };
}

function buildInitialQueue(dataset: Dataset): WorkItem[] {
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

function ensureAttemptSlot(submission: Submission, taskId: string, testIndex: number): Attempt {
  if (!submission[taskId]) {
    submission[taskId] = [];
  }
  if (!submission[taskId][testIndex]) {
    submission[taskId][testIndex] = { attempt_1: null, attempt_2: null };
  }
  return submission[taskId][testIndex];
}

function createInitialState(datasetPath: string, datasetHash: string, queue: WorkItem[]): RuntimeState {
  return {
    version: 1,
    datasetPath,
    datasetHash,
    timestamp: new Date().toISOString(),
    submission: {},
    workQueue: queue,
    workIndex: 0,
    stats: {
      initialWorkItems: queue.length,
      totalScheduled: 0,
      completedAttempts: 0,
      successCount: 0,
      failureCount: 0,
      retryScheduled: 0,
      rateLimitEvents: 0,
      maxObservedBackoffMs: CONFIG.launchDelayMs,
      failureStats: initFailureStats(),
      permanentFailures: [],
    },
    config: {
      modelKey: CONFIG.modelKey,
      reasoningEffort: CONFIG.reasoningEffort,
      maxConcurrent: CONFIG.maxConcurrent,
      launchDelayMs: CONFIG.launchDelayMs,
      maxBackoffMs: CONFIG.maxBackoffMs,
      maxRetries: CONFIG.maxRetries,
    },
  };
}

function normalizeQueue(queue: WorkItem[] | undefined, fresh: WorkItem[]): WorkItem[] {
  if (!queue || queue.length === 0) {
    return fresh;
  }
  return queue.map((item) => ({ ...item, retryCount: item.retryCount ?? 0 }));
}

function normalizeFailureStats(stats?: FailureStats): FailureStats {
  if (!stats) {
    return initFailureStats();
  }
  return {
    total: stats.total ?? 0,
    byCategory: {
      rate_limit: stats.byCategory?.rate_limit ?? 0,
      parse: stats.byCategory?.parse ?? 0,
      api: stats.byCategory?.api ?? 0,
      network: stats.byCategory?.network ?? 0,
      unknown: stats.byCategory?.unknown ?? 0,
    },
    samples: {
      rate_limit: stats.samples?.rate_limit?.slice(0, FAILURE_SAMPLE_LIMIT) ?? [],
      parse: stats.samples?.parse?.slice(0, FAILURE_SAMPLE_LIMIT) ?? [],
      api: stats.samples?.api?.slice(0, FAILURE_SAMPLE_LIMIT) ?? [],
      network: stats.samples?.network?.slice(0, FAILURE_SAMPLE_LIMIT) ?? [],
      unknown: stats.samples?.unknown?.slice(0, FAILURE_SAMPLE_LIMIT) ?? [],
    },
  };
}

function loadCheckpoint(
  checkpointPath: string,
  datasetPath: string,
  datasetHash: string,
  freshQueue: WorkItem[]
): RuntimeState | null {
  if (!fs.existsSync(checkpointPath)) {
    return null;
  }

  try {
    const raw: CheckpointData = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    if (raw.datasetPath !== datasetPath || raw.datasetHash !== datasetHash) {
      console.warn('Checkpoint dataset mismatch. Ignoring stored progress.');
      return null;
    }

    return {
      version: raw.version,
      datasetPath,
      datasetHash,
      timestamp: new Date().toISOString(),
      submission: raw.submission || {},
      workQueue: normalizeQueue(raw.workQueue, freshQueue),
      workIndex: Math.min(raw.workIndex ?? 0, raw.workQueue?.length ?? freshQueue.length),
      stats: {
        initialWorkItems: raw.stats?.initialWorkItems ?? freshQueue.length,
        totalScheduled: raw.stats?.totalScheduled ?? 0,
        completedAttempts: raw.stats?.completedAttempts ?? 0,
        successCount: raw.stats?.successCount ?? 0,
        failureCount: raw.stats?.failureCount ?? 0,
        retryScheduled: raw.stats?.retryScheduled ?? 0,
        rateLimitEvents: raw.stats?.rateLimitEvents ?? 0,
        maxObservedBackoffMs: raw.stats?.maxObservedBackoffMs ?? CONFIG.launchDelayMs,
        failureStats: normalizeFailureStats(raw.stats?.failureStats),
        permanentFailures: raw.stats?.permanentFailures ?? [],
      },
      config: raw.config || {
        modelKey: CONFIG.modelKey,
        reasoningEffort: CONFIG.reasoningEffort,
        maxConcurrent: CONFIG.maxConcurrent,
        launchDelayMs: CONFIG.launchDelayMs,
        maxBackoffMs: CONFIG.maxBackoffMs,
        maxRetries: CONFIG.maxRetries,
      },
    };
  } catch (err) {
    console.warn(`Failed to load checkpoint (${checkpointPath}):`, err);
    return null;
  }
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

// -----------------------------------------------------------------------------
// OpenAI Invocation
// -----------------------------------------------------------------------------

async function solveAttempt(taskId: string, task: Task, testIndex: number, attemptNum: 1 | 2): Promise<SolveResult> {
  const prompt = buildPrompt(task, testIndex);
  const temperature = attemptNum === 1 ? 0 : 0.3;

  try {
    const response = await openai.responses.create({
      model: CONFIG.modelKey,
      input: [{ role: 'user', content: prompt }],
      temperature,
      max_output_tokens: 8192,
      reasoning: CONFIG.reasoningEffort !== 'none' ? { effort: CONFIG.reasoningEffort } : undefined,
      text: CONFIG.reasoningEffort !== 'none' ? { verbosity: 'high' } : undefined,
    });

    const content = extractResponseText(response).trim();
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
  } catch (err) {
    const classified = classifyApiError(err);
    return {
      taskId,
      testIndex,
      attemptNum,
      grid: null,
      error: classified.message,
      failureCategory: classified.category,
      statusCode: classified.statusCode,
    };
  }
}

// -----------------------------------------------------------------------------
// Solver Core
// -----------------------------------------------------------------------------

async function runSolver(state: RuntimeState, dataset: Dataset, checkpointPath: string) {
  const backoff = new AdaptiveBackoff(CONFIG.launchDelayMs, CONFIG.maxBackoffMs);
  const inFlight = new Map<Promise<SolveResult>, WorkItem>();
  let nextLaunchTime = Date.now();
  let completionsSinceCheckpoint = 0;

  while (state.workIndex < state.workQueue.length || inFlight.size > 0) {
    while (state.workIndex < state.workQueue.length && inFlight.size < CONFIG.maxConcurrent) {
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

      state.stats.totalScheduled++;
      state.workIndex++;

      console.log(
        `[dispatch ${state.stats.totalScheduled}] ${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum} (retry #${workItem.retryCount})`
      );

      nextLaunchTime = Date.now() + backoff.getDelayWithJitter();
    }

    if (inFlight.size === 0) {
      continue;
    }

    const wrapped = Array.from(inFlight.entries()).map(([promise, workItem]) =>
      promise
        .then((result: SolveResult) => ({ promise, workItem, result }))
        .catch((err: unknown) => ({
          promise,
          workItem,
          result: {
            taskId: workItem.taskId,
            testIndex: workItem.testIndex,
            attemptNum: workItem.attemptNum,
            grid: null,
            error: err instanceof Error ? err.message : String(err),
            failureCategory: 'unknown' as FailureCategory,
          },
        }))
    );

    const settled = await Promise.race(wrapped);
    inFlight.delete(settled.promise);

    const attempt = ensureAttemptSlot(state.submission, settled.workItem.taskId, settled.workItem.testIndex);
    const key = settled.workItem.attemptNum === 1 ? 'attempt_1' : 'attempt_2';

    state.stats.completedAttempts++;
    completionsSinceCheckpoint++;

    if (settled.result.grid) {
      attempt[key] = settled.result.grid;
      state.stats.successCount++;
      backoff.onSuccess();
    } else {
      const category = settled.result.failureCategory || 'unknown';
      recordFailure(state.stats, settled.workItem, category, settled.result.error || 'Unknown error');

      if (category === 'rate_limit') {
        state.stats.rateLimitEvents++;
        backoff.onRateLimit();
        state.stats.maxObservedBackoffMs = Math.max(state.stats.maxObservedBackoffMs, backoff.getCurrent());
        console.log(`  [RATE LIMIT] backing off to ${backoff.getCurrent()}ms`);
      }

      if (settled.workItem.retryCount + 1 <= CONFIG.maxRetries) {
        state.workQueue.push({ ...settled.workItem, retryCount: settled.workItem.retryCount + 1 });
        state.stats.retryScheduled++;
      } else {
        state.stats.permanentFailures.push({
          taskId: settled.workItem.taskId,
          testIndex: settled.workItem.testIndex,
          attemptNum: settled.workItem.attemptNum,
          category,
          message: settled.result.error || 'Unknown error',
          retryCount: settled.workItem.retryCount,
        });
        attempt[key] = attempt[key] ?? [[0]];
        console.log(`  [FAIL] ${settled.workItem.taskId} test ${settled.workItem.testIndex + 1} attempt ${settled.workItem.attemptNum}: ${settled.result.error?.slice(0, 160)}`);
      }
    }

    if (completionsSinceCheckpoint >= CONFIG.checkpointInterval) {
      saveCheckpoint(state, checkpointPath);
      completionsSinceCheckpoint = 0;
    }
  }

  saveCheckpoint(state, checkpointPath);
}

function fillMissing(submission: Submission, dataset: Dataset): number {
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
  return filled;
}

function writeSubmission(submission: Submission): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.resolve(`rearc-submission-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(submission, null, 2));
  return outPath;
}

function printSummary(
  state: RuntimeState,
  meta: { datasetPath: string; datasetHash: string; checkpointPath: string; submissionPath: string },
  fillStats: { filled: number },
  elapsedMs: number
) {
  console.log('\n' + '='.repeat(72));
  console.log('OpenAI RE-ARC Solver Summary');
  console.log('='.repeat(72));
  console.log(`Dataset:            ${meta.datasetPath}`);
  console.log(`Dataset hash:       ${meta.datasetHash}`);
  console.log(`Model:              ${state.config.modelKey}`);
  console.log(`Reasoning effort:   ${state.config.reasoningEffort}`);
  console.log('');
  console.log(`Attempts scheduled: ${state.stats.totalScheduled}`);
  console.log(`Attempts completed: ${state.stats.completedAttempts}`);
  console.log(`Successes:          ${state.stats.successCount}`);
  console.log(`Failures:           ${state.stats.failureCount}`);
  console.log(`Retries queued:     ${state.stats.retryScheduled}`);
  console.log(`Rate-limit events:  ${state.stats.rateLimitEvents}`);
  console.log(`Max backoff:        ${state.stats.maxObservedBackoffMs}ms`);
  console.log(`Checkpoint:         ${meta.checkpointPath}`);
  console.log(`Submission:         ${meta.submissionPath}`);
  console.log(`Placeholders filled:${fillStats.filled}`);
  console.log(`Elapsed:            ${(elapsedMs / 1000).toFixed(1)}s`);

  console.log('\nFailure breakdown:');
  for (const category of ['rate_limit', 'parse', 'api', 'network', 'unknown'] as FailureCategory[]) {
    const count = state.stats.failureStats.byCategory[category];
    if (count === 0) continue;
    console.log(`- ${category}: ${count}`);
    for (const sample of state.stats.failureStats.samples[category]) {
      console.log(`    • ${sample}`);
    }
  }

  if (state.stats.permanentFailures.length > 0) {
    console.log('\nPermanent failures:');
    for (const failure of state.stats.permanentFailures.slice(0, 10)) {
      console.log(
        `- ${failure.taskId} test ${failure.testIndex + 1} attempt ${failure.attemptNum} (${failure.category}) after ${failure.retryCount} retries :: ${failure.message}`
      );
    }
    if (state.stats.permanentFailures.length > 10) {
      console.log(`  ... plus ${state.stats.permanentFailures.length - 10} more`);
    }
  }
  console.log('='.repeat(72));
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const cli = parseCliOptions();

  if (!fs.existsSync(cli.datasetPath)) {
    console.error(`Dataset not found: ${cli.datasetPath}`);
    process.exit(1);
  }

  const dataset: Dataset = JSON.parse(fs.readFileSync(cli.datasetPath, 'utf-8'));
  const datasetHash = computeFileHash(cli.datasetPath);
  const initialQueue = buildInitialQueue(dataset);
  let state: RuntimeState | null = null;

  if (!cli.fresh) {
    state = loadCheckpoint(cli.checkpointPath, cli.datasetPath, datasetHash, initialQueue);
    if (!state && cli.resume) {
      console.error(`--resume specified but checkpoint missing or incompatible at ${cli.checkpointPath}`);
      process.exit(1);
    }
  }

  if (!state) {
    state = createInitialState(cli.datasetPath, datasetHash, initialQueue);
  }

  for (const taskId of Object.keys(dataset)) {
    const task = dataset[taskId];
    state.submission[taskId] ??= Array(task.test.length)
      .fill(null)
      .map(() => ({ attempt_1: null, attempt_2: null }));
  }

  console.log(`Dataset:      ${cli.datasetPath}`);
  console.log(`Checkpoint:   ${cli.checkpointPath}`);
  console.log(`Model:        ${CONFIG.modelKey}`);
  console.log(`Reasoning:    ${CONFIG.reasoningEffort}`);
  console.log(`Work items:   ${state.workQueue.length}`);

  const cleanup = () => {
    try {
      saveCheckpoint(state!, cli.checkpointPath);
    } catch (err) {
      console.error('Failed to save checkpoint during shutdown:', err);
    }
  };

  process.on('SIGINT', () => {
    console.log('\n[SIGINT] Saving checkpoint and exiting...');
    cleanup();
    process.exit(1);
  });
  process.on('SIGTERM', () => {
    console.log('\n[SIGTERM] Saving checkpoint and exiting...');
    cleanup();
    process.exit(1);
  });

  const startMs = Date.now();
  await runSolver(state, dataset, cli.checkpointPath);

  const filled = fillMissing(state.submission, dataset);
  const submissionPath = writeSubmission(state.submission);
  saveCheckpoint(state, cli.checkpointPath);

  printSummary(
    state,
    {
      datasetPath: cli.datasetPath,
      datasetHash,
      checkpointPath: cli.checkpointPath,
      submissionPath,
    },
    { filled },
    Date.now() - startMs
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
