/**
 * Cost Controller
 * 
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-26T14:22:13-04:00
 * PURPOSE: RESTful controller for cost-related API endpoints.
 * Provides dedicated cost analysis, cost summaries, trends, and system statistics.
 * Follows SRP by handling ONLY cost-related HTTP request/response logic.
 * Delegates business logic to CostRepository for proper separation of concerns.
 * SRP and DRY check: Pass - Single responsibility for cost API endpoints only.
 * Does not duplicate business logic; uses CostRepository for all cost calculations.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import costRepository from '../repositories/CostRepository.ts';
import { logger } from '../utils/logger.ts';

class CostController {

  /**
   * @desc    Get cost summaries for all models
   * @route   GET /api/metrics/costs/models
   * @access  Public
   */
  getAllModelCosts = asyncHandler(async (req: Request, res: Response) => {
    try {
      const modelCosts = await costRepository.getAllModelCosts();

      res.status(200).json({
        success: true,
        count: modelCosts.length,
        data: modelCosts,
      });
    } catch (error) {
      logger.error(`Error in getAllModelCosts: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model costs',
      });
    }
  });

  /**
   * @desc    Get cost map for cross-repository integration
   * @route   GET /api/metrics/costs/models/map
   * @access  Public
   */
  getModelCostMap = asyncHandler(async (req: Request, res: Response) => {
    try {
      const costMap = await costRepository.getModelCostMap();

      res.status(200).json({
        success: true,
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

  /**
   * @desc    Get detailed cost summary for a specific model
   * @route   GET /api/metrics/costs/models/:modelName
   * @access  Public
   */
  getModelCostSummary = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName } = req.params;

      if (!modelName) {
        return res.status(400).json({
          success: false,
          message: 'Model name is required',
        });
      }

      const costSummary = await costRepository.getModelCostSummary(modelName);

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
   * @desc    Get cost trend data for a specific model over time
   * @route   GET /api/metrics/costs/models/:modelName/trends
   * @access  Public
   * @param   ?timeRange=30  Time range in days (optional, default: 30)
   */
  getModelCostTrends = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName } = req.params;
      const timeRange = parseInt(req.query.timeRange as string) || 30;

      if (!modelName) {
        return res.status(400).json({
          success: false,
          message: 'Model name is required',
        });
      }

      if (timeRange < 1 || timeRange > 365) {
        return res.status(400).json({
          success: false,
          message: 'Time range must be between 1 and 365 days',
        });
      }

      const costTrends = await costRepository.getCostTrends(modelName, timeRange);

      res.status(200).json({
        success: true,
        count: costTrends.length,
        metadata: {
          modelName,
          timeRange,
          daysWithData: costTrends.length
        },
        data: costTrends,
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
   * @route   GET /api/metrics/costs/system/stats
   * @access  Public
   */
  getSystemCostStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const systemStats = await costRepository.getSystemCostStats();

      res.status(200).json({
        success: true,
        data: systemStats,
      });
    } catch (error) {
      logger.error(`Error in getSystemCostStats: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving system cost statistics',
      });
    }
  });
}

export default new CostController();
