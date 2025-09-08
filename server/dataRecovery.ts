/**
 * dataRecovery.ts
 * 
 * Recovery script to process saved raw JSON API responses and insert missing database records.
 * This script recovers expensive API responses that were saved as files but failed database insertion
 * due to previous database save bugs that have since been fixed.
 * 
 * @author Claude Code
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import { repositoryService } from './repositories/RepositoryService';

interface RawFileInfo {
  filepath: string;
  filename: string;
  puzzleId: string;
  modelName: string;
  timestamp: string;
}

interface RecoveryStats {
  totalFiles: number;
  skippedDuplicates: number;
  recoveredRecords: number;
  failedRecords: number;
  processedFiles: string[];
  failedFiles: string[];
}

/**
 * Check if timestamp is from August 2025 or later
 */
function isRecentFile(timestamp: string): boolean {
  try {
    const date = new Date(timestamp.replace('T', 'T').replace('Z', 'Z'));
    // August 1, 2025 
    const cutoffDate = new Date('2025-08-01T00:00:00Z');
    return date >= cutoffDate;
  } catch (error) {
    console.warn(`[WARNING] Could not parse timestamp: ${timestamp}`);
    return false;
  }
}

/**
 * Find recent *-raw.json files (August 2025 onwards) in the explained directory
 */
async function findRawJsonFiles(): Promise<RawFileInfo[]> {
  const explainedDir = path.join('data', 'explained');
  const files = await fs.readdir(explainedDir);
  const rawFiles: RawFileInfo[] = [];

  for (const filename of files) {
    if (filename.endsWith('-raw.json')) {
      const filepath = path.join(explainedDir, filename);
      const parsed = parseRawFilename(filename);
      if (parsed) {
        // Only include files from August 2025 onwards
        if (isRecentFile(parsed.timestamp)) {
          rawFiles.push({
            filepath,
            filename,
            ...parsed
          });
        } else {
          console.log(`[SKIPPING OLD] ${filename} (${parsed.timestamp})`);
        }
      } else {
        console.warn(`[WARNING] Could not parse filename: ${filename}`);
      }
    }
  }

  return rawFiles.sort((a, b) => a.filename.localeCompare(b.filename));
}

/**
 * Parse raw filename to extract puzzle ID, model name, and timestamp
 * Format: puzzleid-model-timestamp-raw.json
 */
function parseRawFilename(filename: string): { puzzleId: string; modelName: string; timestamp: string } | null {
  // Remove -raw.json suffix
  const withoutSuffix = filename.replace('-raw.json', '');
  
  // Split by dashes, but be careful because model names can contain dashes
  const parts = withoutSuffix.split('-');
  
  if (parts.length < 3) {
    return null;
  }
  
  // First part is always puzzle ID (8 character hex)
  const puzzleId = parts[0];
  
  // Last part(s) form the ISO timestamp (contains multiple dashes)
  // Find where timestamp starts (looks for pattern like "2025-08-30T...")
  let timestampStartIndex = -1;
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].match(/^\d{4}$/)) { // Year pattern
      timestampStartIndex = i;
      break;
    }
  }
  
  if (timestampStartIndex === -1) {
    return null;
  }
  
  // Model name is everything between puzzle ID and timestamp
  const modelName = parts.slice(1, timestampStartIndex).join('-');
  
  // Timestamp is everything from timestamp start
  const timestamp = parts.slice(timestampStartIndex).join('-');
  
  return {
    puzzleId,
    modelName,
    timestamp
  };
}

/**
 * Check if explanation with matching timestamp already exists in database
 * This identifies actual failed database saves vs legitimate duplicates
 */
async function explanationExistsWithTimestamp(puzzleId: string, modelName: string, rawFileTimestamp: string): Promise<boolean> {
  try {
    const existingExplanations = await repositoryService.explanations.getExplanationsForPuzzle(puzzleId);
    
    // Filter to this specific model
    const modelExplanations = existingExplanations.filter(exp => exp.modelName === modelName);
    
    if (modelExplanations.length === 0) {
      console.log(`  🔍 No existing entries for ${puzzleId} + ${modelName}`);
      return false; // No entries at all - definitely need to recover
    }
    
    // Parse the raw file timestamp
    const rawFileDate = new Date(rawFileTimestamp);
    
    // Check if any existing explanation was created within 5 minutes of the raw file timestamp
    const timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    for (const explanation of modelExplanations) {
      const dbDate = new Date(explanation.createdAt);
      const timeDiff = Math.abs(dbDate.getTime() - rawFileDate.getTime());
      
      if (timeDiff <= timeWindow) {
        console.log(`  ✅ Found matching DB entry within ${Math.round(timeDiff/1000)}s - already saved`);
        return true; // Found a match - this API call was already saved
      }
    }
    
    console.log(`  🔍 Found ${modelExplanations.length} entries for ${modelName} but none match timestamp ${rawFileTimestamp}`);
    return false; // No timestamp match - this raw file represents a failed save
    
  } catch (error) {
    console.error(`[ERROR] Failed to check existing explanations for ${puzzleId}:`, error);
    return false; // Assume doesn't exist on error - better to try insert and fail than skip
  }
}

/**
 * Process raw JSON data and extract explanation data using the same logic as explanationService
 * This replicates the complex data mapping from explanationService.saveExplanation()
 */
function extractExplanationData(sourceData: any, modelName: string): any {
  console.log(`🔧 [DATA-EXTRACTION] Processing model: ${modelName}`);
  
  // Handle nested result structure from OpenRouter services
  // OpenRouter models return: { result: { solvingStrategy, patternDescription, ... }, tokenUsage, cost, ... }
  const analysisData = sourceData.result || sourceData;
  
  // Collect multiple prediction grids from various sources
  let collectedGrids: any[] = [];
  
  // 1. For single test cases: check predictedOutput field first
  const singlePrediction = sourceData.predictedOutput || analysisData.predictedOutput;
  const multiplePredictionsFlag = sourceData.multiplePredictedOutputs ?? analysisData.multiplePredictedOutputs;
  
  if (!multiplePredictionsFlag && singlePrediction && Array.isArray(singlePrediction) && singlePrediction.length > 0) {
    // Single test case - use predictedOutput
    collectedGrids.push(singlePrediction);
  } else {
    // Multiple test cases - check predictedOutput1, predictedOutput2, predictedOutput3 fields
    let i = 1;
    while (sourceData[`predictedOutput${i}`] || analysisData[`predictedOutput${i}`]) {
      const grid = sourceData[`predictedOutput${i}`] || analysisData[`predictedOutput${i}`];
      if (grid && Array.isArray(grid) && grid.length > 0) {
        collectedGrids.push(grid);
      }
      i++;
    }
  }
  
  // 2. From multi-test results (different test cases, not multiple predictions per test)
  if (Array.isArray(analysisData.multiTestResults)) {
    const testGrids = analysisData.multiTestResults.map((result: any) => result.predictedOutput).filter(Boolean);
    if (testGrids.length > 0 && collectedGrids.length === 0) {
      // Only use test results if we didn't find prediction grids above
      collectedGrids = testGrids;
    }
  }
  
  // 3. From multiplePredictedOutputs array (if it exists as array)
  if (Array.isArray(sourceData.multiplePredictedOutputs)) {
    if (collectedGrids.length === 0) {
      collectedGrids.push(...sourceData.multiplePredictedOutputs);
    }
  } else if (Array.isArray(analysisData.multiplePredictedOutputs)) {
    if (collectedGrids.length === 0) {
      collectedGrids.push(...analysisData.multiplePredictedOutputs);
    }
  }

  const hasMultiplePredictions = multiplePredictionsFlag === true;
  
  const tokenUsage = sourceData.tokenUsage;
  const costData = sourceData.cost;

  // Extract reasoningItems with proper fallback logic (from explanationService)
  let finalReasoningItems = null;
  
  // Priority 1: Direct reasoningItems from sourceData (top-level)
  if (sourceData.reasoningItems && Array.isArray(sourceData.reasoningItems) && sourceData.reasoningItems.length > 0) {
    finalReasoningItems = sourceData.reasoningItems;
  }
  // Priority 2: reasoningItems from nested analysisData
  else if (analysisData.reasoningItems && Array.isArray(analysisData.reasoningItems) && analysisData.reasoningItems.length > 0) {
    finalReasoningItems = analysisData.reasoningItems;
  }
  // Priority 3: Check if reasoningItems got nested deeper in result structure
  else if (sourceData.result && sourceData.result.reasoningItems && Array.isArray(sourceData.result.reasoningItems) && sourceData.result.reasoningItems.length > 0) {
    finalReasoningItems = sourceData.result.reasoningItems;
  }
  // Priority 4: Fallback to reasoningLog if it's an array (some providers return it as array)
  else if (analysisData.reasoningLog && Array.isArray(analysisData.reasoningLog) && analysisData.reasoningLog.length > 0) {
    finalReasoningItems = analysisData.reasoningLog;
  }

  // Extract reasoningLog from AI service response
  let finalReasoningLog = null;
  
  // Priority 1: Direct reasoningLog from sourceData (top-level)
  if (sourceData.reasoningLog && typeof sourceData.reasoningLog === 'string') {
    finalReasoningLog = sourceData.reasoningLog;
  }
  // Priority 2: reasoningLog from nested analysisData
  else if (analysisData.reasoningLog && typeof analysisData.reasoningLog === 'string') {
    finalReasoningLog = analysisData.reasoningLog;
  }

  // Build the explanation data object (same structure as explanationService)
  const explanationData = {
    patternDescription: analysisData.patternDescription ?? null,
    solvingStrategy: analysisData.solvingStrategy ?? null,
    hints: Array.isArray(analysisData.hints) 
      ? analysisData.hints.map((hint: any) => 
          typeof hint === 'object' ? hint.algorithm || hint.description || String(hint)
          : String(hint)
        )
      : null,
    confidence: analysisData.confidence ?? 50,
    modelName: sourceData.modelName ?? modelName,
    reasoningItems: finalReasoningItems,
    reasoningLog: finalReasoningLog,
    predictedOutputGrid: collectedGrids.length > 1 ? collectedGrids : collectedGrids[0],
    isPredictionCorrect: sourceData.isPredictionCorrect ?? analysisData.isPredictionCorrect ?? false,
    predictionAccuracyScore: sourceData.predictionAccuracyScore ?? analysisData.predictionAccuracyScore ?? 0,
    hasMultiplePredictions: hasMultiplePredictions,
    multiplePredictedOutputs: collectedGrids,
    multiTestResults: sourceData.multiTestResults ?? analysisData.multiTestResults ?? null,
    multiTestAllCorrect: sourceData.multiTestAllCorrect ?? null,
    multiTestAverageAccuracy: sourceData.multiTestAverageAccuracy ?? null,
    providerRawResponse: sourceData.providerRawResponse ?? null,
    apiProcessingTimeMs: sourceData.actualProcessingTime ?? sourceData.apiProcessingTimeMs ?? null,
    inputTokens: tokenUsage?.input ?? sourceData.inputTokens ?? null,
    outputTokens: tokenUsage?.output ?? sourceData.outputTokens ?? null,
    reasoningTokens: tokenUsage?.reasoning ?? sourceData.reasoningTokens ?? null,
    totalTokens: (tokenUsage?.input && tokenUsage?.output) ? (tokenUsage.input + tokenUsage.output + (tokenUsage.reasoning || 0)) : sourceData.totalTokens ?? null,
    estimatedCost: costData?.total ?? sourceData.estimatedCost ?? null,
    temperature: sourceData.temperature ?? null,
    reasoningEffort: sourceData.reasoningEffort ?? null,
    reasoningVerbosity: sourceData.reasoningVerbosity ?? null,
    reasoningSummaryType: sourceData.reasoningSummaryType ?? null,
  };

  console.log(`✅ [DATA-EXTRACTION] Extracted explanation data for ${modelName}`);
  console.log(`📊 [DATA-EXTRACTION] Required fields: pattern=${!!explanationData.patternDescription}, strategy=${!!explanationData.solvingStrategy}, hints=${Array.isArray(explanationData.hints) && explanationData.hints.length > 0}, confidence=${typeof explanationData.confidence === 'number'}`);

  return explanationData;
}

