import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT
      COUNT(DISTINCT puzzle_id) as total_puzzles,
      SUM(CASE WHEN is_prediction_correct = true THEN 1 ELSE 0 END)::int as correct_attempts,
      COUNT(*)::int as total_attempts,
      ROUND(100.0 * SUM(CASE WHEN is_prediction_correct = true THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy_percent
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
  `);

  console.log('\n' + '='.repeat(60));
  console.log('JOHAN_LAND CORRECTNESS STATS (After Fix)');
  console.log('='.repeat(60));
  const row = result.rows[0];
  console.log(`Total Puzzles:       ${row.total_puzzles}`);
  console.log(`Total Attempts:      ${row.total_attempts}`);
  console.log(`Correct Attempts:    ${row.correct_attempts}`);
  console.log(`Accuracy:            ${row.accuracy_percent}%`);
  console.log('='.repeat(60));
  console.log(`\nOfficial Score:      71.29% (84.83/119)`);
  console.log(`Database Shows:      ${row.accuracy_percent}% (${Math.round(row.correct_attempts / 2)}/119 puzzles)`);
  console.log('='.repeat(60) + '\n');

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
