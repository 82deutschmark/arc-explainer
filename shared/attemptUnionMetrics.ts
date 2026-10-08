/**
 * Author: GPT-6 Codex
 * Date: 2026-10-07
 * PURPOSE: Shared contract for recorded cost and timing coverage across two scored attempts.
 * SRP/DRY check: Pass — one wire type shared by the scoring repository and results page.
 */

export interface AttemptUnionCostMetrics {
  totalAttempts: number;
  costedAttempts: number;
  timedAttempts: number;
  recordedTotalCost: number | null;
  avgRecordedCostPerAttempt: number | null;
  costPerSolvedPuzzle: number | null;
  avgRecordedTimeMs: number | null;
}
