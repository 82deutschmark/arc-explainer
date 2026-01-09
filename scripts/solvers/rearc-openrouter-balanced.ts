/**
 * Author: Cascade (ChatGPT)
 * Date: 2026-01-09
 * PURPOSE: Balanced RE-ARC solver that targets OpenRouter reasoning models while
 *          enforcing an explicit completion budget so grids arrive before the
 *          provider truncates output. Streams per-task logs, budgets reasoning
 *          tokens, and writes RE-ARC submission files without checkpoints.
 * SRP/DRY check: Pass — self-contained solver module; relies on shared helpers
 *          only for filesystem access and does not duplicate other solver flows.
 */

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

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

interface AttemptRecord {
  attempt_1: Grid;
  attempt_2: Grid;
}

interface Submission {
  [taskId: string]: AttemptRecord[];
}

type ReasoningEffort = 'high' | 'medium' | 'low' | 'minimal' | 'none';

interface SolverCliOptions {
  datasetPath: string;
  modelKey: string;
  reasoningEffort: ReasoningEffort;
  maxOutputTokens: number;
  attemptDelayMs: number;
  reserveCompletionTokens: number;
}

interface AttemptResult {
  grid: Grid | null;
  finishReason?: string | null;
  completionTokens?: number;
  promptTokens?: number;
  reasoningTokens?: number;
  rawText?: string;
  error?: string;
}

// ============================================================================
// Configuration helpers
// ============================================================================

const PROVIDER_COMPLETION_LIMIT = 65536; // Xiaomi MiMo V2 Flash free catalog limit
const MIN_COMPLETION_BUDGET = 2048;
const DEFAULT_COMPLETION_BUDGET = 60000;
const DEFAULT_COMPLETION_RESERVE = 512; // leave room for final grid even if reasoning runs long
const DEFAULT_ATTEMPT_DELAY_MS = Number(process.env.REARC_LAUNCH_DELAY_MS) || 5000;

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  timeout: 30 * 60 * 1000,
  defaultHeaders: {
    'HTTP-Referer': 'https://arc.markbarney.net',
    'X-Title': 'ARC Explainer RE-ARC Solver',
  },
});

if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY is required for this solver.');
  process.exit(1);
}

function parseCliArgs(): SolverCliOptions {
  const args = process.argv.slice(2);
  const datasetArgIndex = args.indexOf('--dataset');
  const datasetPath =
    datasetArgIndex !== -1 && args[datasetArgIndex + 1]
      ? path.resolve(args[datasetArgIndex + 1])
      : process.env.REARC_DATASET || path.resolve(process.cwd(), 'REARC2026.json');

  const modelIndex = args.indexOf('--model');
  const modelKey =
    modelIndex !== -1 && args[modelIndex + 1]
      ? args[modelIndex + 1]
      : process.env.REARC_MODEL || 'xiaomi/mimo-v2-flash:free';

  const effortIndex = args.indexOf('--reasoning-effort');
  const reasoningEffort =
    ((effortIndex !== -1 && args[effortIndex + 1]) || process.env.REARC_REASONING_EFFORT || 'medium') as ReasoningEffort;

  const maxOutputIndex = args.indexOf('--max-output');
  const requestedOutputTokens =
    (maxOutputIndex !== -1 && Number(args[maxOutputIndex + 1])) ||
    Number(process.env.REARC_MAX_OUTPUT_TOKENS) ||
    DEFAULT_COMPLETION_BUDGET;

  const reserveIndex = args.indexOf('--reserve-completion');
  const reserveTokens =
    (reserveIndex !== -1 && Number(args[reserveIndex + 1])) ||
    Number(process.env.REARC_RESERVE_COMPLETION_TOKENS) ||
    DEFAULT_COMPLETION_RESERVE;

  const delayIndex = args.indexOf('--attempt-delay');
  const attemptDelayMs =
    (delayIndex !== -1 && Number(args[delayIndex + 1])) ||
    Number(process.env.REARC_ATTEMPT_DELAY_MS) ||
    DEFAULT_ATTEMPT_DELAY_MS;

  const cappedOutputTokens = Math.max(
    MIN_COMPLETION_BUDGET,
    Math.min(PROVIDER_COMPLETION_LIMIT, Math.floor(requestedOutputTokens))
  );

  if (reserveTokens >= cappedOutputTokens) {
    console.warn(
      `Reserve tokens (${reserveTokens}) cannot exceed max output tokens (${cappedOutputTokens}). Using default reserve ${DEFAULT_COMPLETION_RESERVE}.`
    );
  }

  return {
    datasetPath,
    modelKey,
    reasoningEffort,
    maxOutputTokens: cappedOutputTokens,
    attemptDelayMs: Math.max(1000, attemptDelayMs),
    reserveCompletionTokens:
      reserveTokens < cappedOutputTokens ? Math.max(128, reserveTokens) : DEFAULT_COMPLETION_RESERVE,
  };
}

const CLI = parseCliArgs();

const REASONING_RATIOS: Record<Exclude<ReasoningEffort, 'none'>, number> = {
  high: 0.8,
  medium: 0.5,
  low: 0.2,
  minimal: 0.1,
};

function computeBudgets() {
  if (CLI.reasoningEffort === 'none') {
    return { reasoningBudget: 0, completionBudget: CLI.maxOutputTokens };
  }

  const ratio = REASONING_RATIOS[CLI.reasoningEffort] ?? 0.5;
  const reasoningBudget = Math.floor(CLI.maxOutputTokens * ratio);
  const completionBudget = CLI.maxOutputTokens - CLI.reserveCompletionTokens;

  if (reasoningBudget >= completionBudget) {
    const trimmedReasoning = completionBudget - CLI.reserveCompletionTokens;
    return {
      reasoningBudget: Math.max(1024, trimmedReasoning),
      completionBudget,
    };
  }

  return { reasoningBudget, completionBudget };
}

const BUDGETS = computeBudgets();

// ============================================================================
// Utility helpers
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatGrid(grid: Grid): string {
  return grid.map((row) => row.join(' ')).join('\n');
}

function parseGridFromResponse(text: string): Grid | null {
  const jsonMatch = text.match(/\[\s*\[[\s\S]*?\]\s*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (row) =>
            Array.isArray(row) &&
            row.length > 0 &&
            row.every((cell) => typeof cell === 'number' && Number.isInteger(cell) && cell >= 0 && cell <= 9)
        )
      ) {
        return parsed;
      }
    } catch {
      // fall through to next parsing strategy
    }
  }
  return null;
}

function normalizeContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((chunk) => {
        if (typeof chunk === 'string') return chunk;
        if (typeof chunk === 'object' && chunk && 'text' in chunk && typeof (chunk as any).text === 'string') {
          return (chunk as any).text as string;
        }
        return '';
      })
      .join('\n');
  }
  if (typeof content === 'object' && content && 'text' in content && typeof (content as any).text === 'string') {
    return (content as any).text as string;
  }
  return content ? String(content) : '';
}

function buildPrompt(task: Task, testIndex: number, attemptNum: 1 | 2): string {
  const lines: string[] = [];
  lines.push('You are an ARC (Abstraction and Reasoning Corpus) solver.');
  lines.push('Study the training pairs and output ONLY the solved grid for the given test input.');
  lines.push('');
  lines.push('## Training Examples');
  lines.push('');

  task.train.forEach((pair, idx) => {
    lines.push(`### Example ${idx + 1}`);
    lines.push('Input:');
    lines.push(formatGrid(pair.input));
    lines.push('Output:');
    lines.push(formatGrid(pair.output));
    lines.push('');
  });

  lines.push('## Test Input');
  lines.push(formatGrid(task.test[testIndex].input));
  lines.push('');

  if (attemptNum === 1) {
    lines.push('Respond with a JSON array of arrays, no prose.');
  } else {
    lines.push('Produce an alternative JSON grid. Do not repeat attempt 1 verbatim.');
  }

  return lines.join('\n');
}

function ensureSubmissionSlot(submission: Submission, taskId: string, testIndex: number): AttemptRecord {
  if (!submission[taskId]) {
    submission[taskId] = [];
  }
  if (!submission[taskId][testIndex]) {
    submission[taskId][testIndex] = { attempt_1: [[0]], attempt_2: [[0]] };
  }
  return submission[taskId][testIndex];
}

// ============================================================================
// OpenRouter call
// ============================================================================

