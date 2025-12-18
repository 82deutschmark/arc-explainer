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
    console.log('🔍 Searching for recent OpenRouter entries...');
    
    // Search for OpenRouter entries from today
    const result = await pool.query(`
      SELECT id, model_name, created_at, pattern_description, solving_strategy, 
             predicted_output_grid, provider_raw_response, estimated_cost,
             input_tokens, output_tokens, api_processing_time_ms, puzzle_id
      FROM explanations 
      WHERE (model_name LIKE '%grok%' OR model_name LIKE '%qwen%' OR model_name LIKE '%x-ai%')
      AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    console.log(`Found ${result.rows.length} recent OpenRouter entries:`);
    
    let recoverableCount = 0;
    let totalCost = 0;
    
    for (const row of result.rows) {
      console.log(`\n--- Entry ID: ${row.id} ---`);
      console.log(`Model: ${row.model_name}`);
      console.log(`Puzzle: ${row.puzzle_id}`);
      console.log(`Created: ${row.created_at}`);
      console.log(`Cost: $${row.estimated_cost || 0}`);
      console.log(`Processing time: ${row.api_processing_time_ms || 0}ms`);
      console.log(`Tokens: ${row.input_tokens || 0} in / ${row.output_tokens || 0} out`);
      
      const hasAnalysis = !!(row.pattern_description && row.solving_strategy);
      const hasPrediction = !!row.predicted_output_grid;
      const hasRawResponse = !!row.provider_raw_response;
      
      console.log(`✅ Has complete analysis: ${hasAnalysis}`);
      console.log(`✅ Has prediction: ${hasPrediction}`);
      console.log(`📄 Has raw response: ${hasRawResponse} (${hasRawResponse ? row.provider_raw_response.length : 0} chars)`);
      
      if (hasRawResponse && row.provider_raw_response.length > 100) {
        console.log(`🔍 Response preview: ${row.provider_raw_response.substring(0, 200)}...`);
        
        // Check if this looks recoverable
        const looksLikeJson = row.provider_raw_response.includes('{') && 
                             (row.provider_raw_response.includes('pattern') || 
                              row.provider_raw_response.includes('solving') ||
                              row.provider_raw_response.includes('confidence') ||
                              row.provider_raw_response.includes('hints'));
        
        if (looksLikeJson && !hasAnalysis) {
          console.log(`🚨 RECOVERABLE: Has JSON-like response but missing parsed data!`);
          recoverableCount++;
        } else if (!hasAnalysis && !looksLikeJson) {
          console.log(`⚠️  FAILED: No parseable data found`);
        }
      } else if (!hasRawResponse) {
        console.log(`❌ LOST: No raw response saved`);
      }
      
      if (row.estimated_cost) {
        totalCost += parseFloat(row.estimated_cost);
      }
    }
    
    console.log(`\n📈 RECOVERY SUMMARY:`);
    console.log(`💰 Total cost in last 24h: $${totalCost.toFixed(4)}`);
    console.log(`🔧 Potentially recoverable entries: ${recoverableCount}`);
    console.log(`📊 Total entries checked: ${result.rows.length}`);
    
    if (recoverableCount > 0) {
      console.log(`\n🎯 NEXT STEPS:`);
      console.log(`Run recovery script to attempt parsing ${recoverableCount} raw responses`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

searchForNewEntries();