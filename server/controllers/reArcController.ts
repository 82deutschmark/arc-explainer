/**
 * RE-ARC Dataset Generation and Evaluation Controller
 *
 * Author: Claude Code using Sonnet 4.5 (updated by Claude Opus 4.5)
 * Date: 2025-12-27 (updated 2025-12-30)
 * PURPOSE: HTTP/SSE endpoints for RE-ARC dataset generation, evaluation, verification, and leaderboard.
 *          Generation streams JSON as chunked download, evaluation streams progress via SSE.
 *          Supports two flows: "Evaluate Your Own" (saves to leaderboard) and "Verify Someone Else's" (check only).
 * SRP/DRY check: Pass - Single responsibility: RE-ARC HTTP API
 */

import type { Request, Response } from 'express';
import { createGzip, constants } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { generateDataset, evaluateSubmission } from '../services/reArc/reArcService.ts';
import { decodeTaskIds } from '../utils/reArcCodec.ts';
import { computeSubmissionHash } from '../utils/submissionHash.ts';
import { sanitizeSolverName } from '../utils/nameGenerator.ts';
import { reArcRepository } from '../repositories/ReArcRepository.ts';
import type { ARCSubmission, ReArcSSEEvent } from '../../shared/types.ts';
import { logger } from '../utils/logger.ts';
import { formatResponse } from '../utils/responseFormatter.ts';
import { sendSSEEvent } from '../utils/sseHelpers.ts';

// ============================================================================
// Types
// ============================================================================

interface EvaluateRequestBody {
  submission: ARCSubmission;
  solverName?: string;
  fileName?: string;
}

interface VerifyRequestBody {
  submission: ARCSubmission;
}

// ============================================================================
// Dataset Generation
// ============================================================================

/**
 * Generate RE-ARC dataset and stream as chunked JSON download.
 *
 * POST /api/rearc/generate
 * Response: Chunked JSON download with gzip compression
 *
 * The response is a valid JSON object streamed incrementally as tasks generate.
 * Client receives a file download that completes when all tasks are generated (~10 seconds).
 */
