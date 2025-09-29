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
import * as fs from 'fs/promises';
import * as path from 'path';

function transformRawExplanation(sourceData: any, modelKey: string) {
  const analysisData = sourceData.result || sourceData;
  const hasMultiplePredictions = analysisData.hasMultiplePredictions || false;

  const multiplePredictedOutputsForStorage = hasMultiplePredictions
    ? (analysisData.multiplePredictedOutputs || null)
    : null;

  const tokenUsage = analysisData.tokenUsage || sourceData.tokenUsage;
  const costData = analysisData.cost || sourceData.cost;

  let finalReasoningItems = null;
  if (analysisData.reasoningItems && Array.isArray(analysisData.reasoningItems) && analysisData.reasoningItems.length > 0) {
    finalReasoningItems = analysisData.reasoningItems;
  } else if (sourceData.reasoningItems && Array.isArray(sourceData.reasoningItems) && sourceData.reasoningItems.length > 0) {
    finalReasoningItems = sourceData.reasoningItems;
  } else if (analysisData.reasoningLog && Array.isArray(analysisData.reasoningLog) && analysisData.reasoningLog.length > 0) {
    finalReasoningItems = analysisData.reasoningLog;
  }

  let finalReasoningLog = null;
  if (analysisData.reasoningLog && typeof analysisData.reasoningLog === 'string') {
    finalReasoningLog = analysisData.reasoningLog;
  } else if (sourceData.reasoningLog && typeof sourceData.reasoningLog === 'string') {
    finalReasoningLog = sourceData.reasoningLog;
  }

  return {
    patternDescription: analysisData.patternDescription ?? null,
    solvingStrategy: analysisData.solvingStrategy ?? null,
    hints: Array.isArray(analysisData.hints)
      ? analysisData.hints.map((hint: any) =>
          typeof hint === 'object' ? hint.algorithm || hint.description || String(hint)
          : String(hint)
        )
      : null,
    confidence: analysisData.confidence ?? 50,
    modelName: sourceData.modelName ?? modelKey,
    reasoningItems: finalReasoningItems,
    reasoningLog: finalReasoningLog,
    predictedOutputGrid: analysisData.predictedOutputGrid ?? null,
    isPredictionCorrect: analysisData.isPredictionCorrect ?? false,
    predictionAccuracyScore: analysisData.predictionAccuracyScore ?? 0,
    hasMultiplePredictions: hasMultiplePredictions,
    multiplePredictedOutputs: multiplePredictedOutputsForStorage,
    multiTestResults: analysisData.multiTestResults ?? null,
    multiTestAllCorrect: analysisData.multiTestAllCorrect ?? null,
    multiTestAverageAccuracy: analysisData.multiTestAverageAccuracy ?? null,
    multiTestPredictionGrids: analysisData.multiTestPredictionGrids ?? null,
    providerRawResponse: analysisData._parsingFailed ? analysisData._rawResponse : (analysisData.providerRawResponse ?? sourceData.providerRawResponse ?? null),
    apiProcessingTimeMs: analysisData.actualProcessingTime ?? analysisData.apiProcessingTimeMs ?? sourceData.apiProcessingTimeMs ?? null,
    inputTokens: tokenUsage?.input ?? analysisData.inputTokens ?? null,
    outputTokens: tokenUsage?.output ?? analysisData.outputTokens ?? null,
    reasoningTokens: tokenUsage?.reasoning ?? analysisData.reasoningTokens ?? null,
    totalTokens: (tokenUsage?.input && tokenUsage?.output) ? (tokenUsage.input + tokenUsage.output + (tokenUsage.reasoning || 0)) : (analysisData.totalTokens ?? null),
    estimatedCost: costData?.total ?? analysisData.estimatedCost ?? null,
    temperature: analysisData.temperature ?? sourceData.temperature ?? null,
    reasoningEffort: analysisData.reasoningEffort ?? sourceData.reasoningEffort ?? null,
    reasoningVerbosity: analysisData.reasoningVerbosity ?? sourceData.reasoningVerbosity ?? null,
    reasoningSummaryType: analysisData.reasoningSummaryType ?? sourceData.reasoningSummaryType ?? null,
    systemPromptUsed: analysisData.systemPromptUsed ?? sourceData.systemPromptUsed ?? null,
    userPromptUsed: analysisData.userPromptUsed ?? sourceData.userPromptUsed ?? null,
    promptTemplateId: analysisData.promptTemplateId ?? sourceData.promptTemplateId ?? null,
    customPromptText: analysisData.customPromptText ?? sourceData.customPromptText ?? null,
  };
}

export const explanationService = {
  transformRawExplanation, // Export for use in other services

  /**
   * Get all explanations for a specific puzzle
   *
   * @param puzzleId - The ID of the puzzle to get explanations for
   * @param correctnessFilter - Optional filter: 'all', 'correct', or 'incorrect'
   * @returns Array of explanations for the puzzle
   * @throws AppError if explanations cannot be retrieved
   */
  async getExplanationsForPuzzle(puzzleId: string, correctnessFilter?: 'all' | 'correct' | 'incorrect') {
    const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId, correctnessFilter);
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


        const explanationData = transformRawExplanation(sourceData, modelKey);

        // CRITICAL DEBUG: Log multi-test data before saving to track data loss
        if (explanationData.hasMultiplePredictions) {
          console.log(`[MULTI-TEST-DEBUG] hasMultiplePredictions: ${explanationData.hasMultiplePredictions}`);
          console.log(`[MULTI-TEST-DEBUG] multiplePredictedOutputs type: ${typeof explanationData.multiplePredictedOutputs}`);
          console.log(`[MULTI-TEST-DEBUG] multiplePredictedOutputs length: ${Array.isArray(explanationData.multiplePredictedOutputs) ? explanationData.multiplePredictedOutputs.length : 'not-array'}`);
          console.log(`[MULTI-TEST-DEBUG] multiTestResults: ${explanationData.multiTestResults ? 'present' : 'missing'}`);
        }

        console.log(`[SAVE-ATTEMPT] Saving explanation for model: ${modelKey} (puzzle: ${puzzleId})`);


        try {
          const explanationWithPuzzleId = {
            ...explanationData,
            puzzleId: puzzleId
          };
          const savedExplanation = await repositoryService.explanations.saveExplanation(explanationWithPuzzleId);
          if (savedExplanation && savedExplanation.id) {
            console.log(`[SAVE-SUCCESS] Model ${modelKey} explanation saved (ID: ${savedExplanation.id})`);
            savedExplanationIds.push(savedExplanation.id);
          } else {
            const errorMsg = `Database save returned null for model ${modelKey} (puzzle: ${puzzleId}) - likely validation or JSON serialization failure`;
            console.error(`[SAVE-CRITICAL-ERROR] ${errorMsg}`);
            throw new Error(errorMsg);
          }
        } catch (error) {
          console.error(`[SAVE-CRITICAL-ERROR] Database save failed for model ${modelKey} (puzzle: ${puzzleId})`);
          console.error(`[SAVE-CRITICAL-ERROR] Error type: ${error?.constructor?.name || 'Unknown'}`);
          console.error(`[SAVE-CRITICAL-ERROR] Error message: ${error instanceof Error ? error.message : String(error)}`);
          console.error(`[SAVE-CRITICAL-ERROR] Full error:`, error);
          if (error instanceof Error && error.stack) {
            console.error(`[SAVE-CRITICAL-ERROR] Stack trace:`, error.stack);
          }
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
      true, // Always capture reasoning if available
      undefined, // promptId - use default
      undefined, // customPrompt
      undefined, // options
      undefined, // serviceOpts
      puzzleId
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
