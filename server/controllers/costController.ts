/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-24 Time: 16:15
 * PURPOSE: Dedicated controller for cost-related API endpoints following RESTful principles.
 * Handles all cost domain requests with proper separation of concerns from other controllers.
 * Uses CostRepository for all cost calculations, ensuring consistent business logic.
 * Provides standardized JSON responses with proper HTTP status codes and error handling.
 * SRP and DRY check: Pass - Single responsibility for cost API endpoints only.
 * Uses existing CostRepository to avoid duplicating cost calculation logic.
 * shadcn/ui: Pass - This is a backend controller, no UI components involved.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { CostRepository } from '../repositories/CostRepository.ts';
import { logger } from '../utils/logger.ts';

class CostController {
  private costRepo: CostRepository;

  constructor() {
    this.costRepo = new CostRepository();
  }

  /**
   * @desc    Get cost summary for all models
   * @route   GET /api/costs/models
   * @access  Public
   */
  getAllModelCosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const costs = await this.costRepo.getAllModelCosts();

      res.status(200).json({
        success: true,
        count: costs.length,
        data: costs,
      });
    } catch (error) {
      logger.error(`Error in getAllModelCosts: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model cost data',
      });
    }
  });

  /**
   * @desc    Get cost summary for a specific model
   * @route   GET /api/costs/models/:modelName
   * @access  Public
   */
  getModelCostSummary = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName } = req.params;

      if (!modelName || modelName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Model name is required',
        });
      }

      const costSummary = await this.costRepo.getModelCostSummary(modelName);

      if (!costSummary) {
        return res.status(404).json({
          success: false,
          message: `No cost data found for model: ${modelName}`,
        });
      }

      res.status(200).json({
        success: true,
        data: costSummary,
      });
    } catch (error) {
      logger.error(`Error in getModelCostSummary: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model cost summary',
      });
    }
  });

  /**
   * @desc    Get cost trend data for a specific model
   * @route   GET /api/costs/models/:modelName/trends
   * @access  Public
   */
  getModelCostTrends = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName } = req.params;
      const timeRange = parseInt(req.query.days as string) || 30;

      if (!modelName || modelName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Model name is required',
        });
      }

      if (timeRange <= 0 || timeRange > 365) {
        return res.status(400).json({
          success: false,
          message: 'Time range must be between 1 and 365 days',
        });
      }

      const trends = await this.costRepo.getCostTrends(modelName, timeRange);

      res.status(200).json({
        success: true,
        count: trends.length,
        data: trends,
        timeRange: timeRange,
      });
    } catch (error) {
      logger.error(`Error in getModelCostTrends: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model cost trends',
      });
    }
  });

  /**
   * @desc    Get system-wide cost statistics
   * @route   GET /api/costs/system/stats
   * @access  Public
   */
  getSystemCostStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = await this.costRepo.getSystemCostStats();

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error(`Error in getSystemCostStats: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving system cost statistics',
      });
    }
  });

  /**
   * @desc    Get cost map for cross-repository integration
   * @route   GET /api/costs/models/map
   * @access  Public
   * @note    Used by other repositories for model comparison data
   */
  getModelCostMap = asyncHandler(async (req: Request, res: Response) => {
    try {
      const costMap = await this.costRepo.getModelCostMap();

      res.status(200).json({
        success: true,
        count: Object.keys(costMap).length,
        data: costMap,
      });
    } catch (error) {
      logger.error(`Error in getModelCostMap: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model cost map',
      });
    }
  });
}

export default new CostController();