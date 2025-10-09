/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-09-30
 * PURPOSE: Response validation service that extracts predicted grids from AI responses and validates
 * them against correct answers. Handles both single-test and multi-test puzzle validation with accuracy
 * scoring, grid extraction, and prediction correctness checking. Critical for debate system to properly
 * validate rebuttal responses.
 *
 * CRITICAL FIX (2025-09-30): Fixed debate validation bug where 'debate' prompt type was excluded from
 * solver mode validation, causing all debate rebuttals to skip prediction extraction and be marked as
 * 100% correct regardless of actual accuracy. Now uses centralized isSolverMode() function from
 * systemPrompts.ts to ensure consistent validation across all solver-type prompts (solver, custom,
 * debate, educationalApproach, gepa).
 *
 * SRP and DRY check: Pass - Single responsibility (response validation only), now properly uses
 * centralized solver mode detection instead of duplicating logic. File is 561 lines due to complex
 * grid extraction strategies (text parsing, JSON extraction, multi-format support) and detailed
 * accuracy calculation logic. Could potentially be refactored into smaller modules in the future.
 */

import { logger } from '../utils/logger.ts';
import { extractPredictions } from './schemas/solver.ts';
import { jsonParser } from '../utils/JsonParser.js';
import { isSolverMode } from './prompts/systemPrompts.js';

export interface ValidationResult {
  predictedGrid: number[][] | null;
  isPredictionCorrect: boolean;
  predictionAccuracyScore: number;
  extractionMethod?: string;
}

export interface MultiValidationItemResult extends ValidationResult {
  index: number;
  expectedDimensions?: { rows: number; cols: number };
}

/**
 * Multi-test validation result that maps directly to database schema
 * Field names must match ExplanationRepository database columns
 *
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-16
 * PURPOSE: Fix critical field mapping issue that was causing multi-test data loss
 */
export interface MultiValidationResult {
  // Database-compatible field names for direct storage
  hasMultiplePredictions: boolean;           // maps to has_multiple_predictions
  multiplePredictedOutputs: (number[][] | null)[]; // maps to multiple_predicted_outputs
  multiTestResults: MultiValidationItemResult[];    // maps to multi_test_results
  multiTestAllCorrect: boolean;              // maps to multi_test_all_correct
  multiTestAverageAccuracy: number;          // maps to multi_test_average_accuracy
  multiTestPredictionGrids: (number[][] | null)[]; // maps to multi_test_prediction_grids
  extractionMethodSummary?: string;         // for debugging/logging
}

/**
 * Extracts grid from AI response text using multiple pattern matching strategies
 */
