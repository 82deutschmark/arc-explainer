/**
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: GPT-5 Progressive Reasoning test using Responses API conversation chaining.
 *          Both Grok and GPT-5 use the same Responses API - the difference is model capabilities.
 *
 * CRITICAL CORRECTION:
 * - Both Grok-4 and GPT-5 use the SAME Responses API
 * - GPT-5 reasoning models: supportsReasoning=true, supportsTemperature=false
 * - GPT-5 reasoning parameters: reasoningEffort, reasoningVerbosity, reasoningSummaryType
 * - DO NOT send temperature for GPT-5 reasoning models (causes API errors)
 *
 * SRP and DRY check: Pass - Orchestrates progressive reasoning via Responses API
 *
 * USAGE:
 * node --import tsx scripts/gpt-5-progressive-reasoning.ts <gpt5-model-key> <puzzle-ids...>
 * node --import tsx scripts/gpt-5-progressive-reasoning.ts gpt-5-2025-08-07 045e512c 0e206a2e ...
 * node --import tsx scripts/gpt-5-progressive-reasoning.ts gpt-5-mini-2025-08-07 --iterations 3 <puzzle-ids...>
 *
 * The script performs iterative refinement:
 * - Iteration 0: Initial analysis (gets providerResponseId)
 * - Iteration 1+: Refinements using previousResponseId from prior iteration
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const PUZZLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes per iteration
const ITERATION_DELAY_MS = 3000; // 3 seconds between iterations (GPT-5 is slower)
const PUZZLE_STAGGER_MS = 3000; // 3 seconds between starting different puzzles (lower concurrency)

// Parse command line arguments
interface CLIArgs {
  gpt5Model: string;
  puzzleIds: string[];
  maxIterations: number;
  reasoningEffort: string;
  reasoningVerbosity: string;
  reasoningSummaryType: string;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  // First argument must be GPT-5 model key
  const gpt5Model = args[0];
  if (!gpt5Model || !gpt5Model.startsWith('gpt-5')) {
    console.error('Error: First argument must be a GPT-5 model key (e.g., gpt-5-2025-08-07)');
    console.error('Available GPT-5 models:');
    console.error('  - gpt-5-2025-08-07 (main reasoning model)');
    console.error('  - gpt-5-mini-2025-08-07 (smaller reasoning model)');
    console.error('  - gpt-5-nano-2025-08-07 (tiny reasoning model)');
    console.error('  - gpt-5-chat-latest (chat model, no reasoning)');
    process.exit(1);
  }

  let maxIterations = 2; // Default: 2 iterations (0, 1)
  let reasoningEffort = 'high'; // Default reasoning effort for GPT-5
  let reasoningVerbosity = 'high'; // Default reasoning verbosity
  let reasoningSummaryType = 'detailed'; // Default reasoning summary type

  // Parse flags
  const remainingArgs = args.slice(1);
  let puzzleIds: string[] = [];

  for (let i = 0; i < remainingArgs.length; i++) {
    const arg = remainingArgs[i];

    switch (arg) {
      case '--iterations':
      case '-i':
        const iterValue = Number(remainingArgs[++i]);
        if (!isNaN(iterValue) && iterValue > 0) {
          maxIterations = iterValue;
        }
        break;

      case '--reasoning-effort':
      case '--effort':
        const effortValue = remainingArgs[++i];
        if (['minimal', 'low', 'medium', 'high'].includes(effortValue)) {
          reasoningEffort = effortValue;
        }
        break;

      case '--reasoning-verbosity':
      case '--verbosity':
        const verbosityValue = remainingArgs[++i];
        if (['low', 'medium', 'high'].includes(verbosityValue)) {
          reasoningVerbosity = verbosityValue;
        }
        break;

      case '--reasoning-summary-type':
      case '--summary-type':
        const summaryValue = remainingArgs[++i];
        if (['auto', 'none', 'detailed'].includes(summaryValue)) {
          reasoningSummaryType = summaryValue;
        }
        break;

      case '--file':
      case '-f':
        const filePath = remainingArgs[++i];
        if (!filePath) {
          console.error('Error: No file path provided after --file flag');
          process.exit(1);
        }
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          puzzleIds = content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith('#'));
        } catch (error) {
          console.error(`Error reading file ${filePath}:`, error);
          process.exit(1);
        }
        break;

      default:
        if (!arg.startsWith('-')) {
          puzzleIds.push(arg);
        }
        break;
    }
  }

  return {
    gpt5Model,
    puzzleIds,
    maxIterations,
    reasoningEffort,
    reasoningVerbosity,
    reasoningSummaryType
  };
}

interface IterationResult {
  iterationNumber: number;
  success: boolean;
  explanationId?: number;
  providerResponseId?: string;
  isPredictionCorrect?: boolean;
  confidence?: number;
  responseTime?: number;
  reasoningLogLength?: number;
  error?: string;
}

interface PuzzleResult {
  puzzleId: string;
  modelName: string;
  iterations: IterationResult[];
  totalSuccess: boolean;
  totalTime: number;
}

/**
 * Validate GPT-5 model configuration
 */
