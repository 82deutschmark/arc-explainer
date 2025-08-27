/**
 * Thin Database Service Wrapper
 * All methods delegate to repositoryService for clean architecture.
 */

import { logger } from '../utils/logger';
import type { Feedback, DetailedFeedback, FeedbackFilters, FeedbackStats } from '../../shared/types';
import { repositoryService } from '../repositories/RepositoryService.ts';

/**
 * Initialize database connection and create tables
 * REFACTORED: Now delegates to repositoryService
 */
const initDb = async () => {
  return await repositoryService.initialize();
};

// Table creation now handled by repositoryService.initialize() → DatabaseSchema.ts

/**
 * Save puzzle explanation to database
 * REFACTORED: Now delegates to repositoryService
 */
const saveExplanation = async (puzzleId: string, explanation: any): Promise<number | null> => {
  try {
    // Add puzzleId to explanation data for repository
    const explanationData = { ...explanation, puzzleId };
    const result = await repositoryService.explanations.saveExplanation(explanationData);
    return result.id;
  } catch (error) {
    logger.error(`Error in dbService.saveExplanation for puzzle ${puzzleId}: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return null;
  }
};

/**
 * Get single explanation for a puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const getExplanationForPuzzle = async (puzzleId: string) => {
  return await repositoryService.explanations.getExplanationForPuzzle(puzzleId);
};

/**
 * Get all explanations for a puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const getExplanationsForPuzzle = async (puzzleId: string) => {
  return await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
};

/**
 * Get explanation by ID
 * REFACTORED: Now delegates to repositoryService
 */
const getExplanationById = async (explanationId: number) => {
  return await repositoryService.explanations.getExplanationById(explanationId);
};

/**
 * Check if explanation exists for puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const hasExplanation = async (puzzleId: string): Promise<boolean> => {
  return await repositoryService.explanations.hasExplanation(puzzleId);
};

/**
 * Get bulk explanation status for multiple puzzles with detailed metadata
 * REFACTORED: Now delegates to repositoryService
 */
const getBulkExplanationStatus = async (puzzleIds: string[]) => {
  const statusMap = await repositoryService.explanations.getBulkExplanationStatus(puzzleIds);
  // Convert object to Map for backward compatibility
  const resultMap = new Map();
  Object.entries(statusMap).forEach(([puzzleId, status]) => {
    resultMap.set(puzzleId, status);
  });
  return resultMap;
};

/**
 * Add feedback for an explanation
 * REFACTORED: Now delegates to repositoryService
 */
const addFeedback = async (explanationId: number, voteType: 'helpful' | 'not_helpful', comment: string): Promise<boolean> => {
  try {
    const result = await repositoryService.feedback.addFeedback({ explanationId, voteType, comment });
    return result.success;
  } catch (error) {
    logger.error(`Error in dbService.addFeedback: ${error instanceof Error ? error.message : String(error)}`, 'database');
    return false;
  }
};

/**
 * Get feedback for an explanation
 * REFACTORED: Now delegates to repositoryService
 */
const getFeedbackForExplanation = async (explanationId: number): Promise<Feedback[]> => {
  return await repositoryService.feedback.getFeedbackForExplanation(explanationId);
};

/**
 * Get feedback for a puzzle
 * REFACTORED: Now delegates to repositoryService
 */
const getFeedbackForPuzzle = async (puzzleId: string): Promise<DetailedFeedback[]> => {
  return await repositoryService.feedback.getFeedbackForPuzzle(puzzleId);
};

/**
 * Get all feedback with optional filters
 * REFACTORED: Now delegates to repositoryService
 */
const getAllFeedback = async (filters: FeedbackFilters = {}): Promise<DetailedFeedback[]> => {
  return await repositoryService.feedback.getAllFeedback(filters);
};

/**
 * Get feedback summary statistics
 * REFACTORED: Now delegates to repositoryService
 */
const getFeedbackSummaryStats = async (): Promise<FeedbackStats> => {
  return await repositoryService.feedback.getFeedbackSummaryStats();
};

/**
 * Check if database is connected
 * REFACTORED: Now delegates to repositoryService
 */
const isConnected = () => {
  return repositoryService.isConnected();
};

/**
 * Get accuracy statistics for solver mode
 * REFACTORED: Now delegates to repositoryService
 */
const getAccuracyStats = async () => {
  return await repositoryService.feedback.getAccuracyStats();
};

// Batch Analysis Functions - All delegate to repositoryService

/**
 * REFACTORED: Now delegates to repositoryService
 */
const createBatchSession = async (sessionData: any) => {
  return await repositoryService.batchAnalysis.createBatchSession(sessionData);
};

/**
 * REFACTORED: Now delegates to repositoryService
 */
const updateBatchSession = async (sessionId: string, updates: any) => {
  return await repositoryService.batchAnalysis.updateBatchSession(sessionId, updates);
};

/**
 * REFACTORED: Now delegates to repositoryService
 */
const getBatchSession = async (sessionId: string) => {
  return await repositoryService.batchAnalysis.getBatchSession(sessionId);
};

/**
 * REFACTORED: Now delegates to repositoryService
 */
const getAllBatchSessions = async () => {
  return await repositoryService.batchAnalysis.getAllBatchSessions();
};

/**
 * REFACTORED: Now delegates to repositoryService
 */
const createBatchResult = async (sessionId: string, puzzleId: string) => {
  return await repositoryService.batchAnalysis.createBatchResult(sessionId, puzzleId);
};

/**
 * REFACTORED: Now delegates to repositoryService
 */
const updateBatchResult = async (sessionId: string, puzzleId: string, updates: any) => {
  return await repositoryService.batchAnalysis.updateBatchResult(sessionId, puzzleId, updates);
};

/**
 * REFACTORED: Now delegates to repositoryService
 */
const getBatchResults = async (sessionId: string) => {
  return await repositoryService.batchAnalysis.getBatchResults(sessionId);
};

// Export clean database service
export const dbService = {
  init: initDb, // Maintain backward compatibility
  saveExplanation,
  getExplanationForPuzzle,
  getExplanationsForPuzzle,
  getExplanationById,
  hasExplanation,
  getBulkExplanationStatus,
  addFeedback,
  getFeedbackForExplanation,
  getFeedbackForPuzzle,
  getAllFeedback,
  getFeedbackSummaryStats,
  getAccuracyStats,
  createBatchSession,
  updateBatchSession,
  getBatchSession,
  getAllBatchSessions,
  createBatchResult,
  updateBatchResult,
  getBatchResults,
  isConnected
};