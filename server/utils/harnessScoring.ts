/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Pure helper utilities for ARC-AGI harness-style scoring.
 *          This file intentionally contains no database or HTTP concerns.
 *          It exists so we can unit test the official scoring math (average of puzzle scores)
 *          vs pair-weighted metrics. Scores stored attempts against authoritative task test counts,
 *          deduplicates runs, and aggregates the cost/timing of the same selected attempts.
 * SRP/DRY check: Pass - Single-purpose scoring helpers used by repositories and tests.
*/

import type { AttemptUnionCostMetrics } from '../../shared/attemptUnionMetrics.ts';

export interface HarnessPuzzleAttemptPairs {
  attempt1Pairs: boolean[];
  attempt2Pairs: boolean[];
  numPairs?: number;
}

export interface HarnessPuzzleScore {
  numPairs: number;
  solvedPairs: number;
  puzzleScore: number; // 0..1
  fullySolved: boolean;
}

export interface HarnessDatasetScore {
  puzzlesCounted: number;
  puzzlesFullySolved: number;
  harnessScore: number; // 0..1 (average of per-puzzle scores)
  pairWeightedCorrectPairs: number;
  pairWeightedTotalPairs: number;
  pairWeightedAccuracy: number; // 0..1
}

/**
 * Computes harness-style union score for a single puzzle.
 *
 * A pair counts as solved if either attempt was correct for that pair.
 */
export function computePuzzleUnionScore(input: HarnessPuzzleAttemptPairs): HarnessPuzzleScore {
  // An explicit count comes from the task, never from the submission. Extra answers
  // cannot add test cases; absent answers remain unsolved within this exact count.
  const numPairs = input.numPairs ?? Math.max(input.attempt1Pairs.length, input.attempt2Pairs.length, 1);
  if (!Number.isInteger(numPairs) || numPairs < 1) {
    throw new Error('A scored ARC task must have at least one test case');
  }

  let solvedPairs = 0;

  for (let i = 0; i < numPairs; i++) {
    const a1Correct = input.attempt1Pairs[i] === true;
    const a2Correct = input.attempt2Pairs[i] === true;

    if (a1Correct || a2Correct) {
      solvedPairs++;
    }
  }

  const puzzleScore = numPairs > 0 ? solvedPairs / numPairs : 0;

  return {
    numPairs,
    solvedPairs,
    puzzleScore,
    fullySolved: solvedPairs === numPairs,
  };
}

export interface StoredHarnessAttempt {
  id?: number;
  puzzle_id: string;
  model_name: string;
  created_at?: Date | string;
  is_prediction_correct?: boolean | null;
  multi_test_all_correct?: boolean | null;
  multi_test_results?: unknown;
  estimated_cost?: number | string | null;
  api_processing_time_ms?: number | string | null;
}

/** Map stored validation flags to the task's actual test indices. */
export function extractStoredPairResults(row: StoredHarnessAttempt | undefined, numPairs: number): boolean[] {
  const pairs = Array<boolean>(numPairs).fill(false);
  if (!row) return pairs;

  let results = row.multi_test_results;
  if (typeof results === 'string') {
    try { results = JSON.parse(results); } catch { results = undefined; }
  }
  if (Array.isArray(results) && results.length > 0) {
    results.forEach((result, position) => {
      if (!result || typeof result !== 'object') return;
      // Current validators persist `index`; older imports used array order.
      const index = result.index ?? result.pair_index ?? position;
      if (Number.isInteger(index) && index >= 0 && index < numPairs) {
        pairs[index] = result.isPredictionCorrect === true;
      }
    });
  } else if (row.multi_test_all_correct === true) {
    pairs.fill(true);
  } else {
    // A single prediction flag only describes the first test, never all tests.
    pairs[0] = row.is_prediction_correct === true;
  }
  return pairs;
}

const nonnegativeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/**
 * Score exactly the selected tasks and two attempt models. Latest rows win per
 * task/model, matching repository queries, so duplicate imports cannot improve a
 * score or double-count costs. Missing tasks count zero, with their real pair counts.
 */
