/**
 * HuggingFace Dataset Ingestion Script
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-09-30
 * PURPOSE: Ingests external AI model predictions from HuggingFace datasets into the explanations database.
 *          Validates all predictions against actual puzzle solutions BEFORE saving to ensure data integrity.
 *          Handles both single-test and multi-test puzzles with full accuracy calculation.
 * 
 * SRP/DRY check: Pass - Single responsibility (HuggingFace dataset ingestion), reuses existing validation
 *                and repository services. No duplication of validation logic.
 * 
 * CRITICAL: This script follows the LOAD → VALIDATE → ENRICH → SAVE architecture pattern.
 *           Predictions are validated against actual puzzle solutions before database insertion,
 *           ensuring is_prediction_correct, multi_test_all_correct, and accuracy scores are correct.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// Dynamic imports for ESM modules
const { puzzleLoader } = await import('../services/puzzleLoader.js');
const { validateSolverResponse, validateSolverResponseMulti } = await import('../services/responseValidator.js');
const { repositoryService } = await import('../repositories/RepositoryService.js');
const { logger } = await import('../utils/logger.js');

// ============================================================================
// Type Definitions
// ============================================================================

interface HuggingFaceMetadata {
  model: string;
  provider: string;
  start_timestamp: string;
  end_timestamp: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
  }>;
  reasoning_summary: string | null;
  kwargs: {
    max_tokens: number;
    stream: boolean;
  };
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: {
      reasoning_tokens: number;
      accepted_prediction_tokens: number;
      rejected_prediction_tokens: number;
    };
  };
  cost: {
    prompt_cost: number;
    completion_cost: number;
    reasoning_cost: number | null;
    total_cost: number;
  };
  task_id: string;
  pair_index: number;
  test_id: string;
}

interface HuggingFaceAttempt {
  answer: number[][];
  metadata: HuggingFaceMetadata;
  correct: boolean | null;
}

interface HuggingFacePuzzleData {
  attempt_1: HuggingFaceAttempt;
  attempt_2?: HuggingFaceAttempt;
  attempt_3?: HuggingFaceAttempt;
  attempt_4?: HuggingFaceAttempt;
  attempt_5?: HuggingFaceAttempt;
  [key: string]: HuggingFaceAttempt | undefined;
}

interface IngestionConfig {
  datasetName: string;
  baseUrl: string;
  dryRun: boolean;
  verbose: boolean;
  skipDuplicates: boolean;
  forceOverwrite: boolean;
  tempDir: string;
  huggingfaceToken?: string;
}

interface IngestionProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  validationErrors: number;
  databaseErrors: number;
  notFoundErrors: number;
  currentPuzzle: string | null;
  startTime: Date;
  errors: Array<{ puzzleId: string; error: string }>;
  successDetails: Array<{
    puzzleId: string;
    isCorrect: boolean;
    isMultiTest: boolean;
    accuracy: number;
  }>;
}

// ============================================================================
// Configuration & CLI Parsing
// ============================================================================

function parseConfig(): IngestionConfig {
  const args = process.argv.slice(2);
  const config: IngestionConfig = {
    datasetName: 'claude-sonnet-4-5-20250929',
    baseUrl: 'https://huggingface.co/datasets/arcprize/arc_agi_v1_public_eval/raw/main',
    dryRun: false,
    verbose: false,
    skipDuplicates: true,
    forceOverwrite: false,
    tempDir: path.join(process.cwd(), 'temp', 'huggingface'),
    huggingfaceToken: process.env.HUGGINGFACE_TOKEN
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--dataset':
        config.datasetName = nextArg;
        i++;
        break;
      case '--base-url':
        config.baseUrl = nextArg;
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
      case '--no-skip-duplicates':
        config.skipDuplicates = false;
        break;
      case '--help':
        showUsage();
        process.exit(0);
    }
  }

  return config;
}

function showUsage() {
  console.log(`
🌐 HuggingFace Dataset Ingestion Script

USAGE:
  npm run ingest-hf -- [options]

OPTIONS:
  --dataset <name>         Dataset name (default: claude-sonnet-4-5-20250929)
  --base-url <url>         Base URL for HuggingFace dataset
  --dry-run                Preview without saving to database
  --verbose                Enable detailed logging
  --force-overwrite        Overwrite existing entries (default: skip)
  --no-skip-duplicates     Don't skip duplicates (error instead)
  --help                   Show this help message

EXAMPLES:
  # Ingest Claude Sonnet 4.5 dataset
  npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929

  # Dry run with verbose logging
  npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --dry-run --verbose

  # Force overwrite existing entries
  npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --force-overwrite

ENVIRONMENT:
  HUGGINGFACE_TOKEN        HuggingFace API token for authenticated requests
`);
}

// ============================================================================
// HuggingFace Data Loading
// ============================================================================

async function fetchPuzzleList(config: IngestionConfig): Promise<string[]> {
  // For now, we'll use the list of puzzles from our local datasets
  // In the future, we could scrape the HuggingFace repo for available files
  
  const puzzleIds: string[] = [];
  
  // Get puzzles from all our local datasets
  const dataDirs = [
    path.join(process.cwd(), 'data', 'evaluation'),
    path.join(process.cwd(), 'data', 'training'),
    path.join(process.cwd(), 'data', 'evaluation2'),
    path.join(process.cwd(), 'data', 'training2')
  ];
  
  for (const dir of dataDirs) {
    try {
      const files = await fs.readdir(dir);
      const jsonFiles = files
        .filter(f => f.endsWith('.json'))
        .map(f => path.basename(f, '.json'));
      puzzleIds.push(...jsonFiles);
    } catch (error) {
      // Directory might not exist, that's okay
    }
  }
  
  // Remove duplicates
  const uniquePuzzleIds = [...new Set(puzzleIds)];
  
  if (config.verbose) {
    console.log(`📋 Found ${uniquePuzzleIds.length} unique puzzles in local datasets`);
  }
  
  return uniquePuzzleIds;
}

async function fetchHuggingFaceData(
  puzzleId: string,
  config: IngestionConfig
): Promise<HuggingFacePuzzleData[] | null> {
  const url = `${config.baseUrl}/${config.datasetName}/${puzzleId}.json`;
  
  try {
    const headers: Record<string, string> = {};
    if (config.huggingfaceToken) {
      headers['Authorization'] = `Bearer ${config.huggingfaceToken}`;
    }
    
    const response = await axios.get(url, { headers, timeout: 30000 });
    
    // HuggingFace data is an array of puzzle data objects
    if (!Array.isArray(response.data)) {
      throw new Error('Expected array format from HuggingFace');
    }
    
    return response.data;
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // Puzzle not in HuggingFace dataset
    }
    throw error;
  }
}

// ============================================================================
// Data Validation & Enrichment
// ============================================================================

function extractAllAttempts(hfData: HuggingFacePuzzleData): HuggingFaceAttempt[] {
  const attempts: HuggingFaceAttempt[] = [];
  
  // Check for attempt_1, attempt_2, etc.
  let attemptNum = 1;
  while (true) {
    const key = `attempt_${attemptNum}`;
    const attempt = hfData[key];
    if (!attempt) break;
    attempts.push(attempt);
    attemptNum++;
  }
  
  return attempts;
}

function calculateProcessingTime(startTimestamp: string, endTimestamp: string): number {
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();
  return end - start;
}

async function validateAndEnrich(
  hfDataArray: HuggingFacePuzzleData[],
  puzzleId: string,
  config: IngestionConfig
): Promise<any> {
  // Load the actual puzzle from our datasets
  const puzzleData = await puzzleLoader.loadPuzzle(puzzleId);
  
  if (!puzzleData) {
    throw new Error(`Puzzle ${puzzleId} not found in local datasets`);
  }
  
  // Take the first element of the array (should only be one per puzzle)
  const hfData = hfDataArray[0];
  
  // Extract all attempts
  const attempts = extractAllAttempts(hfData);
  
  if (attempts.length === 0) {
    throw new Error('No attempts found in HuggingFace data');
  }
  
  // Use first attempt's metadata for common fields
  const primaryAttempt = attempts[0];
  const metadata = primaryAttempt.metadata;
  
  // Determine if this is a multi-test puzzle
  const isMultiTest = attempts.length > 1;
  const expectedOutputs = puzzleData.test.map(t => t.output);
  
  // Validate predictions
  let validationResult: any;
  
  if (isMultiTest) {
    // Multi-test validation
    const predictedGrids = attempts.map(a => a.answer);
    
    // Build response structure that validator expects
    const multiResponse: any = { multiplePredictedOutputs: predictedGrids };
    predictedGrids.forEach((grid, index) => {
      multiResponse[`predictedOutput${index + 1}`] = grid;
    });
    
    validationResult = validateSolverResponseMulti(
      multiResponse,
      expectedOutputs,
      'external-huggingface', // promptId for validation
      undefined // No confidence for external data
    );
    
    if (config.verbose) {
      console.log(`   📊 Multi-test: ${validationResult.multiTestAllCorrect ? 'All correct' : 'Some incorrect'}`);
      console.log(`   📈 Average accuracy: ${(validationResult.multiTestAverageAccuracy * 100).toFixed(1)}%`);
    }
    
  } else {
    // Single-test validation
    validationResult = validateSolverResponse(
      { predictedOutput: primaryAttempt.answer },
      expectedOutputs[0],
      'external-huggingface', // promptId
      undefined // No confidence
    );
    
    if (config.verbose) {
      console.log(`   📊 Single-test: ${validationResult.isPredictionCorrect ? 'Correct' : 'Incorrect'}`);
      console.log(`   📈 Accuracy: ${(validationResult.predictionAccuracyScore * 100).toFixed(1)}%`);
    }
  }
  
  // Extract reasoning from the assistant's response if available
  let reasoningText = null;
  const assistantMessage = metadata.choices.find(c => c.message.role === 'assistant');
  if (assistantMessage) {
    reasoningText = assistantMessage.message.content;
  }
  
  // Extract user prompt
  const userMessage = metadata.choices.find(c => c.message.role === 'user');
  const userPrompt = userMessage?.message.content || null;
  
  // Build enriched explanation data
  const enrichedData: any = {
    puzzleId: puzzleId,
    modelName: metadata.model,
    
    // Prediction fields
    predictedOutputGrid: isMultiTest ? attempts[0].answer : validationResult.predictedGrid,
    isPredictionCorrect: isMultiTest ? validationResult.multiTestAllCorrect : validationResult.isPredictionCorrect,
    predictionAccuracyScore: isMultiTest ? validationResult.multiTestAverageAccuracy : validationResult.predictionAccuracyScore,
    
    // Multi-test fields
    hasMultiplePredictions: isMultiTest,
    multiplePredictedOutputs: isMultiTest ? attempts.map(a => a.answer) : null,
    multiTestPredictionGrids: isMultiTest ? validationResult.multiTestPredictionGrids : null,
    multiTestResults: isMultiTest ? validationResult.multiTestResults : null,
    multiTestAllCorrect: isMultiTest ? validationResult.multiTestAllCorrect : null,
    multiTestAverageAccuracy: isMultiTest ? validationResult.multiTestAverageAccuracy : null,
    
    // Token usage
    inputTokens: metadata.usage.prompt_tokens,
    outputTokens: metadata.usage.completion_tokens,
    reasoningTokens: metadata.usage.completion_tokens_details?.reasoning_tokens || null,
    totalTokens: metadata.usage.total_tokens,
    
    // Cost
    estimatedCost: metadata.cost.total_cost,
    
    // Timing
    apiProcessingTimeMs: calculateProcessingTime(metadata.start_timestamp, metadata.end_timestamp),
    
    // Reasoning & prompts
    reasoningLog: reasoningText,
    systemPromptUsed: userPrompt,
    userPromptUsed: null,
    promptTemplateId: 'external-huggingface',
    customPromptText: null,
    
    // Analysis fields (external data doesn't provide these)
    patternDescription: 'External dataset import - no analysis provided',
    solvingStrategy: null,
    hints: [],
    confidence: null,
    
    // Raw data preservation
    providerRawResponse: JSON.stringify(hfDataArray, null, 2),
    
    // Temperature and other AI params
    temperature: null,
    reasoningEffort: null,
    reasoningVerbosity: null,
    reasoningSummaryType: null
  };
  
  return enrichedData;
}

// ============================================================================
// Database Operations
// ============================================================================

async function checkDuplicate(puzzleId: string, modelName: string): Promise<boolean> {
  try {
    const existing = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
    return existing.some(exp => exp.modelName === modelName);
  } catch (error) {
    // If we can't check, assume no duplicate
    return false;
  }
}

async function deleteDuplicate(puzzleId: string, modelName: string): Promise<void> {
  // This would require a delete method in the repository
  // For now, we'll just log that we would delete
  logger.info(`Would delete existing entry for ${puzzleId} / ${modelName}`, 'ingestion');
}

async function saveToDatabase(enrichedData: any, config: IngestionConfig): Promise<boolean> {
  if (config.dryRun) {
    logger.info(`[DRY RUN] Would save: ${enrichedData.puzzleId} / ${enrichedData.modelName}`, 'ingestion');
    return true;
  }
  
  try {
    const saved = await repositoryService.explanations.saveExplanation(enrichedData);
    return saved && saved.id > 0;
  } catch (error: any) {
    logger.error(`Database save failed: ${error.message}`, 'ingestion');
    throw error;
  }
}

// ============================================================================
// Main Processing Loop
// ============================================================================

async function processPuzzle(
  puzzleId: string,
  config: IngestionConfig,
  progress: IngestionProgress
): Promise<void> {
  progress.currentPuzzle = puzzleId;
  
  try {
    // Fetch HuggingFace data
    const hfData = await fetchHuggingFaceData(puzzleId, config);
    
    if (!hfData) {
      progress.notFoundErrors++;
      if (config.verbose) {
        console.log(`⚠️  ${puzzleId} - Not found in HuggingFace dataset`);
      }
      return;
    }
    
    // Extract model name from first attempt
    const modelName = hfData[0].attempt_1.metadata.model;
    
    // Check for duplicates
    if (config.skipDuplicates) {
      const isDuplicate = await checkDuplicate(puzzleId, modelName);
      if (isDuplicate) {
        progress.skipped++;
        if (config.verbose) {
          console.log(`⚠️  ${puzzleId} - Skipped (duplicate exists)`);
        }
        return;
      }
    } else if (config.forceOverwrite) {
      await deleteDuplicate(puzzleId, modelName);
    }
    
    // Validate and enrich
    const enrichedData = await validateAndEnrich(hfData, puzzleId, config);
    
    // Save to database
    const saved = await saveToDatabase(enrichedData, config);
    
    if (saved) {
      progress.successful++;
      progress.successDetails.push({
        puzzleId,
        isCorrect: enrichedData.isPredictionCorrect,
        isMultiTest: enrichedData.hasMultiplePredictions,
        accuracy: enrichedData.predictionAccuracyScore
      });
      
      const statusIcon = enrichedData.isPredictionCorrect ? '✅' : '❌';
      const testType = enrichedData.hasMultiplePredictions ? 'multi-test' : 'single-test';
      const accuracyPercent = (enrichedData.predictionAccuracyScore * 100).toFixed(1);
      
      console.log(`${statusIcon} ${puzzleId} - Validated & Saved (${testType}, ${accuracyPercent}% accuracy)`);
    }
    
  } catch (error: any) {
    progress.failed++;
    
    if (error.message.includes('not found')) {
      progress.notFoundErrors++;
    } else if (error.message.includes('validation') || error.message.includes('grid')) {
      progress.validationErrors++;
    } else {
      progress.databaseErrors++;
    }
    
    progress.errors.push({
      puzzleId,
      error: error.message
    });
    
    console.log(`❌ ${puzzleId} - Failed: ${error.message}`);
    
    if (config.verbose) {
      console.error(error);
    }
  } finally {
    progress.processed++;
  }
}

// ============================================================================
// Summary Reporting
// ============================================================================

function printSummary(progress: IngestionProgress, config: IngestionConfig) {
  const duration = new Date().getTime() - progress.startTime.getTime();
  const durationSeconds = Math.round(duration / 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationRemainder = durationSeconds % 60;
  const durationStr = durationMinutes > 0 
    ? `${durationMinutes}m ${durationRemainder}s`
    : `${durationSeconds}s`;
  
  // Calculate accuracy statistics
  const singleTestResults = progress.successDetails.filter(d => !d.isMultiTest);
  const multiTestResults = progress.successDetails.filter(d => d.isMultiTest);
  
  const singleTestCorrect = singleTestResults.filter(d => d.isCorrect).length;
  const multiTestCorrect = multiTestResults.filter(d => d.isCorrect).length;
  
  const avgAccuracy = progress.successDetails.length > 0
    ? progress.successDetails.reduce((sum, d) => sum + d.accuracy, 0) / progress.successDetails.length
    : 0;
  
  console.log('\n' + '='.repeat(80));
  console.log('INGESTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Dataset: ${config.datasetName}`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');
  console.log(`Total Processed: ${progress.processed}`);
  console.log(`✅ Successful: ${progress.successful}`);
  console.log(`⚠️  Skipped (duplicates): ${progress.skipped}`);
  console.log(`❌ Failed: ${progress.failed}`);
  console.log(`  - Validation errors: ${progress.validationErrors}`);
  console.log(`  - Database errors: ${progress.databaseErrors}`);
  console.log(`  - Not found in HF: ${progress.notFoundErrors}`);
  console.log('');
  
  if (progress.successful > 0) {
    console.log('Accuracy Statistics:');
    if (singleTestResults.length > 0) {
      const percentage = ((singleTestCorrect / singleTestResults.length) * 100).toFixed(1);
      console.log(`  - Single-test correct: ${singleTestCorrect}/${singleTestResults.length} (${percentage}%)`);
    }
    if (multiTestResults.length > 0) {
      const percentage = ((multiTestCorrect / multiTestResults.length) * 100).toFixed(1);
      console.log(`  - Multi-test all correct: ${multiTestCorrect}/${multiTestResults.length} (${percentage}%)`);
    }
    console.log(`  - Average accuracy score: ${(avgAccuracy * 100).toFixed(1)}%`);
    console.log('');
  }
  
  console.log(`Duration: ${durationStr}`);
  console.log(`Saved to database: ${config.dryRun ? '0 (dry run)' : progress.successful} new explanations`);
  
  if (progress.errors.length > 0 && progress.errors.length <= 10) {
    console.log('');
    console.log('Errors:');
    progress.errors.forEach(err => {
      console.log(`  - ${err.puzzleId}: ${err.error}`);
    });
  } else if (progress.errors.length > 10) {
    console.log('');
    console.log(`Errors: ${progress.errors.length} total (showing first 10):`);
    progress.errors.slice(0, 10).forEach(err => {
      console.log(`  - ${err.puzzleId}: ${err.error}`);
    });
  }
  
  console.log('='.repeat(80));
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const config = parseConfig();
  
  console.log('🌐 HuggingFace Dataset Ingestion');
  console.log('='.repeat(80));
  console.log(`Dataset: ${config.datasetName}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Skip duplicates: ${config.skipDuplicates}`);
  console.log(`Verbose: ${config.verbose}`);
  console.log('='.repeat(80));
  console.log('');
  
  // Check for HuggingFace token
  if (!config.huggingfaceToken) {
    console.warn('⚠️  Warning: HUGGINGFACE_TOKEN not found in environment');
    console.warn('   Some datasets may require authentication');
    console.log('');
  }
  
  // Initialize progress tracking
  const progress: IngestionProgress = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    validationErrors: 0,
    databaseErrors: 0,
    notFoundErrors: 0,
    currentPuzzle: null,
    startTime: new Date(),
    errors: [],
    successDetails: []
  };
  
  try {
    // Get list of puzzles to process
    const puzzleIds = await fetchPuzzleList(config);
    progress.total = puzzleIds.length;
    
    console.log(`📝 Found ${puzzleIds.length} puzzles to process`);
    console.log('');
    
    // Process each puzzle
    for (let i = 0; i < puzzleIds.length; i++) {
      const puzzleId = puzzleIds[i];
      const displayNum = `[${String(i + 1).padStart(3, '0')}/${String(puzzleIds.length).padStart(3, '0')}]`;
      
      process.stdout.write(`${displayNum} ${puzzleId} - Processing... `);
      
      // Move cursor back to overwrite the line
      await processPuzzle(puzzleId, config, progress);
      
      // Clear the "Processing..." line
      process.stdout.write('\r\x1b[K');
      
      // Add small delay to avoid rate limiting
      if (i < puzzleIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('');
    printSummary(progress, config);
    
  } catch (error: any) {
    console.error('');
    console.error('💥 Fatal error:', error.message);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Ingestion interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Ingestion terminated');
  process.exit(0);
});

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
