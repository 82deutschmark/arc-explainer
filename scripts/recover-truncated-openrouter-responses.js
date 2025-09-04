/**
 * OpenRouter Truncated Response Recovery Script
 * 
 * Recovers database records that were truncated due to hardcoded 4K token limits.
 * Uses raw response files to restore complete analysis data.
 * 
 * CRITICAL: This script respects the exact database schema and field mappings.
 * 
 * Usage: node scripts/recover-truncated-openrouter-responses.js [--dry-run] [--verbose]
 * 
 * @author Claude Code
 * @date 2025-01-09
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, readFile } from 'fs/promises';
// Note: This script identifies truncated records for recovery
// For actual database operations, run via: npm run dev then call via API
// Or use tsx to handle TypeScript imports

// Simple utility functions (duplicated to avoid TS import issues in standalone script)
function safeJsonStringify(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn(`Failed to stringify JSON: ${error.message}`);
    return null;
  }
}

function normalizeConfidence(confidence) {
  if (confidence === null || confidence === undefined) return 50;
  if (typeof confidence === 'number') {
    return Math.max(0, Math.min(100, Math.round(confidence)));
  }
  if (typeof confidence === 'string') {
    const parsed = parseFloat(confidence);
    return isNaN(parsed) ? 50 : Math.max(0, Math.min(100, Math.round(parsed)));
  }
  return 50;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Script configuration
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const DATA_DIR = join(__dirname, '..', 'data', 'explained');

// Recovery statistics
const stats = {
  totalFound: 0,
  recoverable: 0,
  recovered: 0,
  skipped: 0,
  errors: 0
};

/**
 * Log with different levels based on verbosity
 */
function log(level, message, data = null) {
  const prefix = DRY_RUN ? '[DRY-RUN]' : '[RECOVERY]';
  
  if (level === 'INFO' || VERBOSE) {
    console.log(`${prefix} ${message}`);
    if (data && VERBOSE) {
      console.log('  ', JSON.stringify(data, null, 2));
    }
  } else if (level === 'WARN') {
    console.warn(`${prefix} ⚠️  ${message}`);
  } else if (level === 'ERROR') {
    console.error(`${prefix} ❌ ${message}`);
    if (data) console.error('  ', data);
  }
}

/**
 * Phase 1: Analyze raw files to identify truncation patterns
 * (Database-free version for initial analysis)
 */
async function identifyTruncatedResponses() {
  log('INFO', 'Phase 1: Analyzing raw files for truncation patterns...');
  
  // Get all raw files
  const allFiles = await readdir(DATA_DIR);
  const rawFiles = allFiles.filter(filename => filename.endsWith('-raw.json'));
  
  // Filter for OpenRouter model files
  const openRouterFiles = rawFiles.filter(filename => {
    const lowerName = filename.toLowerCase();
    return lowerName.includes('qwen') || 
           lowerName.includes('llama') || 
           lowerName.includes('cohere') ||
           lowerName.includes('mistral') ||
           lowerName.includes('ernie') ||
           lowerName.includes('x-ai') ||
           lowerName.includes('moonshot') ||
           lowerName.includes('deepseek');
  });
  
  log('INFO', `Found ${openRouterFiles.length} OpenRouter model files out of ${rawFiles.length} total`);
  
  const truncatedRecords = [];
  
  // Analyze each file
  for (const filename of openRouterFiles) {
    try {
      const rawFilePath = join(DATA_DIR, filename);
      const rawContent = await readFile(rawFilePath, 'utf8');
      const rawResponse = JSON.parse(rawContent);
      
      // Check for truncation indicators
      const hasParseError = rawResponse.parseError || 
        (rawResponse.patternDescription && rawResponse.patternDescription.includes('PARSE ERROR')) ||
        (rawResponse.solvingStrategy && rawResponse.solvingStrategy.includes('PARSE ERROR'));
      
      const outputTokens = rawResponse.outputTokens || 0;
      const isExactly4K = outputTokens === 4000;
      
      if (hasParseError || isExactly4K) {
        // Extract metadata from filename
        const parts = filename.split('-');
        const puzzleId = parts[0];
        const modelName = rawResponse.model || 'unknown';
        
        truncatedRecords.push({
          filename,
          puzzleId,
          modelName,
          outputTokens,
          hasParseError,
          isExactly4K,
          rawData: rawResponse
        });
        
        log('VERBOSE', `Found truncated: ${filename} (${outputTokens} tokens, parseError: ${hasParseError})`);
      }
      
    } catch (error) {
      log('WARN', `Failed to parse ${filename}: ${error.message}`);
    }
  }
  
  stats.totalFound = truncatedRecords.length;
  log('INFO', `Found ${stats.totalFound} potentially truncated responses`);
  
  return truncatedRecords;
}

/**
 * Phase 2: Match database records to raw response files
 */
async function findMatchingRawFiles(truncatedRecords) {
  log('INFO', 'Phase 2: Matching database records to raw response files...');
  
  // Get all raw files
  const allFiles = await readdir(DATA_DIR);
  const rawFiles = allFiles.filter(filename => filename.endsWith('-raw.json'));
  
  log('INFO', `Found ${rawFiles.length} raw response files`);
  
  const matches = [];
  
  for (const record of truncatedRecords) {
    const { id, puzzle_id, model_name, created_at } = record;
    
    // Look for files matching this record
    // Pattern: {puzzleId}-{modelName}-{timestamp}-raw.json
    const possibleFiles = rawFiles.filter(filename => {
      // Must start with puzzle ID
      if (!filename.startsWith(puzzle_id)) return false;
      
      // Must contain model name parts (handle various formats)
      const modelParts = model_name.split(/[\/\-\.]/).map(p => p.toLowerCase());
      const filenameLower = filename.toLowerCase();
      
      // Check if most model parts are in filename
      const matchedParts = modelParts.filter(part => 
        part.length > 2 && filenameLower.includes(part)
      );
      
      return matchedParts.length >= Math.ceil(modelParts.length / 2);
    });
    
    if (possibleFiles.length > 0) {
      // Prefer the most recent file if multiple matches
      const sortedFiles = possibleFiles.sort((a, b) => {
        // Extract timestamp from filename for comparison
        const timestampA = a.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1] || '';
        const timestampB = b.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1] || '';
        return timestampB.localeCompare(timestampA);
      });
      
      matches.push({
        record,
        rawFile: sortedFiles[0]
      });
      
      log('VERBOSE', `Matched DB record ${id} to file: ${sortedFiles[0]}`);
    } else {
      log('VERBOSE', `No raw file found for DB record ${id} (${puzzle_id} - ${model_name})`);
      stats.skipped++;
    }
  }
  
  stats.recoverable = matches.length;
  log('INFO', `Found ${stats.recoverable} recoverable records with matching raw files`);
  
  return matches;
}

/**
 * Phase 3: Extract and validate complete responses from raw files
 */
async function extractCompleteResponses(matches) {
  log('INFO', 'Phase 3: Extracting complete responses from raw files...');
  
  const recoveryData = [];
  
  for (const match of matches) {
    const { record, rawFile } = match;
    
    try {
      const rawFilePath = join(DATA_DIR, rawFile);
      const rawContent = await readFile(rawFilePath, 'utf8');
      const rawResponse = JSON.parse(rawContent);
      
      // Validate that this is a complete response (not truncated)
      const validation = validateCompleteResponse(rawResponse, record);
      
      if (!validation.isValid) {
        log('WARN', `Raw file ${rawFile} failed validation: ${validation.reason}`);
        stats.skipped++;
        continue;
      }
      
      // Extract recovery data with proper schema mapping
      const recoveryRecord = extractRecoveryData(rawResponse, record);
      
      if (recoveryRecord) {
        recoveryData.push({
          dbRecordId: record.id,
          originalRecord: record,
          rawFile,
          recoveryData: recoveryRecord
        });
        
        log('VERBOSE', `Extracted recovery data for DB record ${record.id}`);
      } else {
        log('WARN', `Failed to extract recovery data from ${rawFile}`);
        stats.skipped++;
      }
      
    } catch (error) {
      log('ERROR', `Error processing raw file ${rawFile}:`, error.message);
      stats.errors++;
    }
  }
  
  log('INFO', `Successfully extracted ${recoveryData.length} complete responses`);
  return recoveryData;
}

/**
 * Validate that a raw response is complete and suitable for recovery
 */
function validateCompleteResponse(rawResponse, dbRecord) {
  // Check for parse error indicators in raw response
  if (rawResponse.parseError || 
      rawResponse.patternDescription?.includes('PARSE ERROR') ||
      rawResponse.solvingStrategy?.includes('PARSE ERROR')) {
    return { 
      isValid: false, 
      reason: 'Raw response also contains parse errors' 
    };
  }
  
  // Must have substantial content
  if (!rawResponse.patternDescription || 
      !rawResponse.solvingStrategy ||
      rawResponse.patternDescription.length < 50 ||
      rawResponse.solvingStrategy.length < 50) {
    return { 
      isValid: false, 
      reason: 'Insufficient content in raw response' 
    };
  }
  
  // Should have token counts indicating it wasn't truncated
  if (rawResponse.outputTokens && rawResponse.outputTokens <= 4000 && 
      (rawResponse.patternDescription + rawResponse.solvingStrategy).length > 2000) {
    // This might still be truncated - be cautious
    log('WARN', `Raw response has suspicious token count: ${rawResponse.outputTokens}`);
  }
  
  // Must have model match
  if (rawResponse.model && rawResponse.model !== dbRecord.model_name) {
    return { 
      isValid: false, 
      reason: `Model mismatch: ${rawResponse.model} vs ${dbRecord.model_name}` 
    };
  }
  
  return { isValid: true };
}

/**
 * Extract recovery data from raw response with proper schema mapping
 * CRITICAL: Must match exact database schema and data processing
 */
function extractRecoveryData(rawResponse, dbRecord) {
  try {
    // Map raw response fields to database schema
    // Following ExplanationRepository.ts field mapping exactly
    
    return {
      // Core analysis fields (TEXT columns)
      pattern_description: rawResponse.patternDescription || null,
      solving_strategy: rawResponse.solvingStrategy || null,
      
      // Array field (PostgreSQL text[])
      hints: Array.isArray(rawResponse.hints) ? rawResponse.hints : [],
      
      // Numeric fields with normalization
      confidence: normalizeConfidence(rawResponse.confidence),
      alien_meaning_confidence: rawResponse.alienMeaningConfidence ? 
        normalizeConfidence(rawResponse.alienMeaningConfidence) : null,
      
      // Text fields
      alien_meaning: rawResponse.alienMeaning || null,
      reasoning_effort: rawResponse.reasoningEffort || null,
      reasoning_verbosity: rawResponse.reasoningVerbosity || null,
      reasoning_summary_type: rawResponse.reasoningSummaryType || null,
      
      // Token counts
      input_tokens: rawResponse.inputTokens || null,
      output_tokens: rawResponse.outputTokens || null,
      reasoning_tokens: rawResponse.reasoningTokens || null,
      total_tokens: rawResponse.totalTokens || null,
      
      // Cost
      estimated_cost: rawResponse.estimatedCost || null,
      
      // JSON/JSONB fields using safeJsonStringify
      reasoning_items: safeJsonStringify(rawResponse.reasoningItems),
      predicted_output_grid: safeJsonStringify(rawResponse.predictedOutput || rawResponse.predictedOutputGrid),
      multiple_predicted_outputs: safeJsonStringify(rawResponse.multiplePredictedOutputs),
      multi_test_results: safeJsonStringify(rawResponse.multiTestResults),
      
      // Boolean fields
      has_reasoning_log: !!(rawResponse.reasoningLog || rawResponse.reasoningItems),
      is_prediction_correct: rawResponse.isPredictionCorrect || null,
      multi_test_all_correct: rawResponse.multiTestAllCorrect || null,
      has_multiple_predictions: rawResponse.hasMultiplePredictions || null,
      
      // Numeric fields
      prediction_accuracy_score: rawResponse.predictionAccuracyScore || null,
      multi_test_average_accuracy: rawResponse.multiTestAverageAccuracy || null,
      
      // Preserve existing metadata
      api_processing_time_ms: rawResponse.apiProcessingTimeMs || dbRecord.api_processing_time_ms,
      temperature: rawResponse.temperature || null
    };
    
  } catch (error) {
    log('ERROR', 'Error extracting recovery data:', error.message);
    return null;
  }
}

/**
 * Phase 3: Update database records with recovered data
 */
async function updateDatabaseRecords(recoveryData, explanationRepo) {
  log('INFO', `Phase 3: Updating ${recoveryData.length} database records...`);
  
  if (DRY_RUN) {
    log('INFO', 'DRY RUN - Would update the following records:');
    recoveryData.forEach(({ dbRecordId, recoveryData }) => {
      console.log(`  - Record ID: ${dbRecordId}`);
      console.log(`    Pattern: ${recoveryData.pattern_description?.substring(0, 100)}...`);
      console.log(`    Strategy: ${recoveryData.solving_strategy?.substring(0, 100)}...`);
      console.log(`    Tokens: ${recoveryData.output_tokens}, Confidence: ${recoveryData.confidence}`);
    });
    return;
  }
  
  for (const { dbRecordId, recoveryData } of recoveryData) {
    try {
      // Build update query with exact schema field names
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;
      
      // Only update non-null recovery fields
      Object.entries(recoveryData).forEach(([field, value]) => {
        if (value !== null && value !== undefined) {
          updateFields.push(`${field} = $${paramIndex}`);
          updateValues.push(value);
          paramIndex++;
        }
      });
      
      if (updateFields.length === 0) {
        log('WARN', `No valid fields to update for record ${dbRecordId}`);
        stats.skipped++;
        continue;
      }
      
      const updateQuery = `
        UPDATE explanations 
        SET ${updateFields.join(', ')} 
        WHERE id = $${paramIndex}
      `;
      
      updateValues.push(dbRecordId);
      
      log('VERBOSE', `Updating record ${dbRecordId} with ${updateFields.length} fields`);
      
      await explanationRepo.query(updateQuery, updateValues);
      stats.recovered++;
      
      log('INFO', `✅ Successfully recovered record ${dbRecordId}`);
      
    } catch (error) {
      log('ERROR', `Failed to update record ${dbRecordId}:`, error.message);
      stats.errors++;
    }
  }
  
  log('INFO', `Completed database updates. ${stats.recovered} records recovered.`);
}

