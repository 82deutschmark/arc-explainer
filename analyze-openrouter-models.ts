/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-11-09
 * PURPOSE: Analyze specific puzzles using multiple Open Router models (nvidia/nemotron-nano-12b-v2-vl:free,
 * openrouter/polaris-alpha, minimax/minimax-m2:free). For each puzzle, sends it to all three models sequentially
 * with no delays. Uses the API endpoints following the same pattern as other analyze-puzzle scripts.
 * SRP/DRY check: Pass - Follows established patterns from analyze-puzzles-by-id.ts and analyze-unsolved-puzzles.ts
 *
 * USAGE:
 *   node --import tsx analyze-openrouter-models.ts
 *
 * The script will analyze each puzzle with all three models and save results to the database.
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Open Router models to test
const MODELS = [
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'openrouter/polaris-alpha',
  'minimax/minimax-m2:free'
];

// Puzzle IDs to analyze
const PUZZLE_IDS = [
  '025d127b',
  '0a938d79',
  '0ca9ddb6',
  '0d3d703e',
  '0dfd9992',
  '0e206a2e',
  '1c786137',
  '1f876c06',
  '28e73c20',
  '272f95fa',
  '2bcee788',
  '2dd70a9a',
  '3bd67248',
  '41e4d17e',
  '42a50994',
  '5ad4f10b',
  '6d75e8bb',
  '7b6016b9'
];

// Timeout per puzzle in milliseconds (10 minutes for vision models)
const PUZZLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  reasoningEffort?: string;
  reasoningVerbosity?: string;
  reasoningSummaryType?: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
}

interface AnalysisResult {
  puzzleId: string;
  modelKey: string;
  success: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * Analyze a single puzzle with a specific model
 */
async function analyzePuzzle(puzzleId: string, modelKey: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting analysis of ${puzzleId} with ${modelKey}...`);

    // Prepare analysis request
    const requestBody: AnalysisRequest = {
      temperature: 0.2, // Default temperature
      promptId: 'solver', // Default prompt
      systemPromptMode: 'ARC', // Use ARC system prompt mode
      omitAnswer: true, // Researcher option to hide correct answer
      retryMode: false // Not in retry mode
    };

    // URL-encode model key
    const encodedModelKey = encodeURIComponent(modelKey);

    // Step 1: Analyze the puzzle
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

    // Step 2: Save to database
    const explanationToSave = {
      [modelKey]: {
        ...analysisData,
        modelKey: modelKey
      }
    };

    const saveResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`,
      { explanations: explanationToSave },
      {
        timeout: 30000, // 30 seconds for save operation
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!saveResponse.data.success) {
      throw new Error(`Save request failed: ${saveResponse.statusText}`);
    }

    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    console.log(`✅ Successfully analyzed and saved ${puzzleId} with ${modelKey} in ${responseTime}s`);
    return { puzzleId, modelKey, success: true, responseTime };

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

    console.log(`❌ Failed to analyze ${puzzleId} with ${modelKey} in ${responseTime}s: ${errorMessage}`);
    return { puzzleId, modelKey, success: false, error: errorMessage, responseTime };
  }
}

/**
 * Analyze a single puzzle with all models
 */
async function analyzePuzzleWithAllModels(puzzleId: string, models: string[]): Promise<AnalysisResult[]> {
  console.log(`\n📊 Processing puzzle: ${puzzleId}`);
  console.log('='.repeat(80));

  const results: AnalysisResult[] = [];

  for (const modelKey of models) {
    const result = await analyzePuzzle(puzzleId, modelKey);
    results.push(result);
  }

  return results;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🤖 OPEN ROUTER MODELS ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`Models to test: ${MODELS.length}`);
    MODELS.forEach((model, i) => console.log(`  ${i + 1}. ${model}`));
    console.log(`\nPuzzles to analyze: ${PUZZLE_IDS.length}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('⚡ Each puzzle sent to all 3 models sequentially');
    console.log('🔄 Processing: Puzzle 1→all models (1s delay) → Puzzle 2→all models, etc.');
    console.log('='.repeat(80));

    const allResults: AnalysisResult[] = [];

    // Process each puzzle with all models
    for (let i = 0; i < PUZZLE_IDS.length; i++) {
      const puzzleId = PUZZLE_IDS[i];

      console.log(`\n🔧 PUZZLE ${i + 1}/${PUZZLE_IDS.length}: ${puzzleId}`);
      const puzzleResults = await analyzePuzzleWithAllModels(puzzleId, MODELS);
      allResults.push(...puzzleResults);

      // 1 second delay before next puzzle
      if (i < PUZZLE_IDS.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Overall summary
    console.log('\n🎉 FINAL OVERALL SUMMARY:');
    console.log('='.repeat(80));

    const totalTests = allResults.length;
    const successfulTests = allResults.filter(r => r.success).length;
    const failedTests = allResults.filter(r => !r.success).length;

    console.log(`Total analyses: ${totalTests} (${MODELS.length} models × ${PUZZLE_IDS.length} puzzles)`);
    console.log(`Successful: ${successfulTests} (${((successfulTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);

    // Per-model breakdown
    console.log('\n📊 Per-Model Results:');
    MODELS.forEach(modelKey => {
      const modelResults = allResults.filter(r => r.modelKey === modelKey);
      const modelSuccess = modelResults.filter(r => r.success).length;
      const modelTotal = modelResults.length;
      console.log(`   ${modelKey}: ${modelSuccess}/${modelTotal} (${((modelSuccess / modelTotal) * 100).toFixed(1)}%)`);
    });

    // Show failed analyses for manual review
    const failedAnalyses = allResults.filter(r => !r.success);
    if (failedAnalyses.length > 0) {
      console.log('\n❌ Failed Analyses (require manual review):');
      failedAnalyses.forEach(result => {
        console.log(`   • ${result.puzzleId} [${result.modelKey}]: ${result.error}`);
      });
    }

    console.log('\n✨ Analysis complete! Check the database for new explanations.');

  } catch (error) {
    console.error('💥 Fatal error during analysis:', error);
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
