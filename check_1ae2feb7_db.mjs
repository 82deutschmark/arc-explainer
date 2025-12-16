import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const result = await pool.query(`
    SELECT
      puzzle_id,
      model_name,
      provider_raw_response->>'pair_index' as pair_index,
      is_prediction_correct
    FROM explanations
    WHERE puzzle_id = '1ae2feb7' AND model_name ILIKE 'Johan_Land_Solver_V6%'
    ORDER BY model_name, provider_raw_response->>'pair_index'
  `);

  console.log(`\nFound ${result.rows.length} records for 1ae2feb7:\n`);
  result.rows.forEach(row => {
    console.log(`  ${row.model_name}: pair_index=${row.pair_index}, correct=${row.is_prediction_correct}`);
  });

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
