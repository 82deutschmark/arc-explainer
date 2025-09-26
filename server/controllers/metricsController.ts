/**
 * Metrics Controller
 *
 * Handles requests for aggregated analytics and performance metrics.
 *
 * @author Gemini 2.5 Pro
 * @date 2025-09-10
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';

class MetricsController {

  /**
   * @desc    Get model reliability statistics
   * @route   GET /api/v1/metrics/reliability
   * @access  Public
   */
  getModelReliability = asyncHandler(async (req: Request, res: Response) => {
    const stats = await repositoryService.metrics.getModelReliabilityStats();
    res.status(200).json({
      success: true,
      count: stats.length,
      data: stats,
    });
  });

  /**
   * @desc    Get comprehensive dashboard statistics
   * @route   GET /api/v1/metrics/comprehensive-dashboard
   * @access  Public
   */
  getComprehensiveDashboard = asyncHandler(async (req: Request, res: Response) => {
    const dashboardData = await repositoryService.metrics.getComprehensiveDashboard();
    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  });

  /**
   * @desc    Get cost efficiency metrics - cost per correct answer analysis
   * @route   GET /api/metrics/cost-efficiency
   * @access  Public
   * @param   ?minAttempts=100  Minimum attempts filter (optional)
   */
  getCostEfficiencyMetrics = asyncHandler(async (req: Request, res: Response) => {
    try {
      const minAttempts = parseInt(req.query.minAttempts as string) || 100;

      if (minAttempts < 1 || minAttempts > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Invalid minimum attempts. Must be between 1 and 1000',
        });
      }

      const efficiencyMetrics = await repositoryService.cost.getCostEfficiencyMetrics(minAttempts);

      res.status(200).json({
        success: true,
        count: efficiencyMetrics.length,
        metadata: {
          minAttempts,
          filtered: minAttempts > 1
        },
        data: efficiencyMetrics,
      });
    } catch (error) {
      logger.error(`Error in getCostEfficiencyMetrics: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving cost efficiency metrics',
      });
    }
  });

  /**
   * @desc    Get cost waste analysis - models with poor cost efficiency
   * @route   GET /api/metrics/cost-waste-analysis
   * @access  Public
   */
  getCostWasteAnalysis = asyncHandler(async (req: Request, res: Response) => {
    try {
      const minAttempts = parseInt(req.query.minAttempts as string) || 100;
      const maxCostPerCorrect = parseFloat(req.query.maxCostPerCorrect as string) || 0.10;

      if (minAttempts < 1 || minAttempts > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Invalid minimum attempts. Must be between 1 and 1000',
        });
      }

      if (maxCostPerCorrect <= 0 || maxCostPerCorrect > 100) {
        return res.status(400).json({
          success: false,
          message: 'Invalid max cost per correct. Must be between 0 and 100',
        });
      }

      const wastefulModels = await repositoryService.cost.getCostWasteAnalysis(minAttempts, maxCostPerCorrect);

      res.status(200).json({
        success: true,
        count: wastefulModels.length,
        metadata: {
          minAttempts,
          maxCostPerCorrect,
          threshold: `$${maxCostPerCorrect} per correct answer`
        },
        data: wastefulModels,
      });
    } catch (error) {
      logger.error(`Error in getCostWasteAnalysis: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving cost waste analysis',
      });
    }
  });
}

export default new MetricsController();


