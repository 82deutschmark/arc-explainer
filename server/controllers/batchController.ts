/**
 * server/controllers/batchController.ts
 * 
 * Controller for batch testing operations.
 * Handles HTTP requests for starting, stopping, and monitoring batch puzzle analysis runs.
 * Integrates with existing puzzle analysis infrastructure to ensure consistent behavior.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { batchService } from '../services/batchService';
import { formatResponse } from '../utils/responseFormatter';
import { asyncHandler } from '../middleware/asyncHandler';

export const batchController = {
  /**
   * Start a new batch run
   * 
   * POST /api/batch/start
   * Body: { model: string, datasetPath: string, config?: BatchConfig }
   */
  async start(req: Request, res: Response) {
    const { model, datasetPath, config = {} } = req.body;
    
    if (!model || !datasetPath) {
      return res.status(400).json(formatResponse.error('Model and datasetPath are required', 'Invalid request parameters'));
    }
    
    try {
      const batchRun = await batchService.startBatchRun(model, datasetPath, config);
      res.json(formatResponse.success(batchRun));
    } catch (error) {
      console.error('Error starting batch run:', error);
      res.status(500).json(formatResponse.error('Failed to start batch run', 'Server error'));
    }
  },

  /**
   * Get batch run status and progress
   * 
   * GET /api/batch/:id
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;
    const batchId = parseInt(id);
    
    if (isNaN(batchId)) {
      return res.status(400).json(formatResponse.error('Invalid batch ID', 'Invalid request parameters'));
    }
    
    try {
      const batchRun = await batchService.getBatchRunStatus(batchId);
      if (!batchRun) {
        return res.status(404).json(formatResponse.error('Batch run not found', 'Resource not found'));
      }
      
      res.json(formatResponse.success(batchRun));
    } catch (error) {
      console.error('Error getting batch run:', error);
      res.status(500).json(formatResponse.error('Failed to get batch run', 'Server error'));
    }
  },

  /**
   * Stop a running batch
   * 
   * POST /api/batch/:id/stop
   */
  async stop(req: Request, res: Response) {
    const { id } = req.params;
    const batchId = parseInt(id);
    
    if (isNaN(batchId)) {
      return res.status(400).json(formatResponse.error('Invalid batch ID', 'Invalid request parameters'));
    }
    
    try {
      const stopped = await batchService.stopBatchRun(batchId);
      if (!stopped) {
        return res.status(404).json(formatResponse.error('Batch run not found or already stopped', 'Resource not found'));
      }
      
      res.json(formatResponse.success({ message: 'Batch run stopped successfully' }));
    } catch (error) {
      console.error('Error stopping batch run:', error);
      res.status(500).json(formatResponse.error('Failed to stop batch run', 'Server error'));
    }
  },

  /**
   * List all batch runs with filtering
   * 
   * GET /api/batch/list
   * Query params: limit, offset, status, model
   */
  async list(req: Request, res: Response) {
    const { limit = '50', offset = '0', status, model } = req.query;
    
    try {
      const batchRuns = await batchService.listBatchRuns({
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
        status: status as string,
        model: model as string
      });
      
      res.json(formatResponse.success(batchRuns));
    } catch (error) {
      console.error('Error listing batch runs:', error);
      res.status(500).json(formatResponse.error('Failed to list batch runs', 'Server error'));
    }
  },

  /**
   * Get detailed results for a completed batch run
   * 
   * GET /api/batch/:id/results
   */
  async getResults(req: Request, res: Response) {
    const { id } = req.params;
    const batchId = parseInt(id);
    
    if (isNaN(batchId)) {
      return res.status(400).json(formatResponse.error('Invalid batch ID', 'Invalid request parameters'));
    }
    
    try {
      const results = await batchService.getBatchResults(batchId);
      res.json(formatResponse.success(results));
    } catch (error) {
      console.error('Error getting batch results:', error);
      res.status(500).json(formatResponse.error('Failed to get batch results', 'Server error'));
    }
  }
};
