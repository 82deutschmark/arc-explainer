/**
 * Database Service Factory
 * 
 * Provides a unified interface to all repositories with proper initialization
 * and dependency injection. Replaces the monolithic dbService.ts.
 * 
 * @author Claude Code Assistant
 * @date August 23, 2025
 */

import { initializeDatabase, getDatabase, shutdownDatabase, DatabaseConnection } from './connection.js';
import { ExplanationsRepository } from './repositories/explanations.js';
import { FeedbackRepository } from './repositories/feedback.js';
import { SaturnRepository } from './repositories/saturn.js';
import { logger } from '../utils/logger.js';

/**
 * Unified database service interface
 */
export interface DatabaseService {
  // Connection management
  init(): Promise<void>;
  isConnected(): boolean;
  shutdown(): Promise<void>;
  
  // Repository access
  explanations: ExplanationsRepository;
  feedback: FeedbackRepository;
  saturn: SaturnRepository;
  
  // Legacy compatibility methods (during transition)
  saveExplanation(data: any): Promise<any>;
  addFeedback(data: any): Promise<any>;
  getExplanationForPuzzle(puzzleId: string): Promise<any>;
  getExplanationsForPuzzle(puzzleId: string): Promise<any>;
  getExplanationById(id: number): Promise<any>;
  hasExplanation(puzzleId: string, modelName?: string): Promise<boolean>;
  getBulkExplanationStatus(puzzleIds: string[]): Promise<any>;
  getFeedbackForExplanation(explanationId: number): Promise<any>;
  getFeedbackForPuzzle(puzzleId: string): Promise<any>;
  getAllFeedback(filters?: any): Promise<any>;
  getFeedbackSummaryStats(): Promise<any>;
  getAccuracyStats(): Promise<any>;
  
  // Saturn session management
  createSaturnLog(requestId: string, explanationId?: number): Promise<number>;
  addSaturnEvent(saturnLogId: number, eventType: string, data: any, provider?: string, model?: string, phase?: string, requestId?: string): Promise<void>;
  completeSaturnLog(saturnLogId: number, status: 'completed' | 'failed', finalData?: any): Promise<void>;
  getSaturnSession(requestId: string): Promise<any>;
  
  // Batch operations (placeholder for future implementation)
  createBatchRun?: (data: any) => Promise<any>;
  updateBatchRun?: (id: number, data: any) => Promise<any>;
  getBatchRun?: (id: number) => Promise<any>;
  getAllBatchRuns?: () => Promise<any>;
  addBatchResult?: (data: any) => Promise<any>;
  getBatchResults?: (batchRunId: number) => Promise<any>;
}

/**
 * Production database service implementation
 */
class ProductionDatabaseService implements DatabaseService {
  private db: DatabaseConnection | null = null;
  private _explanations: ExplanationsRepository | null = null;
  private _feedback: FeedbackRepository | null = null;
  private _saturn: SaturnRepository | null = null;

  async init(): Promise<void> {
    try {
      this.db = await initializeDatabase();
      
      // Initialize repositories
      this._explanations = new ExplanationsRepository(this.db);
      this._feedback = new FeedbackRepository(this.db);
      this._saturn = new SaturnRepository(this.db);
      
      logger.info('Database service initialized with repository pattern - runtime migrations removed', 'database');
    } catch (error) {
      logger.error('Failed to initialize database service: ' + (error as Error).message);
      throw error;
    }
  }

  isConnected(): boolean {
    return this.db?.isConnected() ?? false;
  }

  async shutdown(): Promise<void> {
    await shutdownDatabase();
    this.db = null;
    this._explanations = null;
    this._feedback = null;
    this._saturn = null;
  }

  // Repository accessors
  get explanations(): ExplanationsRepository {
    if (!this._explanations) {
      throw new Error('Database service not initialized');
    }
    return this._explanations;
  }

  get feedback(): FeedbackRepository {
    if (!this._feedback) {
      throw new Error('Database service not initialized');
    }
    return this._feedback;
  }

  get saturn(): SaturnRepository {
    if (!this._saturn) {
      throw new Error('Database service not initialized');
    }
    return this._saturn;
  }

