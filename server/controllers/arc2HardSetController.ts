/**
 * Author: Claude Fable 5.1 High
 * Date: 19-October-2026
 * PURPOSE: HTTP handler for GET /api/arc2/hard-set. Returns the ARC-AGI-2 public-eval puzzles that at
 *          most two logged attempts have solved, with their solvers, for the /arc2/hard-set page.
 *          Thin by design: membership and shaping live in arc2HardSetService.
 * SRP/DRY check: Pass — mirrors councilController.getUnsolvedPuzzles (service call, formatResponse,
 *                logged failure); no query logic here.
 */

import type { Request, Response } from 'express';
import { getArc2HardSet } from '../services/arc2HardSetService.ts';
import { formatResponse } from '../utils/responseFormatter.ts';
import { logger } from '../utils/logger.ts';
import { ARC2_HARD_SET_MAX_SOLVES } from '../../shared/arc2HardSet.ts';

export async function getHardSet(_req: Request, res: Response): Promise<void> {
  try {
    const puzzles = await getArc2HardSet();
    res.json(formatResponse.success({
      puzzles,
      total: puzzles.length,
      maxSolves: ARC2_HARD_SET_MAX_SOLVES,
      generatedAt: new Date().toISOString(),
    }));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to build the ARC2 hard set';
    logger.error(`[Arc2HardSetController] ${message}`, 'arc2-hard-set');
    res.status(500).json(formatResponse.error('FETCH_FAILED', message));
  }
}

export const arc2HardSetController = { getHardSet };