export async function generate(_req: Request, res: Response): Promise<void> {
  try {
    // Generate public seed ID from Unix timestamp (seconds).
    // This ID is encoded in task IDs for dataset identification.
    // Service derives server-secret internal seed for Python RNG and task ID PRNG.
    const seedId = Math.floor(Date.now() / 1000);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // Set download headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="re-arc_test_challenges-${timestamp}.json"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'no-cache, no-store');

    logger.info(`[RE-ARC] Starting dataset generation with seedId=${seedId}`, 're-arc');

    // Create async generator that yields JSON chunks
    async function* jsonChunks() {
      yield '{\n';
      let isFirst = true;

      for await (const { taskId, task } of generateDataset(seedId)) {
        if (!isFirst) {
          yield ',\n';
        }
        isFirst = false;

        // Emit task as JSON entry
        const taskJson = JSON.stringify({ [taskId]: task });
        // Remove outer braces to get just the key-value pair
        const content = taskJson.slice(1, -1);
        yield content;
      }

      yield '\n}\n';
    }

    // Stream JSON through gzip to response
    const jsonStream = Readable.from(jsonChunks());
    // Z_SYNC_FLUSH ensures data is flushed immediately after each chunk
    const gzip = createGzip({ flush: constants.Z_SYNC_FLUSH });

    await pipeline(jsonStream, gzip, res);

    logger.info(`[RE-ARC] Dataset generation complete for seedId=${seedId}`, 're-arc');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[RE-ARC] Generation error: ${errorMsg}`, 're-arc');

    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json(formatResponse.error('GENERATION_FAILED', errorMsg));
    } else {
      // Headers already sent - terminate stream
      res.end();
    }
  }
}

// ============================================================================
// Submission Validation Helper
// ============================================================================

/**
 * Validate submission structure.
 * Returns error message if invalid, null if valid.
 */
function validateSubmission(submission: any): string | null {
  if (!submission || typeof submission !== 'object' || Object.keys(submission).length === 0) {
    return 'Submission must be a non-empty object';
  }

  for (const [taskId, predictions] of Object.entries(submission)) {
    if (!Array.isArray(predictions)) {
      return `Task ${taskId}: predictions must be an array`;
    }

    for (let i = 0; i < (predictions as any[]).length; i++) {
      const prediction = (predictions as any[])[i];
      if (!prediction || typeof prediction !== 'object') {
        return `Task ${taskId}: prediction ${i} must be an object`;
      }

      const { attempt_1, attempt_2 } = prediction;
      if (!Array.isArray(attempt_1) || !Array.isArray(attempt_2)) {
        return `Task ${taskId}: prediction ${i} must have attempt_1 and attempt_2 arrays`;
      }

      // Validate grids are 2D arrays
      for (const [gridName, grid] of [['attempt_1', attempt_1], ['attempt_2', attempt_2]] as const) {
        if (!Array.isArray(grid)) {
          return `Task ${taskId}: prediction ${i} ${gridName} must be an array`;
        }
        for (let row = 0; row < grid.length; row++) {
          if (!Array.isArray(grid[row])) {
            return `Task ${taskId}: prediction ${i} ${gridName} row ${row} must be an array`;
          }
        }
      }
    }
  }

  return null;
}

// ============================================================================
// Evaluate Own Submission (saves to leaderboard)
// ============================================================================

/**
 * Evaluate submission against deterministically regenerated ground truth.
 * Saves result to leaderboard with solver name.
 * Streams progress events via SSE.
 *
 * POST /api/rearc/evaluate
 * Body: { submission: ARCSubmission, solverName?: string, fileName?: string }
 * Response: SSE stream with progress and completion events
 *
 * Events:
 * - event: progress, data: { current: number, total: number }
 * - event: complete, data: { type: 'score', score, submissionId, matchingSubmissions } | ...
 */
export async function evaluate(req: Request, res: Response): Promise<void> {
  const sendReArcEvent = (event: ReArcSSEEvent) => sendSSEEvent(res, event, { logger, forceFlush: true });
  const startTime = Date.now();

  try {
    const body = req.body as EvaluateRequestBody;
    const submission = body.submission || (body as unknown as ARCSubmission);
    const solverName = sanitizeSolverName(body.solverName);
    const fileName = body.fileName;

    // Validate submission structure
    const validationError = validateSubmission(submission);
    if (validationError) {
      res.status(400).json(formatResponse.error('INVALID_SUBMISSION', validationError));
      return;
    }

    logger.info(`[RE-ARC] Starting evaluation for ${Object.keys(submission).length} tasks, solver="${solverName}"`, 're-arc');

    // Set up SSE connection
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    try {
      // Run evaluation with progress callback
      const result = await evaluateSubmission(submission, (progress) => {
        sendReArcEvent({ type: 'progress', data: progress });
      });

      // Handle non-score results
      if (result.type === 'mismatches') {
        const mismatches = result.mismatches.map(({ taskId, expectedPredictions, submittedPredictions }) => ({
          taskId,
          expectedPredictions,
          submittedPredictions,
        }));
        sendReArcEvent({ type: 'complete', data: { type: 'mismatches', mismatches } });
        logger.info(`[RE-ARC] Evaluation failed: ${result.mismatches.length} prediction count mismatches`, 're-arc');
        return;
      }

      if (result.type === 'malformed') {
        sendReArcEvent({ type: 'complete', data: { type: 'malformed' } });
        logger.warn(`[RE-ARC] Evaluation failed: malformed submission - ${result.error}`, 're-arc');
        return;
      }

      // Success! Now save to database
      const score = result.score;
      const taskScores = result.taskScores;
      const submissionHash = computeSubmissionHash(submission);
      const evaluationDurationMs = Date.now() - startTime;

      // Decode task IDs to get seedId and internalSeed
      const pepper = process.env.RE_ARC_SEED_PEPPER;
      let submissionId: number | null = null;
      let matchingSubmissions: { id: number; solverName: string; score: number; evaluatedAt: Date }[] = [];

      if (pepper) {
        try {
          const decoded = decodeTaskIds(Object.keys(submission), pepper);
          const { seedId, internalSeed } = decoded;
          const numTasks = Object.keys(submission).length;

          // Calculate total pairs and solved pairs
          let totalPairs = 0;
          for (const predictions of Object.values(submission)) {
            totalPairs += predictions.length;
          }
          const solvedPairs = Math.round(score * totalPairs);

          // Calculate tasks fully solved (where task score = 1.0 meaning all pairs correct)
          const tasksSolved = taskScores.filter(taskScore => taskScore === 1.0).length;

          // Check for matching submissions first
          matchingSubmissions = await reArcRepository.findMatchingSubmissions(submissionHash);

          // Get or create dataset record
          const datasetId = await reArcRepository.getOrCreateDataset(seedId, internalSeed, numTasks);

          // Save submission to leaderboard
          submissionId = await reArcRepository.createSubmission({
            solverName,
            datasetId,
            submissionHash,
            submissionFileName: fileName,
            totalPairs,
            solvedPairs,
            tasksSolved,
            score,
            evaluationDurationMs,
          });

          logger.info(`[RE-ARC] Saved submission id=${submissionId}, score=${score.toFixed(4)}, solver="${solverName}"`, 're-arc');
        } catch (dbErr) {
          // Database error - log but don't fail the evaluation
          logger.error(`[RE-ARC] Failed to save submission: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`, 're-arc');
        }
      }

      // Send completion event with submission ID and matching submissions
      sendReArcEvent({
        type: 'complete',
        data: {
          type: 'score',
          score,
          submissionId,
          matchingSubmissions: matchingSubmissions.map(m => ({
            id: m.id,
            solverName: m.solverName,
            score: m.score,
          })),
        },
      });
      logger.info(`[RE-ARC] Evaluation complete: score=${score.toFixed(4)}, id=${submissionId}`, 're-arc');

    } catch (evaluateErr) {
      const errorMsg = evaluateErr instanceof Error ? evaluateErr.message : String(evaluateErr);
      logger.error(`[RE-ARC] Evaluation error: ${errorMsg}`, 're-arc');

      if (!res.headersSent) {
        throw evaluateErr;
      }

      sendReArcEvent({ type: 'error', data: { message: 'Internal server error during evaluation' } });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[RE-ARC] Evaluate endpoint error: ${errorMsg}`, 're-arc');

    if (!res.headersSent) {
      res.status(500).json(formatResponse.error('EVALUATION_FAILED', errorMsg));
    } else {
      res.end();
    }
  }
}

