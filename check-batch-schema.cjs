/**
 * Check actual schema of batch analysis tables
 */
const { Pool } = require('pg');
require('dotenv').config();

async function checkBatchSchema() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const batchTables = ['batch_analysis_sessions', 'batch_analysis_results', 'batch_results', 'batch_runs'];
    
    for (const tableName of batchTables) {
      console.log(`\n=== ${tableName.toUpperCase()} SCHEMA ===`);
      
      const result = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [tableName]);
      
      if (result.rows.length === 0) {
        console.log('  ❌ Table does not exist or has no columns');
      } else {
        result.rows.forEach(row => {
          const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
          console.log(`  ${row.column_name} - ${row.data_type} ${nullable}${defaultVal}`);
        });
        
        // Also check row count
        try {
          const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`  📊 Row count: ${countResult.rows[0].count}`);
        } catch (err) {
          console.log(`  ❌ Could not count rows: ${err.message}`);
        }
      }
    }
    
    // Check record 4197 for batch context
    console.log('\n=== RECORD 4197 DETAILED ANALYSIS ===');
    const recordResult = await pool.query(`
      SELECT puzzle_id, model_name, created_at, api_processing_time_ms, 
             provider_raw_response, reasoning_log, has_reasoning_log,
             temperature, reasoning_effort, reasoning_verbosity
      FROM explanations 
      WHERE id = $1
    `, [4197]);
    
    if (recordResult.rows.length > 0) {
      const record = recordResult.rows[0];
      console.log('Record 4197 details:');
      Object.entries(record).forEach(([key, value]) => {
        if (value === null) {
          console.log(`  ${key}: null`);
        } else if (typeof value === 'object') {
          console.log(`  ${key}: [${typeof value}] ${JSON.stringify(value).substring(0, 100)}...`);
        } else {
          console.log(`  ${key}: ${value}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBatchSchema();