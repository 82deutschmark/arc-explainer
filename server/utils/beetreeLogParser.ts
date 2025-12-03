/**
 * BeeTree Log Parser
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-01-12
 * PURPOSE: Parse BeeTree step logs to extract run data, aggregate costs/tokens, and build ensemble metadata.
 *          Handles reading step_1, step_3, step_5, and step_finish logs for a given task/test combination.
 *
 * SRP/DRY check: Pass - Single responsibility (log parsing), reuses filesystem utilities.
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type {
  BeeTreeStepLog,
  BeeTreeStepFinish,
  BeeTreeParsedRun,
  BeeTreeCandidate,
  BeeTreeEnsembleMetadata,
  BeeTreeLogIndex
} from '../types/beetree.ts';

/**
 * Extract model name from BeeTree run_id
 * @example
 * extractModelName('claude-opus-4.5-thinking-60000_1_step_1_1234567.89')
 * // Returns 'claude-opus-4.5'
 */
export function extractModelName(runId: string): string {
  // Run ID format: {model_name}_{increment}_{step}_{timestamp}
  // Example: claude-opus-4.5-thinking-60000_1_step_1_1234567.89

  // Find the last occurrence of _step_ to split model name from metadata
  const stepIndex = runId.lastIndexOf('_step_');
  if (stepIndex === -1) {
    // Fallback: try to extract before the first underscore followed by a digit
    const match = runId.match(/^(.+?)_\d+/);
    return match ? match[1] : runId;
  }

  // Extract everything before _step_, then remove the trailing _increment
  const beforeStep = runId.substring(0, stepIndex);
  const lastUnderscore = beforeStep.lastIndexOf('_');

  return lastUnderscore !== -1 ? beforeStep.substring(0, lastUnderscore) : beforeStep;
}

/**
 * Extract step number from run_id
 */
export function extractStepNumber(runId: string): number {
  const match = runId.match(/_step_(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Read and parse a step log file
 */
export async function readStepLog(filePath: string): Promise<BeeTreeStepLog> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as BeeTreeStepLog;
  } catch (error) {
    throw new Error(`Failed to read step log ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read and parse step_finish log file
 */
export async function readStepFinishLog(filePath: string): Promise<BeeTreeStepFinish> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as BeeTreeStepFinish;
  } catch (error) {
    throw new Error(`Failed to read step_finish log ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Parse a single run entry from a step log
 */
export function parseRunEntry(runId: string, entry: any): BeeTreeParsedRun {
  return {
    run_id: runId,
    model_name: extractModelName(runId),
    step: extractStepNumber(runId),
    input_tokens: entry.input_tokens || 0,
    output_tokens: entry.output_tokens || 0,
    cached_tokens: entry.cached_tokens || 0,
    cost: entry.total_cost || 0,
    duration_seconds: entry.duration_seconds || 0,
    full_response: entry['Full raw LLM response'] || '',
    grid: entry['Extracted grid'] || null
  };
}

/**
 * Find a run entry across all step logs
 */
export async function findRunInLogs(
  runId: string,
  logsDirectory: string,
  timestamp: string,
  taskId: string,
  testIndex: number
): Promise<BeeTreeParsedRun | null> {
  const steps = [1, 3, 5];

  for (const step of steps) {
    const logPath = join(logsDirectory, `${timestamp}_${taskId}_${testIndex}_step_${step}.json`);

    if (!existsSync(logPath)) {
      continue;
    }

    try {
      const stepLog = await readStepLog(logPath);

      // Check if this run_id exists in this step log
      for (const [logRunId, entry] of Object.entries(stepLog)) {
        // Match by run_id prefix (ignore timestamp suffix)
        if (logRunId.startsWith(runId) || runId.startsWith(logRunId.split('_')[0])) {
          return parseRunEntry(logRunId, entry);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read step ${step} log: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
}

/**
 * Aggregate costs and tokens from multiple runs
 */
export function aggregateRunStats(runs: BeeTreeParsedRun[]): {
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
} {
  const total_input_tokens = runs.reduce((sum, run) => sum + run.input_tokens, 0);
  const total_output_tokens = runs.reduce((sum, run) => sum + run.output_tokens, 0);
  const estimated_cost = runs.reduce((sum, run) => sum + run.cost, 0);

  return {
    total_input_tokens,
    total_output_tokens,
    total_tokens: total_input_tokens + total_output_tokens,
    estimated_cost
  };
}

/**
 * Build ensemble metadata for provider_raw_response
 */
export function buildEnsembleMetadata(
  candidatesObject: any,
  pickedSolution: BeeTreeCandidate,
  contributingRuns: BeeTreeParsedRun[]
): BeeTreeEnsembleMetadata {
  const voteCount = pickedSolution.count;
  const totalRuns = contributingRuns.length;

  return {
    beetree_metadata: {
      version: 'v1',
      candidates_object: candidatesObject,
      picked_solution: pickedSolution,
      contributing_models: contributingRuns.map(run => ({
        run_id: run.run_id,
        model_name: run.model_name,
        step: run.step,
        input_tokens: run.input_tokens,
        output_tokens: run.output_tokens,
        cost: run.cost,
        duration_seconds: run.duration_seconds,
        grid: run.grid
      })),
      vote_count: voteCount,
      total_runs: totalRuns,
      agreement_rate: totalRuns > 0 ? voteCount / totalRuns : 0
    }
  };
}

/**
 * Index all log files in a directory for quick lookup
 */
export async function indexLogDirectory(logsDirectory: string): Promise<Map<string, BeeTreeLogIndex>> {
  const { readdir } = await import('fs/promises');
  const index = new Map<string, BeeTreeLogIndex>();

  try {
    const files = await readdir(logsDirectory);

    for (const file of files) {
      // Match pattern: {timestamp}_{task_id}_{test_index}_step_{X}.json
      const match = file.match(/^(.+?)_([a-f0-9]+)_(\d+)_step_(finish|\d+)\.json$/);

      if (!match) continue;

      const [, timestamp, taskId, testIndexStr, stepStr] = match;
      const testIndex = parseInt(testIndexStr, 10);
      const key = `${taskId}_${testIndex}`;

      if (!index.has(key)) {
        index.set(key, {
          task_id: taskId,
          test_index: testIndex,
          timestamp,
          step_finish_path: ''
        });
      }

      const entry = index.get(key)!;
      const filePath = join(logsDirectory, file);

      if (stepStr === 'finish') {
        entry.step_finish_path = filePath;
      } else {
        const stepNum = parseInt(stepStr, 10);
        if (stepNum === 1) entry.step_1_path = filePath;
        else if (stepNum === 3) entry.step_3_path = filePath;
        else if (stepNum === 5) entry.step_5_path = filePath;
      }
    }
  } catch (error) {
    throw new Error(`Failed to index log directory: ${error instanceof Error ? error.message : String(error)}`);
  }

  return index;
}

/**
 * Get all contributing runs for a specific attempt
 */
export async function getContributingRuns(
  pickedSolution: BeeTreeCandidate,
  logsDirectory: string,
  timestamp: string,
  taskId: string,
  testIndex: number
): Promise<BeeTreeParsedRun[]> {
  const runs: BeeTreeParsedRun[] = [];

  for (const runId of pickedSolution.models) {
    const run = await findRunInLogs(runId, logsDirectory, timestamp, taskId, testIndex);
    if (run) {
      runs.push(run);
    }
  }

  return runs;
}

/**
 * Extract timestamp from log filename or submission filename
 */
export function extractTimestamp(filename: string): string | null {
  // Match pattern: {timestamp}_something.json
  const match = filename.match(/^(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
