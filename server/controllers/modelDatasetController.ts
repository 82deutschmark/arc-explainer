/**
 * 
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-26T15:23:00-04:00
 * PURPOSE: RESTful controller for model dataset performance API endpoints.
 * Provides REAL database queries showing which ARC evaluation puzzles each model solved/failed/hasn't attempted.
 * Based on is_prediction_correct and multi_test_all_correct fields from the explanations table.
 * SRP and DRY check: Pass - Single responsibility for model dataset API endpoints only.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import modelDatasetRepository from '../repositories/ModelDatasetRepository.ts';
import { logger } from '../utils/logger.ts';

class ModelDatasetController {

  /**
   * @desc    Get model performance on ARC evaluation dataset
   * @route   GET /api/model-dataset/performance/:modelName
   * @access  Public
   */
  getModelPerformance = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName } = req.params;
      
      if (!modelName) {
        return res.status(400).json({
          success: false,
          message: 'Model name is required',
        });
      }

      const performance = await modelDatasetRepository.getModelDatasetPerformance(modelName);

      res.status(200).json({
        success: true,
        data: performance,
      });
    } catch (error) {
      logger.error(`Error in getModelPerformance: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model dataset performance',
      });
    }
  });

  /**
   * @desc    Get list of models available for analysis
   * @route   GET /api/model-dataset/models
   * @access  Public
   */
  getAvailableModels = asyncHandler(async (req: Request, res: Response) => {
    try {
      const models = await modelDatasetRepository.getAvailableModels();

      res.status(200).json({
        success: true,
        count: models.length,
        data: models,
      });
    } catch (error) {
      logger.error(`Error in getAvailableModels: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving available models',
      });
    }
  });
}

export default new ModelDatasetController();
