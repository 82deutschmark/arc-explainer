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
  // Match what the database schema actually accepts
  [key: string]: any;
}

export interface ExplanationResponse {
  // This should match what the database returns via SQL aliases
  [key: string]: any;
}

export interface BulkExplanationStatus {
  [puzzleId: string]: {
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
  getExplanationForPuzzle(puzzleId: string): Promise<ExplanationResponse | null>;

  /**
   * Get all explanations for a puzzle (multiple models/attempts)
   */
  getExplanationsForPuzzle(puzzleId: string): Promise<ExplanationResponse[]>;

  /**
   * Get explanation by ID
   */
  getExplanationById(id: number): Promise<ExplanationResponse | null>;

  /**
   * Check if puzzle has any explanations
   */
  hasExplanation(puzzleId: string): Promise<boolean>;

  /**
   * Get bulk explanation status for multiple puzzles
   */
  getBulkExplanationStatus(puzzleIds: string[]): Promise<BulkExplanationStatus>;
}