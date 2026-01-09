#!/usr/bin/env node

/**
 * Purge RE-ARC Submissions Script
 *
 * Author: Claude Code
 * Date: 2026-01-09
 * PURPOSE: Delete all buggy RE-ARC submissions from the database
 * SRP/DRY check: Pass - Single responsibility script for one-time data cleanup
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function purgeSubmissions() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();

    // First, count existing submissions
    const countBefore = await client.query('SELECT COUNT(*) as count FROM rearc_submissions');
    const submissionCount = parseInt(countBefore.rows[0].count, 10);
    console.log(`Current submissions in database: ${submissionCount}`);

    if (submissionCount === 0) {
      console.log('No submissions to delete.');
      client.release();
      await pool.end();
      process.exit(0);
    }

    // Delete all submissions
    console.log('Deleting all RE-ARC submissions...');
    const deleteResult = await client.query('DELETE FROM rearc_submissions');
    console.log(`Deleted ${deleteResult.rowCount} submissions`);

    // Verify deletion
    const countAfter = await client.query('SELECT COUNT(*) as count FROM rearc_submissions');
    const remaining = parseInt(countAfter.rows[0].count, 10);
    console.log(`Remaining submissions: ${remaining}`);

    // Also show dataset count (should remain unchanged)
    const datasetCount = await client.query('SELECT COUNT(*) as count FROM rearc_datasets');
    console.log(`RE-ARC datasets (preserved): ${datasetCount.rows[0].count}`);

    client.release();
    console.log('\nPurge complete! Leaderboard has been reset.');

  } catch (error) {
    console.error('ERROR during purge:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

purgeSubmissions();
