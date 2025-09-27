/**
 * 
 * Author: Cascade using Claude 3.5 Sonnet
 * Date: 2025-09-26T21:36:50-04:00
 * PURPOSE: Flexible puzzle processing engine that combines analysis, validation, retry, and query functionality
 * SRP and DRY check: Pass - This file handles configurable puzzle processing with multiple operation modes
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pkg from 'pg';

const { Pool } = pkg;
dotenv.config();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Configuration interfaces
interface ProcessorConfig {
  // Operation mode
  mode: 'analyze' | 'query' | 'validate' | 'retry';
  
  // Puzzle selection
  puzzleSource: 'directory' | 'ids' | 'unsolved' | 'failed' | 'file';
  puzzleDirectory?: string;
  puzzleIds?: string[];
  puzzleFile?: string;
  
  // Model configuration
  model: string;
  provider?: string;
  temperature: number;
  promptId: string;
  reasoningEffort: string;
  reasoningVerbosity: string;
  reasoningSummaryType: string;
  systemPromptMode: string;
  omitAnswer: boolean;
  
  // Execution parameters
  concurrent: boolean;
  maxConcurrent: number;
  delayBetweenMs: number;
  timeoutMinutes: number;
  retryMode: boolean;
  
  // Output configuration
  showValidation: boolean;
  recordFailures: boolean;
  outputFile?: string;
  verbose: boolean;
}

interface AnalysisResult {
  puzzleId: string;
  success: boolean;
  error?: string;
  responseTime?: number;
  validationPassed?: boolean;
  predictionCorrect?: boolean;
  multiTestCorrect?: boolean;
}

interface PuzzleStatus {
  solved: string[];
  testedButNotSolved: string[];
  notTested: string[];
  missingFromDb: string[];
}

// Default configuration
const DEFAULT_CONFIG: ProcessorConfig = {
  mode: 'analyze',
  puzzleSource: 'directory',
  puzzleDirectory: 'evaluation2',
  temperature: 0.2,
  promptId: 'solver',
  reasoningEffort: 'high',
  reasoningVerbosity: 'high',
  reasoningSummaryType: 'auto',
  systemPromptMode: 'ARC',
  omitAnswer: true,
  model: 'gpt-4o-2024-08-06',
  concurrent: true,
  maxConcurrent: 10,
  delayBetweenMs: 2000,
  timeoutMinutes: 30,
  retryMode: false,
  showValidation: true,
  recordFailures: true,
  verbose: true
};

/**
 * Parse command line arguments and create configuration
 */
function parseConfig(): ProcessorConfig {
  const config = { ...DEFAULT_CONFIG };
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];
    
    switch (arg) {
      case '--mode':
        config.mode = nextArg as any;
        i++;
        break;
      case '--source':
        config.puzzleSource = nextArg as any;
        i++;
        break;
      case '--directory':
        config.puzzleDirectory = nextArg;
        i++;
        break;
      case '--ids':
        config.puzzleIds = nextArg.split(',');
        i++;
        break;
      case '--file':
        config.puzzleFile = nextArg;
        i++;
        break;
      case '--model':
        config.model = nextArg;
        i++;
        break;
      case '--provider':
        config.provider = nextArg;
        i++;
        break;
      case '--temperature':
        config.temperature = parseFloat(nextArg);
        i++;
        break;
      case '--reasoning-effort':
        config.reasoningEffort = nextArg;
        i++;
        break;
      case '--timeout':
        config.timeoutMinutes = parseInt(nextArg);
        i++;
        break;
      case '--max-concurrent':
        config.maxConcurrent = parseInt(nextArg);
        i++;
        break;
      case '--delay':
        config.delayBetweenMs = parseInt(nextArg);
        i++;
        break;
      case '--output':
        config.outputFile = nextArg;
        i++;
        break;
      case '--no-concurrent':
        config.concurrent = false;
        break;
      case '--no-validation':
        config.showValidation = false;
        break;
      case '--no-failures':
        config.recordFailures = false;
        break;
      case '--quiet':
        config.verbose = false;
        break;
      case '--help':
        showUsage();
        process.exit(0);
    }
  }
  
  return config;
}

