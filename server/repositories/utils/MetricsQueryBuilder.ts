/**
 * MetricsQueryBuilder - DRY Utility for Common SQL Patterns
 * 
 * This utility eliminates code duplication across MetricsRepository, AccuracyRepository, 
 * TrustworthinessRepository, and FeedbackRepository by providing reusable SQL fragments.
 * 
 * Based on Phase 2A analysis, this consolidates 40+ duplicate patterns into reusable components.
 * 
 * @author Claude Code Architecture Agent
 * @date 2025-09-11
 */

export class MetricsQueryBuilder {
  
  // ==================== COMMON WHERE CLAUSES ====================
  
  /**
   * Standard model filtering - used 13 times across repositories
   * Ensures we only include explanations with valid model names
   */
  static modelFilter(tableAlias: string = 'e'): string {
    return `${tableAlias}.model_name IS NOT NULL`;
  }

  /**
   * Solver attempt detection - used 11 times across repositories  
   * Identifies explanations where AI attempted to solve the puzzle
   */
  static solverAttemptFilter(tableAlias: string = 'e'): string {
    return `(${tableAlias}.predicted_output_grid IS NOT NULL OR ${tableAlias}.multi_test_prediction_grids IS NOT NULL)`;
  }

  /**
   * Trustworthiness filtering - used 8 times across repositories
   * Excludes invalid trustworthiness scores and edge cases
   */
  static trustworthinessFilter(tableAlias: string = 'e'): string {
    return `${tableAlias}.trustworthiness_score IS NOT NULL
      AND NOT (${tableAlias}.trustworthiness_score = 1.0 AND ${tableAlias}.confidence = 0)`;
  }

  /**
   * Confidence filtering for statistical analysis
   * Used in conjunction with accuracy calculations
   */
  static confidenceFilter(tableAlias: string = 'e'): string {
    return `${tableAlias}.confidence IS NOT NULL AND ${tableAlias}.confidence > 0`;
  }

  /**
   * Original solver attempt filter - EXCLUDES debate rebuttals
   * Ensures accuracy stats only include pure 1-shot solver attempts
   *
   * Use this for:
   * - Pure solver accuracy (baseline AI performance)
   * - Model leaderboards (fair apples-to-apples comparison)
   * - Performance metrics (avoid mixing problem types)
   *
   * @param tableAlias Database table alias (default: 'e')
   * @returns SQL filter clause
   */
  static originalSolverFilter(tableAlias: string = 'e'): string {
    return `${tableAlias}.rebutting_explanation_id IS NULL`;
  }

  /**
   * Debate rebuttal filter - ONLY debate challenge responses
   * Use this for analyzing models' ability to challenge incorrect explanations
   *
   * @param tableAlias Database table alias (default: 'e')
   * @returns SQL filter clause
   */
  static debateRebuttalFilter(tableAlias: string = 'e'): string {
    return `${tableAlias}.rebutting_explanation_id IS NOT NULL`;
  }

  // ==================== COMMON SELECT FRAGMENTS ====================

  /**
   * Correctness calculation - used 15 times across repositories
   * Determines if prediction was correct (single or multiple tests)
   */
  static correctnessCalculation(tableAlias: string = 'e'): string {
    return `CASE WHEN ${tableAlias}.is_prediction_correct = true OR ${tableAlias}.multi_test_all_correct = true THEN 1 ELSE 0 END`;
  }

  /**
   * Accuracy percentage calculation
   * Computes percentage with null safety
   */
  static accuracyPercentage(correctCountExpr: string, totalCountExpr: string): string {
    return `CASE 
      WHEN ${totalCountExpr} > 0 
      THEN (${correctCountExpr} * 100.0 / ${totalCountExpr})
      ELSE 0 
    END`;
  }

  /**
   * Solver attempt count for performance metrics
   */
  static solverAttemptCount(tableAlias: string = 'e'): string {
    return `COUNT(CASE WHEN ${this.solverAttemptFilter(tableAlias)} THEN 1 END)`;
  }

  /**
   * Correct predictions count using standardized logic
   */
  static correctPredictionsCount(tableAlias: string = 'e'): string {
    return `SUM(${this.correctnessCalculation(tableAlias)})`;
  }

