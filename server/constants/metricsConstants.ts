/**
 * Metrics System Constants
 * 
 * Centralizes business logic constants and thresholds used across the metrics system.
 * Eliminates magic numbers and provides semantic meaning to numerical values.
 * 
 * Based on Phase 2A analysis findings and current usage patterns across repositories.
 * 
 * @author Claude Code Architecture Agent
 * @date 2025-09-11
 */

// ==================== CONFIDENCE THRESHOLDS ====================

export const CONFIDENCE_THRESHOLDS = {
  /**
   * High confidence threshold (≥90%)
   * Used in AccuracyRepository.getDangerousModels() for identifying overconfident models
   * Models above this threshold are considered "highly confident" in their predictions
   */
  HIGH_CONFIDENCE: 90,

  /**
   * Minimum confidence for statistical analysis
   * Filters out zero or extremely low confidence scores that may indicate data quality issues
   */
  MIN_STATISTICAL_CONFIDENCE: 0.1,

  /**
   * Perfect confidence score
   * Used to identify and potentially exclude perfect confidence scores which may be anomalous
   */
  PERFECT_CONFIDENCE: 100,
} as const;

// ==================== TRUSTWORTHINESS THRESHOLDS ====================

export const TRUSTWORTHINESS_THRESHOLDS = {
  /**
   * Minimum trustworthiness threshold (0.001)
   * Used in cost efficiency calculations to avoid division by zero and filter out invalid scores
   * Models below this threshold are considered to have essentially no trustworthiness
   */
  MIN_TRUSTWORTHINESS: 0.001,

  /**
   * Perfect trustworthiness score (1.0)
   * Used to identify perfect trustworthiness scores
   */
  PERFECT_TRUSTWORTHINESS: 1.0,

  /**
   * Zero confidence perfect trustworthiness filter
   * Edge case where trustworthiness_score = 1.0 AND confidence = 0
   * This combination is filtered out as it indicates potential data inconsistency
   */
  ZERO_CONFIDENCE_PERFECT_TRUST: {
    SCORE: 1.0,
    CONFIDENCE: 0,
  },
} as const;

// ==================== COST EFFICIENCY LIMITS ====================

export const COST_EFFICIENCY = {
  /**
   * Maximum cost efficiency value (999)
   * Cap for cost efficiency calculations to prevent extremely high values from skewing results
   * Used when trustworthiness is very low or when cost/trustworthiness ratio exceeds reasonable bounds
   */
  MAX_EFFICIENCY: 999,

  /**
   * Ultra-high cost efficiency cap (999999)
   * Used in TrustworthinessRepository for extreme outlier cases
   * Prevents infinite or extremely large efficiency scores from breaking calculations
   */
  ULTRA_HIGH_CAP: 999999,

  /**
   * Cost efficiency precision
   * Number of decimal places for cost efficiency calculations
   * Used to ensure consistent rounding across the system
   */
  PRECISION_DIGITS: 6,
} as const;

// ==================== RANKING AND FILTERING ====================

export const RANKING_CRITERIA = {
  /**
   * Minimum attempts for meaningful ranking (3)
   * Models must have at least this many attempts to be included in accuracy/trustworthiness rankings
   * Prevents models with insufficient data from appearing in leaderboards
   */
  MIN_ATTEMPTS_FOR_RANKING: 3,

  /**
   * Minimum attempts for high-confidence analysis (3)
   * Minimum number of high-confidence attempts needed for dangerous model analysis
   * Used in AccuracyRepository.getDangerousModels()
   */
  MIN_HIGH_CONFIDENCE_ATTEMPTS: 3,

  /**
   * Single attempt minimum (1)
   * Used for basic statistics where any attempt count is acceptable
   * Applied to general model stats and overview calculations
   */
  MIN_SINGLE_ATTEMPT: 1,

  /**
   * Default result limit for leaderboards (10)
   * Standard number of results to return for "top" rankings
   */
  DEFAULT_LEADERBOARD_LIMIT: 10,
} as const;

// ==================== DATA QUALITY FILTERS ====================

export const DATA_QUALITY = {
  /**
   * Model name validation
   * Ensures model_name field is not null for statistical inclusion
   */
  REQUIRE_MODEL_NAME: true,

  /**
   * Solver attempt validation  
   * Requires either predicted_output_grid OR multi_test_prediction_grids to be non-null
   * Identifies attempts where the AI actually tried to solve the puzzle
   */
  REQUIRE_SOLVER_ATTEMPT: true,

  /**
   * Trustworthiness validation
   * Excludes null trustworthiness scores and the edge case where
   * trustworthiness_score = 1.0 AND confidence = 0
   */
  REQUIRE_VALID_TRUSTWORTHINESS: true,

  /**
   * Confidence validation
   * Filters out null or zero confidence scores for meaningful analysis
   */
  REQUIRE_POSITIVE_CONFIDENCE: true,
} as const;

