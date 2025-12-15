/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-15
 * PURPOSE: Ingests Johan_Land_Solver_V6 evaluation results from beetreeARC/logs/submissions/
 *          into the explanations database. Handles local JSON files with comprehensive
 *          metadata, reasoning summaries, and cost/token tracking.
 * SRP/DRY check: Pass - Single responsibility (Johan_Land ingestion), reuses validation
 *                and repository services. Follows HuggingFace pattern.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { PuzzleLoader } from '../services/puzzleLoader.ts';
import { validateSolverResponse, validateSolverResponseMulti } from '../services/responseValidator.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';
import { determineCorrectness } from '../../shared/utils/correctness.ts';

import type {
  JohanLandIngestionConfig,
  JohanLandIngestionProgress,
  JohanLandPuzzleData,
  JohanLandAttempt,
  JohanLandEnrichedAttempt
} from '../types/johanland.ts';

import {
  validateJohanLandSubmissionOrThrow,
  validateGrid,
  gridsAreIdentical
} from '../utils/johanlandValidator.ts';

import {
  parseReasoningSummary,
  isReasoningSummaryMeaningful
} from '../utils/johanlandExplanationExtractor.ts';

// Load environment
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize services
const puzzleLoader = new PuzzleLoader();

/**
 * Parse CLI arguments into configuration
 */
function parseArguments(): JohanLandIngestionConfig {
  const args = process.argv.slice(2);

  const config: JohanLandIngestionConfig = {
    submissionsDirectory: '',
    datasetName: 'Johan_Land_Solver_V6',
    label: undefined,
    source: undefined,
    limit: undefined,
    dryRun: false,
    verbose: false,
    forceOverwrite: false,
    skipDuplicates: true,
    stopOnError: false,
    resumeFrom: undefined
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--submissions-directory':
        config.submissionsDirectory = nextArg;
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
      case '--help':
        printUsage();
        process.exit(0);
        break;
    }
  }

  if (!config.submissionsDirectory) {
    console.error('Error: --submissions-directory is required');
    printUsage();
    process.exit(1);
  }

  return config;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
Johan_Land_Solver_V6 Ingestion Script

Usage: npm run ingest-johanland -- [options]

Options:
  --submissions-directory <path>  Path to submissions directory (required)
  --dataset-name <name>           Dataset name (default: Johan_Land_Solver_V6)
  --label <label>                 Optional label suffix
  --source <source>               ARC source (ARC1, ARC2, ARC2-Eval, etc.)
  --limit <n>                     Process first N puzzles
  --dry-run                       Preview without database writes
  --verbose                       Enable detailed logging
  --force-overwrite               Overwrite existing entries
  --skip-duplicates               Skip existing entries (default)
  --stop-on-error                 Stop on first error
  --resume-from <puzzle-id>       Resume from specific puzzle
  --help                          Show this message

Example:
  npm run ingest-johanland -- \\
    --submissions-directory beetreeARC/logs/submissions \\
    --limit 5 \\
    --dry-run \\
    --verbose