  // Legacy compatibility methods for smooth transition
  async saveExplanation(data: any): Promise<any> {
    const result = await this.explanations.save(data);
    return {
      id: result.id,
      puzzle_id: result.puzzle_id,
      model_name: result.model_name,
      pattern_description: result.pattern_description,
      solving_strategy: result.solving_strategy,
      confidence: result.confidence,
      hints: result.hints,
      alien_meaning: result.alien_meaning,
      alien_meaning_confidence: result.alien_meaning_confidence,
      created_at: result.created_at,
      api_processing_time_ms: result.api_processing_time_ms,
      saturn_images: result.saturn_images,
      saturn_success: result.saturn_success,
      predicted_output_grid: result.predicted_output_grid,
      is_prediction_correct: result.is_prediction_correct
    };
  }

  async addFeedback(data: any): Promise<any> {
    const result = await this.feedback.add({
      explanationId: data.explanationId || data.explanation_id,
      voteType: data.voteType || data.vote_type,
      comment: data.comment
    });
    return {
      id: result.id,
      explanation_id: result.explanation_id,
      vote_type: result.vote_type,
      comment: result.comment,
      created_at: result.created_at
    };
  }

  async getExplanationForPuzzle(puzzleId: string): Promise<any> {
    const results = await this.explanations.getWithFeedbackCounts(puzzleId);
    return results[0] || null;
  }

  async getExplanationsForPuzzle(puzzleId: string): Promise<any> {
    const results = await this.explanations.getWithFeedbackCounts(puzzleId);
    
    // Transform database column names to camelCase properties expected by controllers
    return results.map(result => ({
      id: result.id,
      puzzleId: result.puzzle_id,
      modelName: result.model_name,
      patternDescription: result.pattern_description,
      solvingStrategy: result.solving_strategy,
      confidence: result.confidence,
      hints: result.hints,
      alienMeaning: result.alien_meaning,
      alienMeaningConfidence: result.alien_meaning_confidence,
      createdAt: result.created_at,
      saturnImages: result.saturn_images,
      saturnSuccess: result.saturn_success,
      predictedOutputGrid: result.predicted_output_grid,
      isPredictionCorrect: result.is_prediction_correct,
      apiProcessingTimeMs: result.api_processing_time_ms,
      hasReasoningLog: !!(result.reasoning_items && result.reasoning_items.length > 0),
      helpfulCount: result.helpful_count,
      notHelpfulCount: result.not_helpful_count,
      totalFeedback: result.total_feedback
    }));
  }

  async getExplanationById(id: number): Promise<any> {
    const result = await this.explanations.getById(id);
    if (!result) return null;
    
    return {
      id: result.id,
      puzzleId: result.puzzle_id,
      modelName: result.model_name,
      patternDescription: result.pattern_description,
      solvingStrategy: result.solving_strategy,
      confidence: result.confidence,
      hints: result.hints,
      createdAt: result.created_at,
      saturnImages: result.saturn_images,
      saturnSuccess: result.saturn_success
    };
  }

  async hasExplanation(puzzleId: string, modelName?: string): Promise<boolean> {
    return await this.explanations.exists(puzzleId, modelName);
  }

  async getBulkExplanationStatus(puzzleIds: string[]): Promise<Map<string, any>> {
    const bulkResults = await this.explanations.getBulkStatus(puzzleIds);
    
    // Convert array result to Map format expected by controllers
    const resultMap = new Map();
    
    // Initialize all puzzles as having no explanation
    puzzleIds.forEach(id => {
      resultMap.set(id, {
        hasExplanation: false,
        explanationId: undefined,
        feedbackCount: 0
      });
    });
    
    // Update with actual data from database
    bulkResults.forEach(result => {
      resultMap.set(result.puzzle_id, {
        hasExplanation: result.explanation_count > 0,
        explanationId: result.explanation_count > 0 ? result.puzzle_id : undefined, // Approximation
        feedbackCount: 0 // TODO: Add feedback count to BulkStatusResult
      });
    });
    
    return resultMap;
  }

  async getFeedbackForExplanation(explanationId: number): Promise<any> {
    const results = await this.feedback.getForExplanation(explanationId);
    return results.map(r => ({
      id: r.id,
      explanation_id: r.explanation_id,
      vote_type: r.vote_type,
      comment: r.comment,
      created_at: r.created_at
    }));
  }

