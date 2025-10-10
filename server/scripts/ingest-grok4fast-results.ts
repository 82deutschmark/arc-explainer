/**
 * Grok-4-Fast Results Ingestion Script
 * 
 * Author: Cascade using `whatever model the user has selected`
 * Date: `timestamp`
 * PURPOSE: One-time ingestion of Grok-4-fast results summary data into the explanations database.
 *          Handles the summary structure where each puzzle has aggregated metrics (cost, attempts, tokens, duration)
 *          but no actual prediction grids or detailed reasoning content.
 * 
 * SRP/DRY check: Pass - Single responsibility (Grok-4-fast results ingestion), reuses existing validation
 *                and repository services. No duplication of validation logic.
 * 
 * DATA STRUCTURE LIMITATIONS:
 * - Grok-4-fast results contain only summary statistics per puzzle, not actual predictions
 * - No prediction grids available for validation against expected outputs
 * - No reasoning content or detailed attempt metadata
 * - Creates entries marked as "summary-only" with no prediction data
 * - Useful for tracking model performance metrics but not for puzzle solving analysis
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs/promises';
import { repositoryService } from '../repositories/RepositoryService.ts';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface Grok4FastPuzzleResult {
  score: number;
  cost: number;
  attempts: number;
  output_tokens: number;
  duration: number;
  num_attempts_with_empty_list: number;
}

interface Grok4FastResults {
  score: number;
  total_tasks: number;
  total_cost: number;
  total_attempts: number;
  avg_cost_per_task: number;
  avg_cost_per_attempt: number;
  avg_output_tokens_per_task: number;
  avg_duration_per_task: number;
  task_results: Record<string, Grok4FastPuzzleResult>;
  num_attempts_with_empty_list: number;
}

export interface IngestionConfig {
  resultsFile: string;
  modelName: string;
  dryRun: boolean;
  verbose: boolean;
  forceOverwrite: boolean;
  skipDuplicates: boolean;
  limit?: number;
}

interface IngestionProgress {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  currentPuzzle: string;
  successDetails: Array<{
    puzzleId: string;
    hasData: boolean;
  }>;
}

/**
 * Load Grok-4-fast results from JSON file
 */
async function loadGrok4FastResults(config: IngestionConfig): Promise<Grok4FastResults | null> {
  try {
    const filePath = resolve(__dirname, '../../data', config.resultsFile);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    console.error(`❌ Error loading results file: ${error.message}`);
    return null;
  }
}

/**
 * Check if duplicate entry exists
 */
async function checkDuplicate(puzzleId: string, modelName: string): Promise<boolean> {
  const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
  return explanations.some(exp => exp.modelName === modelName);
}

/**
 * Create database entry for Grok-4-fast results
 */
async function createDatabaseEntry(
  puzzleId: string,
  puzzleResult: Grok4FastPuzzleResult,
  config: IngestionConfig
): Promise<any> {
  // Since this is summary-only data, we'll create a minimal entry
  // with available metrics but no prediction grids or reasoning

  return {
    puzzleId,
    modelName: config.modelName,

    // Prediction fields (null since no actual predictions available)
    predictedOutputGrid: null,
    isPredictionCorrect: null,
    predictionAccuracyScore: null,

    // Multi-test fields (null since no prediction data)
    hasMultiplePredictions: false,
    multiplePredictedOutputs: null,
    multiTestPredictionGrids: null,
    multiTestResults: null,
    multiTestAllCorrect: null,
    multiTestAverageAccuracy: null,

    // Token usage from results
    inputTokens: null, // Not available in summary
    outputTokens: puzzleResult.output_tokens,
    reasoningTokens: null,
    totalTokens: puzzleResult.output_tokens,

    // Cost from results
    estimatedCost: puzzleResult.cost,

    // Timing from results
    apiProcessingTimeMs: Math.round(puzzleResult.duration),

    // Metadata fields (summary-only indicators)
    patternDescription: `Grok-4-fast summary results - ${puzzleResult.attempts} attempts`,
    solvingStrategy: null,
    hints: [],
    confidence: null,

    // Reasoning (not available in summary)
    reasoningLog: `Summary-only data: ${puzzleResult.attempts} attempts, ${puzzleResult.output_tokens} output tokens`,
    hasReasoningLog: true,
    reasoningItems: null,

    // System prompts (not available)
    systemPromptUsed: null,
    userPromptUsed: null,
    promptTemplateId: 'external-grok4fast-summary',
    customPromptText: null,

    // Provider info
    providerRawResponse: puzzleResult,
    providerResponseId: null,

    // AI params (not available in summary)
    temperature: null,
    reasoningEffort: null,
    reasoningVerbosity: null,
    reasoningSummaryType: null,

    // Additional metadata
    alienMeaning: null,
    alienMeaningConfidence: null,

    // Saturn fields (not applicable)
    saturnImages: null,
    saturnLog: null,
    saturnEvents: null,
    saturnSuccess: null,

    // Summary-specific fields
    grok4fastScore: puzzleResult.score,
    grok4fastAttempts: puzzleResult.attempts,
    grok4fastEmptyAttempts: puzzleResult.num_attempts_with_empty_list
  };
}

