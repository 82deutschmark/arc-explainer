/**
 *
 * Author: Gemini 2.5 Pro
 * Date: 2025-09-23
 * PURPOSE: Retry analysis of the 4 puzzles that failed with "Server temporarily unavailable" errors
 * SRP and DRY check: Pass - This script handles retry logic for failed puzzle analyses
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Base URL for the API - adjust if running on different host/port
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// GPT-5 model to use for analysis
const GPT5_MODEL = 'gpt-5-nano-2025-08-07';

// Reasoning effort setting (medium as requested)
const REASONING_EFFORT = 'medium';

// Timeout per puzzle in milliseconds (30 minutes for complex puzzles)
const PUZZLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * 37d3e8b2', '67c52801', '9772c176', '7d1f7ee8', '00dbd492', '070dd51e', '4c177718', 'a04b2602', '31adaf00', '99306f82', '695367ec', '0a1d4ef5', 'd304284e', '58743b76', 'bf32578f', '0692e18c', 'cad67732', '712bf12e', '3b4c2228', '505fff84', '0becf7df', 'b7999b51', '642248e4', 'a406ac07', 'e5c44e8f', 'd94c3b52', 'ff72ca3e', '31d5ba1a', 'e88171ec', '7c9b52a0', '3a301edc', 'e4075551', '7039b2d7', 'd37a1ef5', '0c786b71', '2037f2c7', 'ea9794b1', 'e95e3d8e', '6ea4a07e', '59341089', 'dd2401ed', 'e74e1818', '0bb8deee', '9a4bb226', 'fc754716', 'e99362f0', '9f27f097', '55783887', 'bc4146bd', '770cc55f', 'cf133acc', 'ed74f2f2', 'c663677b', 'f3e62deb', '4852f2fa', '845d6e51', '9c1e755f', '5b6cbef5', '696d4842', '7d18a6fb', '95a58926', 'd2acf2cb', '256b0a75', '642d658d', '917bccba', 'da2b0fe3', '0e671a1a', '5b526a93', 'e66aafb8', 'c3202e5a', '332efdb3', '55059096', 'af24b4cc', 'df8cc377', '2685904e', '009d5c81', '58e15b12', '7c8af763', 'fe9372f3', '32e9702f', '2f0c5170', '67636eac', '60c09cac', '782b5218', '8e2edd66', 'bf699163', '60a26a3e', '15663ba9', '66f2d22f', '3f23242b', 'b4a43f3b', '6ad5bdfd', 'ae58858e', '0b17323b', 'c87289bb', '0f63c0b9', 'e9bb6954', 'ed98d772', 'd492a647', '1da012fc', '6a11f6da', '1d398264', '11e1fe23', '1a6449f1', '575b1a71', '4cd1b7b2', '50aad11f', 'c7d4e6ad', '414297c0', 'ac2e8ecf', 'c97c0139', '3ee1011a', 'bbb1b8b6', 'ac3e2b04', '195ba7dc', 'a680ac02', '69889d6e', '1d0a4b61', 'dc2e9a9d', '9356391f', 'c1990cce', '5833af48', 'e5790162', 'd4c90558', 'aee291af', '62ab2642', '45737921', 'aa18de87', 'e345f17b', '817e6c09', '52fd389e', '9c56f360', '0d87d2a6', 'aab50785', '92e50de0', '48131b3c', 'c64f1187', '4aab4007', '4b6b68e5', 'ca8f78db', 'e760a62e', 'e633a9e5', 'f0df5ff0', '72207abc', 'c92b942c', 'e57337a4', '6df30ad6', '97239e3d', '8cb8642d', 'e0fb7511', 'e41c6fd3', '5ffb2104', 'bb52a14b', 'f3cdc58f', '1e97544e', '42918530', '62b74c02', 'ba9d41b8', 'f83cb3f6', '5289ad53', 'a934301b', '84db8fc4', '15696249', '759f3fd3', 'bf89d739', '19bb5feb', '1acc24af', '12422b43', '94be5b80', 'fb791726', '358ba94e', '9110e3c5', '9b4c17c4', 'ac605cbb', '88207623', 'cb227835', 'aa300dc3', '21f83797', '90347967', '7bb29440', '310f3251', '3194b014', '72a961c9', '9bebae7a', '2697da3f', '0c9aba6e', '4acc7107', '4ff4c9da', '4f537728', '54db823b', 'fafd9572', '1c0d0a4b', '8dae5dfc', 'c8b7cc0f', '03560426', '42a15761', 'b1fc8b8e', '48f8583b', '2c737e39', 'd282b262', '12eac192', '81c0276b', 'c48954c1', 'f3b10344', '423a55dc', '516b51b7', '3d31c5b3', '34b99a2b', '68b67ca3', 'd4b1c2b1', '73182012', 'e9b4f6fc', 'a57f2f04', '66e6c45b', '3979b1a8', '73c3b0d8', 'c35c1b4c', '626c0bcc', 'e9ac8c9e', 'f45f5ca7', 'b0f4d537', 'c658a4bd', '6f473927', '929ab4e9', '33b52de3', '1c02dbbe', '8b28cd80', '903d1b4a', 'e69241bd', '9ddd00f0', '9b365c51', 'ccd554ac', '4e469f39', 'e1baa8a4', '8fbca751', '9def23fe', 'b7fb29bc', 'ef26cbf6', '5af49b42', 'ce8d95cc', '5783df64', 'aa4ec2a5', '08573cc6', 'f5aa3634', 'd19f7514', '292dd178', 'c074846d', 'e6de6e8f', '1c56ad9f', '84f2aca1', '25094a63', 'ad7e01d0', 'e21a174a', '5d2a5c43', '20818e16', '45bbe264', 'a3f84088', '2072aba6', '94414823', '93b4f4b3', '2a5f8217', 'b7cb93ac', '5207a7b5', '2b01abd0', 'ea959feb', '351d6448', '29700607', '692cd3b6', '7e02026e', '319f2597', 'f823c43c', '7953d61e', '281123b4', '8ba14f53', 'd56f2372', 'e872b94a', '833dafe3', 'baf41dbf', '27a77e38', '4364c1c4', '705a3229', '17cae0c1', 'be03b35f', '12997ef3', 'bcb3040b', '137f0df0', '7ee1c6ea', '00576224', '5a5a2103', 'd017b73f', '1a2e2828', '140c817e', '8597cfd7', 'ca8de6ea', '762cd429', 'a59b95c0', '8ee62060', 'e7639916', 'e9c9d9a1', '13713586', '1990f7a8', '73ccf9c2', '2753e76c', '1e81d6f9', 'e133d23d', '27f8ce4f', 'e7b06bea', 'f0afb749', '639f5a19', '17b80ad2', '8a371977', '963f59bc', 'e7dd8335', 'd47aa2ff', '604001fa', '506d28a5', 'd5c634a2', '18419cfa', 'c62e2108', 'e7a25a18', '64a7c07e', '5b692c0f', 'cd3c21df', '50a16a69', 'b0722778'
 */
