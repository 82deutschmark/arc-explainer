/**
 * Response Validation Service for Solver Mode
 * Extracts predicted grids from AI responses and validates them against correct answers
 */

import { logger } from '../utils/logger.js';
import { extractPredictions } from './schemas/solver.js';

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

export interface MultiValidationResult {
  predictedGrids: (number[][] | null)[];
  itemResults: MultiValidationItemResult[];
  allCorrect: boolean;
  averageAccuracyScore: number;
  extractionMethodSummary?: string;
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
              const grid = JSON.parse(cleanedText);
              
              // Validate it's a proper numeric grid
              if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
                // Ensure all elements are integers
                const isValidNumericGrid = grid.every(row => 
                  Array.isArray(row) && row.every(cell => typeof cell === 'number' && Number.isInteger(cell))
                );
                
                if (isValidNumericGrid) {
                  logger.info(`Successfully extracted numeric grid via keyword search: ${JSON.stringify(grid)}`, 'validator');
                  return { grid, method: `keyword_${keyword.replace(':', '').replace(' ', '_')}` };
                } else {
                  logger.info(`Invalid grid: contains non-integer values`, 'validator');
                }
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
        const grid = JSON.parse(cleanedText);
        
        if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
          const isValidNumericGrid = grid.every(row => 
            Array.isArray(row) && row.every(cell => typeof cell === 'number' && Number.isInteger(cell))
          );
          
          if (isValidNumericGrid) {
            logger.info(`Successfully extracted numeric grid from markdown code block: ${JSON.stringify(grid)}`, 'validator');
            return { grid, method: 'markdown_code_block' };
          }
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
        
