/*
Author: Cascade
Date: 2026-01-04
PURPOSE: Express router for scorecard management endpoints.
Provides /api/scorecard/open, /api/scorecard/close, and /api/scorecard/:id endpoints.
Mirrors the SDK's scorecard CLI commands but uses database storage.
SRP/DRY check: Pass — isolates scorecard HTTP contract and validation.
*/

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { 
  openScorecard, 
  closeScorecard, 
  getScorecard, 
  getActiveScorecard,
  type ScorecardSummary 
} from '../services/arc3/scorecardService';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger';

const router = Router();

// Schemas for validation
const openScorecardSchema = z.object({
  source_url: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.any().optional(), // JSON object
});

const closeScorecardSchema = z.object({
  card_id: z.string().min(1),
});

/**
 * POST /api/scorecard/open
 * Open a new scorecard for tracking ARC3 games
 */
router.post(
  '/open',
  asyncHandler(async (req: Request, res: Response) => {
    const { source_url, tags, metadata } = openScorecardSchema.parse(req.body);
    
    const cardId = await openScorecard(source_url, tags, metadata);
    
    logger.info(`Scorecard opened: ${cardId}`, 'scorecard');
    
    res.json(formatResponse.success({
      card_id: cardId,
      source_url,
      tags,
      message: 'Scorecard opened successfully'
    }));
  }),
);

/**
 * POST /api/scorecard/close
 * Close a scorecard and get final statistics
 */
router.post(
  '/close',
  asyncHandler(async (req: Request, res: Response) => {
    const { card_id } = closeScorecardSchema.parse(req.body);
    
    const summary = await closeScorecard(card_id);
    
    logger.info(`Scorecard closed: ${card_id} - ${summary.won}/${summary.played} games won`, 'scorecard');
    
    res.json(formatResponse.success(summary));
  }),
);

/**
 * GET /api/scorecard/:id
 * Get scorecard details and current statistics
 * Optional ?game=<game_id> query parameter to filter by specific game
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { game } = req.query;
    
    const summary = await getScorecard(id, typeof game === 'string' ? game : undefined);
    
    res.json(formatResponse.success(summary));
  }),
);

/**
 * GET /api/scorecard
 * Get the currently active scorecard (if any)
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const activeScorecard = await getActiveScorecard();
    
    if (!activeScorecard) {
      return res.json(formatResponse.success({
        message: 'No active scorecard found',
        scorecard: null
      }));
    }
    
    res.json(formatResponse.success({
      message: 'Active scorecard found',
      scorecard: activeScorecard
    }));
  }),
);

export default router;
