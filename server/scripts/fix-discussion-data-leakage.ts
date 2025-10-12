/**
 * fix-discussion-data-leakage.ts
 *
 * Author: Claude Code (Sonnet 4.5)
 * Date: 2025-10-11
 * PURPOSE: Fix database entries affected by the discussion mode data leakage bug.
 *          Sets is_prediction_correct and multi_test_all_correct to FALSE for entries
 *          that were marked correct but had access to test answers.
 *
 * SRP/DRY check: Pass - Single responsibility: fix contaminated entries
 *
 * SAFETY: Updates only specific IDs identified by the audit script.
 *
 * Usage:
 *   npm run fix:discussion
 *   node --import tsx server/scripts/fix-discussion-data-leakage.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { repositoryService } from '../repositories/RepositoryService.js';
import { getPool } from '../repositories/base/BaseRepository.js';

// Get directory paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// IDs identified by audit script as having data leakage
const CONTAMINATED_IDS = [
  34430, 34420, 34419, 33696, 33680, 30507, 30504, 30193, 30074, 30043,
  30011, 30003, 29991, 29989, 29983, 29975, 29957, 29945, 29885, 29775
];

async function fixDataLeakage() {
  console.log('\n🔧 DISCUSSION MODE DATA LEAKAGE FIX');
  console.log('='.repeat(70));
  console.log('Purpose: Fix entries that were marked correct with data leakage');
  console.log('Action: Set is_prediction_correct and multi_test_all_correct to FALSE');
  console.log('='.repeat(70));
  console.log();

  // Initialize database connection
  console.log('🔌 Connecting to database...');
  const dbConnected = await repositoryService.initialize();

  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Check your DATABASE_URL environment variable.');
    process.exit(1);
  }

  console.log('✅ Database connected\n');

  try {
    const pool = getPool();
    if (!pool) {
      throw new Error('Database pool not available');
    }

    // Step 1: Verify entries exist and show before state
    console.log(`📋 STEP 1: Verify ${CONTAMINATED_IDS.length} entries before fix\n`);

    const beforeResult = await pool.query(`
      SELECT
        id,
        puzzle_id,
        model_name,
        is_prediction_correct,
        multi_test_all_correct,
        created_at
      FROM explanations
      WHERE id = ANY($1::int[])
      ORDER BY id DESC
    `, [CONTAMINATED_IDS]);

    const beforeEntries = beforeResult.rows;

    console.log(`Found ${beforeEntries.length} entries to update:\n`);
    console.log('ID      Puzzle      Model                  IsPred  Multi   Created');
    console.log('======  ==========  ====================  ======  ======  ===================');

    beforeEntries.forEach((e: any) => {
      const isPred = e.is_prediction_correct === true ? 'TRUE ' : (e.is_prediction_correct === false ? 'FALSE' : 'null ');
      const multi = e.multi_test_all_correct === true ? 'TRUE ' : (e.multi_test_all_correct === false ? 'FALSE' : 'null ');

      console.log(
        `${String(e.id).padEnd(6)}  ` +
        `${e.puzzle_id.padEnd(10)}  ` +
        `${e.model_name.substring(0, 20).padEnd(20)}  ` +
        `${isPred}   ` +
        `${multi}   ` +
        `${new Date(e.created_at).toISOString().substring(0, 19)}`
      );
    });
    console.log();

    if (beforeEntries.length === 0) {
      console.log('⚠️  No entries found to update. They may have already been fixed.');
      process.exit(0);
    }

    // Step 2: Execute the fix
    console.log(`🚀 STEP 2: Executing fix for ${beforeEntries.length} entries...\n`);

    const updateResult = await pool.query(`
      UPDATE explanations
      SET
        is_prediction_correct = FALSE,
        multi_test_all_correct = FALSE
      WHERE id = ANY($1::int[])
      RETURNING id
    `, [CONTAMINATED_IDS]);

    console.log(`✅ Updated ${updateResult.rowCount} entries\n`);

    // Step 3: Verify the fix
    console.log('🔍 STEP 3: Verify entries after fix\n');

    const afterResult = await pool.query(`
      SELECT
        id,
        puzzle_id,
        model_name,
        is_prediction_correct,
        multi_test_all_correct,
        created_at
      FROM explanations
      WHERE id = ANY($1::int[])
      ORDER BY id DESC
    `, [CONTAMINATED_IDS]);

    const afterEntries = afterResult.rows;

    console.log('ID      Puzzle      Model                  IsPred  Multi   Created');
    console.log('======  ==========  ====================  ======  ======  ===================');

    afterEntries.forEach((e: any) => {
      const isPred = e.is_prediction_correct === true ? 'TRUE ' : (e.is_prediction_correct === false ? 'FALSE' : 'null ');
      const multi = e.multi_test_all_correct === true ? 'TRUE ' : (e.multi_test_all_correct === false ? 'FALSE' : 'null ');

      console.log(
        `${String(e.id).padEnd(6)}  ` +
        `${e.puzzle_id.padEnd(10)}  ` +
        `${e.model_name.substring(0, 20).padEnd(20)}  ` +
        `${isPred}   ` +
        `${multi}   ` +
        `${new Date(e.created_at).toISOString().substring(0, 19)}`
      );
    });
    console.log();

    // Step 4: Final verification
    console.log('='.repeat(70));
    console.log('📊 FINAL VERIFICATION');
    console.log('='.repeat(70));

    const stillCorrect = afterEntries.filter((e: any) =>
      e.is_prediction_correct === true || e.multi_test_all_correct === true
    );

    const nowIncorrect = afterEntries.filter((e: any) =>
      e.is_prediction_correct === false || e.multi_test_all_correct === false
    );

    console.log(`Total entries processed: ${afterEntries.length}`);
    console.log(`Now marked INCORRECT: ${nowIncorrect.length}`);
    console.log(`Still marked CORRECT: ${stillCorrect.length}`);

    if (stillCorrect.length === 0) {
      console.log('\n✅ SUCCESS: All contaminated entries have been fixed!');
      console.log('   All 20 entries are now correctly marked as FALSE.');
    } else {
      console.log('\n⚠️  WARNING: Some entries are still marked correct:');
      stillCorrect.forEach((e: any) => {
        console.log(`   ID ${e.id}: is_prediction_correct=${e.is_prediction_correct}, multi_test_all_correct=${e.multi_test_all_correct}`);
      });
    }

    console.log('='.repeat(70));
    console.log();

  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute fix
fixDataLeakage()
  .then(() => {
    console.log('✅ Fix complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ FATAL ERROR:', err);
    process.exit(1);
  });
