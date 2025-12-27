import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Get all explanations for Johan_Land_Solver_V6
  const result = await pool.query(`
    SELECT
      puzzle_id,
      ((provider_raw_response->>'pair_index')::int) as pair_index,
      is_prediction_correct
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
    ORDER BY puzzle_id, pair_index, is_prediction_correct DESC
  `);

  // Group by (puzzle_id, pair_index) and check if ANY attempt in that pair is correct
  const puzzles = new Map();

  result.rows.forEach(row => {
    if (!puzzles.has(row.puzzle_id)) {
      puzzles.set(row.puzzle_id, new Map());
    }
    const pairs = puzzles.get(row.puzzle_id);

    // Mark pair as solved if ANY attempt is correct
    if (!pairs.has(row.pair_index)) {
      pairs.set(row.pair_index, false);
    }
    if (row.is_prediction_correct) {
      pairs.set(row.pair_index, true);
    }
  });

  // Calculate per-puzzle scores
  const puzzleScores = [];
  let totalSolvedPairs = 0;
  let totalPairs = 0;

  puzzles.forEach((pairs, puzzleId) => {
    const solvedPairs = Array.from(pairs.values()).filter(v => v === true).length;
    const totalPairsInPuzzle = pairs.size;
    const puzzleScore = solvedPairs / totalPairsInPuzzle;

    totalSolvedPairs += solvedPairs;
    totalPairs += totalPairsInPuzzle;

    puzzleScores.push({
      puzzleId,
      solvedPairs,
      totalPairsInPuzzle,
      score: puzzleScore
    });
  });

  // Calculate overall accuracy
  const overallAccuracy = totalSolvedPairs / totalPairs;

  console.log(`\n=== Per-Puzzle Score Calculation ===`);
  console.log(`Total puzzles: ${puzzles.size}`);
  console.log(`Total pairs: ${totalPairs}`);
  console.log(`Total solved pairs: ${totalSolvedPairs}`);
  console.log(`Overall accuracy: ${(overallAccuracy * 100).toFixed(2)}%`);
  console.log(`Expected official score: 71.29%`);
  console.log(`Match: ${Math.abs(overallAccuracy - 0.7129) < 0.001 ? '✓ YES' : '✗ NO'}`);

  console.log(`\nFirst 10 puzzles:`);
  puzzleScores.slice(0, 10).forEach(p => {
    console.log(`  ${p.puzzleId}: ${p.solvedPairs}/${p.totalPairsInPuzzle} = ${(p.score * 100).toFixed(1)}%`);
  });

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
