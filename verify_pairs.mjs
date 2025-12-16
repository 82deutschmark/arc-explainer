import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Check pair distribution per puzzle
  const result = await pool.query(`
    SELECT
      puzzle_id,
      ((provider_raw_response->>'pair_index')::int) as pair_index,
      COUNT(*) as attempts_count,
      bool_or(is_prediction_correct) as pair_solved
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
    GROUP BY puzzle_id, pair_index
    ORDER BY puzzle_id, pair_index
  `);

  // Group by puzzle to see their pair distribution
  const puzzlesByPairCount = new Map();
  const puzzles = new Map();

  result.rows.forEach(row => {
    if (!puzzles.has(row.puzzle_id)) {
      puzzles.set(row.puzzle_id, []);
    }
    puzzles.get(row.puzzle_id).push({
      pair_index: row.pair_index,
      attempts_count: row.attempts_count,
      pair_solved: row.pair_solved
    });
  });

  // Count puzzles by how many pairs they have
  puzzles.forEach((pairs, puzzleId) => {
    const pairCount = pairs.length;
    if (!puzzlesByPairCount.has(pairCount)) {
      puzzlesByPairCount.set(pairCount, 0);
    }
    puzzlesByPairCount.set(pairCount, puzzlesByPairCount.get(pairCount) + 1);
  });

  console.log(`\n=== Pair Distribution Analysis ===`);
  console.log(`Total puzzles: ${puzzles.size}`);
  puzzlesByPairCount.forEach((count, pairCount) => {
    console.log(`Puzzles with ${pairCount} pair(s): ${count}`);
  });

  // Calculate correct per-puzzle score now
  let totalSolvedPairs = 0;
  let totalPairs = 0;
  const puzzleScores = [];

  puzzles.forEach((pairs, puzzleId) => {
    const solvedPairs = pairs.filter(p => p.pair_solved).length;
    const totalPairsInPuzzle = pairs.length;
    totalSolvedPairs += solvedPairs;
    totalPairs += totalPairsInPuzzle;
    puzzleScores.push({
      puzzleId,
      solvedPairs,
      totalPairsInPuzzle,
      score: solvedPairs / totalPairsInPuzzle
    });
  });

  const overallAccuracy = totalSolvedPairs / totalPairs;

  console.log(`\n=== Corrected Accuracy Calculation ===`);
  console.log(`Total pairs across all puzzles: ${totalPairs}`);
  console.log(`Total solved pairs: ${totalSolvedPairs}`);
  console.log(`Overall accuracy: ${(overallAccuracy * 100).toFixed(2)}%`);
  console.log(`Expected official score: 71.29%`);
  console.log(`Difference: ${Math.abs(overallAccuracy - 0.7129).toFixed(4)} (${((overallAccuracy - 0.7129) * 100).toFixed(2)}%)`);

  console.log(`\nFirst 10 puzzles with their pair breakdown:`);
  puzzleScores.slice(0, 10).forEach(p => {
    console.log(`  ${p.puzzleId}: ${p.solvedPairs}/${p.totalPairsInPuzzle} = ${(p.score * 100).toFixed(1)}%`);
  });

  // Show some examples with multiple pairs
  console.log(`\nPuzzles with multiple pairs (first 5):`);
  let shown = 0;
  puzzleScores.forEach(p => {
    if (p.totalPairsInPuzzle > 1 && shown < 5) {
      console.log(`  ${p.puzzleId}: ${p.solvedPairs}/${p.totalPairsInPuzzle} = ${(p.score * 100).toFixed(1)}%`);
      shown++;
    }
  });

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