  /**
   * Confidence statistics for trustworthiness analysis - used 6 times
   */
  static confidenceStats(tableAlias: string = 'e'): string {
    return `AVG(CASE WHEN (${tableAlias}.is_prediction_correct = true OR ${tableAlias}.multi_test_all_correct = true) THEN ${tableAlias}.confidence END)`;
  }

  // ==================== COMMON AGGREGATIONS ====================

  /**
   * Basic model grouping and counting
   */
  static modelGroupBy(): string {
    return `GROUP BY e.model_name`;
  }

  /**
   * Standard model statistics aggregation
   */
  static basicModelStats(tableAlias: string = 'e'): string {
    return `${tableAlias}.model_name,
      COUNT(${tableAlias}.id) as total_attempts,
      COUNT(${tableAlias}.id) as total_explanations,
      AVG(${tableAlias}.confidence) as avg_confidence,
      ${this.solverAttemptCount(tableAlias)} as solver_attempts,
      ${this.correctPredictionsCount(tableAlias)} as correct_predictions`;
  }

  /**
   * Performance metrics aggregation
   */
  static performanceStats(tableAlias: string = 'e'): string {
    return `AVG(${tableAlias}.api_processing_time_ms) as avg_processing_time,
      SUM(${tableAlias}.estimated_cost) as total_cost,
      COUNT(${tableAlias}.id) as total_attempts`;
  }

  /**
   * Trustworthiness statistics aggregation
   */
  static trustworthinessStats(tableAlias: string = 'e'): string {
    return `AVG(${tableAlias}.trustworthiness_score) as avg_trustworthiness,
      COUNT(CASE WHEN ${this.trustworthinessFilter(tableAlias)} THEN 1 END) as trustworthiness_entries,
      ${this.confidenceStats(tableAlias)} as confidence_when_correct`;
  }

  // ==================== COMPLEX QUERY PATTERNS ====================

  /**
   * Model comparison base query structure
   * Used by generateModelComparisons() in MetricsRepository
   */
  static modelComparisonBase(): string {
    return `SELECT 
        ${this.basicModelStats()},
        ${this.trustworthinessStats()},
        ${this.performanceStats()}
      FROM explanations e
      WHERE ${this.modelFilter()}
        AND ${this.solverAttemptFilter()}
      ${this.modelGroupBy()}
      HAVING COUNT(e.id) >= 3`;
  }

  /**
   * Accuracy leaderboard query pattern
   * Used across AccuracyRepository methods
   */
  static accuracyLeaderboardBase(minAttempts: number = 3): string {
    return `SELECT 
        e.model_name,
        COUNT(e.id) as total_attempts,
        ${this.correctPredictionsCount()} as total_correct_predictions,
        ${this.accuracyPercentage(this.correctPredictionsCount(), 'COUNT(e.id)')} as accuracy
      FROM explanations e
      WHERE ${this.modelFilter()}
        AND ${this.solverAttemptFilter()}
      ${this.modelGroupBy()}
      HAVING COUNT(e.id) >= ${minAttempts}`;
  }

  /**
   * Trustworthiness leaderboard query pattern
   * Used across TrustworthinessRepository methods
   */
  static trustworthinessLeaderboardBase(minAttempts: number = 3): string {
    return `SELECT 
        e.model_name,
        COUNT(e.id) as total_attempts,
        ${this.trustworthinessStats()}
      FROM explanations e
      WHERE ${this.modelFilter()}
        AND ${this.trustworthinessFilter()}
      ${this.modelGroupBy()}
      HAVING COUNT(e.id) >= ${minAttempts}`;
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Combines multiple WHERE conditions with AND
   */
  static combineConditions(...conditions: string[]): string {
    return conditions.filter(c => c.trim()).join(' AND ');
  }

  /**
   * Adds LIMIT clause if specified
   */
  static addLimit(query: string, limit?: number): string {
    return limit ? `${query} LIMIT ${limit}` : query;
  }

  /**
   * Adds ORDER BY clause for rankings
   */
  static addOrderBy(query: string, orderBy: string, direction: 'ASC' | 'DESC' = 'DESC'): string {
    return `${query} ORDER BY ${orderBy} ${direction}`;
  }
}