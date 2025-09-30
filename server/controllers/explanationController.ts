/**
 * explanationController.ts
 * 
 * Controller for explanation-related routes.
 * Handles HTTP requests and responses for explanation operations.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { explanationService } from '../services/explanationService';
import { formatResponse } from '../utils/responseFormatter';

export const explanationController = {
  /**
   * Get all explanations for a puzzle
   *
   * @param req - Express request object
   * @param res - Express response object
   * Query params:
   *   - correctness: 'all' | 'correct' | 'incorrect' (optional, defaults to 'all')
   */
  async getAll(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const { correctness } = req.query;

      // Validate correctness filter parameter
      const correctnessFilter = ['all', 'correct', 'incorrect'].includes(correctness as string)
        ? (correctness as 'all' | 'correct' | 'incorrect')
        : 'all';

      const explanations = await explanationService.getExplanationsForPuzzle(puzzleId, correctnessFilter);

      if (explanations === null) {
        // Database is not connected, return an empty array instead of null
        return res.json(formatResponse.success([]));
      }

      res.json(formatResponse.success(explanations));
    } catch (error) {
      console.error('Error in explanationController.getAll:', error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR',
        'Failed to retrieve explanations',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  },

  /**
   * Get a single explanation for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getOne(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const explanation = await explanationService.getExplanationForPuzzle(puzzleId);
      
      if (!explanation) {
        return res.status(404).json(formatResponse.error(
          'NOT_FOUND', 
          'No explanation found for this puzzle'
        ));
      }
      
      res.json(formatResponse.success(explanation));
    } catch (error) {
      console.error('Error in explanationController.getOne:', error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR', 
        'Failed to retrieve explanation',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  },

  /**
   * Create a new explanation for a puzzle
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async create(req: Request, res: Response) {
    try {
      const { puzzleId } = req.params;
      const { explanations } = req.body;
      console.log(`[CRITICAL-DEBUG] CONTROLLER: puzzleId="${puzzleId}" type=${typeof puzzleId}`);
      console.log(`[CRITICAL-DEBUG] CONTROLLER: req.params=`, JSON.stringify(req.params));
      
      const result = await explanationService.saveExplanation(puzzleId, explanations);

      if (result.success) {
        // Fetch the full explanation objects to return to frontend
        const { repositoryService } = await import('../repositories/RepositoryService');
        const explanationObjects: Record<string, any> = {};
        
        // Build explanations object keyed by model name
        for (const id of result.explanationIds) {
          const explanation = await repositoryService.explanations.getExplanationById(id);
          if (explanation) {
            explanationObjects[explanation.modelName] = explanation;
          }
        }
        
        res.status(201).json(formatResponse.success({ 
          explanationIds: result.explanationIds,
          explanations: explanationObjects 
        }, 'Explanation saved successfully.'));
      } else {
        // Handle controlled failures, e.g., validation errors from the service
        res.status(400).json(formatResponse.error('SAVE_FAILED', result.message || 'Failed to save explanation due to invalid data.'));
      }
    } catch (error) {
      const { puzzleId } = req.params;
      console.error(`Error in explanationController.create for puzzle ${puzzleId}:`, error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR',
        'An unexpected error occurred while saving the explanation.',
        { error: error instanceof Error ? error.message : 'Unknown database error' }
      ));
    }
  },

  /**
   * Get rebuttal chain for an explanation
   *
   * @param req - Express request object (params.id = explanation ID)
   * @param res - Express response object
   */
  async getRebuttalChain(req: Request, res: Response) {
    try {
      const explanationId = parseInt(req.params.id);

      if (isNaN(explanationId)) {
        return res.status(400).json(formatResponse.error(
          'INVALID_ID',
          'Invalid explanation ID'
        ));
      }

      const { repositoryService } = await import('../repositories/RepositoryService');
      const chain = await repositoryService.explanations.getRebuttalChain(explanationId);

      res.json(formatResponse.success(chain));
    } catch (error) {
      console.error('Error in explanationController.getRebuttalChain:', error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR',
        'Failed to retrieve rebuttal chain',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  },

  /**
   * Get original explanation that a rebuttal is challenging
   *
   * @param req - Express request object (params.id = rebuttal explanation ID)
   * @param res - Express response object
   */
  async getOriginalExplanation(req: Request, res: Response) {
    try {
      const rebuttalId = parseInt(req.params.id);

      if (isNaN(rebuttalId)) {
        return res.status(400).json(formatResponse.error(
          'INVALID_ID',
          'Invalid explanation ID'
        ));
      }

      const { repositoryService } = await import('../repositories/RepositoryService');
      const original = await repositoryService.explanations.getOriginalExplanation(rebuttalId);

      if (!original) {
        return res.status(404).json(formatResponse.error(
          'NOT_FOUND',
          'Original explanation not found or this is not a rebuttal'
        ));
      }

      res.json(formatResponse.success(original));
    } catch (error) {
      console.error('Error in explanationController.getOriginalExplanation:', error);
      res.status(500).json(formatResponse.error(
        'INTERNAL_ERROR',
        'Failed to retrieve original explanation',
        { error: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  }
};
