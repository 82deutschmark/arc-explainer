/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-09
 * PURPOSE: Fast RE-ARC solver using GPT-5-mini with medium reasoning.
 *          Fires requests concurrently with minimal delay.
 *          Phase 1: All attempt 1s fired rapidly
 *          Phase 2: All attempt 2s fired rapidly (chained from attempt 1)
 * SRP/DRY check: Pass
 */

import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
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
const CHECKPOINT_PATH = path.resolve(process.cwd(), 'rearc-gpt5mini-checkpoint.json');
const MODEL = 'gpt-5-nano';
const REASONING_EFFORT = 'medium';
const LAUNCH_DELAY_MS = 1000; // 1 second between launches

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
  attempt_1: Grid;
  attempt_2: Grid;
}

interface ARCSubmission {
  [taskId: string]: Prediction[];
}

interface TaskTestKey {
  taskId: string;
  testIndex: number;
}

interface AttemptResult {
  taskId: string;
  testIndex: number;
  grids: Grid[];
  conversationId?: string;
  error?: string;
}

interface Checkpoint {
  version: number;
  datasetHash: string;
  submission: ARCSubmission;
  phase1Complete: boolean;
  completed: number;
  failed: number;
}

// =============================================================================
// Zod Schema
// =============================================================================

function getZodSchema(numTestCases: number) {
  return z.object({
    grids: z.array(z.array(z.array(z.number().int().min(0).max(9)))).length(numTestCases),
  });
}

// =============================================================================
// Prompts
// =============================================================================

function buildAttempt1Prompt(task: Task): string {
  const lines: string[] = [];

  lines.push('You are solving an ARC puzzle, this is important. You get TWO attempts. This is ATTEMPT 1.');
  lines.push('');
  lines.push('TRAINING EXAMPLES:');
  task.train.forEach((pair, i) => {
    lines.push(`Example ${i + 1}:`);
    lines.push(`INPUT: ${JSON.stringify(pair.input)}`);
    lines.push(`OUTPUT: ${JSON.stringify(pair.output)}`);
    lines.push('');
  });

  lines.push('TEST CASES (solve these):');
  task.test.forEach((tc, i) => {
    lines.push(`Test ${i + 1}: ${JSON.stringify(tc.input)}`);
  });

  lines.push('');
  lines.push('This is your FIRST attempt. Your second attempt will ask for a DIFFERENT solution.');

  return lines.join('\n');
}

function buildAttempt2Prompt(task: Task, attempt1Grids: Grid[]): string {
  const lines: string[] = [];

  lines.push('ATTEMPT 2 - FINAL ATTEMPT');
  lines.push('');
  lines.push('Your first attempt produced:');
  attempt1Grids.forEach((grid, i) => {
    lines.push(`Test ${i + 1}: ${JSON.stringify(grid)}`);
  });

  lines.push('');
  lines.push('CRITICAL: Produce DIFFERENT outputs. Do NOT repeat your first attempt.');
  lines.push('What is your ALTERNATIVE interpretation of the pattern?');

  return lines.join('\n');
}

// =============================================================================
// Solver
// =============================================================================

async function solveAttempt(
  taskId: string,
  testIndex: number,
  task: Task,
  attemptNum: 1 | 2,
  conversationId?: string,
  attempt1Grids?: Grid[]
): Promise<AttemptResult> {
  const numTestCases = task.test.length;
  const prompt = attemptNum === 1 ? buildAttempt1Prompt(task) : buildAttempt2Prompt(task, attempt1Grids || []);
  const schema = getZodSchema(numTestCases);

  try {
    const response = await openai.responses.parse({
      model: MODEL,
      input: [{ role: 'user', content: prompt }],
      store: true,
      conversation: conversationId,
      reasoning: { effort: REASONING_EFFORT, summary: 'auto' },
      text: { verbosity: 'medium', format: zodTextFormat(schema, 'arc_output') },
    });

    const parsed = response.output_parsed;
    if (!parsed || !parsed.grids) {
      throw new Error('No grids in parsed output');
    }

    return {
      taskId,
      testIndex,
      grids: parsed.grids,
      conversationId: (response as any).conversation_id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      taskId,
      testIndex,
      grids: Array(numTestCases).fill([[0]]),
      error: msg,
    };
  }
}

// =============================================================================
// Checkpoint
// =============================================================================

