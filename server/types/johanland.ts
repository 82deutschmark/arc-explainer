/**
 * Author: Claude Code using Haiku 4.5
 * Date: 2025-12-15
 * PURPOSE: TypeScript type definitions for Johan_Land_Solver_V6 submission format.
 *          Handles structured reasoning summaries with judge feedback and comprehensive
 *          metadata including detailed token usage and cost tracking.
 * SRP/DRY check: Pass - Single responsibility (type definitions only), no duplication
 */

/**
 * Single attempt within a Johan_Land puzzle submission
 * Includes grid answer, correctness flag, and comprehensive metadata
 */
export interface JohanLandAttempt {
  /**
   * The predicted output grid (2D array of 0-9 representing colors)
   */
  answer: number[][];

  /**
   * Whether this attempt was correct per the solver's own evaluation
   */
  correct: boolean;

  /**
   * Comprehensive metadata about the attempt execution
   */
  metadata: {
    /** Model name (typically "Johan_Land_Solver_V6") */
    model: string;

    /** Provider name (typically "Johan_Land") */
    provider: string;

    /** ISO 8601 start timestamp (e.g., "2025-12-15T10:03:33+00:00") */
    start_timestamp: string;

    /** ISO 8601 end timestamp */
    end_timestamp: string;

    /**
     * Array of message objects (usually has "NA" content for Johan_Land)
     * Format: [{index: 0, message: {role: "user", content: "NA"}}, ...]
     */
    choices: Array<{
      index: number;
      message: {
        role: string;
        content: string;
      };
    }>;

    /**
     * CRITICAL FIELD: Rich reasoning summary with structured sections
     * Format:
     * --- JUDGE FEEDBACK ---
     * Judge Rule Summary: [rule description]
     * Judge Audit Summary: [audit description]
     * Judge Consistency Check: [consistency status]
     *
     * --- EXAMPLE REASONING ---
     * [Detailed step-by-step reasoning about the problem and solution]
     *
     * This is the primary source for reasoning_log in the database
     */
    reasoning_summary: string;

    /**
     * Configuration parameters used for this attempt
     */
    kwargs: {
      background?: string;
      stream?: string;
      reasoning?: {
        effort?: string;
      };
      max_output_tokens?: string;
    };

    /**
     * Token usage statistics
     */
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;

      /**
       * Detailed breakdown of completion tokens
       */
      completion_tokens_details?: {
        reasoning_tokens?: number;
        accepted_prediction_tokens?: number;
        rejected_prediction_tokens?: number;
      };
    };

    /**
     * Cost breakdown in dollars
     */
    cost: {
      prompt_cost: number;
      completion_cost: number;
      reasoning_cost: number;
      total_cost: number;
    };

    /** The puzzle ID (8-character hex, e.g., "136b0064") */
    task_id: string;

    /** Index of the test pair (typically 0, but supports multi-test) */
    pair_index: number;

    /** Test run identifier (e.g., "Johan_Land_Solver_V6_Eval_2_Full_Run") */
    test_id: string;
  };
}

/**
 * Puzzle data containing attempt_1 and attempt_2
 * Represents a single puzzle entry from the submission JSON
 */
export interface JohanLandPuzzleData {
  attempt_1?: JohanLandAttempt;
  attempt_2?: JohanLandAttempt;
  [key: string]: JohanLandAttempt | undefined;
}

/**
 * Configuration for the ingestion process
 */
export interface JohanLandIngestionConfig {
  /** Path to submissions directory (e.g., "beetreeARC/logs/submissions") */
  submissionsDirectory: string;

  /** Dataset name for model identification (default: "Johan_Land_Solver_V6") */
  datasetName: string;

  /** Optional label to append to model name (e.g., "eval-2" → "Johan_Land_Solver_V6-eval-2-attempt1") */
  label?: string;

  /** Filter by ARC source (e.g., "ARC2-Eval") */
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';

  /** Maximum number of puzzles to process (undefined = all) */
  limit?: number;

  /** Preview mode: parse and validate but don't write to database */
  dryRun: boolean;

  /** Enable detailed logging */
  verbose: boolean;

  /** Overwrite existing entries instead of skipping */
  forceOverwrite: boolean;

  /** Skip puzzles that already exist in database (default: true) */
  skipDuplicates: boolean;

  /** Stop immediately on first error */
  stopOnError: boolean;

  /** Resume from specific puzzle ID (skips all before this) */
  resumeFrom?: string;
}

/**
 * Progress tracking during ingestion
 */
export interface JohanLandIngestionProgress {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  validationErrors: number;
  notFoundErrors: number;
  currentPuzzle: string;

  /** Details about successful ingestions */
  successDetails: Array<{
    puzzleId: string;
    isCorrect: boolean;
    accuracy?: number;
  }>;
}

/**
 * Extracted and transformed data ready for database insertion
 */
export interface JohanLandEnrichedAttempt {
  puzzleId: string;
  modelName: string;
  patternDescription: string;
  solvingStrategy: string;
  reasoningLog: string;
  hints: string[];
  confidence: number; // Johan_Land doesn't provide confidence

  // Token counts
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;

  // Cost
  estimatedCost: number;

  // Timing
  apiProcessingTimeMs: number;

  // Prediction
  predictedOutputGrid: number[][] | null;
  isPredictionCorrect: boolean | null;

  // Multi-test support (currently all single test)
  hasMultiplePredictions: boolean;
  multiplePredictedOutputs?: number[][][] | null;
  multiTestPredictionGrids?: number[][][] | null;
  multiTestResults?: any[] | null;
  multiTestAllCorrect?: boolean | null;
  multiTestAverageAccuracy?: number | null;

  // Prompt tracking
  systemPromptUsed: string | null;
  userPromptUsed: string | null;
  promptTemplateId: string;
  customPromptText: string | null;

  // Raw data preservation
  providerRawResponse: JohanLandAttempt['metadata'];

  // AI configuration
  temperature: number | null;
  reasoningEffort: string | null;
  reasoningVerbosity: string | null;
  reasoningSummaryType: string | null;
}

/**
 * Parsed explanation components extracted from reasoning_summary
 */
export interface ExtractedExplanation {
  pattern_description: string;
  solving_strategy: string;
  judge_feedback: string;
  full_reasoning: string;
}
