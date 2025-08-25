/**
 * explanationService.ts
 * 
 * Service layer for explanation-related operations.
 * This service handles retrieving and saving puzzle explanations.
 * 
 * @author Cascade
 */

import { dbService } from './dbService';
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
    const explanations = await dbService.getExplanationsForPuzzle(puzzleId);
    if (explanations === null) {
      throw new AppError(
        'Could not retrieve explanations due to a server error.',
        500, 
        'DATABASE_ERROR'
      );
    }
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
    const explanation = await dbService.getExplanationForPuzzle(puzzleId);
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
        const { multiplePredictedOutputs, multiTestPredictionGrids: sourceMultiTestPredictionGrids, ...restOfExplanationData } = sourceData;

        // Logic to handle the ambiguous 'multiplePredictedOutputs' field
        let hasMultiplePredictions: boolean = false;
        let multiplePredictedOutputsArray: any[] | null = null;
        let multiTestPredictionGrids: any[] | null = sourceMultiTestPredictionGrids ?? null;

        if (typeof multiplePredictedOutputs === 'boolean') {
          hasMultiplePredictions = multiplePredictedOutputs;
        } else if (Array.isArray(multiplePredictedOutputs)) {
          hasMultiplePredictions = multiplePredictedOutputs.length > 0;
          multiplePredictedOutputsArray = multiplePredictedOutputs;
          // Use the dedicated field if available, otherwise fallback to the legacy approach
          if (!multiTestPredictionGrids) {
            multiTestPredictionGrids = multiplePredictedOutputs;
          }
        }

        // Create a well-defined object, ensuring no 'undefined' values are passed.
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
          multiplePredictedOutputs: hasMultiplePredictions, // Option B: Always boolean
          multiTestPredictionGrids,
          multiTestResults: restOfExplanationData.multiTestResults ?? null,
          multiTestAllCorrect: restOfExplanationData.multiTestAllCorrect ?? false,
          multiTestAverageAccuracy: restOfExplanationData.multiTestAverageAccuracy ?? 0,
          providerRawResponse: restOfExplanationData.providerRawResponse ?? null,
          actualProcessingTime: restOfExplanationData.actualProcessingTime ?? null,
        };

        const explanationId = await dbService.saveExplanation(puzzleId, explanationData);
        if (explanationId) {
          savedExplanationIds.push(explanationId);
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
    const explanationId = await dbService.saveExplanation(puzzleId, {
      ...newExplanation,
      modelName,
      retryReason: userFeedback, // Store the feedback that triggered this retry
      isRetry: true // Mark as retry attempt
    });

    return {
      success: true,
      explanation: newExplanation,
      explanationId,
      message: 'New explanation generated based on user feedback'
    };
  }
};