// ============================================================================
// Verify Someone Else's Submission (does NOT save)
// ============================================================================

/**
 * Verify a submission against deterministically regenerated ground truth.
 * Does NOT save to leaderboard - only checks score and finds matching entries.
 * Streams progress events via SSE.
 *
 * POST /api/rearc/verify
 * Body: { submission: ARCSubmission }
 * Response: SSE stream with progress and completion events
 */
export async function verify(req: Request, res: Response): Promise<void> {
  const sendReArcEvent = (event: ReArcSSEEvent) => sendSSEEvent(res, event, { logger, forceFlush: true });

  try {
    const body = req.body as VerifyRequestBody;
    const submission = body.submission || (body as unknown as ARCSubmission);

    // Validate submission structure
    const validationError = validateSubmission(submission);
    if (validationError) {
      res.status(400).json(formatResponse.error('INVALID_SUBMISSION', validationError));
      return;
    }

    logger.info(`[RE-ARC] Starting verification for ${Object.keys(submission).length} tasks`, 're-arc');

    // Set up SSE connection
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    try {
      // Run evaluation with progress callback
      const result = await evaluateSubmission(submission, (progress) => {
        sendReArcEvent({ type: 'progress', data: progress });
      });

      // Handle non-score results
      if (result.type === 'mismatches') {
        const mismatches = result.mismatches.map(({ taskId, expectedPredictions, submittedPredictions }) => ({
          taskId,
          expectedPredictions,
          submittedPredictions,
        }));
        sendReArcEvent({ type: 'complete', data: { type: 'mismatches', mismatches } });
        logger.info(`[RE-ARC] Verification failed: ${result.mismatches.length} prediction count mismatches`, 're-arc');
        return;
      }

      if (result.type === 'malformed') {
        sendReArcEvent({ type: 'complete', data: { type: 'malformed' } });
        logger.warn(`[RE-ARC] Verification failed: malformed submission - ${result.error}`, 're-arc');
        return;
      }

      // Success! Find matching submissions
      const score = result.score;
      const submissionHash = computeSubmissionHash(submission);
      let matchingSubmissions: { id: number; solverName: string; score: number; evaluatedAt: Date }[] = [];

      try {
        matchingSubmissions = await reArcRepository.findMatchingSubmissions(submissionHash);

        // Increment verification count for matching submissions
        if (matchingSubmissions.length > 0) {
          const matchingIds = matchingSubmissions.map(m => m.id);
          await reArcRepository.incrementVerificationCount(matchingIds);
          logger.info(`[RE-ARC] Verification matched ${matchingIds.length} submissions`, 're-arc');
        }
      } catch (dbErr) {
        logger.error(`[RE-ARC] Failed to find matching submissions: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`, 're-arc');
      }

      // Send completion event (no submissionId since we don't save)
      sendReArcEvent({
        type: 'complete',
        data: {
          type: 'score',
          score,
          submissionId: null,
          matchingSubmissions: matchingSubmissions.map(m => ({
            id: m.id,
            solverName: m.solverName,
            score: m.score,
            evaluatedAt: m.evaluatedAt.toISOString(),
          })),
        },
      });
      logger.info(`[RE-ARC] Verification complete: score=${score.toFixed(4)}, matches=${matchingSubmissions.length}`, 're-arc');

    } catch (evaluateErr) {
      const errorMsg = evaluateErr instanceof Error ? evaluateErr.message : String(evaluateErr);
      logger.error(`[RE-ARC] Verification error: ${errorMsg}`, 're-arc');

      if (!res.headersSent) {
        throw evaluateErr;
      }

      sendReArcEvent({ type: 'error', data: { message: 'Internal server error during verification' } });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[RE-ARC] Verify endpoint error: ${errorMsg}`, 're-arc');

    if (!res.headersSent) {
      res.status(500).json(formatResponse.error('VERIFICATION_FAILED', errorMsg));
    } else {
      res.end();
    }
  }
}

// ============================================================================
// Leaderboard
// ============================================================================

/**
 * Get RE-ARC leaderboard with pagination and sorting.
 *
 * GET /api/rearc/leaderboard
 * Query params:
 *   - limit: number (default 100, max 500)
 *   - offset: number (default 0)
 *   - sort: 'score' | 'latest' | 'verified' (default 'score')
 *   - seedId: number (optional, filter by dataset)
 *
 * Response: { submissions: [...], totalCount: number }
 */
export async function getLeaderboard(req: Request, res: Response): Promise<void> {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 100), 500);
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const sort = (req.query.sort as 'score' | 'latest' | 'verified') || 'score';
    const seedId = req.query.seedId ? parseInt(req.query.seedId as string) : undefined;

    const { entries, totalCount } = await reArcRepository.getLeaderboard({
      limit,
      offset,
      sort,
      seedId,
    });

    res.json({
      submissions: entries.map((entry, index) => ({
        rank: offset + index + 1,
        id: entry.id,
        solverName: entry.solverName,
        score: entry.score,
        solvedPairs: entry.solvedPairs,
        totalPairs: entry.totalPairs,
        evaluatedAt: entry.evaluatedAt.toISOString(),
        verificationCount: entry.verificationCount,
        datasetSeedId: entry.datasetSeedId,
      })),
      totalCount,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[RE-ARC] Leaderboard error: ${errorMsg}`, 're-arc');
    res.status(500).json(formatResponse.error('LEADERBOARD_FAILED', errorMsg));
  }
}