`);
}

/**
 * Build model name from config and attempt number
 */
function buildModelName(config: JohanLandIngestionConfig, attemptNumber: number): string {
  let name = config.datasetName;
  if (config.label) {
    name += `-${config.label}`;
  }
  name += `-attempt${attemptNumber}`;
  return name;
}

/**
 * Calculate processing time in milliseconds
 */
function calculateProcessingTime(startTimestamp: string, endTimestamp: string): number {
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();
  return end - start;
}

/**
 * Load puzzle submission from local JSON file
 */
async function loadPuzzleSubmission(
  puzzleId: string,
  submissionsDir: string
): Promise<JohanLandPuzzleData[] | null> {
  const filePath = join(submissionsDir, `${puzzleId}.json`);

  if (!existsSync(filePath)) {
    return null;
  }

  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  return validateJohanLandSubmissionOrThrow(data, puzzleId);
}

/**
 * Check if an explanation already exists in the database
 */
async function checkDuplicate(puzzleId: string, modelName: string): Promise<boolean> {
  try {
    const existing = await repositoryService.explanations.getByPuzzleAndModel(puzzleId, modelName);
    return !!existing;
  } catch {
    return false;
  }
}

/**
 * Delete an existing explanation
 */
async function deleteDuplicate(puzzleId: string, modelName: string): Promise<void> {
  try {
    await repositoryService.explanations.deleteByPuzzleAndModel(puzzleId, modelName);
  } catch {
    // Ignore errors if not found
  }
}

/**
 * Validate and enrich a single attempt for database insertion
 */
async function validateAndEnrichAttempt(
  attempt: JohanLandAttempt,
  attemptNumber: number,
  puzzleData: any,
  config: JohanLandIngestionConfig
): Promise<JohanLandEnrichedAttempt | null> {
  const metadata = attempt.metadata;
  const modelName = buildModelName(config, attemptNumber);

  // Parse reasoning summary
  const extracted = parseReasoningSummary(metadata.reasoning_summary);

  // Validate prediction
  const testData = puzzleData.test[metadata.pair_index];
  if (!testData) {
    console.warn(`Puzzle ${metadata.task_id}: test case ${metadata.pair_index} not found`);
    return null;
  }

  const validationResult = validateSolverResponse(
    { predictedOutput: attempt.answer },
    testData.output,
    'external-johan-land',
    null
  );

  // Calculate processing time
  const processingTimeMs = calculateProcessingTime(
    metadata.start_timestamp,
    metadata.end_timestamp
  );

  // Build enriched data
  const enrichedData: JohanLandEnrichedAttempt = {
    puzzleId: metadata.task_id,
    modelName,

    // Explanations
    patternDescription: extracted.pattern_description || null,
    solvingStrategy: extracted.solving_strategy || null,
    reasoningLog: extracted.full_reasoning,
    hints: [],
    confidence: null,

    // Tokens
    inputTokens: metadata.usage.prompt_tokens,
    outputTokens: metadata.usage.completion_tokens,
    reasoningTokens: metadata.usage.completion_tokens_details?.reasoning_tokens || 0,
    totalTokens: metadata.usage.total_tokens,

    // Cost
    estimatedCost: metadata.cost.total_cost,

    // Timing
    apiProcessingTimeMs: processingTimeMs,

    // Prediction
    predictedOutputGrid: attempt.answer,
    isPredictionCorrect: validationResult.isPredictionCorrect,
    predictionAccuracyScore: validationResult.predictionAccuracyScore,

    // Multi-test (future enhancement)
    hasMultiplePredictions: false,

    // Prompt tracking
    systemPromptUsed: null,
    userPromptUsed: null,
    promptTemplateId: 'external-johan-land',
    customPromptText: null,

    // Raw data preservation
    providerRawResponse: metadata,

    // AI params
    temperature: null,
    reasoningEffort: metadata.kwargs?.reasoning?.effort || null,
    reasoningVerbosity: null,
    reasoningSummaryType: null
  };

  return enrichedData;
}

/**
 * Save enriched attempt to database
 */
async function saveToDatabaseIfNotDryRun(
  enrichedData: JohanLandEnrichedAttempt,
  config: JohanLandIngestionConfig
): Promise<boolean> {
  if (config.dryRun) {
    if (config.verbose) {
      console.log(`[DRY RUN] Would save: ${enrichedData.puzzleId} / ${enrichedData.modelName}`);
    }
    return true;
  }

  try {
    const response = await repositoryService.explanations.saveExplanation({
      puzzleId: enrichedData.puzzleId,
      modelName: enrichedData.modelName,
      patternDescription: enrichedData.patternDescription,
      solvingStrategy: enrichedData.solvingStrategy,
      reasoningLog: enrichedData.reasoningLog,
      hints: enrichedData.hints,
      confidence: enrichedData.confidence,
      inputTokens: enrichedData.inputTokens,
      outputTokens: enrichedData.outputTokens,
      reasoningTokens: enrichedData.reasoningTokens,
      totalTokens: enrichedData.totalTokens,
      estimatedCost: enrichedData.estimatedCost,
      apiProcessingTimeMs: enrichedData.apiProcessingTimeMs,
      predictedOutputGrid: enrichedData.predictedOutputGrid,
      isPredictionCorrect: enrichedData.isPredictionCorrect,
      predictionAccuracyScore: enrichedData.predictionAccuracyScore,
      hasMultiplePredictions: enrichedData.hasMultiplePredictions,
      promptTemplateId: enrichedData.promptTemplateId,
      providerRawResponse: enrichedData.providerRawResponse,
      reasoningEffort: enrichedData.reasoningEffort
    });

    if (config.verbose) {
      console.log(`Saved: ${enrichedData.puzzleId} / ${enrichedData.modelName} (ID: ${response.id})`);
    }

    return !!response;
  } catch (error: any) {
    console.error(
      `Failed to save ${enrichedData.puzzleId} / ${enrichedData.modelName}: ${error.message}`
    );
    return false;
  }
}

/**
 * Process a single puzzle (both attempts)
 */
async function processPuzzle(
  puzzleId: string,
  config: JohanLandIngestionConfig,
  progress: JohanLandIngestionProgress
): Promise<void> {
  progress.currentPuzzle = puzzleId;

  // Load submission
  let submission: JohanLandPuzzleData[] | null;
  try {
    submission = await loadPuzzleSubmission(puzzleId, config.submissionsDirectory);
  } catch (error: any) {
    if (config.verbose) {
      console.warn(`Failed to load ${puzzleId}: ${error.message}`);
    }
    progress.validationErrors++;
    if (config.stopOnError) throw error;
    return;
  }

  if (!submission) {
    if (config.verbose) {
      console.warn(`File not found: ${puzzleId}.json`);
    }
    progress.notFoundErrors++;
    if (config.stopOnError) {
      throw new Error(`File not found: ${puzzleId}.json`);
    }
    return;
  }

  // Load puzzle data for validation
  let puzzleData: any;
  try {
    puzzleData = await puzzleLoader.loadPuzzle(puzzleId);
  } catch (error: any) {
    if (config.verbose) {
      console.warn(`Failed to load puzzle data for ${puzzleId}: ${error.message}`);
    }
    progress.notFoundErrors++;
    if (config.stopOnError) throw error;
    return;
  }

  if (!puzzleData) {
    if (config.verbose) {
      console.warn(`Puzzle data not found for ${puzzleId}`);
    }
    progress.notFoundErrors++;
    if (config.stopOnError) {
      throw new Error(`Puzzle data not found for ${puzzleId}`);
    }
    return;
  }

  // Process each attempt
  for (const attemptNumber of [1, 2]) {
    const attemptKey = `attempt_${attemptNumber}` as const;
    const attempt = submission[0][attemptKey];

    if (!attempt) {
      if (config.verbose) {
        console.log(`No ${attemptKey} for ${puzzleId}`);
      }
      continue;
    }

    const modelName = buildModelName(config, attemptNumber);

    // Check for duplicates
    if (config.skipDuplicates) {
      const isDuplicate = await checkDuplicate(puzzleId, modelName);
      if (isDuplicate) {
        progress.skipped++;
        if (config.verbose) {
          console.log(`Skipped (exists): ${puzzleId} / ${modelName}`);
        }
        continue;
      }
    } else if (config.forceOverwrite) {
      await deleteDuplicate(puzzleId, modelName);
    }

    // Validate and enrich
    let enrichedData: JohanLandEnrichedAttempt | null;
    try {
      enrichedData = await validateAndEnrichAttempt(attempt, attemptNumber, puzzleData, config);
    } catch (error: any) {
      if (config.verbose) {
        console.warn(`Validation failed for ${puzzleId}/${attemptKey}: ${error.message}`);
      }
      progress.validationErrors++;
      if (config.stopOnError) throw error;
      continue;
    }

    if (!enrichedData) {
      progress.failed++;
      if (config.stopOnError) {
        throw new Error(`Failed to enrich ${puzzleId}/${attemptKey}`);
      }
      continue;
    }

    // Save to database
    const saved = await saveToDatabaseIfNotDryRun(enrichedData, config);

    if (saved) {
      progress.successful++;
      progress.successDetails.push({
        puzzleId: enrichedData.puzzleId,
        isCorrect: enrichedData.isPredictionCorrect,
        accuracy: enrichedData.predictionAccuracyScore
      });
    } else {
      progress.failed++;
      if (config.stopOnError) {
        throw new Error(`Failed to save ${puzzleId}/${attemptKey}`);
      }
    }
  }
}

/**
 * Print summary report
 */
function printSummary(progress: JohanLandIngestionProgress, config: JohanLandIngestionConfig): void {
  console.log('\n' + '='.repeat(80));
  console.log('INGESTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total puzzles:       ${progress.total}`);
  console.log(`Successful:          ${progress.successful}`);
  console.log(`Failed:              ${progress.failed}`);
  console.log(`Skipped (exists):    ${progress.skipped}`);
  console.log(`Validation errors:   ${progress.validationErrors}`);
  console.log(`Not found:           ${progress.notFoundErrors}`);
  console.log('');
  console.log(`Success rate:        ${progress.successful}/${progress.total} ` +
    `(${((progress.successful / progress.total) * 100).toFixed(2)}%)`);

  if (config.dryRun) {
    console.log('\n[DRY RUN MODE] - No database writes were made');
  }

  console.log('='.repeat(80) + '\n');
}

