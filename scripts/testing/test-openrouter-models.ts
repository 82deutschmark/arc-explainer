/**
 * 
 * Author: Cascade using `Gemini 2.5 Pro`
 * Date: 2025-09-24T20:08:54-04:00
 * PURPOSE: Provides a command-line utility for exercising OpenRouter-backed puzzle analysis endpoints, including retry logic for immediate failures to reduce transient noise. Touches `server/config/models.ts` for model keys and the analysis API.
 * SRP and DRY check: Pass - Verified this script uniquely handles OpenRouter batch testing without duplicating logic elsewhere in `scripts/testing/`.
 */

// @ts-ignore
import modelsConfig from '../server/config/models.ts';

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Test puzzle ID (insert ID as requested)
const TEST_PUZZLE_ID = '2dc579da';

const MODEL_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

import axios from 'axios';
import dotenv from 'dotenv';

// Import models configuration to get all OpenRouter models
dotenv.config();

// Extract all OpenRouter models from the configuration
interface ModelConfig {
  key: string;
  name: string;
  provider: string;
  apiModelName: string;
  modelType: string;
}

// Complete list of all OpenRouter models from models.ts
// This is a comprehensive list of all models with provider: 'OpenRouter' and modelType: 'openrouter'
const OPENROUTER_MODELS_TO_TEST = [
  'meta-llama/llama-3.3-70b-instruct',
  'x-ai/grok-4-fast:free',
  'qwen/qwen-2.5-coder-32b-instruct',
  'cohere/command-r-plus',
  'baidu/ernie-4.5-vl-28b-a3b',
  'nousresearch/hermes-4-70b',
  'mistralai/mistral-large',
  'deepseek/deepseek-chat-v3.1',
  'openai/gpt-oss-120b',
  'mistralai/codestral-2508',
  'qwen/qwen3-30b-a3b-instruct',
  'qwen/qwen3-235b-a22b-thinking',
  'qwen/qwen3-coder',
  'moonshotai/kimi-k2-thinking',
  'moonshotai/kimi-dev-72b:free',
  'openrouter/polaris-alpha',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  
  'x-ai/grok-3',
  'x-ai/grok-3-mini',
  'x-ai/grok-code-fast-1',
  'cohere/command-a',
  'deepseek/deepseek-prover-v2',
  'deepseek/deepseek-r1-0528:free',
  'nvidia/nemotron-nano-9b-v2',
  'qwen/qwen3-max',
  'bytedance/seed-oss-36b-instruct',
  'stepfun-ai/step3',
  'qwen/qwen-plus-2025-07-28:thinking'
];

interface ModelTestRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  retryMode: boolean;
}

interface ModelTestResult {
  modelKey: string;
  success: boolean;
  error?: string;
  errorType?: string;
  responseTime?: number;
  hasExplanation?: boolean;
  confidence?: number;
  reasoning?: boolean;
  actualResponse?: any;
}

/**
 * Test a single OpenRouter model against puzzle 3ac3eb23
 */
async function testOpenRouterModel(modelKey: string): Promise<ModelTestResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Testing OpenRouter model: ${modelKey}...`);

    // Standard analysis request configuration
    const requestBody: ModelTestRequest = {
      temperature: 0.2, // Standard temperature
      promptId: 'solver', // Use solver prompt
      systemPromptMode: 'ARC', // ARC system prompt mode
      retryMode: false // Not in retry mode
    };

    // URL-encode model key for API call
    const encodedModelKey = encodeURIComponent(modelKey);

    // Make the analysis request
    const response = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${TEST_PUZZLE_ID}/${encodedModelKey}`,
      requestBody,
      {
        timeout: MODEL_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    if (response.data.success) {
      const explanation = response.data.data;

      console.log(`✅ SUCCESS: ${modelKey} (${responseTime}s)`);
      console.log(`   - Confidence: ${explanation.confidence || 'N/A'}`);
      console.log(`   - Has reasoning: ${explanation.hasReasoningLog ? 'Yes' : 'No'}`);
      console.log(`   - Pattern: ${explanation.patternDescription?.substring(0, 80)}...`);

      return {
        modelKey,
        success: true,
        responseTime,
        hasExplanation: true,
        confidence: explanation.confidence,
        reasoning: explanation.hasReasoningLog,
        actualResponse: {
          patternDescription: explanation.patternDescription,
          solvingStrategy: explanation.solvingStrategy,
          confidence: explanation.confidence,
          hasReasoning: explanation.hasReasoningLog
        }
      };
    } else {
      throw new Error(response.data.message || response.data.error || 'Analysis failed');
    }

  } catch (error: any) {
    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    // Detailed error classification for debugging
    let errorType = 'unknown';
    let errorMessage = 'Unknown error';

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorType = 'timeout';
      errorMessage = `Model timed out after ${MODEL_TIMEOUT_MS / 1000}s`;
    } else if (error.response?.status === 429) {
      errorType = 'rate_limit';
      errorMessage = 'Rate limited - model temporarily unavailable';
    } else if (error.response?.status === 404) {
      errorType = 'not_found';
      errorMessage = 'Model not found or no longer available';
    } else if (error.response?.status >= 500) {
      errorType = 'server_error';
      errorMessage = 'OpenRouter service error';
    } else if (error.response?.data?.message) {
      errorType = 'api_error';
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.error) {
      errorType = 'api_error';
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorType = 'client_error';
      errorMessage = error.message;
    }

    // Enhanced logging for parsing/JSON errors
    if (errorMessage.includes('JSON') || errorMessage.includes('parse') || errorMessage.includes('Invalid')) {
      errorType = 'parsing_error';
    }

    console.log(`❌ FAILED: ${modelKey} (${responseTime}s)`);
    console.log(`   - Error Type: ${errorType}`);
    console.log(`   - Error: ${errorMessage}`);

    // Log additional details for debugging
    if (error.response?.status) {
      console.log(`   - HTTP Status: ${error.response.status}`);
    }
    if (error.response?.data && typeof error.response.data === 'object') {
      console.log(`   - Response Keys: ${Object.keys(error.response.data).join(', ')}`);
    }

    return {
      modelKey,
      success: false,
      error: errorMessage,
      errorType,
      responseTime
    };
  }
}

