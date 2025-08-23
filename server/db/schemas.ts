/**
 * Database Schema Definitions and Validation
 * 
 * Comprehensive Zod schemas for all database entities to ensure type safety
 * and eliminate the dangerous `any` types throughout the codebase.
 * 
 * Features:
 * - Type-safe row parsing and validation
 * - DTO transformation layer for API responses  
 * - Input validation for database operations
 * - Confidence normalization for AI model compatibility
 * 
 * @author Claude Code Assistant  
 * @date August 23, 2025
 */

import { z } from 'zod';

/**
 * Normalize confidence values to integers 0-100
 * Handles decimal (0-1) and percentage (0-100) formats from different AI models
 */
export const normalizeConfidence = (confidence: any): number => {
  if (typeof confidence === 'number') {
    // Handle decimal confidence (0.25 -> 25) from models like o3
    const normalized = confidence <= 1 ? confidence * 100 : confidence;
    return Math.round(Math.max(0, Math.min(100, normalized)));
  }
  
  if (typeof confidence === 'string') {
    const parsed = parseFloat(confidence);
    if (!isNaN(parsed)) {
      const normalized = parsed <= 1 ? parsed * 100 : parsed;
      return Math.round(Math.max(0, Math.min(100, normalized)));
    }
  }
  
  return 50; // Default fallback
};

/**
 * Custom Zod schema for confidence validation with normalization
 */
const confidenceSchema = z.any().transform(normalizeConfidence);

/**
 * Database row schema for explanations table
 */
export const ExplanationRowSchema = z.object({
  id: z.number().int(),
  puzzle_id: z.string().min(1),
  model_name: z.string().default('unknown'),
  pattern_description: z.string(),
  solving_strategy: z.string(),
  confidence: z.number().int().min(0).max(100),
  hints: z.array(z.string()).default([]),
  alien_meaning: z.string().nullable().optional(),
  alien_meaning_confidence: z.number().int().min(0).max(100).nullable().optional(),
  
  // AI provider fields
  provider_response_id: z.string().nullable().optional(),
  provider_raw_response: z.record(z.unknown()).nullable().optional(),
  reasoning_items: z.union([
    z.array(z.string()),
    z.array(z.record(z.unknown())),
    z.null()
  ]).optional(),
  
  // Performance metrics - stored as BIGINT in DB but handled as number in app
  api_processing_time_ms: z.number().int().min(0).default(0),
  input_tokens: z.number().int().min(0).nullable().optional(),
  output_tokens: z.number().int().min(0).nullable().optional(),
  reasoning_tokens: z.union([z.number().int().min(0), z.null()]).optional(),
  total_tokens: z.number().int().min(0).nullable().optional(),
  estimated_cost: z.number().min(0).nullable().optional(),
  
  // AI model parameters
  temperature: z.union([z.number().min(0).max(2), z.null()]).optional(),
  reasoning_effort: z.union([z.string(), z.null()]).optional(),
  reasoning_verbosity: z.union([z.string(), z.null()]).optional(),
  reasoning_summary_type: z.union([z.string(), z.null()]).optional(),
  
  // Saturn solver fields
  saturn_images: z.array(z.string()).nullable().optional(),
  saturn_log: z.string().nullable().optional(),
  saturn_events: z.string().nullable().optional(),  
  saturn_success: z.boolean().nullable().optional(),
  
  // Solver mode fields
  predicted_output_grid: z.array(z.array(z.number())).nullable().optional(),
  is_prediction_correct: z.boolean().nullable().optional(),
  prediction_accuracy_score: z.number().min(0).max(1).nullable().optional(),
  
  // Timestamps
  created_at: z.date(),
  updated_at: z.date().nullable().optional()
});

export type ExplanationRow = z.infer<typeof ExplanationRowSchema>;

/**
 * Input schema for creating new explanations
 */
