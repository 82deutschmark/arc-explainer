/**
 * ReArcRepository.ts
 *
 * Author: Claude Opus 4.5
 * Date: 2025-12-30
 * PURPOSE: Data access layer for RE-ARC leaderboard persistence.
 *          Handles datasets, submissions, and verification matching.
 *          No login required - just solver name + submission hash for identity.
 * SRP/DRY check: Pass - Single responsibility for RE-ARC data persistence
 */

import { BaseRepository } from './base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ReArcDatasetRow {
  id: number;
  seed_id: string; // bigint comes as string from pg
  internal_seed: string;
  num_tasks: number;
  generated_at: Date;
}

export interface ReArcSubmissionRow {
  id: number;
  solver_name: string;
  rearc_dataset_id: number;
  submission_hash: string;
  submission_file_name: string | null;
  total_pairs: number;
  solved_pairs: number;
  score: string; // decimal comes as string from pg
  pair_results: any | null;
  evaluated_at: Date;
  evaluation_duration_ms: number | null;
  verification_count: number;
  last_verified_at: Date | null;
}

export interface ReArcSubmissionInput {
  solverName: string;
  datasetId: number;
  submissionHash: string;
  submissionFileName?: string;
  totalPairs: number;
  solvedPairs: number;
  score: number;
  pairResults?: any;
  evaluationDurationMs?: number;
}

export interface LeaderboardEntry {
  id: number;
  solverName: string;
  score: number;
  solvedPairs: number;
  totalPairs: number;
  evaluatedAt: Date;
  verificationCount: number;
  datasetSeedId: string;
}

export interface MatchingSubmission {
  id: number;
  solverName: string;
  score: number;
  evaluatedAt: Date;
}

// ============================================================================
// Repository Class
// ============================================================================

export class ReArcRepository extends BaseRepository {

  // --------------------------------------------------------------------------
  // Dataset Operations
  // --------------------------------------------------------------------------

  /**
   * Get or create a dataset record for a given seed.
   * Returns the dataset ID for foreign key references.
   */
  async getOrCreateDataset(
    seedId: number,
    internalSeed: number,
    numTasks: number
  ): Promise<number> {
    if (!this.isConnected()) {
      throw new Error('Database not connected');
    }

    // Try to get existing dataset first
    const existingResult = await this.query<{ id: number }>(
      `SELECT id FROM rearc_datasets WHERE seed_id = $1`,
      [seedId]
    );

    if (existingResult.rows.length > 0) {
      return existingResult.rows[0].id;
    }

    // Create new dataset
    const insertResult = await this.query<{ id: number }>(
      `INSERT INTO rearc_datasets (seed_id, internal_seed, num_tasks)
       VALUES ($1, $2, $3)
       ON CONFLICT (seed_id) DO UPDATE SET seed_id = EXCLUDED.seed_id
       RETURNING id`,
      [seedId, internalSeed, numTasks]
    );

    logger.info(`Created RE-ARC dataset: seedId=${seedId}, id=${insertResult.rows[0].id}`, 'rearc-repo');
    return insertResult.rows[0].id;
  }