/**
 * Main ingestion function
 */
async function main(): Promise<void> {
  const config = parseArguments();

  console.log(`\nJohan_Land_Solver_V6 Ingestion Script`);
  console.log(`Starting ingestion from: ${config.submissionsDirectory}`);
  if (config.dryRun) {
    console.log('MODE: DRY RUN (no database writes)');
  }
  console.log('');

  // Initialize services
  await repositoryService.initialize();
  await puzzleLoader.initialize();

  // Get list of puzzles
  const submissionFiles = await readdir(config.submissionsDirectory);
  let puzzleIds = submissionFiles
    .filter((f) => f.endsWith('.json') && f !== 'results.json')
    .map((f) => f.replace('.json', ''))
    .sort();

  // Apply limit
  if (config.limit) {
    puzzleIds = puzzleIds.slice(0, config.limit);
  }

  // Apply resume
  if (config.resumeFrom) {
    const resumeIndex = puzzleIds.indexOf(config.resumeFrom);
    if (resumeIndex >= 0) {
      puzzleIds = puzzleIds.slice(resumeIndex);
    }
  }

  const progress: JohanLandIngestionProgress = {
    total: puzzleIds.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    validationErrors: 0,
    notFoundErrors: 0,
    currentPuzzle: '',
    successDetails: []
  };

  // Process each puzzle
  for (let i = 0; i < puzzleIds.length; i++) {
    const puzzleId = puzzleIds[i];
    const progress_pct = (((i + 1) / puzzleIds.length) * 100).toFixed(1);

    try {
      await processPuzzle(puzzleId, config, progress);

      if (config.verbose || i % 10 === 0) {
        console.log(`[${progress_pct}%] Processed: ${puzzleId}`);
      }
    } catch (error: any) {
      console.error(`Fatal error processing ${puzzleId}: ${error.message}`);
      if (config.stopOnError) {
        throw error;
      }
    }
  }

  // Print summary
  printSummary(progress, config);
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
