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
        const { multiplePredictedOutputs, ...restOfExplanationData } = sourceData;

        // Simple logic: detect if we have multiple predictions
        let hasMultiplePredictions: boolean = false;
        let multiplePredictedOutputsForStorage: any = null;

        if (typeof multiplePredictedOutputs === 'boolean') {
          hasMultiplePredictions = multiplePredictedOutputs;
          multiplePredictedOutputsForStorage = null; // Boolean case, no array data
        } else if (Array.isArray(multiplePredictedOutputs)) {
          hasMultiplePredictions = multiplePredictedOutputs.length > 0;
          multiplePredictedOutputsForStorage = multiplePredictedOutputs; // Array case, store arrays
        }

        // Modern AI providers return clean camelCase field names - no mapping needed
        const explanationData = {
          patternDescription: restOfExplanationData.patternDescription ?? null,
          solvingStrategy: restOfExplanationData.solvingStrategy ?? null,
          hints: restOfExplanationData.hints ?? null,
          confidence: restOfExplanationData.confidence ?? 0,
          modelName: modelKey,
          reasoningLog: restOfExplanationData.reasoningLog ?? null,
          predictedOutputGrid: restOfExplanationData.predictedOutputGrid ?? null,
          isPredictionCorrect: restOfExplanationData.isPredictionCorrect ?? false,
          predictionAccuracyScore: restOfExplanationData.predictionAccuracyScore ?? 0,
          hasMultiplePredictions,
          multiplePredictedOutputs: multiplePredictedOutputsForStorage,
          multiTestResults: restOfExplanationData.multiTestResults ?? null,
          multiTestAllCorrect: restOfExplanationData.multiTestAllCorrect ?? false,
          multiTestAverageAccuracy: restOfExplanationData.multiTestAverageAccuracy ?? 0,
          providerRawResponse: restOfExplanationData.providerRawResponse ?? null,
          // Badge fields that were being dropped
          apiProcessingTimeMs: restOfExplanationData.actualProcessingTime ?? restOfExplanationData.apiProcessingTimeMs ?? null,
          inputTokens: restOfExplanationData.inputTokens ?? null,
          outputTokens: restOfExplanationData.outputTokens ?? null,
          reasoningTokens: restOfExplanationData.reasoningTokens ?? null,
          totalTokens: restOfExplanationData.totalTokens ?? null,
          estimatedCost: restOfExplanationData.estimatedCost ?? null,
          temperature: restOfExplanationData.temperature ?? null,
          reasoningEffort: restOfExplanationData.reasoningEffort ?? null,
          reasoningVerbosity: restOfExplanationData.reasoningVerbosity ?? null,
          reasoningSummaryType: restOfExplanationData.reasoningSummaryType ?? null,
        };

        console.log(`[SAVE-ATTEMPT] Saving explanation for model: ${modelKey} (puzzle: ${puzzleId})`);
        try {
          const explanationWithPuzzleId = {
            ...explanationData,
            puzzleId: puzzleId
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
