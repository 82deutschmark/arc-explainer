/**
 * Repository Migration Verification Script
 * Verifies that all repository services are working correctly after migration
 * 
 * Usage: node scripts/verify-migration.js
 * 
 * @author Cascade
 */

const fetch = require('node-fetch');
const BASE_URL = process.env.RAILWAY_PUBLIC_URL || 'http://localhost:5000';

async function verifyRepository(name, testFn) {
  try {
    console.log(`🔍 Testing ${name}...`);
    await testFn();
    console.log(`   ✅ ${name} - OK`);
    return true;
  } catch (error) {
    console.log(`   ❌ ${name} - FAILED: ${error.message}`);
    return false;
  }
}

async function runMigrationVerification() {
  console.log('🚀 Verifying Repository Service Migration\n');
  
  const results = [];
  
  // Test repository connectivity
  results.push(await verifyRepository('Repository Service Connection', async () => {
    const response = await fetch(`${BASE_URL}/api/health`);
    const data = await response.json();
    if (!data.database) throw new Error('Database not connected');
  }));
  
  // Test explanation repository
  results.push(await verifyRepository('Explanation Repository', async () => {
    const response = await fetch(`${BASE_URL}/api/puzzles?limit=1`);
    const data = await response.json();
    if (!data.success || !data.puzzles) throw new Error('Puzzle list failed');
  }));
  
  // Test batch analysis repository  
  results.push(await verifyRepository('Batch Analysis Repository', async () => {
    const response = await fetch(`${BASE_URL}/api/batch/sessions`);
    if (!response.ok) throw new Error(`Batch sessions endpoint failed: ${response.status}`);
  }));
  
  // Test feedback repository by checking if explanation details work
  results.push(await verifyRepository('Feedback Repository Integration', async () => {
    const response = await fetch(`${BASE_URL}/api/puzzles/007bbfb7`);
    const data = await response.json();
    if (!data.success) throw new Error('Puzzle details failed');
    // Should have feedbackCount property if migration worked
    if (data.puzzle && typeof data.puzzle.feedbackCount === 'undefined') {
      throw new Error('feedbackCount missing - migration issue');
    }
  }));
  
  const passed = results.filter(Boolean).length;
  const total = results.length;
  
  console.log(`\n📊 MIGRATION VERIFICATION`);
  console.log(`   Repository Tests Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log(`   🎉 MIGRATION SUCCESSFUL! All repositories working.`);
    process.exit(0);
  } else {
    console.log(`   ⚠️  Migration issues detected. Check logs above.`);
    process.exit(1);
  }
}

runMigrationVerification().catch(error => {
  console.error('❌ Migration verification failed:', error);
  process.exit(1);
});
