/**
 * Quick database debug script to check multi-test data
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkMultiTestData() {
  console.log('Checking database for multi-test prediction data...\n');
  
  try {
    const client = await pool.connect();
    
    // Query recent multi-test explanations
    const result = await client.query(`
      SELECT id, puzzle_id, model_name, 
             multiple_predicted_outputs, 
             multi_test_results,
             multi_test_all_correct,
             multi_test_average_accuracy,
             created_at
      FROM explanations 
      WHERE puzzle_id = '27a28665' OR created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log(`Found ${result.rows.length} explanations for puzzle 27a28665:\n`);
    
    result.rows.forEach((row, idx) => {
      console.log(`--- Explanation ${idx + 1} (ID: ${row.id}) ---`);
      console.log(`Model: ${row.model_name}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`Multi-test all correct: ${row.multi_test_all_correct}`);
      console.log(`Multi-test average accuracy: ${row.multi_test_average_accuracy}`);
      console.log(`Raw multiplePredictedOutputs: ${row.multiple_predicted_outputs}`);
      console.log(`Raw multiTestResults: ${row.multi_test_results}`);
      
      // Try to parse the JSON
      if (row.multiple_predicted_outputs) {
        try {
          const parsed = JSON.parse(row.multiple_predicted_outputs);
          console.log(`Parsed multiplePredictedOutputs:`, parsed);
          console.log(`Type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}, Length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
        } catch (e) {
          console.log(`Failed to parse multiplePredictedOutputs: ${e.message}`);
        }
      }
      
      if (row.multi_test_results) {
        try {
          const parsed = JSON.parse(row.multi_test_results);
          console.log(`Parsed multiTestResults:`, parsed);
          console.log(`Type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}, Length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
        } catch (e) {
          console.log(`Failed to parse multiTestResults: ${e.message}`);
        }
      }
      
      console.log('');
    });
    
    client.release();
    
  } catch (error) {
    console.error('Database error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMultiTestData();