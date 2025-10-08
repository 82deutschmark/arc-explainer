/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Analyze ARC Eval puzzles using Grok-4-Fast-Non-Reasoning model via external API endpoints.
 *          This script is adapted from grok-4-fast-reasoning.ts but specifically for Grok-4-Fast-Non-Reasoning.
 *          Key differences from reasoning variant: Uses non-reasoning model for faster response times.
 *
 * SRP and DRY check: Pass - This script handles API requests for puzzle analysis with proper error handling and progress tracking
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

// Timeout per puzzle in milliseconds (8 minutes for Grok-4-fast-non-reasoning - faster than reasoning variant)
// Based on model config: responseTime: { speed: 'moderate', estimate: '1-2 min' }
const PUZZLE_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutes (slightly less than reasoning variant)

// Delay between triggering concurrent analyses
const TRIGGER_DELAY_MS = 2000; // 2 seconds

// NEW: Concurrency cap (align with xAI provider limits). Override via env XAI_MAX_CONCURRENCY.
const MAX_CONCURRENCY = Math.max(1, Number(process.env.XAI_MAX_CONCURRENCY || 2));

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
  // NOTE: NO reasoning parameters - this is the non-reasoning variant
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
 */
async function analyzePuzzle(puzzleId: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting analysis of ${puzzleId}...`);

    // Prepare analysis request (mirroring client UI behavior)
    // IMPORTANT: NO reasoning parameters for non-reasoning model
    const requestBody: AnalysisRequest = {
      temperature: 0.2, // Default temperature (Grok-4-fast-non-reasoning supports temperature)
      promptId: 'solver', // Use solver prompt as specified
      systemPromptMode: 'ARC', // Use ARC system prompt mode
      omitAnswer: true, // Researcher option to hide correct answer
      retryMode: false // Not in retry mode
    };

    // URL-encode model key (Grok-4-Fast-Non-Reasoning model)
    const encodedModelKey = encodeURIComponent(GROK_MODEL);

    // Step 1: Analyze the puzzle (analysis only, no save)
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

    // Step 2: Save to database (follows same pattern as frontend and other scripts)
    const explanationToSave = {
      [GROK_MODEL]: {
        ...analysisData,
        modelKey: GROK_MODEL
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
 * Analyze all puzzles using a small worker pool (concurrency-limited)
 */
async function analyzeAllPuzzlesConcurrently(puzzleIds: string[]): Promise<AnalysisResult[]> {
  if (puzzleIds.length === 0) {
    console.log('No puzzle IDs provided. Nothing to analyze.');
    return [];
  }

  console.log(`\n🚀 Queueing ${puzzleIds.length} analyses with concurrency = ${MAX_CONCURRENCY}...`);
  console.log('='.repeat(80));

  const results: AnalysisResult[] = new Array(puzzleIds.length);
  let index = 0;

  async function worker(workerId: number) {
    while (true) {
      const current = index++;
      if (current >= puzzleIds.length) break;
      const puzzleId = puzzleIds[current];
      try {
        const res = await analyzePuzzle(puzzleId);
        results[current] = res;
      } catch (e: any) {
        results[current] = { puzzleId, success: false, error: String(e?.message || e) };
      }
      // small pacing delay between triggers to avoid burst
      if (current < puzzleIds.length - 1) {
        await new Promise(r => setTimeout(r, TRIGGER_DELAY_MS));
      }
    }
  }

  // Start a small pool
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, puzzleIds.length) }, (_, i) => worker(i));
  await Promise.all(workers);

  // Count successes and failures
  const successful = results.filter(r => r?.success).length;
  const failed = results.filter(r => r && !r.success).length;

  console.log(`📊 CONCURRENT ANALYSIS COMPLETE:`);
  console.log(`   Total puzzles: ${puzzleIds.length}`);
  console.log(`   Successful: ${successful} (${((successful / puzzleIds.length) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${failed} (${((failed / puzzleIds.length) * 100).toFixed(1)}%)`);

  if (successful > 0) {
    const avgTime = results
      .filter(r => r && r.success && r.responseTime)
      .reduce((sum, r) => sum + (r!.responseTime || 0), 0) / successful;
    console.log(`   Average response time: ${Math.round(avgTime)}s`);
  }

  return results;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    console.log('🤖 GROK-4-FAST-NON-REASONING PUZZLE ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GROK_MODEL}`);
    console.log(`Prompt: solver (standard puzzle-solving prompt)`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`Trigger delay: ${TRIGGER_DELAY_MS / 1000} seconds`);
    console.log('NOTE: Grok-4-Fast-Non-Reasoning model (non-reasoning variant)');
    console.log('      Expected to be faster than reasoning variant');

    // Get puzzle IDs from command line arguments
    const puzzleIds = getPuzzleIdsFromArgs();

    if (puzzleIds.length === 0) {
      console.log('\n❌ No puzzle IDs provided. Please provide puzzle IDs, dataset, or file.');
      console.log('\nUsage examples:');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts --dataset arc1');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts --dataset arc2');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts 00d62c1b 00d7ad95 00da1a24');
      console.log('  node --import tsx scripts/grok-4-fast-non-reasoning.ts --file puzzle-ids.txt');
      process.exit(1);
    }

    console.log(`Puzzles to analyze: ${puzzleIds.length}`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('⚡ Triggering fresh analysis for all specified puzzles');
    console.log('🚀 All analyses run concurrently with delays between triggers');
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
