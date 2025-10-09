/**
 * Author: Cascade using Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Progressive Reasoning test for Grok-4-Fast-Reasoning using conversation chaining.
 *          Automates what PuzzleDiscussion.tsx does manually: iterative refinement through
 *          multi-turn conversations with previousResponseId chaining.
 *
 * SRP and DRY check: Pass - Orchestrates progressive reasoning via API endpoints
 *
 * USAGE:
 * node --import tsx scripts/grok-4-progressive-reasoning.ts <puzzle-ids...>
 * node --import tsx scripts/grok-4-progressive-reasoning.ts --file puzzle-ids.txt
 * node --import tsx scripts/grok-4-progressive-reasoning.ts --iterations 3 <puzzle-ids...>
 * node --import tsx scripts/grok-4-progressive-reasoning.ts  (auto-loads from scripts/grok-4-unsolved-arc2.txt if exists)
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
const GROK_MODEL = 'grok-4-fast-reasoning'; // Use Grok-4-Fast-Reasoning model
const PUZZLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes per iteration
const ITERATION_DELAY_MS = 1000; // 1 second between iterations (as requested)
const PUZZLE_STAGGER_MS = 0; // Start all puzzles immediately (no staggering)

// Configuration for ARC2 dataset
const DATASET = 'arc2'; // Use ARC2 evaluation dataset

// Parse command line arguments
interface CLIArgs {
  puzzleIds: string[];
  maxIterations: number;
}
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  let maxIterations = 2; // Default: 2 iterations (0, 1)
  let puzzleIds: string[] = [];

  // Check for --iterations flag
  const iterIndex = args.findIndex(a => a === '--iterations' || a === '-i');
  if (iterIndex !== -1) {
    const iterValue = Number(args[iterIndex + 1]);
    if (!isNaN(iterValue) && iterValue > 0) {
      maxIterations = iterValue;
    }
    args.splice(iterIndex, 2); // Remove flag and value
  }

  // Check for --file flag
  const fileIndex = args.findIndex(a => a === '--file' || a === '-f');
  if (fileIndex !== -1) {
    const filePath = args[fileIndex + 1];
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
  } else {
    // Treat remaining args as puzzle IDs
    puzzleIds = args.filter(arg => !arg.startsWith('-'));
  }

  // NEW: If no puzzle IDs provided, auto-check for default unsolved puzzles file
  if (puzzleIds.length === 0) {
    const defaultFile = 'scripts/grok-4-unsolved-arc2.txt';
    if (fs.existsSync(defaultFile)) {
      console.log(`ℹ️  No puzzle IDs provided, loading from default file: ${defaultFile}`);
      try {
        const content = fs.readFileSync(defaultFile, 'utf-8');
        puzzleIds = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0 && !line.startsWith('#'));
        console.log(`✅ Loaded ${puzzleIds.length} puzzle IDs from ${defaultFile}\n`);
      } catch (error) {
        console.error(`Error reading default file ${defaultFile}:`, error);
      }
    }
  }

  return { puzzleIds, maxIterations };
}

interface IterationResult {
  iterationNumber: number;
  success: boolean;
  explanationId?: number;
  providerResponseId?: string;
  isPredictionCorrect?: boolean;
  confidence?: number;
  responseTime?: number;
  error?: string;
}

interface PuzzleResult {
  puzzleId: string;
  iterations: IterationResult[];
  totalSuccess: boolean;
  totalTime: number;
}

/**
 * Run a single iteration for a puzzle
 */
async function runIteration(
  puzzleId: string,
  iterationNumber: number,
  previousResponseId?: string
): Promise<IterationResult> {
  const startTime = Date.now();

  try {
    console.log(`\n🔄 ${puzzleId} - Iteration ${iterationNumber}${previousResponseId ? ` (continuing from ${previousResponseId.substring(0, 8)}...)` : ' (initial)'}`);

    // Build request payload
    const requestBody: any = {
      temperature: 0.99,
      promptId: 'discussion', // CRITICAL: Use discussion mode for progressive reasoning
      systemPromptMode: 'ARC',
      omitAnswer: true,
      retryMode: false
    };

    // Add previousResponseId for continuation iterations
    if (previousResponseId) {
      requestBody.previousResponseId = previousResponseId;
    }

    const encodedModelKey = encodeURIComponent(GROK_MODEL);

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
      [GROK_MODEL]: {
        ...analysisData,
        modelKey: GROK_MODEL
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

    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    console.log(`✅ Iteration ${iterationNumber} complete in ${responseTime}s`);
    console.log(`   Explanation ID: ${savedExplanationId}`);
    console.log(`   Provider Response ID: ${newProviderResponseId?.substring(0, 16)}...`);
    console.log(`   Correct: ${isPredictionCorrect ? '✓' : '✗'}, Confidence: ${confidence}%`);

    return {
      iterationNumber,
      success: true,
      explanationId: savedExplanationId,
      providerResponseId: newProviderResponseId,
      isPredictionCorrect,
      confidence,
      responseTime
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
  maxIterations: number
): Promise<PuzzleResult> {
  const startTime = Date.now();
  const iterations: IterationResult[] = [];
  let lastProviderResponseId: string | undefined;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧩 Starting Progressive Reasoning for ${puzzleId}`);
  console.log(`   Model: ${GROK_MODEL}`);
  console.log(`   Max Iterations: ${maxIterations}`);
  console.log(`${'='.repeat(80)}`);

  for (let i = 0; i < maxIterations; i++) {
    const result = await runIteration(puzzleId, i, lastProviderResponseId);
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

  return {
    puzzleId,
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
    const { puzzleIds, maxIterations } = parseArgs();

    if (puzzleIds.length === 0) {
      console.log('\n❌ No puzzle IDs provided.');
      console.log('\nUsage examples:');
      console.log('  node --import tsx scripts/grok-4-progressive-reasoning.ts <puzzle-ids...>');
      console.log('  node --import tsx scripts/grok-4-progressive-reasoning.ts --file puzzle-ids.txt');
      console.log('  node --import tsx scripts/grok-4-progressive-reasoning.ts --iterations 5 <puzzle-ids...>');
      process.exit(1);
    }

    console.log('🤖 GROK-4-FAST-REASONING PROGRESSIVE REASONING TEST');
    console.log('='.repeat(80));
    console.log(`Model: ${GROK_MODEL}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Max Iterations per Puzzle: ${maxIterations}`);
    console.log(`Puzzles: ${puzzleIds.length}`);
    console.log(`Timeout per iteration: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log('='.repeat(80));

    // Fire off all puzzles concurrently with staggered starts (2s delay)
    const resultPromises: Promise<PuzzleResult>[] = [];

    for (let i = 0; i < puzzleIds.length; i++) {
      const puzzleId = puzzleIds[i];
      
      // Wrap in delayed promise to stagger starts
      const delayedPromise = new Promise<PuzzleResult>((resolve) => {
        setTimeout(async () => {
          try {
            const result = await runProgressiveReasoning(puzzleId, maxIterations);
            resolve(result);
          } catch (error) {
            console.error(`Fatal error processing ${puzzleId}:`, error);
            resolve({
              puzzleId,
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

    console.log('\n✨ Progressive reasoning test complete!');
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
