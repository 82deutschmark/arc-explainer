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
    resumeFrom: undefined,
    compareDb: false,
    compareDbDataset: 'evaluation2'
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
      case '--compare-db':
        config.compareDb = true;
        break;
      case '--compare-db-dataset':
        config.compareDbDataset = nextArg;
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
  --compare-db                    After ingestion, query DB and print UI-style union score for attempt1+attempt2
  --compare-db-dataset <name>     Dataset key for DB comparison (default: evaluation2)
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

function gridsEqual(a: number[][] | null, b: number[][] | null): boolean {
  if (!a || !b) return false;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let r = 0; r < a.length; r++) {
    const rowA = a[r];
    const rowB = b[r];

    if (!Array.isArray(rowA) || !Array.isArray(rowB)) return false;
    if (rowA.length !== rowB.length) return false;

    for (let c = 0; c < rowA.length; c++) {
      if (rowA[c] !== rowB[c]) return false;
    }
  }

  return true;
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

  // NOTE: Johan_Land attempt.correct is treated as UNTRUSTED. Correctness is recomputed in processPuzzle
  // and stored via the multi-test fields. This helper is kept for backward compatibility only.
  let predictedOutputGrid: number[][] | null = attempt.answer;
  let isPredictionCorrect: boolean | null = null;
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
): Promise<number | null> {
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
    return null;
  }

  if (!submission) {
    if (config.verbose) {
      console.warn(`File not found: ${puzzleId}.json`);
    }
    progress.notFoundErrors++;
    if (config.stopOnError) {
      throw new Error(`File not found: ${puzzleId}.json`);
    }
    return null;
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
    return null;
  }

  if (!puzzleData) {
    if (config.verbose) {
      console.warn(`Puzzle data not found for ${puzzleId}`);
    }
    progress.notFoundErrors++;
    if (config.stopOnError) {
      throw new Error(`Puzzle data not found for ${puzzleId}`);
    }
    return null;
  }

  const testCases = Array.isArray(puzzleData?.test) ? puzzleData.test : [];
  if (testCases.length === 0) {
    progress.validationErrors++;
    if (config.stopOnError) {
      throw new Error(`Puzzle ${puzzleId}: no test cases found`);
    }
    return null;
  }

  // CRITICAL: We store ONE row per puzzle per attempt number.
  // The row uses the multi-test fields to represent all test pairs.
  // This matches how HuggingFace ingestion stores multi-test and prevents duplicate skipping from dropping pairs.
  type AttemptAggregate = {
    modelName: string;
    predictedGrids: Array<number[][] | null>;
    multiTestResults: Array<{ index: number; isPredictionCorrect: boolean }>;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalReasoningTokens: number;
    totalTokens: number;
    totalCost: number;
    totalProcessingTimeMs: number;
    reasoningSummary: string | null;
    providerRawResponse: JohanLandAttempt['metadata'][];
  };

  const aggregates = new Map<number, AttemptAggregate>();
  for (const attemptNumber of [1, 2]) {
    aggregates.set(attemptNumber, {
      modelName: buildModelName(config, attemptNumber),
      predictedGrids: Array.from({ length: testCases.length }, () => null),
      multiTestResults: Array.from({ length: testCases.length }, (_, index) => ({
        index,
        isPredictionCorrect: false,
      })),
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalReasoningTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      totalProcessingTimeMs: 0,
      reasoningSummary: null,
      providerRawResponse: [],
    });
  }

  // Fill aggregates from submission entries
  for (let enumPairIndex = 0; enumPairIndex < submission.length; enumPairIndex++) {
    const pairData = submission[enumPairIndex];
    if (!pairData) continue;

    for (const attemptNumber of [1, 2]) {
      const attemptKey = `attempt_${attemptNumber}` as const;
      const attempt = pairData[attemptKey];
      if (!attempt) continue;

      const meta = attempt.metadata;
      const agg = aggregates.get(attemptNumber);
      if (!agg) continue;

      // Harness behavior: prefer metadata.pair_index when valid, else fall back to enum index
      let pairIndex: number | null = null;
      if (typeof meta?.pair_index === 'number' && meta.pair_index >= 0 && meta.pair_index < testCases.length) {
        pairIndex = meta.pair_index;
      } else if (enumPairIndex >= 0 && enumPairIndex < testCases.length) {
        pairIndex = enumPairIndex;
      }

      if (pairIndex === null) {
        continue;
      }

      const predictedGrid = Array.isArray(attempt.answer) ? attempt.answer : null;
      agg.predictedGrids[pairIndex] = predictedGrid;

      const expectedGrid = testCases[pairIndex]?.output ?? null;
      const isCorrect = gridsEqual(predictedGrid, expectedGrid);
      agg.multiTestResults[pairIndex] = { index: pairIndex, isPredictionCorrect: isCorrect };

      agg.providerRawResponse.push(meta);

      // Aggregate tokens/cost/time (sum across pairs like HF ingest does)
      agg.totalInputTokens += meta?.usage?.prompt_tokens || 0;
      agg.totalOutputTokens += meta?.usage?.completion_tokens || 0;
      agg.totalReasoningTokens += meta?.usage?.completion_tokens_details?.reasoning_tokens || 0;
      agg.totalTokens += meta?.usage?.total_tokens || 0;
      agg.totalCost += meta?.cost?.total_cost || 0;
      agg.totalProcessingTimeMs += calculateProcessingTime(meta.start_timestamp, meta.end_timestamp);

      if (!agg.reasoningSummary && typeof meta?.reasoning_summary === 'string' && meta.reasoning_summary.trim().length > 0) {
        agg.reasoningSummary = meta.reasoning_summary;
      }
    }
  }

  // Harness-style score for this task: solved_pairs / num_pairs, where a pair is solved if ANY attempt is correct.
  // This computation is independent of DB writes.
  const attempt1 = aggregates.get(1);
  const attempt2 = aggregates.get(2);
  let solvedPairs = 0;
  const numPairs = testCases.length;
  for (let i = 0; i < numPairs; i++) {
    const a1 = attempt1?.multiTestResults[i]?.isPredictionCorrect === true;
    const a2 = attempt2?.multiTestResults[i]?.isPredictionCorrect === true;
    if (a1 || a2) {
      solvedPairs++;
    }
  }
  const taskScore = numPairs > 0 ? solvedPairs / numPairs : 0;

  // Delete existing records ONCE per puzzle per model (before saving)
  if (config.forceOverwrite && !config.dryRun) {
    try {
      const existing = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
      for (const attemptNumber of [1, 2]) {
        const modelName = aggregates.get(attemptNumber)?.modelName;
        if (!modelName) continue;

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

  for (const attemptNumber of [1, 2]) {
    const agg = aggregates.get(attemptNumber);
    if (!agg) continue;

    if (config.skipDuplicates) {
      const isDuplicate = await checkDuplicate(puzzleId, agg.modelName);
      if (isDuplicate) {
        progress.skipped++;
        if (config.verbose) {
          console.log(`Skipped (exists): ${puzzleId} / ${agg.modelName}`);
        }
        continue;
      }
    }

    const extracted = parseReasoningSummary(agg.reasoningSummary || '');

    const correctCount = agg.multiTestResults.filter(r => r.isPredictionCorrect === true).length;
    const totalPairs = agg.multiTestResults.length;
    const multiTestAllCorrect = totalPairs > 0 ? correctCount === totalPairs : false;
    const multiTestAverageAccuracy = totalPairs > 0 ? correctCount / totalPairs : 0;

    const enrichedData: JohanLandEnrichedAttempt = {
      puzzleId,
      modelName: agg.modelName,

      patternDescription: extracted.pattern_description || 'Pattern description extracted from reasoning',
      solvingStrategy: extracted.solving_strategy || 'Strategy extracted from reasoning log',
      reasoningLog: extracted.full_reasoning,
      hints: [],
      confidence: 50,

      inputTokens: agg.totalInputTokens,
      outputTokens: agg.totalOutputTokens,
      reasoningTokens: agg.totalReasoningTokens,
      totalTokens: agg.totalTokens,

      estimatedCost: agg.totalCost,
      apiProcessingTimeMs: agg.totalProcessingTimeMs,

      predictedOutputGrid: null,
      isPredictionCorrect: null,

      hasMultiplePredictions: true,
      multiplePredictedOutputs: agg.predictedGrids as any,
      multiTestPredictionGrids: agg.predictedGrids as any,
      multiTestResults: agg.multiTestResults as any,
      multiTestAllCorrect,
      multiTestAverageAccuracy,

      systemPromptUsed: '',
      userPromptUsed: '',
      promptTemplateId: 'external-johan-land',
      customPromptText: '',

      providerRawResponse: agg.providerRawResponse as any,

      temperature: 0,
      reasoningEffort: '',
      reasoningVerbosity: '',
      reasoningSummaryType: '',
    };

    const saved = await saveToDatabaseIfNotDryRun(enrichedData, config);
    if (saved) {
      progress.successful++;
      progress.successDetails.push({
        puzzleId,
        isCorrect: multiTestAllCorrect,
        accuracy: multiTestAverageAccuracy,
      });
    } else {
      progress.failed++;
      if (config.stopOnError) {
        throw new Error(`Failed to save ${puzzleId} / ${agg.modelName}`);
      }
    }
  }

  if (config.verbose) {
    console.log(`  Harness score for ${puzzleId}: ${(taskScore * 100).toFixed(2)}% (${solvedPairs}/${numPairs})`);
  }

  return taskScore;
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
  let harnessScoreSum = 0;
  let harnessTasksCounted = 0;

  for (let i = 0; i < puzzleIds.length; i++) {
    const puzzleId = puzzleIds[i];
    const progress_pct = (((i + 1) / puzzleIds.length) * 100).toFixed(1);

    try {
      const taskScore = await processPuzzle(puzzleId, config, progress);
      if (typeof taskScore === 'number') {
        harnessScoreSum += taskScore;
        harnessTasksCounted++;
      }

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

  if (harnessTasksCounted > 0) {
    const percentageScore = (harnessScoreSum / harnessTasksCounted) * 100;
    console.log(`\nHarness-style Final Score: ${percentageScore.toFixed(2)}% (${harnessScoreSum.toFixed(2)}/${harnessTasksCounted})`);
  }

  if (config.compareDb) {
    const baseModelName = config.label ? `${config.datasetName}-${config.label}` : config.datasetName;
    const model1 = `${baseModelName}-attempt1`;
    const model2 = `${baseModelName}-attempt2`;
    const datasetKey = config.compareDbDataset || 'evaluation2';

    try {
      const comparison = await repositoryService.metrics.getModelComparison([model1, model2], datasetKey);
      const stats = comparison?.summary?.attemptUnionStats?.find(s => s.baseModelName === baseModelName);

      if (stats) {
        console.log(
          `DB/UI Attempt Union Score (${datasetKey}): ${stats.unionAccuracyPercentage.toFixed(2)}% (${stats.unionCorrectCount}/${stats.totalTestPairs})`
        );
      } else {
        console.log(`DB/UI Attempt Union Score (${datasetKey}): not available (no attemptUnionStats for ${baseModelName})`);
      }
    } catch (error: any) {
      console.warn(`DB comparison failed: ${error?.message || String(error)}`);
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
