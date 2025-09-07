/**
 * Check for recoverable data from failed OpenRouter API calls
 * Looking for entries that might have raw responses we can parse
 * 
 * @author Claude
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkRecoverableData() {
  try {
    console.log('🔍 Checking for recoverable OpenRouter data...');
    
    // Look for recent OpenRouter entries, especially failed ones
    const recentQuery = `
      SELECT id, model_name, provider_response_id, provider_raw_response, 
             pattern_description, solving_strategy, predicted_output_grid,
             created_at, api_processing_time_ms, estimated_cost,
             input_tokens, output_tokens, reasoning_log
      FROM explanations 
      WHERE (model_name LIKE '%grok-4%' OR model_name LIKE '%qwen3-235b%' OR model_name LIKE '%openrouter%')
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 20
    `;
    
    const result = await pool.query(recentQuery);
    
    console.log(`\n📊 Found ${result.rows.length} recent OpenRouter entries in last 24 hours`);
    
    let recoverableCount = 0;
    let totalCost = 0;
    
    for (const [i, row] of result.rows.entries()) {
      console.log(`\n--- Entry ${i+1} ---`);
      console.log(`ID: ${row.id}`);
      console.log(`Model: ${row.model_name}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`Cost: $${row.estimated_cost || 0}`);
      console.log(`Processing time: ${row.api_processing_time_ms || 0}ms`);
      console.log(`Tokens: ${row.input_tokens || 0} in / ${row.output_tokens || 0} out`);
      
      const hasAnalysis = !!(row.pattern_description || row.solving_strategy);
      const hasPrediction = !!row.predicted_output_grid;
      const hasRawResponse = !!row.provider_raw_response;
      
      console.log(`✅ Has analysis: ${hasAnalysis}`);
      console.log(`✅ Has prediction: ${hasPrediction}`);
      console.log(`📄 Has raw response: ${hasRawResponse}`);
      
      if (hasRawResponse) {
        const rawLength = row.provider_raw_response.length;
        console.log(`📏 Raw response length: ${rawLength} chars`);
        
        if (rawLength > 100) {
          console.log(`🔍 Response preview: ${row.provider_raw_response.substring(0, 200)}...`);
          
          // Try to see if this looks like it contains JSON that might be recoverable
          const looksLikeJson = row.provider_raw_response.includes('{') && 
                               (row.provider_raw_response.includes('patternDescription') || 
                                row.provider_raw_response.includes('solvingStrategy') ||
                                row.provider_raw_response.includes('pattern_description') ||
                                row.provider_raw_response.includes('solving_strategy'));
          
          if (looksLikeJson && !hasAnalysis) {
            console.log(`🚨 POTENTIALLY RECOVERABLE: Has JSON-like content but missing analysis data!`);
            recoverableCount++;
          }
        }
      }
      
      if (row.estimated_cost) {
        totalCost += parseFloat(row.estimated_cost);
      }
    }
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`💰 Total cost in last 24h: $${totalCost.toFixed(4)}`);
    console.log(`🔧 Potentially recoverable entries: ${recoverableCount}`);
    
    if (recoverableCount > 0) {
      console.log(`\n🎯 RECOVERY RECOMMENDATION:`);
      console.log(`Found ${recoverableCount} entries with raw responses that might contain parseable data.`);
      console.log(`Consider running a recovery script to attempt parsing the raw responses.`);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

checkRecoverableData();
