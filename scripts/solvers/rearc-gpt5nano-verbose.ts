/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-09
 * PURPOSE: RE-ARC solver with GPT-5-nano + low reasoning + VERBOSE logging.
 *          Processes 2026RealRearc.json. Shows exactly what's happening at each step.
 *          - Responses API endpoint (/v1/responses), not Chat Completions
 *          - Explicit JSON format requirements in system prompts
 *          - Conversation chaining for attempt 2
 *          - Detailed logging: what we send, what we get, what we parse, what we store
 * SRP/DRY check: Pass
 *
 * Usage:
 *   npx tsx scripts/solvers/rearc-gpt5nano-verbose.ts
 *
 * Env:
 *   OPENAI_API_KEY (required)
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import type { ResponseInput } from 'openai/resources/responses/responses';

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

interface AttemptResult {
  grids: Grid[];
  rawText: string;
  responseId: string;
  conversationId?: string;
  error?: string;
}

// =============================================================================
// Config & Setup
// =============================================================================

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable not set');
  process.exit(1);
}

const DATASET_PATH = path.resolve(process.cwd(), '2026RealRearc.json');
const MODEL = 'gpt-5-nano';
const REASONING_EFFORT = 'low';

const openai = new OpenAI({
  apiKey: API_KEY,
  timeout: 35 * 60 * 1000,
});

// =============================================================================
// Grid Validation & Parsing
// =============================================================================

function isValidGrid(candidate: unknown): candidate is Grid {
  if (!Array.isArray(candidate) || candidate.length === 0) return false;
  return candidate.every(
    (row) =>
      Array.isArray(row) &&
      row.length > 0 &&
      row.every((cell) => typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell <= 9)
  );
}

function gridToString(grid: Grid): string {
  return `${grid.length}x${grid[0]?.length || 0}`;
}

function parseMultipleGrids(text: string, expectedCount: number, taskId: string, attempt: number): Grid[] {
  console.log(`    [PARSE] Looking for ${expectedCount} grids in response...`);

  const grids: Grid[] = [];
  const regex = /\[\s*\[[\s\S]*?\]\s*\]/g;
  const matches = Array.from(text.matchAll(regex));

  console.log(`    [PARSE] Found ${matches.length} potential JSON arrays in response text`);

  for (let idx = 0; idx < matches.length; idx++) {
    const match = matches[idx];
    try {
      const candidate = JSON.parse(match[0]);
      if (isValidGrid(candidate)) {
        grids.push(candidate);
        console.log(`    [PARSE] Grid #${grids.length}: valid - dimensions ${gridToString(candidate)}`);
        if (grids.length === expectedCount) break;
      } else {
        console.log(`    [PARSE] Rejected array #${idx + 1}: not a valid grid (wrong structure or values)`);
      }
    } catch (e) {
      console.log(`    [PARSE] Rejected array #${idx + 1}: invalid JSON`);
    }
  }

  const found = grids.length;
  const needed = expectedCount;
  console.log(`    [PARSE] Result: ${found}/${needed} grids extracted`);

  if (found < needed) {
    console.log(`    [PARSE] FALLBACK: filling ${needed - found} missing grids with [[0]]`);
    const fallback: Grid = [[0]];
    while (grids.length < needed) {
      grids.push(fallback);
    }
  }

  return grids.slice(0, expectedCount);
}

// =============================================================================
// Prompt Building
// =============================================================================

function buildAttempt1Prompt(task: Task): string {
  const lines: string[] = [];

  lines.push('You are solving ARC (Abstraction and Reasoning Corpus) puzzles.');
  lines.push('You will analyze training examples and produce solutions for test cases.');
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
    lines.push(`INPUT:  ${JSON.stringify(testCase.input)}`);
    lines.push('');
  });

  lines.push('=== REQUIRED RESPONSE FORMAT ===');
  lines.push('');
  lines.push(`Output EXACTLY ${task.test.length} JSON arrays (2D grids), one per line.`);
  lines.push('Each grid is: [[row1], [row2], ...] with integers 0-9 only.');
  lines.push('DO NOT include explanations, markdown, or any text except the grids.');
  lines.push('Example (if 2 test cases): ');
  lines.push('[[0,1,2],[3,4,5]]');
  lines.push('[[1,0,3],[5,4,2]]');
  lines.push('');
  lines.push('Now solve the test cases:');

  return lines.join('\n');
}

