/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-21T01:30:00Z
 * Updated: 2025-11-21 - Fixed repositoryService.query() calls to use getPool()
 * PURPOSE: Automated database maintenance tasks including temp file cleanup,
 *          vacuum operations, and index maintenance. Runs on startup and can be
 *          scheduled via cron or called manually.
 * SRP/DRY check: Pass - Single responsibility for database maintenance
 *
 * NOTE: Uses getPool() directly instead of repositoryService.query() because
 * RepositoryService doesn't expose a query() method (only a db getter).
 */

import { logger } from '../utils/logger.js';
import { repositoryService } from '../repositories/RepositoryService.js';
import { getPool } from '../repositories/base/BaseRepository.js';

export class DatabaseMaintenance {
  /**
   * Clean up PostgreSQL temporary files and perform maintenance tasks
   */
  async performMaintenance(): Promise<void> {
    if (!repositoryService.isConnected()) {
      logger.warn('Database not connected - skipping maintenance tasks', 'db-maintenance');
      return;
    }

    try {
      logger.info('Starting database maintenance tasks...', 'db-maintenance');

      // 1. Get current temp file statistics
      await this.logTempFileStats();

      // 2. Terminate long-running idle queries that might be holding temp files
      await this.terminateIdleQueries();

      // 3. Force PostgreSQL to clean up temp files from crashed/terminated sessions
      await this.cleanupOrphanedTempFiles();

      // 4. Vacuum analyze to update statistics and reclaim space
      await this.vacuumAnalyze();

      // 5. Log final statistics
      await this.logTempFileStats();

      logger.info('Database maintenance completed successfully', 'db-maintenance');
    } catch (error) {
      logger.error(`Database maintenance failed: ${error instanceof Error ? error.message : String(error)}`, 'db-maintenance');
      throw error;
    }
  }

  /**
   * Log current temp file statistics from PostgreSQL
   */
  private async logTempFileStats(): Promise<void> {
    try {
      const pool = getPool();
      if (!pool) {
        logger.debug('Database pool not available - skipping temp file stats', 'db-maintenance');
        return;
      }

      const result = await pool.query(`
        SELECT
          pg_size_pretty(sum(size)) as total_temp_size,
          count(*) as temp_file_count
        FROM pg_ls_tmpdir()
      `);

      if (result.rows && result.rows.length > 0) {
        const { total_temp_size, temp_file_count } = result.rows[0];
        logger.info(`Temp files: ${temp_file_count} files, ${total_temp_size || '0 bytes'} total`, 'db-maintenance');
      }
    } catch (error) {
      // pg_ls_tmpdir() might not be available in all PostgreSQL versions
      logger.debug('Could not query temp file stats (pg_ls_tmpdir may not be available)', 'db-maintenance');
    }
  }

  /**
   * Terminate ALL active queries to force cleanup of temp files
   * Aggressive cleanup for Railway deployment with limited disk space
   */
  private async terminateIdleQueries(): Promise<void> {
    try {
      const pool = getPool();
      if (!pool) {
        logger.debug('Database pool not available - skipping query termination', 'db-maintenance');
        return;
      }

      // AGGRESSIVE: Kill ALL active queries except our own to free temp files
      const result = await pool.query(`
        SELECT
          pg_terminate_backend(pid),
          query,
          state
        FROM pg_stat_activity
        WHERE state IN ('active', 'idle in transaction')
          AND pid != pg_backend_pid()
      `);

      if (result.rowCount && result.rowCount > 0) {
        logger.info(`Terminated ${result.rowCount} active/idle queries to free temp files`, 'db-maintenance');
      }
    } catch (error) {
      logger.warn(`Could not terminate queries: ${error instanceof Error ? error.message : String(error)}`, 'db-maintenance');
    }
  }

  /**
   * Clean up orphaned temp files from crashed or terminated sessions
   * This forces PostgreSQL to scan and clean up temp files
   */
  private async cleanupOrphanedTempFiles(): Promise<void> {
    try {
      const pool = getPool();
      if (!pool) {
        logger.debug('Database pool not available - skipping cleanup operations', 'db-maintenance');
        return;
      }

      // Force a checkpoint to ensure temp files from finished transactions are cleaned
      await pool.query('CHECKPOINT');
      logger.debug('Executed CHECKPOINT to trigger temp file cleanup', 'db-maintenance');

      // Get and log temp tablespace usage
      const result = await pool.query(`
        SELECT
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          pg_size_pretty(pg_total_relation_size('pg_temp_1')) as temp_size
      `);

      if (result.rows && result.rows.length > 0) {
        logger.debug(`Database size: ${result.rows[0].db_size}, Temp space: ${result.rows[0].temp_size}`, 'db-maintenance');
      }
    } catch (error) {
      logger.warn(`Could not execute cleanup operations: ${error instanceof Error ? error.message : String(error)}`, 'db-maintenance');
    }
  }

  /**
   * Run VACUUM ANALYZE on key tables to reclaim space and update statistics
   * This helps the query planner make better decisions and prevents bloat
   */
  private async vacuumAnalyze(): Promise<void> {
    try {
      const pool = getPool();
      if (!pool) {
        logger.debug('Database pool not available - skipping vacuum operations', 'db-maintenance');
        return;
      }

      const tables = ['explanations', 'feedback', 'puzzles'];

      for (const table of tables) {
        try {
          await pool.query(`VACUUM ANALYZE ${table}`);
          logger.debug(`Vacuumed and analyzed table: ${table}`, 'db-maintenance');
        } catch (error) {
          // Table might not exist yet, skip it
          logger.debug(`Skipping vacuum for ${table}: ${error instanceof Error ? error.message : String(error)}`, 'db-maintenance');
        }
      }
    } catch (error) {
      logger.warn(`Could not run VACUUM ANALYZE: ${error instanceof Error ? error.message : String(error)}`, 'db-maintenance');
    }
  }

  /**
   * Get database statistics for monitoring
   */
  async getDatabaseStats(): Promise<any> {
    if (!repositoryService.isConnected()) {
      return null;
    }

    try {
      const pool = getPool();
      if (!pool) {
        logger.debug('Database pool not available - skipping database stats', 'db-maintenance');
        return null;
      }

      const result = await pool.query(`
        SELECT
          pg_database_size(current_database()) as db_size_bytes,
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
          (SELECT count(*) FROM pg_stat_activity) as total_connections
      `);

      return result.rows[0];
    } catch (error) {
      logger.error(`Could not get database stats: ${error instanceof Error ? error.message : String(error)}`, 'db-maintenance');
      return null;
    }
  }
}

export const databaseMaintenance = new DatabaseMaintenance();
