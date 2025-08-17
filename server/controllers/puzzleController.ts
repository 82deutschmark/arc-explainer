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
import { dbService } from '../services/dbService';
import type { PromptOptions } from '../services/promptBuilder';

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
    const { temperature = 0.75, captureReasoning = true, promptId = "alienCommunication", customPrompt, emojiSetKey, omitAnswer } = req.body;
    
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
    
    // Build options object for prompt builder
    const options: PromptOptions = {};
    if (emojiSetKey) options.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') options.omitAnswer = omitAnswer;
    
    const result = await aiService.analyzePuzzleWithModel(puzzle, model, temperature, captureReasoning, promptId, customPrompt, options);
    
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
  },

  /**
   * Preview the exact prompt that will be sent to a specific provider
   * Shows provider-specific formatting and message structure
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async previewPrompt(req: Request, res: Response) {
    try {
      const { provider, taskId } = req.params;
      const { promptId = "standardExplanation", customPrompt, temperature = 0.75, captureReasoning = true, emojiSetKey, omitAnswer } = req.body;

      console.log(`[Controller] Generating prompt preview for ${provider} with puzzle ${taskId}`);

      // Get the puzzle data
      const puzzle = await puzzleService.getPuzzleById(taskId);
      if (!puzzle) {
        return res.status(404).json(formatResponse.error('Puzzle not found', 'The specified puzzle could not be found'));
      }

      // Get the AI service for the provider
      const aiService = aiServiceFactory.getService(provider);
      if (!aiService) {
        return res.status(400).json(formatResponse.error('Invalid provider', 'The specified AI provider is not supported'));
      }

      // Build options object for prompt builder
      const options: PromptOptions = {};
      if (emojiSetKey) options.emojiSetKey = emojiSetKey;
      if (typeof omitAnswer === 'boolean') options.omitAnswer = omitAnswer;

      // Generate provider-specific prompt preview
      const previewData = await aiService.generatePromptPreview(
        puzzle, 
        provider, 
        temperature, 
        captureReasoning, 
        promptId, 
        customPrompt,
        options
      );

      res.json(formatResponse.success(previewData));
    } catch (error) {
      console.error('[Controller] Error generating prompt preview:', error);
      res.status(500).json(formatResponse.error('Failed to generate prompt preview', 'An error occurred while generating the prompt preview'));
    }
  },

  /**
   * Get all puzzles with their explanation details for overview page
   * Supports search and filtering by various parameters
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async overview(req: Request, res: Response) {
    try {
      const { 
        search, 
        hasExplanation, 
        hasFeedback,
        modelName, 
        confidenceMin, 
        confidenceMax,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      console.log('[Controller] Puzzle overview request with filters:', req.query);

      // Get all puzzles from the puzzle service
      const allPuzzles = await puzzleService.getPuzzleList({});
      
      // If no database connection, return basic puzzle list
      if (!dbService.isConnected()) {
        const basicResults = allPuzzles.map(puzzle => ({
          ...puzzle,
          explanations: [],
          totalExplanations: 0,
          latestExplanation: null,
          hasExplanation: false
        }));
        
        return res.json(formatResponse.success({
          puzzles: basicResults.slice(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string)),
          total: basicResults.length,
          hasMore: basicResults.length > parseInt(offset as string) + parseInt(limit as string)
        }));
      }

      // Build a map of puzzle IDs for faster lookup
      const puzzleMap = new Map();
      allPuzzles.forEach(puzzle => {
        puzzleMap.set(puzzle.id, {
          ...puzzle,
          explanations: [],
          totalExplanations: 0,
          latestExplanation: null,
          hasExplanation: false
        });
      });

      // For now, let's use a simpler approach and get explanations for each puzzle
      // This is less efficient but will work with the existing dbService methods
      
      // Get puzzle IDs to check for explanations
      const puzzleIds = allPuzzles.map(p => p.id);
      
      // Apply search filter early if provided
      let filteredPuzzleIds = puzzleIds;
      if (search) {
        filteredPuzzleIds = puzzleIds.filter(id => 
          id.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Get bulk explanation status for all filtered puzzles
      const explanationStatusMap = await dbService.getBulkExplanationStatus(filteredPuzzleIds);

      // Build results by merging puzzle data with explanation status
      explanationStatusMap.forEach((status, puzzleId) => {
        const puzzle = puzzleMap.get(puzzleId);
        if (puzzle) {
          puzzle.hasExplanation = status.hasExplanation;
          puzzle.totalExplanations = status.hasExplanation ? 1 : 0; // For now, assume 1 explanation per puzzle
          puzzle.explanationId = status.explanationId;
          puzzle.feedbackCount = status.feedbackCount;
        }
      });

      // For puzzles with explanations, get detailed explanation data if needed
      for (const [puzzleId, status] of explanationStatusMap) {
        if (status.hasExplanation && status.explanationId) {
          try {
            const explanations = await dbService.getExplanationsForPuzzle(puzzleId);
            if (explanations && explanations.length > 0) {
              const puzzle = puzzleMap.get(puzzleId);
              if (puzzle) {
                // Filter explanations by model if specified
                let filteredExplanations = explanations;
                if (modelName) {
                  filteredExplanations = explanations.filter(exp => exp.modelName === modelName);
                }

                // Filter by confidence if specified
                if (confidenceMin || confidenceMax) {
                  filteredExplanations = filteredExplanations.filter(exp => {
                    const confidence = exp.confidence || 0;
                    if (confidenceMin && confidence < parseInt(confidenceMin as string)) return false;
                    if (confidenceMax && confidence > parseInt(confidenceMax as string)) return false;
                    return true;
                  });
                }

                if (filteredExplanations.length > 0) {
                  puzzle.explanations = filteredExplanations;
                  puzzle.totalExplanations = filteredExplanations.length;
                  puzzle.latestExplanation = filteredExplanations[0];
                  puzzle.hasExplanation = true;
                } else {
                  // No explanations match the filters
                  puzzle.explanations = [];
                  puzzle.totalExplanations = 0;
                  puzzle.latestExplanation = null;
                  puzzle.hasExplanation = false;
                }
              }
            }
          } catch (error) {
            console.error(`Error getting explanations for puzzle ${puzzleId}:`, error);
          }
        }
      }

      // Convert map back to array
      let results = Array.from(puzzleMap.values());

        // Apply hasExplanation filter
        if (hasExplanation === 'true') {
          results = results.filter(puzzle => puzzle.hasExplanation);
        } else if (hasExplanation === 'false') {
          results = results.filter(puzzle => !puzzle.hasExplanation);
        }

        // Apply hasFeedback filter
        if (hasFeedback === 'true') {
          results = results.filter(puzzle => puzzle.feedbackCount && puzzle.feedbackCount > 0);
        } else if (hasFeedback === 'false') {
          results = results.filter(puzzle => !puzzle.feedbackCount || puzzle.feedbackCount === 0);
        }

        // Apply sorting
        results.sort((a, b) => {
          let aValue, bValue;
          
          switch (sortBy) {
            case 'puzzleId':
              aValue = a.id;
              bValue = b.id;
              break;
            case 'explanationCount':
              aValue = a.totalExplanations;
              bValue = b.totalExplanations;
              break;
            case 'latestConfidence':
              aValue = a.latestExplanation?.confidence || 0;
              bValue = b.latestExplanation?.confidence || 0;
              break;
            case 'createdAt':
            default:
              aValue = a.latestExplanation?.createdAt || '1970-01-01';
              bValue = b.latestExplanation?.createdAt || '1970-01-01';
              break;
          }
          
          if (sortOrder === 'desc') {
            return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
          } else {
            return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
          }
        });

        // Apply pagination
        const total = results.length;
        const paginatedResults = results.slice(
          parseInt(offset as string), 
          parseInt(offset as string) + parseInt(limit as string)
        );

        res.json(formatResponse.success({
          puzzles: paginatedResults,
          total: total,
          hasMore: total > parseInt(offset as string) + parseInt(limit as string)
        }));

    } catch (error) {
      console.error('[Controller] Error in puzzle overview:', error);
      res.status(500).json(formatResponse.error('Failed to get puzzle overview', 'An error occurred while fetching puzzle overview data'));
    }
  },

  // Debug endpoint to force puzzle loader reinitialization
  async reinitialize(req: Request, res: Response) {
    try {
      const { puzzleLoader } = await import('../services/puzzleLoader');
      puzzleLoader.forceReinitialize();
      res.json(formatResponse.success({ message: 'Puzzle loader reinitialized successfully' }));
    } catch (error) {
      console.error('[Controller] Error reinitializing puzzle loader:', error);
      res.status(500).json(formatResponse.error('Failed to reinitialize puzzle loader', 'An error occurred while reinitializing the puzzle loader'));
    }
  }
};
