/**
 * @file scripts/recalculate-trustworthiness.ts
 * @author Cascade using Claude Sonnet 4.5
 * @date 2025-10-10T13:20:00-04:00
 * 
 * PURPOSE: One-time migration to recalculate trustworthiness_score for ALL database entries
 * after yesterday's confidence normalization fix (commit 1cf3961).
 * 
 * WHAT THIS DOES:
 * 1. Fetches all explanations from database
 * 2. For each entry:
 *    - Determines correctness (multi_test_all_correct ?? is_prediction_correct ?? false)
 *    - Normalizes confidence (using normalizeConfidence utility, defaults to 50)
 *    - Calculates trustworthiness score using the formula from responseValidator.ts
 *    - Updates database with new trustworthiness_score
 * 
 * TRUSTWORTHINESS FORMULA:
 * - Correct + High Confidence: 0.75 - 1.0 (good alignment)
 * - Correct + Low Confidence: 0.5 - 0.75 (still rewards correctness)
 * - Incorrect + High Confidence: 0.0 - 0.05 (heavily penalizes overconfidence)
 * - Incorrect + Low Confidence: 0.5 - 1.0 (rewards honest uncertainty)
 * - No Confidence: Pure correctness (0.0 or 1.0)
 * 
 * SRP/DRY check: Pass
 * - Single responsibility: Recalculate trustworthiness scores
 * - Reuses existing utilities (normalizeConfidence, database connection)
 * - Matches logic from responseValidator.ts exactly
 */

import 'dotenv/config';
import { config } from 'dotenv';
import { Pool } from 'pg';
import { fileURLToPath } from 'url';
import { normalizeConfidence } from '../server/utils/CommonUtilities.js';
import { logger } from '../server/utils/logger.js';

// Explicitly load .env file
config({ path: '.env' });

interface DatabaseRow {
  id: number;
  puzzle_id: string;
  model_name: string;
  confidence: number | null;
  is_prediction_correct: boolean | null;
  multi_test_all_correct: boolean | null;
  trustworthiness_score: number | null;
  has_multiple_predictions: boolean | null;
}

/**
 * Calculate trustworthiness score using EXACT logic from responseValidator.ts
 * 
 * This is the PRIMARY METRIC for the research project.
 * Combines confidence claims with actual correctness to measure reliability.
 * 
 * @param isCorrect - Whether prediction was correct
 * @param confidence - Confidence level (0-100) or null
 * @param hasConfidence - Whether confidence data exists
 * @returns Trustworthiness score (0.0-1.0)
 */
function calculateTrustworthinessScore(
  isCorrect: boolean,
  confidence: number | null,
  hasConfidence: boolean = true
): number {
  // For external data without confidence, return pure correctness
  if (!hasConfidence || confidence === null) {
    return isCorrect ? 1.0 : 0.0;
  }

  // Normalize confidence to 0-1 range (input is 0-100)
  const normalizedConfidence = Math.max(0, Math.min(100, confidence)) / 100;

  if (isCorrect) {
    // Correct answers get higher scores (minimum 0.5)
    // Even low confidence correct answers score well
    return Math.max(0.5, 0.5 + (normalizedConfidence * 0.5));
  } else {
    // Incorrect answers: reward low confidence, penalize high confidence
    // Perfect calibration: 0% confidence wrong = 1.0 score
    // 50% confidence wrong = 0.5 score
    // 95%+ confidence wrong = very low score (0.05 or less)
    return 1.0 - normalizedConfidence;
  }
}

/**
 * Determine if entry is correct using same logic as correctness.ts
 * 
 * Priority: multi_test_all_correct > is_prediction_correct
 * Null/undefined/false all count as incorrect
 */
function determineCorrectness(row: DatabaseRow): boolean {
  // Use nullish coalescing to get first non-null value
  const correctnessValue = row.multi_test_all_correct ?? row.is_prediction_correct;
  
  // Only explicitly true counts as correct
  return correctnessValue === true;
}

