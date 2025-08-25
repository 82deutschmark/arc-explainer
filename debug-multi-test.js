import pkg from 'pg';
const { Pool } = pkg;

async function queryMultiTestData() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL 
  });
  
  try {
    // Query for puzzle 27a28665 explanations
    const result = await pool.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        multiple_predicted_outputs,
        multi_test_results,
        multi_test_all_correct,
        multi_test_average_accuracy,
        created_at
      FROM explanations 
      WHERE puzzle_id = '27a28665'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log('=== Multi-Test Database Query Results ===');
    console.log('Found', result.rows.length, 'explanations for puzzle 27a28665');
    
    result.rows.forEach((row, i) => {
      console.log('\n--- Explanation', i + 1, '---');
      console.log('ID:', row.id);
      console.log('Model:', row.model_name);
      console.log('Created:', row.created_at);
      console.log('All Correct:', row.multi_test_all_correct);
      console.log('Avg Accuracy:', row.multi_test_average_accuracy);
      
      // Parse JSON fields safely
      try {
        const predictions = JSON.parse(row.multiple_predicted_outputs || 'null');
        console.log('Predictions:', predictions ? predictions.length + ' grids' : 'null');
        if (predictions && Array.isArray(predictions)) {
          predictions.forEach((grid, gi) => {
            console.log('  Grid', gi + 1, ':', JSON.stringify(grid));
          });
        }
      } catch (e) {
        console.log('Predictions (raw):', row.multiple_predicted_outputs);
      }
      
      try {
        const results = JSON.parse(row.multi_test_results || 'null');
        console.log('Test Results:', results ? results.length + ' items' : 'null');
        if (results && Array.isArray(results)) {
          results.forEach((result, ri) => {
            console.log('  Test', ri + 1, '- Correct:', result.isPredictionCorrect, 'Score:', result.predictionAccuracyScore);
          });
        }
      } catch (e) {
        console.log('Test Results (raw):', row.multi_test_results);
      }
    });
    
    // Also check puzzle 20a9e565 (2 test cases)
    console.log('\n\n=== Checking puzzle 20a9e565 (2 test cases) ===');
    const result2 = await pool.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        multiple_predicted_outputs,
        multi_test_results,
        multi_test_all_correct
      FROM explanations 
      WHERE puzzle_id = '20a9e565'
      ORDER BY created_at DESC
      LIMIT 3
    `);
    
    console.log('Found', result2.rows.length, 'explanations for puzzle 20a9e565');
    result2.rows.forEach((row, i) => {
      console.log('\n--- 20a9e565 Explanation', i + 1, '---');
      console.log('Model:', row.model_name);
      console.log('All Correct:', row.multi_test_all_correct);
      
      try {
        const predictions = JSON.parse(row.multiple_predicted_outputs || 'null');
        console.log('Predictions:', predictions ? predictions.length + ' grids' : 'null');
      } catch (e) {
        console.log('Predictions (unparseable):', row.multiple_predicted_outputs?.substring(0, 100));
      }
    });
    
  } catch (error) {
    console.error('Database query error:', error.message);
  } finally {
    await pool.end();
  }
}

queryMultiTestData();