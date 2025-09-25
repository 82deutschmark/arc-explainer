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
const GPT5_MODEL = 'gpt-5-nano-2025-08-07';

// Reasoning effort setting (medium as requested)
const REASONING_EFFORT = 'high';

// Timeout per puzzle in milliseconds (30 minutes for complex puzzles)
const PUZZLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * List of puzzles that need analysis
 */
const PUZZLES_TO_ANALYZE = {
  // TESTED BUT NOT SOLVED 
  testedButNotSolved: ['67c52801',
    '9772c176',
    '7d1f7ee8',
    'a04b2602',
    '99306f82',
    '695367ec',
    'd304284e',
    '58743b76',
    'cad67732',
    '712bf12e',
    '505fff84',
    '642248e4',
    '3a301edc',
    'e4075551',
    '7039b2d7',
    'd37a1ef5',
    'ea9794b1',
    'e95e3d8e',
    '59341089',
    'e74e1818',
    '9a4bb226',
    'e99362f0',
    '9f27f097',
    '55783887',
    'bc4146bd',
    '770cc55f',
    'cf133acc',
    'ed74f2f2',
    'c663677b',
    '845d6e51',
    '5b6cbef5',
    '7d18a6fb',
    '95a58926',
    '917bccba',
    '5b526a93',
    'e66aafb8',
    'c3202e5a',
    '332efdb3',
    '55059096',
    'df8cc377',
    '58e15b12',
    'fe9372f3',
    '2f0c5170',
    '60a26a3e',
    '66f2d22f',
    '3f23242b',
    'b4a43f3b',
    '6ad5bdfd',
    'ae58858e',
    'c87289bb',
    'e9bb6954',
    'ed98d772',
    'd492a647',
    '1da012fc',
    '6a11f6da',
    '50aad11f',
    '414297c0',
    'c97c0139',
    '3ee1011a',
    'a680ac02',
    'dc2e9a9d',
    'c1990cce',
    'e5790162',
    'd4c90558',
    'aee291af',
    '45737921',
    'aa18de87',
    '817e6c09',
    '52fd389e',
    'aab50785',
    '92e50de0',
    'ca8f78db',
    'e760a62e',
    'f0df5ff0',
    '72207abc',
    'e57337a4',
    '97239e3d',
    '8cb8642d',
    'e0fb7511',
    'e41c6fd3',
    '5ffb2104',
    'f3cdc58f',
    '42918530',
    '62b74c02',
    'ba9d41b8',
    'f83cb3f6',
    '5289ad53',
    'a934301b',
    '759f3fd3',
    'bf89d739',
    'fb791726',
    'ac605cbb',
    '88207623',
    'cb227835',
    '7bb29440',
    '310f3251',
    '3194b014',
    '72a961c9',
    '9bebae7a',
    '2697da3f',
    '4ff4c9da',
    '4f537728',
    'fafd9572',
    '8dae5dfc',
    '42a15761',
    '2c737e39',
    'd282b262',
    '81c0276b',
    '423a55dc',
    '516b51b7',
    '3d31c5b3',
    'd4b1c2b1',
    '73182012',
    'e9b4f6fc',
    '73c3b0d8',
    'e9ac8c9e',
    'f45f5ca7',
    'c658a4bd',
    '6f473927',
    '33b52de3',
    '903d1b4a',
    'e69241bd',
    '9b365c51',
    'ccd554ac',
    'e1baa8a4',
    '9def23fe',
    'b7fb29bc',
    'ef26cbf6',
    '5af49b42',
    'ce8d95cc',
    'aa4ec2a5',
    'd19f7514',
    '292dd178',
    '84f2aca1',
    '25094a63',
    'ad7e01d0',
    'e21a174a',
    '45bbe264',
    '93b4f4b3',
    'b7cb93ac',
    '5207a7b5',
    '2b01abd0',
    'ea959feb',
    '29700607',
    '7e02026e',
    '319f2597',
    '281123b4',
    'e872b94a',
    '833dafe3',
    'baf41dbf',
    '4364c1c4',
    '705a3229',
    'bcb3040b',
    '5a5a2103',
    'd017b73f',
    '8597cfd7',
    '762cd429',
    'a59b95c0',
    '8ee62060',
    'e9c9d9a1',
    '2753e76c',
    'e133d23d',
    'e7b06bea',
    '8a371977',
    '963f59bc',
    'd47aa2ff',
    '604001fa',
    'c62e2108',
    'e7a25a18',
    '5b692c0f',
    'cd3c21df',
    '50a16a69'],

  // NOT TESTED (63 puzzles)
  notTested: [
    
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
 * Analyze all puzzles concurrently with small delays between triggers
 */
async function analyzeAllPuzzlesConcurrently(puzzleIds: string[]): Promise<AnalysisResult[]> {
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

    // Small delay between triggers (2 seconds as requested)
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
    console.log('🤖 PUZZLE ANALYSIS SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GPT5_MODEL}`);
    console.log(`Reasoning Effort: ${REASONING_EFFORT}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`Total Puzzles: ${PUZZLES_TO_ANALYZE.testedButNotSolved.length + PUZZLES_TO_ANALYZE.notTested.length}`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('🔄 Same process as client UI - analyze + save in one call');
    console.log('⚡ Triggering fresh analysis for all puzzles (no existing explanation checks)');
    console.log('🚀 All analyses run concurrently with 2-second delays between triggers');
    console.log('='.repeat(80));

    const allResults: AnalysisResult[] = [];

    // Combine all puzzle IDs for concurrent processing
    const allPuzzleIds = [
      ...PUZZLES_TO_ANALYZE.testedButNotSolved,
      ...PUZZLES_TO_ANALYZE.notTested
    ];

    // Process all puzzles concurrently
    const results = await analyzeAllPuzzlesConcurrently(allPuzzleIds);
    allResults.push(...results);

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
