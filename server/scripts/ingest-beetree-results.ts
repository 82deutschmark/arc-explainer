/**
 * BeeTree Dataset Ingestion Script
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-01-12
 * PURPOSE: Ingests BeeTree multi-model ensemble solver results into the explanations database.
 *          Extracts real LLM explanations, aggregates costs/tokens, and preserves ensemble metadata.
 *
 * SRP/DRY check: Pass - Single responsibility (BeeTree ingestion), reuses existing validation
 *                and repository services. No duplication of validation logic.
 *
 * DATA STRUCTURE UNDERSTANDING:
 * - BeeTree provides 2 attempts per puzzle (attempt_1, attempt_2) per test case
 * - For multi-test puzzles, submission has N elements (one per test case)
 * - We aggregate by ATTEMPT NUMBER to create database entries
 * - Logs contain per-model runs with full LLM responses, costs, and tokens
 * - step_finish logs contain voting/ensemble metadata
 *
 * EXAMPLE for puzzle with 2 test cases:
 * Submission: [ {attempt_1: grid1, attempt_2: grid1'}, {attempt_1: grid2, attempt_2: grid2'} ]
 * Database: 2 entries
 *   - Entry 1: has_multiple_predictions=true, multiple_predicted_outputs=[grid1, grid2]
 *   - Entry 2: has_multiple_predictions=true, multiple_predicted_outputs=[grid1', grid2']
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { PuzzleLoader } from '../services/puzzleLoader.ts';
import { validateSolverResponse, validateSolverResponseMulti } from '../services/responseValidator.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { determineCorrectness } from '../../shared/utils/correctness.ts';
import type {
  BeeTreeSubmission,
  BeeTreeIngestionConfig,
  BeeTreeIngestionProgress,
  BeeTreePuzzleResult,
  BeeTreeAttemptData,
  BeeTreeStepFinish,
  BeeTreeParsedRun
} from '../types/beetree.ts';
import {
  validateBeeTreeSubmissionOrThrow,
  validateGrid
} from '../utils/beetreeSubmissionValidator.ts';
import {
  indexLogDirectory,
  readStepFinishLog,
  getContributingRuns,
  aggregateRunStats,
  buildEnsembleMetadata,
  extractTimestamp
} from '../utils/beetreeLogParser.ts';
import {
  extractExplanationsWithFallback,
  cleanTextForStorage
} from '../utils/beetreeExplanationExtractor.ts';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize services
const puzzleLoader = new PuzzleLoader();

/**
 * Parse CLI arguments into configuration
 */
function parseArguments(): BeeTreeIngestionConfig {
  const args = process.argv.slice(2);

  const config: BeeTreeIngestionConfig = {
    submissionFile: '',
    logsDirectory: '',
    datasetName: 'beetree-ensemble-v1',
    label: undefined,
    source: undefined,
    limit: undefined,
    dryRun: false,
    verbose: false,
    forceOverwrite: false,
    skipDuplicates: true, // Default to skip duplicates
    stopOnError: false,
    resumeFrom: undefined,
    onlyMissing: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--submission-file':
        config.submissionFile = nextArg;
        i++;
        break;
      case '--logs-directory':
        config.logsDirectory = nextArg;
        i++;
        break;
      case '--dataset-name':
        config.datasetName = nextArg;
        i++;
        break;
      case '--label':
        config.label = nextArg;
        i++;
        break;
      case '--source':
        config.source = nextArg as any;
        i++;
        break;
      case '--limit':
        config.limit = parseInt(nextArg, 10);
        i++;
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--force-overwrite':
        config.forceOverwrite = true;
        config.skipDuplicates = false;
        break;
      case '--skip-duplicates':
        config.skipDuplicates = true;
        config.forceOverwrite = false;
        break;
      case '--no-skip-duplicates':
        config.skipDuplicates = false;
        config.forceOverwrite = false;
        break;
      case '--stop-on-error':
        config.stopOnError = true;
        break;
      case '--resume-from':
        config.resumeFrom = nextArg;
        i++;
        break;
      case '--only-missing':
        config.onlyMissing = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          printUsage();
          process.exit(1);
        }
    }
  }

  // Validate required arguments
  if (!config.submissionFile) {
    console.error('Error: --submission-file is required');
    printUsage();
    process.exit(1);
  }

  if (!config.logsDirectory) {
    console.error('Error: --logs-directory is required');
    printUsage();
    process.exit(1);
  }

  // Validate file/directory existence
  if (!existsSync(config.submissionFile)) {
    console.error(`Error: Submission file not found: ${config.submissionFile}`);
    process.exit(1);
  }

  if (!existsSync(config.logsDirectory)) {
    console.error(`Error: Logs directory not found: ${config.logsDirectory}`);
    process.exit(1);
  }

  return config;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: node ingest-beetree-results.ts [options]

