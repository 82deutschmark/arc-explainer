/**
 * audit-discussion-entries.ts
 *
 * Author: Claude Code (Sonnet 4.5)
 * Date: 2025-10-11
 * PURPOSE: Read-only audit of discussion mode entries to identify data affected by
 *          the data leakage bug (omitAnswer: false). Shows detailed report WITHOUT
 *          making any database changes. User reviews output before deciding on fixes.
 *
 * SRP/DRY check: Pass - Single responsibility: audit and report only
 *
 * SAFETY: This script is READ-ONLY. It makes NO changes to the database.
 *
 * Usage:
 *   npm run audit:discussion
 *   node --import tsx server/scripts/audit-discussion-entries.ts
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

interface DiscussionEntry {
  id: number;
  puzzle_id: string;
  model_name: string;
  is_prediction_correct: boolean | null;
  multi_test_all_correct: boolean | null;
  trustworthiness_score: number | null;
  confidence: number | null;
  created_at: Date;
  prompt_template_id: string;
}

async function auditDiscussionEntries() {
  console.log('\n📊 DISCUSSION MODE ENTRIES AUDIT');
  console.log('='.repeat(70));
  console.log('Purpose: Identify entries affected by data leakage bug');
  console.log('Status: READ-ONLY - No database changes will be made');
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

    // Get all discussion entries from last 14 days
    const result = await pool.query<DiscussionEntry>(`
      SELECT
        id,
        puzzle_id,
        model_name,
        is_prediction_correct,
        multi_test_all_correct,
        trustworthiness_score,
        confidence,
        created_at,
        prompt_template_id
      FROM explanations
      WHERE prompt_template_id = 'discussion'
        AND created_at >= NOW() - INTERVAL '14 days'
      ORDER BY created_at DESC
    `);

    const entries = result.rows;

    if (entries.length === 0) {
      console.log('✅ No discussion mode entries found in last 14 days');
      console.log('   No action needed.\n');
      return;
    }

    // Basic stats
    console.log(`📈 SUMMARY:`);
    console.log(`   Total discussion entries: ${entries.length}`);
    console.log();

    // Date-based breakdown
    const FIX_DATE = new Date('2025-10-11 09:00:00');
    const beforeFix = entries.filter(e => new Date(e.created_at) < FIX_DATE);
    const afterFix = entries.filter(e => new Date(e.created_at) >= FIX_DATE);

    console.log(`📅 BY DATE (fix applied at 2025-10-11 09:00):`);
    console.log(`   Before fix: ${beforeFix.length} entries  ← POTENTIALLY CONTAMINATED`);
    console.log(`   After fix:  ${afterFix.length} entries  ← CLEAN (omitAnswer: true)`);
    console.log();

    if (beforeFix.length === 0) {
      console.log('✅ No entries before fix date - all data is clean!\n');
      return;
    }

    // Correctness breakdown (only for before-fix entries)
    const correctBeforeFix = beforeFix.filter(e =>
      e.is_prediction_correct === true || e.multi_test_all_correct === true
    );
    const incorrectBeforeFix = beforeFix.filter(e =>
      e.is_prediction_correct === false ||
      (e.multi_test_all_correct === false && e.is_prediction_correct !== true)
    );

    console.log(`🎯 CORRECTNESS (entries before fix only):`);
    console.log(`   Marked CORRECT:   ${correctBeforeFix.length} entries  ← INVALID (had test answers)`);
    console.log(`   Marked INCORRECT: ${incorrectBeforeFix.length} entries  ← Valid (guessed wrong even with answers)`);
    console.log();

    // Show ALL "correct" entries in detail (these need fixing)
    if (correctBeforeFix.length > 0) {
      console.log(`🔍 DETAILED VIEW - ALL "CORRECT" ENTRIES BEFORE FIX:`);
      console.log(`   (These entries show "correct" but AI had access to test answers)`);
      console.log();
      console.log('ID      Puzzle      Model                  Created              IsPred  Multi   Trust   Conf');
      console.log('======  ==========  ====================  ===================  ======  ======  ======  ====');

      correctBeforeFix.forEach(e => {
        const isPred = e.is_prediction_correct === true ? 'TRUE ' : (e.is_prediction_correct === false ? 'FALSE' : 'null ');
        const multi = e.multi_test_all_correct === true ? 'TRUE ' : (e.multi_test_all_correct === false ? 'FALSE' : 'null ');
        const trust = e.trustworthiness_score !== null ? e.trustworthiness_score.toFixed(2).padEnd(4) : 'null';
        const conf = e.confidence !== null ? String(e.confidence).padEnd(3) : 'null';

        console.log(
          `${String(e.id).padEnd(6)}  ` +
          `${e.puzzle_id.padEnd(10)}  ` +
          `${e.model_name.substring(0, 20).padEnd(20)}  ` +
          `${new Date(e.created_at).toISOString().substring(0, 19)}  ` +
          `${isPred}   ` +
          `${multi}   ` +
          `${trust}   ` +
          `${conf}`
        );
      });
      console.log();

      // Generate list of IDs for easy copy-paste
      console.log(`📋 IDs TO FIX (copy this list):`);
      console.log(`   ${correctBeforeFix.map(e => e.id).join(', ')}`);
      console.log();
    }

    // Model breakdown (before fix only)
    const byModel = beforeFix.reduce((acc, e) => {
      if (!acc[e.model_name]) {
        acc[e.model_name] = { total: 0, correct: 0, incorrect: 0 };
      }
      acc[e.model_name].total++;
      if (e.is_prediction_correct === true || e.multi_test_all_correct === true) {
        acc[e.model_name].correct++;
      } else {
        acc[e.model_name].incorrect++;
      }
      return acc;
    }, {} as Record<string, { total: number; correct: number; incorrect: number }>);

    console.log(`🤖 BY MODEL (entries before fix):`);
    Object.entries(byModel)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([model, stats]) => {
        console.log(`   ${model.padEnd(30)} ${stats.total} total (${stats.correct} correct, ${stats.incorrect} incorrect)`);
      });
    console.log();

    // Puzzle breakdown (before fix only, top 10)
    const byPuzzle = beforeFix.reduce((acc, e) => {
      if (!acc[e.puzzle_id]) {
        acc[e.puzzle_id] = { total: 0, correct: 0, incorrect: 0 };
      }
      acc[e.puzzle_id].total++;
      if (e.is_prediction_correct === true || e.multi_test_all_correct === true) {
        acc[e.puzzle_id].correct++;
      } else {
        acc[e.puzzle_id].incorrect++;
      }
      return acc;
    }, {} as Record<string, { total: number; correct: number; incorrect: number }>);

    const topPuzzles = Object.entries(byPuzzle)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    console.log(`🧩 BY PUZZLE (top 10, entries before fix):`);
    topPuzzles.forEach(([puzzle, stats]) => {
      console.log(`   ${puzzle}  ${stats.total} attempts (${stats.correct} correct, ${stats.incorrect} incorrect)`);
    });
    console.log();

    // CSV export for spreadsheet analysis
    console.log('='.repeat(70));
    console.log('📄 CSV EXPORT FOR SPREADSHEET ANALYSIS:');
    console.log('='.repeat(70));
    console.log('id,puzzle_id,model_name,is_prediction_correct,multi_test_all_correct,trustworthiness_score,confidence,created_at,before_fix');
    entries.forEach(e => {
      const beforeFixFlag = new Date(e.created_at) < FIX_DATE ? 'YES' : 'NO';
      console.log(
        `${e.id},` +
        `${e.puzzle_id},` +
        `${e.model_name},` +
        `${e.is_prediction_correct},` +
        `${e.multi_test_all_correct},` +
        `${e.trustworthiness_score},` +
        `${e.confidence},` +
        `${e.created_at},` +
        `${beforeFixFlag}`
      );
    });
    console.log();

    // Summary and recommendation
    console.log('='.repeat(70));
    console.log('📌 RECOMMENDATIONS:');
    console.log('='.repeat(70));

    if (correctBeforeFix.length > 0) {
      console.log(`⚠️  ${correctBeforeFix.length} entries need correction`);
      console.log(`    These entries show "correct" but AI had access to test answers.`);
      console.log();
      console.log(`    Recommended fix:`);
      console.log(`    UPDATE explanations`);
      console.log(`    SET is_prediction_correct = FALSE,`);
      console.log(`        multi_test_all_correct = FALSE`);
      console.log(`    WHERE id IN (${correctBeforeFix.map(e => e.id).join(', ')});`);
      console.log();
      console.log(`    This will set ${correctBeforeFix.length} entries to "incorrect" (they had unfair advantage).`);
    } else {
      console.log(`✅ No "correct" entries found before fix date`);
      console.log(`   All data is already in the correct state!`);
    }

    console.log();
    console.log('='.repeat(70));
    console.log('✅ AUDIT COMPLETE - No database changes made');
    console.log('='.repeat(70));
    console.log();

  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Execute audit
auditDiscussionEntries()
  .then(() => {
    console.log('Review the output above and decide which entries to fix.');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ FATAL ERROR:', err);
    process.exit(1);
  });