/**
 * Get submission details by ID.
 *
 * GET /api/rearc/submissions/:id
 * Response: { submission: {...}, matchingSubmissions: [...], datasetSeedId: string }
 */
export async function getSubmissionDetails(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json(formatResponse.error('INVALID_ID', 'Submission ID must be a number'));
      return;
    }

    const details = await reArcRepository.getSubmissionDetails(id);

    if (!details.submission) {
      res.status(404).json(formatResponse.error('NOT_FOUND', 'Submission not found'));
      return;
    }

    const { submission, matchingSubmissions, datasetSeedId } = details;

    res.json({
      submission: {
        id: submission.id,
        solverName: submission.solver_name,
        score: parseFloat(submission.score),
        solvedPairs: submission.solved_pairs,
        totalPairs: submission.total_pairs,
        evaluatedAt: submission.evaluated_at.toISOString(),
        verificationCount: submission.verification_count,
        submissionHash: submission.submission_hash,
        pairResults: submission.pair_results,
      },
      matchingSubmissions: matchingSubmissions.map(m => ({
        id: m.id,
        solverName: m.solverName,
        score: m.score,
        evaluatedAt: m.evaluatedAt.toISOString(),
      })),
      datasetSeedId,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error(`[RE-ARC] Submission details error: ${errorMsg}`, 're-arc');
    res.status(500).json(formatResponse.error('DETAILS_FAILED', errorMsg));
  }
}
