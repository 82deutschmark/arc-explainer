/**
 * 
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-26T15:23:00-04:00 (Updated 2025-10-10 - terminology fix)
 * PURPOSE: RESTful controller for model dataset performance API endpoints.
 * Provides REAL database queries showing which ARC evaluation puzzles each model got correct/incorrect/hasn't attempted.
 * Based on is_prediction_correct and multi_test_all_correct fields from the explanations table.
 * SRP and DRY check: Pass - Single responsibility for model dataset API endpoints only.
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { logger } from '../utils/logger.ts';

class ModelDatasetController {

  /**
   * @desc    Get model performance on any ARC dataset
   * @route   GET /api/model-dataset/performance/:modelName/:datasetName
   * @access  Public
   */
  getModelPerformance = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName, datasetName } = req.params;
      
      if (!modelName || !datasetName) {
        return res.status(400).json({
          success: false,
          message: 'Model name and dataset name are required',
        });
      }

      const performance = await repositoryService.modelDataset.getModelDatasetPerformance(modelName, datasetName);

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
      const models = await repositoryService.modelDataset.getAvailableModels();

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

  /**
   * @desc    Get list of available datasets (dynamic discovery)
   * @route   GET /api/model-dataset/datasets
   * @access  Public
   */
  getAvailableDatasets = asyncHandler(async (req: Request, res: Response) => {
    try {
      const datasets = await repositoryService.modelDataset.getAvailableDatasets();

      res.status(200).json({
        success: true,
        count: datasets.length,
        data: datasets,
      });
    } catch (error) {
      logger.error(`Error in getAvailableDatasets: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving available datasets',
      });
    }
  });

  /**
   * @desc    Get aggregate metrics (cost, time, tokens) for a model on a specific dataset
   * @route   GET /api/model-dataset/metrics/:modelName/:datasetName
   * @access  Public
   */
  getModelDatasetMetrics = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { modelName, datasetName } = req.params;
      
      if (!modelName || !datasetName) {
        return res.status(400).json({
          success: false,
          message: 'Model name and dataset name are required',
        });
      }

      const metrics = await repositoryService.modelDataset.getModelDatasetMetrics(modelName, datasetName);

      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error(`Error in getModelDatasetMetrics: ${error instanceof Error ? error.message : String(error)}`, 'api');
      res.status(500).json({
        success: false,
        message: 'Error retrieving model dataset metrics',
      });
    }
  });
}

export default new ModelDatasetController();