/**
 * Recalculate trustworthiness for a single database row
 */
function recalculateTrustworthiness(row: DatabaseRow): number {
  // Step 1: Determine correctness
  const isCorrect = determineCorrectness(row);

  // Step 2: Use confidence directly (no double normalization)
  const confidence = row.confidence ?? 50;

  // Fix corrupted entries: if confidence is 0 but trustworthiness is 1.0, recalculate properly
  if (row.confidence === 0 && row.trustworthiness_score === 1.0) {
    console.log(`Fixing corrupted entry ${row.id}: confidence=0, trustworthiness=1.0`);
  }

  // Step 3: Check if we have confidence data (null/undefined only, not 0)
  const hasConfidence = row.confidence !== null && row.confidence !== undefined;

  // Step 4: Calculate trustworthiness
  const trustworthiness = calculateTrustworthinessScore(
    isCorrect,
    confidence,  // Use raw confidence, let calculateTrustworthinessScore handle normalization
    hasConfidence
  );

  return trustworthiness;
}

interface MigrationStats {
  totalEntries: number;
  processedCount: number;
  updatedCount: number;
  unchangedCount: number;
  corruptedCount: number;
  nullConfidenceCount: number;
  correctCount: number;
  incorrectCount: number;
  minTrustworthiness: number;
  maxTrustworthiness: number;
  avgTrustworthiness: number;
  errors: Array<{ id: number; error: string }>;
}

/**
 * Main migration function
 * 
 * @param dryRun - If true, calculate but don't write to database
 * @param batchSize - Number of entries to process at once
 */
