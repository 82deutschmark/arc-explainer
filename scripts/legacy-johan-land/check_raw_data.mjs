import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  // Check a sample of the raw data
  const result = await pool.query(`
    SELECT
      puzzle_id,
      model_name,
      is_prediction_correct,
      provider_raw_response::text as raw_metadata
    FROM explanations
    WHERE model_name ILIKE 'Johan_Land_Solver_V6%'
    LIMIT 10
  `);

  console.log('\nSample data from database:');
  result.rows.forEach((row, i) => {
    const meta = JSON.parse(row.raw_metadata);
    console.log(`\n[${i+1}] Puzzle: ${row.puzzle_id}`);
    console.log(`    Model: ${row.model_name}`);
    console.log(`    Correct: ${row.is_prediction_correct}`);
    console.log(`    pair_index: ${meta.pair_index}`);
  });

  await pool.end();
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