/**
 * Show usage information
 */
function showUsage(): void {
  console.log(`
🧩 Flexible Puzzle Processor

USAGE:
  npm run process -- [options]

MODES:
  --mode analyze     Analyze puzzles with AI model
  --mode query       Query database for puzzle status
  --mode validate    Check existing results for accuracy
  --mode retry       Retry failed puzzles from previous run

PUZZLE SOURCES:
  --source directory --directory evaluation2    # Analyze from data/evaluation2
  --source ids --ids "id1,id2,id3"             # Analyze specific puzzle IDs
  --source unsolved                             # Analyze unsolved puzzles from DB
  --source failed --file failures.json         # Retry from failure file
  --source file --file puzzles.txt             # Read IDs from text file

MODEL CONFIGURATION:
  --model gpt-4o-2024-08-06                    # AI model to use
  --provider openai                            # AI provider
  --temperature 0.2                            # Temperature setting
  --reasoning-effort high                      # Reasoning effort level
  --timeout 30                                 # Timeout in minutes

EXECUTION OPTIONS:
  --max-concurrent 10                          # Max concurrent requests
  --delay 2000                                 # Delay between requests (ms)
  --no-concurrent                              # Run sequentially
  --output results.json                        # Save results to file

DISPLAY OPTIONS:
  --no-validation                              # Hide validation results
  --no-failures                               # Don't record failures
  --quiet                                      # Minimal output

EXAMPLES:
  # Analyze all puzzles in evaluation2 directory
  npm run process -- --mode analyze --source directory --directory evaluation2

  # Query database for puzzle status
  npm run process -- --mode query --source unsolved

  # Retry specific failed puzzles
  npm run process -- --mode retry --source ids --ids "08573cc6,0becf7df"

  # Validate existing results
  npm run process -- --mode validate --source directory --directory training
`);
}

/**
 * Get puzzle IDs based on configuration
 */
async function getPuzzleIds(config: ProcessorConfig): Promise<string[]> {
  switch (config.puzzleSource) {
    case 'directory':
      return getPuzzleIdsFromDirectory(config.puzzleDirectory!);
    
    case 'ids':
      return config.puzzleIds || [];
    
    case 'file':
      return getPuzzleIdsFromFile(config.puzzleFile!);
    
    case 'unsolved':
      return await getUnsolvedPuzzleIds();
    
    case 'failed':
      return getPuzzleIdsFromFailureFile(config.puzzleFile!);
    
    default:
      throw new Error(`Unsupported puzzle source: ${config.puzzleSource}`);
  }
}

/**
 * Get puzzle IDs from directory
 */
