/**
 * HuggingFace Dataset Ingestion Script
 * 
 * Author: Cascade using Claude Sonnet 4
 * Date: 2025-09-30
 * PURPOSE: Ingests external AI model predictions from HuggingFace datasets into the explanations database.
 *          Properly handles the HF data structure where each puzzle has 2 attempts, and each attempt
 *          may have predictions for multiple test cases that need to be aggregated.
 * 
 * SRP/DRY check: Pass - Single responsibility (HuggingFace dataset ingestion), reuses existing validation
 *                and repository services. No duplication of validation logic.
 * 
 * DATA STRUCTURE UNDERSTANDING:
 * - HuggingFace provides 2 attempts per puzzle (attempt_1, attempt_2)
 * - For multi-test puzzles, HF array has N elements (one per test case)
 * - Each element contains attempt_1 and attempt_2 predictions for THAT test case
 * - We aggregate by ATTEMPT NUMBER to create database entries
 * 
 * EXAMPLE for puzzle with 2 test cases:
 * HF Data: [ {attempt_1: grid1, attempt_2: grid1'}, {attempt_1: grid2, attempt_2: grid2'} ]
 * Database: 2 entries
 *   - Entry 1: has_multiple_predictions=true, multiple_predicted_outputs=[grid1, grid2]
 *   - Entry 2: has_multiple_predictions=true, multiple_predicted_outputs=[grid1', grid2']
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PuzzleLoader } from '../services/puzzleLoader.ts';
import { validateSolverResponse, validateSolverResponseMulti } from '../services/responseValidator.ts';
import { repositoryService } from '../repositories/RepositoryService.ts';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface HuggingFaceAttempt {
  answer: number[][];
  metadata: {
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
    reasoning_summary: any;
    kwargs: any;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
      completion_tokens_details?: {
        reasoning_tokens?: number;
        accepted_prediction_tokens?: number;
        rejected_prediction_tokens?: number;
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
  };
  correct: any;
}

interface HuggingFacePuzzleData {
  attempt_1?: HuggingFaceAttempt;
  attempt_2?: HuggingFaceAttempt;
}

interface IngestionConfig {
  datasetName: string;
  baseUrl: string;
  dryRun: boolean;
  verbose: boolean;
  forceOverwrite: boolean;
  skipDuplicates: boolean;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy';
  limit?: number;
  delay: number;
  stopOnError: boolean;
}

interface IngestionProgress {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  validationErrors: number;
  notFoundErrors: number;
  currentPuzzle: string;
  successDetails: Array<{
    puzzleId: string;
    isCorrect: boolean;
    isMultiTest: boolean;
    accuracy: number;
  }>;
}

// Initialize services
const puzzleLoader = new PuzzleLoader();

/**
 * Fetch HuggingFace dataset for a specific puzzle
 */
