/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-09
 * PURPOSE: RE-ARC solver using OpenAI Responses API with GPT-5-nano, high reasoning,
 *          structured JSON output (no parsing), and resumable checkpointing.
 *          - Responses API with response_format.json_schema for guaranteed JSON
 *          - Conversation chaining for attempt 2
 *          - Checkpoint/resume on interrupt (SIGINT/SIGTERM)
 *          - Zero parsing: model responds in exact required format
 * SRP/DRY check: Pass
 *
 * Usage:
 *   npx tsx scripts/solvers/rearc-gpt5nano.ts [--fresh] [--resume]
 *
 * Env:
 *   OPENAI_API_KEY (required)
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

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
  conversationId?: string; // For chaining attempt 2 to attempt 1
}

interface CheckpointData {
  version: number;
  datasetHash: string;
  timestamp: string;
  submission: ARCSubmission;
  workQueue: WorkItem[];
  workIndex: number;
  completed: number;
  failed: number;
}

// =============================================================================
// Config
// =============================================================================

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

const DATASET_PATH = path.resolve(process.cwd(), '2026RealRearc.json');
const CHECKPOINT_PATH = path.resolve(process.cwd(), 'rearc-gpt5nano-checkpoint.json');
const MODEL = 'gpt-5-nano';
const REASONING_EFFORT = 'high';
const CHECKPOINT_VERSION = 1;

const openai = new OpenAI({
  apiKey: API_KEY,
  timeout: 35 * 60 * 1000,
});

// =============================================================================
// Helpers
// =============================================================================

function computeFileHash(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const content = fs.readFileSync(filePath);
  hash.update(content);
  return hash.digest('hex');
}

function gridToString(grid: Grid): string {
  return `${grid.length}x${grid[0]?.length || 0}`;
}

// =============================================================================
// Checkpoint Management
// =============================================================================

function loadCheckpoint(): CheckpointData | null {
  if (!fs.existsSync(CHECKPOINT_PATH)) {
    return null;
  }

  try {
    const data = JSON.parse(fs.readFileSync(CHECKPOINT_PATH, 'utf-8')) as CheckpointData;
    if (data.version !== CHECKPOINT_VERSION) {
      console.warn('Checkpoint version mismatch. Starting fresh.');
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Failed to load checkpoint:', err);
    return null;
  }
}

function saveCheckpoint(
  submission: ARCSubmission,
  workQueue: WorkItem[],
  workIndex: number,
  completed: number,
  failed: number,
  datasetHash: string
) {
  const checkpoint: CheckpointData = {
    version: CHECKPOINT_VERSION,
    datasetHash,
    timestamp: new Date().toISOString(),
    submission,
    workQueue,
    workIndex,
    completed,
    failed,
  };

  fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
  console.log(`💾 Checkpoint saved (completed: ${completed}, failed: ${failed})`);
}

// =============================================================================
// Work Queue Building
// =============================================================================

function buildWorkQueue(dataset: Dataset): WorkItem[] {
  const queue: WorkItem[] = [];
  const taskIds = Object.keys(dataset).sort();

  for (const taskId of taskIds) {
    const task = dataset[taskId];
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      // Attempt 1 first
      queue.push({ taskId, testIndex, attemptNum: 1 });
      // Attempt 2 (will chain from attempt 1's response)
      queue.push({ taskId, testIndex, attemptNum: 2 });
    }
  }

  return queue;
}

// =============================================================================
// Prompt Building
// =============================================================================

function buildAttempt1Prompt(task: Task): string {
  const lines: string[] = [];

  lines.push('You are solving an ARC (Abstraction and Reasoning Corpus) puzzle.');
  lines.push('You will get TWO attempts to solve it. This is your FIRST attempt.');
  lines.push('');
  lines.push('=== TRAINING EXAMPLES ===');
  lines.push('');

  task.train.forEach((pair, idx) => {
    lines.push(`Example ${idx + 1}:`);
    lines.push(`INPUT:  ${JSON.stringify(pair.input)}`);
    lines.push(`OUTPUT: ${JSON.stringify(pair.output)}`);
    lines.push('');
  });

  lines.push('=== TEST CASES (PRODUCE SOLUTIONS) ===');
  lines.push('');

  task.test.forEach((testCase, idx) => {
    lines.push(`Test Case ${idx + 1}:`);
    lines.push(`INPUT: ${JSON.stringify(testCase.input)}`);
  });

  lines.push('');
  lines.push('This is your FIRST attempt. Solve all test cases and respond with the grids in JSON format.');
  lines.push('Your second attempt will ask you to try a DIFFERENT solution.');

  return lines.join('\n');
}

