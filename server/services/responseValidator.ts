/**
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-10-11 (major refactor)
 * PURPOSE: Response validation service with flexible grid extraction using multiple fallback strategies.
 * Validates predicted grids against correct answers for single-test and multi-test puzzles with accuracy
 * scoring and partial prediction support. Uses extractPredictions utility for field-name-agnostic extraction,
 * text parsing fallbacks, and salvages partial multi-test data (e.g., 1/3 grids found).
 *
 * CRITICAL UPDATE (2025-10-11): Validators now use extractPredictions() utility instead of hardcoded
 * field access. This enables:
 * - Multiple field name aliases (predictedOutput, output, solution, answer, result)
 * - Numbered fields (predictedOutput1, predictedOutput2, etc.)
 * - Array formats and TestCase objects
 * - Text extraction fallbacks when structured data missing
 * - Partial prediction support (accept 1/3 grids instead of rejecting all)
 *
 * SRP/DRY check: Pass - Single responsibility (response validation), reuses extraction utilities from
 * schemas/solver.ts instead of duplicating logic. Flexible extraction prevents data loss from format mismatches.
 */

import { logger } from '../utils/logger.ts';
import { extractPredictions } from './schemas/solver.ts';
import { jsonParser } from '../utils/JsonParser.js';
import { isSolverMode } from './prompts/systemPrompts.js';

