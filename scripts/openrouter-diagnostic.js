/**
 * OpenRouter Diagnostic Script
 * 
 * Captures full HTTP exchange details and tests token limits
 * Investigates the 200k token truncation issue mentioned in docs
 * 
 * @author Claude Code
 * @date 2025-09-07
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env') });


const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const BASE_URL = 'https://openrouter.ai/api/v1';

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found in environment');
  process.exit(1);
}

/**
 * Capture full HTTP request/response details
 */
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    console.log(`\n🔍 Making request to: ${options.hostname}${options.path}`);
    console.log(`📤 Request headers:`, JSON.stringify(options.headers, null, 2));
    console.log(`📤 Request body length: ${Buffer.byteLength(data)} bytes`);
    
    const req = https.request(options, (res) => {
      let responseBody = '';
      let responseChunks = 0;
      
      res.on('data', (chunk) => {
        responseChunks++;
        responseBody += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`\n📥 Response received in ${duration}ms`);
        console.log(`📥 Status: ${res.statusCode} ${res.statusMessage}`);
        console.log(`📥 Response headers:`, JSON.stringify(res.headers, null, 2));
        console.log(`📥 Response body length: ${responseBody.length} chars`);
        console.log(`📥 Response chunks: ${responseChunks}`);
        
        // Log first and last 200 chars of response
        if (responseBody.length > 400) {
          console.log(`📥 Response preview: "${responseBody.substring(0, 200)}...${responseBody.substring(responseBody.length - 200)}"`);
        } else {
          console.log(`📥 Full response: "${responseBody}"`);
        }
        
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: responseBody,
          duration,
          chunks: responseChunks,
          requestId: res.headers['x-request-id'] || res.headers['request-id'] || 'none'
        });
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Request error:`, error);
      reject(error);
    });
    
    req.write(data);
    req.end();
  });
}

/**
 * Test 1: Minimal request to check basic liveness
 */
async function testMinimalRequest(modelName) {
  console.log(`\n🧪 TEST 1: Minimal request to ${modelName}`);
  
  const requestData = JSON.stringify({
    model: modelName,
    messages: [
      {
        role: "user",
        content: "TRAINING EXAMPLES Example 1:Input: [[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,2,2,2,0,0,0,0,0],[0,0,0,0,0,2,0,0,0,0,0,0],[0,0,0,2,2,2,0,0,0,0,0,0],[0,0,0,2,0,2,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0]]Output: [[0,2,2,2],[0,0,2,0],[2,2,2,0],[2,0,2,0]]Example 2:Input: [[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,1,0,0,0,0,0,0,0,0,0],[0,0,1,1,0,0,0,0,0,0,0,0],[0,0,0,1,0,0,0,0,0,0,0,0],[0,0,1,1,1,0,0,0,0,0,0,0],[0,0,0,0,1,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0]]Output: [[1,0,0],[1,1,0],[0,1,0],[1,1,1],[0,0,1]]Example 3:Input: [[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,8,0,8,0,0,0,0,0],[0,0,0,8,8,8,8,0,0,0,0,0],[0,0,0,0,0,0,8,8,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0]]Output: [[0,8,0,8,0],[8,8,8,8,0],[0,0,0,8,8]]TEST CASE (input only; correct answer withheld):Input: [[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,6,6,6,6,0,0,0,0],[0,0,0,0,6,0,0,0,0,0,0,0],[0,0,6,0,6,0,0,0,0,0,0,0],[0,0,6,6,6,6,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0,0,0,0]]"
      }
    ],
    max_tokens: 4000,
    temperature: 0.1
  });
  
  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
      'User-Agent': 'ARC-Explainer-Diagnostic/1.0'
    }
  };
  
  try {
    const response = await makeRequest(options, requestData);
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response.body);
      console.log(`✅ JSON parse successful`);
      console.log(`📊 Usage:`, parsedResponse.usage);
      console.log(`💬 Response:`, parsedResponse.choices?.[0]?.message?.content);
    } catch (parseError) {
      console.error(`❌ JSON parse failed:`, parseError.message);
      console.log(`🔍 Raw response saved for analysis`);
      
      // Save failed response for analysis
      const filename = `openrouter-failed-${modelName.replace('/', '-')}-${Date.now()}.json`;
      fs.writeFileSync(filename, response.body);
      console.log(`💾 Saved to: ${filename}`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    return null;
  }
}

/**
 * Test 2: Large response request to test token limits
 */
async function testLargeResponse(modelName) {
  console.log(`\n🧪 TEST 2: Large response request to ${modelName}`);
  
  const requestData = JSON.stringify({
    model: modelName,
    messages: [
      {
        role: "user",
        content: `Please write a very long story using only emojis and punctuation, NO WORDS or text. Make it at least 2000 emojis. Include lots of detail, dialogue, and description. This is a test to see how many unique emojis you can generate.`
      }
    ],
    // Intentionally request more tokens than suspected 200k limit
    max_tokens: 128000,
    temperature: 0.9
  });
  
  const options = {
    hostname: 'openrouter.ai',
    path: '/api/v1/chat/completions',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
      'User-Agent': 'ARC-Explainer-Diagnostic/1.0'
    }
  };
  
  try {
    const response = await makeRequest(options, requestData);
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(response.body);
      console.log(`✅ JSON parse successful`);
      console.log(`📊 Usage:`, parsedResponse.usage);
      
      const content = parsedResponse.choices?.[0]?.message?.content || '';
      console.log(`📝 Response length: ${content.length} characters`);
      
      // Check for truncation indicators
      if (content.endsWith('...') || content.includes('[truncated]')) {
        console.log(`⚠️  TRUNCATION DETECTED in response content`);
      }
      
      // Check if response seems incomplete (ends mid-sentence)
      const lastSentence = content.split('.').pop().trim();
      if (lastSentence.length > 50) {
        console.log(`⚠️  POSSIBLE TRUNCATION: Response ends mid-sentence`);
      }
      
    } catch (parseError) {
      console.error(`❌ JSON parse failed - LIKELY TRUNCATION:`, parseError.message);
      
      // Check if response ends abruptly
      if (!response.body.trim().endsWith('}')) {
        console.log(`🚨 CONFIRMED TRUNCATION: Response doesn't end with complete JSON`);
      }
      
      // Save truncated response for analysis
      const filename = `openrouter-truncated-${modelName.replace('/', '-')}-${Date.now()}.json`;
      fs.writeFileSync(filename, response.body);
      console.log(`💾 Saved truncated response to: ${filename}`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
    return null;
  }
}

