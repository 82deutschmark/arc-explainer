/**
 * Author: Claude Haiku 4.5
 * Date: 2026-01-09
 * PURPOSE: Clean RE-ARC solver using OpenAI Responses API with GPT-5-nano.
 *          Processes 2026RealRearc.json dataset with proper format instructions.
 *          - Uses Responses API endpoint (/v1/responses), NOT Chat Completions
 *          - Attempt chaining via conversation_id for multi-turn reasoning
 *          - Explicit JSON format requirements in prompts (critical for parsing)
 *          - Produces submission matching exact ARCSubmission interface
 * SRP/DRY check: Pass — isolated solver logic, reusable grid parsing, clean I/O
 *
 * Usage:
 *   npx tsx scripts/solvers/rearc-solver.ts [--dataset <path>] [--model <model>] [--reasoning <effort>]
 *
 * Required env:
 *   OPENAI_API_KEY - OpenAI API key
 *
 * Optional env:
 *   REARC_DATASET - Path to dataset (default: 2026RealRearc.json)
 *   REARC_MODEL - Model to use (default: gpt-5-nano)
 *   REARC_REASONING_EFFORT - low|medium|high (default: low)
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
type ReasoningEffort = 'low' | 'medium' | 'high';

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
// Configuration
// =============================================================================

const CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  datasetPath:
    process.env.REARC_DATASET || path.resolve(process.cwd(), '2026RealRearc.json'),
  model: process.env.REARC_MODEL || 'gpt-5-nano',
  reasoningEffort: (process.env.REARC_REASONING_EFFORT || 'low') as ReasoningEffort,
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
// Grid Validation
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
  // Match JSON arrays: [[...]], [[...]], etc.
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
      // Continue to next match
    }
  }

  return null;
}

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

  // Fallback: fill with [[0]] if we couldn't extract enough grids
  const fallback: Grid = [[0]];
  while (grids.length < expectedCount) {
    grids.push(fallback);
  }

  return grids.slice(0, expectedCount);
}

// =============================================================================
// Prompt Building (CRITICAL: explicit format instructions)
// =============================================================================

function buildAttempt1Prompt(task: Task, numTestCases: number): string {
  const lines: string[] = [];

  lines.push('You are solving ARC (Abstraction and Reasoning Corpus) puzzles.');
  lines.push('');
  lines.push('## Training Examples');
  lines.push('');

  task.train.forEach((pair, idx) => {
    lines.push(`Example ${idx + 1}:`);
    lines.push(`INPUT: ${JSON.stringify(pair.input)}`);
    lines.push(`OUTPUT: ${JSON.stringify(pair.output)}`);
  });

  lines.push('');
  lines.push('## Test Cases (solve these)');
  lines.push('');

  task.test.forEach((testCase, idx) => {
    lines.push(`Test ${idx + 1}:`);
    lines.push(`INPUT: ${JSON.stringify(testCase.input)}`);
  });

  lines.push('');
  lines.push('## RESPONSE FORMAT (CRITICAL - MUST FOLLOW EXACTLY)');
  lines.push('');
  lines.push(`You must output exactly ${numTestCases} JSON grid(s), one per line.`);
  lines.push('Each grid is a 2D array of integers 0-9 like: [[0,1],[2,3]]');
  lines.push('Output ONLY the grids, nothing else. Example format:');
  lines.push('[[1,2],[3,4]]');
  lines.push('[[5,6],[7,8]]');
  lines.push('');
  lines.push('Generate your first attempt now:');

  return lines.join('\n');
}

function buildAttempt2Prompt(numTestCases: number): string {
  const lines: string[] = [];

  lines.push('Continue with the same puzzle. Generate an alternative solution.');
  lines.push('');
  lines.push('## RESPONSE FORMAT (CRITICAL - MUST FOLLOW EXACTLY)');
  lines.push('');
  lines.push(`Output exactly ${numTestCases} JSON grid(s), one per line.`);
  lines.push('Each grid is a 2D array of integers 0-9 like: [[0,1],[2,3]]');
  lines.push('Output ONLY the grids, nothing else. Example format:');
  lines.push('[[1,2],[3,4]]');
  lines.push('[[5,6],[7,8]]');
  lines.push('');
  lines.push('Generate your second attempt now:');

  return lines.join('\n');
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

async function solveAttempt(
  task: Task,
  attemptNum: 1 | 2,
  conversationId?: string
): Promise<AttemptResult> {
  const numTestCases = task.test.length;
  const prompt =
    attemptNum === 1 ? buildAttempt1Prompt(task, numTestCases) : buildAttempt2Prompt(numTestCases);
  const input = buildResponseInput(prompt);

  try {
    const response = await openai.responses.create({
      model: CONFIG.model,
      input,
      store: true,
      conversation: conversationId,
      reasoning: {
        effort: CONFIG.reasoningEffort,
        summary: 'auto',
      },
      text: {
        verbosity: 'medium',
      },
    });

    const responseText = response.output_text ?? '';
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
// Main Solver
// =============================================================================

async function solveTasks(dataset: Dataset): Promise<ARCSubmission> {
  const submission: ARCSubmission = {};
  const taskIds = Object.keys(dataset).sort();

  console.log('='.repeat(70));
  console.log('RE-ARC Solver');
  console.log('='.repeat(70));
  console.log(`Dataset: ${CONFIG.datasetPath}`);
  console.log(`Model: ${CONFIG.model}`);
  console.log(`Reasoning: ${CONFIG.reasoningEffort}`);
  console.log(`Tasks: ${taskIds.length}`);
  console.log('='.repeat(70));
  console.log('');

  // Initialize submission structure
  for (const taskId of taskIds) {
    const task = dataset[taskId];
    submission[taskId] = Array(task.test.length)
      .fill(null)
      .map(() => ({
        attempt_1: [[0]],
        attempt_2: [[0]],
      }));
  }

  // Phase 1: First attempt for all tasks
  console.log('Phase 1: Sending attempt 1 for all tasks...');
  const attempt1Results: Array<{ taskId: string; result: AttemptResult }> = [];

  for (const taskId of taskIds) {
    const task = dataset[taskId];
    const result = await solveAttempt(task, 1);
    attempt1Results.push({ taskId, result });

    // Store grids in submission
    for (let i = 0; i < task.test.length; i++) {
      submission[taskId][i].attempt_1 = result.grids[i];
    }

    const status = result.error ? `FAILED: ${result.error.slice(0, 60)}` : 'OK';
    console.log(`  ${taskId}: attempt 1 (${task.test.length} test cases) - ${status}`);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('');
  console.log('Phase 2: Sending attempt 2 for all tasks (chained)...');
  const attempt2Results: Array<{ taskId: string; result: AttemptResult }> = [];

  for (const { taskId, result: attempt1Result } of attempt1Results) {
    const task = dataset[taskId];
    const result = await solveAttempt(task, 2, attempt1Result.conversationId);
    attempt2Results.push({ taskId, result });

    // Store grids in submission
    for (let i = 0; i < task.test.length; i++) {
      submission[taskId][i].attempt_2 = result.grids[i];
    }

    const status = result.error ? `FAILED: ${result.error.slice(0, 60)}` : 'OK';
    console.log(`  ${taskId}: attempt 2 (${task.test.length} test cases) - ${status}`);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('');
  return submission;
}

// =============================================================================
// Output
// =============================================================================

function writeSubmission(submission: ARCSubmission): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `rearc-submission-gpt5-nano-${timestamp}.json`;
  const outPath = path.resolve(process.cwd(), filename);

  fs.writeFileSync(outPath, JSON.stringify(submission, null, 2));
  console.log(`Submission written: ${outPath}`);
  return outPath;
}

// =============================================================================
// Entry Point
// =============================================================================

async function main() {
  if (!fs.existsSync(CONFIG.datasetPath)) {
    console.error(`Error: Dataset not found at ${CONFIG.datasetPath}`);
    process.exit(1);
  }

  const dataset: Dataset = JSON.parse(fs.readFileSync(CONFIG.datasetPath, 'utf-8'));
  const submission = await solveTasks(dataset);
  writeSubmission(submission);

  console.log('');
  console.log('='.repeat(70));
  console.log('Complete!');
  console.log('='.repeat(70));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
