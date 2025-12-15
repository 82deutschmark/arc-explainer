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
import { repositoryService } from '../repositories/RepositoryService.ts';

import type {
  JohanLandIngestionConfig,
  JohanLandIngestionProgress,
  JohanLandPuzzleData,
  JohanLandAttempt,
  JohanLandEnrichedAttempt
} from '../types/johanland.ts';

import {
  validateJohanLandSubmissionOrThrow
} from '../utils/johanlandValidator.ts';

import {
  parseReasoningSummary
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
    const existing = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
    return existing.some(exp => exp.modelName === modelName);
  } catch {
    return false;
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

  // Validate prediction against all test cases
  const testCases = puzzleData.test || [];
  if (testCases.length === 0) {
    console.warn(`Puzzle ${metadata.task_id}: no test cases found`);
    return null;
  }

  const promptTemplateId = 'external-johan-land';

  // CRITICAL: The attempt object ALREADY has a 'correct' flag computed by Johan_Land during evaluation
  // Use that directly instead of re-validating (which was always returning true)
  let predictedOutputGrid: number[][] | null = attempt.answer;
  let isPredictionCorrect: boolean | null = attempt.correct;
  let multiplePredictedOutputs: number[][][] | null = null;
  let multiTestPredictionGrids: number[][][] | null = null;
  let multiTestResults: any[] | null = null;
  let multiTestAllCorrect: boolean | null = null;
  let multiTestAverageAccuracy: number | null = null;

  // Calculate processing time
  const processingTimeMs = calculateProcessingTime(
    metadata.start_timestamp,
    metadata.end_timestamp
  );

  // Build enriched data
  const enrichedData: JohanLandEnrichedAttempt = {
    puzzleId: metadata.task_id,
    modelName,

    // Explanations (provide fallback values for required fields)
    patternDescription: extracted.pattern_description || 'Pattern description extracted from reasoning',
    solvingStrategy: extracted.solving_strategy || 'Strategy extracted from reasoning log',
    reasoningLog: extracted.full_reasoning,
    hints: [],
    confidence: 50,

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
    predictedOutputGrid,
    isPredictionCorrect,

    // Multi-test support (not used - each attempt validates against single specific pair)
    hasMultiplePredictions: false,
    multiplePredictedOutputs,
    multiTestPredictionGrids,
    multiTestResults,
    multiTestAllCorrect,
    multiTestAverageAccuracy,

    // Prompt tracking
    systemPromptUsed: '',
    userPromptUsed: '',
    promptTemplateId,
    customPromptText: '',

    // Raw data preservation
    providerRawResponse: metadata,

    // AI params
    temperature: 0,
    reasoningEffort: metadata.kwargs?.reasoning?.effort || '',
    reasoningVerbosity: '',
    reasoningSummaryType: ''
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
      hasMultiplePredictions: enrichedData.hasMultiplePredictions,
      multiplePredictedOutputs: enrichedData.multiplePredictedOutputs,
      multiTestPredictionGrids: enrichedData.multiTestPredictionGrids,
      multiTestResults: enrichedData.multiTestResults,
      multiTestAllCorrect: enrichedData.multiTestAllCorrect,
      multiTestAverageAccuracy: enrichedData.multiTestAverageAccuracy,
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
 * Process a single puzzle's multiple test pairs
 *
 * CRITICAL: Understanding the submission structure for ARC-AGI scoring:
 *
 * Submission structure (from 1ae2feb7.json example):
 * [
 *   {  // Test Pair 0
 *     "attempt_1": { "answer": [...], "correct": true, "pair_index": 0, ... },
 *     "attempt_2": { "answer": [...], "correct": true, "pair_index": 0, ... }
 *   },
 *   {  // Test Pair 1
 *     "attempt_1": { "answer": [...], "correct": true, "pair_index": 1, ... },
 *     "attempt_2": { "answer": [...], "correct": true, "pair_index": 1, ... }
 *   },
 *   {  // Test Pair 2
 *     "attempt_1": { "answer": [...], "correct": true, "pair_index": 2, ... },
 *     "attempt_2": { "answer": [...], "correct": false, "pair_index": 2, ... }
 *   }
 * ]
 *
 * Scoring rule (per ARC-AGI official benchmarking repo):
 * - For each test pair: if ANY attempt is correct, the pair is solved (score +1)
 * - Final score = (solved_pairs) / (total_pairs)
 *
 * Example: If pair 0 solved by attempt_1, pair 1 solved by attempt_2, pair 2 not solved:
 * - Pair 0: attempt_1 correct OR attempt_2 correct → solved (+1)
 * - Pair 1: attempt_1 incorrect OR attempt_2 correct → solved (+1)
 * - Pair 2: attempt_1 incorrect OR attempt_2 incorrect → not solved (+0)
 * - Score: 2/3 = 0.67
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

  // CRITICAL: Delete existing records ONCE per puzzle per model (before processing any pairs)
  // This prevents the force-overwrite logic from deleting previous pairs while saving new ones
  const modelsToDelete = new Set<string>();

  // Pre-process to determine which models will be saved
  for (let pairIndex = 0; pairIndex < submission.length; pairIndex++) {
    const pairData = submission[pairIndex];
    if (!pairData) continue;

    for (const attemptNumber of [1, 2]) {
      const attempt = pairData[`attempt_${attemptNumber}` as const];
      if (attempt) {
        modelsToDelete.add(buildModelName(config, attemptNumber));
      }
    }
  }

  // Delete all existing records for these models once, before processing any pairs
  if (config.forceOverwrite && !config.dryRun) {
    try {
      const existing = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
      for (const modelName of modelsToDelete) {
        const matching = existing.filter((exp) => exp.modelName === modelName);
        for (const exp of matching) {
          await repositoryService.explanations.deleteExplanation(exp.id);
        }
      }
    } catch (error: any) {
      if (config.verbose) {
        console.warn(`Force overwrite delete failed for ${puzzleId}: ${error?.message || String(error)}`);
      }
    }
  }

  // CORRECTED: Loop through submission array, where each element = one test pair
  for (let pairIndex = 0; pairIndex < submission.length; pairIndex++) {
    const pairData = submission[pairIndex];

    if (!pairData) {
      if (config.verbose) {
        console.log(`No data for pair ${pairIndex} in ${puzzleId}`);
      }
      continue;
    }

    // For this pair, check both attempts
    let pairIsSolved = false;
    const attemptResults: { attemptNumber: number; correct: boolean; enrichedData: JohanLandEnrichedAttempt | null }[] = [];

    for (const attemptNumber of [1, 2]) {
      const attemptKey = `attempt_${attemptNumber}` as const;
      const attempt = pairData[attemptKey];

      if (!attempt) {
        if (config.verbose) {
          console.log(`No ${attemptKey} for ${puzzleId} pair ${pairIndex}`);
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
            console.log(`Skipped (exists): ${puzzleId} / pair ${pairIndex} / ${modelName}`);
          }
          continue;
        }
      }

      // Validate and enrich
      let enrichedData: JohanLandEnrichedAttempt | null;
      try {
        enrichedData = await validateAndEnrichAttempt(attempt, attemptNumber, puzzleData, config);
      } catch (error: any) {
        if (config.verbose) {
          console.warn(`Validation failed for ${puzzleId} pair ${pairIndex}/${attemptKey}: ${error.message}`);
        }
        progress.validationErrors++;
        if (config.stopOnError) throw error;
        continue;
      }

      if (!enrichedData) {
        progress.failed++;
        if (config.stopOnError) {
          throw new Error(`Failed to enrich ${puzzleId} pair ${pairIndex}/${attemptKey}`);
        }
        continue;
      }

      // Track if this attempt is correct
      const attemptCorrect = enrichedData.isPredictionCorrect ?? enrichedData.multiTestAllCorrect ?? false;
      if (attemptCorrect) {
        pairIsSolved = true;
      }

      attemptResults.push({ attemptNumber, correct: attemptCorrect, enrichedData });
    }

    // Save all enriched attempts for this pair to database
    for (const result of attemptResults) {
      if (!result.enrichedData) continue;

      // Save to database (deletion already happened once per puzzle per model above)
      const saved = await saveToDatabaseIfNotDryRun(result.enrichedData, config);

      if (saved) {
        progress.successful++;
        progress.successDetails.push({
          puzzleId: result.enrichedData.puzzleId,
          isCorrect: result.correct
        });
      } else {
        progress.failed++;
        if (config.stopOnError) {
          throw new Error(`Failed to save ${puzzleId} pair ${pairIndex}/attempt${result.attemptNumber}`);
        }
      }
    }

    // Log pair result (for debugging/tracking)
    if (config.verbose) {
      const status = pairIsSolved ? 'SOLVED' : 'NOT_SOLVED';
      console.log(`  Pair ${pairIndex}: ${status}`);
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

  // Apply resume
  if (config.resumeFrom) {
    const resumeIndex = puzzleIds.indexOf(config.resumeFrom);
    if (resumeIndex >= 0) {
      puzzleIds = puzzleIds.slice(resumeIndex);
    }
  }

  // Apply limit
  if (config.limit) {
    puzzleIds = puzzleIds.slice(0, config.limit);
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