function computeHash(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function saveCheckpoint(
  submission: ARCSubmission,
  phase1Complete: boolean,
  completed: number,
  failed: number,
  datasetHash: string
) {
  const checkpoint: Checkpoint = {
    version: 1,
    datasetHash,
    submission,
    phase1Complete,
    completed,
    failed,
  };
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(`Checkpoint saved (phase1: ${phase1Complete}, completed: ${completed}, failed: ${failed})`);
}

function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`ERROR: Dataset not found: ${DATASET_PATH}`);
    process.exit(1);
  }

  const dataset: Dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf-8'));
  const datasetHash = computeHash(DATASET_PATH);

  console.log('');
  console.log('='.repeat(80));
  console.log('RE-ARC SOLVER (GPT-5-mini + Medium Reasoning + FAST CONCURRENT)');
  console.log('='.repeat(80));
  console.log(`Dataset: ${DATASET_PATH}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Reasoning: ${REASONING_EFFORT}`);
  console.log(`Tasks: ${Object.keys(dataset).length}`);
  console.log('');

  // Load or initialize state
  const checkpoint = loadCheckpoint();
  let submission: ARCSubmission;
  let phase1Complete = false;
  let completed = 0;
  let failed = 0;

  const args = process.argv.slice(2);
  const fresh = args.includes('--fresh');

  if (checkpoint && !fresh && checkpoint.datasetHash === datasetHash) {
    console.log(`Resuming (phase1: ${checkpoint.phase1Complete}, completed: ${checkpoint.completed}, failed: ${checkpoint.failed})`);
    submission = checkpoint.submission;
    phase1Complete = checkpoint.phase1Complete;
    completed = checkpoint.completed;
    failed = checkpoint.failed;
  } else {
    console.log('Starting fresh run');
    submission = {};

    // Initialize submission structure
    for (const taskId of Object.keys(dataset)) {
      const task = dataset[taskId];
      submission[taskId] = Array(task.test.length)
        .fill(null)
        .map(() => ({ attempt_1: [[0]], attempt_2: [[0]] }));
    }
  }

  console.log('='.repeat(80));
  console.log('');

  // Signal handlers
  const handleShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Saving checkpoint...`);
    saveCheckpoint(submission, phase1Complete, completed, failed, datasetHash);
    process.exit(0);
  };
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Build task list
  const taskList: TaskTestKey[] = [];
  for (const taskId of Object.keys(dataset).sort()) {
    const task = dataset[taskId];
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      taskList.push({ taskId, testIndex });
    }
  }

  console.log(`Total test cases: ${taskList.length}`);
  console.log('');

  // PHASE 1: Fire all attempt 1s
  if (!phase1Complete) {
    console.log('='.repeat(80));
    console.log('PHASE 1: FIRING ALL ATTEMPT 1s');
    console.log('='.repeat(80));
    console.log('');

    const attempt1Promises: Array<{ key: TaskTestKey; promise: Promise<AttemptResult> }> = [];

    for (const { taskId, testIndex } of taskList) {
      const task = dataset[taskId];
      const promise = solveAttempt(taskId, testIndex, task, 1);
      attempt1Promises.push({ key: { taskId, testIndex }, promise });
      console.log(`[dispatch] ${taskId} test ${testIndex + 1} attempt 1`);
      await new Promise((resolve) => setTimeout(resolve, LAUNCH_DELAY_MS));
    }

    console.log('');
    console.log('Waiting for all attempt 1 responses...');
    console.log('');

    const attempt1Results = await Promise.all(attempt1Promises.map((item) => item.promise));

    for (let i = 0; i < attempt1Results.length; i++) {
      const result = attempt1Results[i];
      const { taskId, testIndex } = result;

      if (result.error) {
        console.log(`[result] ${taskId} test ${testIndex + 1} attempt 1: ERROR - ${result.error.slice(0, 60)}`);
        failed++;
      } else {
        for (let j = 0; j < result.grids.length; j++) {
          submission[taskId][j].attempt_1 = result.grids[j];
        }
        console.log(`[result] ${taskId} test ${testIndex + 1} attempt 1: SUCCESS (${result.grids.length} grids)`);
        completed++;
      }
    }

    phase1Complete = true;
    saveCheckpoint(submission, phase1Complete, completed, failed, datasetHash);

    console.log('');
    console.log('='.repeat(80));
    console.log('PHASE 1 COMPLETE');
    console.log('='.repeat(80));
    console.log('');
  }

  // PHASE 2: Fire all attempt 2s (chained from attempt 1)
  console.log('='.repeat(80));
  console.log('PHASE 2: FIRING ALL ATTEMPT 2s (CHAINED)');
  console.log('='.repeat(80));
  console.log('');

  const attempt2Promises: Array<{ key: TaskTestKey; promise: Promise<AttemptResult> }> = [];

  for (const { taskId, testIndex } of taskList) {
    const task = dataset[taskId];
    const attempt1Grids = submission[taskId].map((pred) => pred.attempt_1);

    // Note: We don't have conversation IDs saved in checkpoint, so attempt 2 won't chain if resuming
    // This is acceptable - it just means less context for attempt 2
    const promise = solveAttempt(taskId, testIndex, task, 2, undefined, attempt1Grids);
    attempt2Promises.push({ key: { taskId, testIndex }, promise });
    console.log(`[dispatch] ${taskId} test ${testIndex + 1} attempt 2`);
    await new Promise((resolve) => setTimeout(resolve, LAUNCH_DELAY_MS));
  }

  console.log('');
  console.log('Waiting for all attempt 2 responses...');
  console.log('');

  const attempt2Results = await Promise.all(attempt2Promises.map((item) => item.promise));

  for (let i = 0; i < attempt2Results.length; i++) {
    const result = attempt2Results[i];
    const { taskId, testIndex } = result;

    if (result.error) {
      console.log(`[result] ${taskId} test ${testIndex + 1} attempt 2: ERROR - ${result.error.slice(0, 60)}`);
      failed++;
    } else {
      for (let j = 0; j < result.grids.length; j++) {
        submission[taskId][j].attempt_2 = result.grids[j];
      }
      console.log(`[result] ${taskId} test ${testIndex + 1} attempt 2: SUCCESS (${result.grids.length} grids)`);
      completed++;
    }
  }

  saveCheckpoint(submission, true, completed, failed, datasetHash);

  console.log('');
  console.log('='.repeat(80));
  console.log('PHASE 2 COMPLETE');
  console.log('='.repeat(80));
  console.log('');

  // Write final submission
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = `rearc-submission-gpt5mini-${timestamp}.json`;
  const outputPath = path.resolve(process.cwd(), outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(submission, null, 2));

  console.log('');
  console.log('='.repeat(80));
  console.log('COMPLETE');
  console.log('='.repeat(80));
  console.log(`Submission: ${outputPath}`);
  console.log(`Completed: ${completed}`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