export interface ValidationResult {
  predictedGrid: number[][] | null;
  isPredictionCorrect: boolean;
  trustworthinessScore: number;
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
  codeBlockRegex.lastIndex = 0; // Reset for safety
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
    /(\[\[\d+(?:\s*,\s*\d+)*\](?:\s*,\s*\[\d+(?:\s*,\s*\d+)*\])*\])/ // Removed 'g' flag
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
  codeBlockRegex.lastIndex = 0; // Reset before loop
  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    const candidate = blockMatch[1];
    if (/^[\s\S]*?\[\[[\s\S]*?\]\][\s\S]*?$/.test(candidate)) {
      try {
        const cleaned = candidate
          .replace(/\s+/g, ' ')
          .replace(/,\s*]/g, ']')
          .replace(/,\s*,/g, ',')
          .replace(/\[\s+/g, '[')
          .replace(/\s+]/g, ']');
        const result = jsonParser.parse(cleaned);
        if (!result.success) {
          logger.warn(`Failed to parse grid from markdown block: ${result.error}`, 'validator');
          continue; // Don't stop, just skip this candidate
        }
        const grid = result.data;
        if (Array.isArray(grid) && Array.isArray(grid[0])) {
          const valid = grid.every((row: any) => Array.isArray(row) && row.every((c: any) => Number.isInteger(c)));
          if (valid) {
            grids.push(grid);
            method = 'markdown_code_block_multi';
          }
        }
      } catch (e: any) {
        logger.warn(`Exception while parsing grid from markdown block: ${e.message}`, 'validator');
      }
    }
  }

  // 2) Generic pattern match throughout text
  const pattern = /(\[\[\d+(?:\s*,\s*\d+)*\](?:\s*,\s*\[\d+(?:\s*,\s*\d+)*\])*\])/g;
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0; // Reset before loop
  while ((m = pattern.exec(text)) !== null) {
    try {
      const cleaned = m[1]
        .replace(/\s+/g, ' ')
        .replace(/,\s*]/g, ']')
        .replace(/,\s*,/g, ',');
      const result = jsonParser.parse(cleaned);
      if (!result.success) {
        logger.warn(`Failed to parse grid from pattern match: ${result.error}`, 'validator');
        continue; // Skip this candidate
      }
      const grid = result.data;
      if (Array.isArray(grid) && Array.isArray(grid[0])) {
        const valid = grid.every((row: any) => Array.isArray(row) && row.every((c: any) => Number.isInteger(c)));
        if (valid) {
          grids.push(grid);
          if (method === 'not_found') method = 'pattern_multi';
        }
      }
    } catch (e: any) {
      logger.warn(`Exception while parsing grid from pattern match: ${e.message}`, 'validator');
    }
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
  if (!hasConfidence || typeof confidence !== 'number' || !Number.isFinite(confidence)) {
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
      trustworthinessScore: 1.0,
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

  // FLEXIBLE EXTRACTION: Use extractPredictions utility with multiple fallbacks
  let predictedGrid: number[][] | null = null;
  let extractionMethod = 'unknown';

  // Strategy 1: Try structured extraction using extractPredictions
  const extracted = extractPredictions(analysisData, 1);
  if (extracted.predictedOutput) {
    predictedGrid = extracted.predictedOutput;
    extractionMethod = 'extractPredictions_single';
  } else if (extracted.predictedOutputs && extracted.predictedOutputs.length > 0) {
    predictedGrid = extracted.predictedOutputs[0];
    extractionMethod = 'extractPredictions_array';
  }

  // Strategy 2: Try extracting from raw response
  if (!predictedGrid && response._rawResponse) {
    const rawExtracted = extractPredictions(response._rawResponse, 1);
    if (rawExtracted.predictedOutput) {
      predictedGrid = rawExtracted.predictedOutput;
      extractionMethod = 'extractPredictions_rawResponse';
    } else if (rawExtracted.predictedOutputs && rawExtracted.predictedOutputs.length > 0) {
      predictedGrid = rawExtracted.predictedOutputs[0];
      extractionMethod = 'extractPredictions_rawResponse_array';
    }
  }

  // Strategy 3: Text extraction fallback
  if (!predictedGrid) {
    const textSources = [
      analysisData.solvingStrategy,
      analysisData.patternDescription,
      analysisData.text,
      typeof response._rawResponse === 'string' ? response._rawResponse : null,
      typeof response._providerRawResponse === 'string' ? response._providerRawResponse : null
    ].filter(Boolean);

    for (const text of textSources) {
      if (text && typeof text === 'string') {
        const { grid, method } = extractGridFromText(text);
        if (grid) {
          predictedGrid = grid;
          extractionMethod = `text_${method}`;
          logger.info('Single-test: Recovered grid via text extraction', 'validator');
          break;
        }
      }
    }
  }
  
  if (!predictedGrid || !Array.isArray(predictedGrid)) {
    return {
      predictedGrid: null,
      isPredictionCorrect: false,
      trustworthinessScore: calculateTrustworthinessScore(false, actualConfidence, hasConfidence),
      extractionMethod: 'all_methods_failed'
    };
  }

  // Validate dimensions and correctness
  const dimensionsMatch = validateGridDimensions(predictedGrid, correctAnswer);
  const isCorrect = dimensionsMatch && gridsAreEqual(predictedGrid, correctAnswer);
  const trustworthiness = calculateTrustworthinessScore(isCorrect, actualConfidence, hasConfidence);

  return {
    predictedGrid,
    isPredictionCorrect: isCorrect,
    trustworthinessScore: trustworthiness,
    extractionMethod
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

  // FLEXIBLE EXTRACTION: Use extractPredictions utility instead of hardcoded field access
  // This handles multiple formats: numbered fields, arrays, aliases, TestCase objects
  let predictedGrids: (number[][] | null)[] = [];
  let extractionMethodSummary = 'unknown';

  // Strategy 1: Try structured extraction from response data
  const extracted = extractPredictions(analysisData, correctAnswers.length);
  if (extracted.predictedOutputs && extracted.predictedOutputs.length > 0) {
    predictedGrids = extracted.predictedOutputs;
    extractionMethodSummary = 'extractPredictions_structured';
    logger.info(`Multi-test: Extracted ${predictedGrids.length}/${correctAnswers.length} grids via extractPredictions`, 'validator');
  }

  // Strategy 2: Try extracting from raw response if structured extraction failed
  if (predictedGrids.length === 0 && response._rawResponse) {
    const rawExtracted = extractPredictions(response._rawResponse, correctAnswers.length);
    if (rawExtracted.predictedOutputs && rawExtracted.predictedOutputs.length > 0) {
      predictedGrids = rawExtracted.predictedOutputs;
      extractionMethodSummary = 'extractPredictions_rawResponse';
      logger.info(`Multi-test: Extracted ${predictedGrids.length}/${correctAnswers.length} grids from _rawResponse`, 'validator');
    }
  }

  // Strategy 3: Text extraction fallback if structured methods failed
  if (predictedGrids.length === 0) {
    const textSources = [
      analysisData.solvingStrategy,
      analysisData.patternDescription,
      analysisData.text,
      typeof response._rawResponse === 'string' ? response._rawResponse : null,
      typeof response._providerRawResponse === 'string' ? response._providerRawResponse : null
    ].filter(Boolean);

    for (const text of textSources) {
      if (text && typeof text === 'string') {
        const { grids, method } = extractAllGridsFromText(text);
        if (grids.length > 0) {
          predictedGrids = grids.slice(0, correctAnswers.length);
          extractionMethodSummary = `text_extraction_${method}`;
          logger.info(`Multi-test: Recovered ${predictedGrids.length}/${correctAnswers.length} grids via text extraction`, 'validator');
          break;
        }
      }
    }
  }

  // PARTIAL SUCCESS SUPPORT: Accept whatever grids we found, even if incomplete
  const foundCount = predictedGrids.filter(g => g !== null).length;
  if (foundCount > 0 && foundCount < correctAnswers.length) {
    logger.warn(`Multi-test: Partial success - found ${foundCount}/${correctAnswers.length} grids`, 'validator');
    extractionMethodSummary += '_partial';
  }

  // Pad with nulls to match expected count
  while (predictedGrids.length < correctAnswers.length) {
    predictedGrids.push(null);
  }

  // Trim if we somehow got too many
  predictedGrids = predictedGrids.slice(0, correctAnswers.length);

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
        trustworthinessScore: score,
        extractionMethod: extractionMethodSummary,
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
      trustworthinessScore: score,
      extractionMethod: extractionMethodSummary,
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
    extractionMethodSummary                          // Track how grids were extracted
  };
}
