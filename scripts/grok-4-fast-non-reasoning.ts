/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-10
 * PURPOSE: Analyze ARC Eval puzzles using Grok-4-Fast-Non-Reasoning model via external API endpoints.
 *          This script fires all analyses concurrently with 2-second staggered starts for rate limiting.
 *          Follows proper validation flow from Analysis_Data_Flow_Trace.md:
 *          1. Frontend calls /api/puzzle/analyze (analysis + validation)
 *          2. Backend validates response and calculates correctness
 *          3. Frontend calls /api/puzzle/save-explained (database persistence)
 *          4. Correctness determined by shared/utils/correctness.ts logic
 *
 * SRP and DRY check: Pass - Orchestrates puzzle analysis with proper error handling and verbose progress tracking
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Grok-4-Fast-Non-Reasoning model to use for analysis
const GROK_MODEL = 'grok-4-fast-non-reasoning';

// Timeout per puzzle in milliseconds (45 minutes for Grok-4-fast-non-reasoning)
const PUZZLE_TIMEOUT_MS = 45 * 60 * 1000;

// Delay between starting each puzzle (rate limiting protection)
const PUZZLE_STAGGER_MS = 2000; // 2 seconds between puzzle starts

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
  // NOTE: NO reasoning parameters - this is the non-reasoning variant and Grok doesn't support adjusting it!!
}

