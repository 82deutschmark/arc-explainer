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
const PUZZLE_IDS = ['7e0986d6', '543a7ed5', 'f76d97a5', '484b58aa', '4c4377d9', '855e0971', '3618c87e', '88a62173', '40853293', '85c4e7cd', '6cf79266', '82819916', '05269061', '54d82841', '5bd6f4ac', '017c7c7b', 'a9f96cdd', '46442a0e', 'c59eb873', '93b581b8', 'd90796e8', 'ded97339', '913fb3ed', '29623171', '3906de3d', '29ec7d0e', '9ecd008a', 'f5b8619d', '746b3537', '68b16354', 'f1cefba8', 'ce22a75a', '23581191', '67385a82', 'a416b8f3', 'ce4f8723', '1f642eb9', '1c786137', '6d0160f0', '5168d44c', '2281f1f4', '6d75e8bb', 'bd4472b8', 'cf98881b', 'b60334d2', '6f8cd79b', '4be741c5', 'a699fb00', 'd4a91cb9', 'bda2d7a6', '0dfd9992', 'fafffa47', 'eb5a1d5d', 'd406998b', '56dc2b01', 'b1948b0a', '1f876c06', '25ff71a9', 'b9b7f026', '22168020', '75b8110e', '9af7a82c', '23b5c85d', '62c24649', '0b148d64', 'b6afb2da', '0d3d703e', '49d1d64f', '05f2a901', '3eda0437', '99fa7670', '0962bcdd', '995c5fa3', '363442ee', 'b8cdaf2b', 'eb281b96', '1f85a75f', '1190e5a7', '3428a4f5', 'bbc9ae5d', '3ac3eb23', '6e02f1e3', 'bb43febb', '00d62c1b', '2dee498d', '496994bd', '3befdf3e', 'bdad9b1f', '36fdfd69', '7b7f7511', '27a28665', 'a79310a0', 'c8cbb738', 'c8f0f002', '3c9b0459', 'ea786f4a', 'd9fac9be', '890034e9', '41e4d17e', 'ba26e723', 'dc0a314f', 'a740d043', '007bbfb7', '5582e5ca', 'd511f180', '6d0aefbc', '99b1bc43', '694f12f3', '1e0a9b12', 'd8c310e9', 'a68b268e', 'feca6190', '6150a2bd', '29c11459', '94f9d214', 'a87f7484', '7f4411dc', '6fa7a44f', '90c28cc7', 'b91ae062', '08ed6ac7', '46f33fce', '4522001f', 'c1d99e64', '445eab21', 'b548a754', 'e50d258f', '9565186b', '91413438', '7c008303', 'dc1df850', '1cf80156', '4347f46a', 'e26a3af2', 'b2862040', 'a5f85a15', '22eb0ac0', '74dd1130', '3bdb4ada', '6c434453', 'dc433765', 'ed36ccf7', '794b24be', '95990924', 'd037b0a7', '9edfc990', '50cb2852', 'f25ffba3', '9172f3a0', 'c909285e', 'ec883f72', 'e9afcf9a', '1caeab9d', 'b0c4d837', 'f8ff0b80', 'a85d4709', '1bfc4729', '239be575', '8731374e', 'a3df8b1e', '3af2c5a8', 'a8c38be5', 'd631b094', 'a5313dff', 'd6ad076f', '2013d3e2', '780d0b14', '9dfd6313', 'a1570a43', '8eb1be9a', 'ba97ae07', 'c9e6f938', '8d5021e8', '2c608aff', '8e5a5113', 'b190f7f5', '63613498', '963e52fc', '7447852a', 'e76a88a6', 'c3f564a4', 'ce9e57f2', '8be77c9e', 'ff28f65a', '2bee17df', 'b94a9452', 'c3e719e8', 'e8593010', '54d9e175', '662c240a', 'c9f8e694', 'd5d6de2d', '2dc579da', '623ea044', 'af902bf9', 'de1cd16c', '7fe24cdd', 'ddf7fa4f', '44f52bb0', 'd10ecb37', 'f2829549', 'ac0a08a4', 'be94b721', '67a423a3', '1b2d62fb', 'd13f3404', 'caa06a1f', '834ec97d', '6773b310', 'd0f5fe59', '228f6490', '941d9a10', 'd9f24cd1', 'ae4f1146', 'bc1d5164', 'cce03e0d', '9aec4887', 'b782dc8a', '4258a5f9', '810b9b61', '06df4c85', '67e8384a', 'aabf363d', 'f25fbde4', '760b3cac', 'f9012d9b', 'd4469b4b', '6430c8c4', '77fdfe62', 'ce602527', '67a3c6ac', '0520fde7', '539a4f51', '8efcae92', 'e9614598', 'cdecee7f', 'dae9d2b5', 'd23f8c26', 'd687bc17', '9f236235', 'b8825c91', 'beb8660c', '25d8a9c8', '97999447', '56ff96f3', '09629e4f', '53b68214', 'aedd82e4', '3bd67248', 'db3e9e38', '253bf280', '28e73c20', 'e179c5f4', '5614dbcf']

interface PuzzleResult {
  puzzle_id: string;
  correct_models: string[];
  total_attempts: number;
}

interface PuzzleStatus {
  solved: string[];
  tested_but_not_solved: string[];
  not_tested: string[];
  missing_from_db: string[]; // Puzzles in PUZZLE_IDS but not in database at all
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
    not_tested: [],
    missing_from_db: []
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

    // First, find all puzzles from PUZZLE_IDS that aren't in the database at all
    const allPuzzleIdsSet = new Set(PUZZLE_IDS);
    const missingPuzzles = [...allPuzzleIdsSet].filter(id => !testedPuzzles.has(id));
    
    // Categorize puzzles
    for (const puzzleId of PUZZLE_IDS) {
      if (solvedPuzzles.has(puzzleId)) {
        status.solved.push(puzzleId);
      } else if (testedPuzzles.has(puzzleId)) {
        status.tested_but_not_solved.push(puzzleId);
      } else if (missingPuzzles.includes(puzzleId)) {
        status.missing_from_db.push(puzzleId);
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
  
  console.log(`✅ SOLVED (${puzzleStatus.solved.length} puzzles):`);
  puzzleStatus.solved.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log(`\n🔄 TESTED BUT INCORRECT (${puzzleStatus.tested_but_not_solved.length} puzzles):`);
  puzzleStatus.tested_but_not_solved.forEach(puzzle => console.log(`   • ${puzzle}`));

  console.log(`\n❓ NOT TESTED (${puzzleStatus.not_tested.length} puzzles):`);
  puzzleStatus.not_tested.forEach(puzzle => console.log(`   • ${puzzle}`));
  
  if (puzzleStatus.missing_from_db.length > 0) {
    console.log(`\n🔍 MISSING FROM DATABASE (${puzzleStatus.missing_from_db.length} puzzles):`);
    console.log(puzzleStatus.missing_from_db.join(', '));
    
    // Format as array for easy copy-paste into analyze-unsolved-puzzles.ts
    console.log('\n📋 Copy-paste this into analyze-unsolved-puzzles.ts:');
    console.log(`  missingFromDb: [
    '${puzzleStatus.missing_from_db.join("',\n    '")}'
  ]`);
  }
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
