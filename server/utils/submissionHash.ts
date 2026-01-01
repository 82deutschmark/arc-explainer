/**
 * submissionHash.ts
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-30
 * PURPOSE: Compute deterministic SHA-256 hashes of RE-ARC submissions for verification.
 *          Same submission content always produces the same hash, enabling duplicate detection.
 * SRP/DRY check: Pass - Single responsibility for submission hashing
 */

import { createHash } from 'crypto';
import type { ARCSubmission } from '../../shared/types.ts';

/**
 * Compute a deterministic SHA-256 hash of an ARC submission.
 *
 * The hash is computed from a normalized JSON representation:
 * - Keys are sorted alphabetically at all levels
 * - No whitespace in output
 * - Consistent array ordering (preserved as-is since order matters for predictions)
 *
 * @param submission The ARC submission object
 * @returns 64-character lowercase hex SHA-256 hash
 */
export function computeSubmissionHash(submission: ARCSubmission): string {
  // Sort task IDs for consistent ordering
  const sortedTaskIds = Object.keys(submission).sort();

  // Build normalized object with sorted keys
  const normalized: Record<string, any> = {};
  for (const taskId of sortedTaskIds) {
    const predictions = submission[taskId];
    // Predictions array order is significant (matches test input order), so preserve it
    // But normalize each prediction object's keys
    normalized[taskId] = predictions.map(pred => ({
      attempt_1: pred.attempt_1,
      attempt_2: pred.attempt_2,
    }));
  }

  // Create deterministic JSON string (no whitespace, sorted keys)
  const jsonString = JSON.stringify(normalized);

  // Compute SHA-256 hash
  const hash = createHash('sha256');
  hash.update(jsonString, 'utf8');
  return hash.digest('hex');
}

/**
 * Verify that two submissions produce the same hash.
 * Useful for debugging/testing.
 *
 * @param submission1 First submission
 * @param submission2 Second submission
 * @returns true if submissions are content-identical
 */
export function submissionsMatch(
  submission1: ARCSubmission,
  submission2: ARCSubmission
): boolean {
  return computeSubmissionHash(submission1) === computeSubmissionHash(submission2);
}
