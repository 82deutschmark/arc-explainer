/**
 * Author: Cascade
 * Date: 2025-12-16T00:00:00Z
 * PURPOSE: Pure helper utilities for ARC-AGI harness-style scoring.
 *          This file intentionally contains no database or HTTP concerns.
 *          It exists so we can unit test the official scoring math (average of puzzle scores)
 *          vs pair-weighted metrics.
 * SRP/DRY check: Pass - Single-purpose scoring helpers used by repositories and tests.
 */

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
  const numPairs = Math.max(
    input.numPairs ?? 0,
    input.attempt1Pairs.length,
    input.attempt2Pairs.length,
    1,
  );

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
