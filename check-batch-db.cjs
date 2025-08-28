/**
 * Check batch analysis database tables and record ID 4197
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkBatchTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('=== CHECKING BATCH TABLES ===\n');
    
    // Check if batch tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%batch%'
      ORDER BY table_name
    `);
    
    console.log('Batch-related tables found:');
    if (tablesResult.rows.length === 0) {
      console.log('  ❌ NO BATCH TABLES FOUND');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  ✅ ${row.table_name}`);
      });
    }
    
    // Check explanations table for record ID 4197
    console.log('\n=== CHECKING RECORD ID 4197 ===\n');
    try {
      const recordResult = await pool.query('SELECT * FROM explanations WHERE id = $1', [4197]);
      if (recordResult.rows.length > 0) {
        const record = recordResult.rows[0];
        console.log('✅ Record ID 4197 found:');
        console.log('  puzzle_id:', record.puzzle_id);
        console.log('  model_name:', record.model_name);
        console.log('  created_at:', record.created_at);
        console.log('  has batch fields:', {
          saturn_images: !!record.saturn_images,
          saturn_log: !!record.saturn_log,
          saturn_events: !!record.saturn_events,
          saturn_success: record.saturn_success
        });
      } else {
        console.log('❌ Record ID 4197 NOT FOUND in explanations table');
      }
    } catch (err) {
      console.log('❌ Error checking record 4197:', err.message);
    }
    
    // Check if any batch analysis sessions exist in other tables
    console.log('\n=== CHECKING ALL TABLES FOR BATCH DATA ===\n');
    const allTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('All tables in database:');
    allTablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBatchTables();