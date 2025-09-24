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
    '08573cc6', '0becf7df', '0d87d2a6', '1acc24af', '1c56ad9f', '1d398264', '1da012fc', '2037f2c7', '25094a63', '2697da3f', '351d6448', '358ba94e', '3b4c2228', '42a15761', '4b6b68e5', '4c177718', '5833af48', '5a5a2103', '5ffb2104', '62ab2642', '64a7c07e', '67636eac', '692cd3b6', '696d4842', '73ccf9c2', '88207623', '8b28cd80', '8ba14f53', '8cb8642d', '8fbca751', '929ab4e9', '92e50de0', '9356391f', '94be5b80', '99306f82', '9b4c17c4', '9ddd00f0', 'ac2e8ecf', 'ac3e2b04', 'b0722778', 'b0f4d537', 'b7999b51', 'bb52a14b', 'bf32578f', 'bf699163', 'c64f1187', 'c8b7cc0f', 'c92b942c', 'd56f2372', 'dd2401ed', 'e5c44e8f', 'e6de6e8f', 'e88171ec', 'e95e3d8e', 'f3b10344', 'f3e62deb', 'f5aa3634', 'f823c43c'
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

  puzzleStatus.solved.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log(`\n🔄 TESTED BUT NOT SOLVED (${puzzleStatus.tested_but_not_solved.length} puzzles):`);
  puzzleStatus.tested_but_not_solved.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log(`   Not tested: ${puzzleStatus.not_tested.length} (${((puzzleStatus.not_tested.length / PUZZLE_IDS.length) * 100).toFixed(1)}%)`);
}

/**
 * Display a summary of which models solved which puzzles
 */
function displayModelSummary(puzzleResults: PuzzleResult[]): void {
  console.log('\n🎯 MODEL SOLVING SUMMARY:');
  console.log('='.repeat(80));

  // Create a map of models to the puzzles they solved
  const modelToPuzzles = new Map<string, string[]>();

  for (const result of puzzleResults) {
    if (result.correct_models.length > 0) {
      for (const model of result.correct_models) {
        if (!modelToPuzzles.has(model)) {
          modelToPuzzles.set(model, []);
        }
        modelToPuzzles.get(model)!.push(result.puzzle_id);
      }
    }
  }

  // Sort models by number of puzzles solved (descending)
  const sortedModels = Array.from(modelToPuzzles.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  if (sortedModels.length === 0) {
    console.log('No puzzles were solved by any models.');
    return;
  }

  console.log(`\n📊 ${sortedModels.length} models found with correct solutions:\n`);

  for (const [model, puzzles] of sortedModels) {
    console.log(`🤖 ${model}:`);
    console.log(`   Solved ${puzzles.length} puzzles:`);

    // Sort puzzle IDs for consistent display
    puzzles.sort();
    puzzles.forEach((puzzleId, index) => {
      console.log(`      ${index + 1}. ${puzzleId}`);
    });
    console.log('');
  }

  // Show total statistics
  const totalSolvedPuzzles = new Set(
    puzzleResults
      .filter(result => result.correct_models.length > 0)
      .map(result => result.puzzle_id)
  ).size;

  console.log(`📈 OVERALL STATISTICS:`);
  console.log(`   Models with solutions: ${sortedModels.length}`);
  console.log(`   Total puzzles solved: ${totalSolvedPuzzles} (at least once)`);
  console.log(`   Average puzzles per model: ${(totalSolvedPuzzles / sortedModels.length).toFixed(1)}`);
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

    // Display model summary
    displayModelSummary(puzzleResults);

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
main();
