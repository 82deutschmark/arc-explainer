/**
 * Test batch analysis startup flow
 */
require('dotenv').config();

async function testBatchStartup() {
  const baseUrl = process.env.API_URL || 'http://localhost:5000';
  
  console.log('=== TESTING BATCH ANALYSIS STARTUP ===\n');
  
  try {
    // Test data that should pass validation
    const testPayload = {
      modelKey: 'gpt-4o-mini',
      dataset: 'ARC2-Eval', 
      promptId: 'solver',
      temperature: 0.2,
      batchSize: 2
    };
    
    console.log('Sending POST request to /api/model/batch-analyze');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch(`${baseUrl}/api/model/batch-analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (response.ok) {
      console.log('✅ SUCCESS: Batch analysis started without 500 error');
      const data = JSON.parse(responseText);
      if (data.data?.sessionId) {
        console.log(`✅ Session ID returned: ${data.data.sessionId}`);
        return data.data.sessionId;
      }
    } else {
      console.log(`❌ FAILED: HTTP ${response.status}`);
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch {
        console.log('Raw error:', responseText);
      }
    }
    
  } catch (error) {
    console.error('❌ REQUEST FAILED:', error.message);
  }
}

// Also test if server is running
async function checkServer() {
  const baseUrl = process.env.API_URL || 'http://localhost:5000';
  
  try {
    const response = await fetch(`${baseUrl}/api/health/database`);
    console.log(`Server health check: ${response.status}`);
    const data = await response.text();
    console.log('Health response:', data.substring(0, 200) + '...');
    return response.ok;
  } catch (error) {
    console.log('❌ Server not reachable:', error.message);
    return false;
  }
}

async function main() {
  console.log('Checking server availability...');
  const serverOk = await checkServer();
  
  if (!serverOk) {
    console.log('⚠️  Server may not be running. Start with: npm run test');
    return;
  }
  
  console.log('\n');
  await testBatchStartup();
}

main();