interface AnalysisResult {
  puzzleId: string;
  success: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * Get all puzzle IDs from a dataset directory
 */
function getPuzzleIdsFromDataset(dataset: 'arc1' | 'arc2'): string[] {
  const dataDir = path.join(process.cwd(), 'data');
  const evalDir = dataset === 'arc1' ? 'evaluation' : 'evaluation2';
  const fullPath = path.join(dataDir, evalDir);

  try {
    const files = fs.readdirSync(fullPath);
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  } catch (error) {
    console.error(`Error reading dataset directory ${fullPath}:`, error);
    process.exit(1);
  }
}

/**
 * Parse command line arguments to get puzzle IDs or dataset
 */
function getPuzzleIdsFromArgs(): string[] {
  const args = process.argv.slice(2);

  // Check if dataset flag was provided
  const datasetIndex = args.findIndex(arg => arg === '--dataset' || arg === '-d');
  if (datasetIndex !== -1) {
    const dataset = args[datasetIndex + 1];
    if (!dataset || (dataset !== 'arc1' && dataset !== 'arc2')) {
      console.error('Error: Invalid dataset. Use "arc1" or "arc2"');
      process.exit(1);
    }
    console.log(`📊 Loading all puzzles from ${dataset === 'arc1' ? 'ARC 1 Eval (400 puzzles)' : 'ARC 2 Eval (120 puzzles)'}...`);
    return getPuzzleIdsFromDataset(dataset);
  }

  // Check if a file was provided
  const fileIndex = args.findIndex(arg => arg === '--file' || arg === '-f');
  if (fileIndex !== -1) {
    const filePath = args[fileIndex + 1];
    if (!filePath) {
      console.error('Error: No file path provided after --file flag');
      process.exit(1);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      process.exit(1);
    }
  }

  // Otherwise, treat all arguments as puzzle IDs
  return args.filter(arg => !arg.startsWith('-'));
}

/**
 * Analyze a single puzzle with Grok-4-Fast-Non-Reasoning
 * Follows proper validation flow from Analysis_Data_Flow_Trace.md
 */
async function analyzePuzzle(puzzleId: string, index: number, total: number): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🧩 PUZZLE ${index + 1}/${total}: ${puzzleId}`);
    console.log(`${'='.repeat(80)}`);
    console.log(`⏱️  Start Time: ${new Date().toISOString()}`);
    console.log(`🤖 Model: ${GROK_MODEL}`);
    console.log(`📝 Prompt: solver (standard puzzle-solving prompt)`);
    console.log(`🌡️  Temperature: 0.99`);
    console.log(`⏳ Timeout: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);

    // Prepare analysis request following frontend pattern
    const requestBody: AnalysisRequest = {
      temperature: 0.99,
      promptId: 'solver',
      systemPromptMode: 'ARC',
      omitAnswer: true,
      retryMode: false
    };

    const encodedModelKey = encodeURIComponent(GROK_MODEL);
    
    console.log(`\n📡 STEP 1/2: Sending analysis request to backend...`);
    console.log(`   Endpoint: POST ${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`);

    // Step 1: Analyze the puzzle
    // Backend handles: prompt building, AI API call, response validation, correctness calculation
    const analysisResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`,
      requestBody,
      {
        timeout: PUZZLE_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!analysisResponse.data.success) {
      throw new Error(analysisResponse.data.message || 'Analysis failed');
    }

    const analysisData = analysisResponse.data.data;
    
    console.log(`✅ Analysis complete!`);
    console.log(`   📊 Confidence: ${analysisData.confidence || 'N/A'}%`);
    console.log(`   🎯 Predicted Output: ${analysisData.predictedOutput ? 'Present' : 'Missing'}`);
    console.log(`   ✓  Single-Test Correct: ${analysisData.isPredictionCorrect !== undefined ? analysisData.isPredictionCorrect : 'N/A'}`);
    console.log(`   ✓  Multi-Test All Correct: ${analysisData.multiTestAllCorrect !== undefined ? analysisData.multiTestAllCorrect : 'N/A'}`);
    console.log(`   📈 Accuracy Score: ${analysisData.predictionAccuracyScore !== undefined ? analysisData.predictionAccuracyScore.toFixed(3) : 'N/A'}`);
    console.log(`   💰 Estimated Cost: $${analysisData.estimatedCost !== undefined ? analysisData.estimatedCost.toFixed(6) : 'N/A'}`);
    console.log(`   🪙 Tokens: ${analysisData.totalTokens || 'N/A'} (in: ${analysisData.inputTokens || 'N/A'}, out: ${analysisData.outputTokens || 'N/A'})`);

    // Step 2: Save to database
    const explanationToSave = {
      [GROK_MODEL]: {
        ...analysisData,
        modelKey: GROK_MODEL
      }
    };

    console.log(`\n💾 STEP 2/2: Saving to database...`);
    console.log(`   Endpoint: POST ${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`);

    const saveResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`,
      { explanations: explanationToSave },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!saveResponse.data.success) {
      throw new Error(`Save request failed: ${saveResponse.statusText}`);
    }

    const savedExplanationId = saveResponse.data.explanationIds?.[0] || null;
    
    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    console.log(`✅ Database save complete!`);
    console.log(`   🆔 Explanation ID: ${savedExplanationId}`);
    console.log(`   ⏱️  Total Time: ${responseTime}s`);
    console.log(`   🏁 Status: SUCCESS`);

    return { puzzleId, success: true, responseTime };

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

    console.log(`\n❌ ANALYSIS FAILED`);
    console.log(`   Error: ${errorMessage}`);
    console.log(`   ⏱️  Time Before Failure: ${responseTime}s`);
    console.log(`   🏁 Status: FAILED`);

    return { puzzleId, success: false, error: errorMessage, responseTime };
  }
}

/**
 * Analyze all puzzles concurrently with staggered starts (rate limiting)
 * Pattern from grok-4-progressive-reasoning.ts - fire all with 2s delays
 */