        const grid = JSON.parse(cleanedText);
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
            const grid = JSON.parse(cleanedText);
            
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
        const grid = JSON.parse(cleaned);
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
      const grid = JSON.parse(cleaned);
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
 * Calculates prediction accuracy score based on correctness and confidence
 * Rewards honest uncertainty and penalizes overconfidence
 * 
 * Perfect Calibration: 0% confidence + wrong = 100% confidence + correct = 1.0 score
 * Honest Low Confidence: Low confidence + wrong gets rewarded
 * Dangerous Overconfidence: 95%+ confidence + wrong gets heavily penalized
 */
function calculateAccuracyScore(isCorrect: boolean, confidence: number): number {
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
 */
export function validateSolverResponse(
  response: any,
  correctAnswer: number[][],
  promptId: string,
  confidence: number = 50
): ValidationResult {
  // Only validate solver mode responses
  const isSolverMode = promptId === "solver";
  
  if (!isSolverMode) {
    return {
      predictedGrid: null,
      isPredictionCorrect: true, // Non-solver mode is always "correct"
      predictionAccuracyScore: 1.0,
      extractionMethod: 'not_solver_mode'
    };
  }

  if (!response?.solvingStrategy) {
    logger.warn('No solving strategy found in solver response', 'validator');
    return {
      predictedGrid: null,
      isPredictionCorrect: false,
      predictionAccuracyScore: calculateAccuracyScore(false, confidence),
      extractionMethod: 'no_solving_strategy'
    };
  }

  // Try to extract grid from predictedOutput field first, then fall back to solvingStrategy text
  let predictedGrid: number[][] | null = null;
  let method = '';
  
  // First, check if there's a direct predictedOutput field
  if (response.predictedOutput && Array.isArray(response.predictedOutput)) {
    // Validate it's a proper numeric grid
    const isValidNumericGrid = response.predictedOutput.every((row: any) => 
      Array.isArray(row) && row.every((cell: any) => typeof cell === 'number' && Number.isInteger(cell))
    );
    
    if (isValidNumericGrid) {
      predictedGrid = response.predictedOutput;
      method = 'direct_predicted_output_field';
      logger.info(`Successfully extracted grid from predictedOutput field: ${JSON.stringify(predictedGrid)}`, 'validator');
    }
  }
  
  // Fall back to extracting from solving strategy text if no direct field found
  if (!predictedGrid) {
    const extractionResult = extractGridFromText(response.solvingStrategy);
    predictedGrid = extractionResult.grid;
    method = extractionResult.method;
  }
  
  if (!predictedGrid) {
    logger.warn('Could not extract predicted grid from response', 'validator');
    return {
      predictedGrid: null,
      isPredictionCorrect: false,
      predictionAccuracyScore: calculateAccuracyScore(false, confidence),
      extractionMethod: method
    };
  }

  // Validate dimensions
  if (!validateGridDimensions(predictedGrid, correctAnswer)) {
    logger.warn('Predicted grid dimensions do not match expected output', 'validator');
    return {
      predictedGrid,
      isPredictionCorrect: false,
      predictionAccuracyScore: calculateAccuracyScore(false, confidence),
      extractionMethod: method + '_wrong_dimensions'
    };
  }

  // Check if prediction is correct
  const isCorrect = gridsAreEqual(predictedGrid, correctAnswer);
  const accuracyScore = calculateAccuracyScore(isCorrect, confidence);

  logger.info(
    `Validation result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}, ` +
    `confidence: ${confidence}%, score: ${(accuracyScore * 100).toFixed(1)}%`,
    'validator'
  );

  return {
    predictedGrid,
    isPredictionCorrect: isCorrect,
    predictionAccuracyScore: accuracyScore,
    extractionMethod: method
  };
}

/**
 * Multi-test validation for solver responses
 * Attempts to read `predictedOutputs` (array of grids). If absent, extracts multiple grids
 * from `solvingStrategy` text. Validates each predicted grid against corresponding expected output.
 */
export function validateSolverResponseMulti(
  response: any,
  correctAnswers: number[][][],
  promptId: string,
  confidence: number = 50
): MultiValidationResult {
  const isSolverMode = promptId === 'solver';
  if (!isSolverMode) {
    return {
      predictedGrids: [],
      itemResults: [],
      allCorrect: true,
      averageAccuracyScore: 1.0,
      extractionMethodSummary: 'not_solver_mode'
    };
  }

  // Collect candidate predicted grids
  let predictedGrids: (number[][] | null)[] = [];
  let extractionMethod = '';

  // Use the new centralized extraction logic
  const extracted = extractPredictions(response, correctAnswers.length);

  if (extracted.predictedOutputs) {
    predictedGrids = extracted.predictedOutputs;
    extractionMethod = 'direct_predicted_outputs_field'; // Covers new and old formats
  } else if (extracted.predictedOutput) {
    predictedGrids = [extracted.predictedOutput]; // Handle single case returned for multi-test puzzle
    extractionMethod = 'direct_predicted_output_field';
  } else {
    // Fallback: extract multiple from solvingStrategy text
    const text = response?.solvingStrategy || '';
    const { grids, method } = extractAllGridsFromText(text);
    predictedGrids = grids.length ? grids : [];
    extractionMethod = method || 'not_found';
  }

  // Align counts: ensure we have the same number as expected answers
  if (predictedGrids.length < correctAnswers.length) {
    // pad with nulls
    predictedGrids = predictedGrids.concat(
      Array(correctAnswers.length - predictedGrids.length).fill(null)
    );
  } else if (predictedGrids.length > correctAnswers.length) {
    // trim extras
    predictedGrids = predictedGrids.slice(0, correctAnswers.length);
  }

  const itemResults: MultiValidationItemResult[] = [];
  let totalScore = 0;
  let allCorrect = true;

  for (let i = 0; i < correctAnswers.length; i++) {
    const expected = correctAnswers[i];
    const predicted = predictedGrids[i];

    if (!predicted) {
      const score = calculateAccuracyScore(false, confidence);
      itemResults.push({
        index: i,
        predictedGrid: null,
        isPredictionCorrect: false,
        predictionAccuracyScore: score,
        extractionMethod: extractionMethod,
        expectedDimensions: { rows: expected.length, cols: expected[0]?.length || 0 }
      });
      totalScore += score;
      allCorrect = false;
      continue;
    }

    // Validate dimensions
    if (!validateGridDimensions(predicted, expected)) {
      const score = calculateAccuracyScore(false, confidence);
      itemResults.push({
        index: i,
        predictedGrid: predicted,
        isPredictionCorrect: false,
        predictionAccuracyScore: score,
        extractionMethod: extractionMethod + '_wrong_dimensions',
        expectedDimensions: { rows: expected.length, cols: expected[0]?.length || 0 }
      });
      totalScore += score;
      allCorrect = false;
      continue;
    }

    const isCorrect = gridsAreEqual(predicted, expected);
    const score = calculateAccuracyScore(isCorrect, confidence);
    itemResults.push({
      index: i,
      predictedGrid: predicted,
      isPredictionCorrect: isCorrect,
      predictionAccuracyScore: score,
      extractionMethod,
      expectedDimensions: { rows: expected.length, cols: expected[0]?.length || 0 }
    });
    totalScore += score;
    if (!isCorrect) allCorrect = false;
  }

  const averageAccuracyScore = itemResults.length
    ? totalScore / itemResults.length
    : 0;

  return {
    predictedGrids,
    itemResults,
    allCorrect,
    averageAccuracyScore,
    extractionMethodSummary: extractionMethod
  };
}