function getPuzzleIdsFromDirectory(directory: string): string[] {
  const fullPath = path.join('data', directory);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Directory not found: ${fullPath}`);
  }
  
  const files = fs.readdirSync(fullPath)
    .filter(file => file.endsWith('.json'))
    .map(file => path.basename(file, '.json'));
  
  console.log(`📂 Found ${files.length} puzzle files in ${fullPath}`);
  return files;
}

/**
 * Get puzzle IDs from text file
 */
function getPuzzleIdsFromFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const ids = content.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  
  console.log(`📄 Loaded ${ids.length} puzzle IDs from ${filePath}`);
  return ids;
}

/**
 * Get puzzle IDs from failure file
 */
function getPuzzleIdsFromFailureFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Failure file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const failures = JSON.parse(content);
  
  const ids = failures.failed?.map((f: any) => f.puzzleId) || [];
  console.log(`🔄 Loaded ${ids.length} failed puzzle IDs from ${filePath}`);
  return ids;
}

/**
 * Get unsolved puzzle IDs from database
 */
async function getUnsolvedPuzzleIds(): Promise<string[]> {
  const query = `
    SELECT DISTINCT puzzle_id
    FROM explanations e1
    WHERE NOT EXISTS (
      SELECT 1 FROM explanations e2
      WHERE e2.puzzle_id = e1.puzzle_id
      AND (e2.is_prediction_correct = true OR e2.multi_test_all_correct = true)
    )
    ORDER BY puzzle_id
  `;
  
  const result = await pool.query(query);
  const ids = result.rows.map(row => row.puzzle_id);
  
  console.log(`🎯 Found ${ids.length} unsolved puzzles in database`);
  return ids;
}

/**
 * Analyze a single puzzle
 */
async function analyzePuzzle(puzzleId: string, config: ProcessorConfig): Promise<AnalysisResult> {
  const startTime = Date.now();
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
  
  try {
    if (config.verbose) {
      console.log(`🚀 Analyzing ${puzzleId}...`);
    }
    
    const requestBody = {
      temperature: config.temperature,
      promptId: config.promptId,
      reasoningEffort: config.reasoningEffort,
      reasoningVerbosity: config.reasoningVerbosity,
      reasoningSummaryType: config.reasoningSummaryType,
      systemPromptMode: config.systemPromptMode,
      omitAnswer: config.omitAnswer,
      retryMode: config.retryMode
    };
    
    const encodedModelKey = encodeURIComponent(config.model);
    const url = `${API_BASE_URL}/api/puzzle/analyze/${puzzleId}/${encodedModelKey}`;
    
    const response = await axios.post(url, requestBody, {
      timeout: config.timeoutMinutes * 60 * 1000,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.success) {
      const endTime = Date.now();
      const responseTime = Math.round((endTime - startTime) / 1000);
      
      // Get validation info if requested
      let validationPassed, predictionCorrect, multiTestCorrect;
      if (config.showValidation) {
        const validation = await getValidationResults(puzzleId, config.model);
        validationPassed = validation.validationPassed;
        predictionCorrect = validation.predictionCorrect;
        multiTestCorrect = validation.multiTestCorrect;
      }
      
      if (config.verbose) {
        console.log(`✅ Successfully analyzed ${puzzleId} in ${responseTime}s`);
        if (config.showValidation) {
          console.log(`   🔍 Validation: ${validationPassed ? '✅' : '❌'} | Prediction: ${predictionCorrect ? '✅' : '❌'} | Multi-test: ${multiTestCorrect !== undefined ? (multiTestCorrect ? '✅' : '❌') : 'N/A'}`);
        }
      }
      
      return { 
        puzzleId, 
        success: true, 
        responseTime,
        validationPassed,
        predictionCorrect,
        multiTestCorrect
      };
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
    
    if (config.verbose) {
      console.log(`❌ Failed to analyze ${puzzleId} in ${responseTime}s: ${errorMessage}`);
    }
    
    return { 
      puzzleId, 
      success: false, 
      error: errorMessage, 
      responseTime,
      validationPassed: false,
      predictionCorrect: false
    };
  }
}

/**
 * Get validation results for a puzzle
 */
async function getValidationResults(puzzleId: string, model: string): Promise<{
  validationPassed: boolean;
  predictionCorrect: boolean;
  multiTestCorrect?: boolean;
}> {
  try {
    const query = `
      SELECT is_prediction_correct, multi_test_all_correct, has_multiple_predictions
      FROM explanations
      WHERE puzzle_id = $1 AND model_name = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [puzzleId, model]);
    
    if (result.rows.length === 0) {
      return { validationPassed: false, predictionCorrect: false };
    }
    
    const row = result.rows[0];
    const predictionCorrect = row.is_prediction_correct || false;
    const multiTestCorrect = row.has_multiple_predictions ? row.multi_test_all_correct : undefined;
    const validationPassed = predictionCorrect || (multiTestCorrect === true);
    
    return { validationPassed, predictionCorrect, multiTestCorrect };
    
  } catch (error) {
    console.error(`Error getting validation for ${puzzleId}:`, error);
    return { validationPassed: false, predictionCorrect: false };
  }
}

/**
 * Process puzzles based on configuration
 */
