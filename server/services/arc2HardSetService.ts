/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: Builds the ARC-AGI-2 hard set for /api/arc2/hard-set: every ARC2-Eval puzzle that at most
 *          ARC2_HARD_SET_MAX_SOLVES logged attempts have solved, with who solved it and when. An
 *          "attempt" is one scored explanation row (our own runs plus the Hugging Face ingests of the
 *          official harness), scored the way AccuracyRepository scores it: a multi-test record counts
 *          only when every test output is right. Membership is computed from the database on every
 *          call, never from a hand-kept list, so the page tracks new ingests on its own.
 * SRP/DRY check: Pass — reuses puzzleOverviewService.getWorstPerformingPuzzles for the per-puzzle
 *                aggregate (source filter, attempt counts, models attempted) and
 *                ExplanationRepository.getExplanationsForPuzzle(id, 'correct') for the solver list;
 *                the solve threshold and bucket names live in shared/arc2HardSet.ts.
 */

import { puzzleOverviewService } from './puzzleOverviewService.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';
import { ARC2_HARD_SET_MAX_SOLVES, bucketForSolves, type Arc2HardSetBucket } from '../../shared/arc2HardSet.ts';

export interface Arc2HardSetSolver {
  explanationId: number;
  modelName: string;
  createdAt: string | null;
}

export interface Arc2HardSetPuzzle {
  puzzleId: string;
  bucket: Arc2HardSetBucket;
  testCaseCount: number;
  /** Scored attempts logged for this puzzle (unscored rows are not counted). */
  attempts: number;
  solved: number;
  modelsAttempted: number;
  latestAttempt: string | null;
  solvers: Arc2HardSetSolver[];
}

/**
 * The worst-performing query filters on average accuracy before the exact solver count is known.
 * Two solves out of the smallest attempt count seen on the eval set is well under this, and a
 * generous bound only costs a few extra correct-row lookups, so it stays loose on purpose.
 */
const ACCURACY_PREFILTER = 0.25;
const PUZZLE_LIMIT = 500;

export async function getArc2HardSet(maxSolves: number = ARC2_HARD_SET_MAX_SOLVES): Promise<Arc2HardSetPuzzle[]> {
  if (!repositoryService.isConnected()) {
    logger.warn('Database not connected - returning empty ARC2 hard set', 'arc2-hard-set');
    return [];
  }

  const candidates = await puzzleOverviewService.getWorstPerformingPuzzles(PUZZLE_LIMIT, 'composite', {
    source: 'ARC2-Eval',
    maxAccuracy: ACCURACY_PREFILTER,
    includeRichMetrics: true,
  });

  const puzzles: Arc2HardSetPuzzle[] = [];
  for (const candidate of candidates) {
    const performance = candidate.performanceData ?? {};
    const attempts: number = Number(performance.totalExplanations ?? 0);
    if (attempts === 0) continue;

    // The exact solver list is the source of truth for the count; the aggregate's average accuracy
    // is only the prefilter. Correct rows are few, so fetching them in full is cheap.
    const correctRows = await repositoryService.explanations.getExplanationsForPuzzle(candidate.id, 'correct');
    const solved = correctRows.length;
    if (solved > maxSolves) continue;
    const bucket = bucketForSolves(solved);
    if (!bucket) continue;

    puzzles.push({
      puzzleId: candidate.id,
      bucket,
      testCaseCount: Number(candidate.testCaseCount ?? 0),
      attempts,
      solved,
      modelsAttempted: Number(performance.modelsAttemptedCount ?? 0),
      latestAttempt: performance.latestAnalysis ? String(performance.latestAnalysis) : null,
      solvers: correctRows
        .map((row) => ({
          explanationId: row.id,
          modelName: row.modelName,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        }))
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? '')),
    });
  }

  // Hardest first: fewest solves, then most attempts (more failures is stronger evidence).
  puzzles.sort((a, b) => a.solved - b.solved || b.attempts - a.attempts || a.puzzleId.localeCompare(b.puzzleId));
  return puzzles;
}
