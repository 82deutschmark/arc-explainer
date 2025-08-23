/**
 * Database Connection Abstraction Layer
 * 
 * Provides a clean abstraction over PostgreSQL with production-ready features:
 * - Connection pooling with monitoring
 * - Circuit breaker pattern for resilience  
 * - SSL configuration for Railway deployment
 * - Performance metrics and query logging
 * - Graceful shutdown handling
 * 
 * @author Claude Code Assistant
 * @date August 23, 2025
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../utils/logger.js';

/**
 * Database connection interface for dependency injection and testing
 */
export interface DatabaseConnection {
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction<T>(callback: (tx: DatabaseConnection) => Promise<T>): Promise<T>;
  isConnected(): boolean;
  end(): Promise<void>;
}

/**
 * Circuit breaker states for fault tolerance
 */
enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing - reject requests
  HALF_OPEN = 'half_open' // Testing - allow limited requests
}

/**
 * Simple circuit breaker implementation for database resilience
 */
class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private nextAttempt = 0;
  
  constructor(
    private threshold = 5,        // failures before opening
    private timeout = 30000,      // 30s timeout when open  
    private resetTimeout = 60000   // 60s before half-open
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - database unavailable');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      logger.error(`Circuit breaker OPENED after ${this.failures} failures`, 'database');
    }
  }
}

/**
 * Production-ready PostgreSQL connection with monitoring and resilience
 */
export class ProductionDatabaseConnection implements DatabaseConnection {
  private pool: Pool;
  private circuitBreaker: CircuitBreaker;
  private monitoringInterval?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(connectionString?: string) {
    this.pool = new Pool({
      connectionString: connectionString || process.env.DATABASE_URL,
      ssl: this.getSSLConfig(),
      max: 20,                    // Maximum connections
      min: 5,                     // Minimum connections  
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 2000, // 2s connection timeout
      application_name: 'arc-explainer'
    });

    this.circuitBreaker = new CircuitBreaker();
    this.setupMonitoring();
    this.setupGracefulShutdown();

    // Log connection info (without revealing credentials)
    logger.info('Database connection initialized', {
      max_connections: 20,
      min_connections: 5,
      ssl_enabled: !!this.getSSLConfig(),
      application_name: 'arc-explainer'
    }, 'database');
  }

  async query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    return this.circuitBreaker.execute(async () => {
      const start = performance.now();
      
      try {
        const result = await this.pool.query(sql, params);
        const duration = performance.now() - start;
        
        // Performance monitoring
        this.logQueryMetrics(sql, duration, result.rows.length, false);
        
        return result.rows as T[];
      } catch (error) {
        const duration = performance.now() - start;
        this.logQueryMetrics(sql, duration, 0, true, error as Error);
        throw error;
      }
    });
  }

  async queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async transaction<T>(callback: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('Database is shutting down');
    }

    const client = await this.pool.connect();
    const transactionConnection = new TransactionConnection(client);
    
    try {
      await client.query('BEGIN');
      const result = await callback(transactionConnection);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back', { error: (error as Error).message }, 'database');
      throw error;
    } finally {
      client.release();
    }
  }

  isConnected(): boolean {
    return !this.isShuttingDown && this.pool && !this.pool.ended;
  }

  async end(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    if (this.pool && !this.pool.ended) {
      logger.info('Closing database connection pool...', 'database');
      await this.pool.end();
      logger.info('Database connection pool closed', 'database');
    }
  }

  private getSSLConfig() {
    // Enable SSL for production environments (Railway, Heroku, etc.)
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENV) {
      return { rejectUnauthorized: false };
    }
    return false;
  }

  private setupMonitoring() {
    // Monitor connection pool health every 10 seconds
    this.monitoringInterval = setInterval(() => {
      if (!this.isShuttingDown) {
        const stats = {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        };
        
        logger.debug('Connection pool stats', stats, 'database');

        // Alert on high connection usage
        if (stats.waiting > 5) {
          logger.warn('High connection pool contention', stats, 'database');
        }
      }
    }, 10000);
  }

  private setupGracefulShutdown() {
    // Handle graceful shutdown on process signals
    const shutdown = async () => {
      logger.info('Received shutdown signal, closing database connections...', 'database');
      await this.end();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  private logQueryMetrics(
    sql: string, 
    duration: number, 
    rowCount: number, 
    hasError: boolean,
    error?: Error
  ) {
    const operation = this.extractOperation(sql);
    const metrics = {
      operation,
      duration: Math.round(duration),
      rows: rowCount,
      sql_preview: sql.substring(0, 100).replace(/\s+/g, ' ').trim()
    };

    if (hasError) {
      logger.error('Query failed', {
        ...metrics,
        error: error?.message,
        code: (error as any)?.code
      }, 'database');
    } else {
      // Log slow queries as warnings
      if (duration > 1000) {
        logger.warn('Slow query detected', metrics, 'database');
      } else {
        logger.debug('Query completed', metrics, 'database');
      }
    }
  }

  private extractOperation(sql: string): string {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';  
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    if (normalized.startsWith('ALTER')) return 'ALTER';
    if (normalized.startsWith('DROP')) return 'DROP';
    return 'OTHER';
  }
}

/**
 * Transaction-scoped database connection
 */
class TransactionConnection implements DatabaseConnection {
  constructor(private client: PoolClient) {}

  async query<T = any>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.client.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T = any>(sql: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async transaction<T>(callback: (tx: DatabaseConnection) => Promise<T>): Promise<T> {
    // Nested transactions are not supported - just execute the callback
    return callback(this);
  }

  isConnected(): boolean {
    return !this.client.connection?.destroyed;
  }

  async end(): Promise<void> {
    // Don't end the client - it's managed by the parent transaction
  }
}

/**
 * Global database connection instance
 */
let globalConnection: DatabaseConnection | null = null;

/**
 * Initialize the global database connection
 */
export async function initializeDatabase(connectionString?: string): Promise<DatabaseConnection> {
  if (globalConnection) {
    await globalConnection.end();
  }

  globalConnection = new ProductionDatabaseConnection(connectionString);

  // Test connectivity
  try {
    await globalConnection.query('SELECT 1 as test');
    logger.info('Database connection established successfully', 'database');
  } catch (error) {
    logger.error('Failed to establish database connection', { 
      error: (error as Error).message 
    }, 'database');
    throw error;
  }

  return globalConnection;
}

/**
 * Get the global database connection instance
 */
export function getDatabase(): DatabaseConnection {
  if (!globalConnection) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return globalConnection;
}

/**
 * Shutdown the global database connection
 */
export async function shutdownDatabase(): Promise<void> {
  if (globalConnection) {
    await globalConnection.end();
    globalConnection = null;
  }
}