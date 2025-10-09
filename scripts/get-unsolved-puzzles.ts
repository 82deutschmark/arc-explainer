/**
 * Author: Claude Sonnet 4.5
 * Date: 2025-10-08
 * PURPOSE: Fetch unsolved ARC2 evaluation puzzles for grok-4-fast-reasoning model.
 *          Uses the existing /api/model-dataset/performance endpoint to get puzzles that are
 *          either "incorrect" (failed) or "notAttempted" (never analyzed).
 *          Outputs puzzle IDs to a text file for use with grok-4-progressive-reasoning.ts
 *
 * SRP and DRY check: Pass - Single responsibility: fetch and write unsolved puzzle IDs
 *
 * USAGE:
 * node --import tsx scripts/get-unsolved-puzzles.ts
 *
 * Optional flags:
 * --model <model-name>        Model to check (default: grok-4-fast-reasoning)
 * --dataset <dataset-name>    Dataset to check (default: evaluation2)
 * --output <file-path>        Output file path (default: scripts/grok-4-unsolved-arc2.txt)
 * --include-failed            Include puzzles that were attempted but incorrect (default: true)
 * --include-unattempted       Include puzzles never attempted (default: true)
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

interface CLIArgs {
  modelName: string;
  datasetName: string;
  outputPath: string;
  includeFailed: boolean;
  includeUnattempted: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  let modelName = 'grok-4-fast-reasoning';
  let datasetName = 'evaluation2'; // ARC2 evaluation set
  let outputPath = path.join(process.cwd(), 'scripts', 'grok-4-unsolved-arc2.txt');
  let includeFailed = true;
  let includeUnattempted = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--model':
      case '-m':
        modelName = args[++i];
        break;

      case '--dataset':
      case '-d':
        datasetName = args[++i];
        break;

      case '--output':
      case '-o':
        outputPath = args[++i];
        break;

      case '--include-failed':
        includeFailed = args[++i]?.toLowerCase() !== 'false';
        break;

      case '--include-unattempted':
        includeUnattempted = args[++i]?.toLowerCase() !== 'false';
        break;

      case '--help':
      case '-h':
        console.log('Usage: node --import tsx scripts/get-unsolved-puzzles.ts [options]');
        console.log('\nOptions:');
        console.log('  --model <name>              Model to check (default: grok-4-fast-reasoning)');
        console.log('  --dataset <name>            Dataset to check (default: evaluation2)');
        console.log('  --output <path>             Output file path (default: scripts/grok-4-unsolved-arc2.txt)');
        console.log('  --include-failed <bool>     Include failed puzzles (default: true)');
        console.log('  --include-unattempted <bool> Include unattempted puzzles (default: true)');
        console.log('\nExample:');
        console.log('  node --import tsx scripts/get-unsolved-puzzles.ts');
        console.log('  node --import tsx scripts/get-unsolved-puzzles.ts --model gpt-5-2025-08-07 --dataset evaluation');
        process.exit(0);
        break;
    }
  }

  return {
    modelName,
    datasetName,
    outputPath,
    includeFailed,
    includeUnattempted
  };
}

interface ModelDatasetPerformance {
  modelName: string;
  dataset: string;
  correct: string[];
  incorrect: string[];
  notAttempted: string[];
  summary: {
    correct: number;
    incorrect: number;
    notAttempted: number;
    totalPuzzles: number;
  };
}

/**
 * Fetch unsolved puzzles from API
 */
async function fetchUnsolvedPuzzles(
  modelName: string,
  datasetName: string
): Promise<ModelDatasetPerformance> {
  try {
    console.log(`🔍 Fetching performance data for ${modelName} on ${datasetName}...`);

    const url = `${API_BASE_URL}/api/model-dataset/performance/${encodeURIComponent(modelName)}/${encodeURIComponent(datasetName)}`;
    const response = await axios.get(url, { timeout: 30000 });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to fetch performance data');
    }

    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error(`Model "${modelName}" or dataset "${datasetName}" not found in database`);
    }
    throw error;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const { modelName, datasetName, outputPath, includeFailed, includeUnattempted } = parseArgs();

    console.log('📋 GET UNSOLVED PUZZLES FOR PROGRESSIVE REASONING');
    console.log('='.repeat(80));
    console.log(`Model: ${modelName}`);
    console.log(`Dataset: ${datasetName}`);
    console.log(`Output: ${outputPath}`);
    console.log(`Include Failed: ${includeFailed}`);
    console.log(`Include Unattempted: ${includeUnattempted}`);
    console.log('='.repeat(80));

    // Fetch performance data from API
    const performance = await fetchUnsolvedPuzzles(modelName, datasetName);

    console.log('\n📊 Performance Summary:');
    console.log(`   Total Puzzles: ${performance.summary.totalPuzzles}`);
    console.log(`   ✅ Correct: ${performance.summary.correct}`);
    console.log(`   ❌ Incorrect: ${performance.summary.incorrect}`);
    console.log(`   ⚠️  Not Attempted: ${performance.summary.notAttempted}`);

    // Collect unsolved puzzle IDs based on user preferences
    const unsolvedPuzzles: string[] = [];

    if (includeFailed) {
      unsolvedPuzzles.push(...performance.incorrect);
      console.log(`\n➕ Including ${performance.incorrect.length} failed puzzles`);
    }

    if (includeUnattempted) {
      unsolvedPuzzles.push(...performance.notAttempted);
      console.log(`➕ Including ${performance.notAttempted.length} unattempted puzzles`);
    }

    if (unsolvedPuzzles.length === 0) {
      console.log('\n🎉 No unsolved puzzles found! All puzzles are correct.');
      console.log('Nothing to write to output file.');
      return;
    }

    // Sort puzzle IDs for consistency
    unsolvedPuzzles.sort();

    console.log(`\n📝 Total Unsolved: ${unsolvedPuzzles.length} puzzles`);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write to file (one puzzle ID per line)
    const fileContent = unsolvedPuzzles.join('\n') + '\n';
    fs.writeFileSync(outputPath, fileContent, 'utf-8');

    console.log(`\n✅ Successfully wrote ${unsolvedPuzzles.length} puzzle IDs to:`);
    console.log(`   ${outputPath}`);
    console.log('\n💡 Next steps:');
    console.log(`   1. Review the puzzle list: cat ${outputPath}`);
    console.log(`   2. Run progressive reasoning: node --import tsx scripts/grok-4-progressive-reasoning.ts --file ${outputPath}`);
    console.log('\n✨ Done!');

  } catch (error: any) {
    console.error('\n💥 Error:', error.message || error);

    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }

    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Operation interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Operation terminated');
  process.exit(0);
});

// Run the script
main();
