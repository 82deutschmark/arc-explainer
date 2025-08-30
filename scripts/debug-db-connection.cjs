/**
 * Database Connection Test Script
 * Tests database connectivity and batch session creation
 * 
 * @author Cascade claude-3-5-sonnet-20241022
 */

const { Pool } = require('pg');
require('dotenv').config();

async function testDatabaseConnection() {
  console.log('Testing database connection...');
  
  // Check if DATABASE_URL is set
  const databaseUrl = process.env.DATABASE_URL;
  console.log('DATABASE_URL configured:', databaseUrl ? 'Yes' : 'No');
  
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL not configured');
    return;
  }
  
  let pool = null;
  
  try {
    // Create connection pool
    pool = new Pool({ connectionString: databaseUrl });
    
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test batch session creation
    console.log('\nTesting batch session creation...');
    
    const testSessionData = {
      sessionId: 'test-session-' + Date.now(),
      totalPuzzles: 10,
      modelKey: 'gpt-4o',
      dataset: 'ARC1',
      promptId: 'solver',
      customPrompt: null,
      temperature: 0.2,
      reasoningEffort: null,
      reasoningVerbosity: null,
      reasoningSummaryType: null
    };
    
    try {
      await client.query(
        `INSERT INTO batch_analysis_sessions 
         (session_id, total_puzzles, model_key, dataset, prompt_id, custom_prompt, 
          temperature, reasoning_effort, reasoning_verbosity, reasoning_summary_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          testSessionData.sessionId, 
          testSessionData.totalPuzzles, 
          testSessionData.modelKey, 
          testSessionData.dataset,
          testSessionData.promptId,
          testSessionData.customPrompt,
          testSessionData.temperature,
          testSessionData.reasoningEffort,
          testSessionData.reasoningVerbosity,
          testSessionData.reasoningSummaryType
        ]
      );
      console.log('✅ Test batch session created successfully');
      
      // Clean up test session
      await client.query('DELETE FROM batch_analysis_sessions WHERE session_id = $1', [testSessionData.sessionId]);
      console.log('✅ Test session cleaned up');
      
    } catch (insertError) {
      console.log('❌ Failed to create batch session:', insertError.message);
    }
    
    client.release();
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

testDatabaseConnection().catch(console.error);