  /**
   * Get dataset by seed ID.
   */
  async getDatasetBySeedId(seedId: number): Promise<ReArcDatasetRow | null> {
    if (!this.isConnected()) {
      return null;
    }

    const result = await this.query<ReArcDatasetRow>(
      `SELECT id, seed_id, internal_seed, num_tasks, generated_at
       FROM rearc_datasets
       WHERE seed_id = $1`,
      [seedId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // --------------------------------------------------------------------------
  // Submission Operations
  // --------------------------------------------------------------------------

  /**
   * Create a new submission record.
   * Returns the new submission ID.
   */
  async createSubmission(input: ReArcSubmissionInput): Promise<number> {
    if (!this.isConnected()) {
      throw new Error('Database not connected');
    }

    const result = await this.query<{ id: number }>(
      `INSERT INTO rearc_submissions (
         solver_name, rearc_dataset_id, submission_hash, submission_file_name,
         total_pairs, solved_pairs, score, pair_results, evaluation_duration_ms
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        input.solverName,
        input.datasetId,
        input.submissionHash,
        input.submissionFileName || null,
        input.totalPairs,
        input.solvedPairs,
        input.score,
        input.pairResults ? JSON.stringify(input.pairResults) : null,
        input.evaluationDurationMs || null,
      ]
    );

    logger.info(
      `Created RE-ARC submission: id=${result.rows[0].id}, solver=${input.solverName}, score=${input.score}`,
      'rearc-repo'
    );
    return result.rows[0].id;
  }

  /**
   * Get submission by ID.
   */
  async getSubmissionById(id: number): Promise<ReArcSubmissionRow | null> {
    if (!this.isConnected()) {
      return null;
    }

    const result = await this.query<ReArcSubmissionRow>(
      `SELECT * FROM rearc_submissions WHERE id = $1`,
      [id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // --------------------------------------------------------------------------
  // Verification / Hash Matching
  // --------------------------------------------------------------------------

  /**
   * Find all submissions with matching hash (for verification).
   * Returns submissions that share the same submission content.
   */
  async findMatchingSubmissions(submissionHash: string): Promise<MatchingSubmission[]> {
    if (!this.isConnected()) {
      return [];
    }

    const result = await this.query<{
      id: number;
      solver_name: string;
      score: string;
      evaluated_at: Date;
    }>(
      `SELECT id, solver_name, score, evaluated_at
       FROM rearc_submissions
       WHERE submission_hash = $1
       ORDER BY evaluated_at ASC`,
      [submissionHash]
    );

    return result.rows.map(row => ({
      id: row.id,
      solverName: row.solver_name,
      score: parseFloat(row.score),
      evaluatedAt: row.evaluated_at,
    }));
  }

  /**
   * Increment verification count for matching submissions.
   * Called when someone verifies a submission that matches existing entries.
   */
  async incrementVerificationCount(submissionIds: number[]): Promise<void> {
    if (!this.isConnected() || submissionIds.length === 0) {
      return;
    }

    await this.query(
      `UPDATE rearc_submissions
       SET verification_count = verification_count + 1,
           last_verified_at = NOW()
       WHERE id = ANY($1)`,
      [submissionIds]
    );

    logger.info(`Incremented verification count for ${submissionIds.length} submissions`, 'rearc-repo');
  }

  // --------------------------------------------------------------------------
  // Leaderboard Operations
  // --------------------------------------------------------------------------

  /**
   * Get leaderboard entries with pagination and sorting.
   */
  async getLeaderboard(options: {
    limit?: number;
    offset?: number;
    sort?: 'score' | 'latest' | 'verified';
    seedId?: number;
  } = {}): Promise<{ entries: LeaderboardEntry[]; totalCount: number }> {
    if (!this.isConnected()) {
      return { entries: [], totalCount: 0 };
    }

    const { limit = 100, offset = 0, sort = 'score', seedId } = options;

    // Build ORDER BY clause
    let orderBy: string;
    switch (sort) {
      case 'latest':
        orderBy = 's.evaluated_at DESC';
        break;
      case 'verified':
        orderBy = 's.verification_count DESC, s.score DESC';
        break;
      case 'score':
      default:
        orderBy = 's.score DESC, s.evaluated_at ASC';
        break;
    }

    // Build WHERE clause
    const whereClause = seedId ? 'WHERE d.seed_id = $3' : '';
    const params = seedId ? [limit, offset, seedId] : [limit, offset];

    // Get entries
    const entriesResult = await this.query<{
      id: number;
      solver_name: string;
      score: string;
      solved_pairs: number;
      total_pairs: number;
      evaluated_at: Date;
      verification_count: number;
      seed_id: string;
    }>(
      `SELECT s.id, s.solver_name, s.score, s.solved_pairs, s.total_pairs,
              s.evaluated_at, s.verification_count, d.seed_id
       FROM rearc_submissions s
       JOIN rearc_datasets d ON s.rearc_dataset_id = d.id
       ${whereClause}
       ORDER BY ${orderBy}
       LIMIT $1 OFFSET $2`,
      params
    );

    // Get total count
    const countParams = seedId ? [seedId] : [];
    const countResult = await this.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM rearc_submissions s
       JOIN rearc_datasets d ON s.rearc_dataset_id = d.id
       ${seedId ? 'WHERE d.seed_id = $1' : ''}`,
      countParams
    );

    const entries: LeaderboardEntry[] = entriesResult.rows.map(row => ({
      id: row.id,
      solverName: row.solver_name,
      score: parseFloat(row.score),
      solvedPairs: row.solved_pairs,
      totalPairs: row.total_pairs,
      evaluatedAt: row.evaluated_at,
      verificationCount: row.verification_count,
      datasetSeedId: row.seed_id,
    }));

    return {
      entries,
      totalCount: parseInt(countResult.rows[0]?.count || '0', 10),
    };
  }

  /**
   * Get submission details with matching submissions (for detail page).
   */
  async getSubmissionDetails(id: number): Promise<{
    submission: ReArcSubmissionRow | null;
    matchingSubmissions: MatchingSubmission[];
    datasetSeedId: string | null;
  }> {
    if (!this.isConnected()) {
      return { submission: null, matchingSubmissions: [], datasetSeedId: null };
    }

    // Get the submission
    const submission = await this.getSubmissionById(id);
    if (!submission) {
      return { submission: null, matchingSubmissions: [], datasetSeedId: null };
    }

    // Get matching submissions (same hash, excluding self)
    const matchingResult = await this.query<{
      id: number;
      solver_name: string;
      score: string;
      evaluated_at: Date;
    }>(
      `SELECT id, solver_name, score, evaluated_at
       FROM rearc_submissions
       WHERE submission_hash = $1 AND id != $2
       ORDER BY evaluated_at ASC`,
      [submission.submission_hash, id]
    );

    // Get dataset seed ID
    const datasetResult = await this.query<{ seed_id: string }>(
      `SELECT seed_id FROM rearc_datasets WHERE id = $1`,
      [submission.rearc_dataset_id]
    );

    return {
      submission,
      matchingSubmissions: matchingResult.rows.map(row => ({
        id: row.id,
        solverName: row.solver_name,
        score: parseFloat(row.score),
        evaluatedAt: row.evaluated_at,
      })),
      datasetSeedId: datasetResult.rows[0]?.seed_id || null,
    };
  }
}

// Export singleton instance
export const reArcRepository = new ReArcRepository();
