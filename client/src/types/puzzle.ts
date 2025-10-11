/**
 * Types for puzzles and related components in the ARC Explainer
 * This file contains interfaces and types used throughout the puzzle components
 * Author: Cascade
 */

import type { EmojiSet } from '@/lib/spaceEmojis';
import type { ModelConfig } from '@shared/types';

/**
 * Analysis result from an AI model examining a puzzle
 */
export interface AnalysisResult {
  id?: number;
  modelKey?: string;
  patternDescription?: string;
  solvingStrategy?: string;
  alienMeaning?: string;
  hints?: string[];
  patternConfidence?: number;
  strategyConfidence?: number;
  hintsConfidence?: number;
  alienMeaningConfidence?: number | string;
  confidence?: number | string;
  explanationId?: number; // Link to the saved explanation in the database
  helpfulVotes?: number;
  notHelpfulVotes?: number;
  reasoningLog?: string | null; // Step-by-step reasoning from AI models
  hasReasoningLog?: boolean; // Whether reasoning log is available
}

/**
 * Size classes for grid cells
 */
export const SIZE_CLASSES = {
  small: "w-4 h-4 text-xs",
  normal: "w-6 h-6 text-sm", 
  large: "w-8 h-8 text-base"
} as const;

/**
 * Props for the GridCell component
 */
export interface GridCellProps {
  value: number;
  showEmojis: boolean;
  size?: keyof typeof SIZE_CLASSES;
  emojiSet?: EmojiSet;
  mismatch?: boolean; // Compact diff overlay indicator
}

/**
 * Props for the PuzzleGrid component
 */
export interface PuzzleGridProps {
  grid: number[][];
  title: string;
  showEmojis: boolean;
  highlight?: boolean;
  emojiSet?: EmojiSet;
  diffMask?: boolean[][]; // Optional mask to highlight mismatched cells
}

/**
 * Props for the ModelButton component
 */
export interface ModelButtonProps {
  model: ModelConfig;
  isAnalyzing: boolean;
  isStreaming?: boolean;
  streamingSupported?: boolean;
  explanationCount: number;
  onAnalyze: (modelKey: string) => void;
  disabled: boolean;
  error?: Error | null;
}

/**
 * Props for the AnalysisResultCard component
 */
/**
 * Data structure for an explanation object fetched from the database
 */
export interface ExplanationData {
  id: number;
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  alienMeaning: string;
  confidence: number | string;
  alienMeaningConfidence?: number | string;
  helpfulVotes: number | null; // Can be null from DB
  notHelpfulVotes: number | null; // Can be null from DB
  createdAt: string;
  explanationId?: number; // Add this back as it's used in components
  reasoningLog?: string | null; // Step-by-step reasoning from AI models
  reasoningItems?: string[] | null; // Structured reasoning steps from OpenAI Responses API
  hasReasoningLog?: boolean; // Whether reasoning log is available
  providerResponseId?: string | null; // Response ID from AI provider for conversation chaining
  apiProcessingTimeMs?: number; // Backend API processing time in milliseconds
  // Saturn-specific fields
  saturnSuccess?: boolean | null; // Whether Saturn solver successfully solved the puzzle
  saturnImages?: string[]; // Array of image paths generated during Saturn analysis
  saturnLog?: string | null; // Verbose stdout/stderr logs from Saturn solver
  saturnEvents?: string | null; // Compressed NDJSON/JSON event trace
  // Grover iterative solver fields
  groverIterations?: any[] | null; // Array of iteration data from Grover solver
  groverBestProgram?: string | null; // Best Python program discovered by Grover
  iterationCount?: number | null; // Total number of iterations completed
  // Solver mode validation fields
  predictedOutputGrid?: number[][] | null; // Grid extracted from AI response
  isPredictionCorrect?: boolean | null; // Whether prediction matches correct answer
  predictionAccuracyScore?: number | null; // Accuracy score (0-1) based on confidence and correctness
  extractionMethod?: string; // Method used to extract the grid
  // Multi-test validation fields (set by backend controller for multi-test cases)
  predictedOutputGrids?: (number[][] | null)[]; // Array of predicted grids from validateSolverResponseMulti
  multiValidation?: Array<{ // Individual validation results from itemResults
    index: number;
    predictedGrid: number[][] | null;
    isPredictionCorrect: boolean;
    predictionAccuracyScore: number; // Trustworthiness score (0-1) for this specific test
    extractionMethod?: string;
    expectedDimensions?: { rows: number; cols: number };
  }>;
  allPredictionsCorrect?: boolean; // Whether all test predictions are correct (from allCorrect)
  averagePredictionAccuracyScore?: number; // Average trustworthiness across all tests (from averageAccuracyScore)
  // Database field names for multi-test data (raw storage format)
  multiplePredictedOutputs?: number[][][] | null; // Raw database field: array of predicted grids
  multiTestResults?: Array<any> | null; // Raw database field: validation results
  multiTestAllCorrect?: boolean | null; // Raw database field: all predictions correct flag
  multiTestAverageAccuracy?: number | null; // Raw database field: average accuracy score
  hasMultiplePredictions?: boolean | null; // Raw database field: indicates if puzzle has multiple test cases
  // Analysis parameters used to generate this explanation
  temperature?: number | null;
  reasoningEffort?: string | null;
  reasoningVerbosity?: string | null;
  reasoningSummaryType?: string | null;
  // Token usage and cost tracking
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  estimatedCost?: number | null;
  // Rebuttal tracking
  rebuttingExplanationId?: number | null; // Link to explanation this is rebutting (debate mode)
  // Optimistic UI fields (only present during pending analysis)
  isOptimistic?: boolean; // Flag to indicate this is an optimistic/pending result
  status?: 'analyzing' | 'saving' | 'completed' | 'error'; // Current status of the analysis
  error?: string; // Error message if analysis failed
  startTime?: number; // Timestamp when analysis started
}

/**
 * A single test case for a puzzle, with an input and an output grid.
 */
export interface TestCase {
  input: number[][];
  output: number[][];
}

/**
 * Props for the AnalysisResultCard component
 */
export interface AnalysisResultCardProps {
  modelKey: string;
  result: ExplanationData; // Use the database type directly
  model?: ModelConfig;
  testCases: TestCase[]; // Pass the full test array, ensuring the card has all necessary data
  eloMode?: boolean; // Hide model identifying info for double-blind A/B testing
}
