/**
 * researchController.ts
 * 
 * Controller for research-focused analytics endpoints.
 * Provides model discrepancy analysis, performance comparisons, and research insights.
 * Designed for researchers studying ARC puzzle solving patterns and model behaviors.
 * 
 * @author Cascade
 */

import { Request, Response } from 'express';
import { formatResponse } from '../utils/responseFormatter';
import { dbService } from '../services/dbService';
import { puzzleService } from '../services/puzzleService';

export const researchController = {
  /**
   * Get model discrepancy analysis for puzzles where different models disagree
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getModelDiscrepancies(req: Request, res: Response) {
    try {
      const { 
        minModels = 2,
        maxAgreementRate = 80,
        source,
        puzzleIds
      } = req.query;

      console.log('[Research] Getting model discrepancies with filters:', req.query);

      if (!dbService.isConnected()) {
        return res.json(formatResponse.error('Database not connected', 'Research analytics require database connection'));
      }

      // Get all puzzles with multiple explanations
      const puzzles = await puzzleService.getPuzzleList({});
      const discrepancies = [];

      for (const puzzle of puzzles) {
        // Apply source filter if specified
        if (source && puzzle.source !== source) continue;
        
        // Apply puzzle ID filter if specified
        if (puzzleIds) {
          const filterIds = Array.isArray(puzzleIds) ? puzzleIds : [puzzleIds];
          if (!filterIds.includes(puzzle.id)) continue;
        }

        try {
          const explanations = await dbService.getExplanationsForPuzzle(puzzle.id);
          if (!explanations || explanations.length < parseInt(minModels as string)) continue;

          // Filter only AI model explanations (exclude Saturn)
          const aiExplanations = explanations.filter(exp => exp.saturnSuccess === undefined);
          if (aiExplanations.length < parseInt(minModels as string)) continue;

          // Analyze model agreement for solver mode results only
          const solverResults = aiExplanations.filter(exp => 
            exp.isPredictionCorrect !== undefined && exp.predictionAccuracyScore !== undefined
          );

          if (solverResults.length >= parseInt(minModels as string)) {
            const correctCount = solverResults.filter(exp => exp.isPredictionCorrect).length;
            const agreementRate = Math.round((correctCount / solverResults.length) * 100);

            // Only include if agreement rate is below threshold
            if (agreementRate <= parseInt(maxAgreementRate as string)) {
              const modelResults = solverResults.map(exp => ({
                modelName: exp.modelName,
                correct: exp.isPredictionCorrect,
                confidence: exp.confidence || 0,
                accuracyScore: exp.predictionAccuracyScore || 0
              }));

              const confidences = modelResults.map(m => m.confidence);
              
              discrepancies.push({
                puzzleId: puzzle.id,
                source: puzzle.source,
                models: modelResults,
                agreementRate,
                correctCount,
                totalModels: solverResults.length,
                highestConfidence: Math.max(...confidences),
                lowestConfidence: Math.min(...confidences),
                avgConfidence: Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
              });
            }
          }
        } catch (error) {
          console.error(`Error analyzing discrepancies for puzzle ${puzzle.id}:`, error);
        }
      }

      // Sort by lowest agreement rate first (most controversial)
      discrepancies.sort((a, b) => a.agreementRate - b.agreementRate);

      console.log(`[Research] Found ${discrepancies.length} model discrepancies`);

      res.json(formatResponse.success({
        discrepancies,
        total: discrepancies.length,
        filters: {
          minModels: parseInt(minModels as string),
          maxAgreementRate: parseInt(maxAgreementRate as string),
          source: source || 'all'
        }
      }));
    } catch (error) {
      console.error('[Research] Error getting model discrepancies:', error);
      res.status(500).json(formatResponse.error('Failed to get model discrepancies', 'An error occurred while analyzing model disagreements'));
    }
  },

  /**
   * Get Saturn visual solver performance analytics
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getSaturnAnalytics(req: Request, res: Response) {
    try {
      const { source, limit = 50 } = req.query;

      console.log('[Research] Getting Saturn analytics with filters:', req.query);

      if (!dbService.isConnected()) {
        return res.json(formatResponse.error('Database not connected', 'Saturn analytics require database connection'));
      }

      const puzzles = await puzzleService.getPuzzleList(source ? { source: source as any } : {});
      const saturnResults = [];
      let totalAttempts = 0;
      let successCount = 0;
      let failureCount = 0;

      for (const puzzle of puzzles) {
        try {
          const explanations = await dbService.getExplanationsForPuzzle(puzzle.id);
          if (!explanations) continue;

          const saturnExplanations = explanations.filter(exp => exp.saturnSuccess !== undefined);
          
          for (const explanation of saturnExplanations) {
            totalAttempts++;
            const solved = explanation.saturnSuccess === true;
            
            if (solved) {
              successCount++;
            } else {
              failureCount++;
            }

            saturnResults.push({
              puzzleId: puzzle.id,
              source: puzzle.source,
              solved,
              createdAt: explanation.createdAt,
              modelName: explanation.modelName
            });
          }
        } catch (error) {
          console.error(`Error analyzing Saturn results for puzzle ${puzzle.id}:`, error);
        }
      }

      // Sort by creation date (newest first) and limit
      saturnResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const recentResults = saturnResults.slice(0, parseInt(limit as string));

      const successRate = totalAttempts > 0 ? Math.round((successCount / totalAttempts) * 100) : 0;

      console.log(`[Research] Saturn analytics: ${totalAttempts} attempts, ${successRate}% success rate`);

      res.json(formatResponse.success({
        totalAttempts,
        successCount,
        failureCount,
        successRate,
        recentResults,
        bySource: source ? { [source as string]: { successCount, failureCount, successRate } } : {}
      }));
    } catch (error) {
      console.error('[Research] Error getting Saturn analytics:', error);
      res.status(500).json(formatResponse.error('Failed to get Saturn analytics', 'An error occurred while analyzing Saturn solver performance'));
    }
  },

  /**
   * Get research insights and statistics for dashboard
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async getResearchInsights(req: Request, res: Response) {
    try {
      console.log('[Research] Getting research insights');

      if (!dbService.isConnected()) {
        return res.json(formatResponse.error('Database not connected', 'Research insights require database connection'));
      }

      const puzzles = await puzzleService.getPuzzleList({});
      const insights = {
        totalPuzzles: puzzles.length,
        puzzlesBySource: {} as Record<string, number>,
        puzzlesWithExplanations: 0,
        puzzlesWithSaturnResults: 0,
        overconfidentFailures: [] as Array<{
          puzzleId: string;
          source: string;
          modelName: string;
          confidence: number;
          accuracyScore: number;
        }>,
        highAgreementPuzzles: [] as Array<{
          puzzleId: string;
          source: string;
          agreementRate: number;
          modelCount: number;
        }>,
        modelPerformanceSummary: {} as Record<string, {
          totalAttempts: number;
          correctPredictions: number;
          avgConfidence: number;
        }>
      };

      // Count puzzles by source
      for (const puzzle of puzzles) {
        const source = puzzle.source || 'Unknown';
        insights.puzzlesBySource[source] = (insights.puzzlesBySource[source] || 0) + 1;
      }

      // Analyze explanations
      for (const puzzle of puzzles) {
        try {
          const explanations = await dbService.getExplanationsForPuzzle(puzzle.id);
          if (!explanations || explanations.length === 0) continue;

          insights.puzzlesWithExplanations++;

          // Check for Saturn results
          const hasSaturnResults = explanations.some(exp => exp.saturnSuccess !== undefined);
          if (hasSaturnResults) {
            insights.puzzlesWithSaturnResults++;
          }

          // Analyze AI model performance
          const aiExplanations = explanations.filter(exp => exp.saturnSuccess === undefined);
          for (const explanation of aiExplanations) {
            const modelName = explanation.modelName;
            
            if (!insights.modelPerformanceSummary[modelName]) {
              insights.modelPerformanceSummary[modelName] = {
                totalAttempts: 0,
                correctPredictions: 0,
                avgConfidence: 0
              };
            }

            const modelStats = insights.modelPerformanceSummary[modelName];
            modelStats.totalAttempts++;
            
            if (explanation.isPredictionCorrect) {
              modelStats.correctPredictions++;
            }

            // Track overconfident failures (high confidence but wrong)
            if (!explanation.isPredictionCorrect && (explanation.confidence || 0) > 80) {
              insights.overconfidentFailures.push({
                puzzleId: puzzle.id,
                source: puzzle.source || 'Unknown',
                modelName,
                confidence: explanation.confidence || 0,
                accuracyScore: explanation.predictionAccuracyScore || 0
              });
            }

            // Update average confidence
            const totalConf = modelStats.avgConfidence * (modelStats.totalAttempts - 1) + (explanation.confidence || 0);
            modelStats.avgConfidence = Math.round(totalConf / modelStats.totalAttempts);
          }

          // Check for high model agreement (for solver mode results only)
          const solverResults = aiExplanations.filter(exp => exp.isPredictionCorrect !== undefined);
          if (solverResults.length >= 3) {
            const correctCount = solverResults.filter(exp => exp.isPredictionCorrect).length;
            const agreementRate = Math.round((correctCount / solverResults.length) * 100);
            
            if (agreementRate >= 90) {
              insights.highAgreementPuzzles.push({
                puzzleId: puzzle.id,
                source: puzzle.source || 'Unknown',
                agreementRate,
                modelCount: solverResults.length
              });
            }
          }
        } catch (error) {
          console.error(`Error analyzing insights for puzzle ${puzzle.id}:`, error);
        }
      }

      // Sort overconfident failures by confidence (highest first)
      insights.overconfidentFailures.sort((a, b) => b.confidence - a.confidence);
      insights.overconfidentFailures = insights.overconfidentFailures.slice(0, 20);

      console.log(`[Research] Generated insights for ${insights.totalPuzzles} puzzles`);

      res.json(formatResponse.success(insights));
    } catch (error) {
      console.error('[Research] Error getting research insights:', error);
      res.status(500).json(formatResponse.error('Failed to get research insights', 'An error occurred while generating research insights'));
    }
  },

  /**
   * Advanced search with research-specific filters
   * 
   * @param req - Express request object
   * @param res - Express response object
   */
  async advancedSearch(req: Request, res: Response) {
    try {
      const {
        puzzleId,
        source,
        hasExplanations,
        hasSaturnResults,
        modelName,
        confidenceMin,
        confidenceMax,
        accuracyMin,
        accuracyMax,
        modelDiscrepancy,
        overconfidentFailures,
        highAgreementPuzzles,
        saturnSuccessOnly,
        saturnFailureOnly,
        maxGridSize,
        gridSizeConsistent,
        limit = 50,
        offset = 0
      } = req.query;

      console.log('[Research] Advanced search with criteria:', req.query);

      // Start with base puzzle filters
      const baseFilters: any = {};
      if (source) baseFilters.source = source;
      if (maxGridSize) baseFilters.maxGridSize = parseInt(maxGridSize as string);
      if (gridSizeConsistent !== undefined) baseFilters.gridSizeConsistent = gridSizeConsistent === 'true';

      let puzzles = await puzzleService.getPuzzleList(baseFilters);

      // Apply puzzle ID filter
      if (puzzleId) {
        puzzles = puzzles.filter(p => p.id.toLowerCase().includes((puzzleId as string).toLowerCase()));
      }

      const results = [];

      for (const puzzle of puzzles) {
        try {
          const explanations = await dbService.getExplanationsForPuzzle(puzzle.id);
          if (!explanations) {
            if (hasExplanations === 'false') {
              results.push({
                ...puzzle,
                explanations: [],
                totalExplanations: 0,
                hasExplanation: false
              });
            }
            continue;
          }

          // Apply explanation filters
          if (hasExplanations === 'true' && explanations.length === 0) continue;
          if (hasExplanations === 'false' && explanations.length > 0) continue;

          // Filter by Saturn results
          const saturnExplanations = explanations.filter(exp => exp.saturnSuccess !== undefined);
          if (hasSaturnResults === 'true' && saturnExplanations.length === 0) continue;
          if (hasSaturnResults === 'false' && saturnExplanations.length > 0) continue;

          // Apply Saturn success/failure filters
          if (saturnSuccessOnly === 'true') {
            const hasSaturnSuccess = saturnExplanations.some(exp => exp.saturnSuccess === true);
            if (!hasSaturnSuccess) continue;
          }
          if (saturnFailureOnly === 'true') {
            const hasSaturnFailure = saturnExplanations.some(exp => exp.saturnSuccess === false);
            if (!hasSaturnFailure) continue;
          }

          // Filter by model name
          let filteredExplanations = explanations;
          if (modelName) {
            const modelNames = Array.isArray(modelName) ? modelName : [modelName];
            filteredExplanations = explanations.filter(exp => modelNames.includes(exp.modelName));
            if (filteredExplanations.length === 0) continue;
          }

          // Apply confidence and accuracy filters
          if (confidenceMin || confidenceMax || accuracyMin || accuracyMax) {
            filteredExplanations = filteredExplanations.filter(exp => {
              const confidence = exp.confidence || 0;
              const accuracy = (exp.predictionAccuracyScore || 0) * 100;
              
              if (confidenceMin && confidence < parseInt(confidenceMin as string)) return false;
              if (confidenceMax && confidence > parseInt(confidenceMax as string)) return false;
              if (accuracyMin && accuracy < parseInt(accuracyMin as string)) return false;
              if (accuracyMax && accuracy > parseInt(accuracyMax as string)) return false;
              
              return true;
            });
            if (filteredExplanations.length === 0) continue;
          }

          // Apply research-specific filters
          const aiExplanations = filteredExplanations.filter(exp => exp.saturnSuccess === undefined);
          
          if (overconfidentFailures === 'true') {
            const hasOverconfidentFailure = aiExplanations.some(exp => 
              !exp.isPredictionCorrect && (exp.confidence || 0) > 80
            );
            if (!hasOverconfidentFailure) continue;
          }

          if (highAgreementPuzzles === 'true') {
            const solverResults = aiExplanations.filter(exp => exp.isPredictionCorrect !== undefined);
            if (solverResults.length >= 3) {
              const correctCount = solverResults.filter(exp => exp.isPredictionCorrect).length;
              const agreementRate = (correctCount / solverResults.length) * 100;
              if (agreementRate < 90) continue;
            } else {
              continue;
            }
          }

          if (modelDiscrepancy && modelDiscrepancy !== 'any') {
            const solverResults = aiExplanations.filter(exp => exp.isPredictionCorrect !== undefined);
            if (solverResults.length >= 2) {
              const correctCount = solverResults.filter(exp => exp.isPredictionCorrect).length;
              const agreementRate = (correctCount / solverResults.length) * 100;
              
              if (modelDiscrepancy === 'high' && agreementRate >= 50) continue;
              if (modelDiscrepancy === 'medium' && (agreementRate < 50 || agreementRate > 80)) continue;
              if (modelDiscrepancy === 'low' && agreementRate <= 80) continue;
            } else {
              continue;
            }
          }

          results.push({
            ...puzzle,
            explanations: filteredExplanations,
            totalExplanations: filteredExplanations.length,
            hasExplanation: filteredExplanations.length > 0
          });
        } catch (error) {
          console.error(`Error processing search for puzzle ${puzzle.id}:`, error);
        }
      }

      // Apply pagination
      const total = results.length;
      const paginatedResults = results.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      );

      console.log(`[Research] Advanced search found ${total} results`);

      res.json(formatResponse.success({
        puzzles: paginatedResults,
        total,
        hasMore: total > parseInt(offset as string) + parseInt(limit as string)
      }));
    } catch (error) {
      console.error('[Research] Error in advanced search:', error);
      res.status(500).json(formatResponse.error('Failed to perform advanced search', 'An error occurred while searching with research criteria'));
    }
  }
};
