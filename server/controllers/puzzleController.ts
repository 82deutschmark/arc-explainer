/**
 * puzzleController.ts
 * 
 * Controller for puzzle-related routes.
 * Handles HTTP requests and responses for puzzle operations.
 * Now supports reasoning log capture from AI models that provide step-by-step reasoning.
 * Tracks and records API processing time metrics for model performance analysis.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { puzzleService } from '../services/puzzleService';
import { aiServiceFactory } from '../services/aiServiceFactory';
import { formatResponse } from '../utils/responseFormatter';

export const puzzleController = {
  /**
   * Get a filtered list of puzzles
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async list(req: Request, res: Response) {
    const { maxGridSize, minGridSize, difficulty, gridSizeConsistent, prioritizeUnexplained, prioritizeExplained, source } = req.query;
    
    console.log('DEBUG: Puzzle list request with query params:', req.query);
    
    const filters: any = {};
    if (maxGridSize) filters.maxGridSize = parseInt(maxGridSize as string);
    if (minGridSize) filters.minGridSize = parseInt(minGridSize as string);
    if (difficulty) filters.difficulty = difficulty as string;
    if (gridSizeConsistent) filters.gridSizeConsistent = gridSizeConsistent === 'true';
    if (prioritizeUnexplained) filters.prioritizeUnexplained = prioritizeUnexplained === 'true';
    if (prioritizeExplained) filters.prioritizeExplained = prioritizeExplained === 'true';
    if (source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval'].includes(source as string)) filters.source = source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
    
    console.log('DEBUG: Using filters:', filters);
    
    const puzzles = await puzzleService.getPuzzleList(filters);
    console.log(`DEBUG: Found ${puzzles.length} puzzles, first few:`, puzzles.slice(0, 3));
    
    res.json(formatResponse.success(puzzles));
  },

  /**
   * Get a puzzle by ID
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getById(req: Request, res: Response) {
    const { taskId } = req.params;
    const puzzle = await puzzleService.getPuzzleById(taskId);
    res.json(formatResponse.success(puzzle));
  },

  /**
   * Analyze a puzzle with a specific AI model
   * Supports both predefined prompt templates (via promptId) and custom user prompts (via customPrompt)
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async analyze(req: Request, res: Response) {
    const { taskId, model } = req.params;
    const { temperature = 0.75, captureReasoning = true, promptId = "alienCommunication", customPrompt } = req.body;
    
    // Log the request with custom prompt handling
    if (customPrompt) {
      console.log(`[Controller] Analyzing puzzle ${taskId} with model ${model} using custom prompt (${customPrompt.length} chars), captureReasoning: ${captureReasoning}`);
    } else {
      console.log(`[Controller] Analyzing puzzle ${taskId} with model ${model}, promptId: ${promptId}, captureReasoning: ${captureReasoning}`);
    }
    
    // Track server processing time
    const apiStartTime = Date.now();
    
    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(model);
    const result = await aiService.analyzePuzzleWithModel(puzzle, model, temperature, captureReasoning, promptId, customPrompt);
    
    // Calculate API processing time
    const apiProcessingTimeMs = Date.now() - apiStartTime;
    
    // Add timing to result
    result.apiProcessingTimeMs = apiProcessingTimeMs;
    
    console.log(`[Controller] API processing time for ${model}: ${apiProcessingTimeMs}ms`);
    
    // Log reasoning capture status
    if (result.hasReasoningLog) {
      console.log(`[Controller] Successfully captured reasoning log for ${model} (${result.reasoningLog?.length || 0} characters)`);
    }
    
    res.json(formatResponse.success(result));
  },
  
  /**
   * Check if a puzzle has an explanation
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async hasExplanation(req: Request, res: Response) {
    const { puzzleId } = req.params;
    const hasExplanation = await puzzleService.hasPuzzleExplanation(puzzleId);
    res.json(formatResponse.success({ hasExplanation }));
  }
};
