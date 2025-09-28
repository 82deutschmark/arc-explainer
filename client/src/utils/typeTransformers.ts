/**
 * Type transformation utilities
 * Converts between database snake_case and frontend camelCase naming conventions
 */

import type { DatabaseExplanation, ExplanationRecord } from '@shared/types';

/**
 * Transform database explanation to frontend-friendly format
 */
export function transformExplanation(dbExplanation: DatabaseExplanation): ExplanationRecord {
  return {
    id: dbExplanation.id,
    puzzleId: dbExplanation.puzzle_id,
    patternDescription: dbExplanation.pattern_description,
    solvingStrategy: dbExplanation.solving_strategy,
    hints: dbExplanation.hints,
    confidence: dbExplanation.confidence,
    alienMeaningConfidence: dbExplanation.alien_meaning_confidence,
    alienMeaning: dbExplanation.alien_meaning,
    modelName: dbExplanation.model_name,
    reasoningLog: dbExplanation.reasoning_log,
    hasReasoningLog: dbExplanation.has_reasoning_log,
    providerResponseId: dbExplanation.provider_response_id,
    apiProcessingTimeMs: dbExplanation.api_processing_time_ms,
    saturnImages: dbExplanation.saturn_images,
    saturnLog: dbExplanation.saturn_log,
    saturnEvents: dbExplanation.saturn_events,
    saturnSuccess: dbExplanation.saturn_success,
    predictedOutputGrid: dbExplanation.predicted_output_grid,
    isPredictionCorrect: dbExplanation.is_prediction_correct,
    predictionAccuracyScore: dbExplanation.trustworthiness_score,
    providerRawResponse: dbExplanation.provider_raw_response,
    reasoningItems: dbExplanation.reasoning_items,
    temperature: dbExplanation.temperature,
    reasoningEffort: dbExplanation.reasoning_effort,
    reasoningVerbosity: dbExplanation.reasoning_verbosity,
    reasoningSummaryType: dbExplanation.reasoning_summary_type,
    inputTokens: dbExplanation.input_tokens,
    outputTokens: dbExplanation.output_tokens,
    reasoningTokens: dbExplanation.reasoning_tokens,
    totalTokens: dbExplanation.total_tokens,
    estimatedCost: dbExplanation.estimated_cost,
    multiplePredictedOutputs: dbExplanation.multiple_predicted_outputs,
    multiTestResults: dbExplanation.multi_test_results,
    multiTestAllCorrect: dbExplanation.multi_test_all_correct,
    multiTestAverageAccuracy: dbExplanation.multi_test_average_accuracy,
    hasMultiplePredictions: dbExplanation.has_multiple_predictions,
    multiTestPredictionGrids: dbExplanation.multi_test_prediction_grids,
    createdAt: dbExplanation.created_at,
    status: dbExplanation.status,
  };
}

/**
 * Transform array of database explanations
 */
export function transformExplanations(dbExplanations: DatabaseExplanation[]): ExplanationRecord[] {
  return dbExplanations.map(transformExplanation);
}

/**
 * Format cost as currency string
 */
export function formatCost(cost: number | null): string {
  if (cost === null || cost === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
  }).format(cost);
}

/**
 * Format processing time in milliseconds to readable format
 */
export function formatProcessingTime(timeMs: number | null): string {
  if (timeMs === null || timeMs === undefined) return 'N/A';
  
  if (timeMs < 1000) {
    return `${timeMs}ms`;
  } else if (timeMs < 60000) {
    return `${(timeMs / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(timeMs / 60000);
    const seconds = ((timeMs % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format token counts with commas
 */
export function formatTokenCount(tokens: number | null): string {
  if (tokens === null || tokens === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(tokens);
}

/**
 * Get confidence color class based on confidence value
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'bg-green-100 text-green-800';
  if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
  if (confidence >= 40) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Get accuracy color class based on accuracy score
 */
export function getAccuracyColor(accuracy: number | null): string {
  if (accuracy === null || accuracy === undefined) return 'bg-gray-100 text-gray-800';
  if (accuracy >= 0.9) return 'bg-green-100 text-green-800';
  if (accuracy >= 0.7) return 'bg-yellow-100 text-yellow-800';
  if (accuracy >= 0.5) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

/**
 * Calculate efficiency score (tokens per dollar)
 */
export function calculateTokenEfficiency(tokens: number | null, cost: number | null): number | null {
  if (!tokens || !cost || cost === 0) return null;
  return tokens / cost;
}

/**
 * Get reasoning effort display text
 */
export function getReasoningEffortDisplay(effort: string | null): string {
  if (!effort) return 'N/A';
  return effort.charAt(0).toUpperCase() + effort.slice(1).toLowerCase();
}

/**
 * Get temperature display with color coding
 */
export function getTemperatureDisplay(temperature: number | null): { text: string; colorClass: string } {
  if (temperature === null || temperature === undefined) {
    return { text: 'N/A', colorClass: 'bg-gray-100 text-gray-800' };
  }
  
  let colorClass: string;
  if (temperature === 0) colorClass = 'bg-blue-100 text-blue-800';
  else if (temperature <= 0.3) colorClass = 'bg-green-100 text-green-800';
  else if (temperature <= 0.7) colorClass = 'bg-yellow-100 text-yellow-800';
  else colorClass = 'bg-red-100 text-red-800';
  
  return { 
    text: temperature.toFixed(1), 
    colorClass 
  };
}