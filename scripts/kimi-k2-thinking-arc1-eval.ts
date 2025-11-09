/**
 * Author: Claude Code using Haiku
 * Date: 2025-11-09
 * PURPOSE: Test MoonshotAI Kimi K2 Thinking model against all ARC-1 Evaluation set puzzles.
 *          Fetches puzzle list from API, runs analysis for each puzzle, saves results to database.
 * SRP and DRY check: Pass - Orchestrates puzzle analysis via API without duplicating logic elsewhere.
 *
 * USAGE:
 * node --import tsx scripts/kimi-k2-thinking-arc1-eval.ts
 *
 * This script:
 * - Fetches all ARC1-Eval puzzle IDs from /api/puzzle/list
 * - Tests each puzzle with moonshotai/kimi-k2-thinking
 * - Saves analysis results to the database
 * - Provides progress tracking and summary statistics
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const MODEL_KEY = 'moonshotai/kimi-k2-thinking';
const SOURCE = 'ARC1-Eval';

// Timeouts (Kimi is slower - estimate 2-4 minutes per puzzle)
const PUZZLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes per puzzle (accounting for slowness)
const SAVE_TIMEOUT_MS = 30 * 1000; // 30 seconds for saving
const PUZZLE_STAGGER_MS = 5000; // 5 seconds between starting puzzles (rate limiting)

// Analysis request configuration
interface AnalysisRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
}

interface PuzzleListRecord {
  id: string;
}

interface PuzzleResult {
  puzzleId: string;
  success: boolean;
  responseTime?: number;
  error?: string;
  isPredictionCorrect?: boolean;
  confidence?: number;
  explanationId?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch all puzzle IDs from ARC1-Eval dataset
 */
async function fetchArc1EvalPuzzleIds(): Promise<string[]> {
  try {
    console.log(`\n🔄 Fetching puzzle list for ${SOURCE}...`);
    const response = await axios.get(`${API_BASE_URL}/api/puzzle/list`, {
      params: { source: SOURCE },
      timeout: 60000
    });

    if (!response.data?.success) {
      throw new Error(`Unable to load puzzle list for ${SOURCE}`);
    }

    const items: PuzzleListRecord[] = response.data.data || [];
    const puzzleIds = items.map(item => item.id);
    console.log(`✅ Fetched ${puzzleIds.length} puzzles from ${SOURCE}`);
    return puzzleIds;
  } catch (error: any) {
    console.error('❌ Failed to fetch puzzle list:', error.message);
    throw error;
  }
}

/**
 * Analyze and save a single puzzle
 */
