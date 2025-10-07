/**
 * Author: Cascade using Claude Sonnet 4.5
 * Date: 2025-10-06
 * PURPOSE: Test script to analyze a SINGLE puzzle using Grok-4-Fast-Non-Reasoning model.
 *          This is a simple test script to verify the Grok-4-Fast-Non-Reasoning integration works correctly
 *          before running the full batch script on entire datasets.
 *
 * SRP and DRY check: Pass - Focused single-purpose test script for validating API integration
 *
 * USAGE:
 * 1. Test with a specific puzzle ID:
 *    node --import tsx scripts/grok-4-fast-non-reasoning-test.ts 42a15761
 *
 * 2. Test with default puzzle (if no ID provided):
 *    node --import tsx scripts/grok-4-fast-non-reasoning-test.ts
 *
 * The script will analyze the puzzle and save the result to the database.
 * It will display detailed output to help verify the integration is working correctly.
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Grok-4-Fast-Non-Reasoning model to use for analysis
const GROK_MODEL = 'grok-4-fast-non-reasoning';

// Timeout for the test (8 minutes - less than reasoning variant)
const PUZZLE_TIMEOUT_MS = 8 * 60 * 1000;

// Default puzzle ID to use if none provided
const DEFAULT_PUZZLE_ID = '42a15761'; // Using the same puzzle that worked with reasoning variant

interface AnalysisRequest {
  temperature: number;
  promptId: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  retryMode: boolean;
}

/**
 * Get puzzle ID from command line arguments
 */
function getPuzzleIdFromArgs(): string {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`ℹ️  No puzzle ID provided, using default: ${DEFAULT_PUZZLE_ID}`);
    return DEFAULT_PUZZLE_ID;
  }

  return args[0];
}

/**
 * Analyze a single puzzle with Grok-4-Fast-Non-Reasoning
 */
async function testAnalyzePuzzle(puzzleId: string): Promise<void> {
  const startTime = Date.now();

  try {
    console.log('🤖 GROK-4-FAST-NON-REASONING TEST SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GROK_MODEL}`);
    console.log(`Puzzle ID: ${puzzleId}`);
    console.log(`Prompt: solver`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log('NOTE: Non-reasoning variant - should be faster than reasoning model');
    console.log('='.repeat(80));
    console.log('\n🚀 Starting analysis...\n');

    // Prepare analysis request
    const requestBody: AnalysisRequest = {
      temperature: 0.2,
      promptId: 'solver',
      systemPromptMode: 'ARC',
      omitAnswer: true,
      retryMode: false
    };

    // URL-encode model key
    const encodedModelKey = encodeURIComponent(GROK_MODEL);

    // Step 1: Analyze the puzzle
    console.log('📡 Step 1: Calling analysis API...');
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
    console.log('✅ Analysis API call successful!');
    console.log(`   - Pattern Description: ${(() => {
      const desc = analysisData.patternDescription;
      if (typeof desc === 'string') {
        return desc.substring(0, 100) + '...';
      }
      return String(desc || 'N/A');
    })()}`);
    console.log(`   - Solving Strategy: ${(() => {
      const strategy = analysisData.solvingStrategy;
      if (typeof strategy === 'string') {
        return strategy.substring(0, 100) + '...';
      }
      return String(strategy || 'N/A');
    })()}`);
    console.log(`   - Confidence: ${analysisData.confidence || 'N/A'}`);
    console.log(`   - Has Prediction: ${analysisData.predictedOutput ? 'Yes' : 'No'}`);

    // Step 2: Save to database
    console.log('\n💾 Step 2: Saving to database...');
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
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!saveResponse.data.success) {
      throw new Error(`Save request failed: ${saveResponse.statusText}`);
    }

    console.log('✅ Save to database successful!');

    const endTime = Date.now();
    const responseTime = Math.round((endTime - startTime) / 1000);

    console.log('\n🎉 TEST COMPLETE!');
    console.log('='.repeat(80));
    console.log(`Total time: ${responseTime}s`);
    console.log(`Puzzle ${puzzleId} analyzed and saved successfully!`);
    console.log('\n✨ Grok-4-Fast-Non-Reasoning integration is working correctly.');
    console.log('\nYou can now run the full batch script with:');
    console.log(`  node --import tsx scripts/grok-4-fast-non-reasoning.ts --dataset arc1`);
    console.log(`  node --import tsx scripts/grok-4-fast-non-reasoning.ts --dataset arc2`);
    console.log('='.repeat(80));

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

    console.log('\n❌ TEST FAILED!');
    console.log('='.repeat(80));
    console.log(`Error: ${errorMessage}`);
    console.log(`Time elapsed: ${responseTime}s`);
    console.log('\nPlease check:');
    console.log('  1. Is the server running? (npm run test)');
    console.log('  2. Is GROK_API_KEY configured in .env?');
    console.log('  3. Is the puzzle ID valid?');
    console.log('  4. Check server logs for more details');
    console.log('='.repeat(80));

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
const puzzleId = getPuzzleIdFromArgs();
testAnalyzePuzzle(puzzleId);
