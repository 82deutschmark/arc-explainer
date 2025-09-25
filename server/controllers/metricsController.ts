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
import { MetricsRepository } from '../repositories/MetricsRepository.ts';

class MetricsController {
  private metricsRepo: MetricsRepository;

  constructor() {
    this.metricsRepo = new MetricsRepository();
  }

  /**
   * @desc    Get model reliability statistics
   * @route   GET /api/v1/metrics/reliability
   * @access  Public
   */
  getModelReliability = asyncHandler(async (req: Request, res: Response) => {
    const stats = await this.metricsRepo.getModelReliabilityStats();
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
    const dashboardData = await this.metricsRepo.getComprehensiveDashboard();
    res.status(200).json({
      success: true,
      data: dashboardData,
    });
  });
}

export default new MetricsController();
