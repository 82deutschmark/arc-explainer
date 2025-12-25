import pg from 'pg';
import fs from 'fs';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Check how many records per pair_index
  const result = await pool.query(`
    SELECT
      ((provider_raw_response->>'pair_index')::int) as pair_index,
      COUNT(*) as count
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
    GROUP BY pair_index
    ORDER BY pair_index
  `);

  console.log('\nRecords by pair_index:');
  result.rows.forEach(row => {
    console.log(`  pair_index ${row.pair_index}: ${row.count} records`);
  });

  // Check how many puzzles have multiple pairs
  const puzzleResult = await pool.query(`
    SELECT COUNT(DISTINCT puzzle_id) as puzzles_with_pair_0,
           SUM(CASE WHEN ((provider_raw_response->>'pair_index')::int) > 0 THEN 1 ELSE 0 END) as records_with_pair_gt_0
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
  `);

  console.log(`\nPuzzles with pair_0 attempts: ${puzzleResult.rows[0].puzzles_with_pair_0}`);
  console.log(`Records with pair_index > 0: ${puzzleResult.rows[0].records_with_pair_gt_0}`);

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