function extractGridFromText(text: string): { grid: number[][] | null; method: string } {
  if (!text) {
    return { grid: null, method: 'no_text' };
  }

  // Debug logging
  logger.info(`Attempting to extract grid from text: ${text.substring(0, 200)}...`, 'validator');

  // Test specific patterns against known examples for debugging
  const testCases = [
    'Predicted Output Grid: [[8,8,2], [8,2,2], [8,8,8]]',
    'Predicted Output Grid: [[2,2,2],[2,8,8],[8,8,8]]'
  ];
  
  for (const testCase of testCases) {
    if (text.includes('Predicted Output Grid:')) {
      logger.info(`Testing against pattern, found similar text in response`, 'validator');
      break;
    }
  }

  // Strategy 1: Simple approach - extract any text that starts with [[ and ends with ]]
  // Look for the pattern after common keywords
  const keywordPatterns = [
    'predicted output grid:',
    'predicted output:',
    'output grid:',
    'output:',
    'answer:',
    'solution:',
    'result:',
    'final grid:',
    'final output:'
  ];
  
  const lowerText = text.toLowerCase();
  for (const keyword of keywordPatterns) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      // Look for [[ after the keyword, but first handle markdown code blocks
      let afterKeyword = text.substring(index + keyword.length);
      
      // Check if there's a markdown code block after the keyword
      const codeBlockStart = afterKeyword.indexOf('```');
      if (codeBlockStart !== -1) {
        // Find the closing ```
        const afterCodeBlockStart = afterKeyword.substring(codeBlockStart + 3);
        const codeBlockEnd = afterCodeBlockStart.indexOf('```');
        if (codeBlockEnd !== -1) {
          // Extract content inside the code block
          const codeBlockContent = afterCodeBlockStart.substring(0, codeBlockEnd).trim();
          logger.info(`Found markdown code block: ${codeBlockContent.substring(0, 100)}...`, 'validator');
          
          // Check if the code block contains a valid grid
          if (codeBlockContent.includes('[[') && codeBlockContent.includes(']]')) {
            afterKeyword = codeBlockContent;
          }
        }
      }
      
      const startBracket = afterKeyword.indexOf('[[');
      if (startBracket !== -1) {
        // Find the matching ]]
        const afterStart = afterKeyword.substring(startBracket);
        let bracketCount = 0;
        let endIndex = -1;
        
        for (let i = 0; i < afterStart.length; i++) {
          if (afterStart[i] === '[') bracketCount++;
          if (afterStart[i] === ']') {
            bracketCount--;
            if (bracketCount === 0) {
              endIndex = i + 1;
              break;
            }
          }
        }
        
        if (endIndex !== -1) {
          const gridText = afterStart.substring(0, endIndex);
          
          // Quick check: ensure it contains only digits, brackets, commas, and spaces
          if (/^[\[\]\d\s,]+$/.test(gridText)) {
            try {
              const cleanedText = gridText
                .replace(/\s+/g, ' ')
                .replace(/,\s*]/g, ']')
                .replace(/,\s*,/g, ',')
                .replace(/\[\s+/g, '[')
                .replace(/\s+\]/g, ']');
              
              logger.info(`Attempting to parse numeric grid: ${cleanedText}`, 'validator');
              
              const result = jsonParser.parse(cleanedText, {
                preserveRawInput: false,
                logErrors: false,
                fieldName: `keyword_${keyword}`
              });
              
              if (result.success) {
                logger.info(`Successfully extracted numeric grid via keyword search: ${JSON.stringify(result.data)}`, 'validator');
                return { grid: result.data, method: `keyword_${keyword.replace(':', '').replace(' ', '_')}` };
              } else {
                logger.info(`Invalid grid: ${result.error}`, 'validator');
              }
            } catch (error) {
              logger.info(`Failed to parse grid after keyword ${keyword}: ${gridText} - ${error}`, 'validator');
            }
          } else {
            logger.info(`Skipping non-numeric grid candidate: ${gridText.substring(0, 50)}`, 'validator');
          }
        }
      }
    }
  }

  // Strategy 1.5: Check for markdown code blocks containing grids
  // This handles both plain ``` and language-specified blocks like ```json, ```python, etc.
  const codeBlockRegex = /```(?:[a-z]*\s*)?[^`]*(\[\[[\s\S]*?\]\])[^`]*```/g;
  let codeBlockMatch;
  while ((codeBlockMatch = codeBlockRegex.exec(text)) !== null) {
    const gridText = codeBlockMatch[1];
    if (/^[\[\]\d\s,]+$/.test(gridText)) {
      try {
        const cleanedText = gridText
          .replace(/\s+/g, ' ')
          .replace(/,\s*]/g, ']')
          .replace(/,\s*,/g, ',')
          .replace(/\[\s+/g, '[')
          .replace(/\s+\]/g, ']');
        
        logger.info(`Found grid in markdown code block: ${cleanedText}`, 'validator');
        
        const result = jsonParser.parse(cleanedText, {
          preserveRawInput: false,
          logErrors: false,
          fieldName: 'markdown_code_block'
        });
        
        if (result.success) {
          logger.info(`Successfully extracted numeric grid from markdown code block: ${JSON.stringify(result.data)}`, 'validator');
          return { grid: result.data, method: 'markdown_code_block' };
        }
      } catch (error) {
        logger.info(`Failed to parse grid from markdown code block: ${gridText}`, 'validator');
      }
    }
  }

  // Fallback regex patterns optimized for numeric grids only
  const patterns = [
    /(\[\[\d+(?:\s*,\s*\d+)*\](?:\s*,\s*\[\d+(?:\s*,\s*\d+)*\])*\])/g
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = text.match(pattern);
    if (match && match[1]) {
      try {
        const gridText = match[1];
        // Clean up the text to ensure valid JSON
        const cleanedText = gridText
          .replace(/\s+/g, ' ')  // normalize whitespace
          .replace(/,\s*]/g, ']')  // remove trailing commas
          .replace(/,\s*,/g, ','); // remove double commas
        
        const result = jsonParser.parse(cleanedText);
        if (!result.success) {
          continue; // try next pattern
        }
        const grid = result.data;
        if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
          return { grid, method: `pattern_${i + 1}` };
        }
      } catch (error) {
        // Continue to next pattern
      }
    }
  }

  // Strategy 2: Look for any complete 2D array structure in the text
  let bracketStart = -1;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '[' && text[i + 1] === '[') {
      bracketStart = i;
      let bracketCount = 0;
      let endIndex = -1;
      
      for (let j = i; j < text.length; j++) {
        if (text[j] === '[') bracketCount++;
        if (text[j] === ']') {
          bracketCount--;
          if (bracketCount === 0) {
            endIndex = j + 1;
            break;
          }
        }
      }
      
      if (endIndex !== -1) {
        const gridText = text.substring(bracketStart, endIndex);
        
        // Quick check: only proceed if it looks like numeric data
        if (/^\[\[[\d\s,\[\]]+\]$/.test(gridText.replace(/\s+/g, ' ').trim())) {
          try {
            const cleanedText = gridText
              .replace(/\s+/g, ' ')
              .replace(/,\s*]/g, ']')
              .replace(/,\s*,/g, ',')
              .replace(/\[\s+/g, '[')
              .replace(/\s+\]/g, ']');
            
            logger.info(`Found potential numeric grid: ${cleanedText}`, 'validator');
            const result = jsonParser.parse(cleanedText);
            if (!result.success) continue;
            const grid = result.data;
            
            // Validate it's a proper numeric grid
            if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
              // Ensure all elements are numbers
              const isValidNumericGrid = grid.every(row => 
                Array.isArray(row) && row.every(cell => typeof cell === 'number' && Number.isInteger(cell))
              );
              
              if (isValidNumericGrid) {
                logger.info(`Successfully extracted numeric grid: ${JSON.stringify(grid)}`, 'validator');
                return { grid, method: 'bracket_search' };
              }
            }
          } catch (error) {
            logger.info(`Failed to parse potential grid: ${gridText}`, 'validator');
          }
        }
      }
    }
  }

  logger.warn('No grid found after all extraction strategies', 'validator');
  return { grid: null, method: 'not_found' };
}

/**
 * Extract multiple grids from AI response text
 * Reuses existing strategies but scans for multiple occurrences
 */
function extractAllGridsFromText(text: string): { grids: number[][][]; method: string } {
  const grids: number[][][] = [];
  let method = 'not_found';
  if (!text) return { grids, method };

  // 1) Scan markdown code blocks first (may contain multiple blocks)
  const codeBlockRegex = /```(?:[a-z]*\s*)?[^`]*?(\[\[[\s\S]*?\]\])[^`]*?```/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    const candidate = blockMatch[1];
    if (/^[\[\]\d\s,]+$/.test(candidate)) {
      try {
        const cleaned = candidate
          .replace(/\s+/g, ' ')
          .replace(/,\s*]/g, ']')
          .replace(/,\s*,/g, ',')
          .replace(/\[\s+/g, '[')
          .replace(/\s+\]/g, ']');
        const result = jsonParser.parse(cleaned);
        if (!result.success) {
          return { grids: [], method: 'parse_failed' };
        }
        const grid = result.data;
        if (Array.isArray(grid) && Array.isArray(grid[0])) {
          const valid = grid.every((row: any) => Array.isArray(row) && row.every((c: any) => Number.isInteger(c)));
          if (valid) {
            grids.push(grid);
            method = 'markdown_code_block_multi';
          }
        }
      } catch {}
    }
  }

  // 2) Generic pattern match throughout text
  const pattern = /(\[\[\d+(?:\s*,\s*\d+)*\](?:\s*,\s*\[\d+(?:\s*,\s*\d+)*\])*\])/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    try {
      const cleaned = m[1]
        .replace(/\s+/g, ' ')
        .replace(/,\s*]/g, ']')
        .replace(/,\s*,/g, ',');
      const result = jsonParser.parse(cleaned);
      if (!result.success) {
        return { grids: [], method: 'parse_failed' };
      }
      const grid = result.data;
      if (Array.isArray(grid) && Array.isArray(grid[0])) {
        const valid = grid.every((row: any) => Array.isArray(row) && row.every((c: any) => Number.isInteger(c)));
        if (valid) {
          grids.push(grid);
          if (method === 'not_found') method = 'pattern_multi';
        }
      }
    } catch {}
  }

  return { grids, method };
}

