/**
 * Author: Cascade (OpenAI o4-preview)
 * Date: 2026-01-14
 * PURPOSE: Base Repository utilities for shared PG pool lifecycle, error handling, and transaction helpers.
 *          Adds resilient client-level error listeners to prevent process crashes when idle connections drop.
 * SRP/DRY check: Pass — connection lifecycle + helpers only; no domain logic.
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger.ts';
import { safeJsonParse, safeJsonStringify, normalizeConfidence, processHints, sanitizeGridData, sanitizeMultipleGrids } from '../../utils/CommonUtilities.ts';

// Database connection pool - shared across all repositories
let pool: Pool | null = null;

/**
 * Initialize database connection pool with retry logic
 */
export const initializeDatabase = async (): Promise<boolean> => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    logger.warn('DATABASE_URL not provided, using in-memory storage only', 'database');
    return false;
  }

  const maxRetries = 3;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = new Pool({ 
        connectionString: databaseUrl,
        connectionTimeoutMillis: 10000, // 10 second timeout
        idleTimeoutMillis: 30000,       // 30 second idle timeout
        max: 20                         // max 20 connections
      });

      // Add a global error handler to the pool to prevent crashes
      pool.on('error', (err, client) => {
        logger.logError(`Unexpected error on idle client`, { error: err, context: 'database', stackTrace: true });
      });
      
      // Test connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Database connection pool initialized', 'database');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Database initialization attempt ${attempt}/${maxRetries} failed: ${errorMessage}`, 'database');
      
      // Clean up failed pool
      if (pool) {
        try {
          await pool.end();
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        pool = null;
      }
      
      // If this isn't the last attempt, wait before retrying
      if (attempt < maxRetries) {
        const delay = baseDelay * attempt; // Progressive backoff: 2s, 4s, 6s
        logger.info(`Retrying database connection in ${delay}ms...`, 'database');
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error(`Database initialization failed after ${maxRetries} attempts: ${errorMessage}`, 'database');
      }
    }
  }
  
  return false;
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

    const client = await pool.connect();

    // Attach a single error listener per client to avoid unhandled 'error' events when
    // the server terminates idle connections. Without this, Node will throw and crash.
    const clientAny = client as any;
    if (!clientAny.__arcErrorHandlerAttached) {
      client.on('error', (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Unexpected error on PG client: ${msg}`, 'database');
      });
      clientAny.__arcErrorHandlerAttached = true;
    }

    return client;
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
        try {
          queryClient.release();
        } catch (releaseErr) {
          const msg = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
          logger.warn(`Failed to release PG client cleanly: ${msg}`, 'database');
        }
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

  /**
   * Sanitize grid data - delegates to CommonUtilities
   */
  protected sanitizeGridData(gridData: any): number[][] | null {
    return sanitizeGridData(gridData);
  }

  /**
   * Sanitize multiple grids data - delegates to CommonUtilities
   */
  protected sanitizeMultipleGrids(multiGridData: any): number[][][] | null {
    return sanitizeMultipleGrids(multiGridData);
  }
}