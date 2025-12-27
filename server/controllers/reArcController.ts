/**
 * RE-ARC Dataset Generation and Verification Controller
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-12-27
 * PURPOSE: HTTP/SSE endpoints for RE-ARC dataset generation and verification.
 *          Generation streams JSON as chunked download, verification streams progress via SSE.
 * SRP/DRY check: Pass - Single responsibility: RE-ARC HTTP API
 */

import type { Request, Response } from 'express';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { generateDataset, verifySubmission } from '../services/reArc/reArcService';
import type { ARCSubmission } from '../../shared/types';
import { logger } from '../utils/logger';
import { formatResponse } from '../utils/responseFormatter';

/**
 * Generate RE-ARC dataset and stream as chunked JSON download.
 *
 * POST /api/rearc-eval/generate
 * Response: Chunked JSON download with gzip compression
 *
 * The response is a valid JSON object streamed incrementally as tasks generate.
 * Client receives a file download that completes when all tasks are generated (~10 seconds).
 */
export async function generate(req: Request, res: Response): Promise<void> {
  try {
    // Generate seed from current timestamp (seconds). This is intentional.
    const seed = Math.floor(Date.now() / 1000);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    // Set download headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="rearc_test_challenges-${timestamp}.json"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'no-cache');

    logger.info(`[RE-ARC] Starting dataset generation with seed=${seed}`, 're-arc');

    // Create async generator that yields JSON chunks
    async function* jsonChunks() {
      yield '{\n';
      let isFirst = true;

      for await (const { taskId, task } of generateDataset(seed)) {
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
    const gzip = createGzip();

    await pipeline(jsonStream, gzip, res);

    logger.info(`[RE-ARC] Dataset generation complete for seed=${seed}`, 're-arc');
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

/**
 * Verify submission against deterministically regenerated ground truth.
 * Streams progress events via SSE.
 *
 * POST /api/rearc-eval/verify
 * Body: ARCSubmission JSON
 * Response: SSE stream with progress and completion events
 *
 * Events:
 * - event: progress, data: { current: number, total: number }
 * - event: complete, data: { type: 'score', score: number } | { type: 'mismatches', mismatches: [...] } | { type: 'malformed' }
 */
export async function verify(req: Request, res: Response): Promise<void> {
  try {
    const submission = req.body as ARCSubmission;

    // Basic validation
    if (!submission || typeof submission !== 'object' || Object.keys(submission).length === 0) {
      res.status(400).json(formatResponse.error('INVALID_SUBMISSION', 'Submission must be a non-empty object'));
      return;
    }

    // Validate submission structure
    for (const [taskId, attempts] of Object.entries(submission)) {
      if (!Array.isArray(attempts)) {
        res.status(400).json(
          formatResponse.error('INVALID_SUBMISSION', `Task ${taskId}: attempts must be an array`)
        );
        return;
      }

      for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        if (!attempt || typeof attempt !== 'object') {
          res.status(400).json(
            formatResponse.error('INVALID_SUBMISSION', `Task ${taskId}: attempt ${i} must be an object`)
          );
          return;
        }

        const { attempt_1, attempt_2 } = attempt;
        if (!Array.isArray(attempt_1) || !Array.isArray(attempt_2)) {
          res.status(400).json(
            formatResponse.error(
              'INVALID_SUBMISSION',
              `Task ${taskId}: attempt ${i} must have attempt_1 and attempt_2 arrays`
            )
          );
          return;
        }

        // Validate grids are 2D arrays
        const validateGrid = (grid: any, gridName: string): boolean => {
          if (!Array.isArray(grid)) return false;
          for (let row = 0; row < grid.length; row++) {
            if (!Array.isArray(grid[row])) {
              res.status(400).json(
                formatResponse.error(
                  'INVALID_SUBMISSION',
                  `Task ${taskId}: attempt ${i} ${gridName} row ${row} must be an array`
                )
              );
              return false;
            }
          }
          return true;
        };

        if (!validateGrid(attempt_1, 'attempt_1')) return;
        if (!validateGrid(attempt_2, 'attempt_2')) return;
      }
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

    // Helper to send SSE events
    const sendEvent = (event: string, data: any) => {
      if (res.writableEnded) {
        logger.debug(`[RE-ARC] Event ${event} dropped: stream already ended`, 're-arc');
        return;
      }
      try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (err) {
        logger.error(`[RE-ARC] Failed to write SSE event: ${err}`, 're-arc');
      }
    };

    try {
      // Run verification with progress callback
      const result = await verifySubmission(submission, (progress) => {
        sendEvent('progress', progress);
      });

      // Send completion event based on result type
      // Note: Complete event format excludes taskIndex and error fields from VerificationResult
      if (result.type === 'score') {
        sendEvent('complete', { type: 'score', score: result.score });
        logger.info(`[RE-ARC] Verification complete: score=${result.score.toFixed(4)}`, 're-arc');
      } else if (result.type === 'mismatches') {
        // Transform mismatches to exclude taskIndex from event data
        const mismatches = result.mismatches.map(({ taskId, expectedPairs, submittedPairs }) => ({
          taskId,
          expectedPairs,
          submittedPairs,
        }));
        sendEvent('complete', { type: 'mismatches', mismatches });
        logger.info(`[RE-ARC] Verification failed: ${result.mismatches.length} test pair mismatches`, 're-arc');
      } else {
        sendEvent('complete', { type: 'malformed' });
        logger.warn(`[RE-ARC] Verification failed: malformed submission - ${result.error}`, 're-arc');
      }
    } catch (verifyErr) {
      // Internal error during verification
      const errorMsg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
      logger.error(`[RE-ARC] Verification error: ${errorMsg}`, 're-arc');

      // If headers haven't been sent yet, bubble up to send proper 500 response
      if (!res.headersSent) {
        throw verifyErr;
      }

      // SSE stream already started - send error event and end stream
      sendEvent('error', { message: 'Internal server error during verification' });
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
