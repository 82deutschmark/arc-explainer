/**
 * ARC Task Structure Business Logic
 * 
 * This file enshrines the fundamental understanding of ARC tasks to prevent
 * confusion between training examples and test cases across all components.
 * 
 * CRITICAL UNDERSTANDING:
 * - `train` array: 2-9 examples showing input→output transformations to learn pattern
 * - `test` array: Usually 1, sometimes 2 test cases requiring separate predictions
 * - Multi-test scenarios: LLM generates SEPARATE predictions for DIFFERENT input grids
 * 
 * @author Cascade
 */

import { ARCTask } from './types';

/**
 * Business logic types that enforce proper ARC task understanding
 */

export interface ARCTrainingExample {
  input: number[][];
  output: number[][];
  _meta: 'TRAINING_EXAMPLE'; // Prevents confusion with test cases
}

export interface ARCTestCase {
  input: number[][];
  output: number[][]; // Ground truth for validation
  _meta: 'TEST_CASE'; // Prevents confusion with training examples
}

export interface ARCTaskStructure {
  /** Training examples showing the pattern (2-9 examples) */
  trainingExamples: ARCTrainingExample[];
  
  /** Test cases requiring predictions (usually 1, sometimes 2) */
  testCases: ARCTestCase[];
  
  /** Metadata to enforce understanding */
  _structure: {
    trainingCount: number;
    testCount: number;
    isMultiTest: boolean;
    requiresSeparatePredictions: boolean;
  };
}

/**
 * Utility functions for ARC task structure queries
 */

export class ARCTaskAnalyzer {
  
  /**
   * Analyze an ARC task and return structured understanding
   */
  static analyze(task: ARCTask): ARCTaskStructure {
    const trainingExamples: ARCTrainingExample[] = task.train.map(example => ({
      ...example,
      _meta: 'TRAINING_EXAMPLE' as const
    }));
    
    const testCases: ARCTestCase[] = task.test.map(testCase => ({
      ...testCase,
      _meta: 'TEST_CASE' as const
    }));
    
    const trainingCount = trainingExamples.length;
    const testCount = testCases.length;
    const isMultiTest = testCount > 1;
    
    return {
      trainingExamples,
      testCases,
      _structure: {
        trainingCount,
        testCount,
        isMultiTest,
        requiresSeparatePredictions: isMultiTest
      }
    };
  }
  
  /**
   * Get all expected output grids (for UI validation display)
   */
  static getExpectedOutputs(task: ARCTask): number[][][] {
    return task.test.map(testCase => testCase.output);
  }
  
  /**
   * Check if task requires multiple separate predictions
   */
  static requiresMultiplePredictions(task: ARCTask): boolean {
    return task.test.length > 1;
  }
  
  /**
   * Get test case count for validation logic
   */
  static getTestCaseCount(task: ARCTask): number {
    return task.test.length;
  }
  
  /**
   * Validate that predicted outputs match expected count
   */
  static validatePredictionCount(task: ARCTask, predictions: number[][][]): {
    isValid: boolean;
    expected: number;
    actual: number;
    error?: string;
  } {
    const expectedCount = task.test.length;
    const actualCount = predictions.length;
    
    if (actualCount !== expectedCount) {
      return {
        isValid: false,
        expected: expectedCount,
        actual: actualCount,
        error: `Expected ${expectedCount} prediction${expectedCount > 1 ? 's' : ''} for ${expectedCount} test case${expectedCount > 1 ? 's' : ''}, got ${actualCount}`
      };
    }
    
    return {
      isValid: true,
      expected: expectedCount,
      actual: actualCount
    };
  }
  
  /**
   * Get human-readable description of task structure
   */
  static getStructureDescription(task: ARCTask): string {
    const trainingCount = task.train.length;
    const testCount = task.test.length;
    
    if (testCount === 1) {
      return `${trainingCount} training examples → 1 test case (single prediction required)`;
    } else {
      return `${trainingCount} training examples → ${testCount} test cases (${testCount} separate predictions required)`;
    }
  }
}

/**
 * Validation functions to prevent train/test confusion
 */

export class ARCTaskValidator {
  
  /**
   * Ensure component is handling test cases correctly (not training examples)
   */
  static validateTestCaseHandling(
    componentName: string,
    task: ARCTask,
    handlingMode: 'SINGLE_TEST' | 'MULTI_TEST'
  ): void {
    const testCount = task.test.length;
    
    if (handlingMode === 'SINGLE_TEST' && testCount > 1) {
      throw new Error(
        `[${componentName}] Component configured for single-test handling but task has ${testCount} test cases. ` +
        `This will cause incorrect display/validation. Use MULTI_TEST mode.`
      );
    }
    
    if (handlingMode === 'MULTI_TEST' && testCount === 1) {
      console.warn(
        `[${componentName}] Component configured for multi-test handling but task has only 1 test case. ` +
        `This is safe but may show unnecessary complexity.`
      );
    }
  }
  
  /**
   * Validate that UI components receive correct expected outputs
   */
  static validateExpectedOutputsForUI(
    componentName: string,
    task: ARCTask,
    allExpectedOutputGrids: number[][][]
  ): void {
    const expectedCount = task.test.length;
    const actualCount = allExpectedOutputGrids.length;
    
    if (actualCount !== expectedCount) {
      throw new Error(
        `[${componentName}] Incorrect expected outputs count. ` +
        `Task has ${expectedCount} test case${expectedCount > 1 ? 's' : ''} but component received ${actualCount} expected output grid${actualCount > 1 ? 's' : ''}. ` +
        `This will cause validation mismatches.`
      );
    }
  }
  
  /**
   * Prevent components from accidentally using training data as test data
   */
  static preventTrainTestConfusion(
    componentName: string,
    gridsBeingUsed: number[][][],
    intendedPurpose: 'TRAINING_DISPLAY' | 'TEST_VALIDATION' | 'EXPECTED_OUTPUTS'
  ): void {
    if (intendedPurpose === 'TEST_VALIDATION' || intendedPurpose === 'EXPECTED_OUTPUTS') {
      // Add runtime checks to ensure grids match test case structure
      console.log(`[${componentName}] Using ${gridsBeingUsed.length} grid(s) for ${intendedPurpose}`);
    }
  }
}

/**
 * Constants for system-wide consistency
 */
export const ARC_STRUCTURE_CONSTANTS = {
  /** Typical training example count range */
  TYPICAL_TRAINING_COUNT: { min: 2, max: 9 },
  
  /** Test case count possibilities */
  POSSIBLE_TEST_COUNTS: [1, 2],
  
  /** Multi-test puzzle examples for testing */
  KNOWN_MULTI_TEST_PUZZLES: ['9110e3c5'],
  
  /** Error messages */
  ERRORS: {
    TRAIN_TEST_CONFUSION: 'Component is confusing training examples with test cases',
    INCORRECT_PREDICTION_COUNT: 'Prediction count does not match test case count',
    MISSING_MULTI_TEST_SUPPORT: 'Component lacks multi-test case support',
  }
} as const;