/**
 * Main recovery process
 */
async function runRecovery() {
  console.log('🔧 OpenRouter Truncated Response Analysis Script');
  console.log(`   Mode: FILE ANALYSIS (Database operations disabled)`);
  console.log(`   Verbose: ${VERBOSE ? 'ON' : 'OFF'}`);
  console.log('');
  
  try {
    // Phase 1: Identify truncated responses from raw files
    const truncatedRecords = await identifyTruncatedResponses();
    
    if (truncatedRecords.length === 0) {
      log('INFO', '✅ No truncated responses found in raw files!');
      return;
    }
    
    // Analyze truncation patterns
    const exactly4K = truncatedRecords.filter(r => r.isExactly4K);
    const parseErrors = truncatedRecords.filter(r => r.hasParseError);
    const bothConditions = truncatedRecords.filter(r => r.isExactly4K && r.hasParseError);
    
    console.log('');
    console.log('📊 Truncation Analysis:');
    console.log(`   Total OpenRouter responses analyzed: ${truncatedRecords.length + ' (out of raw files)'}`);
    console.log(`   Exactly 4000 tokens (old limit): ${exactly4K.length}`);
    console.log(`   Parse error responses: ${parseErrors.length}`);
    console.log(`   Both conditions (definite truncation): ${bothConditions.length}`);
    
    // Show detailed breakdown
    if (VERBOSE || truncatedRecords.length <= 20) {
      console.log('');
      console.log('🔍 Detailed Breakdown:');
      
      truncatedRecords.forEach((record, i) => {
        console.log(`${i + 1}. ${record.filename}`);
        console.log(`   Model: ${record.modelName}`);
        console.log(`   Puzzle: ${record.puzzleId}`);
        console.log(`   Tokens: ${record.outputTokens}`);
        console.log(`   Parse Error: ${record.hasParseError ? '❌' : '✅'}`);
        console.log(`   4K Limit Hit: ${record.isExactly4K ? '❌' : '✅'}`);
        
        if (record.hasParseError && record.rawData.solvingStrategy) {
          // Extract error details
          const errorMatch = record.rawData.solvingStrategy.match(/Raw response preview: "(.*?)"/);
          if (errorMatch) {
            console.log(`   Preview: ${errorMatch[1].substring(0, 100)}...`);
          }
        }
        console.log('');
      });
    }
    
    // Recommendations
    console.log('📋 Recommendations:');
    
    if (bothConditions.length > 0) {
      console.log(`   🔄 Re-analyze ${bothConditions.length} puzzles that were definitely truncated`);
      console.log('   📝 These puzzles need fresh analysis with fixed token limits');
      
      // Group by puzzle for re-analysis
      const puzzlesToReanalyze = [...new Set(bothConditions.map(r => r.puzzleId))];
      console.log(`   🧩 Unique puzzles needing re-analysis: ${puzzlesToReanalyze.length}`);
      
      if (VERBOSE && puzzlesToReanalyze.length <= 10) {
        console.log('   Puzzles:', puzzlesToReanalyze.join(', '));
      }
    } else {
      console.log('   ✅ No definitive truncation found');
    }
    
    // Model breakdown
    const modelBreakdown = {};
    truncatedRecords.forEach(record => {
      const model = record.modelName;
      modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
    });
    
    if (Object.keys(modelBreakdown).length > 0) {
      console.log('');
      console.log('📊 Models Affected:');
      Object.entries(modelBreakdown)
        .sort(([,a], [,b]) => b - a)
        .forEach(([model, count]) => {
          console.log(`   ${model}: ${count} responses`);
        });
    }
    
  } catch (error) {
    console.error('💥 Analysis failed:', error.message);
    if (VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run recovery if called directly
const scriptPath = fileURLToPath(import.meta.url);
const isMainScript = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith(scriptPath.replace(/\\/g, '/').split('/').pop());

if (isMainScript || import.meta.url === `file://${process.argv[1]}`) {
  runRecovery().catch(console.error);
}