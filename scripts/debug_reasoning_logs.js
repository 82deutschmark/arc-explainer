/**
 * Debug script to check reasoning logs in the database
 * This helps troubleshoot why reasoning logs aren't showing in the UI
 * Author: Cascade
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;

// Load environment variables
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugReasoningLogs() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking recent explanations with reasoning logs...\n');
    
    // Get the most recent explanations with reasoning logs
    const result = await client.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        has_reasoning_log,
        CASE 
          WHEN reasoning_log IS NOT NULL THEN LENGTH(reasoning_log)
          ELSE 0
        END as reasoning_log_length,
        CASE 
          WHEN reasoning_log IS NOT NULL THEN LEFT(reasoning_log, 200)
          ELSE NULL
        END as reasoning_log_preview,
        created_at
      FROM explanations 
      WHERE has_reasoning_log = true 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No explanations found with reasoning logs');
      console.log('   This suggests the reasoning logs are not being saved to the database properly.');
    } else {
      console.log(`✅ Found ${result.rows.length} explanations with reasoning logs:\n`);
      
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ID: ${row.id}`);
        console.log(`   Puzzle: ${row.puzzle_id}`);
        console.log(`   Model: ${row.model_name}`);
        console.log(`   Has Reasoning Log: ${row.has_reasoning_log}`);
        console.log(`   Reasoning Log Length: ${row.reasoning_log_length} characters`);
        console.log(`   Preview: ${row.reasoning_log_preview ? row.reasoning_log_preview + '...' : 'None'}`);
        console.log(`   Created: ${row.created_at}`);
        console.log('');
      });
    }
    
    // Also check the most recent explanations regardless of reasoning logs
    console.log('\n🔍 Checking most recent explanations (all types)...\n');
    
    const allResult = await client.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        has_reasoning_log,
        CASE 
          WHEN reasoning_log IS NOT NULL THEN LENGTH(reasoning_log)
          ELSE 0
        END as reasoning_log_length,
        created_at
      FROM explanations 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    allResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id} | Model: ${row.model_name} | Has Reasoning: ${row.has_reasoning_log} | Length: ${row.reasoning_log_length}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking reasoning logs:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

debugReasoningLogs();