/**
 * Process a single raw JSON file and insert to database if it doesn't exist
 */
async function processRawFile(rawFile: RawFileInfo): Promise<{ success: boolean; error?: string }> {
  try {
    // Read the raw JSON file
    const rawData = JSON.parse(await fs.readFile(rawFile.filepath, 'utf8'));
    
    // Extract explanation data using the same logic as explanationService
    const explanationData = extractExplanationData(rawData, rawFile.modelName);
    
    // Add puzzle ID to the explanation data
    const explanationWithPuzzleId = {
      ...explanationData,
      puzzleId: rawFile.puzzleId
    };
    
    console.log(`  🔄 Inserting explanation into database...`);
    
    // Insert into database using the same method as explanationService
    const savedExplanation = await repositoryService.explanations.saveExplanation(explanationWithPuzzleId);
    
    if (savedExplanation && savedExplanation.id) {
      console.log(`  ✅ SUCCESS - Saved to database (ID: ${savedExplanation.id})`);
      return { success: true };
    } else {
      const errorMsg = `Database save returned null - likely validation or JSON serialization failure`;
      console.error(`  ❌ ERROR: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ ERROR processing raw file: ${errorMsg}`);
    if (error instanceof Error && error.stack) {
      console.error(`  📋 Stack trace: ${error.stack}`);
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Create processed directory if it doesn't exist
 */
async function ensureProcessedDir(): Promise<string> {
  const processedDir = path.join('data', 'explained', 'processed');
  await fs.mkdir(processedDir, { recursive: true });
  return processedDir;
}

/**
 * Move processed file to processed directory
 */
async function moveProcessedFile(originalPath: string, processedDir: string): Promise<void> {
  const filename = path.basename(originalPath);
  const newPath = path.join(processedDir, filename);
  await fs.rename(originalPath, newPath);
}

/**
 * Ask user for approval on each file
 */
async function askForApproval(rawFile: RawFileInfo, rawData: any): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log(`\n📁 File: ${rawFile.filename}`);
    console.log(`🎯 Puzzle: ${rawFile.puzzleId}, Model: ${rawFile.modelName}`);
    console.log(`📅 Date: ${rawFile.timestamp}`);
    console.log(`📊 Raw data keys: [${Object.keys(rawData).join(', ')}]`);
    
    // Show brief preview of key data
    const analysisData = rawData.result || rawData;
    console.log(`📝 Pattern: ${analysisData.patternDescription ? 'YES' : 'NO'}`);
    console.log(`📝 Strategy: ${analysisData.solvingStrategy ? 'YES' : 'NO'}`);
    console.log(`📝 Hints: ${Array.isArray(analysisData.hints) ? analysisData.hints.length : 0} items`);
    console.log(`💰 Cost: ${rawData.estimatedCost || 'unknown'}`);
    
    rl.question('\nApprove this file for recovery? (y/N): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Main recovery function
 */
async function recoverMissingData(): Promise<RecoveryStats> {
  console.log('🔍 Starting interactive data recovery process...');
  
  const stats: RecoveryStats = {
    totalFiles: 0,
    skippedDuplicates: 0,
    recoveredRecords: 0,
    failedRecords: 0,
    processedFiles: [],
    failedFiles: []
  };

  try {
    // Find all raw JSON files
    const rawFiles = await findRawJsonFiles();
    stats.totalFiles = rawFiles.length;
    
    console.log(`📁 Found ${rawFiles.length} raw JSON files to process`);
    
    if (rawFiles.length === 0) {
      console.log('✅ No raw JSON files found - nothing to recover');
      return stats;
    }

    // Create processed directory
    const processedDir = await ensureProcessedDir();
    console.log(`📂 Created processed directory: ${processedDir}\n`);

    // Process each file
    for (let i = 0; i < rawFiles.length; i++) {
      const rawFile = rawFiles[i];
      console.log(`[${i + 1}/${rawFiles.length}] Processing: ${rawFile.filename}`);
      console.log(`  Puzzle: ${rawFile.puzzleId}, Model: ${rawFile.modelName}`);

      try {
        // Check if already exists using timestamp-based detection
        const exists = await explanationExistsWithTimestamp(rawFile.puzzleId, rawFile.modelName, rawFile.timestamp);
        if (exists) {
          console.log(`[${i + 1}/${rawFiles.length}] ⏭️  SKIPPED - Found matching timestamp in database: ${rawFile.filename}`);
          stats.skippedDuplicates++;
          // Still move to processed since it's been handled
          await moveProcessedFile(rawFile.filepath, processedDir);
          stats.processedFiles.push(rawFile.filename);
          continue;
        }

        // Read raw data for approval
        const rawData = JSON.parse(await fs.readFile(rawFile.filepath, 'utf8'));
        
        // Ask for user approval
        const approved = await askForApproval(rawFile, rawData);
        
        if (!approved) {
          console.log(`  ❌ DENIED by user - keeping file`);
          continue;
        }

        console.log(`  ✅ APPROVED - processing...`);

        // Process the raw file data and insert to database
        const result = await processRawFile(rawFile);
        
        if (result.success) {
          console.log(`  📁 Moving to processed directory...`);
          await moveProcessedFile(rawFile.filepath, processedDir);
          stats.processedFiles.push(rawFile.filename);
          stats.recoveredRecords++;
        } else {
          console.log(`  ⚠️  Database insertion failed - keeping file for manual review`);
          stats.failedFiles.push(rawFile.filename);
          stats.failedRecords++;
        }
        
      } catch (error) {
        console.error(`  ❌ ERROR processing file:`, error);
        stats.failedFiles.push(rawFile.filename);
        stats.failedRecords++;
      }
      
      console.log(''); // Empty line for readability
    }

  } catch (error) {
    console.error('💥 Fatal error during recovery:', error);
    throw error;
  }

  return stats;
}

/**
 * Print recovery statistics
 */
function printStats(stats: RecoveryStats): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 RECOVERY STATISTICS');
  console.log('='.repeat(50));
  console.log(`Total files found: ${stats.totalFiles}`);
  console.log(`Skipped duplicates: ${stats.skippedDuplicates}`);
  console.log(`Recovered records: ${stats.recoveredRecords}`);
  console.log(`Failed records: ${stats.failedRecords}`);
  console.log(`Successfully processed: ${stats.processedFiles.length}`);
  
  if (stats.failedFiles.length > 0) {
    console.log(`\n❌ Failed files:`);
    stats.failedFiles.forEach(filename => console.log(`  - ${filename}`));
  }
  
  console.log('='.repeat(50));
}

// Export functions for testing
export { recoverMissingData, parseRawFilename };

// Run recovery immediately when script is imported/executed
recoverMissingData()
  .then(printStats)
  .then(() => {
    console.log('✅ Recovery process completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Recovery process failed:', error);
    process.exit(1);
  });