async function processPuzzles(puzzleIds: string[], config: ProcessorConfig): Promise<AnalysisResult[]> {
  if (config.mode === 'query') {
    return await queryPuzzleStatus(puzzleIds);
  }
  
  if (config.mode === 'validate') {
    return await validatePuzzles(puzzleIds, config);
  }
  
  // Analyze or retry mode
  console.log(`\n🚀 Processing ${puzzleIds.length} puzzles...`);
  console.log('='.repeat(80));
  
  const results: AnalysisResult[] = [];
  
  if (config.concurrent) {
    // Concurrent processing
    const analysisPromises: Promise<AnalysisResult>[] = [];
    
    for (let i = 0; i < puzzleIds.length; i++) {
      const puzzleId = puzzleIds[i];
      
      // Check if we should limit concurrency
      if (analysisPromises.length >= config.maxConcurrent) {
        const batchResults = await Promise.all(analysisPromises);
        results.push(...batchResults);
        analysisPromises.length = 0;
      }
      
      const analysisPromise = analyzePuzzle(puzzleId, config);
      analysisPromises.push(analysisPromise);
      
      // Add delay between triggers
      if (i < puzzleIds.length - 1 && config.delayBetweenMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenMs));
      }
    }
    
    // Process remaining promises
    if (analysisPromises.length > 0) {
      const batchResults = await Promise.all(analysisPromises);
      results.push(...batchResults);
    }
    
  } else {
    // Sequential processing
    for (const puzzleId of puzzleIds) {
      const result = await analyzePuzzle(puzzleId, config);
      results.push(result);
      
      if (config.delayBetweenMs > 0) {
        await new Promise(resolve => setTimeout(resolve, config.delayBetweenMs));
      }
    }
  }
  
  return results;
}

/**
 * Query puzzle status from database
 */
async function queryPuzzleStatus(puzzleIds: string[]): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];
  
  for (const puzzleId of puzzleIds) {
    try {
      const query = `
        SELECT DISTINCT model_name, is_prediction_correct, multi_test_all_correct, has_multiple_predictions
        FROM explanations
        WHERE puzzle_id = $1
        ORDER BY model_name
      `;
      
      const result = await pool.query(query, [puzzleId]);
      
      const correctModels = result.rows.filter(row => 
        row.is_prediction_correct || row.multi_test_all_correct
      );
      
      const success = correctModels.length > 0;
      const predictionCorrect = result.rows.some(row => row.is_prediction_correct);
      const multiTestCorrect = result.rows.some(row => row.multi_test_all_correct);
      
      console.log(`🎯 ${puzzleId}: ${result.rows.length} attempts, ${correctModels.length} correct (${correctModels.map(r => r.model_name).join(', ')})`);
      
      results.push({
        puzzleId,
        success,
        predictionCorrect,
        multiTestCorrect: result.rows.some(row => row.has_multiple_predictions) ? multiTestCorrect : undefined,
        validationPassed: success
      });
      
    } catch (error) {
      console.error(`Error querying ${puzzleId}:`, error);
      results.push({
        puzzleId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        validationPassed: false,
        predictionCorrect: false
      });
    }
  }
  
  return results;
}

/**
 * Validate existing puzzle results
 */
async function validatePuzzles(puzzleIds: string[], config: ProcessorConfig): Promise<AnalysisResult[]> {
  console.log(`🔍 Validating ${puzzleIds.length} puzzles...`);
  
  const results: AnalysisResult[] = [];
  
  for (const puzzleId of puzzleIds) {
    const validation = await getValidationResults(puzzleId, config.model);
    
    console.log(`${validation.validationPassed ? '✅' : '❌'} ${puzzleId}: Prediction=${validation.predictionCorrect ? '✅' : '❌'}, Multi-test=${validation.multiTestCorrect !== undefined ? (validation.multiTestCorrect ? '✅' : '❌') : 'N/A'}`);
    
    results.push({
      puzzleId,
      success: validation.validationPassed,
      validationPassed: validation.validationPassed,
      predictionCorrect: validation.predictionCorrect,
      multiTestCorrect: validation.multiTestCorrect
    });
  }
  
  return results;
}

