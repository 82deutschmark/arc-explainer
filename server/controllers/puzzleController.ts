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
import { validateSolverResponse, validateSolverResponseMulti } from '../services/responseValidator.js';

export const puzzleController = {
  /**
   * Get a filtered list of puzzles
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async list(req: Request, res: Response) {
    const { maxGridSize, minGridSize, difficulty, gridSizeConsistent, prioritizeUnexplained, prioritizeExplained, source, multiTestFilter } = req.query;
    
    console.log('DEBUG: Puzzle list request with query params:', req.query);
    
    const filters: any = {};
    if (maxGridSize) filters.maxGridSize = parseInt(maxGridSize as string);
    if (minGridSize) filters.minGridSize = parseInt(minGridSize as string);
    if (difficulty) filters.difficulty = difficulty as string;
    if (gridSizeConsistent) filters.gridSizeConsistent = gridSizeConsistent === 'true';
    if (prioritizeUnexplained) filters.prioritizeUnexplained = prioritizeUnexplained === 'true';
    if (prioritizeExplained) filters.prioritizeExplained = prioritizeExplained === 'true';
    if (source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval'].includes(source as string)) filters.source = source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
    if (multiTestFilter && ['single', 'multi'].includes(multiTestFilter as string)) filters.multiTestFilter = multiTestFilter as 'single' | 'multi';
    
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
    
    console.log(`[Controller] API processing time for ${model}: ${apiProcessingTimeMs}ms`);
    
    // Log reasoning capture status
    if (result.hasReasoningLog) {
      console.log(`[Controller] Successfully captured reasoning log for ${model} (${result.reasoningLog?.length || 0} characters)`);
    }
    
    // Validate solver mode responses
    if (promptId === "solver") {
      const confidence = result.confidence || 50; // Default confidence if not provided
      const testCount = puzzle.test?.length || 0;
      
      // Check if AI provided multiple predictions (regardless of test count)
      const hasMultiplePredictions = result.multiplePredictedOutputs === true || 
                                   (Array.isArray(result.predictedOutput) && result.predictedOutput.length > 1);

      if (hasMultiplePredictions) {
        // Handle multiple predictions from AI (can happen for single or multi-test puzzles)
        const correctAnswers = testCount > 1 ? puzzle.test.map(t => t.output) : [puzzle.test[0].output];
        const multi = validateSolverResponseMulti(result, correctAnswers, promptId, confidence);

        // Attach multi-prediction validation summary and details
        result.predictedOutputGrids = multi.predictedGrids;
        result.predictedOutputGrid = null; // Multiple predictions don't use single grid field
        result.multiValidation = multi.itemResults;
        result.allPredictionsCorrect = multi.allCorrect;
        result.averagePredictionAccuracyScore = multi.averageAccuracyScore;
        
        // Store in database-compatible field names for multi-output predictions
        console.log('[CONTROLLER-DEBUG] About to store multi-prediction data:');
        console.log('  multi.predictedGrids type:', typeof multi.predictedGrids, 'isArray:', Array.isArray(multi.predictedGrids));
        console.log('  multi.predictedGrids:', multi.predictedGrids);
        console.log('  multi.itemResults type:', typeof multi.itemResults, 'isArray:', Array.isArray(multi.itemResults));
        console.log('  multi.itemResults:', multi.itemResults);
        result.multiplePredictedOutputs = multi.predictedGrids;
        result.multiTestResults = multi.itemResults;
        result.multiTestAllCorrect = multi.allCorrect;
        result.multiTestAverageAccuracy = multi.averageAccuracyScore;
        result.extractionMethod = multi.extractionMethodSummary;

        console.log(`[Controller] Solver multi-prediction: allCorrect=${multi.allCorrect}, avgScore=${(multi.averageAccuracyScore * 100).toFixed(1)}%`);
      } else {
        // Handle single prediction from AI
        const correctAnswer = puzzle.test[0].output;
        const validation = validateSolverResponse(result, correctAnswer, promptId, confidence);

        // Add validation results to response (single prediction)
        result.predictedOutputGrid = validation.predictedGrid;
        result.isPredictionCorrect = validation.isPredictionCorrect;
        result.predictionAccuracyScore = validation.predictionAccuracyScore;
        result.extractionMethod = validation.extractionMethod;

        console.log(`[Controller] Solver single-prediction: ${validation.isPredictionCorrect ? 'CORRECT' : 'INCORRECT'}, accuracy score: ${(validation.predictionAccuracyScore * 100).toFixed(1)}%`);
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
        saturnFilter,
        source,
        multiTestFilter,
        gridSizeMin,
        gridSizeMax,
        gridConsistency,
        processingTimeMin,
        processingTimeMax,
        hasPredictions,
        predictionAccuracy,
        confidenceMin, 
        confidenceMax,
        limit = 50,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      console.log('[Controller] Puzzle overview request with filters:', req.query);

      // Build filters for puzzle service
      const puzzleFilters: any = {};
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

      // Get all puzzles from the puzzle service
      const allPuzzles = await puzzleService.getPuzzleList(puzzleFilters);
      
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
      if (search && typeof search === 'string') {
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

                // Filter by Saturn status if specified
                if (saturnFilter) {
                  if (saturnFilter === 'solved') {
                    filteredExplanations = filteredExplanations.filter(exp => exp.saturnSuccess === true);
                  } else if (saturnFilter === 'failed') {
                    filteredExplanations = filteredExplanations.filter(exp => exp.saturnSuccess === false);
                  } else if (saturnFilter === 'attempted') {
                    filteredExplanations = filteredExplanations.filter(exp => exp.saturnSuccess !== undefined);
                  }
                  // saturnFilter === 'all' shows all results (no filtering)
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

                // Filter by processing time if specified
                if (processingTimeMin || processingTimeMax) {
                  filteredExplanations = filteredExplanations.filter(exp => {
                    const processingTime = exp.apiProcessingTimeMs || 0;
                    if (processingTimeMin && processingTime < parseInt(processingTimeMin as string)) return false;
                    if (processingTimeMax && processingTime > parseInt(processingTimeMax as string)) return false;
                    return true;
                  });
                }

                // Filter by has predictions if specified
                if (hasPredictions) {
                  if (hasPredictions === 'true') {
                    filteredExplanations = filteredExplanations.filter(exp => 
                      exp.predictedOutputGrid || exp.multiplePredictedOutputs
                    );
                  } else if (hasPredictions === 'false') {
                    filteredExplanations = filteredExplanations.filter(exp => 
                      !exp.predictedOutputGrid && !exp.multiplePredictedOutputs
                    );
                  }
                }

                // Filter by prediction accuracy if specified
                if (predictionAccuracy) {
                  if (predictionAccuracy === 'correct') {
                    filteredExplanations = filteredExplanations.filter(exp => 
                      exp.isPredictionCorrect === true || exp.multiTestAllCorrect === true
                    );
                  } else if (predictionAccuracy === 'incorrect') {
                    filteredExplanations = filteredExplanations.filter(exp => 
                      exp.isPredictionCorrect === false || exp.multiTestAllCorrect === false
                    );
                  }
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
  },

  /**
   * Get solver mode accuracy statistics for leaderboards
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStats(req: Request, res: Response) {
    try {
      const accuracyStats = await dbService.getAccuracyStats();
      res.json(formatResponse.success(accuracyStats));
    } catch (error) {
      console.error('[Controller] Error fetching accuracy stats:', error);
      res.status(500).json(formatResponse.error('Failed to fetch accuracy stats', 'An error occurred while fetching solver mode accuracy statistics'));
    }
  }
};
