/**
 *
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-23
 * PURPOSE: Trigger analysis of unsolved and untested puzzles using GPT-5 model via external API endpoints
 * SRP and DRY check: Pass - This script handles API requests for puzzle analysis with proper error handling and progress tracking
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// GPT-5 model to use for analysis
const GPT5_MODEL = 'gpt-5-mini-2025-08-07';

// Reasoning effort setting (medium as requested)
const REASONING_EFFORT = 'medium';

// Timeout per puzzle in milliseconds (30 minutes for complex puzzles)
const PUZZLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * List of puzzles that need analysis
 */
const PUZZLES_TO_ANALYZE = {
  // TESTED BUT NOT SOLVED (17 puzzles)
  testedButNotSolved: [
    '05a7bcf2', 'f5c89df1', '2037f2c7', '0934a4d8', '09c534e7',
    '0a2355a6', '22a4bbc2', '0e671a1a', 'b7f8a4d8', 'fea12743',
    '14754a24', '15113be4', '16b78196', '18419cfa', 'cfb2ce5a',
    '184a9768', 'a8610ef7'
  ],

  // NOT TESTED (63 puzzles)
  notTested: [
    '1e97544e', '477d2879', '85fa5666', 'ac0c5833', 'd94c3b52',
    '47996f11', '8719f442', 'af22c60d', 'da515329', 'f8be4b64',
    '20981f0e', '4aab4007', '891232d6', 'dc2aa30b', 'f9a67cb5',
    '212895b5', '4e45f183', '896d5239', 'b20f7c8b', 'de493100',
    'f9d67f8b', '50f325b5', '93c31fbe', 'b457fec5', 'e1d2900e',
    'fd096ab6', '2546ccf6', '54db823b', '94133066', 'e2092e0c',
    'fd4b2b02', '2c0b0aff', '551d5bf1', '96a8c0cd', 'b942fd60',
    'e619ca6e', '3391f8c0', '67b4a34d', '981571dc', 'b9630600',
    'e681b708', '3490cc26', '79369cc6', '992798f6', 'bd14c3bf',
    'e78887d1', '37d3e8b2', '79fb03f4', '9b2a60aa', 'c6e1b8da',
    'ecaa0ec1', '3ed85e70', '7c9b52a0', '9caba7c3', 'f21745ec',
    '40f6cd08', '7d419a02', 'a096bf4d', 'f3b10344', '456873bc',
    '85b81ff1', 'd931c21c', 'f4081712'
  ]
};

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  reasoningEffort: string;
  reasoningVerbosity: string;
  reasoningSummaryType: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
}

interface AnalysisResult {
  puzzleId: string;
  success: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * Check if a puzzle already has explanations in the database
 */
async function hasExistingExplanation(puzzleId: string): Promise<boolean> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/puzzle/${puzzleId}/has-explanation`);
    return response.data.data || false;
  } catch (error) {
    console.log(`⚠️  Could not check existing explanation for ${puzzleId}: ${error}`);
    return false; // Assume no explanation to be safe
  }
}

/**
 * Analyze a single puzzle with GPT-5
 */
async function analyzePuzzle(puzzleId: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    // Check if puzzle already has explanation
    const hasExplanation = await hasExistingExplanation(puzzleId);
    if (hasExplanation) {
      console.log(`⏭️  Skipping ${puzzleId} - already has explanation`);
      return { puzzleId, success: false, error: 'Already has explanation' };
    }

    console.log(`🚀 Starting analysis of ${puzzleId}...`);

    // Prepare analysis request (mirroring client UI behavior)
    const requestBody: AnalysisRequest = {
      temperature: 0.2, // Default temperature
      promptId: 'custom', // Default prompt
      reasoningEffort: REASONING_EFFORT,
      reasoningVerbosity: 'high', // High verbosity for detailed reasoning
      reasoningSummaryType: 'detailed', // Detailed summary
      systemPromptMode: 'ARC', // Use ARC system prompt mode
      omitAnswer: true, // Researcher option to hide correct answer
      retryMode: false // Not in retry mode
    };

    // URL-encode model key (GPT-5 model)
    const encodedModelKey = encodeURIComponent(GPT5_MODEL);

    // Make the analysis request
    const response = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`,
      requestBody,
      {
        timeout: PUZZLE_TIMEOUT_MS, // 30 minutes for complex puzzles
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (response.data.success) {
      const endTime = Date.now();
      const responseTime = Math.round((endTime - startTime) / 1000);

      console.log(`✅ Successfully analyzed ${puzzleId} in ${responseTime}s`);
      return { puzzleId, success: true, responseTime };
    } else {
      throw new Error(response.data.message || 'Analysis failed');
    }

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

    console.log(`❌ Failed to analyze ${puzzleId} in ${responseTime}s: ${errorMessage}`);
    return { puzzleId, success: false, error: errorMessage, responseTime };
  }
}