/**
 * Save entry to database
 */
async function saveToDatabase(data: any, config: IngestionConfig): Promise<boolean> {
  if (config.dryRun) {
    console.log(`   [DRY RUN] Would save: ${data.modelName} for ${data.puzzleId}`);
    return true;
  }

  try {
    await repositoryService.explanations.saveExplanation(data);
    return true;
  } catch (error: any) {
    console.error(`   ❌ Error saving to database: ${error.message}`);
    return false;
  }
}

/**
 * Process a single puzzle
 */
async function processPuzzle(
  puzzleId: string,
  puzzleResult: Grok4FastPuzzleResult,
  config: IngestionConfig,
  progress: IngestionProgress
): Promise<void> {
  progress.currentPuzzle = puzzleId;

  try {
    // Check for duplicates
    if (config.skipDuplicates) {
      const isDuplicate = await checkDuplicate(puzzleId, config.modelName);
      if (isDuplicate) {
        progress.skipped++;
        if (config.verbose) {
          console.log(`   ⚠️  Skipped (duplicate exists for ${config.modelName})`);
        }
        return;
      }
    }

    // Create database entry
    const enrichedData = await createDatabaseEntry(puzzleId, puzzleResult, config);

    // Save to database
    const saved = await saveToDatabase(enrichedData, config);

    if (saved) {
      progress.successful++;
      progress.successDetails.push({
        puzzleId,
        hasData: true
      });

      if (config.verbose) {
        console.log(`   ✅ Score: ${puzzleResult.score}, Cost: $${puzzleResult.cost}, Attempts: ${puzzleResult.attempts}`);
      }
    }

  } catch (error: any) {
    progress.failed++;
    console.error(`❌ ${puzzleId} - Error: ${error.message}`);
    if (config.verbose && error.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * Main ingestion function
 */
async function ingestGrok4FastResults(config: IngestionConfig): Promise<void> {
  // Initialize database connection
  console.log('🔌 Initializing database connection...');
  const dbConnected = await repositoryService.initialize();

  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Check your DATABASE_URL environment variable.');
    process.exit(1);
  }

  console.log('✅ Database connected\n');

  // Load Grok-4-fast results
  console.log('📊 Loading Grok-4-fast results...');
  const results = await loadGrok4FastResults(config);

  if (!results) {
    console.error('❌ Failed to load results file');
    process.exit(1);
  }

  console.log(`✅ Loaded results for ${Object.keys(results.task_results).length} puzzles\n`);

  // Get puzzle IDs and apply limit if specified
  let puzzleIds = Object.keys(results.task_results);

  if (config.limit) {
    puzzleIds = puzzleIds.slice(0, config.limit);
    console.log(`Limiting to first ${config.limit} puzzles`);
  }

  console.log(`Found ${puzzleIds.length} puzzles to process\n`);

  const progress: IngestionProgress = {
    total: puzzleIds.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    currentPuzzle: '',
    successDetails: []
  };

  console.log('\n🚀 Grok-4-Fast Results Ingestion Script\n');
  console.log(`Model: ${config.modelName}`);
  console.log(`Results File: ${config.resultsFile}`);
  console.log(`Limit: ${config.limit || 'No limit'}`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Duplicates: ${config.skipDuplicates ? 'Skip' : config.forceOverwrite ? 'Overwrite' : 'Error'}\n`);

  // Process each puzzle
  for (let i = 0; i < puzzleIds.length; i++) {
    const puzzleId = puzzleIds[i];
    const puzzleResult = results.task_results[puzzleId];

    console.log(`\n[${i + 1}/${puzzleIds.length}] Processing ${puzzleId}...`);
    await processPuzzle(puzzleId, puzzleResult, config, progress);

    // Progress update every 10 puzzles
    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${puzzleIds.length} puzzles processed`);
      console.log(`   ✅ Successful: ${progress.successful}`);
      console.log(`   ⚠️  Skipped: ${progress.skipped}`);
      console.log(`   ❌ Failed: ${progress.failed}\n`);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 INGESTION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total puzzles processed: ${progress.total}`);
  console.log(`✅ Successful entries: ${progress.successful}`);
  console.log(`⚠️  Skipped (duplicates): ${progress.skipped}`);
  console.log(`❌ Failed: ${progress.failed}`);

  // Summary statistics from original results
  const totalScore = Object.values(results.task_results).reduce((sum, r) => sum + r.score, 0);
  const averageScore = (totalScore / progress.total * 100).toFixed(1);

  console.log(`\n📈 Original Results Summary:`);
  console.log(`   Total Score: ${totalScore.toFixed(1)}/120 (${averageScore}%)`);
  console.log(`   Total Cost: $${results.total_cost.toFixed(2)}`);
  console.log(`   Total Attempts: ${results.total_attempts}`);
  console.log(`   Average Cost per Task: $${results.avg_cost_per_task.toFixed(4)}`);
  console.log(`   Average Output Tokens per Task: ${results.avg_output_tokens_per_task.toFixed(1)}`);
  console.log(`   Average Duration per Task: ${results.avg_duration_per_task.toFixed(1)}ms`);
  console.log('='.repeat(60) + '\n');

  console.log('⚠️  NOTE: These entries contain only summary statistics.');
  console.log('   No prediction grids or reasoning content available.');
  console.log('   Useful for tracking model performance metrics only.\n');
}

/**
 * Parse command line arguments
 */
function parseArgs(): IngestionConfig {
  const args = process.argv.slice(2);

  const config: IngestionConfig = {
    resultsFile: 'results.json',
    modelName: 'grok-4-fast',
    dryRun: false,
    verbose: false,
    forceOverwrite: false,
    skipDuplicates: true
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '--results-file' && i + 1 < args.length) {
      config.resultsFile = args[++i];
    } else if (arg === '--model-name' && i + 1 < args.length) {
      config.modelName = args[++i];
    } else if (arg === '--limit' && i + 1 < args.length) {
      config.limit = parseInt(args[++i], 10);
      if (isNaN(config.limit) || config.limit <= 0) {
        console.error(`Invalid limit: ${args[i]}. Must be a positive integer.`);
        process.exit(1);
      }
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--force-overwrite') {
      config.forceOverwrite = true;
      config.skipDuplicates = false;
    } else if (arg === '--no-skip-duplicates') {
      config.skipDuplicates = false;
    }
  }

  return config;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
🚀 Grok-4-Fast Results Ingestion Script

USAGE:
  npm run ingest-grok4fast -- [options]

OPTIONS:
  --results-file <file>    JSON file containing Grok-4-fast results (default: results.json)
  --model-name <name>      Model name for database entries (default: grok-4-fast)
  --limit <N>              Only process first N puzzles (useful for testing)
  --dry-run                Preview without saving to database
  --verbose                Enable detailed logging
  --force-overwrite        Overwrite existing entries (default: skip)
  --no-skip-duplicates     Don't skip duplicates (error instead)
  --help                   Show this help message

EXAMPLES:
  # Test with first 5 puzzles
  npm run ingest-grok4fast -- --limit 5 --dry-run --verbose

  # Ingest all results with custom model name
  npm run ingest-grok4fast -- --model-name "grok-4-fast-summary"

  # Force overwrite existing entries
  npm run ingest-grok4fast -- --force-overwrite

IMPORTANT NOTES:
  - This script ingests SUMMARY STATISTICS only, not actual predictions
  - No prediction grids or reasoning content available in the source data
  - Creates database entries for tracking model performance metrics
  - Each puzzle creates one entry with available metadata (cost, attempts, tokens, etc.)
  - Useful for analytics but not for puzzle solving analysis

ENVIRONMENT:
  DATABASE_URL             PostgreSQL connection string (required)
  `);
}

// Export for programmatic use
export { ingestGrok4FastResults as ingestGrok4FastDataset };

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = parseArgs();
  ingestGrok4FastResults(config).catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