/**
 * Display processing results
 */
function displayResults(results: AnalysisResult[], config: ProcessorConfig): void {
  console.log('\n📊 PROCESSING RESULTS');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const validationPassed = results.filter(r => r.validationPassed).length;
  
  console.log(`Total processed: ${results.length}`);
  console.log(`Successful: ${successful} (${((successful / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / results.length) * 100).toFixed(1)}%)`);
  
  if (config.showValidation) {
    console.log(`Validation passed: ${validationPassed} (${((validationPassed / results.length) * 100).toFixed(1)}%)`);
    
    const predictionCorrect = results.filter(r => r.predictionCorrect).length;
    const multiTestCorrect = results.filter(r => r.multiTestCorrect === true).length;
    const hasMultiTest = results.filter(r => r.multiTestCorrect !== undefined).length;
    
    console.log(`Prediction correct: ${predictionCorrect}`);
    if (hasMultiTest > 0) {
      console.log(`Multi-test correct: ${multiTestCorrect}/${hasMultiTest}`);
    }
  }
  
  if (successful > 0 && results.some(r => r.responseTime)) {
    const avgTime = results
      .filter(r => r.success && r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / successful;
    console.log(`Average response time: ${Math.round(avgTime)}s`);
  }
  
  // Show failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log(`\n❌ Failed puzzles (${failures.length}):`);
    failures.forEach(result => {
      console.log(`   • ${result.puzzleId}: ${result.error}`);
    });
  }
}

/**
 * Record failures to file for retry
 */
function recordFailures(results: AnalysisResult[], config: ProcessorConfig): void {
  if (!config.recordFailures) return;
  
  const failures = results.filter(r => !r.success);
  if (failures.length === 0) return;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = config.outputFile || `failures-${timestamp}.json`;
  
  const failureData = {
    timestamp: new Date().toISOString(),
    config: {
      mode: config.mode,
      model: config.model,
      puzzleSource: config.puzzleSource
    },
    failed: failures,
    retryCommand: `npm run process -- --mode retry --source file --file ${filename}`
  };
  
  fs.writeFileSync(filename, JSON.stringify(failureData, null, 2));
  console.log(`\n📄 Recorded ${failures.length} failures to ${filename}`);
  console.log(`💡 To retry: npm run process -- --mode retry --source file --file ${filename}`);
}

/**
 * Save results to file
 */
function saveResults(results: AnalysisResult[], config: ProcessorConfig): void {
  if (!config.outputFile) return;
  
  const outputData = {
    timestamp: new Date().toISOString(),
    config,
    results,
    summary: {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      validationPassed: results.filter(r => r.validationPassed).length
    }
  };
  
  fs.writeFileSync(config.outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to ${config.outputFile}`);
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    const config = parseConfig();
    
    console.log('🧩 FLEXIBLE PUZZLE PROCESSOR');
    console.log('='.repeat(80));
    console.log(`Mode: ${config.mode}`);
    console.log(`Model: ${config.model}`);
    console.log(`Source: ${config.puzzleSource}`);
    console.log(`Concurrent: ${config.concurrent} (max: ${config.maxConcurrent})`);
    console.log(`Timeout: ${config.timeoutMinutes} minutes`);
    console.log('='.repeat(80));
    
    // Get puzzle IDs
    const puzzleIds = await getPuzzleIds(config);
    
    if (puzzleIds.length === 0) {
      console.log('❌ No puzzles found to process');
      return;
    }
    
    console.log(`📝 Processing ${puzzleIds.length} puzzles`);
    
    // Process puzzles
    const results = await processPuzzles(puzzleIds, config);
    
    // Display results
    displayResults(results, config);
    
    // Record failures for retry
    recordFailures(results, config);
    
    // Save results if requested
    saveResults(results, config);
    
    console.log('\n✨ Processing complete!');
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Processing interrupted by user');
  pool.end().then(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Processing terminated');
  pool.end().then(() => process.exit(0));
});

// Run the processor
main();