  async getFeedbackForPuzzle(puzzleId: string): Promise<any> {
    return await this.feedback.getForPuzzle(puzzleId);
  }

  async getAllFeedback(filters?: any): Promise<any> {
    return await this.feedback.getAllWithFilters(filters);
  }

  async getFeedbackSummaryStats(): Promise<any> {
    return await this.feedback.getSummaryStats();
  }

  async getAccuracyStats(): Promise<any> {
    return await this.explanations.getAccuracyStats();
  }

  // Saturn methods
  async createSaturnLog(requestId: string, explanationId?: number): Promise<number> {
    return await this.saturn.createSession(requestId, explanationId);
  }

  async addSaturnEvent(
    saturnLogId: number,
    eventType: string,
    data: any,
    provider?: string,
    model?: string,
    phase?: string,
    requestId?: string
  ): Promise<void> {
    await this.saturn.addEvent(saturnLogId, {
      eventType,
      data,
      provider,
      model,
      phase,
      requestId
    });
  }

  async completeSaturnLog(saturnLogId: number, status: 'completed' | 'failed', finalData?: any): Promise<void> {
    await this.saturn.completeSession(saturnLogId, status, finalData);
  }

  async getSaturnSession(requestId: string): Promise<any> {
    return await this.saturn.getSessionByRequestId(requestId);
  }
}

// Global service instance
let databaseService: DatabaseService | null = null;

/**
 * Initialize the global database service
 */
export async function initDatabaseService(): Promise<DatabaseService> {
  if (databaseService) {
    await databaseService.shutdown();
  }
  
  databaseService = new ProductionDatabaseService();
  await databaseService.init();
  
  return databaseService;
}

/**
 * Get the global database service instance
 */
export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    throw new Error('Database service not initialized. Call initDatabaseService() first.');
  }
  return databaseService;
}

/**
 * Legacy export for backward compatibility
 */
export const dbService = {
  get init() { return getDatabaseService().init; },
  get isConnected() { return getDatabaseService().isConnected; },
  get saveExplanation() { return getDatabaseService().saveExplanation.bind(getDatabaseService()); },
  get addFeedback() { return getDatabaseService().addFeedback.bind(getDatabaseService()); },
  get getExplanationForPuzzle() { return getDatabaseService().getExplanationForPuzzle.bind(getDatabaseService()); },
  get getExplanationsForPuzzle() { return getDatabaseService().getExplanationsForPuzzle.bind(getDatabaseService()); },
  get getExplanationById() { return getDatabaseService().getExplanationById.bind(getDatabaseService()); },
  get hasExplanation() { return getDatabaseService().hasExplanation.bind(getDatabaseService()); },
  get getBulkExplanationStatus() { return getDatabaseService().getBulkExplanationStatus.bind(getDatabaseService()); },
  get getFeedbackForExplanation() { return getDatabaseService().getFeedbackForExplanation.bind(getDatabaseService()); },
  get getFeedbackForPuzzle() { return getDatabaseService().getFeedbackForPuzzle.bind(getDatabaseService()); },
  get getAllFeedback() { return getDatabaseService().getAllFeedback.bind(getDatabaseService()); },
  get getFeedbackSummaryStats() { return getDatabaseService().getFeedbackSummaryStats.bind(getDatabaseService()); },
  get getAccuracyStats() { return getDatabaseService().getAccuracyStats.bind(getDatabaseService()); },
  get createSaturnLog() { return getDatabaseService().createSaturnLog.bind(getDatabaseService()); },
  get addSaturnEvent() { return getDatabaseService().addSaturnEvent.bind(getDatabaseService()); },
  get completeSaturnLog() { return getDatabaseService().completeSaturnLog.bind(getDatabaseService()); },
  get getSaturnSession() { return getDatabaseService().getSaturnSession.bind(getDatabaseService()); }
};

/**
 * Shutdown the database service
 */
export async function shutdownDatabaseService(): Promise<void> {
  if (databaseService) {
    await databaseService.shutdown();
    databaseService = null;
  }
}