/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Quick health check for Grok models using the Responses API
 * Tests grok-4-0709 and grok-4-fast to verify direct xAI API integration
 * SRP and DRY check: Pass - Single purpose health check script
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_PUZZLE_ID = '007bbfb7'; // Simple test puzzle
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const GROK_MODELS = [
  { key: 'grok-4-0709', name: 'Grok 4' },
  { key: 'grok-4-fast', name: 'Grok 4 Fast' }
];

async function testModel(modelKey, modelName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${modelName} (${modelKey})`);
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/analyze`,
      {
        puzzleId: TEST_PUZZLE_ID,
        modelKey: modelKey,
        temperature: 0.2,
        promptId: 'solver',
        systemPromptMode: 'ARC'
      },
      {
        timeout: TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (response.data?.success) {
      const data = response.data.data;
      console.log(`✅ SUCCESS (${duration}s)`);
      console.log(`   Model: ${data.model}`);
      console.log(`   Confidence: ${data.confidence || 'N/A'}`);
      console.log(`   Has Reasoning: ${data.hasReasoningLog ? 'Yes' : 'No'}`);
      console.log(`   Tokens: ${data.inputTokens}/${data.outputTokens}${data.reasoningTokens ? `/${data.reasoningTokens}` : ''}`);
      console.log(`   Cost: $${data.estimatedCost?.toFixed(4) || '0.0000'}`);
      console.log(`   Processing Time: ${data.apiProcessingTime || 'N/A'}ms`);

      if (data.reasoningLog) {
        const reasoningPreview = data.reasoningLog.substring(0, 100);
        console.log(`   Reasoning Preview: ${reasoningPreview}...`);
      }

      return {
        modelKey,
        success: true,
        duration,
        tokens: {
          input: data.inputTokens,
          output: data.outputTokens,
          reasoning: data.reasoningTokens
        },
        cost: data.estimatedCost
      };
    } else {
      console.log(`   Response data:`, JSON.stringify(response.data, null, 2));
      throw new Error(`API returned success=false: ${response.data?.error || 'Unknown error'}`);
    }
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`❌ FAILED (${duration}s)`);

    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${error.response.data?.error || 'Unknown error'}`);
      console.log(`   Message: ${error.response.data?.message || 'No message'}`);
    } else if (error.request) {
      console.log(`   Error: No response from server`);
      console.log(`   Details: ${error.message}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }

    return {
      modelKey,
      success: false,
      duration,
      error: error.message
    };
  }
}

async function runHealthCheck() {
  console.log('\n🏥 Grok Models Health Check');
  console.log(`API: ${API_BASE_URL}`);
  console.log(`Test Puzzle: ${TEST_PUZZLE_ID}`);
  console.log(`Timeout: ${TIMEOUT_MS / 1000}s`);

  const results = [];

  for (const model of GROK_MODELS) {
    const result = await testModel(model.key, model.name);
    results.push(result);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`✅ Passed: ${successCount}/${GROK_MODELS.length}`);
  console.log(`❌ Failed: ${failCount}/${GROK_MODELS.length}`);

  if (successCount > 0) {
    console.log('\nSuccessful Models:');
    results
      .filter(r => r.success)
      .forEach(r => {
        console.log(`  - ${r.modelKey}: ${r.duration}s, $${r.cost?.toFixed(4) || '0.0000'}`);
      });
  }

  if (failCount > 0) {
    console.log('\nFailed Models:');
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.modelKey}: ${r.error}`);
      });
  }

  console.log('\n' + '='.repeat(60));

  process.exit(failCount > 0 ? 1 : 0);
}

runHealthCheck().catch(error => {
  console.error('\n❌ Health check failed:', error.message);
  process.exit(1);
});