export const CreateExplanationSchema = z.object({
  puzzleId: z.string().min(1),
  modelName: z.string().default('unknown'),
  patternDescription: z.string().min(1),
  solvingStrategy: z.string().min(1),
  confidence: confidenceSchema,
  hints: z.array(z.string()).default([]),
  alienMeaning: z.string().optional(),
  alienMeaningConfidence: confidenceSchema.optional(),
  
  // AI provider data
  providerResponseId: z.string().optional(),
  providerRawResponse: z.record(z.unknown()).optional(),
  reasoningItems: z.union([
    z.array(z.string()),
    z.array(z.record(z.unknown())), 
    z.null()
  ]).optional(),
  
  // Performance metrics
  apiProcessingTimeMs: z.number().int().min(0).default(0),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  reasoningTokens: z.any().optional(),
  totalTokens: z.number().int().min(0).optional(),
  estimatedCost: z.number().min(0).optional(),
  
  // AI model parameters
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.any().optional(),
  reasoningVerbosity: z.any().optional(),
  reasoningSummaryType: z.any().optional(),
  
  // Saturn solver data
  saturnImages: z.array(z.string()).optional(),
  saturnLog: z.string().optional(),
  saturnEvents: z.string().optional(),
  saturnSuccess: z.boolean().optional(),
  
  // Solver mode data
  predictedOutputGrid: z.array(z.array(z.number())).optional(),
  isPredictionCorrect: z.boolean().optional(),
  predictionAccuracyScore: z.number().min(0).max(1).optional()
});

export type CreateExplanationData = z.infer<typeof CreateExplanationSchema>;

/**
 * DTO schema for API responses (camelCase)
 */
export const ExplanationDTOSchema = z.object({
  id: z.number(),
  puzzleId: z.string(),
  modelName: z.string(),
  patternDescription: z.string(),
  solvingStrategy: z.string(),
  confidence: z.number(),
  hints: z.array(z.string()),
  alienMeaning: z.string().optional(),
  alienMeaningConfidence: z.number().optional(),
  
  // AI provider data
  providerResponseId: z.string().optional(),
  hasRawResponse: z.boolean().default(false),
  reasoningItems: z.array(z.record(z.unknown())).optional(),
  
  // Performance metrics
  apiProcessingTimeMs: z.number(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  reasoningTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  estimatedCost: z.number().optional(),
  
  // Saturn solver data
  saturnImages: z.array(z.string()).optional(),
  saturnSuccess: z.boolean().optional(),
  
  // Solver mode data
  predictedOutputGrid: z.array(z.array(z.number())).optional(),
  isPredictionCorrect: z.boolean().optional(),
  predictionAccuracyScore: z.number().optional(),
  
  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date().optional()
});

export type ExplanationDTO = z.infer<typeof ExplanationDTOSchema>;

/**
 * Database row schema for feedback table
 */
export const FeedbackRowSchema = z.object({
  id: z.number().int(),
  explanation_id: z.number().int(),
  vote_type: z.enum(['helpful', 'not_helpful']),
  comment: z.string(),
  created_at: z.date()
});

export type FeedbackRow = z.infer<typeof FeedbackRowSchema>;

/**
 * Input schema for creating feedback
 */
export const CreateFeedbackSchema = z.object({
  explanationId: z.number().int(),
  voteType: z.enum(['helpful', 'not_helpful']),
  comment: z.string().min(1).max(1000)
});

export type CreateFeedbackData = z.infer<typeof CreateFeedbackSchema>;

/**
 * DTO schema for feedback responses
 */
export const FeedbackDTOSchema = z.object({
  id: z.number(),
  explanationId: z.number(),
  voteType: z.enum(['helpful', 'not_helpful']),
  comment: z.string(),
  createdAt: z.date()
});

export type FeedbackDTO = z.infer<typeof FeedbackDTOSchema>;

/**
 * Schema for explanations with aggregated feedback counts
 */
export const ExplanationWithFeedbackSchema = ExplanationRowSchema.extend({
  helpful_count: z.number().int().default(0),
  not_helpful_count: z.number().int().default(0),
  total_feedback: z.number().int().default(0)
});

export type ExplanationWithFeedback = z.infer<typeof ExplanationWithFeedbackSchema>;

/**
 * Database row schema for saturn_log table
 */
export const SaturnLogRowSchema = z.object({
  id: z.number().int(),
  request_id: z.string(),
  explanation_id: z.number().int().nullable().optional(),
  created_at: z.date(),
  updated_at: z.date(),
  status: z.enum(['running', 'completed', 'failed']),
  total_events: z.number().int().default(0),
  session_data: z.record(z.unknown()).nullable().optional()
});

export type SaturnLogRow = z.infer<typeof SaturnLogRowSchema>;

/**
 * Database row schema for saturn_events table
 */
export const SaturnEventRowSchema = z.object({
  id: z.number().int(),
  saturn_log_id: z.number().int(),
  event_type: z.string(),
  timestamp: z.date(),
  provider: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  phase: z.string().nullable().optional(),
  request_id: z.string().nullable().optional(),
  data: z.record(z.unknown()).nullable().optional()
});

export type SaturnEventRow = z.infer<typeof SaturnEventRowSchema>;

/**
 * Schema for batch run data
 */
export const BatchRunRowSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().optional(),
  created_at: z.date(),
  completed_at: z.date().nullable().optional(),
  status: z.enum(['running', 'completed', 'failed']),
  total_puzzles: z.number().int().default(0),
  processed_puzzles: z.number().int().default(0),
  successful_puzzles: z.number().int().default(0),
  total_processing_time_ms: z.number().int().default(0),
  configuration: z.record(z.unknown()).nullable().optional()
});

