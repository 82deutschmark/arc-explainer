/**
 * Types for puzzles and related components in the ARC Explainer
 * This file contains interfaces and types used throughout the puzzle components
 * Author: Codex (GPT-5)
 * Date: 2025-12-24
 * PURPOSE: Add multi-test prediction grid typing and a theme option for AnalysisResultCard.
 * SRP/DRY check: Pass - type definitions only; no runtime behavior changes.
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
 * Size classes for grid cells - now more granular for better density
 */
export const SIZE_CLASSES = {
  tiny: "w-3 h-3 text-[10px]",      // For very large grids (>20x20)
  small: "w-4 h-4 text-xs",        // For large grids (15-20 dims)
  normal: "w-6 h-6 text-sm",       // For medium grids (6-14 dims)
  large: "w-8 h-8 text-base",      // For small grids (3-5 dims)
  xlarge: "w-10 h-10 text-lg"      // For tiny grids (1-2 dims)
} as const;

/**
 * Props for the GridCell component
 */
export interface GridCellProps {
  value: number;
  showEmojis: boolean;
  showColorOnly?: boolean;
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
  showColorOnly?: boolean;
  highlight?: boolean;
  emojiSet?: EmojiSet;
  diffMask?: boolean[][]; // Optional mask to highlight mismatched cells
  maxWidth?: number;      // DEPRECATED - kept for backwards compatibility but not enforced
  maxHeight?: number;     // DEPRECATED - kept for backwards compatibility but not enforced
  preserveAspectRatio?: boolean; // DEPRECATED - not used anymore
  compact?: boolean;      // Use minimal spacing for dense layouts (default: false)
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
  // Prompt transparency fields - show users what was actually sent to AI
  systemPromptUsed?: string | null; // System prompt that was sent to the AI model
  userPromptUsed?: string | null; // User prompt (including puzzle data) sent to the AI model
  promptTemplateId?: string | null; // Prompt template ID used (solver, explanation, custom, etc.)
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
  trustworthinessScore?: number | null; // Trustworthiness score (0-1) based on confidence and correctness
  extractionMethod?: string; // Method used to extract the grid
  // Multi-test validation fields (set by backend controller for multi-test cases)
  predictedOutputGrids?: (number[][] | null)[]; // Array of predicted grids from validateSolverResponseMulti
  multiTestPredictionGrids?: (number[][] | null)[]; // Sanitized multi-test grids from repository
  multiValidation?: Array<{ // Individual validation results from itemResults
    index: number;
    predictedGrid: number[][] | null;
    isPredictionCorrect: boolean;
    trustworthinessScore: number; // Trustworthiness score (0-1) for this specific test
    extractionMethod?: string;
    expectedDimensions?: { rows: number; cols: number };
  }>;
  allPredictionsCorrect?: boolean; // Whether all test predictions are correct (from allCorrect)
  averageTrustworthinessScore?: number; // Average trustworthiness across all tests (from averageAccuracyScore)
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
  theme?: 'light' | 'dark'; // Optional theme override for card styling
}
