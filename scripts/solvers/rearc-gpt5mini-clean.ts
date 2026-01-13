/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-09
 * PURPOSE: Clean RE-ARC solver using GPT-5-mini with medium reasoning.
 *          Uses Zod + responses.parse() for structured output.
 *          Checkpointing enabled for resumability.
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
const MODEL = 'gpt-5-mini';
const REASONING_EFFORT = 'medium';

const openai = new OpenAI({ apiKey: API_KEY });

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

interface WorkItem {
  taskId: string;
  testIndex: number;
  attemptNum: 1 | 2;
}

interface Checkpoint {
  version: number;
  datasetHash: string;
  submission: ARCSubmission;
  workQueue: WorkItem[];
  workIndex: number;
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

  lines.push('You are solving an ARC puzzle. You get TWO attempts. This is ATTEMPT 1.');
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
  task: Task,
  attemptNum: 1 | 2,
  conversationId?: string,
  attempt1Grids?: Grid[]
): Promise<{ grids: Grid[]; conversationId?: string; error?: string }> {
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
      grids: parsed.grids,
      conversationId: (response as any).conversation_id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
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
  workQueue: WorkItem[],
  workIndex: number,
  completed: number,
  failed: number,
  datasetHash: string
) {
  const checkpoint: Checkpoint = {
    version: 1,
    datasetHash,
    submission,
    workQueue,
    workIndex,
    completed,
    failed,
  };
  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(`Checkpoint saved (completed: ${completed}, failed: ${failed})`);
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
// Work Queue
// =============================================================================

function buildWorkQueue(dataset: Dataset): WorkItem[] {
  const queue: WorkItem[] = [];
  for (const taskId of Object.keys(dataset).sort()) {
    const task = dataset[taskId];
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      queue.push({ taskId, testIndex, attemptNum: 1 });
      queue.push({ taskId, testIndex, attemptNum: 2 });
    }
  }
  return queue;
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
  console.log('RE-ARC SOLVER (GPT-5-mini + Medium Reasoning + Zod)');
  console.log('='.repeat(80));
  console.log(`Dataset: ${DATASET_PATH}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Reasoning: ${REASONING_EFFORT}`);
  console.log(`Tasks: ${Object.keys(dataset).length}`);
  console.log('');

  // Load or initialize state
  const checkpoint = loadCheckpoint();
  let submission: ARCSubmission;
  let workQueue: WorkItem[];
  let workIndex: number;
  let completed = 0;
  let failed = 0;

  const args = process.argv.slice(2);
  const fresh = args.includes('--fresh');

  if (checkpoint && !fresh && checkpoint.datasetHash === datasetHash) {
    console.log(`Resuming (completed: ${checkpoint.completed}, failed: ${checkpoint.failed})`);
    submission = checkpoint.submission;
    workQueue = checkpoint.workQueue;
    workIndex = checkpoint.workIndex;
    completed = checkpoint.completed;
    failed = checkpoint.failed;
  } else {
    console.log('Starting fresh run');
    submission = {};
    workQueue = buildWorkQueue(dataset);
    workIndex = 0;

    // Initialize submission structure
    for (const taskId of Object.keys(dataset)) {
      const task = dataset[taskId];
      submission[taskId] = Array(task.test.length)
        .fill(null)
        .map(() => ({ attempt_1: [[0]], attempt_2: [[0]] }));
    }
  }

  console.log(`Work items remaining: ${workQueue.length - workIndex}`);
  console.log('='.repeat(80));
  console.log('');

  // Signal handlers
  const handleShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Saving checkpoint...`);
    saveCheckpoint(submission, workQueue, workIndex, completed, failed, datasetHash);
    process.exit(0);
  };
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Tracking maps
  const conversationMap = new Map<string, string>();
  const gridsMap = new Map<string, Grid[]>();

  // Process work queue
  while (workIndex < workQueue.length) {
    const workItem = workQueue[workIndex];
    const task = dataset[workItem.taskId];

    if (!task) {
      console.log(`Task ${workItem.taskId} missing. Skipping.`);
      workIndex++;
      continue;
    }

    const taskKey = `${workItem.taskId}:${workItem.testIndex}`;
    const conversationId = conversationMap.get(taskKey);
    const attempt1Grids = gridsMap.get(taskKey);

    console.log(
      `[${workIndex + 1}/${workQueue.length}] ${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum}`
    );

    const result = await solveAttempt(task, workItem.attemptNum, conversationId, attempt1Grids);

    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
      failed++;
    } else {
      console.log(`  SUCCESS: ${result.grids.length} grids`);

      // Store grids
      for (let i = 0; i < result.grids.length; i++) {
        const key = workItem.attemptNum === 1 ? 'attempt_1' : 'attempt_2';
        submission[workItem.taskId][i][key] = result.grids[i];
        console.log(`    Test ${i + 1}: ${result.grids[i].length}x${result.grids[i][0]?.length || 0}`);
      }

      completed++;

      // Store for chaining
      if (workItem.attemptNum === 1) {
        if (result.conversationId) conversationMap.set(taskKey, result.conversationId);
        gridsMap.set(taskKey, result.grids);
      }
    }

    workIndex++;

    // Checkpoint every 5 completions
    if (completed % 5 === 0 || workIndex === workQueue.length) {
      saveCheckpoint(submission, workQueue, workIndex, completed, failed, datasetHash);
    }

    console.log('');

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

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
