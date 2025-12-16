import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Check how many attempts per puzzle/pair
  const result = await pool.query(`
    SELECT
      puzzle_id,
      ((provider_raw_response->>'pair_index')::int) as pair_index,
      COUNT(*) as attempts_count,
      STRING_AGG(DISTINCT model_name, ', ') as models
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
    GROUP BY puzzle_id, pair_index
    ORDER BY puzzle_id, pair_index
    LIMIT 20
  `);

  console.log('\nFirst 20 puzzle/pair combos:');
  result.rows.forEach(row => {
    console.log(`  ${row.puzzle_id} pair ${row.pair_index}: ${row.attempts_count} attempts (${row.models})`);
  });

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
