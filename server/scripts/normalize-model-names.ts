/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-05
 * PURPOSE: Script to normalize model names in the database.
 * Handles specific cases like grok-4-fast:free → grok-4-fast and sonoma-sky-alpha → sonoma-sky
 * SRP and DRY check: Pass - Single responsibility for database model name normalization
 * shadcn/ui: N/A - Backend script
 */

import 'dotenv/config';
import { initializeDatabase, getPool } from '../repositories/base/BaseRepository.ts';
import { logger } from '../utils/logger.ts';

interface ModelNameMapping {
  oldName: string;
  newName: string;
}

async function normalizeModelNames() {
  logger.info('Starting model name normalization...', 'database');

  // Initialize database connection
  const connected = await initializeDatabase();
  if (!connected) {
    logger.error('Failed to connect to database', 'database');
    return;
  }

  // Define the mappings
  const mappings: ModelNameMapping[] = [
    // sonoma-sky was actually grok-4-fast under a different name
    { oldName: 'openrouter/sonoma-sky', newName: 'x-ai/grok-4-fast' }
  ];

  try {
    const pool = getPool();

    if (!pool) {
      logger.error('Database pool not available', 'database');
      return;
    }

    // First, check what records exist
    logger.info('Checking current model names...', 'database');

    for (const mapping of mappings) {
      const checkQuery = `
        SELECT COUNT(*) as count
        FROM explanations
        WHERE model_name = $1
      `;

      const result = await pool.query(checkQuery, [mapping.oldName]);
      const count = parseInt(result.rows[0]?.count || '0');

      if (count > 0) {
        logger.info(`Found ${count} records with model_name = '${mapping.oldName}'`, 'database');

        // Update the records
        const updateQuery = `
          UPDATE explanations
          SET model_name = $1
          WHERE model_name = $2
        `;

        const updateResult = await pool.query(updateQuery, [mapping.newName, mapping.oldName]);
        logger.info(`Updated ${updateResult.rowCount} records: '${mapping.oldName}' → '${mapping.newName}'`, 'database');
      } else {
        logger.info(`No records found with model_name = '${mapping.oldName}'`, 'database');
      }
    }

    // Verify the changes
    logger.info('Verification - checking for any remaining non-normalized names...', 'database');

    const verifyQuery = `
      SELECT model_name, COUNT(*) as count
      FROM explanations
      WHERE model_name LIKE '%:free'
         OR model_name LIKE '%-alpha'
         OR model_name LIKE '%-beta'
      GROUP BY model_name
      ORDER BY count DESC
    `;

    const verifyResult = await pool.query(verifyQuery);

    if (verifyResult.rows.length > 0) {
      logger.warn('Found models that may need normalization:', 'database');
      verifyResult.rows.forEach(row => {
        logger.warn(`  - ${row.model_name}: ${row.count} records`, 'database');
      });
    } else {
      logger.info('✓ No non-normalized model names found', 'database');
    }

    logger.info('Model name normalization complete', 'database');

  } catch (error) {
    logger.error(`Error normalizing model names: ${error instanceof Error ? error.message : String(error)}`, 'database');
    throw error;
  }
}

// Run the script
normalizeModelNames()
  .then(() => {
    logger.info('Script completed successfully', 'database');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`, 'database');
    process.exit(1);
  });