export type BatchRunRow = z.infer<typeof BatchRunRowSchema>;

/**
 * Transform database row to API DTO
 */
export function toExplanationDTO(row: ExplanationRow): ExplanationDTO {
  return {
    id: row.id,
    puzzleId: row.puzzle_id,
    modelName: row.model_name,
    patternDescription: row.pattern_description,
    solvingStrategy: row.solving_strategy,
    confidence: row.confidence,
    hints: row.hints,
    alienMeaning: row.alien_meaning ?? undefined,
    alienMeaningConfidence: row.alien_meaning_confidence ?? undefined,
    
    providerResponseId: row.provider_response_id ?? undefined,
    hasRawResponse: !!row.provider_raw_response,
    reasoningItems: (row.reasoning_items as Record<string, unknown>[] | undefined) ?? undefined,
    
    apiProcessingTimeMs: row.api_processing_time_ms,
    inputTokens: row.input_tokens ?? undefined,
    outputTokens: row.output_tokens ?? undefined,
    reasoningTokens: row.reasoning_tokens ?? undefined,
    totalTokens: row.total_tokens ?? undefined,
    estimatedCost: row.estimated_cost ?? undefined,
    
    saturnImages: row.saturn_images ?? undefined,
    saturnSuccess: row.saturn_success ?? undefined,
    
    predictedOutputGrid: row.predicted_output_grid ?? undefined,
    isPredictionCorrect: row.is_prediction_correct ?? undefined,
    predictionAccuracyScore: row.prediction_accuracy_score ?? undefined,
    
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined
  };
}

/**
 * Transform feedback row to API DTO
 */
export function toFeedbackDTO(row: FeedbackRow): FeedbackDTO {
  return {
    id: row.id,
    explanationId: row.explanation_id,
    voteType: row.vote_type,
    comment: row.comment,
    createdAt: row.created_at
  };
}

/**
 * Validate and parse explanation row from database
 */
export function parseExplanationRow(row: any): ExplanationRow {
  return ExplanationRowSchema.parse(row);
}

/**
 * Validate and parse feedback row from database
 */
export function parseFeedbackRow(row: any): FeedbackRow {
  return FeedbackRowSchema.parse(row);
}

/**
 * Validate input for creating explanations
 */
export function validateCreateExplanation(input: any): CreateExplanationData {
  return CreateExplanationSchema.parse(input);
}

/**
 * Validate input for creating feedback
 */
export function validateCreateFeedback(input: any): CreateFeedbackData {
  return CreateFeedbackSchema.parse(input);
}