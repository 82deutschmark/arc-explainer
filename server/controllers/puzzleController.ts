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
import { puzzleAnalysisService } from '../services/puzzleAnalysisService';
import { puzzleFilterService } from '../services/puzzleFilterService';
import { puzzleOverviewService } from '../services/puzzleOverviewService';
import { formatResponse } from '../utils/responseFormatter';
import { repositoryService } from '../repositories/RepositoryService';
import { logger } from '../utils/logger';

export const puzzleController = {
  /**
   * Get a filtered list of puzzles
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async list(req: Request, res: Response) {
    logger.debug('Puzzle list request with query params: ' + JSON.stringify(req.query), 'puzzle-controller');
    
    const filters = puzzleFilterService.buildListFilters(req.query);
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
    const model = decodeURIComponent(encodedModel);
    
    const options = {
      temperature: req.body.temperature || 0.2,
      captureReasoning: req.body.captureReasoning !== false,
      promptId: req.body.promptId || "solver",
      customPrompt: req.body.customPrompt,
      emojiSetKey: req.body.emojiSetKey,
      omitAnswer: req.body.omitAnswer !== false,
      topP: req.body.topP,
      candidateCount: req.body.candidateCount,
      reasoningEffort: req.body.reasoningEffort,
      reasoningVerbosity: req.body.reasoningVerbosity,
      reasoningSummaryType: req.body.reasoningSummaryType,
      systemPromptMode: req.body.systemPromptMode || 'ARC',
      retryMode: req.body.retryMode || false
    };
    
    const result = await puzzleAnalysisService.analyzePuzzle(taskId, model, options);

    // Analysis complete - no database save here (follows separation of concerns)
    // Database saving is handled by separate /api/puzzle/save-explained endpoint
    // This maintains clean architecture: analyze ≠ persist
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
      const options = {
        promptId: req.body.promptId || "solver",
        customPrompt: req.body.customPrompt,
        temperature: req.body.temperature || 0.2,
        captureReasoning: req.body.captureReasoning !== false,
        emojiSetKey: req.body.emojiSetKey,
        omitAnswer: req.body.omitAnswer !== false,
        reasoningEffort: req.body.reasoningEffort,
        reasoningVerbosity: req.body.reasoningVerbosity,
        reasoningSummaryType: req.body.reasoningSummaryType,
        systemPromptMode: req.body.systemPromptMode || 'ARC'
      };

      logger.info(`Generating prompt preview for ${provider} with puzzle ${taskId}`, 'puzzle-controller');

      const previewData = await puzzleAnalysisService.generatePromptPreview(taskId, provider, options);
      res.json(formatResponse.success(previewData));
    } catch (error) {
      logger.error('Error generating prompt preview: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
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
      logger.debug('Puzzle overview request with filters: ' + JSON.stringify(req.query), 'puzzle-controller');

      const results = await puzzleOverviewService.processOverview(req.query);
      res.json(formatResponse.success(results));

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
   * Get MIXED general model statistics - combines multiple concepts!
   * 
   * ⚠️ WARNING: This endpoint returns confusing mixed data:
   * - accuracyByModel: Contains trustworthiness-filtered results (misleading name!)
   * - modelAccuracy: Contains pure accuracy percentages  
   * - Different arrays have different inclusion criteria
   * 
   * USE CASES: General dashboard overview only
   * NOT FOR: Pure accuracy analysis or pure trustworthiness analysis
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getGeneralModelStats(req: Request, res: Response) {
    try {
      const modelStats = await repositoryService.metrics.getGeneralModelStats();
      res.json(formatResponse.success(modelStats));
    } catch (error) {
      logger.error('Error fetching general model stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch general model stats', 'An error occurred while fetching general model statistics'));
    }
  },

  /**
   * Get MIXED accuracy/trustworthiness statistics - misleading endpoint!
   * 
   * ⚠️ CRITICAL WARNING: Despite the name, this does NOT return pure accuracy!
   * - accuracyByModel: Filtered by trustworthiness scores (excludes models without them)
   * - modelAccuracy: Contains actual accuracy percentages (different inclusion criteria)
   * - Methods name suggests accuracy but returns trustworthiness-filtered data
   * 
   * MISLEADING FOR: Pure puzzle-solving accuracy analysis
   * USE INSTEAD: New getPureAccuracyStats() method for true accuracy data
   * 
   * @deprecated Consider using getPureAccuracyStats() or getTrustworthinessStats()
   * @param req - Express request object
   * @param res - Express response object
   */
  async getAccuracyStats(req: Request, res: Response) {
    try {
      const accuracyStats = await repositoryService.accuracy.getPureAccuracyStats();
      res.json(formatResponse.success(accuracyStats));
    } catch (error) {
      logger.error('Error fetching accuracy stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch accuracy stats', 'An error occurred while fetching accuracy statistics'));
    }
  },

  /**
   * Get raw database statistics - infrastructure metrics
   * 
   * Provides technical database statistics about API usage, processing performance, 
   * token consumption, and cost analysis.
   * 
   * ⚠️ NOTE: avgPredictionAccuracy field contains trustworthiness data (not pure accuracy!)
   * This field measures AI confidence reliability, not puzzle-solving success rates.
   * 
   * USE CASES: Infrastructure monitoring, cost analysis, performance benchmarking
   * NOT FOR: Model comparison based on puzzle-solving correctness
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getRawStats(req: Request, res: Response) {
    try {
      const rawStats = await repositoryService.metrics.getRawDatabaseStats();
      res.json(formatResponse.success(rawStats));
    } catch (error) {
      logger.error('Error fetching raw stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch raw stats', 'An error occurred while fetching raw database statistics'));
    }
  },

  /**
   * Get trustworthiness performance statistics - AI confidence reliability analysis
   * 
   * ✅ CORRECT USAGE: This endpoint properly focuses on trustworthiness metrics.
   * Analyzes how well AI confidence claims correlate with actual performance.
   * 
   * RETURNS:
   * - trustworthinessLeaders: Models ranked by confidence reliability
   * - speedLeaders: Processing time performance with trustworthiness context
   * - efficiencyLeaders: Cost/token efficiency relative to trustworthiness
   * 
   * PRIMARY METRIC: This is the main research focus - AI reliability, not raw accuracy
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getRealPerformanceStats(req: Request, res: Response) {
    try {
      // Get trustworthiness data (no longer includes cost data due to SRP separation)
      const performanceStats = await repositoryService.trustworthiness.getRealPerformanceStats();

      // Get cost data from dedicated cost repository
      const costMap = await repositoryService.cost.getModelCostMap();

      // Combine trustworthiness data with cost data to maintain API contract
      const combinedStats = {
        ...performanceStats,
        trustworthinessLeaders: performanceStats.trustworthinessLeaders.map(leader => {
          const costData = costMap[leader.modelName];
          return {
            ...leader,
            avgCost: costData?.avgCost || 0,
            totalCost: costData?.totalCost || 0
          };
        })
      };

      res.json(formatResponse.success(combinedStats));
    } catch (error) {
      logger.error('Error fetching real performance stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch real performance stats', 'An error occurred while fetching real performance statistics'));
    }
  },

  /**
   * Get real performance stats with minimum attempts filtering
   * Enhanced version for analytics with statistical significance filtering
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getRealPerformanceStatsFiltered(req: Request, res: Response) {
    try {
      // Get min attempts from query parameter, default to 100
      const minAttempts = parseInt(req.query.minAttempts as string) || 100;

      // Validate minAttempts is reasonable (between 1 and 1000)
      if (minAttempts < 1 || minAttempts > 1000) {
        return res.status(400).json(formatResponse.error(
          'Invalid minimum attempts',
          'Minimum attempts must be between 1 and 1000'
        ));
      }

      // Get filtered trustworthiness data
      const performanceStats = await repositoryService.trustworthiness.getRealPerformanceStatsWithMinAttempts(minAttempts);

      // Get cost data from dedicated cost repository
      const costMap = await repositoryService.cost.getModelCostMap();

      // Combine trustworthiness data with cost data to maintain API contract
      const combinedStats = {
        ...performanceStats,
        trustworthinessLeaders: performanceStats.trustworthinessLeaders.map(leader => {
          const costData = costMap[leader.modelName];
          return {
            ...leader,
            avgCost: costData?.avgCost || 0,
            totalCost: costData?.totalCost || 0
          };
        }),
        // Add metadata about filtering
        _metadata: {
          minAttempts,
          filtered: true
        }
      };

      res.json(formatResponse.success(combinedStats));
    } catch (error) {
      logger.error('Error fetching filtered real performance stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch filtered real performance stats', 'An error occurred while fetching filtered real performance statistics'));
    }
  },

  /**
   * Get trustworthiness stats with minimum attempts filtering
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getTrustworthinessStatsFiltered(req: Request, res: Response) {
    try {
      // Get min attempts from query parameter, default to 100
      const minAttempts = parseInt(req.query.minAttempts as string) || 100;

      // Validate minAttempts is reasonable (between 1 and 1000)
      if (minAttempts < 1 || minAttempts > 1000) {
        return res.status(400).json(formatResponse.error(
          'Invalid minimum attempts',
          'Minimum attempts must be between 1 and 1000'
        ));
      }

      const trustworthinessStats = await repositoryService.trustworthiness.getTrustworthinessStatsWithMinAttempts(minAttempts);

      // Add metadata about filtering
      const statsWithMetadata = {
        ...trustworthinessStats,
        _metadata: {
          minAttempts,
          filtered: true
        }
      };

      res.json(formatResponse.success(statsWithMetadata));
    } catch (error) {
      logger.error('Error fetching filtered trustworthiness stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch filtered trustworthiness stats', 'An error occurred while fetching filtered trustworthiness statistics'));
    }
  },

  /**
   * Get CONFIDENCE ANALYSIS STATS - AI confidence patterns
   *
   * Analyzes AI confidence levels and patterns across different scenarios,
   * such as average confidence when predictions are correct vs. incorrect.
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getConfidenceStats(req: Request, res: Response) {
    try {
      const confidenceStats = await repositoryService.trustworthiness.getConfidenceStats();
      res.json(formatResponse.success(confidenceStats));
    } catch (error) {
      logger.error('Error fetching confidence stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch confidence stats', 'An error occurred while fetching confidence analysis statistics'));
    }
  },

  /**
   * Get worst-performing puzzles for discussion page
   * Returns puzzles with incorrect predictions, low accuracy, or negative feedback
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getWorstPerformingPuzzles(req: Request, res: Response) {
    try {
      const { 
        limit = 20, 
        sortBy = 'composite',
        minAccuracy,
        maxAccuracy,
        zeroAccuracyOnly,
        source,
        multiTestFilter,
        includeRichMetrics
      } = req.query;
      
      const limitNum = puzzleFilterService.validateLimit(limit, 20, 50);
      const sortOption = puzzleFilterService.validateWorstPuzzleSortParameters(sortBy as string);

      // Parse accuracy range parameters and new filters
      const filters = {
        minAccuracy: minAccuracy ? parseFloat(minAccuracy as string) : undefined,
        maxAccuracy: maxAccuracy ? parseFloat(maxAccuracy as string) : undefined,
        zeroAccuracyOnly: zeroAccuracyOnly === 'true',
        source: source && ['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'ARC-Heavy'].includes(source as string) 
          ? source as 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' 
          : undefined,
        multiTestFilter: multiTestFilter && ['single', 'multi'].includes(multiTestFilter as string)
          ? multiTestFilter as 'single' | 'multi'
          : undefined,
        includeRichMetrics: includeRichMetrics === 'true'
      };

      logger.debug(`Fetching worst-performing puzzles with limit: ${limitNum}, filters: ${JSON.stringify(filters)}`, 'puzzle-controller');

      const enrichedPuzzles = await puzzleOverviewService.getWorstPerformingPuzzles(limitNum, sortOption, filters);

      res.json(formatResponse.success({
        puzzles: enrichedPuzzles,
        total: enrichedPuzzles.length
      }));
    } catch (error) {
      logger.error('Error fetching worst-performing puzzles: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch worst-performing puzzles', 'An error occurred while fetching worst-performing puzzle data'));
    }
  },

  /**
   * Get puzzle statistics for the puzzle database viewer.
   * Returns a comprehensive list of ALL puzzles with their performance metrics.
   * Shows both analyzed puzzles (with performance data) and unexplored puzzles.
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async getPuzzleStats(req: Request, res: Response) {
    try {
      const { includeRichMetrics = 'true', limit = '3000' } = req.query;

      const filters = {
        includeRichMetrics: includeRichMetrics === 'true'
      };

      // Get ALL puzzles from the dataset, not just analyzed ones
      const allPuzzleStats = await puzzleOverviewService.getAllPuzzleStats(parseInt(limit as string), filters);

      res.json(formatResponse.success({
        puzzles: allPuzzleStats,
        total: allPuzzleStats.length
      }));
    } catch (error) {
      logger.error('Error fetching puzzle stats: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to fetch puzzle stats', 'An error occurred while fetching puzzle statistics'));
    }
  },

  /**
   * Analyze a list of puzzle IDs to see which models solved them
   * Based on puzzle-analysis.ts functionality but with dynamic puzzle IDs
   *
   * @param req - Express request object
   * @param res - Express response object
   */
  async analyzeList(req: Request, res: Response) {
    try {
      const { puzzleIds } = req.body;

      if (!puzzleIds || !Array.isArray(puzzleIds) || puzzleIds.length === 0) {
        return res.status(400).json(formatResponse.error(
          'Invalid puzzle IDs',
          'Request body must contain an array of puzzle IDs'
        ));
      }

      // Validate puzzle IDs are strings and reasonable length
      if (puzzleIds.length > 500) {
        return res.status(400).json(formatResponse.error(
          'Too many puzzle IDs',
          'Maximum 500 puzzle IDs allowed per request'
        ));
      }

      for (const id of puzzleIds) {
        if (typeof id !== 'string' || id.length === 0) {
          return res.status(400).json(formatResponse.error(
            'Invalid puzzle ID format',
            'All puzzle IDs must be non-empty strings'
          ));
        }
      }

      logger.debug(`Analyzing ${puzzleIds.length} puzzles for model performance`, 'puzzle-controller');

      // Get correct models for each puzzle
      const puzzleResults = [];
      for (const puzzleId of puzzleIds) {
        try {
          const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
          const correctModels = explanations
            .filter(exp => exp.isPredictionCorrect === true || exp.multiTestAllCorrect === true)
            .map(exp => exp.modelName);

          // Remove duplicates
          const uniqueCorrectModels = [...new Set(correctModels)];

          puzzleResults.push({
            puzzle_id: puzzleId,
            correct_models: uniqueCorrectModels,
            total_attempts: explanations.length
          });
        } catch (error) {
          logger.error(`Error querying puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'puzzle-controller');
          puzzleResults.push({
            puzzle_id: puzzleId,
            correct_models: [],
            total_attempts: 0
          });
        }
      }

      // Categorize puzzles by status
      const puzzleStatus = {
        solved: [] as string[],
        tested_but_not_solved: [] as string[],
        not_tested: [] as string[],
        missing_from_db: [] as string[]
      };

      // Get all unique puzzle IDs that have been tested (exist in database)
      const allTestedPuzzles = new Set<string>();
      const allSolvedPuzzles = new Set<string>();

      for (const result of puzzleResults) {
        if (result.total_attempts > 0) {
          allTestedPuzzles.add(result.puzzle_id);
          if (result.correct_models.length > 0) {
            allSolvedPuzzles.add(result.puzzle_id);
          }
        }
      }

      // Categorize each requested puzzle
      for (const puzzleId of puzzleIds) {
        if (allSolvedPuzzles.has(puzzleId)) {
          puzzleStatus.solved.push(puzzleId);
        } else if (allTestedPuzzles.has(puzzleId)) {
          puzzleStatus.tested_but_not_solved.push(puzzleId);
        } else {
          puzzleStatus.not_tested.push(puzzleId);
        }
      }

      // Generate model summary (which models solved which puzzles)
      const modelToPuzzles = new Map<string, string[]>();

      for (const result of puzzleResults) {
        if (result.correct_models.length > 0) {
          for (const model of result.correct_models) {
            if (!modelToPuzzles.has(model)) {
              modelToPuzzles.set(model, []);
            }
            modelToPuzzles.get(model)!.push(result.puzzle_id);
          }
        }
      }

      // Sort models by number of puzzles solved (descending)
      const modelSummary = Array.from(modelToPuzzles.entries())
        .map(([model, puzzles]) => ({
          modelName: model,
          solvedPuzzles: puzzles.sort(),
          solvedCount: puzzles.length
        }))
        .sort((a, b) => b.solvedCount - a.solvedCount);

      const response = {
        puzzleResults,
        puzzleStatus,
        modelSummary,
        summary: {
          totalPuzzles: puzzleIds.length,
          solvedPuzzles: puzzleStatus.solved.length,
          testedButNotSolved: puzzleStatus.tested_but_not_solved.length,
          notTested: puzzleStatus.not_tested.length,
          modelsWithSolutions: modelSummary.length
        }
      };

      res.json(formatResponse.success(response));
    } catch (error) {
      logger.error('Error analyzing puzzle list: ' + (error instanceof Error ? error.message : String(error)), 'puzzle-controller');
      res.status(500).json(formatResponse.error('Failed to analyze puzzle list', 'An error occurred while analyzing the puzzle list'));
    }
  }
};

