/**
 *
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-23
 * PURPOSE: Query database for puzzle analysis results to identify which models solved specific puzzles and categorize all puzzles by their testing status
 * SRP and DRY check: Pass - This script handles database queries and result formatting for puzzle analysis tracking
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

/**
 * List of puzzle IDs to analyze (without trailing slashes)
 */
const PUZZLE_IDS = [
  '05a7bcf2', '1e97544e', '477d2879', '85fa5666', 'ac0c5833', 'd94c3b52', 'f5c89df1',
  '0607ce86', '2037f2c7', '47996f11', '8719f442', 'af22c60d', 'da515329', 'f8be4b64',
  '0934a4d8', '20981f0e', '4aab4007', '891232d6', 'b15fca0b', 'dc2aa30b', 'f9a67cb5',
  '09c534e7', '212895b5', '4e45f183', '896d5239', 'b20f7c8b', 'de493100', 'f9d67f8b',
  '0a2355a6', '22a4bbc2', '50f325b5', '93c31fbe', 'b457fec5', 'e1d2900e', 'fd096ab6',
  '0e671a1a', '2546ccf6', '54db823b', '94133066', 'b7f8a4d8', 'e2092e0c', 'fd4b2b02',
  '103eff5b', '2c0b0aff', '551d5bf1', '96a8c0cd', 'b942fd60', 'e619ca6e', 'fea12743',
  '136b0064', '3391f8c0', '67b4a34d', '981571dc', 'b9630600', 'e681b708',
  '14754a24', '3490cc26', '79369cc6', '992798f6', 'bd14c3bf', 'e78887d1',
  '15113be4', '37d3e8b2', '79fb03f4', '9b2a60aa', 'c6e1b8da', 'ecaa0ec1',
  '16b78196', '3ed85e70', '7c9b52a0', '9caba7c3', 'ce039d91', 'f21745ec',
  '18419cfa', '40f6cd08', '7d419a02', 'a096bf4d', 'cfb2ce5a', 'f3b10344',
  '184a9768', '456873bc', '85b81ff1', 'a8610ef7', 'd931c21c', 'f4081712'
];

interface PuzzleResult {
  puzzle_id: string;
  correct_models: string[];
  total_attempts: number;
}

interface PuzzleStatus {
  solved: string[];
  tested_but_not_solved: string[];
  not_tested: string[];
}

/**
 * Get all models that correctly solved specific puzzles
 */
async function getCorrectModelsForPuzzles(): Promise<PuzzleResult[]> {
  const results: PuzzleResult[] = [];

  for (const puzzleId of PUZZLE_IDS) {
    try {
      const query = `
        SELECT DISTINCT model_name
        FROM explanations
        WHERE puzzle_id = $1
        AND (is_prediction_correct = true OR multi_test_all_correct = true)
        ORDER BY model_name
      `;

      const result = await pool.query(query, [puzzleId]);

      results.push({
        puzzle_id: puzzleId,
        correct_models: result.rows.map(row => row.model_name),
        total_attempts: result.rowCount || 0
      });
    } catch (error) {
      console.error(`Error querying puzzle ${puzzleId}:`, error);
      results.push({
        puzzle_id: puzzleId,
        correct_models: [],
        total_attempts: 0
      });
    }
  }

  return results;
}

/**
 * Categorize all puzzles by their testing and solving status
 */
async function categorizeAllPuzzles(): Promise<PuzzleStatus> {
  const status: PuzzleStatus = {
    solved: [],
    tested_but_not_solved: [],
    not_tested: []
  };

  try {
    // Get all unique puzzle IDs from the database
    const allPuzzlesQuery = `
      SELECT DISTINCT puzzle_id
      FROM explanations
      ORDER BY puzzle_id
    `;

    const allPuzzlesResult = await pool.query(allPuzzlesQuery);
    const testedPuzzles = new Set(allPuzzlesResult.rows.map(row => row.puzzle_id));

    // Check which puzzles have correct solutions
    const solvedQuery = `
      SELECT DISTINCT puzzle_id
      FROM explanations
      WHERE is_prediction_correct = true OR multi_test_all_correct = true
      ORDER BY puzzle_id
    `;

    const solvedResult = await pool.query(solvedQuery);
    const solvedPuzzles = new Set(solvedResult.rows.map(row => row.puzzle_id));

    // Categorize puzzles
    for (const puzzleId of PUZZLE_IDS) {
      if (solvedPuzzles.has(puzzleId)) {
        status.solved.push(puzzleId);
      } else if (testedPuzzles.has(puzzleId)) {
        status.tested_but_not_solved.push(puzzleId);
      } else {
        status.not_tested.push(puzzleId);
      }
    }

  } catch (error) {
    console.error('Error categorizing puzzles:', error);
  }

  return status;
}

/**
 * Display results in a formatted way
 */
function displayResults(puzzleResults: PuzzleResult[], puzzleStatus: PuzzleStatus): void {
  console.log('🔍 PUZZLE ANALYSIS RESULTS\n');

  console.log('📊 SPECIFIC PUZZLE CORRECT MODELS:');
  console.log('='.repeat(80));

  for (const result of puzzleResults) {
    console.log(`\n🎯 Puzzle: ${result.puzzle_id}`);
    console.log(`   ✅ Correct models (${result.correct_models.length}):`);
    if (result.correct_models.length > 0) {
      result.correct_models.forEach((model, index) => {
        console.log(`      ${index + 1}. ${model}`);
      });
    } else {
      console.log('      No correct solutions found');
    }
    console.log(`   📊 Total attempts: ${result.total_attempts}`);
  }

  console.log('\n📈 PUZZLE STATUS SUMMARY:');
  console.log('='.repeat(80));

  console.log(`\n✅ SOLVED (${status.solved.length} puzzles):`);
  status.solved.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log(`\n🔄 TESTED BUT NOT SOLVED (${status.tested_but_not_solved.length} puzzles):`);
  status.tested_but_not_solved.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log(`\n❓ NOT TESTED (${status.not_tested.length} puzzles):`);
  status.not_tested.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log('\n📊 SUMMARY STATISTICS:');
  console.log(`   Total puzzles analyzed: ${PUZZLE_IDS.length}`);
  console.log(`   Solved: ${status.solved.length} (${((status.solved.length / PUZZLE_IDS.length) * 100).toFixed(1)}%)`);
  console.log(`   Tested but unsolved: ${status.tested_but_not_solved.length} (${((status.tested_but_not_solved.length / PUZZLE_IDS.length) * 100).toFixed(1)}%)`);
  console.log(`   Not tested: ${status.not_tested.length} (${((status.not_tested.length / PUZZLE_IDS.length) * 100).toFixed(1)}%)`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 Starting puzzle analysis...\n');

    // Get correct models for specific puzzles
    const puzzleResults = await getCorrectModelsForPuzzles();

    // Categorize all puzzles
    const puzzleStatus = await categorizeAllPuzzles();

    // Display results
    displayResults(puzzleResults, puzzleStatus);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
main();
