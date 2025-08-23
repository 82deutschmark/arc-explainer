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
 * Shutdown the database service
 */
export async function shutdownDatabaseService(): Promise<void> {
  if (databaseService) {
    await databaseService.shutdown();
    databaseService = null;
  }
}