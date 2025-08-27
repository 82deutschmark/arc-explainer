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
   * Safe JSON parsing with fallback
   */
  protected safeJsonParse<T>(value: any, fieldName?: string, fallback: T | null = null): T | null {
    if (!value) return fallback;
    if (typeof value === 'object') return value as T;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      if (fieldName) {
        logger.warn(`Failed to parse JSON for ${fieldName}: ${value}`, 'database');
      }
      return fallback;
    }
  }

  /**
   * Safe JSON stringification
   */
  protected safeJsonStringify(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    
    try {
      return JSON.stringify(value);
    } catch (error) {
      logger.warn(`Failed to stringify JSON: ${value}`, 'database');
      return null;
    }
  }

  /**
   * Normalize confidence score to 0-100 range
   */
  protected normalizeConfidence(confidence: any): number {
    if (typeof confidence === 'number') {
      return Math.max(0, Math.min(100, Math.round(confidence)));
    }
    if (typeof confidence === 'string') {
      const parsed = parseFloat(confidence);
      return isNaN(parsed) ? 50 : Math.max(0, Math.min(100, Math.round(parsed)));
    }
    return 50; // Default confidence
  }

  /**
   * Process hints array with validation
   */
  protected processHints(hints: any): string[] {
    if (Array.isArray(hints)) {
      return hints.filter(hint => typeof hint === 'string' && hint.trim().length > 0);
    }
    if (typeof hints === 'string') {
      try {
        const parsed = JSON.parse(hints);
        return Array.isArray(parsed) ? parsed.filter(hint => typeof hint === 'string') : [];
      } catch {
        return [hints]; // Single hint as string
      }
    }
    return [];
  }
}