function validateGpt5Model(modelKey: string): {
  supportsReasoning: boolean;
  supportsTemperature: boolean;
  isReasoningModel: boolean;
} {
  // These checks align with ModelCapabilities.ts overrides
  const reasoningModels = new Set([
    'gpt-5-2025-08-07',
    'gpt-5-mini-2025-08-07',
    'gpt-5-nano-2025-08-07'
  ]);

  const isReasoningModel = reasoningModels.has(modelKey);

  return {
    supportsReasoning: isReasoningModel,
    supportsTemperature: false, // GPT-5 reasoning models don't support temperature
    isReasoningModel
  };
}

/**
 * Run a single iteration for a puzzle
 */
async function runIteration(
  puzzleId: string,
  modelKey: string,
  iterationNumber: number,
  previousResponseId?: string,
  reasoningEffort: string = 'medium',
  reasoningVerbosity: string = 'medium',
  reasoningSummaryType: string = 'auto'
): Promise<IterationResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🔄 ${puzzleId} - Iteration ${iterationNumber}${previousResponseId ? ` (continuing from ${previousResponseId.substring(0, 8)}...)` : ' (initial)'}`);

    // Build request payload - GPT-5 specific configuration
    const requestBody: any = {
      promptId: 'discussion', // CRITICAL: Use discussion mode for progressive reasoning
      systemPromptMode: 'ARC',
      omitAnswer: true,
      retryMode: false
    };

    // Add previousResponseId for continuation iterations
    if (previousResponseId) {
      requestBody.previousResponseId = previousResponseId;
    }

    // Add GPT-5 specific reasoning parameters (DO NOT send temperature for reasoning models)
    const modelValidation = validateGpt5Model(modelKey);
    if (modelValidation.supportsReasoning) {
      requestBody.reasoningEffort = reasoningEffort;
      requestBody.reasoningVerbosity = reasoningVerbosity;
      requestBody.reasoningSummaryType = reasoningSummaryType;
    }

    // Only send temperature for models that support it
    if (modelValidation.supportsTemperature) {
      requestBody.temperature = 0.99;
    }

    const encodedModelKey = encodeURIComponent(modelKey);

    // Step 1: Analyze the puzzle
    const analysisResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`,
      requestBody,
      {
        timeout: PUZZLE_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!analysisResponse.data.success) {
      throw new Error(analysisResponse.data.message || 'Analysis failed');
    }

    const analysisData = analysisResponse.data.data;
    const newProviderResponseId = analysisData.providerResponseId;

    // Step 2: Save to database
    const explanationToSave = {
      [modelKey]: {
        ...analysisData,
        modelKey
      }
    };

    const saveResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`,
      { explanations: explanationToSave },
      {
        timeout: 30000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!saveResponse.data.success) {
      throw new Error(`Save failed: ${saveResponse.statusText}`);
    }

    const savedExplanationId = saveResponse.data.explanationIds?.[0] || null;
    const isPredictionCorrect = analysisData.isPredictionCorrect || analysisData.multiTestAllCorrect;
    const confidence = analysisData.confidence;
    const reasoningLogLength = analysisData.reasoningLog ?
      (typeof analysisData.reasoningLog === 'string' ? analysisData.reasoningLog.length : JSON.stringify(analysisData.reasoningLog).length)
      : 0;

    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    console.log(`✅ Iteration ${iterationNumber} complete in ${responseTime}s`);
    console.log(`   Explanation ID: ${savedExplanationId}`);
    console.log(`   Provider Response ID: ${newProviderResponseId?.substring(0, 16)}...`);
    console.log(`   Correct: ${isPredictionCorrect ? '✓' : '✗'}, Confidence: ${confidence}%`);
    if (reasoningLogLength > 0) {
      console.log(`   Reasoning Log: ${reasoningLogLength} chars`);
    }

    return {
      iterationNumber,
      success: true,
      explanationId: savedExplanationId,
      providerResponseId: newProviderResponseId,
      isPredictionCorrect,
      confidence,
      responseTime,
      reasoningLogLength
    };
  } catch (error: any) {
    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    let errorMessage = 'Unknown error';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.log(`❌ Iteration ${iterationNumber} failed in ${responseTime}s: ${errorMessage}`);

    return {
      iterationNumber,
      success: false,
      error: errorMessage,
      responseTime
    };
  }
}

/**
 * Run progressive reasoning for a single puzzle
 */
async function runProgressiveReasoning(
  puzzleId: string,
  modelKey: string,
  maxIterations: number,
  reasoningEffort: string,
  reasoningVerbosity: string,
  reasoningSummaryType: string
): Promise<PuzzleResult> {
  const startTime = Date.now();
  const iterations: IterationResult[] = [];
  let lastProviderResponseId: string | undefined;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧩 Starting GPT-5 Progressive Reasoning for ${puzzleId}`);
  console.log(`   Model: ${modelKey}`);
  console.log(`   Reasoning Effort: ${reasoningEffort}`);
  console.log(`   Reasoning Verbosity: ${reasoningVerbosity}`);
  console.log(`   Reasoning Summary: ${reasoningSummaryType}`);
  console.log(`   Max Iterations: ${maxIterations}`);
  console.log(`${'='.repeat(80)}`);

  for (let i = 0; i < maxIterations; i++) {
    const result = await runIteration(
      puzzleId,
      modelKey,
      i,
      lastProviderResponseId,
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType
    );
    iterations.push(result);

    if (!result.success) {
      console.log(`⚠️  Stopping iterations for ${puzzleId} due to failure`);
      break;
    }

    if (!result.providerResponseId) {
      console.log(`⚠️  No provider response ID returned, cannot continue iterations`);
      break;
    }

    lastProviderResponseId = result.providerResponseId;

    // Delay between iterations (except after last one)
    if (i < maxIterations - 1) {
      await new Promise(resolve => setTimeout(resolve, ITERATION_DELAY_MS));
    }
  }

  const endTime = Date.now();
  const totalTime = Math.round((endTime - startTime) / 1000);
  const totalSuccess = iterations.every(iter => iter.success);

  console.log(`\n📊 Summary for ${puzzleId}:`);
  console.log(`   Total Iterations: ${iterations.length}`);
  console.log(`   Successful: ${iterations.filter(i => i.success).length}`);
  console.log(`   Failed: ${iterations.filter(i => !i.success).length}`);
  console.log(`   Total Time: ${totalTime}s`);

  // Show progression of correctness
  const correctnessProgression = iterations
    .filter(i => i.success)
    .map(i => i.isPredictionCorrect ? '✓' : '✗')
    .join(' → ');
  if (correctnessProgression) {
    console.log(`   Correctness: ${correctnessProgression}`);
  }

  // Show reasoning log progression
  const reasoningProgression = iterations
    .filter(i => i.success && i.reasoningLogLength !== undefined)
    .map(i => `${i.reasoningLogLength} chars`)
    .join(' → ');
  if (reasoningProgression) {
    console.log(`   Reasoning Log: ${reasoningProgression}`);
  }

  return {
    puzzleId,
    modelName: modelKey,
    iterations,
    totalSuccess,
    totalTime
  };
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const {
      gpt5Model,
      puzzleIds,
      maxIterations,
      reasoningEffort,
      reasoningVerbosity,
      reasoningSummaryType
    } = parseArgs();

    if (puzzleIds.length === 0) {
      console.log('\n❌ No puzzle IDs provided.');
      console.log('\nUsage examples:');
      console.log(`  node --import tsx scripts/gpt-5-progressive-reasoning.ts ${gpt5Model} <puzzle-ids...>`);
      console.log(`  node --import tsx scripts/gpt-5-progressive-reasoning.ts ${gpt5Model} --iterations 3 <puzzle-ids...>`);
      console.log(`  node --import tsx scripts/gpt-5-progressive-reasoning.ts ${gpt5Model} --file puzzle-ids.txt`);
      console.log('\nAvailable GPT-5 models:');
      console.log('  - gpt-5-2025-08-07 (main reasoning model)');
      console.log('  - gpt-5-mini-2025-08-07 (smaller reasoning model)');
      console.log('  - gpt-5-nano-2025-08-07 (tiny reasoning model)');
      console.log('  - gpt-5-chat-latest (chat model, no reasoning)');
      process.exit(1);
    }

    // Validate model configuration
    const modelValidation = validateGpt5Model(gpt5Model);
    if (!modelValidation.supportsReasoning && reasoningEffort !== 'medium') {
      console.log(`⚠️  Warning: ${gpt5Model} doesn't support reasoning parameters, ignoring reasoning settings`);
    }

    console.log('🧠 GPT-5 PROGRESSIVE REASONING TEST');
    console.log('='.repeat(80));
    console.log(`Model: ${gpt5Model}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Max Iterations per Puzzle: ${maxIterations}`);
    console.log(`Reasoning Effort: ${reasoningEffort}`);
    console.log(`Reasoning Verbosity: ${reasoningVerbosity}`);
    console.log(`Reasoning Summary Type: ${reasoningSummaryType}`);
    console.log(`Puzzles: ${puzzleIds.length}`);
    console.log(`Timeout per iteration: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log('='.repeat(80));

    // Fire off all puzzles concurrently with staggered starts (3s delay for GPT-5)
    const resultPromises: Promise<PuzzleResult>[] = [];

    for (let i = 0; i < puzzleIds.length; i++) {
      const puzzleId = puzzleIds[i];

      // Wrap in delayed promise to stagger starts (lower concurrency for GPT-5)
      const delayedPromise = new Promise<PuzzleResult>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await runProgressiveReasoning(
              puzzleId,
              gpt5Model,
              maxIterations,
              reasoningEffort,
              reasoningVerbosity,
              reasoningSummaryType
            );
            resolve(result);
          } catch (error) {
            console.error(`Fatal error processing ${puzzleId}:`, error);
            resolve({
              puzzleId,
              modelName: gpt5Model,
              iterations: [],
              totalSuccess: false,
              totalTime: 0
            });
          }
        }, i * PUZZLE_STAGGER_MS);
      });

      resultPromises.push(delayedPromise);
    }

    // Wait for all puzzles to complete
    console.log(`\n⚡ All ${puzzleIds.length} puzzles queued with ${PUZZLE_STAGGER_MS/1000}s stagger. Processing concurrently...\n`);
    const allResults = await Promise.all(resultPromises);

    // Final summary
    console.log('\n\n🎉 FINAL SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Puzzles: ${allResults.length}`);
    console.log(`Fully Successful: ${allResults.filter(r => r.totalSuccess).length}`);
    console.log(`Partial Success: ${allResults.filter(r => !r.totalSuccess && r.iterations.some(i => i.success)).length}`);
    console.log(`Complete Failure: ${allResults.filter(r => r.iterations.every(i => !i.success)).length}`);

    const totalIterations = allResults.reduce((sum, r) => sum + r.iterations.length, 0);
    const successfulIterations = allResults.reduce((sum, r) => sum + r.iterations.filter(i => i.success).length, 0);
    console.log(`\nTotal Iterations: ${totalIterations}`);
    console.log(`Successful Iterations: ${successfulIterations} (${((successfulIterations / totalIterations) * 100).toFixed(1)}%)`);

    const avgTime = allResults.reduce((sum, r) => sum + r.totalTime, 0) / allResults.length;
    console.log(`Average Time per Puzzle: ${Math.round(avgTime)}s`);

    // Show improvement analysis
    console.log('\n📈 IMPROVEMENT ANALYSIS:');
    let improvedCount = 0;
    let unchangedCount = 0;
    let degradedCount = 0;

    for (const result of allResults) {
      const successfulIters = result.iterations.filter(i => i.success && i.isPredictionCorrect !== undefined);
      if (successfulIters.length >= 2) {
        const firstCorrect = successfulIters[0].isPredictionCorrect;
        const lastCorrect = successfulIters[successfulIters.length - 1].isPredictionCorrect;

        if (!firstCorrect && lastCorrect) improvedCount++;
        else if (firstCorrect === lastCorrect) unchangedCount++;
        else if (firstCorrect && !lastCorrect) degradedCount++;
      }
    }

    console.log(`   Improved (✗ → ✓): ${improvedCount}`);
    console.log(`   Unchanged: ${unchangedCount}`);
    console.log(`   Degraded (✓ → ✗): ${degradedCount}`);

    // GPT-5 specific analysis
    console.log('\n🧠 GPT-5 SPECIFIC ANALYSIS:');
    const totalReasoningLogLength = allResults.reduce((sum, r) =>
      sum + r.iterations.filter(i => i.success && i.reasoningLogLength)
        .reduce((iterSum, i) => iterSum + (i.reasoningLogLength || 0), 0), 0);
    console.log(`   Total Reasoning Log Content: ${totalReasoningLogLength} characters`);

    if (successfulIterations > 0) {
      const avgReasoningLength = Math.round(totalReasoningLogLength / successfulIterations);
      console.log(`   Average Reasoning Log Length: ${avgReasoningLength} characters per iteration`);
    }

    console.log('\n✨ GPT-5 progressive reasoning test complete!');
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Test terminated');
  process.exit(0);
});

// Run the test
main();
