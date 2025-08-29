/**
 * explanationService.ts
 * 
 * Service layer for explanation-related operations.
 * This service handles retrieving and saving puzzle explanations.
 * 
 * @author Cascade
 */

import { repositoryService } from '../repositories/RepositoryService';
import { AppError } from '../middleware/errorHandler';

export const explanationService = {
  /**
   * Get all explanations for a specific puzzle
   * 
   * @param puzzleId - The ID of the puzzle to get explanations for
   * @returns Array of explanations for the puzzle
   * @throws AppError if explanations cannot be retrieved
   */
  async getExplanationsForPuzzle(puzzleId: string) {
    const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
    // Let controller handle null case - don't throw here
    return explanations;
  },

  /**
   * Get a single explanation for a specific puzzle
   * 
   * @param puzzleId - The ID of the puzzle to get the explanation for
   * @returns The explanation object or null if not found
   * @throws AppError if explanation cannot be retrieved
   */
  async getExplanationForPuzzle(puzzleId: string) {
    const explanation = await repositoryService.explanations.getExplanationForPuzzle(puzzleId);
    if (explanation === null) {
      return null; // No explanation found is not an error
    }
    return explanation;
  },

  /**
   * Save an explanation for a puzzle
   * 
   * @param puzzleId - The ID of the puzzle
   * @param explanations - The explanations to save
   * @returns Object with filepath and explanationId
   * @throws AppError if puzzle not found or explanation cannot be saved
   */
  async saveExplanation(puzzleId: string, explanations: Record<string, any>) {
    // First, get the puzzle to validate it exists
    const { puzzleLoader } = await import('./puzzleLoader');
    const task = await puzzleLoader.loadPuzzle(puzzleId);
    
    if (!task) {
      throw new AppError('Puzzle not found', 404, 'PUZZLE_NOT_FOUND');
    }

    if (!explanations || Object.keys(explanations).length === 0) {
      throw new AppError('No explanations provided', 400, 'VALIDATION_ERROR');
    }

    // Save to file system for backward compatibility
    const { puzzleExporter } = await import('./puzzleExporter');
    const filepath = await puzzleExporter.saveExplainedPuzzle(puzzleId, task, explanations);
    
    // Save each explanation to the database
    const savedExplanationIds: number[] = [];
    for (const modelKey in explanations) {
      if (Object.prototype.hasOwnProperty.call(explanations, modelKey)) {
        const sourceData = explanations[modelKey];

        // Handle nested result structure from OpenRouter services
        // OpenRouter models return: { result: { solvingStrategy, patternDescription, ... }, tokenUsage, cost, ... }
        const analysisData = sourceData.result || sourceData;
        
        // Collect multiple prediction grids from various sources
        let collectedGrids: any[] = [];
        
        // 1. From individual predictedOutput1, predictedOutput2, predictedOutput3 fields (new format)
        let i = 1;
        while (sourceData[`predictedOutput${i}`] || analysisData[`predictedOutput${i}`]) {
          const grid = sourceData[`predictedOutput${i}`] || analysisData[`predictedOutput${i}`];
          if (grid && Array.isArray(grid)) {
            collectedGrids.push(grid);
          }
          i++;
        }
        
        // 2. From multiplePredictedOutputs array (if it exists as array)
        if (Array.isArray(sourceData.multiplePredictedOutputs)) {
          collectedGrids.push(...sourceData.multiplePredictedOutputs);
        } else if (Array.isArray(analysisData.multiplePredictedOutputs)) {
          collectedGrids.push(...analysisData.multiplePredictedOutputs);
        }
        
        // 3. From multi-test results (different test cases, not multiple predictions per test)
        if (Array.isArray(analysisData.multiTestResults)) {
          const testGrids = analysisData.multiTestResults.map((result: any) => result.predictedOutput).filter(Boolean);
          if (testGrids.length > 0 && collectedGrids.length === 0) {
            // Only use test results if we didn't find prediction grids above
            collectedGrids = testGrids;
          }
        }

        const hasMultiplePredictions = collectedGrids.length > 0;
        const multiplePredictedOutputsForStorage = hasMultiplePredictions ? collectedGrids : null;

        const tokenUsage = sourceData.tokenUsage;
        const costData = sourceData.cost;

        // Handle both flat and nested response structures
        const explanationData = {
          pattern_description: analysisData.patternDescription ?? null,
          solving_strategy: analysisData.solvingStrategy ?? null,
          hints: analysisData.hints ?? null,
          confidence: analysisData.confidence ?? 50,
          model_name: sourceData.modelName ?? modelKey,
          reasoning_items: sourceData.reasoningItems ?? analysisData.reasoningItems ?? analysisData.reasoningLog ?? null,
          reasoning_log: null,
          predicted_output_grid: sourceData.predictedOutputGrid ?? analysisData.predictedOutputGrid ?? analysisData.predictedOutput ?? null,
          is_prediction_correct: sourceData.isPredictionCorrect ?? analysisData.isPredictionCorrect ?? false,
          prediction_accuracy_score: sourceData.predictionAccuracyScore ?? analysisData.predictionAccuracyScore ?? 0,
          has_multiple_predictions: hasMultiplePredictions,
          multiple_predicted_outputs: multiplePredictedOutputsForStorage,
          multi_test_results: sourceData.multiTestResults ?? analysisData.multiTestResults ?? null,
          multi_test_all_correct: sourceData.multiTestAllCorrect ?? analysisData.multiTestAllCorrect ?? false,
          multi_test_average_accuracy: sourceData.multiTestAverageAccuracy ?? analysisData.multiTestAverageAccuracy ?? 0,
          provider_raw_response: sourceData.providerRawResponse ?? null,
          api_processing_time_ms: sourceData.actualProcessingTime ?? sourceData.apiProcessingTimeMs ?? null,
          input_tokens: tokenUsage?.input ?? sourceData.inputTokens ?? null,
          output_tokens: tokenUsage?.output ?? sourceData.outputTokens ?? null,
          reasoning_tokens: tokenUsage?.reasoning ?? sourceData.reasoningTokens ?? null,
          total_tokens: (tokenUsage?.input && tokenUsage?.output) ? (tokenUsage.input + tokenUsage.output + (tokenUsage.reasoning || 0)) : sourceData.totalTokens ?? null,
          estimated_cost: costData?.total ?? sourceData.estimatedCost ?? null,
          temperature: sourceData.temperature ?? null,
          reasoning_effort: sourceData.reasoningEffort ?? null,
          reasoning_verbosity: sourceData.reasoningVerbosity ?? null,
          reasoning_summary_type: sourceData.reasoningSummaryType ?? null,
        };

        console.log(`[SAVE-ATTEMPT] Saving explanation for model: ${modelKey} (puzzle: ${puzzleId})`);
        try {
          const explanationWithPuzzleId = {
            ...explanationData,
            puzzle_id: puzzleId
          };
          const savedExplanation = await repositoryService.explanations.saveExplanation(explanationWithPuzzleId);
          if (savedExplanation && savedExplanation.id) {
            console.log(`[SAVE-SUCCESS] Model ${modelKey} saved successfully (puzzle: ${puzzleId}, ID: ${savedExplanation.id})`);
            savedExplanationIds.push(savedExplanation.id);
          } else {
            const errorMsg = `Database save returned null for model ${modelKey} (puzzle: ${puzzleId}) - likely validation or JSON serialization failure`;
            console.error(`[SAVE-CRITICAL-ERROR] ${errorMsg}`);
            throw new Error(errorMsg);
          }
        } catch (error) {
          const errorMsg = `CRITICAL: Failed to save explanation for model ${modelKey} (puzzle: ${puzzleId}): ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[SAVE-CRITICAL-ERROR] ${errorMsg}`);
          // Log the full explanation data for debugging
          console.error(`[SAVE-DEBUG-DATA] Explanation data that failed:`, JSON.stringify(explanationData, null, 2));
          throw error; // Don't continue silently - this masks real issues
        }
      }
    }

    return { 
      success: true, 
      message: `Saved ${savedExplanationIds.length} explanations. Puzzle saved as ${puzzleId}-EXPLAINED.json`,
      filepath,
      explanationIds: savedExplanationIds
    };
  },

  /**
   * Retry analysis for a puzzle with user feedback as guidance
   * 
   * @param puzzleId - The ID of the puzzle to retry analysis for
   * @param modelName - The AI model to use for retry
   * @param userFeedback - The user's feedback to guide improvement
   * @returns The new explanation data
   */
  async retryAnalysis(puzzleId: string, modelName: string, userFeedback: string) {
    const { puzzleLoader } = await import('./puzzleLoader');
    const { aiServiceFactory } = await import('./aiServiceFactory');
    
    const task = await puzzleLoader.loadPuzzle(puzzleId);
    if (!task) {
      throw new AppError('Puzzle not found', 404, 'PUZZLE_NOT_FOUND');
    }

    const aiService = aiServiceFactory.getService(modelName);
    if (!aiService) {
      throw new AppError(`AI service not found for model: ${modelName}`, 404, 'AI_SERVICE_NOT_FOUND');
    }

    console.log(`[RetryAnalysis] Using ${modelName} with user feedback: "${userFeedback.substring(0, 50)}${userFeedback.length > 50 ? '...' : ''}"`)

    // The user feedback needs to be incorporated into the analysis
    // But we can't modify the service interfaces directly
    // Create a modified task with the feedback as a "hint" property
    // This will be accessible to the AI service without changing its interface
    const enhancedTask = {
      ...task,
      // Add a special hint property that services can check for
      hint: `User feedback on previous explanation: "${userFeedback}"
Please focus on clarity, accuracy, and addressing this specific feedback in your new explanation.`
    };

    // Generate new explanation with feedback guidance
    // Let the service use its default temperature setting
    const newExplanation = await aiService.analyzePuzzleWithModel(
      enhancedTask, 
      modelName as any,  // Cast to any to handle different model key types
      undefined, // Let service use default temperature 
      true // Always capture reasoning if available
    ).catch((error: Error) => {
      console.error(`[RetryAnalysis] Error analyzing with ${modelName}:`, error);
      return null;
    });
    
    if (!newExplanation) {
      throw new AppError('Failed to generate improved explanation', 500, 'AI_ANALYSIS_FAILED');
    }

    // Save the new explanation as a separate attempt
    const explanationData = {
      puzzleId: puzzleId,
      ...newExplanation,
      modelName,
      retryReason: userFeedback, // Store the feedback that triggered this retry
      isRetry: true // Mark as retry attempt
    };
    const savedExplanation = await repositoryService.explanations.saveExplanation(explanationData);
    const explanationId = savedExplanation.id;

    return {
      success: true,
      explanation: newExplanation,
      explanationId,
      message: 'New explanation generated based on user feedback'
    };
  }
};