/**
 * Validates grid dimensions match expected output
 */
function validateGridDimensions(grid: number[][], expectedOutput: number[][]): boolean {
  if (!grid || !expectedOutput) return false;
  
  return grid.length === expectedOutput.length &&
         grid.every(row => row.length === expectedOutput[0].length);
}

/**
 * Checks if two grids are exactly equal
 */
function gridsAreEqual(grid1: number[][], grid2: number[][]): boolean {
  if (!grid1 || !grid2) return false;
  if (grid1.length !== grid2.length) return false;
  
  for (let i = 0; i < grid1.length; i++) {
    if (grid1[i].length !== grid2[i].length) return false;
    for (let j = 0; j < grid1[i].length; j++) {
      if (grid1[i][j] !== grid2[i][j]) return false;
    }
  }
  
  return true;
}

/**
 * Calculates TRUSTWORTHINESS based on correctness and confidence
 * 
 * ⚠️ CRITICAL: This is NOT accuracy! This is a confidence calibration metric.
 * Only use for internal AI predictions WITH confidence scores.
 * For external data WITHOUT confidence, use pure correctness (0 or 1).
 * 
 * Rewards honest uncertainty and penalizes overconfidence:
 * - Perfect Calibration: 0% confidence + wrong = 100% confidence + correct = 1.0 score
 * - Honest Low Confidence: Low confidence + wrong gets rewarded  
 * - Dangerous Overconfidence: 95%+ confidence + wrong gets heavily penalized
 * 
 * @param isCorrect - Whether the prediction was correct
 * @param confidence - Confidence level (1-100). Use null for external data.
 * @param hasConfidence - Whether confidence data is available (false for external/HF data)
 * @returns Trustworthiness score (0-1) or pure correctness if no confidence
 */
function calculateTrustworthinessScore(
  isCorrect: boolean, 
  confidence: number | null,
  hasConfidence: boolean = true
): number {
  // For external data without confidence, return pure correctness
  if (!hasConfidence || confidence === null) {
    return isCorrect ? 1.0 : 0.0;
  }
  
  // Normalize confidence to 0-1 range
  const normalizedConfidence = Math.max(0, Math.min(100, confidence)) / 100;
  
  if (isCorrect) {
    // Correct answers get higher scores
    // Even low confidence correct answers score well (minimum 0.5)
    return Math.max(0.5, 0.5 + (normalizedConfidence * 0.5));
  } else {
    // Incorrect answers: reward low confidence, penalize high confidence
    // Perfect calibration: 0% confidence wrong answer = 1.0 score
    // 50% confidence wrong = 0.5 score
    // 95%+ confidence wrong = very low score (0.05 or less)
    return 1.0 - normalizedConfidence;
  }
}
/**
 * Main validation function for solver mode responses
 * Works directly with arcJsonSchema.ts structure - no parsing needed
 * 
 * ⚠️ CRITICAL: For external data without confidence (e.g., HuggingFace), pass confidence=null
 * This will calculate pure correctness (0 or 1) instead of trustworthiness.
 * 
 * @param response - AI response with predicted output
 * @param correctAnswer - Expected correct output
 * @param promptId - Prompt identifier
 * @param confidence - Confidence level (1-100) or null for external data
 * @returns ValidationResult with correctness and trustworthiness/correctness score
 */