export function computeStoredAttemptUnion(
  testPairCounts: ReadonlyMap<string, number>,
  modelNames: readonly [string, string],
  rows: readonly StoredHarnessAttempt[],
): HarnessDatasetScore & {
  puzzlesFullySolvedIds: string[];
  attemptedPuzzleCount: number;
  costMetrics: AttemptUnionCostMetrics;
} {
  if (modelNames[0] === modelNames[1]) throw new Error('Two distinct attempt models are required');
  const latest = new Map<string, StoredHarnessAttempt>();
  const stamp = (row: StoredHarnessAttempt) => new Date(row.created_at ?? 0).getTime() || 0;
  for (const row of rows) {
    if (!testPairCounts.has(row.puzzle_id) || !modelNames.includes(row.model_name)) continue;
    const key = `${row.puzzle_id}\u0000${row.model_name}`;
    const previous = latest.get(key);
    if (!previous || stamp(row) > stamp(previous) ||
        (stamp(row) === stamp(previous) && (row.id ?? 0) > (previous.id ?? 0))) {
      latest.set(key, row);
    }
  }

  const puzzles: HarnessPuzzleAttemptPairs[] = [];
  const puzzlesFullySolvedIds: string[] = [];
  let attemptedPuzzleCount = 0;
  for (const [puzzleId, numPairs] of testPairCounts) {
    const attempt1 = latest.get(`${puzzleId}\u0000${modelNames[0]}`);
    const attempt2 = latest.get(`${puzzleId}\u0000${modelNames[1]}`);
    const puzzle = {
      numPairs,
      attempt1Pairs: extractStoredPairResults(attempt1, numPairs),
      attempt2Pairs: extractStoredPairResults(attempt2, numPairs),
    };
    if (attempt1 || attempt2) attemptedPuzzleCount++;
    if (computePuzzleUnionScore(puzzle).fullySolved) puzzlesFullySolvedIds.push(puzzleId);
    puzzles.push(puzzle);
  }
  const score = computeDatasetUnionScores(puzzles);
  let totalCost = 0;
  let totalTime = 0;
  let costedAttempts = 0;
  let timedAttempts = 0;
  for (const row of latest.values()) {
    const cost = nonnegativeNumber(row.estimated_cost);
    const time = nonnegativeNumber(row.api_processing_time_ms);
    if (cost !== null) { totalCost += cost; costedAttempts++; }
    if (time !== null) { totalTime += time; timedAttempts++; }
  }
  return {
    ...score,
    puzzlesFullySolvedIds,
    attemptedPuzzleCount,
    costMetrics: {
      totalAttempts: latest.size,
      costedAttempts,
      timedAttempts,
      recordedTotalCost: costedAttempts > 0 ? totalCost : null,
      avgRecordedCostPerAttempt: costedAttempts > 0 ? totalCost / costedAttempts : null,
      // Do not present incomplete cost metadata as the total cost of a success.
      costPerSolvedPuzzle: costedAttempts === latest.size && costedAttempts > 0 && score.puzzlesFullySolved > 0
        ? totalCost / score.puzzlesFullySolved : null,
      avgRecordedTimeMs: timedAttempts > 0 ? totalTime / timedAttempts : null,
    },
  };
}

/**
 * Computes dataset-level harness-aligned score and pair-weighted accuracy.
 */
export function computeDatasetUnionScores(puzzles: HarnessPuzzleAttemptPairs[]): HarnessDatasetScore {
  let puzzlesCounted = 0;
  let puzzlesFullySolved = 0;
  let sumPuzzleScores = 0;

  let pairWeightedCorrectPairs = 0;
  let pairWeightedTotalPairs = 0;

  for (const puzzle of puzzles) {
    const score = computePuzzleUnionScore(puzzle);

    puzzlesCounted++;
    sumPuzzleScores += score.puzzleScore;

    pairWeightedCorrectPairs += score.solvedPairs;
    pairWeightedTotalPairs += score.numPairs;

    if (score.fullySolved) {
      puzzlesFullySolved++;
    }
  }

  const harnessScore = puzzlesCounted > 0 ? sumPuzzleScores / puzzlesCounted : 0;
  const pairWeightedAccuracy = pairWeightedTotalPairs > 0 ? pairWeightedCorrectPairs / pairWeightedTotalPairs : 0;

  return {
    puzzlesCounted,
    puzzlesFullySolved,
    harnessScore,
    pairWeightedCorrectPairs,
    pairWeightedTotalPairs,
    pairWeightedAccuracy,
  };
}