async function analyzeAllPuzzles(puzzleIds: string[]): Promise<AnalysisResult[]> {
  if (puzzleIds.length === 0) {
    console.log('❌ No puzzle IDs provided. Nothing to analyze.');
    return [];
  }

  console.log(`\n🚀 CONCURRENT ANALYSIS WITH STAGGERED STARTS`);
  console.log('='.repeat(80));
  console.log(`📦 Total Puzzles: ${puzzleIds.length}`);
  console.log(`⏱️  Stagger Delay: ${PUZZLE_STAGGER_MS / 1000}s between starts`);
  console.log(`🔄 Pattern: Fire all concurrently, 2s delay between each start`);
  console.log(`⏳ Estimated Start Window: ${(puzzleIds.length * PUZZLE_STAGGER_MS) / 1000}s`);
  console.log('='.repeat(80));

  // Fire off all puzzles concurrently with staggered starts
  const resultPromises: Promise<AnalysisResult>[] = [];

  for (let i = 0; i < puzzleIds.length; i++) {
    const puzzleId = puzzleIds[i];
    
    // Wrap in delayed promise to stagger starts (rate limiting)
    const delayedPromise = new Promise<AnalysisResult>((resolve) => {
      setTimeout(async () => {
        try {
          const result = await analyzePuzzle(puzzleId, i, puzzleIds.length);
          resolve(result);
        } catch (error) {
          console.error(`💥 Fatal error processing ${puzzleId}:`, error);
          resolve({
            puzzleId,
            success: false,
            error: String(error),
            responseTime: 0
          });
        }
      }, i * PUZZLE_STAGGER_MS);
    });
    
    resultPromises.push(delayedPromise);
  }

  // Wait for all puzzles to complete
  console.log(`\n⚡ All ${puzzleIds.length} puzzles queued. Processing concurrently...\n`);
  const results = await Promise.all(resultPromises);

  // Summary statistics
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`📊 BATCH ANALYSIS COMPLETE`);
  console.log(`${'='.repeat(80)}`);
  console.log(`✅ Successful: ${successful} / ${puzzleIds.length} (${((successful / puzzleIds.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed} / ${puzzleIds.length} (${((failed / puzzleIds.length) * 100).toFixed(1)}%)`);

  if (successful > 0) {
    const successfulResults = results.filter(r => r.success && r.responseTime);
    const totalTime = successfulResults.reduce((sum, r) => sum + r.responseTime!, 0);
    const avgTime = totalTime / successfulResults.length;
    const minTime = Math.min(...successfulResults.map(r => r.responseTime!));
    const maxTime = Math.max(...successfulResults.map(r => r.responseTime!));
    
    console.log(`\n⏱️  TIMING STATISTICS:`);
    console.log(`   Average: ${Math.round(avgTime)}s per puzzle`);
    console.log(`   Min: ${minTime}s`);
    console.log(`   Max: ${maxTime}s`);
    console.log(`   Total: ${Math.round(totalTime / 60)}m ${totalTime % 60}s`);
  }

  return results;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('\n🤖 GROK-4-FAST-NON-REASONING ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`📍 Model: ${GROK_MODEL}`);
    console.log(`📝 Prompt Template: solver`);
    console.log(`🌐 API Base URL: ${API_BASE_URL}`);
    console.log(`⏳ Timeout per Puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`⏱️  Stagger Delay: ${PUZZLE_STAGGER_MS / 1000}s between starts`);
    console.log(`\n📋 VALIDATION FLOW:`);
    console.log(`   1. Analyze → Backend validates response & calculates correctness`);
    console.log(`   2. Save → Persist validated data to PostgreSQL database`);
    console.log(`   3. Correctness uses shared/utils/correctness.ts logic`);
    console.log('='.repeat(80));

    // Get puzzle IDs from command line arguments
    const puzzleIds = getPuzzleIdsFromArgs();

    if (puzzleIds.length === 0) {
      console.log('\n❌ No puzzle IDs provided. Please provide puzzle IDs, dataset, or file.');
      console.log('\n📖 USAGE EXAMPLES:');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts --dataset arc1');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts --dataset arc2');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts 00d62c1b 00d7ad95');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts --file puzzle-ids.txt');
      process.exit(1);
    }

    console.log(`\n📦 PROCESSING ${puzzleIds.length} PUZZLES`);
    console.log(`💾 Results saved to database: explanations table`);
    console.log(`🔄 Execution Pattern: Concurrent with ${PUZZLE_STAGGER_MS / 1000}s stagger`);

    // Process all puzzles concurrently with staggered starts
    const results = await analyzeAllPuzzles(puzzleIds);

    // Show failed puzzles for manual review
    const failedPuzzles = results.filter(r => !r.success);
    if (failedPuzzles.length > 0) {
      console.log(`\n\n❌ FAILED PUZZLES (${failedPuzzles.length}):`);
      console.log('='.repeat(80));
      failedPuzzles.forEach((result, idx) => {
        console.log(`${idx + 1}. ${result.puzzleId}`);
        console.log(`   Error: ${result.error}`);
      });
    }

    console.log(`\n\n✨ ANALYSIS COMPLETE!`);
    console.log(`📊 View results in the database: explanations table`);
    console.log(`🔍 Filter by model_name = '${GROK_MODEL}'`);

  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Analysis interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Analysis terminated');
  process.exit(0);
});

// Run the analysis
main();
