/**
 * Response Validation Service for Solver Mode
 * Extracts predicted grids from AI responses and validates them against correct answers
 */

import { logger } from '../utils/logger.js';

export interface ValidationResult {
  predictedGrid: number[][] | null;
  isPredictionCorrect: boolean;
  predictionAccuracyScore: number;
  extractionMethod?: string;
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
      // Look for [[ after the keyword
      const afterKeyword = text.substring(index + keyword.length);
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