/**
 * Analyze all puzzles in a category
 */
async function analyzePuzzleCategory(puzzleIds: string[], categoryName: string): Promise<AnalysisResult[]> {
  console.log(`\n🎯 Starting analysis of ${categoryName} (${puzzleIds.length} puzzles)...`);
  console.log('='.repeat(80));

  const results: AnalysisResult[] = [];
  let completed = 0;
  let successful = 0;
  let failed = 0;

  for (const puzzleId of puzzleIds) {
    const result = await analyzePuzzle(puzzleId);
    results.push(result);

    completed++;
    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Progress update
    const progress = ((completed / puzzleIds.length) * 100).toFixed(1);
    console.log(`📊 Progress: ${completed}/${puzzleIds.length} (${progress}%) | ✅ ${successful} | ❌ ${failed}`);

    // Small delay between requests to avoid overwhelming the server
    if (completed < puzzleIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  // Summary for this category
  console.log(`\n📈 ${categoryName} Summary:`);
  console.log(`   Total puzzles: ${puzzleIds.length}`);
  console.log(`   Successful: ${successful} (${((successful / puzzleIds.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed} (${((failed / puzzleIds.length) * 100).toFixed(1)}%)`);

  if (successful > 0) {
    const avgTime = results
      .filter(r => r.success && r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful;
    console.log(`   Average response time: ${Math.round(avgTime)}s`);
  }

  return results;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🤖 GPT-5 MINI PUZZLE ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GPT5_MODEL}`);
    console.log(`Reasoning Effort: ${REASONING_EFFORT}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`Total Puzzles: ${PUZZLES_TO_ANALYZE.testedButNotSolved.length + PUZZLES_TO_ANALYZE.notTested.length}`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('🔄 Same process as client UI - analyze + save in one call');
    console.log('='.repeat(80));

    const allResults: AnalysisResult[] = [];

    // Analyze tested but not solved puzzles first
    if (PUZZLES_TO_ANALYZE.testedButNotSolved.length > 0) {
      const results = await analyzePuzzleCategory(
        PUZZLES_TO_ANALYZE.testedButNotSolved,
        'TESTED BUT NOT SOLVED'
      );
      allResults.push(...results);
    }

    // Analyze not tested puzzles
    if (PUZZLES_TO_ANALYZE.notTested.length > 0) {
      const results = await analyzePuzzleCategory(
        PUZZLES_TO_ANALYZE.notTested,
        'NOT TESTED'
      );
      allResults.push(...results);
    }

    // Overall summary
    console.log('\n🎉 FINAL OVERALL SUMMARY:');
    console.log('='.repeat(80));

    const totalPuzzles = allResults.length;
    const successfulAnalyses = allResults.filter(r => r.success).length;
    const failedAnalyses = allResults.filter(r => !r.success).length;

    console.log(`Total puzzles processed: ${totalPuzzles}`);
    console.log(`Successful analyses: ${successfulAnalyses} (${((successfulAnalyses / totalPuzzles) * 100).toFixed(1)}%)`);
    console.log(`Failed analyses: ${failedAnalyses} (${((failedAnalyses / totalPuzzles) * 100).toFixed(1)}%)`);

    if (successfulAnalyses > 0) {
      const avgTime = allResults
        .filter(r => r.success && r.responseTime)
        .reduce((sum, r) => sum + (r.responseTime || 0), 0) / successfulAnalyses;
      console.log(`Average analysis time: ${Math.round(avgTime)}s per puzzle`);
    }

    // Show failed puzzles for manual review
    const failedPuzzles = allResults.filter(r => !r.success);
    if (failedPuzzles.length > 0) {
      console.log('\n❌ Failed Puzzles (require manual review):');
      failedPuzzles.forEach(result => {
        console.log(`   • ${result.puzzleId}: ${result.error}`);
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
