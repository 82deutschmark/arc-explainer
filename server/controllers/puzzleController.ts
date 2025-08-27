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
import { repositoryService } from '../repositories/RepositoryService.js';
import type { PromptOptions } from '../services/promptBuilder';
import { validateSolverResponse, validateSolverResponseMulti } from '../services/responseValidator.js';
import { logger } from '../utils/logger.js';

export const puzzleController = {
  /**
   * Get a filtered list of puzzles
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async list(req: Request, res: Response) {
    const { maxGridSize, minGridSize, difficulty, gridSizeConsistent, prioritizeUnexplained, prioritizeExplained, source, multiTestFilter } = req.query;
    
    logger.debug('Puzzle list request with query params: ' + JSON.stringify(req.query), 'puzzle-controller');
    
    const filters: any = {};
    if (maxGridSize) filters.maxGridSize = parseInt(maxGridSize as string);
    if (minGridSize) filters.minGridSize = parseInt(minGridSize as string);
    if (difficulty) filters.difficulty = difficulty as string;
    if (gridSizeConsistent) filters.gridSizeConsistent = gridSizeConsistent === 'true';
    if (prioritizeUnexplained) filters.prioritizeUnexplained = prioritizeUnexplained === 'true';
    if (prioritizeExplained) filters.prioritizeExplained = prioritizeExplained === 'true';
    if (source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval'].includes(source as string)) filters.source = source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
    if (multiTestFilter && ['single', 'multi'].includes(multiTestFilter as string)) filters.multiTestFilter = multiTestFilter as 'single' | 'multi';
    
    logger.debug('Using filters: ' + JSON.stringify(filters), 'puzzle-controller');
    
    const puzzles = await puzzleService.getPuzzleList(filters);
    logger.debug(`Found ${puzzles.length} puzzles, first few: ` + JSON.stringify(puzzles.slice(0, 3)), 'puzzle-controller');
    
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
    const { taskId, model: encodedModel } = req.params;
    // Decode model parameter to handle OpenRouter provider/model format (e.g., qwen%2Fqwen-2.5-coder-32b-instruct)
    const model = decodeURIComponent(encodedModel);
    const { 
      temperature = 0.2, 
      captureReasoning = true, 
      promptId = "solver", 
      customPrompt, 
      emojiSetKey, 
      omitAnswer = true,
      // GPT-5 reasoning parameters
      reasoningEffort,
      reasoningVerbosity, 
      reasoningSummaryType,
      // System prompt mode
      systemPromptMode = 'ARC'
    } = req.body;
    
    
    // Track server processing time
    const apiStartTime = Date.now();
    
    const puzzle = await puzzleService.getPuzzleById(taskId);
    const aiService = aiServiceFactory.getService(model);
    
    // Build options object for prompt builder
    const options: PromptOptions = {};
    if (emojiSetKey) options.emojiSetKey = emojiSetKey;
    if (typeof omitAnswer === 'boolean') options.omitAnswer = omitAnswer;
    
    // Build service options including reasoning parameters
    const serviceOpts: any = {};
    if (reasoningEffort) serviceOpts.reasoningEffort = reasoningEffort;
    if (reasoningVerbosity) serviceOpts.reasoningVerbosity = reasoningVerbosity;
    if (reasoningSummaryType) serviceOpts.reasoningSummaryType = reasoningSummaryType;
    if (systemPromptMode) serviceOpts.systemPromptMode = systemPromptMode;
    
    const result = await aiService.analyzePuzzleWithModel(puzzle, model, temperature, captureReasoning, promptId, customPrompt, options, serviceOpts);
    
    // Calculate API processing time
    const apiProcessingTimeMs = Date.now() - apiStartTime;
    
    // Add timing to result
    result.apiProcessingTimeMs = apiProcessingTimeMs;
    
    
    
    
    // Validate solver mode responses
    if (promptId === "solver") {
      const confidence = result.confidence || 50; // Default confidence if not provided
      const testCount = puzzle.test?.length || 0;
      
      // Simple logic: Check if AI provided multiple predictions
      if (result.multiplePredictedOutputs === true) {
        // Multi-test case: AI provided multiple grids
        const correctAnswers = testCount > 1 ? puzzle.test.map(t => t.output) : [puzzle.test[0].output];
        const multi = validateSolverResponseMulti(result, correctAnswers, promptId, confidence);

        // Simple storage: predictedOutputGrid = null, multiplePredictedOutputs = array of grids
        result.predictedOutputGrid = null;
        result.multiplePredictedOutputs = multi.predictedGrids;
        result.hasMultiplePredictions = true;
        
        // Attach validation results for UI
        result.predictedOutputGrids = multi.predictedGrids;
        result.multiValidation = multi.itemResults;
        result.allPredictionsCorrect = multi.allCorrect;
        result.averagePredictionAccuracyScore = multi.averageAccuracyScore;
        result.multiTestResults = multi.itemResults;
        result.multiTestAllCorrect = multi.allCorrect;
        result.multiTestAverageAccuracy = multi.averageAccuracyScore;
        result.extractionMethod = multi.extractionMethodSummary;

      } else {
        // Single-test case: AI provided one grid
        const correctAnswer = puzzle.test[0].output;
        const validation = validateSolverResponse(result, correctAnswer, promptId, confidence);

        // Simple storage: predictedOutputGrid = single grid, multiplePredictedOutputs = null
        result.predictedOutputGrid = validation.predictedGrid;
        result.multiplePredictedOutputs = null;
        result.hasMultiplePredictions = false;
        
        // Attach validation results for UI
        result.isPredictionCorrect = validation.isPredictionCorrect;
        result.predictionAccuracyScore = validation.predictionAccuracyScore;
        result.extractionMethod = validation.extractionMethod;
      }
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
      const { 
        promptId = "solver", 
        customPrompt, 
        temperature = 0.2, 
        captureReasoning = true, 
        emojiSetKey, 
        omitAnswer = true,
        // GPT-5 reasoning parameters  
        reasoningEffort,
        reasoningVerbosity,
        reasoningSummaryType,
        // System prompt mode
        systemPromptMode = 'ARC'
      } = req.body;

      logger.info(`Generating prompt preview for ${provider} with puzzle ${taskId}`, 'puzzle-controller');

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

      // Build service options including reasoning parameters
      const serviceOpts: any = {};
      if (reasoningEffort) serviceOpts.reasoningEffort = reasoningEffort;
      if (reasoningVerbosity) serviceOpts.reasoningVerbosity = reasoningVerbosity;
      if (reasoningSummaryType) serviceOpts.reasoningSummaryType = reasoningSummaryType;
      if (systemPromptMode) serviceOpts.systemPromptMode = systemPromptMode;

      // Generate provider-specific prompt preview
      const previewData = await aiService.generatePromptPreview(
        puzzle, 
        provider, 
        temperature, 
        captureReasoning, 
        promptId, 
        customPrompt,
        options,
        serviceOpts
      );

      res.json(formatResponse.success(previewData));
    } catch (error) {
      logger.error('Error generating prompt preview: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to generate prompt preview', 'An error occurred while generating the prompt preview'));
    }
  },

  /**
   * Build overview filters from query parameters
   */
  buildOverviewFilters(query: any) {
    const puzzleFilters: any = {};
    const { source, multiTestFilter, gridSizeMin, gridSizeMax, gridConsistency } = query;
    
    if (source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval'].includes(source as string)) {
      puzzleFilters.source = source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
    }
    if (multiTestFilter && ['single', 'multi'].includes(multiTestFilter as string)) {
      puzzleFilters.multiTestFilter = multiTestFilter as 'single' | 'multi';
    }
    if (gridSizeMin) {
      puzzleFilters.minGridSize = parseInt(gridSizeMin as string);
    }
    if (gridSizeMax) {
      puzzleFilters.maxGridSize = parseInt(gridSizeMax as string);
    }
    if (gridConsistency && ['true', 'false'].includes(gridConsistency as string)) {
      puzzleFilters.gridSizeConsistent = gridConsistency === 'true';
    }
    
    return puzzleFilters;
  },

  /**
   * Create basic puzzle overview structure
   */
  createBasicOverview(allPuzzles: any[], offset: string, limit: string) {
    const basicResults = allPuzzles.map(puzzle => ({
      ...puzzle,
      explanations: [],
      totalExplanations: 0,
      latestExplanation: null,
      hasExplanation: false
    }));
    
    const offsetNum = parseInt(offset);
    const limitNum = parseInt(limit);
    
    return {
      puzzles: basicResults.slice(offsetNum, offsetNum + limitNum),
      total: basicResults.length,
      hasMore: basicResults.length > offsetNum + limitNum
    };
  },

  /**
   * Apply explanation filters to explanation list
   */
  applyExplanationFilters(explanations: any[], filters: any) {
    const {
      modelName, saturnFilter, confidenceMin, confidenceMax,
      processingTimeMin, processingTimeMax, hasPredictions, predictionAccuracy
    } = filters;
    
    let filtered = explanations;
    
    // Filter by model
    if (modelName) {
      filtered = filtered.filter(exp => exp.modelName === modelName);
    }
    
    // Filter by Saturn status
    if (saturnFilter) {
      if (saturnFilter === 'solved') {
        filtered = filtered.filter(exp => exp.saturnSuccess === true);
      } else if (saturnFilter === 'failed') {
        filtered = filtered.filter(exp => exp.saturnSuccess === false);
      } else if (saturnFilter === 'attempted') {
        filtered = filtered.filter(exp => exp.saturnSuccess !== undefined);
      }
    }
    
    // Filter by confidence range
    if (confidenceMin || confidenceMax) {
      filtered = filtered.filter(exp => {
        const confidence = exp.confidence || 0;
        if (confidenceMin && confidence < parseInt(confidenceMin)) return false;
        if (confidenceMax && confidence > parseInt(confidenceMax)) return false;
        return true;
      });
    }
    
    // Filter by processing time
    if (processingTimeMin || processingTimeMax) {
      filtered = filtered.filter(exp => {
        const processingTime = exp.apiProcessingTimeMs || 0;
        if (processingTimeMin && processingTime < parseInt(processingTimeMin)) return false;
        if (processingTimeMax && processingTime > parseInt(processingTimeMax)) return false;
        return true;
      });
    }
    
    // Filter by predictions
    if (hasPredictions === 'true') {
      filtered = filtered.filter(exp => exp.predictedOutputGrid || exp.multiplePredictedOutputs);
    } else if (hasPredictions === 'false') {
      filtered = filtered.filter(exp => !exp.predictedOutputGrid && !exp.multiplePredictedOutputs);
    }
    
    // Filter by prediction accuracy
    if (predictionAccuracy === 'correct') {
      filtered = filtered.filter(exp => exp.isPredictionCorrect === true || exp.multiTestAllCorrect === true);
    } else if (predictionAccuracy === 'incorrect') {
      filtered = filtered.filter(exp => exp.isPredictionCorrect === false || exp.multiTestAllCorrect === false);
    }
    
    return filtered;
  },

  /**
   * Sort overview results based on sort parameters
   */
  sortOverviewResults(results: any[], sortBy: string, sortOrder: string) {
    return results.sort((a, b) => {
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
  },

  /**
   * Apply pagination to results
   */
  applyPagination(results: any[], offset: string, limit: string) {
    const offsetNum = parseInt(offset);
    const limitNum = parseInt(limit);
    const total = results.length;
    const paginatedResults = results.slice(offsetNum, offsetNum + limitNum);
    
    return {
      puzzles: paginatedResults,
      total: total,
      hasMore: total > offsetNum + limitNum
    };
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
        search, hasExplanation, hasFeedback, modelName, saturnFilter,
        processingTimeMin, processingTimeMax, hasPredictions, predictionAccuracy,
        confidenceMin, confidenceMax, limit = 50, offset = 0,
        sortBy = 'createdAt', sortOrder = 'desc'
      } = req.query;

      logger.debug('Puzzle overview request with filters: ' + JSON.stringify(req.query), 'puzzle-controller');

      // Build puzzle filters using helper method
      const puzzleFilters = this.buildOverviewFilters(req.query);
      const allPuzzles = await puzzleService.getPuzzleList(puzzleFilters);
      
      // If no database connection, return basic overview
      if (!repositoryService.isConnected()) {
        const basicOverview = this.createBasicOverview(allPuzzles, offset as string, limit as string);
        return res.json(formatResponse.success(basicOverview));
      }

      // Initialize puzzle map
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

      // Apply search filter to puzzle IDs
      let filteredPuzzleIds = allPuzzles.map(p => p.id);
      if (search && typeof search === 'string') {
        filteredPuzzleIds = filteredPuzzleIds.filter(id => 
          id.toLowerCase().includes(search.toLowerCase())
        );
      }

      // Get explanation status and populate puzzle map
      const explanationStatusMap = await repositoryService.explanations.getBulkExplanationStatus(filteredPuzzleIds);
      explanationStatusMap.forEach((status, puzzleId) => {
        const puzzle = puzzleMap.get(puzzleId);
        if (puzzle) {
          puzzle.hasExplanation = status.hasExplanation;
          puzzle.totalExplanations = status.hasExplanation ? 1 : 0;
          puzzle.explanationId = status.explanationId;
          puzzle.feedbackCount = status.feedbackCount;
        }
      });

      // Process detailed explanation data with filters
      const explanationFilters = {
        modelName, saturnFilter, confidenceMin, confidenceMax,
        processingTimeMin, processingTimeMax, hasPredictions, predictionAccuracy
      };

      for (const [puzzleId, status] of explanationStatusMap) {
        if (status.hasExplanation && status.explanationId) {
          try {
            const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
            if (explanations && explanations.length > 0) {
              const puzzle = puzzleMap.get(puzzleId);
              if (puzzle) {
                const filteredExplanations = this.applyExplanationFilters(explanations, explanationFilters);
                
                if (filteredExplanations.length > 0) {
                  puzzle.explanations = filteredExplanations;
                  puzzle.totalExplanations = filteredExplanations.length;
                  puzzle.latestExplanation = filteredExplanations[0];
                  puzzle.hasExplanation = true;
                } else {
                  puzzle.explanations = [];
                  puzzle.totalExplanations = 0;
                  puzzle.latestExplanation = null;
                  puzzle.hasExplanation = false;
                }
              }
            }
          } catch (error) {
            logger.error(`Error getting explanations for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'puzzle-controller');
          }
        }
      }

      // Apply final filters and sorting
      let results = Array.from(puzzleMap.values());

      if (hasExplanation === 'true') {
        results = results.filter(puzzle => puzzle.hasExplanation);
      } else if (hasExplanation === 'false') {
        results = results.filter(puzzle => !puzzle.hasExplanation);
      }

      if (hasFeedback === 'true') {
        results = results.filter(puzzle => puzzle.feedbackCount && puzzle.feedbackCount > 0);
      } else if (hasFeedback === 'false') {
        results = results.filter(puzzle => !puzzle.feedbackCount || puzzle.feedbackCount === 0);
      }

      // Sort and paginate results
      const sortedResults = this.sortOverviewResults(results, sortBy as string, sortOrder as string);
      const finalResults = this.applyPagination(sortedResults, offset as string, limit as string);

      res.json(formatResponse.success(finalResults));

    } catch (error) {
      logger.error('Error in puzzle overview: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
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
      logger.error('Error reinitializing puzzle loader: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to reinitialize puzzle loader', 'An error occurred while reinitializing the puzzle loader'));
    }
  },

  /**
   * Get solver mode accuracy statistics for leaderboards
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStats(req: Request, res: Response) {
    try {
      const accuracyStats = await repositoryService.feedback.getAccuracyStats();
      res.json(formatResponse.success(accuracyStats));
    } catch (error) {
      logger.error('Error fetching accuracy stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch accuracy stats', 'An error occurred while fetching solver mode accuracy statistics'));
    }
  }
};
