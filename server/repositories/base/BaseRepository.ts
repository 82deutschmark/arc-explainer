/**
 * Base Repository Abstract Class
 * 
 * Provides common database connection and transaction management for all repositories.
 * Follows Repository pattern to separate data access logic from business logic.
 * 
 * @author Claude
 * @date 2025-08-27
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger.js';
import { safeJsonParse, safeJsonStringify, normalizeConfidence, processHints } from '../../utils/CommonUtilities.js';

// Database connection pool - shared across all repositories
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 */
export const initializeDatabase = async (): Promise<boolean> => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not provided, using in-memory storage only', 'database');
    return false;
  }

  try {
    pool = new Pool({ connectionString: databaseUrl });
    
    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    
    logger.info('Database connection pool initialized', 'database');
    return true;
  } catch (error) {
    logger.error(`Database initialization failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
    pool = null;
    return false;
  }
};

/**
 * Check if database is connected
 */
export const isDatabaseConnected = (): boolean => {
  return pool !== null;
};

/**
 * Get database connection pool
 */
export const getPool = (): Pool | null => {
  return pool;
};

/**
 * Abstract base class for all repositories
 */
export abstract class BaseRepository {
  /**
   * Get a database client from the pool
   */
  protected async getClient(): Promise<PoolClient> {
    if (!pool) {
      throw new Error('Database not initialized');
    }
    return await pool.connect();
  }

  /**
   * Execute a query with automatic client management
   */
  protected async query<T = any>(
    text: string, 
    params?: any[], 
    client?: PoolClient
  ): Promise<{ rows: T[]; rowCount: number }> {
    const shouldReleaseClient = !client;
    const queryClient = client || await this.getClient();
    
    try {
      const result = await queryClient.query(text, params);
      return {
        rows: result.rows,
        rowCount: result.rowCount || 0
      };
    } catch (error) {
      logger.error(`Database query failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      if (shouldReleaseClient) {
        queryClient.release();
      }
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Transaction failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is connected
   */
  protected isConnected(): boolean {
    return isDatabaseConnected();
  }

  /**
   * Safe JSON parsing with fallback - delegates to CommonUtilities
   */
  protected safeJsonParse<T>(value: any, fieldName?: string, fallback: T | null = null): T | null {
    return safeJsonParse<T>(value, fieldName, fallback);
  }

  /**
   * Safe JSON stringification - delegates to CommonUtilities
   */
  protected safeJsonStringify(value: any): string | null {
    return safeJsonStringify(value);
  }

  /**
   * Normalize confidence score - delegates to CommonUtilities
   */
  protected normalizeConfidence(confidence: any): number {
    return normalizeConfidence(confidence);
  }

  /**
   * Process hints array - delegates to CommonUtilities
   */
  protected processHints(hints: any): string[] {
    return processHints(hints);
  }
}