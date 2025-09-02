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

async function checkReasoningData() {
  console.log('Checking reasoning data for working vs broken entries...\n');
  
  try {
    const client = await pool.connect();
    
    // Query specific entries: working (608, 600) vs broken (6607, 6606)
    const result = await client.query(`
      SELECT id, puzzle_id, model_name, 
             reasoning_log, 
             reasoning_items,
             has_reasoning_log,
             provider_raw_response,
             created_at
      FROM explanations 
      WHERE id IN (608, 600, 6607, 6606)
      ORDER BY id DESC
    `);
    
    console.log(`Found ${result.rows.length} explanations:\n`);
    
    result.rows.forEach((row, idx) => {
      const isWorking = [608, 600].includes(row.id);
      console.log(`--- ${isWorking ? 'WORKING' : 'BROKEN'} Entry (ID: ${row.id}) ---`);
      console.log(`Model: ${row.model_name}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`has_reasoning_log: ${row.has_reasoning_log}`);
      console.log(`reasoning_log length: ${row.reasoning_log ? row.reasoning_log.length : 'NULL/0'}`);
      console.log(`reasoning_log preview: ${row.reasoning_log ? row.reasoning_log.substring(0, 100) + '...' : 'NULL'}`);
      
      // Check reasoning_items
      if (row.reasoning_items) {
        try {
          const parsed = JSON.parse(row.reasoning_items);
          console.log(`reasoning_items type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
          console.log(`reasoning_items length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
          console.log(`reasoning_items preview:`, Array.isArray(parsed) ? parsed.slice(0, 2) : parsed);
        } catch (e) {
          console.log(`reasoning_items parse error: ${e.message}`);
        }
      } else {
        console.log(`reasoning_items: NULL`);
      }
      
      // Check provider_raw_response for reasoning data
      if (row.provider_raw_response) {
        try {
          const parsed = JSON.parse(row.provider_raw_response);
          console.log(`provider_raw_response has output_reasoning: ${!!parsed.output_reasoning}`);
          if (parsed.output_reasoning && parsed.output_reasoning.items) {
            console.log(`output_reasoning.items length: ${parsed.output_reasoning.items.length}`);
          }
        } catch (e) {
          console.log(`provider_raw_response parse error: ${e.message}`);
        }
      } else {
        console.log(`provider_raw_response: NULL`);
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

checkReasoningData();