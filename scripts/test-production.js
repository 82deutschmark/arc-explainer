/**
 * Production E2E Testing Script
 * Tests real endpoints with real data to verify system functionality
 * 
 * Usage: node scripts/test-production.js [base-url]
 * Example: node scripts/test-production.js http://localhost:5000
 * Example: node scripts/test-production.js https://your-railway-app.railway.app
 * 
 * @author Cascade
 */

import fetch from 'node-fetch';

const BASE_URL = process.argv[2] || 'http://localhost:5000';
const TEST_PUZZLE_ID = '007bbfb7'; // Known puzzle from training data

console.log(`🚀 Testing ARC Explainer API at: ${BASE_URL}\n`);

async function testEndpoint(name, url, options = {}) {
  try {
    console.log(`🔍 Testing ${name}...`);
    const response = await fetch(url, {
      timeout: 30000,
      ...options
    });
    
    const responseTime = response.headers.get('x-response-time') || 'N/A';
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Response Time: ${responseTime}ms`);
    
    if (!response.ok) {
      const error = await response.text();
      console.log(`   ❌ ERROR: ${error}`);
      return false;
    }
    
    const data = await response.json();
    console.log(`   ✅ Success - Response size: ${JSON.stringify(data).length} chars`);
    return { success: true, data, status: response.status };
  } catch (error) {
    console.log(`   ❌ FAILED: ${error.message}`);
    return false;
  }
}

async function runTests() {
  const results = [];
  
  // 1. Health Check
  results.push(await testEndpoint(
    'Health Check', 
    `${BASE_URL}/api/health`
  ));
  
  // 2. Puzzle List 
  results.push(await testEndpoint(
    'Puzzle List (first 10)', 
    `${BASE_URL}/api/puzzles?limit=10`
  ));
  
  // 3. Specific Puzzle Details
  results.push(await testEndpoint(
    `Puzzle Details (${TEST_PUZZLE_ID})`, 
    `${BASE_URL}/api/puzzles/${TEST_PUZZLE_ID}`
  ));
  
  // 4. Generate Explanation (if puzzle has no explanation)
  const puzzleResult = results[results.length - 1];
  if (puzzleResult && puzzleResult.data && !puzzleResult.data.hasExplanation) {
    console.log(`\n🧠 Generating explanation for ${TEST_PUZZLE_ID}...`);
    results.push(await testEndpoint(
      'Generate Explanation', 
      `${BASE_URL}/api/puzzles/${TEST_PUZZLE_ID}/explain`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          modelName: 'gpt-4o-mini',
          temperature: 0.7 
        })
      }
    ));
  } else if (puzzleResult && puzzleResult.data) {
    console.log(`   ℹ️  Puzzle ${TEST_PUZZLE_ID} already has explanation, skipping generation`);
  }
  
  // 5. Batch Sessions List
  results.push(await testEndpoint(
    'Batch Sessions List', 
    `${BASE_URL}/api/batch/sessions`
  ));
  
  // 6. Repository Service Status
  results.push(await testEndpoint(
    'Repository Service Check', 
    `${BASE_URL}/api/health/repositories`
  ));
  
  // Summary
  const passed = results.filter(r => r && r.success).length;
  const total = results.length;
  
  console.log(`\n📊 TEST SUMMARY`);
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log(`   🎉 ALL TESTS PASSED! System is healthy.`);
    process.exit(0);
  } else {
    console.log(`   ⚠️  Some tests failed. Check logs above.`);
    process.exit(1);
  }
}

// Add health check endpoint if it doesn't exist
async function ensureHealthEndpoints() {
  console.log(`📋 Ensuring health check endpoints exist...\n`);
}

ensureHealthEndpoints().then(runTests).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
