/**
 * Author: Cascade
 * Date: 2025-09-28
 * PURPOSE: Analyze specific puzzles by ID using GPT-5 model via external API endpoints
 * SRP and DRY check: Pass - This script handles API requests for puzzle analysis with proper error handling and progress tracking
 * 
 * USAGE:
 * 1. Directly pass puzzle IDs as command line arguments:
 *    ts-node analyze-puzzles-by-id.ts 00d62c1b 00d7ad95 00da1a24
 * 
 * 2. Or pass a text file containing one puzzle ID per line:
 *    ts-node analyze-puzzles-by-id.ts --file puzzle-ids.txt
 * 
 * The script will analyze each puzzle and save the results to the database.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// GPT-5 model to use for analysis
const GPT5_MODEL = 'gpt-5-nano-2025-08-07';

// Reasoning effort setting
const REASONING_EFFORT = 'high';

// Timeout per puzzle in milliseconds (30 minutes for complex puzzles)
const PUZZLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

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
 * Parse command line arguments to get puzzle IDs
 */
function getPuzzleIdsFromArgs(): string[] {
  const args = process.argv.slice(2);
  
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
 * Analyze a single puzzle with GPT-5
 */
async function analyzePuzzle(puzzleId: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting analysis of ${puzzleId}...`);

    // Prepare analysis request (mirroring client UI behavior)
    const requestBody: AnalysisRequest = {
      temperature: 0.2, // Default temperature
      promptId: 'solver', // Default prompt
      reasoningEffort: REASONING_EFFORT,
      reasoningVerbosity: 'high', // High verbosity for detailed reasoning
      reasoningSummaryType: 'auto', // Detailed summary
      systemPromptMode: 'ARC', // Use ARC system prompt mode
      omitAnswer: true, // Researcher option to hide correct answer
      retryMode: false // Not in retry mode
    };

    // URL-encode model key (GPT-5 model)
    const encodedModelKey = encodeURIComponent(GPT5_MODEL);

    // Step 1: Analyze the puzzle (analysis only, no save)
    const analysisResponse = await axios.post(
      `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`,
      requestBody,
      {
        timeout: PUZZLE_TIMEOUT_MS, // 30 minutes for complex puzzles
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!analysisResponse.data.success) {
      throw new Error(analysisResponse.data.message || 'Analysis failed');
    }

    const analysisData = analysisResponse.data.data;

    // Step 2: Save to database (follows same pattern as frontend and other scripts)
    const explanationToSave = {
      [GPT5_MODEL]: {
        ...analysisData,
        modelKey: GPT5_MODEL
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

    console.log(`✅ Successfully analyzed and saved ${puzzleId} in ${responseTime}s`);
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

    console.log(`❌ Failed to analyze ${puzzleId} in ${responseTime}s: ${errorMessage}`);
    return { puzzleId, success: false, error: errorMessage, responseTime };
  }
}

/**
 * Analyze all puzzles concurrently with small delays between triggers
 */
async function analyzeAllPuzzlesConcurrently(puzzleIds: string[]): Promise<AnalysisResult[]> {
  if (puzzleIds.length === 0) {
    console.log('No puzzle IDs provided. Nothing to analyze.');
    return [];
  }

  console.log(`\n🚀 Triggering ${puzzleIds.length} concurrent analyses...`);
  console.log('='.repeat(80));

  const results: AnalysisResult[] = [];
  const analysisPromises: Promise<AnalysisResult>[] = [];

  // Trigger all analyses concurrently with small delays
  for (let i = 0; i < puzzleIds.length; i++) {
    const puzzleId = puzzleIds[i];

    // Trigger analysis immediately
    const analysisPromise = analyzePuzzle(puzzleId);
    analysisPromises.push(analysisPromise);

    // Small delay between triggers (2 seconds)
    if (i < puzzleIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }
  }

  console.log(`\n✅ All ${puzzleIds.length} analyses triggered! Waiting for completion...\n`);

  // Wait for all analyses to complete
  const allResults = await Promise.all(analysisPromises);

  // Count successes and failures
  const successful = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;

  console.log(`📊 CONCURRENT ANALYSIS COMPLETE:`);
  console.log(`   Total puzzles: ${puzzleIds.length}`);
  console.log(`   Successful: ${successful} (${((successful / puzzleIds.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed} (${((failed / puzzleIds.length) * 100).toFixed(1)}%)`);

  if (successful > 0) {
    const avgTime = allResults
      .filter(r => r.success && r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful;
    console.log(`   Average response time: ${Math.round(avgTime)}s`);
  }

  return allResults;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🤖 PUZZLE ANALYSIS BY ID SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GPT5_MODEL}`);
    console.log(`Reasoning Effort: ${REASONING_EFFORT}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    
    // Get puzzle IDs from command line arguments
    const puzzleIds = getPuzzleIdsFromArgs();
    
    if (puzzleIds.length === 0) {
      console.log('\n❌ No puzzle IDs provided. Please provide puzzle IDs as arguments or use --file option.');
      console.log('\nUsage examples:');
      console.log('  ts-node analyze-puzzles-by-id.ts 00d62c1b 00d7ad95 00da1a24');
      console.log('  ts-node analyze-puzzles-by-id.ts --file puzzle-ids.txt');
      process.exit(1);
    }
    
    console.log(`Puzzles to analyze: ${puzzleIds.length}`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('⚡ Triggering fresh analysis for all specified puzzles');
    console.log('🚀 All analyses run concurrently with 2-second delays between triggers');
    console.log('='.repeat(80));

    // Process all puzzles concurrently
    const results = await analyzeAllPuzzlesConcurrently(puzzleIds);

    // Overall summary
    console.log('\n🎉 FINAL OVERALL SUMMARY:');
    console.log('='.repeat(80));

    const totalPuzzles = results.length;
    const successfulAnalyses = results.filter(r => r.success).length;
    const failedAnalyses = results.filter(r => !r.success).length;

    console.log(`Total puzzles processed: ${totalPuzzles}`);
    console.log(`Successful analyses: ${successfulAnalyses} (${((successfulAnalyses / totalPuzzles) * 100).toFixed(1)}%)`);
    console.log(`Failed analyses: ${failedAnalyses} (${((failedAnalyses / totalPuzzles) * 100).toFixed(1)}%)`);

    if (successfulAnalyses > 0) {
      const avgTime = results
        .filter(r => r.success && r.responseTime)
        .reduce((sum, r) => sum + (r.responseTime || 0), 0) / successfulAnalyses;
      console.log(`Average analysis time: ${Math.round(avgTime)}s per puzzle`);
    }

    // Show failed puzzles for manual review
    const failedPuzzles = results.filter(r => !r.success);
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
