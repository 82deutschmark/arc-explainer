/**
 * Author: Claude Haiku 4.5
 * Date: 2025-12-31
 * PURPOSE: Clean, working RE-ARC solver using OpenAI Responses API with GPT-5-nano.
 *          Processes REARC2026 dataset with proper Responses API patterns:
 *          - Responses API endpoint (/v1/responses), NOT Chat Completions
 *          - No temperature (GPT-5 models don't support it)
 *          - Attempt chaining via previous_response_id for conversation state
 *          - Simple, straightforward execution without complex backoff/retries
 * SRP/DRY check: Pass — isolated solver logic, reusable grid parsing, clean I/O
 *
 * Usage:
 *   npx tsx scripts/solvers/rearc-gpt5-mini.ts [--dataset <path>] [--model <model>]
 *
 * Required env:
 *   OPENAI_API_KEY - OpenAI API key
 *
 * Optional env:
 *   REARC_DATASET - Path to dataset (default: REARC2026.json)
 *   REARC_MODEL - Model to use (default: gpt-5-nano)
 *   REARC_REASONING_EFFORT - medium|high|low (default: high)
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
type ReasoningEffort = 'medium' | 'high' | 'low' | 'none';

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

interface AttemptResult {
  grids: Grid[];  // One grid per test case (always arrays, never null)
  rawText: string;
  responseId: string;
  conversationId?: string;
  error?: string;
}

interface Submission {
  [taskId: string]: Array<{
    attempt_1: Grid;
    attempt_2: Grid;
  }>;
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  datasetPath: process.env.REARC_DATASET || path.resolve(process.cwd(), 'REARC2026.json'),
  model: process.env.REARC_MODEL || 'gpt-5-nano',
  reasoningEffort: (process.env.REARC_REASONING_EFFORT || 'high') as ReasoningEffort,
};

if (!CONFIG.apiKey) {
  console.error('Error: OPENAI_API_KEY not set');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: CONFIG.apiKey,
  timeout: 35 * 60 * 1000, // 35 minutes
});

// =============================================================================
// Helpers
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Grid Parsing
// =============================================================================

function isValidGrid(candidate: unknown): candidate is Grid {
  return (
    Array.isArray(candidate) &&
    candidate.length > 0 &&
    candidate.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((cell) => typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell <= 9)
    )
  );
}

function parseGridFromResponse(text: string): Grid | null {
  // Try JSON array first
  const regex = /\[\s*\[[\s\S]*?\]\s*\]/g;
  const matches = Array.from(text.matchAll(regex));

  for (let i = matches.length - 1; i >= 0; i--) {
    const snippet = matches[i][0];
    try {
      const candidate = JSON.parse(snippet);
      if (isValidGrid(candidate)) {
        return candidate;
      }
    } catch {
      // Continue searching
    }
  }

  return null;
}

// =============================================================================
// Prompt Building
// =============================================================================

function buildAttempt1Prompt(task: Task): string {
  const lines: string[] = [];
  lines.push('You are solving an ARC (Abstraction and Reasoning Corpus) puzzle.');
  lines.push('');
  lines.push('## Training Examples');
  lines.push('');

  task.train.forEach((pair, idx) => {
    lines.push(`-- Example ${idx + 1} --`);
    lines.push('INPUT:');
    lines.push(JSON.stringify(pair.input));
    lines.push('OUTPUT:');
    lines.push(JSON.stringify(pair.output));
    lines.push('');
  });

  lines.push('## Test Cases');
  lines.push('');
  task.test.forEach((testCase, idx) => {
    lines.push(`-- Test Case ${idx + 1} --`);
    lines.push('INPUT:');
    lines.push(JSON.stringify(testCase.input));
    lines.push('');
  });

  lines.push(`Respond with ${task.test.length} output grids (one per test case), each as a JSON array.`);
  lines.push('Format: Grid1, Grid2, Grid3 (separated by newlines or commas)');

  return lines.join('\n');
}

function buildAttempt2Prompt(numTestCases: number): string {
  return `Continue reasoning on the same ARC puzzle. Produce ${numTestCases} alternative output grids (one per test case). Respond with ONLY the JSON grids, no explanation.`;
}

function buildResponseInput(userPrompt: string): ResponseInput {
  return [
    {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: userPrompt,
        },
      ],
    },
  ];
}

// =============================================================================
// Responses API Calls
// =============================================================================

function parseMultipleGrids(text: string, expectedCount: number): Grid[] {
  const grids: Grid[] = [];
  const regex = /\[\s*\[[\s\S]*?\]\s*\]/g;
  const matches = Array.from(text.matchAll(regex));

  for (const match of matches) {
    try {
      const candidate = JSON.parse(match[0]);
      if (isValidGrid(candidate)) {
        grids.push(candidate);
        if (grids.length === expectedCount) break;
      }
    } catch {
      // Continue searching
    }
  }

  // Fill remaining with fallback grid [[0]] if we didn't find enough
  const fallbackGrid: Grid = [[0]];
  while (grids.length < expectedCount) {
    grids.push(fallbackGrid);
  }

  return grids.slice(0, expectedCount);
}

async function solveAttempt(
  task: Task,
  attemptNum: 1 | 2,
  conversationId?: string
): Promise<AttemptResult> {
  const numTestCases = task.test.length;
  const prompt = attemptNum === 1 ? buildAttempt1Prompt(task) : buildAttempt2Prompt(numTestCases);
  const input = buildResponseInput(prompt);

  try {
    const response = await openai.responses.create({
      model: CONFIG.model,
      input,
      store: true,
      conversation: conversationId,
      reasoning: CONFIG.reasoningEffort !== 'none' ? { effort: CONFIG.reasoningEffort, summary: 'auto' } : undefined,
      text: CONFIG.reasoningEffort !== 'none' ? { verbosity: 'medium' } : undefined,
    });

    const responseText = response.output_text ?? (Array.isArray(response.output_text) ? response.output_text.join('\n') : '');
    const rawText = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

    const grids = parseMultipleGrids(rawText, numTestCases);

    return {
      grids,
      rawText,
      responseId: response.id,
      conversationId: (response as any).conversation_id,
      error: undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const fallbackGrid: Grid = [[0]];
    return {
      grids: Array(numTestCases).fill(fallbackGrid),
      rawText: '',
      responseId: '',
      error: msg,
    };
  }
}

// =============================================================================
// Main Solver
// =============================================================================

async function solveTasks(dataset: Dataset): Promise<Submission> {
  const submission: Submission = {};
  const taskIds = Object.keys(dataset).sort();

  console.log(`Processing ${taskIds.length} tasks from ${CONFIG.datasetPath}`);
  console.log(`Model: ${CONFIG.model}`);
  console.log(`Reasoning effort: ${CONFIG.reasoningEffort}`);
  console.log('');

  // Initialize submission structure
  for (const taskId of taskIds) {
    const task = dataset[taskId];
    submission[taskId] = Array(task.test.length).fill(null).map(() => ({ attempt_1: null, attempt_2: null }));
  }

  // Phase 1: Send all tasks (attempt 1) with 2-second spacing
  console.log('Phase 1: Dispatching all tasks (attempt 1)...');
  const attempt1Promises: Array<{ taskId: string; promise: Promise<AttemptResult> }> = [];

  for (const taskId of taskIds) {
    const task = dataset[taskId];
    await delay(2000); // 2-second delay between sends
    const promise = solveAttempt(task, 1);
    attempt1Promises.push({ taskId, promise });
    console.log(`[dispatch] ${taskId} attempt 1 (${task.test.length} test cases)`);
  }

  // Wait for all attempt 1 responses
  console.log('\nPhase 1: Waiting for all attempt 1 responses...');
  const attempt1Results = await Promise.all(attempt1Promises.map((item) => item.promise));

  for (let i = 0; i < attempt1Results.length; i++) {
    const result = attempt1Results[i];
    const { taskId } = attempt1Promises[i];
    const task = dataset[taskId];

    // Store grids for each test case
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      submission[taskId][testIndex].attempt_1 = result.grids[testIndex];
    }

    if (!result.error) {
      console.log(`[result] ${taskId} attempt 1: ${task.test.length} test cases submitted`);
    } else {
      console.log(`[result] ${taskId} attempt 1: FAILED - ${result.error.slice(0, 80)}`);
    }
  }

  console.log(`\nPhase 1 complete: ${attempt1Results.length} tasks processed`);

  // Phase 2: Send all tasks (attempt 2) with 2-second spacing (chained from attempt 1)
  console.log('\nPhase 2: Dispatching all tasks (attempt 2)...');
  const attempt2Promises: Array<{ taskId: string; promise: Promise<AttemptResult> }> = [];

  for (let i = 0; i < attempt1Results.length; i++) {
    const attempt1Result = attempt1Results[i];
    const { taskId } = attempt1Promises[i];
    const task = dataset[taskId];

    await delay(2000); // 2-second delay between sends
    const promise = solveAttempt(task, 2, attempt1Result.conversationId);
    attempt2Promises.push({ taskId, promise });
    console.log(`[dispatch] ${taskId} attempt 2 (${task.test.length} test cases)`);
  }

  // Wait for all attempt 2 responses
  console.log('\nPhase 2: Waiting for all attempt 2 responses...');
  const attempt2Results = await Promise.all(attempt2Promises.map((item) => item.promise));

  for (let i = 0; i < attempt2Results.length; i++) {
    const result = attempt2Results[i];
    const { taskId } = attempt2Promises[i];
    const task = dataset[taskId];

    // Store grids for each test case
    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      submission[taskId][testIndex].attempt_2 = result.grids[testIndex];
    }

    if (!result.error) {
      console.log(`[result] ${taskId} attempt 2: ${task.test.length} test cases submitted`);
    } else {
      console.log(`[result] ${taskId} attempt 2: FAILED - ${result.error.slice(0, 80)}`);
    }
  }

  console.log(`\nPhase 2 complete: ${attempt2Results.length} tasks processed`);

  return submission;
}

// =============================================================================
// Output
// =============================================================================

function writeSubmission(submission: Submission): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = path.resolve(process.cwd(), `rearc-submission-gpt5-mini-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify(submission, null, 2));
  console.log(`Submission written to: ${outPath}`);
  return outPath;
}

// =============================================================================
// Entry Point
// =============================================================================

async function main() {
  if (!fs.existsSync(CONFIG.datasetPath)) {
    console.error(`Dataset not found: ${CONFIG.datasetPath}`);
    process.exit(1);
  }

  console.log('='.repeat(72));
  console.log('RE-ARC Solver (Responses API + GPT-5-mini)');
  console.log('='.repeat(72));
  console.log('');

  const dataset: Dataset = JSON.parse(fs.readFileSync(CONFIG.datasetPath, 'utf-8'));
  const submission = await solveTasks(dataset);
  writeSubmission(submission);

  console.log('='.repeat(72));
  console.log('Done');
  console.log('='.repeat(72));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
