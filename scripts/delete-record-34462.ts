/**
 * Author: Claude Sonnet 4.5
 * Date: 2026-01-04
 * PURPOSE: One-time script to update explanation record with ID 34462
 * Sets isPredictionCorrect to false for this record
 */

// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { repositoryService } from '../server/repositories/RepositoryService.ts';
import { logger } from '../server/utils/logger.ts';

async function updateRecord() {
  try {
    // Initialize database connection
    await repositoryService.initialize();

    if (!repositoryService.isConnected()) {
      throw new Error('Failed to connect to database');
    }

    // Get the database pool and run the update query
    const pool = repositoryService.db;
    if (!pool) {
      throw new Error('Database pool not available');
    }

    const result = await pool.query(
      'UPDATE explanations SET is_prediction_correct = $1 WHERE id = $2 RETURNING id, puzzle_id, is_prediction_correct',
      [false, 34462]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      logger.info(`Successfully updated explanation record ID ${row.id}`, 'script');
      console.log('✓ Record 34462 updated successfully');
      console.log(`  - Puzzle ID: ${row.puzzle_id}`);
      console.log(`  - isPredictionCorrect: ${row.is_prediction_correct}`);
    } else {
      logger.warn('Record ID 34462 not found', 'script');
      console.log('⚠ Record 34462 not found');
    }

    process.exit(0);

  } catch (error) {
    logger.error(`Error updating record: ${error instanceof Error ? error.message : String(error)}`, 'script');
    console.error('Error:', error);
    process.exit(1);
  }
}

updateRecord();
