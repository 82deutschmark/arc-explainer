/**
 * BeeTree Data Structure Types
 *
 * Author: Claude Code using Sonnet 4.5
 * Date: 2025-01-12
 * PURPOSE: TypeScript type definitions for BeeTree solver output formats including submission files,
 *          step logs, and ensemble metadata. Used for type-safe ingestion of BeeTree results.
 *
 * SRP/DRY check: Pass - Single responsibility (type definitions only), no duplication.
 */

/**
 * BeeTree submission file format: one entry per test case with two attempts
 */
export interface BeeTreeTestEntry {
  attempt_1: number[][];
  attempt_2: number[][];
}

/**
 * Top-level BeeTree submission structure: tasks mapped to array of test entries
 */
export interface BeeTreeSubmission {
  [taskId: string]: BeeTreeTestEntry[];
}

/**
 * Individual model run entry from step logs (step_1, step_3, step_5)
 */
export interface BeeTreeRunEntry {
  duration_seconds: number;
  total_cost: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  'Full raw LLM call': string;        // The prompt sent to the model
  'Full raw LLM response': string;    // Complete LLM response text
  'Extracted grid': number[][] | null;
}

/**
 * Step log structure: run_id mapped to run entry
 */
export interface BeeTreeStepLog {
  [runId: string]: BeeTreeRunEntry;
}

/**
 * Candidate grid info with vote count and contributing models
 */
export interface BeeTreeCandidate {
  grid: number[][];
  count: number;
  models: string[];
  is_correct: boolean | null;
}

/**
 * Candidates object: grid tuples (as strings) mapped to candidate info
 */
export interface BeeTreeCandidatesObject {
  [gridTuple: string]: BeeTreeCandidate;
}

/**
 * Step finish log: final evaluation with picked solutions
 */
export interface BeeTreeStepFinish {
  candidates_object: BeeTreeCandidatesObject;
  picked_solutions: BeeTreeCandidate[];
  result: 'PASS' | 'FAIL' | 'SUBMITTED';
  correct_solution: number[][] | null;
}

/**
 * Parsed run information extracted from logs
 */
export interface BeeTreeParsedRun {
  run_id: string;
  model_name: string;              // Extracted from run_id (e.g., 'claude-opus-4.5')
  step: number;                     // Step number (1, 3, or 5)
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  cost: number;
  duration_seconds: number;
  full_response: string;
  grid: number[][] | null;
}

/**
 * Aggregated data for one attempt across all tests
 */
export interface BeeTreeAttemptData {
  grids: number[][][];                    // One grid per test
  contributing_runs: BeeTreeParsedRun[];  // All runs that contributed to this attempt
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  pattern_description: string;            // Extracted from winning model's response
  solving_strategy: string;               // Extracted from winning model's response
  reasoning_log: string;                  // Full LLM response from winning model
  vote_count: number;                     // How many models agreed on this grid
  total_runs: number;                     // Total runs executed
  agreement_rate: number;                 // vote_count / total_runs
}

/**
 * Ensemble metadata to store in provider_raw_response
 */
export interface BeeTreeEnsembleMetadata {
  beetree_metadata: {
    version: string;
    candidates_object: BeeTreeCandidatesObject;
    picked_solution: BeeTreeCandidate;
    contributing_models: Array<{
      run_id: string;
      model_name: string;
      step: number;
      input_tokens: number;
      output_tokens: number;
      cost: number;
      duration_seconds: number;
      grid: number[][] | null;
    }>;
    vote_count: number;
    total_runs: number;
    agreement_rate: number;
  };
}

/**
 * Log file index entry for quick lookup
 */
export interface BeeTreeLogIndex {
  task_id: string;
  test_index: number;
  timestamp: string;
  step_1_path?: string;
  step_3_path?: string;
  step_5_path?: string;
  step_finish_path: string;
}

/**
 * Ingestion configuration from CLI args
 */
export interface BeeTreeIngestionConfig {
  submissionFile: string;
  logsDirectory: string;
  datasetName: string;
  label?: string;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';
  limit?: number;
  dryRun: boolean;
  verbose: boolean;
  forceOverwrite: boolean;
  skipDuplicates: boolean;
  stopOnError: boolean;
  resumeFrom?: string;
  onlyMissing: boolean;
}

/**
 * Ingestion progress tracking
 */
export interface BeeTreeIngestionProgress {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  validationErrors: number;
  notFoundErrors: number;
}

/**
 * Per-puzzle processing result
 */
export interface BeeTreePuzzleResult {
  puzzleId: string;
  status: 'success' | 'failed' | 'skipped' | 'validation_error' | 'not_found';
  error?: string;
  attempts_processed: number;
}