Required:
  --submission-file <path>      Path to BeeTree *_submission.json file
  --logs-directory <path>       Path to BeeTree logs/ directory

Optional:
  --dataset-name <string>       Dataset name (default: beetree-ensemble-v1)
  --label <string>              Additional label for model name (e.g., prod, test)
  --source <source>             Source dataset (ARC1, ARC2, ARC-Heavy, etc.)
  --limit <N>                   Process only first N puzzles
  --dry-run                     Validate without writing to database
  --verbose                     Enable verbose logging
  --force-overwrite             Delete existing entries and overwrite
  --skip-duplicates             Skip puzzles with existing entries (default)
  --no-skip-duplicates          Treat duplicates as errors
  --stop-on-error               Stop on first error
  --resume-from <puzzleId>      Skip puzzles until this ID is reached
  --only-missing                Only process puzzles not in DB for this model
  --help                        Show this help message

Examples:
  # Basic ingestion
  node ingest-beetree-results.ts \\
    --submission-file beetreeARC/submissions/2025-01-12_submission.json \\
    --logs-directory beetreeARC/logs

  # With label and source
  node ingest-beetree-results.ts \\
    --submission-file beetreeARC/submissions/2025-01-12_submission.json \\
    --logs-directory beetreeARC/logs \\
    --label prod \\
    --source ARC2

  # Dry run first
  node ingest-beetree-results.ts \\
    --submission-file beetreeARC/submissions/2025-01-12_submission.json \\
    --logs-directory beetreeARC/logs \\
    --dry-run \\
    --verbose
`);
}

/**
 * Load and parse submission file
 */
async function loadSubmissionFile(filePath: string): Promise<BeeTreeSubmission> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return validateBeeTreeSubmissionOrThrow(data);
  } catch (error) {
    throw new Error(`Failed to load submission file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Build model name from config
 */
function buildModelName(config: BeeTreeIngestionConfig, attemptNumber: number): string {
  const base = config.datasetName;
  const label = config.label ? `-${config.label}` : '';
  return `${base}${label}-attempt${attemptNumber}`;
}

/**
 * Check if explanation already exists for puzzle + model
 */
