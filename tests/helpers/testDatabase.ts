/**
 * Author: Claude Sonnet 4.5
 * Date: 2026-01-04
 * PURPOSE: Test database setup and teardown utilities for integration tests
 *          Provides isolated test database with automatic cleanup
 * SRP/DRY check: Pass - Centralized database test management
 */

import { Pool, PoolClient } from 'pg';
import { logger } from '../../server/utils/logger.js';

let testPool: Pool | null = null;

/**
 * Initialize test database connection pool
 * Uses TEST_DATABASE_URL environment variable or falls back to local test database
 */
export async function setupTestDatabase(): Promise<Pool> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/arc_explainer_test';

  testPool = new Pool({
    connectionString: databaseUrl,
    max: 5, // Smaller pool for tests
    idleTimeoutMillis: 30000
  });

  testPool.on('error', (err) => {
    logger.error(`Test database pool error: ${err.message}`, 'test-database');
  });

  try {
    // Verify connection
    const client = await testPool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Test database connected successfully', 'test-database');
  } catch (error) {
    logger.error(`Failed to connect to test database: ${error}`, 'test-database');
    throw error;
  }

  return testPool;
}

/**
 * Teardown test database connection pool
 */
export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
    logger.info('Test database connection closed', 'test-database');
  }
}

/**
 * Clear all test data from tables
 * Useful for ensuring test isolation
 */
export async function clearTestData(): Promise<void> {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }

  const client = await testPool.connect();

  try {
    await client.query('BEGIN');

    // Clear tables in reverse dependency order to avoid FK constraint violations
    await client.query('TRUNCATE TABLE comparison_votes CASCADE');
    await client.query('TRUNCATE TABLE comparison_sessions CASCADE');
    await client.query('TRUNCATE TABLE elo_ratings CASCADE');
    await client.query('TRUNCATE TABLE batch_analysis_results CASCADE');
    await client.query('TRUNCATE TABLE batch_analysis_sessions CASCADE');
    await client.query('TRUNCATE TABLE feedback CASCADE');
    await client.query('TRUNCATE TABLE explanations CASCADE');
    await client.query('TRUNCATE TABLE arc3_frames CASCADE');
    await client.query('TRUNCATE TABLE arc3_sessions CASCADE');
    await client.query('TRUNCATE TABLE scorecards CASCADE');
    await client.query('TRUNCATE TABLE ingestion_runs CASCADE');
    await client.query('TRUNCATE TABLE snakebench_game_participants CASCADE');
    await client.query('TRUNCATE TABLE snakebench_games CASCADE');
    await client.query('TRUNCATE TABLE snakebench_models CASCADE');
    await client.query('TRUNCATE TABLE worm_arena_sessions CASCADE');
    await client.query('TRUNCATE TABLE rearc_submissions CASCADE');
    await client.query('TRUNCATE TABLE rearc_datasets CASCADE');

    await client.query('COMMIT');
    logger.info('Test data cleared successfully', 'test-database');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error(`Failed to clear test data: ${error}`, 'test-database');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get a client from the test pool for manual testing
 */
export async function getTestClient(): Promise<PoolClient> {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testPool.connect();
}

/**
 * Execute a query in the test database
 */
export async function query(text: string, params?: any[]): Promise<any> {
  if (!testPool) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }

  const client = await testPool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
