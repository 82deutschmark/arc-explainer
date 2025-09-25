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
const PUZZLE_IDS = ['37d3e8b2', '67c52801', '9772c176', '7d1f7ee8', '00dbd492', '070dd51e', '4c177718', 'a04b2602', '31adaf00', '99306f82', '695367ec', '0a1d4ef5', 'd304284e', '58743b76', 'bf32578f', '0692e18c', 'cad67732', '712bf12e', '3b4c2228', '505fff84', '0becf7df', 'b7999b51', '642248e4', 'a406ac07', 'e5c44e8f', 'd94c3b52', 'ff72ca3e', '31d5ba1a', 'e88171ec', '7c9b52a0', '3a301edc', 'e4075551', '7039b2d7', 'd37a1ef5', '0c786b71', '2037f2c7', 'ea9794b1', 'e95e3d8e', '6ea4a07e', '59341089', 'dd2401ed', 'e74e1818', '0bb8deee', '9a4bb226', 'fc754716', 'e99362f0', '9f27f097', '55783887', 'bc4146bd', '770cc55f', 'cf133acc', 'ed74f2f2', 'c663677b', 'f3e62deb', '4852f2fa', '845d6e51', '9c1e755f', '5b6cbef5', '696d4842', '7d18a6fb', '95a58926', 'd2acf2cb', '256b0a75', '642d658d', '917bccba', 'da2b0fe3', '0e671a1a', '5b526a93', 'e66aafb8', 'c3202e5a', '332efdb3', '55059096', 'af24b4cc', 'df8cc377', '2685904e', '009d5c81', '58e15b12', '7c8af763', 'fe9372f3', '32e9702f', '2f0c5170', '67636eac', '60c09cac', '782b5218', '8e2edd66', 'bf699163', '60a26a3e', '15663ba9', '66f2d22f', '3f23242b', 'b4a43f3b', '6ad5bdfd', 'ae58858e', '0b17323b', 'c87289bb', '0f63c0b9', 'e9bb6954', 'ed98d772', 'd492a647', '1da012fc', '6a11f6da', '1d398264', '11e1fe23', '1a6449f1', '575b1a71', '4cd1b7b2', '50aad11f', 'c7d4e6ad', '414297c0', 'ac2e8ecf', 'c97c0139', '3ee1011a', 'bbb1b8b6', 'ac3e2b04', '195ba7dc', 'a680ac02', '69889d6e', '1d0a4b61', 'dc2e9a9d', '9356391f', 'c1990cce', '5833af48', 'e5790162', 'd4c90558', 'aee291af', '62ab2642', '45737921', 'aa18de87', 'e345f17b', '817e6c09', '52fd389e', '9c56f360', '0d87d2a6', 'aab50785', '92e50de0', '48131b3c', 'c64f1187', '4aab4007', '4b6b68e5', 'ca8f78db', 'e760a62e', 'e633a9e5', 'f0df5ff0', '72207abc', 'c92b942c', 'e57337a4', '6df30ad6', '97239e3d', '8cb8642d', 'e0fb7511', 'e41c6fd3', '5ffb2104', 'bb52a14b', 'f3cdc58f', '1e97544e', '42918530', '62b74c02', 'ba9d41b8', 'f83cb3f6', '5289ad53', 'a934301b', '84db8fc4', '15696249', '759f3fd3', 'bf89d739', '19bb5feb', '1acc24af', '12422b43', '94be5b80', 'fb791726', '358ba94e', '9110e3c5', '9b4c17c4', 'ac605cbb', '88207623', 'cb227835', 'aa300dc3', '21f83797', '90347967', '7bb29440', '310f3251', '3194b014', '72a961c9', '9bebae7a', '2697da3f', '0c9aba6e', '4acc7107', '4ff4c9da', '4f537728', '54db823b', 'fafd9572', '1c0d0a4b', '8dae5dfc', 'c8b7cc0f', '03560426', '42a15761', 'b1fc8b8e', '48f8583b', '2c737e39', 'd282b262', '12eac192', '81c0276b', 'c48954c1', 'f3b10344', '423a55dc', '516b51b7', '3d31c5b3', '34b99a2b', '68b67ca3', 'd4b1c2b1', '73182012', 'e9b4f6fc', 'a57f2f04', '66e6c45b', '3979b1a8', '73c3b0d8', 'c35c1b4c', '626c0bcc', 'e9ac8c9e', 'f45f5ca7', 'b0f4d537', 'c658a4bd', '6f473927', '929ab4e9', '33b52de3', '1c02dbbe', '8b28cd80', '903d1b4a', 'e69241bd', '9ddd00f0', '9b365c51', 'ccd554ac', '4e469f39', 'e1baa8a4', '8fbca751', '9def23fe', 'b7fb29bc', 'ef26cbf6', '5af49b42', 'ce8d95cc', '5783df64', 'aa4ec2a5', '08573cc6', 'f5aa3634', 'd19f7514', '292dd178', 'c074846d', 'e6de6e8f', '1c56ad9f', '84f2aca1', '25094a63', 'ad7e01d0', 'e21a174a', '5d2a5c43', '20818e16', '45bbe264', 'a3f84088', '2072aba6', '94414823', '93b4f4b3', '2a5f8217', 'b7cb93ac', '5207a7b5', '2b01abd0', 'ea959feb', '351d6448', '29700607', '692cd3b6', '7e02026e', '319f2597', 'f823c43c', '7953d61e', '281123b4', '8ba14f53', 'd56f2372', 'e872b94a', '833dafe3', 'baf41dbf', '27a77e38', '4364c1c4', '705a3229', '17cae0c1', 'be03b35f', '12997ef3', 'bcb3040b', '137f0df0', '7ee1c6ea', '00576224', '5a5a2103', 'd017b73f', '1a2e2828', '140c817e', '8597cfd7', 'ca8de6ea', '762cd429', 'a59b95c0', '8ee62060', 'e7639916', 'e9c9d9a1', '13713586', '1990f7a8', '73ccf9c2', '2753e76c', '1e81d6f9', 'e133d23d', '27f8ce4f', 'e7b06bea', 'f0afb749', '639f5a19', '17b80ad2', '8a371977', '963f59bc', 'e7dd8335', 'd47aa2ff', '604001fa', '506d28a5', 'd5c634a2', '18419cfa', 'c62e2108', 'e7a25a18', '64a7c07e', '5b692c0f', 'cd3c21df', '50a16a69', 'b0722778'   
]


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

  console.log(`\n🔄 TESTED BUT NOT SOLVED (${puzzleStatus.tested_but_not_solved.length} puzzles):`);
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