async function checkDuplicate(puzzleId: string, modelName: string): Promise<boolean> {
  try {
    const existing = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
    return existing.some(exp => exp.modelName === modelName);
  } catch (error) {
    console.warn(`Warning: Could not check for duplicates: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Delete existing explanation for puzzle + model
 */
async function deleteDuplicate(puzzleId: string, modelName: string): Promise<void> {
  try {
    const existing = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
    const duplicate = existing.find(exp => exp.modelName === modelName);
    if (duplicate?.id) {
      await repositoryService.explanations.deleteExplanation(duplicate.id);
    }
  } catch (error) {
    console.warn(`Warning: Could not delete duplicate: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save enriched data to database
 */
async function saveToDatabase(data: any, config: BeeTreeIngestionConfig): Promise<boolean> {
  if (config.dryRun) {
    console.log(`   [DRY RUN] Would save: ${data.puzzleId} - ${data.modelName}`);
    return true;
  }

  try {
    await repositoryService.explanations.saveExplanation(data);
    return true;
  } catch (error) {
    console.error(`   ❌ Failed to save: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Extract attempt data from logs
 */
async function extractAttemptData(
  attemptNumber: number,
  attemptGrids: number[][][],
  timestamp: string,
  taskId: string,
  testIndex: number,
  logsDirectory: string,
  config: BeeTreeIngestionConfig
): Promise<BeeTreeAttemptData> {
  // Read step_finish log to get picked solutions
  const stepFinishPath = join(logsDirectory, `${timestamp}_${taskId}_${testIndex}_step_finish.json`);

  if (!existsSync(stepFinishPath)) {
    throw new Error(`step_finish log not found: ${stepFinishPath}`);
  }

  const stepFinish: BeeTreeStepFinish = await readStepFinishLog(stepFinishPath);

  // Get the picked solution for this attempt
  const pickedSolution = stepFinish.picked_solutions[attemptNumber - 1];

  if (!pickedSolution) {
    throw new Error(`No picked solution for attempt ${attemptNumber}`);
  }

  // Get all contributing runs
  const contributingRuns = await getContributingRuns(pickedSolution, logsDirectory, timestamp, taskId, testIndex);

  if (contributingRuns.length === 0) {
    throw new Error(`No contributing runs found for attempt ${attemptNumber}`);
  }

  // Aggregate costs and tokens
  const stats = aggregateRunStats(contributingRuns);

  // Extract explanation from winning model's response
  const responses = contributingRuns
    .filter(run => run.full_response && run.full_response.length > 0)
    .map(run => run.full_response);

  if (responses.length === 0) {
    throw new Error(`No LLM responses found in logs for attempt ${attemptNumber}`);
  }

  const extracted = extractExplanationsWithFallback(responses, config.verbose);

  return {
    grids: attemptGrids,
    contributing_runs: contributingRuns,
    total_input_tokens: stats.total_input_tokens,
    total_output_tokens: stats.total_output_tokens,
    total_tokens: stats.total_tokens,
    estimated_cost: stats.estimated_cost,
    pattern_description: cleanTextForStorage(extracted.pattern_description),
    solving_strategy: cleanTextForStorage(extracted.solving_strategy),
    reasoning_log: cleanTextForStorage(extracted.full_response),
    vote_count: pickedSolution.count,
    total_runs: contributingRuns.length,
    agreement_rate: contributingRuns.length > 0 ? pickedSolution.count / contributingRuns.length : 0
  };
}

/**
 * Process a single puzzle
 */
async function processPuzzle(
  puzzleId: string,
  submission: BeeTreeSubmission,
  timestamp: string,
  config: BeeTreeIngestionConfig,
  progress: BeeTreeIngestionProgress
): Promise<BeeTreePuzzleResult> {
  progress.total++;

  if (config.verbose) {
    console.log(`\n📝 Processing: ${puzzleId}`);
  }

  // Check if we should resume
  if (config.resumeFrom && puzzleId < config.resumeFrom) {
    if (config.verbose) {
      console.log(`   ⏩ Skipping (before resume point)`);
    }
    return {
      puzzleId,
      status: 'skipped',
      attempts_processed: 0
    };
  }

  // Load puzzle data
  let puzzleData;
  try {
    puzzleData = await puzzleLoader.loadPuzzle(puzzleId);
  } catch (error) {
    progress.notFoundErrors++;
    console.error(`   ❌ Puzzle not found in local dataset`);
    return {
      puzzleId,
      status: 'not_found',
      error: `Puzzle not found in local dataset`,
      attempts_processed: 0
    };
  }

  if (!puzzleData) {
    progress.notFoundErrors++;
    console.error(`   ❌ Puzzle data is null`);
    return {
      puzzleId,
      status: 'not_found',
      error: 'Puzzle data is null',
      attempts_processed: 0
    };
  }

  // Get test entries from submission
  const testEntries = submission[puzzleId];
  if (!testEntries || testEntries.length === 0) {
    progress.validationErrors++;
    console.error(`   ❌ No test entries in submission`);
    return {
      puzzleId,
      status: 'validation_error',
      error: 'No test entries in submission',
      attempts_processed: 0
    };
  }

  const numTestCases = testEntries.length;
  const isMultiTest = numTestCases > 1;

  if (config.verbose) {
    console.log(`   ${numTestCases} test case(s), creating 2 database entries`);
  }

  // Aggregate by attempt number
  const attempt1Grids: number[][][] = testEntries.map(t => t.attempt_1);
  const attempt2Grids: number[][][] = testEntries.map(t => t.attempt_2);

  // Validate grids
  for (let i = 0; i < numTestCases; i++) {
    if (!validateGrid(attempt1Grids[i])) {
      progress.validationErrors++;
      console.error(`   ❌ Invalid attempt_1 grid for test ${i + 1}`);
      return {
        puzzleId,
        status: 'validation_error',
        error: `Invalid attempt_1 grid for test ${i + 1}`,
        attempts_processed: 0
      };
    }
    if (!validateGrid(attempt2Grids[i])) {
      progress.validationErrors++;
      console.error(`   ❌ Invalid attempt_2 grid for test ${i + 1}`);
      return {
        puzzleId,
        status: 'validation_error',
        error: `Invalid attempt_2 grid for test ${i + 1}`,
        attempts_processed: 0
      };
    }
  }

  const expectedOutputs = puzzleData.test.map(t => t.output);

  // Process both attempts
  let attemptsProcessed = 0;

  for (const attemptNumber of [1, 2]) {
    const grids = attemptNumber === 1 ? attempt1Grids : attempt2Grids;
    const modelName = buildModelName(config, attemptNumber);

    // Check for duplicates
    if (config.skipDuplicates || config.onlyMissing) {
      const isDuplicate = await checkDuplicate(puzzleId, modelName);
      if (isDuplicate) {
        progress.skipped++;
        if (config.verbose) {
          console.log(`   ⚠️  Attempt ${attemptNumber} - Skipped (duplicate exists for ${modelName})`);
        }
        continue;
      }
    } else if (config.forceOverwrite) {
      await deleteDuplicate(puzzleId, modelName);
    }

    // Extract attempt data from logs (for first test case)
    let attemptData: BeeTreeAttemptData;
    try {
      attemptData = await extractAttemptData(
        attemptNumber,
        grids,
        timestamp,
        puzzleId,
        1, // Use first test case for logs
        config.logsDirectory,
        config
      );
    } catch (error) {
      progress.validationErrors++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`   ❌ Attempt ${attemptNumber} - Failed to extract data: ${errorMsg}`);

      if (config.stopOnError) {
        throw error;
      }

      continue;
    }

    // Validate predictions
    let validationResult;
    if (isMultiTest) {
      const multiResponse: any = {
        multiplePredictedOutputs: grids
      };
      for (let i = 0; i < grids.length; i++) {
        multiResponse[`predictedOutput${i + 1}`] = grids[i];
      }

      validationResult = validateSolverResponseMulti(
        multiResponse,
        expectedOutputs,
        'external-beetree',
        null
      );
    } else {
      validationResult = validateSolverResponse(
        { predictedOutput: grids[0] },
        expectedOutputs[0],
        'external-beetree',
        null
      );
    }

    // Build ensemble metadata
    const stepFinishPath = join(config.logsDirectory, `${timestamp}_${puzzleId}_1_step_finish.json`);
    const stepFinish: BeeTreeStepFinish = await readStepFinishLog(stepFinishPath);
    const pickedSolution = stepFinish.picked_solutions[attemptNumber - 1];
    const ensembleMetadata = buildEnsembleMetadata(
      stepFinish.candidates_object,
      pickedSolution,
      attemptData.contributing_runs
    );

    // Build enriched data object
    const enrichedData: any = {
      puzzleId,
      modelName,
      patternDescription: attemptData.pattern_description,
      solvingStrategy: attemptData.solving_strategy,
      reasoningLog: attemptData.reasoning_log,
      hints: [],
      confidence: null, // Do NOT synthesize from vote counts
      inputTokens: attemptData.total_input_tokens,
      outputTokens: attemptData.total_output_tokens,
      totalTokens: attemptData.total_tokens,
      estimatedCost: attemptData.estimated_cost,
      promptTemplateId: 'external-beetree',
      providerRawResponse: ensembleMetadata
    };

    // Add prediction fields
    if (isMultiTest) {
      enrichedData.hasMultiplePredictions = true;
      enrichedData.multiplePredictedOutputs = grids;
      enrichedData.multiTestPredictionGrids = grids;
      if ('multiTestResults' in validationResult) {
        enrichedData.multiTestResults = validationResult.multiTestResults;
        enrichedData.multiTestAllCorrect = validationResult.multiTestAllCorrect;
        enrichedData.multiTestAverageAccuracy = validationResult.multiTestAverageAccuracy;
      }
      enrichedData.predictedOutputGrid = grids[0]; // First test for convenience
      if ('multiTestResults' in validationResult) {
        enrichedData.isPredictionCorrect = validationResult.multiTestResults[0]?.isPredictionCorrect ?? false;
      }
    } else {
      enrichedData.predictedOutputGrid = grids[0];
      if ('isPredictionCorrect' in validationResult) {
        enrichedData.isPredictionCorrect = validationResult.isPredictionCorrect;
      }
      enrichedData.hasMultiplePredictions = false;
    }

    // Save to database
    const saved = await saveToDatabase(enrichedData, config);

    if (saved) {
      attemptsProcessed++;
      progress.successful++;

      const correctnessStatus = determineCorrectness({
        modelName: enrichedData.modelName,
        multiTestAllCorrect: enrichedData.multiTestAllCorrect,
        isPredictionCorrect: enrichedData.isPredictionCorrect,
        hasMultiplePredictions: enrichedData.hasMultiplePredictions
      });

      if (config.verbose) {
        const statusIcon = correctnessStatus.isCorrect ? '✅' : '❌';
        console.log(`   ${statusIcon} Attempt ${attemptNumber} - Saved (${correctnessStatus.label})`);
      }
    } else {
      progress.failed++;
    }
  }

  return {
    puzzleId,
    status: attemptsProcessed > 0 ? 'success' : 'failed',
    attempts_processed: attemptsProcessed
  };
}

/**
 * Main ingestion function
 */
async function main() {
  console.log('🚀 BeeTree Results Ingestion Script\n');

  const config = parseArguments();

  console.log('Configuration:');
  console.log(`  Submission file: ${config.submissionFile}`);
  console.log(`  Logs directory: ${config.logsDirectory}`);
  console.log(`  Dataset name: ${config.datasetName}`);
  if (config.label) console.log(`  Label: ${config.label}`);
  if (config.source) console.log(`  Source: ${config.source}`);
  if (config.limit) console.log(`  Limit: ${config.limit}`);
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Verbose: ${config.verbose}`);
  console.log(`  Skip duplicates: ${config.skipDuplicates}`);
  console.log(`  Force overwrite: ${config.forceOverwrite}`);
  console.log();

  // Initialize database
  if (!config.dryRun) {
    console.log('Initializing database...');
    await repositoryService.initialize();
    console.log('✓ Database initialized\n');
  }

  // Initialize puzzle loader
  console.log('Initializing puzzle loader...');
  await puzzleLoader.initialize();
  console.log(`✓ Puzzle loader initialized (source: ${config.source || 'all'})\n`);

  // Load submission file
  console.log('Loading submission file...');
  const submission = await loadSubmissionFile(config.submissionFile);
  const puzzleIds = Object.keys(submission);
  console.log(`✓ Loaded ${puzzleIds.length} puzzles from submission\n`);

  // Extract timestamp from submission filename
  const timestamp = extractTimestamp(basename(config.submissionFile)) || 'unknown';
  console.log(`Detected timestamp: ${timestamp}\n`);

  // Index log directory
  console.log('Indexing log directory...');
  const logIndex = await indexLogDirectory(config.logsDirectory);
  console.log(`✓ Indexed ${logIndex.size} log file sets\n`);

  // Apply limit
  const puzzlesToProcess = config.limit ? puzzleIds.slice(0, config.limit) : puzzleIds;

  console.log(`Processing ${puzzlesToProcess.length} puzzle(s)...\n`);
  console.log('─'.repeat(80));

  const progress: BeeTreeIngestionProgress = {
    total: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    validationErrors: 0,
    notFoundErrors: 0
  };

  // Process puzzles
  for (const puzzleId of puzzlesToProcess) {
    try {
      await processPuzzle(puzzleId, submission, timestamp, config, progress);
    } catch (error) {
      progress.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ ${puzzleId} - Fatal error: ${errorMsg}`);

      if (config.stopOnError) {
        console.error('\nStopping due to error (--stop-on-error)');
        break;
      }
    }
  }

  // Print summary
  console.log('\n' + '─'.repeat(80));
  console.log('\n📊 Ingestion Summary\n');
  console.log(`Total puzzles: ${progress.total}`);
  console.log(`✅ Successful: ${progress.successful}`);
  console.log(`⏭️  Skipped: ${progress.skipped}`);
  console.log(`❌ Failed: ${progress.failed}`);
  console.log(`⚠️  Validation errors: ${progress.validationErrors}`);
  console.log(`🔍 Not found errors: ${progress.notFoundErrors}`);
  console.log();

  if (config.dryRun) {
    console.log('✓ Dry run completed successfully (no data written to database)');
  } else {
    console.log('✓ Ingestion completed');
  }
}

// Run main function
main().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