const PUZZLES_TO_RETRY = [
  '05a7bcf2',
  '15113be4',
  'cfb2ce5a',
  '1e97544e',
  'd94c3b52',
  '8719f442',
  'f8be4b64',
  '4aab4007',
  'de493100',
  'b457fec5',
  '96a8c0cd',
  'b942fd60',
  'bd14c3bf',
  'a096bf4d'
];

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
    console.log('🔄 PUZZLE RETRY SCRIPT');
    console.log('='.repeat(80));
    console.log(`Model: ${GPT5_MODEL}`);
    console.log(`Reasoning Effort: ${REASONING_EFFORT}`);
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Timeout per puzzle: ${PUZZLE_TIMEOUT_MS / 60000} minutes`);
    console.log(`Puzzles to retry: ${PUZZLES_TO_RETRY.length}`);
    console.log('='.repeat(80));
    console.log('💾 Results are immediately saved to database via API');
    console.log('🔄 Same process as client UI - analyze + save in one call');
    console.log('='.repeat(80));

    // Retry all failed puzzles concurrently
    const results = await retryFailedPuzzles();

    // Overall summary
    console.log('\n🎉 RETRY SUMMARY:');
    console.log('='.repeat(80));

    const totalPuzzles = results.length;
    const successfulAnalyses = results.filter(r => r.success).length;
    const failedAnalyses = results.filter(r => !r.success).length;

    console.log(`Total puzzles retried: ${totalPuzzles}`);
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
      console.log('\n❌ Still Failed Puzzles (require manual review):');
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
process.on('SIGINT', () => {
  console.log('\n⚠️  Retry interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Retry terminated');
  process.exit(0);
});

// Run the retry
main();