// ==================== PERFORMANCE METRICS ====================

export const PERFORMANCE_METRICS = {
  /**
   * API processing time thresholds (in milliseconds)
   */
  PROCESSING_TIME: {
    FAST: 1000,      // Under 1 second
    MEDIUM: 5000,    // 1-5 seconds
    SLOW: 15000,     // 5-15 seconds
    VERY_SLOW: 30000, // Over 30 seconds
  },

  /**
   * Cost analysis thresholds (in USD)
   */
  COST_THRESHOLDS: {
    LOW: 0.01,       // Under 1 cent
    MEDIUM: 0.10,    // 1-10 cents  
    HIGH: 1.00,      // 10 cents - $1
    VERY_HIGH: 10.00, // Over $10
  },
} as const;

// ==================== STATISTICAL CONSTANTS ====================

export const STATISTICS = {
  /**
   * Percentage calculation precision
   * Number of decimal places for accuracy and trustworthiness percentages
   */
  PERCENTAGE_PRECISION: 2,

  /**
   * Currency precision for cost calculations
   * Number of decimal places for monetary values
   */
  CURRENCY_PRECISION: 4,

  /**
   * Confidence interval for statistical significance
   * Used in advanced analytics (not currently implemented but reserved)
   */
  CONFIDENCE_INTERVAL: 0.95,
} as const;

// ==================== COMPOSITE CONSTANTS ====================

/**
 * Combined validation criteria for different analysis types
 * These compose the individual constants above for specific use cases
 */
export const ANALYSIS_CRITERIA = {
  /**
   * Standard model ranking criteria
   * Used for accuracy and trustworthiness leaderboards
   */
  STANDARD_RANKING: {
    minAttempts: RANKING_CRITERIA.MIN_ATTEMPTS_FOR_RANKING,
    requireModelName: DATA_QUALITY.REQUIRE_MODEL_NAME,
    requireSolverAttempt: DATA_QUALITY.REQUIRE_SOLVER_ATTEMPT,
  },

  /**
   * High-confidence analysis criteria
   * Used for identifying dangerous/overconfident models
   */
  HIGH_CONFIDENCE_ANALYSIS: {
    minConfidence: CONFIDENCE_THRESHOLDS.HIGH_CONFIDENCE,
    minAttempts: RANKING_CRITERIA.MIN_HIGH_CONFIDENCE_ATTEMPTS,
    requireModelName: DATA_QUALITY.REQUIRE_MODEL_NAME,
    requireSolverAttempt: DATA_QUALITY.REQUIRE_SOLVER_ATTEMPT,
  },

  /**
   * Trustworthiness analysis criteria
   * Used for trustworthiness calculations and cost efficiency
   */
  TRUSTWORTHINESS_ANALYSIS: {
    minTrustworthiness: TRUSTWORTHINESS_THRESHOLDS.MIN_TRUSTWORTHINESS,
    maxCostEfficiency: COST_EFFICIENCY.MAX_EFFICIENCY,
    requireValidTrustworthiness: DATA_QUALITY.REQUIRE_VALID_TRUSTWORTHINESS,
  },

  /**
   * Basic statistics criteria
   * Used for general model overview statistics
   */
  BASIC_STATISTICS: {
    minAttempts: RANKING_CRITERIA.MIN_SINGLE_ATTEMPT,
    requireModelName: DATA_QUALITY.REQUIRE_MODEL_NAME,
  },
} as const;

// ==================== TYPE EXPORTS ====================

/**
 * Type definitions for the constants
 * Ensures type safety when using constants throughout the system
 */
export type ConfidenceThreshold = typeof CONFIDENCE_THRESHOLDS[keyof typeof CONFIDENCE_THRESHOLDS];
export type TrustworthinessThreshold = typeof TRUSTWORTHINESS_THRESHOLDS[keyof typeof TRUSTWORTHINESS_THRESHOLDS];
export type CostEfficiencyLimit = typeof COST_EFFICIENCY[keyof typeof COST_EFFICIENCY];
export type RankingCriterion = typeof RANKING_CRITERIA[keyof typeof RANKING_CRITERIA];
export type PerformanceThreshold = typeof PERFORMANCE_METRICS[keyof typeof PERFORMANCE_METRICS];
export type AnalysisCriteria = typeof ANALYSIS_CRITERIA[keyof typeof ANALYSIS_CRITERIA];