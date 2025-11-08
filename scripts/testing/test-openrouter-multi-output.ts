/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-24
 * PURPOSE: Test ALL OpenRouter models against puzzle 337b420f (multi-output) to validate comprehensive functionality
 * SRP and DRY check: Pass - Single responsibility for testing OpenRouter models on multi-output puzzles with detailed validation
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Test puzzle ID (337b420f - has 2 test cases requiring multiple outputs)
const TEST_PUZZLE_ID = '337b420f';

// Timeout per model in milliseconds (15 minutes for complex multi-output puzzles)
const MODEL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * ALL OpenRouter models to test (including those that failed on 253bf280)
 * This comprehensive test will reveal if failures were puzzle-specific or systematic
 */
const ALL_OPENROUTER_MODELS = [
  // ✅ Previously successful models
  'meta-llama/llama-3.3-70b-instruct',
  'x-ai/grok-4-fast:free',
  'x-ai/grok-code-fast-1',
  'openai/gpt-oss-120b',
  'mistralai/codestral-2508',
  'qwen/qwen3-30b-a3b-instruct-2507',
  'qwen/qwen3-coder',
  'moonshotai/kimi-k2',
  'moonshotai/kimi-k2-0905',
  'moonshotai/kimi-k2-thinking',
  'moonshotai/kimi-dev-72b:free',
  'openrouter/polaris-alpha',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'x-ai/grok-3',
  'x-ai/grok-3-mini',
  'nvidia/nemotron-nano-9b-v2',
  'qwen/qwen3-max',
  'bytedance/seed-oss-36b-instruct',

  // Previously failed models (testing again on different puzzle)
  // ❌ Previously failed models (testing again on different puzzle)
  'qwen/qwen3-235b-a22b-thinking-2507', // server error on 253bf280
  'x-ai/grok-4', // server error on 253bf280
  'deepseek/deepseek-prover-v2', // rate limited on 253bf280
  'deepseek/deepseek-r1-0528:free' // rate limited on 253bf280
];

interface ModelTestRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  omitAnswer: boolean;
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
  multipleOutputs?: boolean;
  prediction1Valid?: boolean;
  prediction2Valid?: boolean;
  allPredictionsCorrect?: boolean;
  averageAccuracy?: number;
  actualResponse?: any;
  previousTestResult?: 'success' | 'failed' | 'new';
}

/**
 * Test a single OpenRouter model against puzzle 337b420f
 */
