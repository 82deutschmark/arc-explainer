/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-21T01:35:00Z
 * PURPOSE: Manual database maintenance script that can be run via npm or on deployment.
 *          Executes temp file cleanup, vacuum operations, and database optimization.
 *          Usage: npm run db:maintenance
 * SRP/DRY check: Pass - Single responsibility for manual maintenance execution
 */

import 'dotenv/config';
import { databaseMaintenance } from '../maintenance/dbCleanup.js';
import { repositoryService } from '../repositories/RepositoryService.js';
import { logger } from '../utils/logger.js';

async function runMaintenance() {
  logger.info('='.repeat(60), 'maintenance-script');
  logger.info('Database Maintenance Script Started', 'maintenance-script');
  logger.info('='.repeat(60), 'maintenance-script');

  try {
    // Initialize database connection
    const initialized = await repositoryService.initialize();

    if (!initialized) {
      logger.error('Failed to initialize database connection', 'maintenance-script');
      process.exit(1);
    }

    logger.info('Database connection established', 'maintenance-script');

    // Get database stats before maintenance
    logger.info('Database statistics BEFORE maintenance:', 'maintenance-script');
    const statsBefore = await databaseMaintenance.getDatabaseStats();
    if (statsBefore) {
      logger.info(`  - Database size: ${statsBefore.db_size}`, 'maintenance-script');
      logger.info(`  - Active connections: ${statsBefore.active_connections}`, 'maintenance-script');
      logger.info(`  - Total connections: ${statsBefore.total_connections}`, 'maintenance-script');
    }

    // Run maintenance tasks
    logger.info('', 'maintenance-script');
    logger.info('Starting maintenance tasks...', 'maintenance-script');
    await databaseMaintenance.performMaintenance();

    // Get database stats after maintenance
    logger.info('', 'maintenance-script');
    logger.info('Database statistics AFTER maintenance:', 'maintenance-script');
    const statsAfter = await databaseMaintenance.getDatabaseStats();
    if (statsAfter) {
      logger.info(`  - Database size: ${statsAfter.db_size}`, 'maintenance-script');
      logger.info(`  - Active connections: ${statsAfter.active_connections}`, 'maintenance-script');
      logger.info(`  - Total connections: ${statsAfter.total_connections}`, 'maintenance-script');

      // Calculate space saved if possible
      if (statsBefore && statsAfter) {
        const savedBytes = statsBefore.db_size_bytes - statsAfter.db_size_bytes;
        if (savedBytes > 0) {
          const savedMB = (savedBytes / 1024 / 1024).toFixed(2);
          logger.info(`  - Space reclaimed: ${savedMB} MB`, 'maintenance-script');
        }
      }
    }

    logger.info('', 'maintenance-script');
    logger.info('='.repeat(60), 'maintenance-script');
    logger.info('Database Maintenance Completed Successfully!', 'maintenance-script');
    logger.info('='.repeat(60), 'maintenance-script');

    process.exit(0);
  } catch (error) {
    logger.error('', 'maintenance-script');
    logger.error('='.repeat(60), 'maintenance-script');
    logger.error(`Maintenance failed: ${error instanceof Error ? error.message : String(error)}`, 'maintenance-script');
    logger.error('='.repeat(60), 'maintenance-script');
    process.exit(1);
  }
}

// Run the maintenance
runMaintenance();