async function analyzePuzzle(puzzleId: string): Promise<PuzzleResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🧩 Analyzing puzzle: ${puzzleId}`);

    // Step 1: Analyze the puzzle using Kimi K2 Thinking
    const requestBody: AnalysisRequest = {
      temperature: 0.2, // Low temperature for deterministic puzzle solving
      promptId: 'solver', // Use solver template for consistency
      systemPromptMode: 'ARC', // ARC-specific system prompt
      omitAnswer: true, // Don't include answer in response
      retryMode: false // Not in retry mode
    };

    const encodedModel = encodeURIComponent(MODEL_KEY);
    const analysisResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModel}`,
      requestBody,
      {
        timeout: PUZZLE_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!analysisResponse.data.success) {
      throw new Error(analysisResponse.data.message || 'Analysis call failed');
    }

    const analysisData = analysisResponse.data.data;
    const isPredictionCorrect = analysisData.isPredictionCorrect || analysisData.multiTestAllCorrect;
    const confidence = analysisData.confidence || 0;

    // Step 2: Save to database
    const explanationToSave = {
      [MODEL_KEY]: {
        ...analysisData,
        modelKey: MODEL_KEY
      }
    };

    const saveResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/save-explained/${puzzleId}`,
      { explanations: explanationToSave },
      {
        timeout: SAVE_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (!saveResponse.data.success) {
      throw new Error(`Save failed: ${saveResponse.statusText}`);
    }

    const explanationId = saveResponse.data.explanationIds?.[0] || null;
    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    console.log(`   ✅ Complete in ${responseTime}s`);
    console.log(`      Correct: ${isPredictionCorrect ? '✓' : '✗'}, Confidence: ${confidence}%`);
    console.log(`      Explanation ID: ${explanationId}`);

    return {
      puzzleId,
      success: true,
      responseTime,
      isPredictionCorrect,
      confidence,
      explanationId
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

    console.log(`   ❌ Failed in ${responseTime}s: ${errorMessage}`);

    return {
      puzzleId,
      success: false,
      responseTime,
      error: errorMessage
    };
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        KIMI K2 THINKING - ARC1 EVALUATION SET TEST                            ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');
    console.log(`Model: ${MODEL_KEY}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Dataset: ${SOURCE}`);
    console.log(`Puzzle Timeout: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`Rate Limiting: ${PUZZLE_STAGGER_MS / 1000}s between puzzle starts`);

    // Fetch all ARC1-Eval puzzles
    const puzzleIds = await fetchArc1EvalPuzzleIds();

    if (puzzleIds.length === 0) {
      console.log('❌ No puzzles found in ARC1-Eval dataset');
      process.exit(1);
    }

    console.log(`\n📊 Starting analysis of ${puzzleIds.length} puzzles...`);
    console.log(`⚡ All puzzles queued with ${PUZZLE_STAGGER_MS / 1000}s stagger. Processing concurrently...\n`);

    // Fire off all puzzles with staggered starts
    const resultPromises: Promise<PuzzleResult>[] = [];

    for (let i = 0; i < puzzleIds.length; i++) {
      const puzzleId = puzzleIds[i];

      // Wrap in delayed promise to stagger starts
      const delayedPromise = new Promise<PuzzleResult>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await analyzePuzzle(puzzleId);
            resolve(result);
          } catch (error) {
            console.error(`Fatal error processing ${puzzleId}:`, error);
            resolve({
              puzzleId,
              success: false,
              error: 'Fatal error'
            });
          }
        }, i * PUZZLE_STAGGER_MS);
      });

      resultPromises.push(delayedPromise);
    }

    // Wait for all puzzles to complete
    const allResults = await Promise.all(resultPromises);

    // Final summary
    console.log('\n\n╔════════════════════════════════════════════════════════════════════════════════╗');
    console.log('║        FINAL SUMMARY                                                           ║');
    console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

    const successfulResults = allResults.filter(r => r.success);
    const failedResults = allResults.filter(r => !r.success);
    const correctResults = successfulResults.filter(r => r.isPredictionCorrect);
    const incorrectResults = successfulResults.filter(r => !r.isPredictionCorrect);

    console.log(`\n📈 RESULTS:`);
    console.log(`   Total Puzzles: ${allResults.length}`);
    console.log(`   Successful: ${successfulResults.length} (${((successfulResults.length / allResults.length) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${failedResults.length} (${((failedResults.length / allResults.length) * 100).toFixed(1)}%)`);

    if (successfulResults.length > 0) {
      console.log(`\n✅ CORRECT PREDICTIONS: ${correctResults.length} / ${successfulResults.length}`);
      console.log(`   Success Rate: ${((correctResults.length / successfulResults.length) * 100).toFixed(1)}%`);
      console.log(`\n❌ INCORRECT PREDICTIONS: ${incorrectResults.length} / ${successfulResults.length}`);

      // Average confidence
      const avgConfidence = correctResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / correctResults.length;
      console.log(`\n📊 STATISTICS:`);
      console.log(`   Average Confidence (correct): ${avgConfidence.toFixed(1)}%`);

      if (incorrectResults.length > 0) {
        const avgIncorrectConfidence = incorrectResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / incorrectResults.length;
        console.log(`   Average Confidence (incorrect): ${avgIncorrectConfidence.toFixed(1)}%`);
      }
    }

    // Timing analysis
    const totalTime = successfulResults.reduce((sum, r) => sum + (r.responseTime || 0), 0);
    const avgTime = successfulResults.length > 0 ? totalTime / successfulResults.length : 0;
    const maxTime = Math.max(...successfulResults.map(r => r.responseTime || 0), 0);
    const minTime = Math.min(...successfulResults.map(r => r.responseTime || 0).filter(t => t > 0), Infinity);

    console.log(`\n⏱️  TIMING:`);
    console.log(`   Total Time: ${Math.round(totalTime)}s (${(totalTime / 60).toFixed(1)}m)`);
    console.log(`   Average Time per Puzzle: ${Math.round(avgTime)}s`);
    if (minTime !== Infinity) {
      console.log(`   Min Time: ${minTime}s`);
    }
    console.log(`   Max Time: ${maxTime}s`);

    if (failedResults.length > 0) {
      console.log(`\n⚠️  FAILED PUZZLES (${failedResults.length}):`);
      const errorCounts: Record<string, number> = {};
      for (const result of failedResults) {
        const error = result.error || 'Unknown error';
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      }

      for (const [error, count] of Object.entries(errorCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${error}: ${count} puzzle(s)`);
      }
    }

    console.log('\n✨ Analysis complete!');
    console.log(`   Results saved to database for model: ${MODEL_KEY}`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