async function testOpenRouterModel(modelKey: string): Promise<ModelTestResult> {
  const startTime = Date.now();

  // Determine if this model previously succeeded or failed
  const previouslySuccessful = [
    'meta-llama/llama-3.3-70b-instruct', 'x-ai/grok-4-fast:free', 'x-ai/grok-code-fast-1',
    'openai/gpt-oss-120b', 'mistralai/codestral-2508', 'qwen/qwen3-30b-a3b-instruct-2507',
    'qwen/qwen3-coder', 'moonshotai/kimi-k2', 'moonshotai/kimi-k2-0905',
    'moonshotai/kimi-dev-72b:free', 'openrouter/polaris-alpha', 'nvidia/nemotron-nano-12b-v2-vl:free', 'x-ai/grok-3', 'x-ai/grok-3-mini',
    'nvidia/nemotron-nano-9b-v2', 'qwen/qwen3-max', 'bytedance/seed-oss-36b-instruct'
  ].includes(modelKey);

  const previouslyFailed = [
    'qwen/qwen3-235b-a22b-thinking-2507', 'x-ai/grok-4',
    'deepseek/deepseek-prover-v2', 'deepseek/deepseek-r1-0528:free'
  ].includes(modelKey);

  const previousTestResult = previouslySuccessful ? 'success' : (previouslyFailed ? 'failed' : 'new');

  try {
    console.log(`🚀 Testing ${modelKey}...`);
    console.log(`   Previous 253bf280 result: ${previousTestResult}`);

    // Standard analysis request configuration
    const requestBody: ModelTestRequest = {
      temperature: 0.2, // Standard temperature
      promptId: 'solver', // Use solver prompt
      systemPromptMode: 'ARC', // ARC system prompt mode
      omitAnswer: true, // Research mode - hide correct answer
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

      // Validate multi-output predictions
      const hasMultiplePredictions = explanation.hasMultiplePredictions || explanation.multiplePredictedOutputs;
      const multiTestResults = explanation.multiTestResults;
      const allCorrect = explanation.multiTestAllCorrect;
      const avgAccuracy = explanation.multiTestAverageAccuracy;

      // Check individual predictions
      const pred1Valid = explanation.predictedOutput1 && Array.isArray(explanation.predictedOutput1) && explanation.predictedOutput1.length > 0;
      const pred2Valid = explanation.predictedOutput2 && Array.isArray(explanation.predictedOutput2) && explanation.predictedOutput2.length > 0;

      console.log(`✅ SUCCESS: ${modelKey} (${responseTime}s)`);
      console.log(`   - Confidence: ${explanation.confidence || 'N/A'}`);
      console.log(`   - Has reasoning: ${explanation.hasReasoningLog ? 'Yes' : 'No'}`);
      console.log(`   - Multiple outputs: ${hasMultiplePredictions ? 'Yes' : 'No'}`);
      console.log(`   - Prediction 1 valid: ${pred1Valid ? 'Yes' : 'No'}`);
      console.log(`   - Prediction 2 valid: ${pred2Valid ? 'Yes' : 'No'}`);
      console.log(`   - All predictions correct: ${allCorrect !== undefined ? (allCorrect ? 'Yes' : 'No') : 'Unknown'}`);
      console.log(`   - Average accuracy: ${avgAccuracy !== undefined ? `${Math.round(avgAccuracy * 100)}%` : 'Unknown'}`);
      console.log(`   - Previous test: ${previousTestResult} -> SUCCESS`);

      return {
        modelKey,
        success: true,
        responseTime,
        hasExplanation: true,
        confidence: explanation.confidence,
        reasoning: explanation.hasReasoningLog,
        multipleOutputs: hasMultiplePredictions,
        prediction1Valid: pred1Valid,
        prediction2Valid: pred2Valid,
        allPredictionsCorrect: allCorrect,
        averageAccuracy: avgAccuracy,
        previousTestResult,
        actualResponse: {
          patternDescription: explanation.patternDescription,
          solvingStrategy: explanation.solvingStrategy,
          confidence: explanation.confidence,
          hasReasoning: explanation.hasReasoningLog,
          hasMultiplePredictions,
          multiTestAllCorrect: allCorrect,
          multiTestAverageAccuracy: avgAccuracy
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
    console.log(`   - Previous test: ${previousTestResult} -> FAILED AGAIN`);

    // Log additional details for debugging
    if (error.response?.status) {
      console.log(`   - HTTP Status: ${error.response.status}`);
    }

    return {
      modelKey,
      success: false,
      error: errorMessage,
      errorType,
      responseTime,
      previousTestResult
    };
  }
}

/**
 * Test all OpenRouter models CONCURRENTLY with staggered start times - much more efficient!
 */
async function testAllOpenRouterModels(): Promise<ModelTestResult[]> {
  console.log(`\n🔍 COMPREHENSIVE MULTI-OUTPUT TEST: ${ALL_OPENROUTER_MODELS.length} OpenRouter models on puzzle ${TEST_PUZZLE_ID}...`);
  console.log('='.repeat(100));
  console.log(`📋 Puzzle ${TEST_PUZZLE_ID} has 2 test cases - requires multiple predictions`);
  console.log(`🔄 Testing BOTH previously successful AND failed models for comprehensive validation`);
  console.log(`⚡ CONCURRENT EXECUTION: All models triggered with 2-second stagger, then wait for all results`);
  console.log('='.repeat(100));

  const analysisPromises: Promise<ModelTestResult>[] = [];

  // Trigger all analyses CONCURRENTLY with 2-second delays
  console.log(`\n🚀 Triggering ${ALL_OPENROUTER_MODELS.length} concurrent analyses...`);
  for (let i = 0; i < ALL_OPENROUTER_MODELS.length; i++) {
    const modelKey = ALL_OPENROUTER_MODELS[i];

    console.log(`[${i + 1}/${ALL_OPENROUTER_MODELS.length}] Triggering: ${modelKey}`);

    // Start the analysis immediately (don't await - let it run concurrently!)
    const analysisPromise = testOpenRouterModel(modelKey);
    analysisPromises.push(analysisPromise);

    // 2-second delay between triggers (not between completions!)
    if (i < ALL_OPENROUTER_MODELS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second stagger
    }
  }

  console.log(`\n✅ All ${ALL_OPENROUTER_MODELS.length} analyses triggered! Now waiting for results...`);
  console.log(`⏱️  This should take ~15 minutes max (instead of ${ALL_OPENROUTER_MODELS.length * 15} minutes sequentially!)`);

  // Now wait for ALL analyses to complete concurrently
  const results = await Promise.all(analysisPromises);

  return results;
}

/**
 * Generate comprehensive analysis report comparing single vs multi-output performance
 */
function generateComprehensiveReport(results: ModelTestResult[]): void {
  console.log('\n📊 COMPREHENSIVE OPENROUTER MULTI-OUTPUT TEST RESULTS');
  console.log('='.repeat(100));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Group by previous performance
  const previouslySuccessful = results.filter(r => r.previousTestResult === 'success');
  const previouslyFailed = results.filter(r => r.previousTestResult === 'failed');

  console.log(`\n📈 OVERALL SUMMARY:`);
  console.log(`   Total models tested: ${results.length}`);
  console.log(`   Successful on multi-output: ${successful.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed on multi-output: ${failed.length} (${((failed.length / results.length) * 100).toFixed(1)}%)`);

  if (successful.length > 0) {
    const avgTime = successful.reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful.length;
    const avgConfidence = successful
      .filter(r => r.confidence !== undefined)
      .reduce((sum, r) => sum + (r.confidence || 0), 0) / successful.filter(r => r.confidence !== undefined).length;

    console.log(`   Average response time: ${Math.round(avgTime)}s`);
    if (!isNaN(avgConfidence)) {
      console.log(`   Average confidence: ${Math.round(avgConfidence)}%`);
    }
  }

  // Performance comparison analysis
  console.log(`\n🔄 PERFORMANCE COMPARISON (253bf280 vs 337b420f):`);

  const nowSuccess_WasSuccess = previouslySuccessful.filter(r => r.success);
  const nowFailed_WasSuccess = previouslySuccessful.filter(r => !r.success);
  const nowSuccess_WasFailed = previouslyFailed.filter(r => r.success);
  const nowFailed_WasFailed = previouslyFailed.filter(r => !r.success);

  console.log(`   🟢 Consistent SUCCESS (${nowSuccess_WasSuccess.length}/${previouslySuccessful.length}): ${((nowSuccess_WasSuccess.length / previouslySuccessful.length) * 100).toFixed(1)}% of previously successful`);
  console.log(`   🟡 SUCCESS -> FAILED (${nowFailed_WasSuccess.length}): Multi-output more challenging for these models`);
  console.log(`   🟢 FAILED -> SUCCESS (${nowSuccess_WasFailed.length}): Previous failures were puzzle-specific!`);
  console.log(`   🔴 Consistent FAILED (${nowFailed_WasFailed.length}/${previouslyFailed.length}): ${((nowFailed_WasFailed.length / previouslyFailed.length) * 100).toFixed(1)}% of previously failed`);

  // Detailed successful models
  if (successful.length > 0) {
    console.log(`\n✅ SUCCESSFUL ON MULTI-OUTPUT PUZZLE (${successful.length} models):`);
    successful.forEach(result => {
      const statusIcon = result.previousTestResult === 'success' ? '🟢' : '🆕';
      const multiInfo = result.multipleOutputs ?
        `Multi: ${result.prediction1Valid ? '✓' : '✗'}P1 ${result.prediction2Valid ? '✓' : '✗'}P2` : 'No multi-output';
      const accuracyInfo = result.allPredictionsCorrect !== undefined ?
        `All correct: ${result.allPredictionsCorrect ? '✓' : '✗'}` : '';

      console.log(`   ${statusIcon} ${result.modelKey} (${result.responseTime}s, conf: ${result.confidence || 'N/A'}%)`);
      console.log(`      ${multiInfo} | ${accuracyInfo}`);
    });
  }

  // Detailed failed models
  if (failed.length > 0) {
    console.log(`\n❌ FAILED ON MULTI-OUTPUT PUZZLE (${failed.length} models):`);

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
        const statusIcon = result.previousTestResult === 'failed' ? '🔴' : '🟡';
        console.log(`     ${statusIcon} ${result.modelKey}: ${result.error}`);
      });
    });
  }

  // Special analysis for models that changed behavior
  if (nowFailed_WasSuccess.length > 0) {
    console.log(`\n⚠️  MODELS THAT STRUGGLED WITH MULTI-OUTPUT (${nowFailed_WasSuccess.length}):`);
    nowFailed_WasSuccess.forEach(result => {
      console.log(`   • ${result.modelKey}: ${result.error}`);
    });
    console.log(`   ➡️  These models work on single-output but struggle with multiple predictions`);
  }

  if (nowSuccess_WasFailed.length > 0) {
    console.log(`\n🎉 REDEEMED MODELS (${nowSuccess_WasFailed.length}):`);
    nowSuccess_WasFailed.forEach(result => {
      console.log(`   • ${result.modelKey}: Previous failure was puzzle-specific! Works on multi-output.`);
    });
    console.log(`   ➡️  Consider re-enabling these models - they can handle complex multi-output cases`);
  }

  // Final recommendations
  console.log(`\n🎯 RECOMMENDATIONS:`);
  console.log(`   1. MODELS PROVEN ROBUST: ${nowSuccess_WasSuccess.length} models work on both single & multi-output`);
  console.log(`   2. MODELS TO RE-ENABLE: ${nowSuccess_WasFailed.length} previously failed models actually work on multi-output`);
  console.log(`   3. MODELS TO INVESTIGATE: ${nowFailed_WasSuccess.length} work on single but fail on multi-output`);
  console.log(`   4. TOTAL WORKING MODELS: ${successful.length}/${results.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);

  console.log(`\n💾 DATABASE: Successful multi-output explanations saved automatically`);
  console.log(`🧩 PUZZLE: All tests used puzzle ${TEST_PUZZLE_ID} (2 test cases requiring multiple predictions)`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🤖 OPENROUTER MULTI-OUTPUT MODEL TESTING SCRIPT');
    console.log('='.repeat(100));
    console.log(`Target Puzzle: ${TEST_PUZZLE_ID} (2 test cases - multi-output)`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per model: ${MODEL_TIMEOUT_MS / 60000} minutes`);
    console.log(`Models to test: ${ALL_OPENROUTER_MODELS.length} (ALL OpenRouter models)`);
    console.log('='.repeat(100));
    console.log('🎯 PURPOSE: Comprehensive test of ALL OpenRouter models on multi-output puzzle');
    console.log('🔄 COMPARISON: Test both previously successful AND failed models');
    console.log('💾 RESULT: Multi-output predictions saved to database, detailed performance analysis');
    console.log('📋 OUTPUT: Recommendations for which models to enable based on comprehensive results');
    console.log('='.repeat(100));

    // Test all models
    const results = await testAllOpenRouterModels();

    // Generate comprehensive report
    generateComprehensiveReport(results);

    console.log('\n✨ Comprehensive multi-output testing complete! Review recommendations above.');

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

// Run the comprehensive test
main();