export function validateSolverResponse(
  response: any,
  correctAnswer: number[][],
  promptId: string,
  confidence: number | null = 50
): ValidationResult {
  // Validate solver mode responses AND custom prompts that may be attempting to solve
  // Custom prompts often ask AI to predict answers, so they should be validated too
  // FIXED: Use centralized isSolverMode function to include debate, educationalApproach, gepa
  const isValidatorSolverMode = isSolverMode(promptId);

  if (!isValidatorSolverMode) {
    return {
      predictedGrid: null,
      isPredictionCorrect: true,
      predictionAccuracyScore: 1.0,
      extractionMethod: 'not_solver_mode'
    };
  }

  // Handle nested response structure from OpenRouter services
  // OpenRouter returns: { result: { predictedOutput, confidence, ... }, tokenUsage, cost, ... }
  const analysisData = response.result || response;

  // Use clean confidence from arcJsonSchema response or nested structure
  // For external data, confidence will be null
  const actualConfidence = typeof analysisData.confidence === 'number' 
    ? (analysisData.confidence === 0 ? 50 : analysisData.confidence) 
    : confidence;
  const hasConfidence = actualConfidence !== null;

  // arcJsonSchema guarantees predictedOutput is a clean 2D integer array
  const predictedGrid = analysisData.predictedOutput;
  
  if (!predictedGrid || !Array.isArray(predictedGrid)) {
    return {
      predictedGrid: null,
      isPredictionCorrect: false,
      predictionAccuracyScore: calculateTrustworthinessScore(false, actualConfidence, hasConfidence),
      extractionMethod: 'no_predicted_output'
    };
  }

  // Validate dimensions and correctness
  const dimensionsMatch = validateGridDimensions(predictedGrid, correctAnswer);
  const isCorrect = dimensionsMatch && gridsAreEqual(predictedGrid, correctAnswer);
  const accuracyScore = calculateTrustworthinessScore(isCorrect, actualConfidence, hasConfidence);

  return {
    predictedGrid,
    isPredictionCorrect: isCorrect,
    predictionAccuracyScore: accuracyScore,
    extractionMethod: 'arcJsonSchema_clean'
  };
}

/**
 * Multi-test validation for solver responses  
 * Works directly with arcJsonSchema.ts structure - no parsing needed
 * 
 * ⚠️ CRITICAL: For external data without confidence (e.g., HuggingFace), pass confidence=null
 * This will calculate pure correctness rate instead of trustworthiness.
 * 
 * @param response - AI response with predicted outputs
 * @param correctAnswers - Expected correct outputs for all test cases
 * @param promptId - Prompt identifier
 * @param confidence - Confidence level (1-100) or null for external data
 * @returns MultiValidationResult with correctness and trustworthiness/correctness scores
 */
