/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Analyze ARC Eval puzzles using Grok-4-Fast-Reasoning model via external API endpoints.
 *          This script is adapted from analyze-puzzles-by-id.ts but specifically for Grok-4-Fast-Reasoning.
 *          Key differences from GPT-5: No reasoning configuration parameters (reasoningEffort, reasoningVerbosity, reasoningSummaryType)
 *          as Grok-4 models don't support these parameters per xAI documentation.
 * 
 * SRP and DRY check: Pass - This script handles API requests for puzzle analysis with proper error handling and progress tracking
 * 
 * USAGE:
 * 1. Analyze all ARC 1 Eval puzzles (400 puzzles):
 *    npx ts-node scripts/grok-4-fast-reasoning.ts --dataset arc1
 * 
 * 2. Analyze all ARC 2 Eval puzzles (120 puzzles):
 *    npx ts-node scripts/grok-4-fast-reasoning.ts --dataset arc2
 * 
 * 3. Analyze specific puzzle IDs:
 *    npx ts-node scripts/grok-4-fast-reasoning.ts 00d62c1b 00d7ad95 00da1a24
 * 
 * 4. Or pass a text file containing one puzzle ID per line:
 *    npx ts-node scripts/grok-4-fast-reasoning.ts --file puzzle-ids.txt
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

// Grok-4-Fast-Reasoning model to use for analysis
const GROK_MODEL = 'grok-4-fast-reasoning';

// Timeout per puzzle in milliseconds (60 minutes for Grok-4-fast-reasoning)
// Reasoning models can take 30-40+ minutes, need generous timeout
const PUZZLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes (reasoning models can be slow)

// Delay between triggering concurrent analyses
const TRIGGER_DELAY_MS = 1000; // 1 second

// NEW: Concurrency cap (align with xAI provider limits). Override via env XAI_MAX_CONCURRENCY.
// Delete MAX_CONCURRENCY usage by replacing pool implementation with paced launcher
// const MAX_CONCURRENCY = Math.max(1, Number(process.env.XAI_MAX_CONCURRENCY || 2));

// NEW: Parse an optional --limit or -n flag from CLI to restrict the run size (useful for smoke tests)
function getLimitFromArgs(): number | null {
  const args = process.argv.slice(2);
  const limitIndex = args.findIndex(a => a === '--limit' || a === '-n');
  if (limitIndex !== -1) {
    const raw = args[limitIndex + 1];
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

// NEW: Parse an optional --tail flag to take the last N IDs (e.g., --tail 10)
function getTailFromArgs(): number | null {
  const args = process.argv.slice(2);
  const idx = args.findIndex(a => a === '--tail');
  if (idx !== -1) {
    const raw = args[idx + 1];
    const n = Number(raw);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return null;
}

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
  // NOTE: NO reasoningEffort, reasoningVerbosity, or reasoningSummaryType
  // These are GPT-5 specific and not supported by Grok-4 models
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
 * Analyze a single puzzle with Grok-4-Fast-Reasoning
 */
async function analyzePuzzle(puzzleId: string): Promise<AnalysisResult> {
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting analysis of ${puzzleId}...`);

    // Prepare analysis request (mirroring client UI behavior)
    // IMPORTANT: NO reasoning parameters for Grok-4 models
    const requestBody: AnalysisRequest = {
      temperature: 0.99, // Default temperature (Grok-4-fast-reasoning supports temperature)
      promptId: 'custom', // Use  prompt as specified
      systemPromptMode: 'ARC', // Use ARC system prompt mode
      omitAnswer: true, // Researcher option to hide correct answer
      retryMode: false // Not in retry mode
    };

    // URL-encode model key (Grok-4-Fast-Reasoning model)
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
 * Analyze all puzzles with unlimited concurrency, 1s stagger between starts
 */
async function analyzeAllPuzzlesPaced(puzzleIds: string[]): Promise<AnalysisResult[]> {
  if (puzzleIds.length === 0) {
    console.log('No puzzle IDs provided. Nothing to analyze.');
    return [];
  }

  console.log(`\n🚀 Queueing ${puzzleIds.length} analyses with 1s stagger and no concurrency cap...`);
  console.log('='.repeat(80));

  const resultPromises: Promise<AnalysisResult>[] = [];

  for (let i = 0; i < puzzleIds.length; i++) {
    const puzzleId = puzzleIds[i];
    const p = new Promise<AnalysisResult>((resolve) => {
      setTimeout(async () => {
        try {
          const res = await analyzePuzzle(puzzleId);
          resolve(res);
        } catch (e: any) {
          resolve({ puzzleId, success: false, error: String(e?.message || e) });
        }
      }, i * TRIGGER_DELAY_MS);
    });
    resultPromises.push(p);
  }

  const results = await Promise.all(resultPromises);

  const successful = results.filter(r => r?.success).length;
  const failed = results.filter(r => r && !r.success).length;

  console.log(`📊 PACED ANALYSIS COMPLETE:`);
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
    console.log('🤖 GROK-4-FAST-REASONING PUZZLE ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GROK_MODEL}`);
    console.log(`Prompt: solver (standard puzzle-solving prompt)`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`Trigger delay: ${TRIGGER_DELAY_MS / 1000} seconds`);
    console.log('NOTE: Grok-4 models do NOT support reasoning configuration parameters');
    console.log('      (no reasoningEffort/reasoningVerbosity/reasoningSummaryType)');
    
    // Get puzzle IDs from command line arguments
    let puzzleIds = getPuzzleIdsFromArgs();

    // NEW: Apply optional --limit/-n
    const limit = getLimitFromArgs();
    if (limit && puzzleIds.length > limit) {
      console.log(`\n🔎 Applying limit: taking first ${limit} puzzles out of ${puzzleIds.length}`);
      puzzleIds = puzzleIds.slice(0, limit);
    }

    // NEW: Apply optional --tail N (take the last N IDs)
    const tail = getTailFromArgs();
    if (tail && puzzleIds.length > tail) {
      console.log(`\n🔎 Applying tail: taking last ${tail} puzzles out of ${puzzleIds.length}`);
      puzzleIds = puzzleIds.slice(-tail);
    }
    
    if (puzzleIds.length === 0) {
      console.log('\n❌ No puzzle IDs provided. Please provide puzzle IDs, dataset, or file.');
      console.log('\nUsage examples:');
      console.log('  npx ts-node scripts/grok-4-fast-reasoning.ts --dataset arc1');
      console.log('  npx ts-node scripts/grok-4-fast-reasoning.ts --dataset arc2');
      console.log('  npx ts-node scripts/grok-4-fast-reasoning.ts 00d62c1b 00d7ad95 00da1a24');
      console.log('  npx ts-node scripts/grok-4-fast-reasoning.ts --file puzzle-ids.txt');
      process.exit(1);
    }
    
    console.log(`Puzzles to analyze: ${puzzleIds.length}`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('⚡ Triggering fresh analysis for all specified puzzles');
    console.log('🚀 All analyses run concurrently with delays between triggers');
    console.log('='.repeat(80));

    // Process all puzzles (pacing only, no concurrency cap)
    const results = await analyzeAllPuzzlesPaced(puzzleIds);

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
