import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function searchForNewEntries() {
  try {
    console.log('Searching for recent entries...');
    
    // Search for entries created in the last hour
    const result = await pool.query(`
      SELECT id, model_name, created_at, multiple_predicted_outputs, multi_test_results 
      FROM explanations 
      WHERE puzzle_id = '27a28665' 
      AND created_at > NOW() - INTERVAL '1 hour'
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} recent entries:`);
    
    for (const row of result.rows) {
      console.log(`\n--- Entry ID: ${row.id} ---`);
      console.log(`Model: ${row.model_name}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`Raw multiplePredictedOutputs: ${row.multiple_predicted_outputs}`);
      console.log(`Raw multiTestResults: ${row.multi_test_results}`);
      
      // Try parsing to see if it's valid JSON
      try {
        if (row.multiple_predicted_outputs) {
          const parsed = JSON.parse(row.multiple_predicted_outputs);
          console.log(`✅ Valid JSON: ${JSON.stringify(parsed)}`);
        }
      } catch (e) {
        console.log(`❌ Invalid JSON: ${e.message}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

searchForNewEntries();