export function validateSolverResponseMulti(
  response: any,
  correctAnswers: number[][][],
  promptId: string,
  confidence: number | null = 50
): MultiValidationResult {
  // EMERGENCY DEBUG: Log the exact structure being passed to validator
  if (process.env.VALIDATOR_DEBUG === 'true') {
    console.log('[VALIDATOR-INPUT-DEBUG] response keys:', Object.keys(response));
    console.log('[VALIDATOR-INPUT-DEBUG] response._rawResponse:', response._rawResponse ? Object.keys(response._rawResponse) : 'no _rawResponse');
    console.log('[VALIDATOR-INPUT-DEBUG] response.predictedOutput1:', response.predictedOutput1);
    console.log('[VALIDATOR-INPUT-DEBUG] response._rawResponse?.predictedOutput1:', response._rawResponse?.predictedOutput1);
  }
  // Validate solver mode responses AND custom prompts that may be attempting to solve
  // Custom prompts often ask AI to predict answers, so they should be validated too
  // FIXED: Use centralized isSolverMode function to include debate, educationalApproach, gepa
  const isValidatorSolverMode = isSolverMode(promptId);
  if (!isValidatorSolverMode) {
    // Non-solver mode: return empty multi-test structure
    return {
      hasMultiplePredictions: false,
      multiplePredictedOutputs: [],
      multiTestResults: [],
      multiTestAllCorrect: true,
      multiTestAverageAccuracy: 1.0,
      multiTestPredictionGrids: [],
      extractionMethodSummary: 'not_solver_mode'
    };
  }

  // Handle nested response structure from OpenRouter services
  // OpenRouter returns: { result: { predictedOutput1, predictedOutput2, confidence, ... }, tokenUsage, cost, ... }
  const analysisData = response.result || response;

  // Use clean confidence from arcJsonSchema response or nested structure
  // For external data, confidence will be null
  const actualConfidence = typeof analysisData.confidence === 'number' 
    ? (analysisData.confidence === 0 ? 50 : analysisData.confidence) 
    : confidence;
  const hasConfidence = actualConfidence !== null;

  // CRITICAL FIX: Extract grids from _rawResponse where they actually exist
  const rawResponse = response._rawResponse || response._providerRawResponse || {};
  const predictedGrids: (number[][] | null)[] = [
    rawResponse.predictedOutput1 || analysisData.predictedOutput1 || response.predictedOutput1 || null,
    rawResponse.predictedOutput2 || analysisData.predictedOutput2 || response.predictedOutput2 || null,
    rawResponse.predictedOutput3 || analysisData.predictedOutput3 || response.predictedOutput3 || null
  ].slice(0, correctAnswers.length);

  // Pad or trim to match expected count
  while (predictedGrids.length < correctAnswers.length) {
    predictedGrids.push(null);
  }

  const itemResults: MultiValidationItemResult[] = [];
  let totalScore = 0;
  let allCorrect = true;

  for (let i = 0; i < correctAnswers.length; i++) {
    const expected = correctAnswers[i];
    const predicted = predictedGrids[i];

    if (!predicted || !Array.isArray(predicted)) {
      const score = calculateTrustworthinessScore(false, actualConfidence, hasConfidence);
      itemResults.push({
        index: i,
        predictedGrid: null,
        isPredictionCorrect: false,
        predictionAccuracyScore: score,
        extractionMethod: 'arcJsonSchema_clean',
        expectedDimensions: { rows: expected?.length || 0, cols: expected?.[0]?.length || 0 }
      });
      totalScore += score;
      allCorrect = false;
      continue;
    }

    const dimensionsMatch = validateGridDimensions(predicted, expected);
    const isCorrect = dimensionsMatch && gridsAreEqual(predicted, expected);
    const score = calculateTrustworthinessScore(isCorrect, actualConfidence, hasConfidence);
    
    itemResults.push({
      index: i,
      predictedGrid: predicted,
      isPredictionCorrect: isCorrect,
      predictionAccuracyScore: score,
      extractionMethod: 'arcJsonSchema_clean',
      expectedDimensions: { rows: expected.length, cols: expected[0]?.length || 0 }
    });
    totalScore += score;
    if (!isCorrect) allCorrect = false;
  }

  const averageScore = itemResults.length ? totalScore / itemResults.length : 0;

  // Return database-compatible field names for direct storage
  // CRITICAL FIX: Field names now match ExplanationRepository database schema
  // NOTE: multiTestAverageAccuracy contains TRUSTWORTHINESS for internal predictions (with confidence)
  //       or pure CORRECTNESS RATE for external data (without confidence)
  return {
    hasMultiplePredictions: true,                    // This is a multi-test case
    multiplePredictedOutputs: predictedGrids,        // All prediction grids
    multiTestResults: itemResults,                   // Detailed validation results per test
    multiTestAllCorrect: allCorrect,                 // Overall correctness flag
    multiTestAverageAccuracy: averageScore,          // TRUSTWORTHINESS (with confidence) or CORRECTNESS RATE (without)
    multiTestPredictionGrids: predictedGrids,        // Grid storage (same as multiplePredictedOutputs for consistency)
    extractionMethodSummary: 'arcJsonSchema_clean'  // Debug/logging info
  };
}
