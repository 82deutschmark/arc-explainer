/**
 * batchAnalysisController.ts
 * 
 * Controller for batch analysis operations.
 * Handles HTTP requests and responses for batch model testing functionality.
 * 
 * @author Claude Code Assistant
 */

import { Request, Response } from 'express';
import { batchAnalysisService } from '../services/batchAnalysisService';
import { formatResponse } from '../utils/responseFormatter';
import { logger } from '../utils/logger';

export const batchAnalysisController = {
  /**
   * Validate batch analysis request parameters
   */
  validateBatchRequest(body: any) {
    const { modelKey, dataset, promptId, customPrompt, temperature, batchSize } = body;
    
    // Validate required parameters
    if (!modelKey) {
      return { valid: false, error: 'Missing model key', details: 'modelKey is required to start batch analysis' };
    }
    
    if (!dataset) {
      return { valid: false, error: 'Missing dataset', details: 'dataset is required to start batch analysis' };
    }
    
    // Validate dataset value
    const validDatasets = ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'All'];
    if (!validDatasets.includes(dataset)) {
      return { 
        valid: false, 
        error: 'Invalid dataset', 
        details: `dataset must be one of: ${validDatasets.join(', ')}` 
      };
    }
    
    // Validate custom prompt usage
    if (promptId === 'custom' && !customPrompt) {
      return { 
        valid: false, 
        error: 'Missing custom prompt', 
        details: 'customPrompt is required when promptId is "custom"' 
      };
    }
    
    // Validate temperature range
    if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
      return { 
        valid: false, 
        error: 'Invalid temperature', 
        details: 'temperature must be between 0 and 2' 
      };
    }
    
    // Validate batch size
    if (batchSize !== undefined && (batchSize < 1 || batchSize > 50)) {
      return { 
        valid: false, 
        error: 'Invalid batch size', 
        details: 'batchSize must be between 1 and 50' 
      };
    }
    
    return { valid: true };
  },

  /**
   * Extract and prepare batch analysis parameters
   */
  prepareBatchParams(body: any) {
    const {
      modelKey, dataset, promptId, customPrompt, temperature,
      reasoningEffort, reasoningVerbosity, reasoningSummaryType, batchSize
    } = body;
    
    return {
      modelKey, dataset, promptId, customPrompt, temperature,
      reasoningEffort, reasoningVerbosity, reasoningSummaryType, batchSize
    };
  },
  /**
   * Start a new batch analysis session
   * POST /api/model/batch-analyze
   */
  async startBatch(req: Request, res: Response) {
    try {
      // Validate request parameters using helper method
      const validation = this.validateBatchRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json(formatResponse.error(
          validation.error!,
          validation.details!
        ));
      }

      // Prepare parameters for batch service
      const params = this.prepareBatchParams(req.body);
      
      logger.info(`Starting batch analysis: model=${params.modelKey}, dataset=${params.dataset}`, 'batch-controller');

      const result = await batchAnalysisService.startBatchAnalysis(params);

      logger.info(`Batch analysis service returned: sessionId=${result.sessionId}, hasError=${!!result.error}`, 'batch-controller');

      if (result.error) {
        logger.error(`Batch analysis failed: ${result.error}`, 'batch-controller');
        return res.status(400).json(formatResponse.error(
          'Failed to start batch analysis',
          result.error
        ));
      }

      res.json(formatResponse.success({ 
        sessionId: result.sessionId,
        message: 'Batch analysis started successfully'
      }));

    } catch (error) {
      logger.error(`Error starting batch analysis: ${error instanceof Error ? error.message : String(error)}`, 'batch-controller');
      res.status(500).json(formatResponse.error(
        'Internal server error',
        'An error occurred while starting batch analysis'
      ));
    }
  },

  /**
   * Get batch analysis session status
   * GET /api/model/batch-status/:sessionId
   */
  async getBatchStatus(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json(formatResponse.error(
          'Missing session ID',
          'sessionId parameter is required'
        ));
      }

      const status = await batchAnalysisService.getBatchStatus(sessionId);
      
      if (!status) {
        return res.status(404).json(formatResponse.error(
          'Session not found',
          `Batch analysis session ${sessionId} not found or expired`
        ));
      }

      res.json(formatResponse.success(status));

    } catch (error) {
      logger.error(`Error getting batch status: ${error instanceof Error ? error.message : String(error)}`, 'batch-controller');
      res.status(500).json(formatResponse.error(
        'Internal server error',
        'An error occurred while retrieving batch status'
      ));
    }
  },

  /**
   * Control batch analysis session (pause, resume, cancel)
   * POST /api/model/batch-control/:sessionId
   */
  async controlBatch(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { action } = req.body;

      if (!sessionId) {
        return res.status(400).json(formatResponse.error(
          'Missing session ID',
          'sessionId parameter is required'
        ));
      }

      if (!action) {
        return res.status(400).json(formatResponse.error(
          'Missing action',
          'action parameter is required'
        ));
      }

      const validActions = ['pause', 'resume', 'cancel'];
      if (!validActions.includes(action)) {
        return res.status(400).json(formatResponse.error(
          'Invalid action',
          `action must be one of: ${validActions.join(', ')}`
        ));
      }

      logger.info(`Controlling batch session ${sessionId}: ${action}`, 'batch-controller');

      const success = await batchAnalysisService.controlBatchSession(sessionId, action);

      if (!success) {
        return res.status(400).json(formatResponse.error(
          'Control action failed',
          `Failed to ${action} batch analysis session`
        ));
      }

      res.json(formatResponse.success({ 
        success: true,
        message: `Batch analysis session ${action}d successfully`
      }));

    } catch (error) {
      logger.error(`Error controlling batch analysis: ${error instanceof Error ? error.message : String(error)}`, 'batch-controller');
      res.status(500).json(formatResponse.error(
        'Internal server error',
        'An error occurred while controlling batch analysis'
      ));
    }
  },

  /**
   * Get detailed results for a batch analysis session
   * GET /api/model/batch-results/:sessionId
   */
  async getBatchResults(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      const { limit, offset, status } = req.query;

      if (!sessionId) {
        return res.status(400).json(formatResponse.error(
          'Missing session ID',
          'sessionId parameter is required'
        ));
      }

      let results = await batchAnalysisService.getBatchResults(sessionId);

      // Reduced logging - only log on errors or first request
      if (!results || results.length === 0) {
        logger.info(`Getting batch results for session ${sessionId}`, 'batch-controller');
      }

      // Apply status filter if provided
      if (status && typeof status === 'string') {
        const validStatuses = ['pending', 'completed', 'failed', 'skipped'];
        if (validStatuses.includes(status)) {
          results = results.filter(result => result.status === status);
        }
      }

      // Apply pagination if provided
      const limitNum = limit ? parseInt(limit as string, 10) : undefined;
      const offsetNum = offset ? parseInt(offset as string, 10) : 0;

      const total = results.length;
      if (limitNum && limitNum > 0) {
        results = results.slice(offsetNum, offsetNum + limitNum);
      }

      res.json(formatResponse.success({
        results,
        pagination: {
          total,
          limit: limitNum || total,
          offset: offsetNum,
          hasMore: limitNum ? (offsetNum + limitNum) < total : false
        }
      }));

    } catch (error) {
      logger.error(`Error getting batch results: ${error instanceof Error ? error.message : String(error)}`, 'batch-controller');
      res.status(500).json(formatResponse.error(
        'Internal server error',
        'An error occurred while retrieving batch results'
      ));
    }
  },

  /**
   * Get all batch analysis sessions (admin/overview function)
   * GET /api/model/batch-sessions
   */
  async getAllSessions(req: Request, res: Response) {
    try {
      const { status, modelKey, dataset, limit, offset } = req.query;

      logger.info('Getting all batch sessions with filters', 'batch-controller');

      // Query database for all batch sessions
      const { dbService } = await import('../services/dbService');
      const allSessions = await dbService.getAllBatchSessions();

      let filteredSessions = allSessions;

      // Apply filters
      if (status && typeof status === 'string') {
        filteredSessions = filteredSessions.filter((session: any) => session.status === status);
      }

      // Apply pagination
      const limitNum = limit ? parseInt(limit as string, 10) : 50;
      const offsetNum = offset ? parseInt(offset as string, 10) : 0;

      const total = filteredSessions.length;
      const paginatedSessions = filteredSessions.slice(offsetNum, offsetNum + limitNum);

      res.json(formatResponse.success({
        sessions: paginatedSessions,
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: (offsetNum + limitNum) < total
        }
      }));

    } catch (error) {
      logger.error(`Error getting all batch sessions: ${error instanceof Error ? error.message : String(error)}`, 'batch-controller');
      res.status(500).json(formatResponse.error(
        'Internal server error',
        'An error occurred while retrieving batch sessions'
      ));
    }
  }
};