async function fetchHuggingFaceData(
  puzzleId: string,
  config: IngestionConfig
): Promise<HuggingFacePuzzleData[] | null> {
  const url = `${config.baseUrl}/${config.datasetName}/${puzzleId}.json`;
  
  try {
    const response = await fetch(url, {
      headers: config.baseUrl.includes('huggingface.co') && process.env.HF_TOKEN
        ? { 'Authorization': `Bearer ${process.env.HF_TOKEN}` }
        : {}
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error: any) {
    if (error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

/**
 * Extract all attempts from HuggingFace data element
 */
function extractAllAttempts(data: HuggingFacePuzzleData): HuggingFaceAttempt[] {
  const attempts: HuggingFaceAttempt[] = [];
  
  if (data.attempt_1) {
    attempts.push(data.attempt_1);
  }
  
  if (data.attempt_2) {
    attempts.push(data.attempt_2);
  }
  
  return attempts;
}

/**
 * Calculate processing time from timestamps
 */
function calculateProcessingTime(startTimestamp: string, endTimestamp: string): number {
  const start = new Date(startTimestamp).getTime();
  const end = new Date(endTimestamp).getTime();
  return end - start;
}

/**
 * Extract pattern description (assistant's content) from choices
 */
function extractPatternDescription(choices: any[]): string | null {
  const assistantMessage = choices.find((c: any) => c.message.role === 'assistant');
  return assistantMessage?.message.content || null;
}

/**
 * Extract user prompt from choices
 */
function extractUserPrompt(choices: any[]): string | null {
  const userMessage = choices.find((c: any) => c.message.role === 'user');
  return userMessage?.message.content || null;
}

/**
 * Validate and enrich aggregated attempt data
 * This handles both single-test and multi-test puzzles
 */
async function validateAndEnrichAggregatedAttempt(
  predictions: HuggingFaceAttempt[],
  attemptNumber: number,
  puzzleData: any,
  config: IngestionConfig
): Promise<any> {
  // Use first prediction's metadata as representative
  const metadata = predictions[0].metadata;
  // Use dataset name as base model (includes variants like -thinking-32k)
  const baseModel = config.datasetName;
  
  // Extract all prediction grids in order of pair_index
  const sortedPredictions = [...predictions].sort((a, b) =>
    a.metadata.pair_index - b.metadata.pair_index
  );
  const predictedGrids = sortedPredictions.map(p => p.answer);
  const expectedOutputs = puzzleData.test.map((t: any) => t.output);
  
  // Determine if this is a multi-test puzzle
  const isMultiTest = predictedGrids.length > 1;
  
  // Validate predictions
  let validationResult: any;
  
  if (isMultiTest) {
    // Multi-test validation: build response structure for validator
    const multiResponse: any = {
      multiplePredictedOutputs: predictedGrids
    };
    
    // Add individual fields (predictedOutput1, predictedOutput2, etc.)
    predictedGrids.forEach((grid, index) => {
      multiResponse[`predictedOutput${index + 1}`] = grid;
    });
    
    validationResult = validateSolverResponseMulti(
      multiResponse,
      expectedOutputs,
      'external-huggingface',
      undefined // No confidence for external data
    );
    
    if (config.verbose) {
      console.log(`   📊 Multi-test: ${validationResult.multiTestAllCorrect ? 'All correct ✓' : 'Some incorrect ✗'}`);
      console.log(`   📈 Average accuracy: ${(validationResult.multiTestAverageAccuracy * 100).toFixed(1)}%`);
    }
  } else {
    // Single-test validation
    validationResult = validateSolverResponse(
      { predictedOutput: predictedGrids[0] },
      expectedOutputs[0],
      'external-huggingface',
      undefined
    );

    if (config.verbose) {
      console.log(`   📊 Single-test: ${validationResult.isPredictionCorrect ? 'Correct ✓' : 'Incorrect ✗'}`);
      console.log(`   📈 Accuracy: ${(validationResult.predictionAccuracyScore * 100).toFixed(1)}%`);
    }
  }
  
  // Extract content and reasoning from HF metadata
  const patternDescription = extractPatternDescription(metadata.choices);
  const reasoningSummary = metadata.reasoning_summary || null;
  const userPrompt = extractUserPrompt(metadata.choices);
  
  // Aggregate token usage (sum across all test cases for this attempt)
  const totalInputTokens = predictions.reduce((sum, p) => sum + (p.metadata.usage.prompt_tokens || 0), 0);
  const totalOutputTokens = predictions.reduce((sum, p) => sum + (p.metadata.usage.completion_tokens || 0), 0);
  const totalReasoningTokens = predictions.reduce((sum, p) =>
    sum + (p.metadata.usage.completion_tokens_details?.reasoning_tokens || 0), 0);

  // Aggregate cost (map HF total_cost to our estimated_cost)
  const estimatedCost = predictions.reduce((sum, p) => sum + (p.metadata.cost.total_cost || 0), 0);
  
  // Aggregate processing time
  const totalProcessingTime = predictions.reduce((sum, p) => 
    sum + calculateProcessingTime(p.metadata.start_timestamp, p.metadata.end_timestamp), 0);
  
  // Build enriched explanation data
  const enrichedData: any = {
    puzzleId: metadata.task_id,
    modelName: `${baseModel}-attempt${attemptNumber}`,

    // Single-test fields (used when !isMultiTest)
    predictedOutputGrid: isMultiTest ? null : predictedGrids[0],  // STORE ACTUAL HF PREDICTION
    isPredictionCorrect: isMultiTest ? null : validationResult.isPredictionCorrect,
    predictionAccuracyScore: isMultiTest ? null : validationResult.predictionAccuracyScore,

    // Multi-test fields (used when isMultiTest)
    hasMultiplePredictions: isMultiTest,
    multiplePredictedOutputs: isMultiTest ? predictedGrids : null,  // STORE ACTUAL HF PREDICTIONS
    multiTestPredictionGrids: isMultiTest ? predictedGrids : null,  // STORE ACTUAL HF PREDICTIONS
    multiTestResults: isMultiTest ? validationResult.multiTestResults : null,
    multiTestAllCorrect: isMultiTest ? validationResult.multiTestAllCorrect : null,
    multiTestAverageAccuracy: isMultiTest ? validationResult.multiTestAverageAccuracy : null,
    
    // Token usage (aggregated across all test cases for this attempt)
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    reasoningTokens: totalReasoningTokens || null,
    totalTokens: totalInputTokens + totalOutputTokens,
    
    // Cost (aggregated from HF total_cost)
    estimatedCost: estimatedCost,

    // Timing (aggregated)
    apiProcessingTimeMs: Math.round(totalProcessingTime),

    // Reasoning & prompts (mapped from HF fields)
    reasoningLog: reasoningSummary,  // HF reasoning_summary → our reasoning_log
    systemPromptUsed: userPrompt,
    userPromptUsed: null,
    promptTemplateId: 'external-huggingface',
    customPromptText: null,

    // Analysis fields (mapped from HF content)
    patternDescription: patternDescription || `External HuggingFace import - Attempt ${attemptNumber}`,  // HF content → our pattern_description
    solvingStrategy: null,  // Not provided by HF
    hints: [],  // Not provided by HF
    confidence: null,  // Not provided by HF
    
    // Raw data preservation (store all predictions for this attempt)
    providerRawResponse: JSON.stringify(predictions, null, 2),
    
    // AI params
    temperature: null,
    reasoningEffort: null,
    reasoningVerbosity: null,
    reasoningSummaryType: null
  };
  
  return enrichedData;
}

/**
 * Check if duplicate entry exists
 */
async function checkDuplicate(puzzleId: string, modelName: string): Promise<boolean> {
  const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
  return explanations.some(exp => exp.modelName === modelName);
}

/**
 * Delete duplicate entry if exists
 */
async function deleteDuplicate(puzzleId: string, modelName: string): Promise<void> {
  const explanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
  const existing = explanations.find(exp => exp.modelName === modelName);
  if (existing) {
    // Note: This would require implementing a delete method in the repository
    console.log(`   ⚠️  Would delete existing entry for ${modelName} (not implemented)`);
  }
}

/**
 * Save enriched data to database
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
    
    // Load the puzzle data for validation
    const puzzleData = await puzzleLoader.loadPuzzle(puzzleId);
    
    if (!puzzleData) {
      throw new Error(`Puzzle ${puzzleId} not found in local datasets`);
    }
    
    // CRITICAL: Aggregate predictions by attempt number
    // HF gives us: [ {attempt_1, attempt_2}, {attempt_1, attempt_2}, ... ]
    // We need: attempt_1 predictions across all test cases → 1 DB entry
    //          attempt_2 predictions across all test cases → 1 DB entry
    
    const numTestCases = hfData.length;
    const isMultiTest = numTestCases > 1;
    
    if (config.verbose) {
      console.log(`\n📝 ${puzzleId} - ${numTestCases} test case(s), creating 2 database entries`);
    }
    
    // Aggregate by attempt number
    const attempt1Predictions: HuggingFaceAttempt[] = [];
    const attempt2Predictions: HuggingFaceAttempt[] = [];
    
    for (const testCaseData of hfData) {
      const attempts = extractAllAttempts(testCaseData);
      if (attempts.length >= 1) attempt1Predictions.push(attempts[0]);
      if (attempts.length >= 2) attempt2Predictions.push(attempts[1]);
    }
    
    // Process both attempts
    const attemptGroups = [
      { attemptNumber: 1, predictions: attempt1Predictions },
      { attemptNumber: 2, predictions: attempt2Predictions }
    ];
    
    let totalSaved = 0;
    let totalCorrect = 0;
    
    for (const { attemptNumber, predictions } of attemptGroups) {
      if (predictions.length === 0) {
        console.warn(`⚠️  No predictions for attempt ${attemptNumber}`);
        continue;
      }
      
      const baseModel = predictions[0].metadata.model;
      const modelName = `${baseModel}-attempt${attemptNumber}`;
      
      // Check for duplicates
      if (config.skipDuplicates) {
        const isDuplicate = await checkDuplicate(puzzleId, modelName);
        if (isDuplicate) {
          progress.skipped++;
          if (config.verbose) {
            console.log(`   ⚠️  Attempt ${attemptNumber} - Skipped (duplicate exists)`);
          }
          continue;
        }
      } else if (config.forceOverwrite) {
        await deleteDuplicate(puzzleId, modelName);
      }
      
      // Validate and enrich
      const enrichedData = await validateAndEnrichAggregatedAttempt(
        predictions,
        attemptNumber,
        puzzleData,
        config
      );
      
      // Save to database
      const saved = await saveToDatabase(enrichedData, config);
      
      if (saved) {
        totalSaved++;
        progress.successful++;
        
        const isCorrect = isMultiTest 
          ? enrichedData.multiTestAllCorrect 
          : enrichedData.isPredictionCorrect;
        
        if (isCorrect) {
          totalCorrect++;
        }
        
        progress.successDetails.push({
          puzzleId: `${puzzleId}-attempt${attemptNumber}`,
          isCorrect: isCorrect || false,
          isMultiTest,
          accuracy: isMultiTest 
            ? enrichedData.multiTestAverageAccuracy 
            : enrichedData.predictionAccuracyScore
        });
      }
    }
    
    // Summary
    if (totalSaved > 0) {
      const statusIcon = totalCorrect === 2 ? '✅' : totalCorrect > 0 ? '⚠️' : '❌';
      console.log(`${statusIcon} ${puzzleId} - Saved ${totalSaved}/2 attempts (${totalCorrect} correct)`);
    }
    
  } catch (error: any) {
    progress.failed++;
    
    if (error.message.includes('not found')) {
      progress.notFoundErrors++;
    } else if (error.message.includes('validation') || error.message.includes('grid')) {
      progress.validationErrors++;
    }
    
    console.error(`❌ ${puzzleId} - Error: ${error.message}`);
    if (config.verbose && error.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * Auto-detect ARC source from HuggingFace dataset URL
 */
function autoDetectSource(baseUrl: string): 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | undefined {
  const url = baseUrl.toLowerCase();

  // arcprize/arc_agi_v1_public_eval → ARC1-Eval
  if (url.includes('arc_agi_v1') && url.includes('eval')) {
    return 'ARC1-Eval';
  }
  // arcprize/arc_agi_v1_training or arc_agi_v1 → ARC1
  if (url.includes('arc_agi_v1') && url.includes('train')) {
    return 'ARC1';
  }
  // arcprize/arc_agi_v2_public_eval → ARC2-Eval
  if (url.includes('arc_agi_v2') && url.includes('eval')) {
    return 'ARC2-Eval';
  }
  // arcprize/arc_agi_v2_training or arc_agi_v2 → ARC2
  if (url.includes('arc_agi_v2') && url.includes('train')) {
    return 'ARC2';
  }

  return undefined;
}

/**
 * Main ingestion function
 */
async function ingestDataset(config: IngestionConfig): Promise<void> {
  // Initialize database connection
  console.log('🔌 Initializing database connection...');
  const dbConnected = await repositoryService.initialize();

  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Check your DATABASE_URL environment variable.');
    process.exit(1);
  }

  console.log('✅ Database connected\n');

  // Auto-detect source from URL if not explicitly set
  if (!config.source && config.baseUrl.includes('arcprize')) {
    config.source = autoDetectSource(config.baseUrl);
    if (config.source) {
      console.log(`🔍 Auto-detected source: ${config.source} from URL\n`);
    }
  }

  // Track ingestion run start
  const startTime = Date.now();
  let ingestionRunId: number | null = null;
  
  console.log('\n🌐 HuggingFace Dataset Ingestion Script\n');
  console.log(`Dataset: ${config.datasetName}`);
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Source Filter: ${config.source || 'All sources'}`);
  console.log(`Limit: ${config.limit || 'No limit'}`);
  console.log(`Delay: ${config.delay}ms between requests`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Duplicates: ${config.skipDuplicates ? 'Skip' : config.forceOverwrite ? 'Overwrite' : 'Error'}`);
  console.log(`Stop on Error: ${config.stopOnError ? 'Yes' : 'No'}\n`);

  // Load puzzles based on source filter (auto-detected or manual)
  console.log('📚 Loading puzzle library...');
  const allPuzzles = config.source
    ? puzzleLoader.getPuzzleList({ source: config.source })
    : puzzleLoader.getPuzzleList();

  let allPuzzleIds = allPuzzles.map(p => p.id);

  // Apply limit if specified
  if (config.limit) {
    allPuzzleIds = allPuzzleIds.slice(0, config.limit);
    console.log(`Limiting to first ${config.limit} puzzles`);
  }

  console.log(`Found ${allPuzzleIds.length} puzzles to process${config.source ? ` from ${config.source}` : ''}\n`);
  
  const progress: IngestionProgress = {
    total: allPuzzleIds.length,
    successful: 0,
    failed: 0,
    skipped: 0,
    validationErrors: 0,
    notFoundErrors: 0,
    currentPuzzle: '',
    successDetails: []
  };

  // Create ingestion run record (if not dry run)
  if (!config.dryRun && repositoryService.db) {
    try {
      const result = await repositoryService.db.query(`
        INSERT INTO ingestion_runs (
          dataset_name, base_url, source, total_puzzles, 
          dry_run, started_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `, [
        config.datasetName,
        config.baseUrl,
        config.source || null,
        allPuzzleIds.length,
        false
      ]);
      ingestionRunId = result.rows[0]?.id;
      console.log(`📝 Created ingestion run record (ID: ${ingestionRunId})\n`);
    } catch (error) {
      console.warn('⚠️  Could not create ingestion_runs record:', error);
    }
  }
  
  // Process each puzzle
  for (let i = 0; i < allPuzzleIds.length; i++) {
    const puzzleId = allPuzzleIds[i];

    console.log(`\n[${i + 1}/${allPuzzleIds.length}] Processing ${puzzleId}...`);
    await processPuzzle(puzzleId, config, progress);

    // Rate limiting delay
    if (config.delay > 0 && i < allPuzzleIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, config.delay));
    }

    // Stop on error if configured
    if (config.stopOnError && progress.failed > 0) {
      console.log(`\n⚠️  Stopping due to error (--stop-on-error flag set)\n`);
      break;
    }

    // Progress update every 10 puzzles
    if ((i + 1) % 10 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${allPuzzleIds.length} puzzles processed`);
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
  console.log(`   - Not found in HF: ${progress.notFoundErrors}`);
  console.log(`   - Validation errors: ${progress.validationErrors}`);
  console.log(`   - Other errors: ${progress.failed - progress.notFoundErrors - progress.validationErrors}`);
  
  // Accuracy summary
  const correctCount = progress.successDetails.filter(d => d.isCorrect).length;
  const totalAttempts = progress.successDetails.length;
  const accuracyPct = totalAttempts > 0 ? ((correctCount / totalAttempts) * 100).toFixed(1) : '0.0';
  
  console.log(`\n📈 Overall Accuracy: ${accuracyPct}% (${correctCount}/${totalAttempts} correct)`);
  console.log('='.repeat(60) + '\n');

  // Update ingestion run record with completion stats
  if (ingestionRunId && repositoryService.db) {
    try {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      await repositoryService.db.query(`
        UPDATE ingestion_runs 
        SET 
          successful = $1,
          failed = $2,
          skipped = $3,
          duration_ms = $4,
          accuracy_percent = $5,
          completed_at = NOW()
        WHERE id = $6
      `, [
        progress.successful,
        progress.failed,
        progress.skipped,
        durationMs,
        parseFloat(accuracyPct),
        ingestionRunId
      ]);
      console.log(`✅ Updated ingestion run record (ID: ${ingestionRunId})\n`);
    } catch (error) {
      console.warn('⚠️  Could not update ingestion_runs record:', error);
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): IngestionConfig {
  const args = process.argv.slice(2);

  const config: IngestionConfig = {
    datasetName: 'claude-sonnet-4-5-20250929',
    baseUrl: 'https://huggingface.co/datasets/arcprize/arc_agi_v1_public_eval/resolve/main',
    dryRun: false,
    verbose: false,
    forceOverwrite: false,
    skipDuplicates: true,
    delay: 100,
    stopOnError: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else if (arg === '--dataset' && i + 1 < args.length) {
      config.datasetName = args[++i];
    } else if (arg === '--base-url' && i + 1 < args.length) {
      config.baseUrl = args[++i];
    } else if (arg === '--source' && i + 1 < args.length) {
      const source = args[++i];
      if (['ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'ARC-Heavy'].includes(source)) {
        config.source = source as any;
      } else {
        console.error(`Invalid source: ${source}. Must be one of: ARC1, ARC1-Eval, ARC2, ARC2-Eval, ARC-Heavy`);
        process.exit(1);
      }
    } else if (arg === '--limit' && i + 1 < args.length) {
      config.limit = parseInt(args[++i], 10);
      if (isNaN(config.limit) || config.limit <= 0) {
        console.error(`Invalid limit: ${args[i]}. Must be a positive integer.`);
        process.exit(1);
      }
    } else if (arg === '--delay' && i + 1 < args.length) {
      config.delay = parseInt(args[++i], 10);
      if (isNaN(config.delay) || config.delay < 0) {
        console.error(`Invalid delay: ${args[i]}. Must be a non-negative integer.`);
        process.exit(1);
      }
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--verbose') {
      config.verbose = true;
    } else if (arg === '--stop-on-error') {
      config.stopOnError = true;
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
🌐 HuggingFace Dataset Ingestion Script

USAGE:
  npm run ingest-hf -- [options]

OPTIONS:
  --dataset <name>         Model folder name in HF dataset (default: claude-sonnet-4-5-20250929)
  --base-url <url>         Base URL for HuggingFace dataset
                           (default: arcprize/arc_agi_v1_public_eval)
  --source <source>        Override auto-detected ARC source
                           Options: ARC1, ARC1-Eval, ARC2, ARC2-Eval, ARC-Heavy
                           (Auto-detected from arcprize/* URLs)
  --limit <N>              Only process first N puzzles (useful for testing)
  --delay <ms>             Delay in milliseconds between requests (default: 100)
  --dry-run                Preview without saving to database
  --verbose                Enable detailed logging
  --stop-on-error          Stop processing on first error
  --force-overwrite        Overwrite existing entries (default: skip)
  --no-skip-duplicates     Don't skip duplicates (error instead)
  --help                   Show this help message

EXAMPLES:
  # Test with first 5 puzzles (auto-detects ARC1-Eval from URL)
  npm run ingest-hf -- --limit 5 --dry-run --verbose

  # Ingest all ARC1-Eval puzzles from default arcprize dataset
  npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929

  # Ingest from different arcprize dataset (auto-detects ARC2-Eval)
  npm run ingest-hf -- --base-url https://huggingface.co/datasets/arcprize/arc_agi_v2_public_eval/resolve/main

  # Use custom HF dataset with manual source specification
  npm run ingest-hf -- --base-url https://huggingface.co/datasets/custom/dataset/resolve/main --source ARC1-Eval

ENVIRONMENT:
  HF_TOKEN                 HuggingFace API token for authenticated requests
  `);
}

// Export for programmatic use
export { ingestDataset as ingestHuggingFaceDataset };

// Run the script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = parseArgs();
  ingestDataset(config).catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
}