/**
 * Test all OpenRouter models in parallel with rapid succession
 */
async function testAllOpenRouterModels(): Promise<ModelTestResult[]> {
  console.log(`
🔍 Testing ${OPENROUTER_MODELS_TO_TEST.length} OpenRouter models against puzzle ${TEST_PUZZLE_ID}...`);
  console.log(`📋 Models to test: ${OPENROUTER_MODELS_TO_TEST.join(', ')}`);
  console.log('='.repeat(80));

  console.log(`\n🚀 FIRST PASS: Testing all ${OPENROUTER_MODELS_TO_TEST.length} models rapidly...`);

  const firstPassPromises: Promise<ModelTestResult>[] = [];
  const modelKeys: string[] = [];

  for (let i = 0; i < OPENROUTER_MODELS_TO_TEST.length; i++) {
    const modelKey = OPENROUTER_MODELS_TO_TEST[i];
    modelKeys.push(modelKey);
    console.log(`[${i + 1}/${OPENROUTER_MODELS_TO_TEST.length}] Starting test for: ${modelKey}`);

    firstPassPromises.push(testOpenRouterModel(modelKey));

    if (i < OPENROUTER_MODELS_TO_TEST.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n⚡ All ${OPENROUTER_MODELS_TO_TEST.length} requests initiated! Waiting for responses...`);

  const firstPassResults = await Promise.allSettled(firstPassPromises);

  const retainedResults: ModelTestResult[] = [];
  const immediateFailures: string[] = [];

  for (let i = 0; i < firstPassResults.length; i++) {
    const settled = firstPassResults[i];
    const modelKey = modelKeys[i];

    if (settled.status === 'fulfilled') {
      const testResult = settled.value;

      if (testResult.success) {
        retainedResults.push(testResult);
      } else if (typeof testResult.responseTime === 'number' && testResult.responseTime < 5) {
        console.log(`⚠️  ${modelKey} failed immediately (${testResult.responseTime}s) - will retry later`);
        immediateFailures.push(modelKey);
      } else {
        retainedResults.push(testResult);
      }
    } else {
      console.log(`⚠️  ${modelKey} threw exception - will retry later`);
      immediateFailures.push(modelKey);
    }
  }

  console.log(`\n📊 FIRST PASS RESULTS:`);
  console.log(`   ✅ Successful: ${retainedResults.filter(result => result.success).length}`);
  console.log(`   ❌ Failed (no retry): ${retainedResults.filter(result => !result.success).length}`);
  console.log(`   🔄 Immediate failures to retry: ${immediateFailures.length}`);

  let retryResults: ModelTestResult[] = [];

  if (immediateFailures.length > 0) {
    console.log(`\n🔄 RETRY PASS: Retrying ${immediateFailures.length} immediate failures...`);
    console.log(`   Waiting 30 seconds before retry...`);

    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log(`   Starting retry requests...`);

    const retryPromises: Promise<ModelTestResult>[] = [];
    for (let i = 0; i < immediateFailures.length; i++) {
      const modelKey = immediateFailures[i];
      console.log(`   Retrying: ${modelKey}`);
      retryPromises.push(testOpenRouterModel(modelKey));

      if (i < immediateFailures.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const retrySettled = await Promise.allSettled(retryPromises);

    retryResults = retrySettled.map((result, index) => {
      const modelKey = immediateFailures[index];

      if (result.status === 'fulfilled') {
        const retryResult = result.value;
        console.log(`   ${retryResult.success ? '✅' : '❌'} ${modelKey} ${retryResult.success ? 'succeeded' : 'failed'} on retry`);
        return retryResult;
      }

      console.log(`   ❌ ${modelKey} failed with exception on retry`);
      return {
        modelKey,
        success: false,
        error: result.reason?.message || 'Unknown error on retry',
        errorType: 'exception',
        responseTime: 0
      };
    });
  }

  const allResults = [...retainedResults, ...retryResults];

  console.log(`\n🎯 FINAL RESULTS:`);
  console.log(`   Total models tested: ${allResults.length}`);
  console.log(`   Successful: ${allResults.filter(result => result.success).length}`);
  console.log(`   Failed: ${allResults.filter(result => !result.success).length}`);

  return allResults;
}

/**
 * Generate detailed analysis report
 */
function generateReport(results: ModelTestResult[]): void {
  console.log('\n📊 OPENROUTER MODEL TEST RESULTS');
  console.log('='.repeat(80));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total models tested: ${results.length}`);
  console.log(`   Successful: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);

  if (successful.length > 0) {
    const avgTime = successful.reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful.length;
    const avgConfidence = successful
      .filter(r => r.confidence !== undefined)
      .reduce((sum, r) => sum + (r.confidence || 0), 0) / successful.length;

    console.log(`   Average response time: ${Math.round(avgTime)}s`);
    console.log(`   Average confidence: ${Math.round(avgConfidence)}%`);
  }

  // Successful models - recommend for re-enabling
  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL MODELS (RECOMMEND RE-ENABLING):`);
    successful.forEach(result => {
      console.log(`   ✓ ${result.modelKey} (${result.responseTime}s, confidence: ${result.confidence || 'N/A'}%)`);
    });
  }

  // Failed models with error analysis
  if (failed.length > 0) {
    console.log(`\n❌ FAILED MODELS (DO NOT RE-ENABLE YET):`);

    // Group by error type for analysis
    const errorGroups = failed.reduce((groups, result) => {
      const errorType = result.errorType || 'unknown';
      if (!groups[errorType]) groups[errorType] = [];
      groups[errorType].push(result);
      return groups;
    }, {} as Record<string, ModelTestResult[]>);

    Object.entries(errorGroups).forEach(([errorType, failedResults]) => {
      console.log(`\n   🔍 ${errorType.toUpperCase()} (${failedResults.length} models):`);
      failedResults.forEach(result => {
        console.log(`     ✗ ${result.modelKey}: ${result.error}`);
      });
    });
  }

  // Specific recommendations
  console.log(`\n🎯 RECOMMENDATIONS:`);
  console.log(`   1. RE-ENABLE these ${successful.length} models in models.ts (uncomment them)`);
  console.log(`   2. INVESTIGATE failed models - check error patterns above`);
  console.log(`   3. TEST AGAIN after fixing any systematic issues`);

  if (successful.length === 0) {
    console.log(`   ⚠️  WARNING: NO models passed! Check API configuration and server status.`);
  }

  console.log(`\n💾 DATABASE: Successful explanations have been automatically saved to the database.`);
  console.log(`🔍 PUZZLE: All tests used puzzle ${TEST_PUZZLE_ID} for consistency.`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🤖 OPENROUTER MODEL TESTING SCRIPT');
    console.log('='.repeat(80));
    console.log(`Target Puzzle: ${TEST_PUZZLE_ID}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per model: ${MODEL_TIMEOUT_MS / 60000} minutes`);
    console.log(`Models to test: ${OPENROUTER_MODELS_TO_TEST.length}`);
    console.log('='.repeat(80));
    console.log('🎯 PURPOSE: Test each OpenRouter model to determine which ones work properly');
    console.log('💾 RESULT: Working models will be saved to database, failed ones will be logged');
    console.log('📋 OUTPUT: Detailed report with recommendations for re-enabling models');
    console.log('='.repeat(80));

    // Test all models
    const results = await testAllOpenRouterModels();

    // Generate comprehensive report
    generateReport(results);

    console.log('\n✨ Testing complete! Use the recommendations above to update models.ts');

  } catch (error) {
    console.error('💥 Fatal error during testing:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Testing interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Testing terminated');
  process.exit(0);
});

// Run the test
main();