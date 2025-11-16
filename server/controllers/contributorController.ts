/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: Controller for ARC contributor trading cards API endpoints.
 * Handles HTTP requests and delegates to ContributorRepository for data access.
 * Follows standard controller pattern used by other controllers in the project.
 * SRP/DRY check: Pass - Single responsibility for contributor HTTP request handling
 */

import { Router, Request, Response } from 'express';
import { repositoryService } from '../repositories/RepositoryService.ts';
import type { ArcContributorsResponse } from '@shared/types/contributor.ts';
import { logger } from '../utils/logger.ts';
import { asyncHandler } from '../middleware/asyncHandler.ts';

const router = Router();

/**
 * GET /api/contributors
 * Returns all contributors with optional filtering
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { category, yearStart, limit } = req.query;

  const filters: any = {};
  if (category && typeof category === 'string') {
    filters.category = category;
  }
  if (yearStart && typeof yearStart === 'string') {
    filters.yearStart = parseInt(yearStart, 10);
  }
  if (limit && typeof limit === 'string') {
    filters.limit = parseInt(limit, 10);
  }

  const contributors = await repositoryService.contributors.getAllContributors(filters);

  const response: ArcContributorsResponse = {
    contributors,
    total: contributors.length
  };

  res.json(response);
}));

/**
 * GET /api/contributors/stats
 * Returns statistics about contributors
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const allContributors = await repositoryService.contributors.getAllContributors();
  const categoryCounts = await repositoryService.contributors.getCountsByCategory();

  res.json({
    total: allContributors.length,
    categoryCounts,
    latestYear: Math.max(...allContributors.map(c => c.yearStart || 0).filter(y => y > 0))
  });
}));

/**
 * GET /api/contributors/:id
 * Returns a specific contributor by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid contributor ID' });
  }

  const contributor = await repositoryService.contributors.getContributorById(id);

  if (!contributor) {
    return res.status(404).json({ error: 'Contributor not found' });
  }

  res.json(contributor);
}));

/**
 * POST /api/contributors
 * Create a new contributor (admin only - would need auth in production)
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const contributor = await repositoryService.contributors.createContributor(req.body);
  res.status(201).json(contributor);
}));

export const contributorController = router;