function buildAttempt2Prompt(task: Task, attempt1Grids: Grid[]): string {
  const lines: string[] = [];

  lines.push('=== SECOND ATTEMPT ===');
  lines.push('');
  lines.push('This is your SECOND and FINAL attempt at the same puzzle.');
  lines.push('Your FIRST attempt produced these outputs:');
  lines.push('');

  attempt1Grids.forEach((grid, idx) => {
    lines.push(`Test Case ${idx + 1} (First Attempt): ${JSON.stringify(grid)}`);
  });

  lines.push('');
  lines.push('CRITICAL: Your second attempt MUST produce DIFFERENT outputs.');
  lines.push('Do NOT repeat your first attempt grids above.');
  lines.push('');
  lines.push('Reconsider the training examples and test inputs.');
  lines.push('What is your ALTERNATIVE interpretation of the pattern?');
  lines.push('Provide a completely different solution set.');
  lines.push('');
  lines.push('Respond with new grids in JSON format. They must be different from your first attempt.');

  return lines.join('\n');
}

// =============================================================================
// JSON Schema for Structured Output
// =============================================================================

function getResponseSchema(numTestCases: number) {
  return {
    type: 'object',
    properties: {
      grids: {
        type: 'array',
        items: {
          type: 'array',
          items: {
            type: 'array',
            items: {
              type: 'integer',
              minimum: 0,
              maximum: 9,
            },
          },
        },
        minItems: numTestCases,
        maxItems: numTestCases,
        description: `Array of exactly ${numTestCases} output grids (2D arrays of integers 0-9), one per test case`,
      },
    },
    required: ['grids'],
    additionalProperties: false,
  };
}

// =============================================================================
// API Calls
// =============================================================================

interface ResponseData {
  grids: Grid[];
}

