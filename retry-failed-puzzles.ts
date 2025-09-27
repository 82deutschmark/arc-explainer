/**
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-24
 * PURPOSE: Analyze puzzles from a specified directory
 * SRP and DRY check: Pass - This script handles analysis of puzzles from a directory
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// GPT-5 model to use for analysis
const GPT5_MODEL = 'gpt-5-mini-2025-08-07';

// Reasoning effort setting (medium as requested)
const REASONING_EFFORT = 'minimal';

// Timeout per puzzle in milliseconds (30 minutes for complex puzzles)
const PUZZLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Default directory to read puzzles from (relative to project root)
const DEFAULT_PUZZLE_DIR = path.join('data', 'evaluation2');

/**
 * Get all puzzle IDs from JSON files in the specified directory
 */
function getPuzzleIdsFromDirectory(directory: string): string[] {
  try {
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      console.warn(`⚠️  Directory not found: ${directory}. Using current working directory.`);
      directory = process.cwd();
    }

    // Read all JSON files in the directory
    const files = fs.readdirSync(directory)
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));

    if (files.length === 0) {
      console.warn(`⚠️  No JSON files found in directory: ${directory}`);
      return [];
    }

    console.log(`📂 Found ${files.length} puzzle files in ${directory}`);
    return files;
  } catch (error) {
    console.error(`❌ Error reading puzzle files from ${directory}:`, error);
    return [];
  }
}

// Get puzzle directory from command line arguments or use default
const puzzleDirArg = process.argv[2];
const puzzleDir = puzzleDirArg 
  ? path.join('data', puzzleDirArg)
  : DEFAULT_PUZZLE_DIR;

// Get all puzzle IDs from the specified directory
const PUZZLES_TO_RETRY = getPuzzleIdsFromDirectory(puzzleDir);

if (PUZZLES_TO_RETRY.length === 0) {
  console.error('❌ No puzzle files found. Exiting.');
  process.exit(1);
}

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
 * Analyze a single puzzle with GPT-5
 */
async function analyzePuzzle(puzzleId: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Retrying analysis of ${puzzleId}...`);

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
 * Retry all failed puzzles concurrently
 */
async function retryFailedPuzzles(): Promise<AnalysisResult[]> {
  console.log(`\n🔄 Retrying ${PUZZLES_TO_RETRY.length} failed puzzles...`);
  console.log('='.repeat(80));

  const results: AnalysisResult[] = [];
  const analysisPromises: Promise<AnalysisResult>[] = [];

  // Trigger all retry analyses concurrently
  for (const puzzleId of PUZZLES_TO_RETRY) {
    const analysisPromise = analyzePuzzle(puzzleId);
    analysisPromises.push(analysisPromise);
  }

  console.log(`\n✅ All ${PUZZLES_TO_RETRY.length} retry analyses triggered! Waiting for completion...\n`);

  // Wait for all analyses to complete
  const allResults = await Promise.all(analysisPromises);

  // Count successes and failures
  const successful = allResults.filter(r => r.success).length;
  const failed = allResults.filter(r => !r.success).length;

  console.log(`📊 RETRY ANALYSIS COMPLETE:`);
  console.log(`   Total puzzles: ${PUZZLES_TO_RETRY.length}`);
  console.log(`   Successful: ${successful} (${((successful / PUZZLES_TO_RETRY.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed} (${((failed / PUZZLES_TO_RETRY.length) * 100).toFixed(1)}%)`);

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
    console.log('🔄 PUZZLE ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GPT5_MODEL}`);
    console.log(`Reasoning Effort: ${REASONING_EFFORT}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Puzzle directory: ${puzzleDir}`);
    console.log(`Puzzles to analyze: ${PUZZLES_TO_RETRY.length}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('🔄 Same process as client UI - analyze + save in one call');
    console.log('='.repeat(80));

    // Retry all failed puzzles concurrently
    const results = await retryFailedPuzzles();

    // Overall summary
    console.log('\n🎉 ANALYSIS SUMMARY:');
    console.log('='.repeat(80));

    const totalPuzzles = results.length;
    const successfulAnalyses = results.filter(r => r.success).length;
    const failedAnalyses = results.filter(r => !r.success).length;

    console.log(`Puzzle directory: ${puzzleDir}`);
    console.log(`Total puzzles analyzed: ${totalPuzzles}`);
    console.log(`Successful analyses: ${successfulAnalyses} (${((successfulAnalyses / totalPuzzles) * 100).toFixed(1)}%)`);
    console.log(`Failed analyses: ${failedAnalyses} (${((failedAnalyses / totalPuzzles) * 100).toFixed(1)}%)`);

    if (successfulAnalyses > 0) {
      const avgTime = results
        .filter(r => r.success && r.responseTime)
        .reduce((sum, r) => sum + (r.responseTime || 0), 0) / successfulAnalyses;
      console.log(`Average response time: ${Math.round(avgTime)}s`);
    }
    
    // Print failed puzzle IDs for reference
    if (failedAnalyses > 0) {
      const failedPuzzles = results
        .filter(r => !r.success)
        .map(r => r.puzzleId);
      console.log('\n❌ Failed puzzle IDs:', failedPuzzles.join(', '));
    }
    
    // Show failed puzzles for manual review
    const failedPuzzles = results.filter(r => !r.success);
    if (failedPuzzles.length > 0) {
      console.log('\n🔍 Failed puzzle details:');
      failedPuzzles.forEach(result => {
        console.log(`   • ${result.puzzleId}: ${result.error}`);
      });
    }

    console.log('\n✨ Retry complete! Ready to run puzzle analysis script.');

  } catch (error) {
    console.error('💥 Fatal error during retry:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
// Handle command line usage
function showUsage() {
  console.log('\nUsage:');
  console.log('  npm run retry [directory]');
  console.log('\nExamples:');
  console.log('  npm run retry evaluation2    # Analyze puzzles from data/evaluation2');
  console.log('  npm run retry training       # Analyze puzzles from data/training');
  console.log('  npm run retry                # Use default directory (evaluation2)');
}

// Show usage if help is requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showUsage();
  process.exit(0);
}

process.on('SIGINT', () => {
  console.log('\n⚠️  Analysis interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Retry terminated');
  process.exit(0);
});

// Run the retry
main();