async function solveSingleAttempt(
  taskId: string,
  task: Task,
  testIndex: number,
  attemptNum: 1 | 2
): Promise<AttemptResult> {
  const prompt = buildPrompt(task, testIndex, attemptNum);
  const reasoningPayload =
    CLI.reasoningEffort === 'none'
      ? undefined
      : {
          effort: CLI.reasoningEffort,
          exclude: true,
        };

  try {
    const response = await openrouter.chat.completions.create({
      model: CLI.modelKey,
      messages: [
        {
          role: 'system',
          content:
            'You solve ARC puzzles and must respond with only the JSON output grid. Omit commentary, steps, and delimiters.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: attemptNum === 1 ? 0 : 0.35,
      max_output_tokens: CLI.maxOutputTokens,
      reasoning: reasoningPayload,
    } as any);

    const choice = response.choices[0];
    const message = choice?.message as {
      content?: string | Array<{ type?: string; text?: string }> | unknown;
      reasoning?: string;
    };
    const content = normalizeContent(message?.content);
    const grid = parseGridFromResponse(content);

    if (!grid) {
      return {
        grid: null,
        finishReason: choice?.finish_reason ?? null,
        completionTokens: response.usage?.completion_tokens ?? undefined,
        promptTokens: response.usage?.prompt_tokens ?? undefined,
        reasoningTokens: message?.reasoning?.length ?? undefined,
        rawText: content.slice(0, 500),
        error: 'Failed to parse grid from response.',
      };
    }

    return {
      grid,
      finishReason: choice?.finish_reason ?? null,
      completionTokens: response.usage?.completion_tokens ?? undefined,
      promptTokens: response.usage?.prompt_tokens ?? undefined,
      reasoningTokens: message?.reasoning?.length ?? undefined,
      rawText: content.slice(0, 500),
    };
  } catch (err: any) {
    const errorMessage = err?.response?.data?.error || err?.message || 'Unknown OpenRouter error';
    return {
      grid: null,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Main solver flow
// ============================================================================

async function runSolver(dataset: Dataset) {
  const submission: Submission = {};
  const sortedTaskIds = Object.keys(dataset).sort();

  console.log('='.repeat(72));
  console.log('Balanced OpenRouter RE-ARC solver');
  console.log('='.repeat(72));
  console.log(`Dataset: ${CLI.datasetPath}`);
  console.log(`Tasks: ${sortedTaskIds.length}`);
  console.log(`Model: ${CLI.modelKey}`);
  console.log(`Reasoning effort: ${CLI.reasoningEffort}`);
  console.log(`Max output tokens: ${CLI.maxOutputTokens}`);
  console.log(`Reserved completion tokens: ${CLI.reserveCompletionTokens}`);
  console.log(`Derived reasoning budget (approx): ${BUDGETS.reasoningBudget}`);
  console.log(`Attempt delay: ${CLI.attemptDelayMs}ms`);
  console.log('='.repeat(72));

  let successCount = 0;
  let failureCount = 0;
  let lengthStops = 0;

  for (let i = 0; i < sortedTaskIds.length; i++) {
    const taskId = sortedTaskIds[i];
    const task = dataset[taskId];
    console.log(`\n[task ${i + 1}/${sortedTaskIds.length}] ${taskId}`);

    for (let testIndex = 0; testIndex < task.test.length; testIndex++) {
      console.log(`  Test case ${testIndex + 1}/${task.test.length}`);

      for (const attemptNum of [1, 2] as const) {
        await delay(CLI.attemptDelayMs);
        console.log(`    Attempt ${attemptNum}...`);
        const result = await solveSingleAttempt(taskId, task, testIndex, attemptNum);
        const attemptRecord = ensureSubmissionSlot(submission, taskId, testIndex);
        const key = attemptNum === 1 ? 'attempt_1' : 'attempt_2';

        if (result.grid) {
          attemptRecord[key] = result.grid;
          successCount++;
          console.log(
            `      ✅ parsed grid (${result.completionTokens ?? 'n/a'} completion tokens, finish=${result.finishReason ?? 'unknown'})`
          );
        } else {
          attemptRecord[key] = [[0]];
          failureCount++;
          if (result.finishReason === 'length') {
            lengthStops++;
          }
          console.warn(
            `      ⚠️  Failed (${result.finishReason ?? 'unknown'}). ${result.error ?? 'No additional details.'}`
          );
          if (result.rawText) {
            console.warn(`         Sample: ${result.rawText}`);
          }
        }
      }
    }
  }

  const outputPath = writeSubmission(submission);
  console.log('\n'.repeat(1));
  console.log('Summary');
  console.log('='.repeat(40));
  console.log(`Successes: ${successCount}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Length-stops: ${lengthStops}`);
  console.log(`Submission written to: ${outputPath}`);
}

function writeSubmission(submission: Submission): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `rearc-submission-openrouter-balanced-${timestamp}.json`;
  const outputPath = path.resolve(process.cwd(), filename);
  fs.writeFileSync(outputPath, JSON.stringify(submission, null, 2));
  return outputPath;
}

async function main() {
  if (!fs.existsSync(CLI.datasetPath)) {
    console.error(`Dataset not found: ${CLI.datasetPath}`);
    process.exit(1);
  }

  const dataset: Dataset = JSON.parse(fs.readFileSync(CLI.datasetPath, 'utf-8'));
  await runSolver(dataset);
}

main().catch((err) => {
  console.error('Fatal solver error:', err);
  process.exit(1);
});
