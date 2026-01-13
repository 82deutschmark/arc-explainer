/**
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-09
 * PURPOSE: Per-task chained RE-ARC solver that launches attempt 2
 *          immediately after each attempt 1 completes while persisting
 *          checkpoints and streaming console progress for GPT-5-mini.
 * SRP/DRY check: Pass — shared helpers reused, orchestration isolated.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

// =============================================================================
// Config
// =============================================================================

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

const DATASET_PATH = path.resolve(process.cwd(), '2026RealRearc.json');
const CHECKPOINT_PATH = path.resolve(process.cwd(), 'rearc-gpt5mini-chained-checkpoint.json');
const MODEL = 'gpt-5-nano';
const REASONING_EFFORT: 'medium' | 'high' = 'medium';
const DEFAULT_CONCURRENCY = Number(process.env.REARC_SOLVER_CONCURRENCY ?? '4');
const LAUNCH_DELAY_MS = Number(process.env.REARC_SOLVER_LAUNCH_DELAY_MS ?? '400');
const CHECKPOINT_INTERVAL_MS = 60_000;

const openai = new OpenAI({ apiKey: API_KEY, timeout: 10 * 60 * 1000 });

// =============================================================================
// Types
// =============================================================================

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

interface Prediction {
  attempt_1: Grid | null;
  attempt_2: Grid | null;
}

interface TaskState {
  predictions: Prediction[];
  attempt1Complete: boolean;
  attempt2Complete: boolean;
  attempt1ConversationId?: string;
  attempt2ConversationId?: string;
  lastError?: string;
}

interface SubmissionState {
  [taskId: string]: TaskState;
}

interface ARCSubmission {
  [taskId: string]: { attempt_1: Grid; attempt_2: Grid }[];
}

interface Checkpoint {
  version: number;
  datasetHash: string;
  submission: SubmissionState;
  attempt1Done: number;
  attempt2Done: number;
  failed: number;
}

interface AttemptOutcome {
  ok: boolean;
  grids: Grid[];
  conversationId?: string;
  error?: string;
  durationMs: number;
}

// =============================================================================
// Utilities
// =============================================================================

const DEFAULT_GRID: Grid = [[0]];

function computeHash(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMs(ms: number): string {
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function ensureSubmissionState(dataset: Dataset, existing?: SubmissionState): SubmissionState {
  const state: SubmissionState = existing ?? {};
  for (const taskId of Object.keys(dataset)) {
    const task = dataset[taskId];
    if (!state[taskId]) {
      state[taskId] = {
        predictions: task.test.map(() => ({ attempt_1: null, attempt_2: null })),
        attempt1Complete: false,
        attempt2Complete: false,
      };
    } else if (state[taskId].predictions.length !== task.test.length) {
      // Safety: align lengths if dataset changed.
      state[taskId].predictions = task.test.map((_, idx) => state[taskId].predictions[idx] ?? { attempt_1: null, attempt_2: null });
    }
  }
  return state;
}

function getZodSchema(numTestCases: number) {
  return z.object({
    grids: z
      .array(z.array(z.array(z.number().int().min(0).max(9))))
      .length(numTestCases),
  });
}

function buildAttempt1Prompt(task: Task): string {
  const lines: string[] = [];
  lines.push('You are solving an ARC puzzle. You have TWO attempts and this is ATTEMPT 1.');
  lines.push('');
  lines.push('TRAINING EXAMPLES:');
  task.train.forEach((pair, idx) => {
    lines.push(`Example ${idx + 1}:`);
    lines.push(`INPUT: ${JSON.stringify(pair.input)}`);
    lines.push(`OUTPUT: ${JSON.stringify(pair.output)}`);
    lines.push('');
  });
  lines.push('TEST CASES (predict outputs):');
  task.test.forEach((tc, idx) => {
    lines.push(`Test ${idx + 1}: ${JSON.stringify(tc.input)}`);
  });
  lines.push('');
  lines.push('Respond with JSON containing grids for each test case.');
  return lines.join('\n');
}

function buildAttempt2Prompt(task: Task, attempt1Grids: Grid[]): string {
  const lines: string[] = [];
  lines.push('ATTEMPT 2 — FINAL TRY.');
  lines.push('Your first attempt produced:');
  attempt1Grids.forEach((grid, idx) => {
    lines.push(`Test ${idx + 1}: ${JSON.stringify(grid)}`);
  });
  lines.push('');
  lines.push('Deliver a DIFFERENT interpretation. Do not repeat attempt 1 outputs.');
  lines.push('Explain your alternative reasoning briefly, then output JSON grids.');
  return lines.join('\n');
}

async function solveAttempt(
  taskId: string,
  attemptNum: 1 | 2,
  task: Task,
  conversationId?: string,
  attempt1Grids?: Grid[]
): Promise<AttemptOutcome> {
  const numTestCases = task.test.length;
  const prompt = attemptNum === 1 ? buildAttempt1Prompt(task) : buildAttempt2Prompt(task, attempt1Grids ?? []);
  const schema = getZodSchema(numTestCases);
  const started = Date.now();

  try {
    const response = await openai.responses.parse({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      store: true,
      conversation: conversationId,
      reasoning: { effort: REASONING_EFFORT, summary: 'auto' },
      text: { verbosity: 'medium', format: zodTextFormat(schema, 'arc_output') },
    });

    const parsed = response.output_parsed as { grids: Grid[] } | undefined;
    if (!parsed || !parsed.grids) {
      throw new Error('No grids returned in parsed output');
    }

    return {
      ok: true,
      grids: parsed.grids,
      conversationId: (response as any).conversation_id,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      grids: Array.from({ length: numTestCases }, () => DEFAULT_GRID),
      error: message,
      durationMs: Date.now() - started,
    };
  }
}

function toARCSubmission(state: SubmissionState): ARCSubmission {
  const result: ARCSubmission = {};
  for (const [taskId, taskState] of Object.entries(state)) {
    result[taskId] = taskState.predictions.map((prediction) => ({
      attempt_1: prediction.attempt_1 ?? DEFAULT_GRID,
      attempt_2: prediction.attempt_2 ?? DEFAULT_GRID,
    }));
  }
  return result;
}

function saveCheckpoint(
  submission: SubmissionState,
  datasetHash: string,
  attempt1Done: number,
  attempt2Done: number,
  failed: number
) {
  const checkpoint: Checkpoint = {
    version: 1,
    datasetHash,
    submission,
    attempt1Done,
    attempt2Done,
    failed,
  };
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(`[checkpoint] saved (${attempt1Done} a1, ${attempt2Done} a2, ${failed} failed)`);
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  try {
    const raw = fs.readFileSync(CHECKPOINT_PATH, 'utf-8');
    return JSON.parse(raw) as Checkpoint;
  } catch (error) {
    console.warn('[checkpoint] failed to parse existing file, starting fresh.', error);
    return null;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<void>
) {
  let currentIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    (async () => {
      while (true) {
        let itemIndex: number;
        if (currentIndex >= items.length) break;
        itemIndex = currentIndex++;
        await handler(items[itemIndex], itemIndex);
      }
    })()
  );
  await Promise.all(workers);
}

// =============================================================================
// Main Orchestrator
// =============================================================================

async function main() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`ERROR: dataset not found at ${DATASET_PATH}`);
    process.exit(1);
  }

  const dataset: Dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const datasetHash = computeHash(DATASET_PATH);

  const args = process.argv.slice(2);
  const fresh = args.includes('--fresh');
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;
  const concurrencyArg = args.find((arg) => arg.startsWith('--concurrency='));
  const concurrency = Math.max(1, Number(concurrencyArg ? concurrencyArg.split('=')[1] : DEFAULT_CONCURRENCY));

  let submissionState: SubmissionState;
  let attempt1Done = 0;
  let attempt2Done = 0;
  let failed = 0;

  const checkpoint = loadCheckpoint();
  if (checkpoint && !fresh && checkpoint.datasetHash === datasetHash) {
    console.log('[resume] Loaded checkpoint.');
    submissionState = ensureSubmissionState(dataset, checkpoint.submission);
    attempt1Done = checkpoint.attempt1Done;
    attempt2Done = checkpoint.attempt2Done;
    failed = checkpoint.failed;
  } else {
    console.log('[start] Fresh run.');
    submissionState = ensureSubmissionState(dataset);
  }

  let lastCheckpoint = Date.now();
  const maybeSaveCheckpoint = () => {
    if (Date.now() - lastCheckpoint >= CHECKPOINT_INTERVAL_MS) {
      saveCheckpoint(submissionState, datasetHash, attempt1Done, attempt2Done, failed);
      lastCheckpoint = Date.now();
    }
  };

  const handleSignal = (signal: string) => {
    console.log(`\n[signal] ${signal} received, writing checkpoint...`);
    saveCheckpoint(submissionState, datasetHash, attempt1Done, attempt2Done, failed);
    process.exit(0);
  };
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  const allTaskIds = Object.keys(dataset).sort();
  const taskIds = limit ? allTaskIds.slice(0, limit) : allTaskIds;
  console.log(`Dataset hash: ${datasetHash}`);
  console.log(`Tasks total: ${allTaskIds.length}, processing: ${taskIds.length}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log('');

  const startedAt = Date.now();

  await runWithConcurrency(taskIds, concurrency, async (taskId) => {
    const task = dataset[taskId];
    const taskState = submissionState[taskId];
    if (!task || !taskState) return;

    if (!taskState.attempt1Complete) {
      console.log(`[dispatch:a1] ${taskId}`);
      await delay(LAUNCH_DELAY_MS);
      const outcome = await solveAttempt(taskId, 1, task);
      if (outcome.ok) {
        taskState.predictions.forEach((prediction, idx) => {
          prediction.attempt_1 = outcome.grids[idx] ?? DEFAULT_GRID;
        });
        taskState.attempt1ConversationId = outcome.conversationId;
        console.log(`[result:a1] ${taskId} success (${task.test.length} grids in ${formatMs(outcome.durationMs)})`);
      } else {
        taskState.predictions.forEach((prediction) => {
          prediction.attempt_1 = prediction.attempt_1 ?? DEFAULT_GRID;
        });
        taskState.lastError = outcome.error;
        failed++;
        console.warn(`[result:a1] ${taskId} ERROR: ${outcome.error}`);
      }
      taskState.attempt1Complete = true;
      attempt1Done++;
      maybeSaveCheckpoint();
    } else {
      console.log(`[skip:a1] ${taskId} already complete.`);
    }

    if (taskState.attempt1Complete && !taskState.attempt2Complete) {
      const attempt1Grids = taskState.predictions.map((prediction) => prediction.attempt_1 ?? DEFAULT_GRID);
      console.log(`[dispatch:a2] ${taskId}`);
      const outcome = await solveAttempt(taskId, 2, task, taskState.attempt1ConversationId, attempt1Grids);
      if (outcome.ok) {
        taskState.predictions.forEach((prediction, idx) => {
          prediction.attempt_2 = outcome.grids[idx] ?? DEFAULT_GRID;
        });
        taskState.attempt2ConversationId = outcome.conversationId;
        console.log(`[result:a2] ${taskId} success (${task.test.length} grids in ${formatMs(outcome.durationMs)})`);
      } else {
        taskState.predictions.forEach((prediction) => {
          prediction.attempt_2 = prediction.attempt_2 ?? DEFAULT_GRID;
        });
        taskState.lastError = outcome.error;
        failed++;
        console.warn(`[result:a2] ${taskId} ERROR: ${outcome.error}`);
      }
      taskState.attempt2Complete = true;
      attempt2Done++;
      maybeSaveCheckpoint();
    } else if (taskState.attempt2Complete) {
      console.log(`[skip:a2] ${taskId} already complete.`);
    }
  });

  saveCheckpoint(submissionState, datasetHash, attempt1Done, attempt2Done, failed);

  const arcSubmission = toARCSubmission(submissionState);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = `rearc-submission-gpt5mini-chained-${timestamp}.json`;
  const outputPath = path.resolve(process.cwd(), outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(arcSubmission, null, 2));

  console.log('');
  console.log('='.repeat(80));
  console.log('RUN COMPLETE');
  console.log('='.repeat(80));
  console.log(`Duration: ${formatMs(Date.now() - startedAt)}`);
  console.log(`Attempt 1 done: ${attempt1Done}`);
  console.log(`Attempt 2 done: ${attempt2Done}`);
  console.log(`Failures: ${failed}`);
  console.log(`Submission written to: ${outputPath}`);
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