/**
 * Actual problematic OpenRouter models from error logs
 * Focus on models showing "Unexpected end of JSON input" errors
 */
const TEST_MODELS = [
  'x-ai/grok-code-fast-1',           // Current error in logs
  'qwen/qwen3-235b-a22b-thinking-2507', // Current error in logs  
  'nousresearch/hermes-4-70b'        // Known problematic model
];

/**
 * Main diagnostic routine
 */
async function runDiagnostics() {
  console.log('🔬 OpenRouter Diagnostic Script Starting...');
  console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
  

  const results = [];

  for (const model of TEST_MODELS) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔬 Testing model: ${model}`);

    // Test 1: Minimal request
    const minimalResult = await testMinimalRequest(model);
    if (minimalResult) {
      results.push({ model, test: 'minimal', ...minimalResult });
    }

    // Wait between tests to avoid rate limits
    console.log(`⏳ Waiting 2 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Large response
    const largeResult = await testLargeResponse(model);
    if (largeResult) {
      results.push({ model, test: 'large', ...largeResult });
    }
    
    // Wait between models
    console.log(`⏳ Waiting 5 seconds before next model...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 DIAGNOSTIC SUMMARY');
  console.log(`${'='.repeat(80)}`);
  
  results.forEach(result => {
    console.log(`${result.model} (${result.test}): ${result.statusCode} - ${result.body.length} chars - ${result.duration}ms`);
  });
  
  // Save full results
  const summaryFile = `openrouter-diagnostic-${Date.now()}.json`;
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Full diagnostic results saved to: ${summaryFile}`);
  
  console.log('\n✅ Diagnostic complete');
}

// Run diagnostics
runDiagnostics().catch(console.error);
