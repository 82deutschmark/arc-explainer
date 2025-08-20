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

  // Strategy 1: Look for "predicted output grid is [[...]]" pattern
  const patterns = [
    /predicted\s+output\s+grid\s+is\s*(\[\[[\d\s,\]]+\])/gi,
    /output\s*:\s*(\[\[[\d\s,\]]+\])/gi,
    /answer\s*:\s*(\[\[[\d\s,\]]+\])/gi,
    /output\s+grid\s*:\s*(\[\[[\d\s,\]]+\])/gi,
    /solution\s*:\s*(\[\[[\d\s,\]]+\])/gi,
    /result\s*:\s*(\[\[[\d\s,\]]+\])/gi
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

  // Strategy 2: Look for any 2D array in the text
  const anyArrayPattern = /(\[\[[\d\s,\]]+\])/g;
  const arrayMatches = text.match(anyArrayPattern);
  
  if (arrayMatches) {
    for (const match of arrayMatches) {
      try {
        const cleanedText = match
          .replace(/\s+/g, ' ')
          .replace(/,\s*]/g, ']')
          .replace(/,\s*,/g, ',');
        
        const grid = JSON.parse(cleanedText);
        if (Array.isArray(grid) && grid.length > 0 && Array.isArray(grid[0])) {
          return { grid, method: 'any_array' };
        }
      } catch (error) {
        // Continue to next match
      }
    }
  }

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

  // Extract grid from solving strategy text
  const { grid: predictedGrid, method } = extractGridFromText(response.solvingStrategy);
  
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