async function solveAttempt(
  task: Task,
  attemptNum: 1 | 2,
  conversationId?: string,
  attempt1Grids?: Grid[]
): Promise<{ grids: Grid[]; conversationId?: string; error?: string }> {
  const numTestCases = task.test.length;
  const prompt = attemptNum === 1 ? buildAttempt1Prompt(task) : buildAttempt2Prompt(task, attempt1Grids || []);
  const schema = getResponseSchema(numTestCases);

  try {
    const response = await openai.responses.create({
      model: MODEL,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt,
            },
          ],
        },
      ],
      store: true,
      conversation: conversationId,
      reasoning: {
        effort: REASONING_EFFORT,
        summary: 'auto',
      },
      text: {
        verbosity: 'medium',
        format: {
          type: 'json_schema',
          name: 'ARC_Output',
          schema,
          strict: true,
        },
      },
    });

    // Parse the JSON response
    let parsedResponse: ResponseData;
    try {
      const outputText = response.output_text ?? '{}';
      parsedResponse = JSON.parse(typeof outputText === 'string' ? outputText : JSON.stringify(outputText));
    } catch {
      return {
        grids: Array(numTestCases).fill([[0]]),
        conversationId: (response as any).conversation_id,
        error: 'Failed to parse structured response',
      };
    }

    const grids = parsedResponse.grids || Array(numTestCases).fill([[0]]);

    return {
      grids,
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
// Main Solver
// =============================================================================

async function main() {
  // Load dataset
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`ERROR: Dataset not found: ${DATASET_PATH}`);
    process.exit(1);
  }

  const rawDataset = fs.readFileSync(DATASET_PATH, 'utf-8');
  const dataset: Dataset = JSON.parse(rawDataset);
  const datasetHash = computeFileHash(DATASET_PATH);

  console.log('');
  console.log('='.repeat(80));
  console.log('RE-ARC SOLVER (GPT-5-nano + High Reasoning + Structured JSON)');
  console.log('='.repeat(80));
  console.log(`Dataset: ${DATASET_PATH}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Reasoning: ${REASONING_EFFORT}`);
  console.log(`Tasks: ${Object.keys(dataset).length}`);
  console.log('');

  // Check for checkpoint
  const checkpoint = loadCheckpoint();
  let submission: ARCSubmission;
  let workQueue: WorkItem[];
  let workIndex: number;
  let completed = 0;
  let failed = 0;

  const parseCliArgs = () => {
    const args = process.argv.slice(2);
    return {
      fresh: args.includes('--fresh'),
      resume: args.includes('--resume'),
    };
  };

  const cliArgs = parseCliArgs();

  if (checkpoint && !cliArgs.fresh) {
    if (checkpoint.datasetHash !== datasetHash) {
      console.log('Dataset changed. Starting fresh.');
      submission = {};
      workQueue = buildWorkQueue(dataset);
      workIndex = 0;
    } else {
      console.log(`Resuming from checkpoint (${checkpoint.completed} completed, ${checkpoint.failed} failed)`);
      submission = checkpoint.submission;
      workQueue = checkpoint.workQueue;
      workIndex = checkpoint.workIndex;
      completed = checkpoint.completed;
      failed = checkpoint.failed;
    }
  } else {
    console.log('Starting fresh run.');
    submission = {};
    workQueue = buildWorkQueue(dataset);
    workIndex = 0;
  }

  // Initialize submission structure
  for (const taskId of Object.keys(dataset)) {
    const task = dataset[taskId];
    if (!submission[taskId]) {
      submission[taskId] = Array(task.test.length)
        .fill(null)
        .map(() => ({
          attempt_1: [[0]],
          attempt_2: [[0]],
        }));
    }
  }

  console.log(`Work items remaining: ${workQueue.length - workIndex}`);
  console.log('='.repeat(80));
  console.log('');

  // Setup signal handlers
  const handleShutdown = (signal: string) => {
    console.log(`\nReceived ${signal}. Saving checkpoint...`);
    saveCheckpoint(submission, workQueue, workIndex, completed, failed, datasetHash);
    console.log('Checkpoint saved. Exiting.');
    process.exit(0);
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Process work queue
  const conversationMap = new Map<string, string>(); // For attempt 1 → attempt 2 chaining
  const gridsMap = new Map<string, Grid[]>(); // Store attempt 1 grids for attempt 2

  while (workIndex < workQueue.length) {
    const workItem = workQueue[workIndex];
    const task = dataset[workItem.taskId];

    if (!task) {
      console.log(`⚠️  Task ${workItem.taskId} missing. Skipping.`);
      workIndex++;
      continue;
    }

    const taskKey = `${workItem.taskId}:${workItem.testIndex}`;
    const conversationId = workItem.conversationId || conversationMap.get(taskKey);
    const attempt1Grids = gridsMap.get(taskKey);

    console.log(
      `[${workIndex + 1}/${workQueue.length}] ${workItem.taskId} test ${workItem.testIndex + 1} attempt ${workItem.attemptNum}`
    );

    const result = await solveAttempt(task, workItem.attemptNum, conversationId, attempt1Grids);

    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`);
      failed++;
    } else {
      console.log(`  ✅ Success: ${result.grids.length} grids`);

      // Store grids
      for (let i = 0; i < result.grids.length; i++) {
        const key = workItem.attemptNum === 1 ? 'attempt_1' : 'attempt_2';
        submission[workItem.taskId][i][key] = result.grids[i];
        const dims = gridToString(result.grids[i]);
        console.log(`     Test ${i + 1}: ${dims}`);
      }

      completed++;

      // Store conversation ID and grids for chaining
      if (workItem.attemptNum === 1) {
        if (result.conversationId) {
          conversationMap.set(taskKey, result.conversationId);
        }
        gridsMap.set(taskKey, result.grids);
      }
    }

    workIndex++;

    // Save checkpoint every 5 completions
    if (completed % 5 === 0 || workIndex === workQueue.length) {
      saveCheckpoint(submission, workQueue, workIndex, completed, failed, datasetHash);
    }

    console.log('');

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Write final submission
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputFile = `rearc-submission-gpt5nano-${timestamp}.json`;
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
