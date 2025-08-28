/**
 * Debug batch analysis error by testing individual components
 */
require('dotenv').config();
const { Pool } = require('pg');

async function testComponents() {
  console.log('=== DEBUGGING BATCH ANALYSIS ERROR ===\n');
  
  // Test database connection
  console.log('1. Testing database connection...');
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const client = await pool.connect();
    await client.query('SELECT COUNT(*) FROM batch_analysis_sessions');
    client.release();
    await pool.end();
    console.log('✅ Database connection OK');
  } catch (err) {
    console.log('❌ Database connection failed:', err.message);
    return;
  }
  
  // Test puzzle service
  console.log('\n2. Testing puzzle loading...');
  try {
    const response = await fetch('http://localhost:5000/api/puzzle/list?source=ARC2-Eval&limit=2');
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Puzzle service OK - found ${data.data?.length || 0} puzzles`);
    } else {
      console.log('❌ Puzzle service failed:', response.status);
    }
  } catch (err) {
    console.log('❌ Puzzle service error:', err.message);
  }
  
  // Test AI service
  console.log('\n3. Testing AI service...');
  try {
    const response = await fetch('http://localhost:5000/api/models');
    if (response.ok) {
      const data = await response.json();
      const gpt4oMini = data.find(m => m.key === 'gpt-4o-mini');
      console.log(`✅ AI service OK - gpt-4o-mini available: ${!!gpt4oMini}`);
    } else {
      console.log('❌ AI service failed:', response.status);
    }
  } catch (err) {
    console.log('❌ AI service error:', err.message);
  }
  
  // Test validation middleware
  console.log('\n4. Testing validation middleware...');
  try {
    const invalidPayload = { modelKey: '', dataset: '' }; // Should fail validation
    const response = await fetch('http://localhost:5000/api/model/batch-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    
    if (response.status === 400) {
      console.log('✅ Validation middleware working - rejected invalid payload');
    } else if (response.status === 500) {
      console.log('❌ 500 error even with validation - deeper issue');
      const text = await response.text();
      console.log('Error details:', text);
    } else {
      console.log(`⚠️  Unexpected validation response: ${response.status}`);
    }
  } catch (err) {
    console.log('❌ Validation test error:', err.message);
  }
  
  console.log('\n=== END COMPONENT TESTS ===');
}

testComponents();