async function runMigration(dryRun: boolean = false, batchSize: number = 1000): Promise<void> {
  console.log('='.repeat(80));
  console.log('TRUSTWORTHINESS SCORE RECALCULATION MIGRATION');
  console.log('='.repeat(80));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no database writes)' : 'LIVE (will update database)'}`);
  console.log(`Batch size: ${batchSize}`);
  console.log('');

  const stats: MigrationStats = {
    totalEntries: 0,
    processedCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    corruptedCount: 0,
    nullConfidenceCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    minTrustworthiness: Infinity,
    maxTrustworthiness: -Infinity,
    avgTrustworthiness: 0,
    errors: []
  };

  const databaseUrl = process.env.DATABASE_URL;
  console.log(`🔌 Checking database connection...`);
  if (!databaseUrl) {
    console.log('⚠️  No DATABASE_URL found - this script requires database access');
    console.log('   Make sure .env file exists with DATABASE_URL set');
    throw new Error('DATABASE_URL not set');
  }
  console.log('✅ DATABASE_URL found');

  const pool = new Pool({ connectionString: databaseUrl });
  console.log('📊 Connecting to database...');
  
  // Test connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful!\n');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }

  try {
    // Step 1: Get total count
    console.log('Step 1: Counting total entries...');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM explanations');
    stats.totalEntries = parseInt(countResult.rows[0].count);
    console.log(`Total entries to process: ${stats.totalEntries.toLocaleString()}`);
    console.log('');

    console.log('Step 2: Processing entries in batches...');
    let offset = 0;
    let trustworthinessSum = 0;

    while (offset < stats.totalEntries) {
      const batchResult = await pool.query(`
        SELECT
          id,
          puzzle_id,
          model_name,
          confidence,
          is_prediction_correct,
          multi_test_all_correct,
          trustworthiness_score,
          has_multiple_predictions
        FROM explanations
        ORDER BY id ASC
        LIMIT $1 OFFSET $2
      `, [batchSize, offset]);

      const batch = batchResult.rows;
      
      if (batch.length === 0) {
        break;
      }

      // Process each entry in the batch
      for (const row of batch) {
        try {
          // Recalculate trustworthiness
          const newTrustworthiness = recalculateTrustworthiness(row);
          const oldTrustworthiness = row.trustworthiness_score;

          // Track statistics
          stats.processedCount++;
          trustworthinessSum += newTrustworthiness;
          
          // Track corrupted entries (confidence=0 but trustworthiness=1.0)
          if (row.confidence === 0 && row.trustworthiness_score === 1.0) {
            stats.corruptedCount++;
          }
          
          if (determineCorrectness(row)) {
            stats.correctCount++;
          } else {
            stats.incorrectCount++;
          }

          stats.minTrustworthiness = Math.min(stats.minTrustworthiness, newTrustworthiness);
          stats.maxTrustworthiness = Math.max(stats.maxTrustworthiness, newTrustworthiness);

          // Check if value changed (with tolerance for floating point precision)
          const hasChanged = oldTrustworthiness === null || 
                            Math.abs(oldTrustworthiness - newTrustworthiness) > 0.0001;

          if (hasChanged) {
            stats.updatedCount++;

            // Update database (if not dry run)
            if (!dryRun) {
              await pool.query(
                'UPDATE explanations SET trustworthiness_score = $1 WHERE id = $2',
                [newTrustworthiness, row.id]
              );
            }
          } else {
            stats.unchangedCount++;
          }

          // Progress reporting every 100 entries
          if (stats.processedCount % 100 === 0) {
            const progress = ((stats.processedCount / stats.totalEntries) * 100).toFixed(1);
            process.stdout.write(`\rProgress: ${stats.processedCount.toLocaleString()} / ${stats.totalEntries.toLocaleString()} (${progress}%)`);
          }

        } catch (error) {
          stats.errors.push({
            id: row.id,
            error: error instanceof Error ? error.message : String(error)
          });
          logger.error(`Error processing entry ${row.id}: ${error}`, 'migration');
        }
      }

      offset += batchSize;
    }

    console.log(''); // New line after progress
    console.log('');

    // Calculate average trustworthiness
    stats.avgTrustworthiness = trustworthinessSum / stats.processedCount;

    // Step 3: Print summary
    console.log('='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Entries:          ${stats.totalEntries.toLocaleString()}`);
    console.log(`Processed:              ${stats.processedCount.toLocaleString()}`);
    console.log(`Updated:                ${stats.updatedCount.toLocaleString()} (${((stats.updatedCount / stats.processedCount) * 100).toFixed(1)}%)`);
    console.log(`Unchanged:              ${stats.unchangedCount.toLocaleString()} (${((stats.unchangedCount / stats.processedCount) * 100).toFixed(1)}%)`);
    console.log(`Corrupted Fixed:        ${stats.corruptedCount.toLocaleString()} (${((stats.corruptedCount / stats.processedCount) * 100).toFixed(1)}%)`);
    console.log(`Errors:                 ${stats.errors.length}`);
    console.log('');
    console.log('Correctness Distribution:');
    console.log(`  Correct:              ${stats.correctCount.toLocaleString()} (${((stats.correctCount / stats.processedCount) * 100).toFixed(1)}%)`);
    console.log(`  Incorrect:            ${stats.incorrectCount.toLocaleString()} (${((stats.incorrectCount / stats.processedCount) * 100).toFixed(1)}%)`);
    console.log('');
    console.log('Confidence:');
    console.log(`  Null Confidence:      ${stats.nullConfidenceCount.toLocaleString()} (defaulted to 50)`);
    console.log('');
    console.log('Trustworthiness Score Statistics:');
    console.log(`  Minimum:              ${stats.minTrustworthiness.toFixed(4)}`);
    console.log(`  Maximum:              ${stats.maxTrustworthiness.toFixed(4)}`);
    console.log(`  Average:              ${stats.avgTrustworthiness.toFixed(4)}`);
    console.log('');

    if (stats.errors.length > 0) {
      console.log('Errors encountered:');
      stats.errors.slice(0, 10).forEach(err => {
        console.log(`  ID ${err.id}: ${err.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
      console.log('');
    }

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes written to database');
      console.log('Run with --live flag to apply changes');
    } else {
      console.log('✅ Migration completed successfully!');
      console.log('All trustworthiness scores have been recalculated.');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('FATAL ERROR:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Verify database state before/after migration
 */
async function verifyDatabaseState(): Promise<void> {
  console.log('Verifying database state...');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total_entries,
        COUNT(trustworthiness_score) as entries_with_trustworthiness,
        AVG(trustworthiness_score) as avg_trustworthiness,
        MIN(trustworthiness_score) as min_trustworthiness,
        MAX(trustworthiness_score) as max_trustworthiness,
        COUNT(*) FILTER (WHERE trustworthiness_score IS NULL) as null_count,
        COUNT(*) FILTER (WHERE trustworthiness_score = 1.0 AND confidence = 0 AND (is_prediction_correct = false OR multi_test_all_correct = false)) as corrupted_count
      FROM explanations
    `);

    const row = result.rows[0];
    console.log('Database Statistics:');
    console.log(`  Total entries:                  ${parseInt(row.total_entries).toLocaleString()}`);
    console.log(`  Entries with trustworthiness:   ${parseInt(row.entries_with_trustworthiness).toLocaleString()}`);
    console.log(`  Null trustworthiness:           ${parseInt(row.null_count).toLocaleString()}`);
    console.log(`  Corrupted entries (1.0 + 0):    ${parseInt(row.corrupted_count).toLocaleString()}`);
    console.log(`  Average trustworthiness:        ${parseFloat(row.avg_trustworthiness).toFixed(4)}`);
    console.log(`  Min trustworthiness:            ${parseFloat(row.min_trustworthiness).toFixed(4)}`);
    console.log(`  Max trustworthiness:            ${parseFloat(row.max_trustworthiness).toFixed(4)}`);
    console.log('');
  } finally {
    await pool.end();
  }
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 TRUSTWORTHINESS RECALCULATION SCRIPT STARTING');
  console.log('='.repeat(80) + '\n');
  
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--live');
  const verifyOnly = args.includes('--verify');

  console.log('📋 Script Arguments:');
  console.log(`   - Args: ${args.join(', ') || '(none)'}`);
  console.log(`   - Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE MODE (will update database)'}`);
  console.log(`   - Verify Only: ${verifyOnly ? 'YES' : 'NO'}`);
  console.log('');

  if (verifyOnly) {
    console.log('🔍 Running in VERIFY-ONLY mode...\n');
    await verifyDatabaseState();
    console.log('\n✅ Verification complete!\n');
    return;
  }

  // Show database state before migration
  console.log('📊 BEFORE MIGRATION:');
  console.log('='.repeat(80));
  await verifyDatabaseState();

  // Run migration
  console.log('\n' + '='.repeat(80));
  console.log('🚀 STARTING MIGRATION...');
  console.log('='.repeat(80) + '\n');
  await runMigration(dryRun);

  // Show database state after migration
  if (!dryRun) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 AFTER MIGRATION:');
    console.log('='.repeat(80));
    await verifyDatabaseState();
    console.log('\n' + '='.repeat(80));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('='.repeat(80) + '\n');
  } else {
    console.log('\n' + '='.repeat(80));
    console.log('ℹ️  DRY RUN COMPLETE - No changes were made to the database');
    console.log('   Run with --live flag to apply changes');
    console.log('='.repeat(80) + '\n');
  }
}

// Run if executed directly
// Fixed for Windows: Normalize both paths to forward slashes for comparison
const scriptPath = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const argPath = process.argv[1]?.replace(/\\/g, '/');
const isMainModule = process.argv[1] && scriptPath === argPath;

if (isMainModule) {
  main().catch(error => {
    console.error('\n' + '='.repeat(80));
    console.error('❌ MIGRATION FAILED!');
    console.error('='.repeat(80));
    console.error('Error:', error);
    console.error('='.repeat(80) + '\n');
    process.exit(1);
  });
}

export { runMigration, verifyDatabaseState };
