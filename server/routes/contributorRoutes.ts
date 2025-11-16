/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-16
 * PURPOSE: API routes for ARC contributor trading cards.
 * Provides endpoints to fetch, create, and manage human contributor data.
 * SRP/DRY check: Pass - Single responsibility for contributor API routes
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { ContributorRepository } from '../repositories/ContributorRepository.ts';
import type { ArcContributorsResponse } from '@shared/types/contributor.ts';
import { logger } from '../utils/logger.ts';

export function createContributorRoutes(pool: Pool): Router {
  const router = Router();
  const contributorRepo = new ContributorRepository(pool);

  /**
   * GET /api/contributors
   * Returns all contributors with optional filtering
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
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

      const contributors = await contributorRepo.getAllContributors(filters);

      const response: ArcContributorsResponse = {
        contributors,
        total: contributors.length
      };

      res.json(response);
    } catch (error) {
      logger.error(`Failed to fetch contributors: ${error instanceof Error ? error.message : String(error)}`, 'contributor-routes');
      res.status(500).json({
        error: 'Failed to fetch contributors',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/contributors/stats
   * Returns statistics about contributors
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const allContributors = await contributorRepo.getAllContributors();
      const categoryCounts = await contributorRepo.getCountsByCategory();

      res.json({
        total: allContributors.length,
        categoryCounts,
        latestYear: Math.max(...allContributors.map(c => c.yearStart || 0).filter(y => y > 0))
      });
    } catch (error) {
      logger.error(`Failed to fetch contributor stats: ${error instanceof Error ? error.message : String(error)}`, 'contributor-routes');
      res.status(500).json({
        error: 'Failed to fetch contributor stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/contributors/:id
   * Returns a specific contributor by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid contributor ID' });
      }

      const contributor = await contributorRepo.getContributorById(id);

      if (!contributor) {
        return res.status(404).json({ error: 'Contributor not found' });
      }

      res.json(contributor);
    } catch (error) {
      logger.error(`Failed to fetch contributor: ${error instanceof Error ? error.message : String(error)}`, 'contributor-routes');
      res.status(500).json({
        error: 'Failed to fetch contributor',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/contributors
   * Create a new contributor (admin only - would need auth in production)
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const contributor = await contributorRepo.createContributor(req.body);
      res.status(201).json(contributor);
    } catch (error) {
      logger.error(`Failed to create contributor: ${error instanceof Error ? error.message : String(error)}`, 'contributor-routes');
      res.status(500).json({
        error: 'Failed to create contributor',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
