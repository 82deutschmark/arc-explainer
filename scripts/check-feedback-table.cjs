/**
 * Check feedback table schema and data
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkFeedback() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== FEEDBACK TABLE SCHEMA ===');
    const schemaResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'feedback' 
      ORDER BY ordinal_position
    `);
    
    if (schemaResult.rows.length === 0) {
      console.log('No feedback table found');
      return;
    }
    
    schemaResult.rows.forEach(row => {
      console.log(`${row.column_name} - ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    console.log('\n=== FEEDBACK DATA COUNT ===');
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM feedback`);
    console.log(`Total records: ${countResult.rows[0].total}`);
    
    if (parseInt(countResult.rows[0].total) > 0) {
      console.log('\n=== SAMPLE DATA ===');
      const sampleResult = await pool.query(`
        SELECT id, puzzle_id, explanation_id, feedback_type, created_at
        FROM feedback 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      sampleResult.rows.forEach(row => {
        console.log(`ID: ${row.id}, Puzzle: ${row.puzzle_id || 'NULL'}, Explanation: ${row.explanation_id || 'NULL'}, Type: ${row.feedback_type}`);
      });
      
      console.log('\n=== DATA ANALYSIS ===');
      const analysisResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(puzzle_id) as with_puzzle_id,
          COUNT(explanation_id) as with_explanation_id
        FROM feedback
      `);
      
      const stats = analysisResult.rows[0];
      console.log(`Records with puzzle_id: ${stats.with_puzzle_id}/${stats.total}`);
      console.log(`Records with explanation_id: ${stats.with_explanation_id}/${stats.total}`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkFeedback();
