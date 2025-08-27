/**
 * Repair Database Corruption: Fix [object Object] in reasoning_log columns
 * 
 * This script identifies and repairs corrupted reasoning_log entries where 
 * objects were improperly stored as "[object Object]" instead of JSON strings.
 * 
 * Issue identified in OpenAI_Reasoning_Audit_2025-08-25.md:
 * "SOMETIMES THIS IS INCORRECTLY STORING AS objectObject object in our DB columns"
 * 
 * @author Claude
 * @date 2025-08-27
 */

require('dotenv/config');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function repairReasoningLogCorruption() {
  console.log('🔧 Starting database reasoning_log corruption repair...\n');
  
  const client = await pool.connect();
  
  try {
    // Step 1: Identify corrupted entries
    console.log('🔍 Step 1: Identifying corrupted reasoning_log entries...');
    const corruptedResult = await client.query(`
      SELECT 
        id,
        puzzle_id,
        model_name,
        reasoning_log,
        LENGTH(reasoning_log) as log_length,
        created_at
      FROM explanations 
      WHERE reasoning_log LIKE '%[object Object]%'
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${corruptedResult.rows.length} corrupted entries:`);
    
    if (corruptedResult.rows.length === 0) {
      console.log('✅ No corruption found - database is clean!');
      return;
    }
    
    // Display sample of corrupted entries
    console.log('\n📋 Sample corrupted entries:');
    corruptedResult.rows.slice(0, 5).forEach((row, index) => {
      console.log(`${index + 1}. ID: ${row.id} | Puzzle: ${row.puzzle_id} | Model: ${row.model_name}`);
      console.log(`   Length: ${row.log_length} chars | Preview: ${row.reasoning_log?.substring(0, 100)}...`);
      console.log(`   Created: ${row.created_at}\n`);
    });
    
    // Step 2: Analyze corruption patterns
    console.log('🔬 Step 2: Analyzing corruption patterns...');
    const patternResult = await client.query(`
      SELECT 
        reasoning_log,
        COUNT(*) as count
      FROM explanations 
      WHERE reasoning_log LIKE '%[object Object]%'
      GROUP BY reasoning_log
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log('🔍 Most common corruption patterns:');
    patternResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Count: ${row.count} | Pattern: "${row.reasoning_log}"`);
    });
    
    // Step 3: Backup corrupted data
    console.log('\n💾 Step 3: Creating backup of corrupted data...');
    const backupResult = await client.query(`
      CREATE TABLE IF NOT EXISTS reasoning_log_corruption_backup AS
      SELECT 
        id,
        puzzle_id, 
        model_name,
        reasoning_log as corrupted_reasoning_log,
        created_at,
        NOW() as backup_created_at
      FROM explanations 
      WHERE reasoning_log LIKE '%[object Object]%'
    `);
    
    console.log(`✅ Backup table 'reasoning_log_corruption_backup' created`);
    
    // Step 4: Repair options
    console.log('\n🛠️ Step 4: Repair options available:');
    console.log('A) Set corrupted entries to NULL (clean slate)');
    console.log('B) Set corrupted entries to empty string (preserve has_reasoning_log=true)');
    console.log('C) Set has_reasoning_log=false for corrupted entries');
    
    // For automated repair, we'll use option A (set to NULL) as safest
    console.log('\n🔧 Applying repair option A: Set corrupted entries to NULL...');
    
    const repairResult = await client.query(`
      UPDATE explanations 
      SET 
        reasoning_log = NULL,
        has_reasoning_log = false
      WHERE reasoning_log LIKE '%[object Object]%'
    `);
    
    console.log(`✅ Repaired ${repairResult.rowCount} corrupted entries`);
    
    // Step 5: Verify repair
    console.log('\n✅ Step 5: Verifying repair...');
    const verifyResult = await client.query(`
      SELECT COUNT(*) as remaining_corrupted
      FROM explanations 
      WHERE reasoning_log LIKE '%[object Object]%'
    `);
    
    const remainingCorrupted = parseInt(verifyResult.rows[0].remaining_corrupted);
    
    if (remainingCorrupted === 0) {
      console.log('🎉 SUCCESS: All corruption has been repaired!');
    } else {
      console.log(`⚠️  WARNING: ${remainingCorrupted} corrupted entries remain`);
    }
    
    // Step 6: Database statistics
    console.log('\n📊 Step 6: Updated database statistics...');
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_explanations,
        COUNT(CASE WHEN has_reasoning_log = true THEN 1 END) as with_reasoning_log,
        COUNT(CASE WHEN reasoning_log IS NOT NULL THEN 1 END) as with_reasoning_content,
        AVG(CASE WHEN reasoning_log IS NOT NULL THEN LENGTH(reasoning_log) END)::INT as avg_reasoning_length
      FROM explanations
    `);
    
    const stats = statsResult.rows[0];
    console.log(`📈 Database Statistics:`);
    console.log(`   Total explanations: ${stats.total_explanations}`);
    console.log(`   With reasoning log flag: ${stats.with_reasoning_log}`);
    console.log(`   With reasoning content: ${stats.with_reasoning_content}`);
    console.log(`   Average reasoning length: ${stats.avg_reasoning_length || 0} characters`);
    
    console.log('\n🔧 Repair Summary:');
    console.log(`   - Corrupted entries found: ${corruptedResult.rows.length}`);
    console.log(`   - Entries repaired: ${repairResult.rowCount}`);
    console.log(`   - Remaining corruption: ${remainingCorrupted}`);
    console.log(`   - Backup table: reasoning_log_corruption_backup`);
    
    console.log('\n✅ Database corruption repair completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during corruption repair:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the repair if called directly
if (require.main === module) {
  repairReasoningLogCorruption()
    .then(() => {
      console.log('\n🎯 Repair script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Fatal error:', error.message);
      process.exit(1);
    });
}