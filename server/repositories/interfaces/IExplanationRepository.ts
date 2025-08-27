/**
 * Explanation Repository Interface
 * 
 * Defines the contract for explanation data access operations.
 * Separates explanation-related database operations from other concerns.
 * 
 * @author Claude
 * @date 2025-08-27
 */

export interface ExplanationData {
  taskId: string;
  patternDescription: string;
  solvingStrategy?: string;
  hints?: string[];
  confidence: number;
  modelName?: string;
  reasoningLog?: string | null;
  hasReasoningLog?: boolean;
  apiProcessingTimeMs?: number | null;
  estimatedCost?: number | null;
  temperature?: number;
  reasoningEffort?: string | null;
  reasoningVerbosity?: string | null;
  reasoningSummaryType?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  predictedOutputGrid?: number[][] | null;
  multiplePredictedOutputs?: number[][][] | null;
  multiTestResults?: any[] | null;
  saturnSuccess?: boolean | null;
  saturnImages?: string[] | null;
  saturnLog?: string | null;
  saturnEvents?: string | null;
}

export interface ExplanationResponse {
  id: number;
  taskId: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number;
  modelName?: string;
  reasoningLog?: string | null;
  hasReasoningLog: boolean;
  createdAt: Date;
  apiProcessingTimeMs?: number | null;
  estimatedCost?: number | null;
  temperature?: number;
  reasoningEffort?: string | null;
  reasoningVerbosity?: string | null;
  reasoningSummaryType?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  predictedOutputGrid?: number[][] | null;
  multiplePredictedOutputs?: number[][][] | null;
  multiTestResults?: any[] | null;
  saturnSuccess?: boolean | null;
  saturnImages?: string[] | null;
  saturnLog?: string | null;
  saturnEvents?: string | null;
}

export interface BulkExplanationStatus {
  [taskId: string]: {
    hasExplanation: boolean;
    explanationId: number | null;
    feedbackCount: number;
    apiProcessingTimeMs: number | null;
    modelName: string | null;
    createdAt: Date | null;
    confidence: number | null;
    estimatedCost: number | null;
  };
}

/**
 * Interface for Explanation Repository
 */
export interface IExplanationRepository {
  /**
   * Save a new explanation for a puzzle
   */
  saveExplanation(data: ExplanationData): Promise<ExplanationResponse>;

  /**
   * Get the most recent explanation for a puzzle
   */
  getExplanationForPuzzle(taskId: string): Promise<ExplanationResponse | null>;

  /**
   * Get all explanations for a puzzle (multiple models/attempts)
   */
  getExplanationsForPuzzle(taskId: string): Promise<ExplanationResponse[]>;

  /**
   * Get explanation by ID
   */
  getExplanationById(id: number): Promise<ExplanationResponse | null>;

  /**
   * Check if puzzle has any explanations
   */
  hasExplanation(taskId: string): Promise<boolean>;

  /**
   * Get bulk explanation status for multiple puzzles
   */
  getBulkExplanationStatus(taskIds: string[]): Promise<BulkExplanationStatus>;
}