function buildAttempt2Prompt(numTestCases: number): string {
  const lines: string[] = [];

  lines.push('Generate ALTERNATIVE solutions for the same puzzle.');
  lines.push('');
  lines.push('=== REQUIRED RESPONSE FORMAT ===');
  lines.push('');
  lines.push(`Output EXACTLY ${numTestCases} JSON arrays (2D grids), one per line.`);
  lines.push('Each grid is: [[row1], [row2], ...] with integers 0-9 only.');
  lines.push('DO NOT include explanations, markdown, or any text except the grids.');
  lines.push('');
  lines.push('Now generate alternative solutions:');

  return lines.join('\n');
}

// =============================================================================
// API Calls
// =============================================================================

async function solveAttempt(
  task: Task,
  attemptNum: 1 | 2,
  conversationId: string | undefined,
  taskId: string
): Promise<AttemptResult> {
  const numTestCases = task.test.length;
  const prompt = attemptNum === 1 ? buildAttempt1Prompt(task) : buildAttempt2Prompt(numTestCases);

  console.log(`  [API] Building request for attempt ${attemptNum}...`);
  console.log(`  [API] Prompt size: ${prompt.length} characters`);
  console.log(`  [API] Test cases to solve: ${numTestCases}`);
  if (conversationId) {
    console.log(`  [API] Conversation ID: ${conversationId}`);
  }

  const input: ResponseInput = [
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
  ];

  try {
    console.log(`  [API] Calling OpenAI Responses API...`);
    console.log(`  [API]   Model: ${MODEL}`);
    console.log(`  [API]   Reasoning effort: ${REASONING_EFFORT}`);

    const response = await openai.responses.create({
      model: MODEL,
      input,
      store: true,
      conversation: conversationId,
      reasoning: {
        effort: REASONING_EFFORT,
        summary: 'auto',
      },
      text: {
        verbosity: 'medium',
      },
    });

    console.log(`  [API] Response received!`);
    console.log(`  [API]   Response ID: ${response.id}`);
    console.log(`  [API]   Conversation ID: ${(response as any).conversation_id || 'N/A'}`);

    const responseText = response.output_text ?? '';
    const textLength = typeof responseText === 'string' ? responseText.length : JSON.stringify(responseText).length;
    console.log(`  [API]   Output length: ${textLength} characters`);

    const rawText = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

    const grids = parseMultipleGrids(rawText, numTestCases, taskId, attemptNum);

    return {
      grids,
      rawText,
      responseId: response.id,
      conversationId: (response as any).conversation_id,
      error: undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  [API] ERROR: ${msg}`);

    const fallback: Grid = [[0]];
    return {
      grids: Array(numTestCases).fill(fallback),
      rawText: '',
      responseId: '',
      error: msg,
    };
  }
}

// =============================================================================
// Main Solver Loop
// =============================================================================

async function solveTasks(dataset: Dataset): Promise<ARCSubmission> {
  const submission: ARCSubmission = {};
  const taskIds = Object.keys(dataset).sort();

  console.log('');
  console.log('='.repeat(80));
  console.log('RE-ARC SOLVER - VERBOSE MODE');
  console.log('='.repeat(80));
  console.log('');
  console.log(`Dataset file: ${DATASET_PATH}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Reasoning effort: ${REASONING_EFFORT}`);
  console.log(`Total tasks: ${taskIds.length}`);
  console.log('');

  // Initialize submission
  for (const taskId of taskIds) {
    const task = dataset[taskId];
    submission[taskId] = Array(task.test.length)
      .fill(null)
      .map(() => ({
        attempt_1: [[0]],
        attempt_2: [[0]],
      }));
  }

  const attempt1Results: Array<{ taskId: string; result: AttemptResult }> = [];

  // =========================================================================
  // PHASE 1: Attempt 1 for all tasks
  // =========================================================================

  console.log('='.repeat(80));
  console.log('PHASE 1: FIRST ATTEMPT FOR ALL TASKS');
  console.log('='.repeat(80));
  console.log('');

  for (let taskIdx = 0; taskIdx < taskIds.length; taskIdx++) {
    const taskId = taskIds[taskIdx];
    const task = dataset[taskId];

    console.log(`[${taskIdx + 1}/${taskIds.length}] Task ${taskId}`);
    console.log(`  [TASK] Train pairs: ${task.train.length}`);
    console.log(`  [TASK] Test cases: ${task.test.length}`);

    const result = await solveAttempt(task, 1, undefined, taskId);
    attempt1Results.push({ taskId, result });

    // Store in submission
    for (let i = 0; i < task.test.length; i++) {
      submission[taskId][i].attempt_1 = result.grids[i];
      console.log(`  [STORE] Test ${i + 1}: grid ${gridToString(result.grids[i])}`);
    }

    if (result.error) {
      console.log(`  [ERROR] ${result.error}`);
    } else {
      console.log(`  [SUCCESS] Attempt 1 complete`);
    }

    console.log('');

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log('='.repeat(80));
  console.log('PHASE 1 COMPLETE');
  console.log('='.repeat(80));
  console.log('');

  // =========================================================================
  // PHASE 2: Attempt 2 for all tasks (chained conversations)
  // =========================================================================

  console.log('='.repeat(80));
  console.log('PHASE 2: SECOND ATTEMPT FOR ALL TASKS (CHAINED)');
  console.log('='.repeat(80));
  console.log('');

  for (let idx = 0; idx < attempt1Results.length; idx++) {
    const { taskId, result: attempt1Result } = attempt1Results[idx];
    const task = dataset[taskId];

    console.log(`[${idx + 1}/${attempt1Results.length}] Task ${taskId}`);
    console.log(`  [CHAIN] Previous response ID: ${attempt1Result.responseId}`);
    console.log(`  [CHAIN] Previous conversation: ${attempt1Result.conversationId || 'new'}`);

    const result = await solveAttempt(task, 2, attempt1Result.conversationId, taskId);

    // Store in submission
    for (let i = 0; i < task.test.length; i++) {
      submission[taskId][i].attempt_2 = result.grids[i];
      console.log(`  [STORE] Test ${i + 1}: grid ${gridToString(result.grids[i])}`);
    }

    if (result.error) {
      console.log(`  [ERROR] ${result.error}`);
    } else {
      console.log(`  [SUCCESS] Attempt 2 complete`);
    }

    console.log('');

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  console.log('='.repeat(80));
  console.log('PHASE 2 COMPLETE');
  console.log('='.repeat(80));
  console.log('');

  return submission;
}

// =============================================================================
// Output
// =============================================================================

function writeSubmission(submission: ARCSubmission): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `rearc-submission-gpt5nano-${timestamp}.json`;
  const outPath = path.resolve(process.cwd(), filename);

  fs.writeFileSync(outPath, JSON.stringify(submission, null, 2));

  console.log('Submission file written:');
  console.log(`  Path: ${outPath}`);

  // Count what we wrote
  let totalTests = 0;
  let totalTasks = 0;
  for (const taskId in submission) {
    totalTasks++;
    totalTests += submission[taskId].length;
  }

  console.log(`  Tasks: ${totalTasks}`);
  console.log(`  Total test predictions: ${totalTests}`);
  console.log('');

  return outPath;
}

// =============================================================================
// Entry Point
// =============================================================================

async function main() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`ERROR: Dataset file not found: ${DATASET_PATH}`);
    process.exit(1);
  }

  console.log('Loading dataset...');
  const rawData = fs.readFileSync(DATASET_PATH, 'utf-8');
  console.log(`  File size: ${rawData.length} bytes`);

  const dataset: Dataset = JSON.parse(rawData);
  console.log(`  Tasks loaded: ${Object.keys(dataset).length}`);
  console.log('');

  const submission = await solveTasks(dataset);
  writeSubmission(submission);

  console.log('='.repeat(80));
  console.log('ALL DONE!');
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
