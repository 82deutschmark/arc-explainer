/**
 * shared/types.ts
 * 
 * Shared TypeScript interfaces and types for the ARC-AGI Puzzle Explainer application.
 * Defines data structures for puzzles, metadata, analysis results, and prompt templates.
 * Used across both frontend and backend to ensure type safety and consistent data handling.
 * 
 * Key components:
 * - ARCTask/ARCExample: Core puzzle data structures
 * - PuzzleMetadata: Puzzle classification and metadata
 * - PuzzleAnalysis: AI analysis results structure
 * - PromptTemplate: Dynamic prompt system for AI analysis
 * - PROMPT_TEMPLATES: Predefined prompt templates for different explanation approaches
 * 
 * @author Cascade
 */

export interface ARCTask {
  train: ARCExample[];
  test: ARCExample[];
}

export interface ARCExample {
  input: number[][];
  output: number[][];
}

export interface PuzzleMetadata {
  id: string;
  gridSizeConsistent: boolean;
  patternType: string;
  maxGridSize: number;
  inputSize: [number, number];
  outputSize: [number, number];
  hasExplanation?: boolean;
  description?: string;
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy';
  importSource?: string; // Track which import/dataset this came from
  importDate?: Date;     // When it was imported
}

export interface PuzzleAnalysis {
  patternDescription: string;
  solvingStrategy: string;
  /** Optional structured breadcrumbs from analysis */
  keySteps?: string[];
  hints: string[];
  /** Confidence is 0-100 per backend schema */
  confidence: number;
  // Solver prediction fields (schema-aligned)
  /** Single-test prediction */
  predictedOutput?: number[][];
  /** Multi-test predictions */
  predictedOutputs?: number[][][];
  // Legacy/derived UI fields (back-compat with existing components)
  /** Deprecated: prefer predictedOutput/predictedOutputs */
  predictedOutputGrid?: number[][];
  isPredictionCorrect?: boolean;
  predictionAccuracyScore?: number;
}

export interface SolutionValidation {
  isCorrect: boolean;
  accuracy: number;
  feedback: string;
}

/**
 * Prompt template structure for AI analysis
 * Defines different system prompts that can be used for puzzle analysis
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  content: string;
  emojiMapIncluded: boolean;
}

/**
 * Interface for feedback data
 */
export interface Feedback {
  id: number;
  puzzleId: string;
  explanationId?: number | null;
  feedbackType: 'helpful' | 'not_helpful' | 'solution_explanation';
  comment: string | null;
  createdAt: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * Interface for detailed feedback with explanation context
 */
export interface DetailedFeedback extends Feedback {
  modelName: string;
  confidence: number;
  patternDescription: string;
}

/**
 * Interface for feedback filtering options
 */
export interface FeedbackFilters {
  puzzleId?: string;
  modelName?: string;
  feedbackType?: 'helpful' | 'not_helpful' | 'solution_explanation';
  limit?: number;
  offset?: number;
  startDate?: string;
  fromDate?: Date;
  toDate?: Date;
  endDate?: string;
}

/**
 * Interface for feedback summary statistics
 */
export interface FeedbackStats {
  totalFeedback: number;
  helpfulCount: number;
  notHelpfulCount: number;
  helpfulPercentage: number;
  notHelpfulPercentage: number;
  averageCommentLength: number;
  topModels: Array<{ modelName: string; feedbackCount: number; helpfulCount: number; avgConfidence: number }>;
  feedbackTrends: {
    daily: Array<{ date: string; count: number; helpful: number; notHelpful: number }>;
    weekly: Array<{ date: string; count: number; helpful: number; notHelpful: number }>;
  };
  feedbackByModel: Record<string, { helpful: number; notHelpful: number }>;
  feedbackByDay: Array<{ date: string; helpful: number; notHelpful: number }>;
}

/**
 * Database-aligned interface for explanation records
 * Matches actual PostgreSQL schema column names and types
 */
export interface DatabaseExplanation {
  id: number;
  puzzle_id: string;
  pattern_description: string;
  solving_strategy: string;
  hints: string[];
  confidence: number;
  alien_meaning_confidence: number | null;
  alien_meaning: string | null;
  model_name: string;
  reasoning_log: string | null;
  has_reasoning_log: boolean;
  provider_response_id: string | null;
  api_processing_time_ms: number | null;
  saturn_images: any | null;
  saturn_log: any | null;
  saturn_events: any | null;
  saturn_success: boolean | null;
  predicted_output_grid: any | null;
  is_prediction_correct: boolean | null;
  prediction_accuracy_score: number | null;
  provider_raw_response: any | null;
  reasoning_items: string[] | null;
  temperature: number | null;
  reasoning_effort: string | null;
  reasoning_verbosity: string | null;
  reasoning_summary_type: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  multiple_predicted_outputs: any | null;
  multi_test_results: any | null;
  multi_test_all_correct: boolean | null;
  multi_test_average_accuracy: number | null;
  has_multiple_predictions: boolean | null;
  multi_test_prediction_grids: any | null;
  created_at: string;
}

/**
 * Frontend-friendly explanation interface with camelCase naming
 */
export interface ExplanationRecord {
  id: number;
  puzzleId: string;
  patternDescription: string;
  solvingStrategy: string;
  hints: string[];
  confidence: number;
  alienMeaningConfidence: number | null;
  alienMeaning: string | null;
  modelName: string;
  reasoningLog: string | null;
  hasReasoningLog: boolean;
  providerResponseId: string | null;
  apiProcessingTimeMs: number | null;
  saturnImages: any | null;
  saturnLog: any | null;
  saturnEvents: any | null;
  saturnSuccess: boolean | null;
  predictedOutputGrid: number[][] | null;
  isPredictionCorrect: boolean | null;
  predictionAccuracyScore: number | null;
  providerRawResponse: any | null;
  reasoningItems: string[] | null;
  temperature: number | null;
  reasoningEffort: string | null;
  reasoningVerbosity: string | null;
  reasoningSummaryType: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  estimatedCost: number | null;
  multiplePredictedOutputs: any | null;
  multiTestResults: any | null;
  multiTestAllCorrect: boolean | null;
  multiTestAverageAccuracy: number | null;
  hasMultiplePredictions: boolean | null;
  multiTestPredictionGrids: any | null;
  createdAt: string;
}

/**
 * Puzzle overview data structure for the overview page
 */
export interface PuzzleOverviewData {
  id: string;
  source: string;
  maxGridSize: number;
  gridSizeConsistent: boolean;
  hasExplanation: boolean;
  explanations: ExplanationRecord[];
  totalExplanations: number;
  latestExplanation: ExplanationRecord | null;
  feedbackCount?: number;
}

/**
 * API response structure for puzzle overview
 */
export interface PuzzleOverviewResponse {
  puzzles: PuzzleOverviewData[];
  total: number;
  hasMore: boolean;
}

/**
 * LEGACY: Mixed accuracy/trustworthiness statistics interface
 * @deprecated This interface mixes accuracy and trustworthiness concepts!
 * Use PureAccuracyStats, TrustworthinessStats, or ConfidenceStats instead for clarity.
 * 
 * WARNING: Despite the name "AccuracyStats", the accuracyByModel array often
 * contains trustworthiness data filtered by prediction_accuracy_score.
 */
export interface AccuracyStats {
  accuracyByModel: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    avgAccuracyScore: number; // DEPRECATED: Often contains trustworthiness data!
    avgConfidence: number;
    avgTrustworthiness: number;
    minTrustworthiness?: number;
    maxTrustworthiness?: number;
    successfulPredictions?: number;
    predictionSuccessRate?: number;
  }>;
  totalSolverAttempts: number;
  totalCorrectPredictions?: number;

  // Leaderboard data
  topModelsByAccuracy?: Array<{ modelName: string; value: number; totalCorrect: number; totalAttempts: number; }>;
  topModelsByAverageCost?: Array<{ modelName: string; value: number; totalAttempts: number; }>;
  topModelsByAverageSpeed?: Array<{ modelName: string; value: number; totalAttempts: number; }>;
}

/**
 * PURE ACCURACY STATS - Only boolean correctness metrics
 * 
 * Uses only is_prediction_correct and multi_test_all_correct boolean fields.
 * No trustworthiness or confidence filtering applied.
 * Shows true puzzle-solving success rates across all models.
 */
export interface PureAccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number;
  overallAccuracyPercentage: number;
  modelAccuracyRankings: Array<{
    modelName: string;
    totalAttempts: number;
    correctPredictions: number;
    accuracyPercentage: number;
    singleTestAttempts: number;
    singleCorrectPredictions: number;
    singleTestAccuracy: number;
    multiTestAttempts: number;
    multiCorrectPredictions: number;
    multiTestAccuracy: number;
  }>;
}

/**
 * TRUSTWORTHINESS STATS - AI confidence reliability metrics
 * 
 * Uses prediction_accuracy_score field (despite misleading name, this measures trustworthiness).
 * Focuses on how well AI confidence claims correlate with actual performance.
 * This is the PRIMARY METRIC for AI reliability research.
 */
export interface TrustworthinessStats {
  totalTrustworthinessAttempts: number;
  overallTrustworthiness: number;
  modelTrustworthinessRankings: Array<{
    modelName: string;
    totalAttempts: number;
    avgTrustworthiness: number;
    minTrustworthiness: number;
    maxTrustworthiness: number;
    avgConfidence: number;
    trustworthinessEntries: number;
  }>;
}

/**
 * CONFIDENCE ANALYSIS STATS - AI confidence patterns and calibration
 * 
 * Analyzes AI confidence behavior across correct vs incorrect predictions.
 * Measures overconfidence, underconfidence, and calibration quality.
 */
export interface ConfidenceStats {
  totalEntriesWithConfidence: number;
  overallAvgConfidence: number;
  avgConfidenceWhenCorrect: number;
  avgConfidenceWhenIncorrect: number;
  confidenceCalibrationGap: number;
  modelConfidenceAnalysis: Array<{
    modelName: string;
    totalEntries: number;
    avgConfidence: number;
    avgConfidenceWhenCorrect: number;
    avgConfidenceWhenIncorrect: number;
    confidenceRange: number;
    minConfidence: number;
    maxConfidence: number;
    correctPredictions: number;
    incorrectPredictions: number;
  }>;
}

/**
 * Raw database statistics interface
 */
export interface RawDatabaseStats {
  totalExplanations: number;
  avgProcessingTime: number;
  maxProcessingTime: number;
  avgPredictionAccuracy: number;
  totalTokens: number;
  avgTokens: number;
  maxTokens: number;
  totalEstimatedCost: number;
  avgEstimatedCost: number;
  maxEstimatedCost: number;
  explanationsWithTokens: number;
  explanationsWithCost: number;
  explanationsWithAccuracy: number;
  explanationsWithProcessingTime: number;
}

/**
 * Performance statistics interface (actual API response structure)
 */
export interface PerformanceStats {
  trustworthinessLeaders: Array<{
    modelName: string;
    totalAttempts: number;
    avgTrustworthiness: number;
    avgConfidence: number;
    avgProcessingTime: number;
    avgTokens: number;
    avgCost: number;
    totalCost: number;
  }>;
  speedLeaders: Array<{
    modelName: string;
    avgProcessingTime: number;
    totalAttempts: number;
    avgTrustworthiness: number;
  }>;
  efficiencyLeaders: Array<{
    modelName: string;
    costEfficiency: number;
    tokenEfficiency: number;
    avgTrustworthiness: number;
    totalAttempts: number;
  }>;
  overallTrustworthiness: number;
}

/**
 * Legacy Leaderboard statistics interface (for backward compatibility)
 * @deprecated Use PerformanceStats instead for accurate API response typing
 */
export interface LeaderboardStats {
  trustworthinessLeaders: Array<{
    modelName: string;
    totalAttempts: number;
    avgTrustworthiness: number;
    avgConfidence: number;
    calibrationError: number;
    avgProcessingTime: number;
    avgTokens: number;
    avgCost: number;
  }>;
  speedLeaders: Array<{
    modelName: string;
    avgProcessingTime: number;
    totalAttempts: number;
    avgTrustworthiness: number;
  }>;
  calibrationLeaders: Array<{
    modelName: string;
    calibrationError: number;
    totalAttempts: number;
    avgTrustworthiness: number;
    avgConfidence: number;
  }>;
  efficiencyLeaders: Array<{
    modelName: string;
    costEfficiency: number;
    tokenEfficiency: number;
    avgTrustworthiness: number;
    totalAttempts: number;
  }>;
  totalTrustworthinessAttempts: number;
  overallTrustworthiness: number;
}

/**
 * Available prompt templates for puzzle analysis
 * These templates allow users to choose different prompt styles and approaches to guide AI analysis
 */
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  alienCommunication: {
    id: "alienCommunication",
    name: "🛸 Alien Communication",
    description: "Fun creative approach - AI interprets puzzles as alien messages using emoji symbols. Makes complex patterns more intuitive and engaging.",
    content: `Our app frames the puzzles from the ARC-AGI prize as alien communication puzzles. Your job is to explain in very simple terms why the correct answer is correct. Look at this puzzle where we already know the correct answer and determine the logic and transformations (as documented in the ARC-AGI prize transformations) used to solve it.`,
    emojiMapIncluded: true
  },
  standardExplanation: {
    id: "standardExplanation", 
    name: "📝 Standard Analysis",
    description: "Clear, straightforward analysis of puzzle patterns. AI explains the transformation rules step-by-step using simple language and logical reasoning.",
    content: `Explain the transformation rules observed in the {train} examples and applied to the {test} case. Your job is to explain in very simple terms what transformations were used.`,
    emojiMapIncluded: false
  },
  educationalApproach: {
    id: "educationalApproach",
    name: "🧠 Educational Approach", 
    description: "Algorithmic thinking approach - AI teaches problem-solving methodology using step-by-step algorithms, computational processes, and learning-focused explanations.",
    content: `Help students understand the step-by-step algorithms and logical patterns in this puzzle. Explain transformations as computational processes and rules, focusing on algorithmic thinking and problem-solving methodology.`,
    emojiMapIncluded: false
  },
  solver: {
    id: "solver",
    name: "🎯 Solver Mode",
    description: "AI becomes a puzzle solver - predicts the correct answer without seeing the solution. Tests the AI's reasoning abilities in a challenge format.",
    content: `Given these training examples, what do you predict the correct answer to the test case should be? Explain your reasoning step by step, identifying the transformation pattern and applying it to solve the test case.`,
    emojiMapIncluded: false
  },
  custom: {
    id: "custom",
    name: "⚙️ Custom Prompt",
    description: "Full control over AI instructions - write your own custom prompt to guide the AI's analysis approach and output style exactly as you want.",
    content: "",
    emojiMapIncluded: false
  }
};

/**
 * API call logging types (shared)
 * These are used by Python→Node event bridge and UI rendering
 */
export type ApiCallStatus = 'success' | 'error';

export interface ApiCallStartEvent {
  type: 'api_call_start';
  ts: string; // ISO timestamp
  phase?: string; // solver phase if applicable
  provider: string; // e.g., 'OpenAI'
  model: string;
  endpoint: string; // e.g., '/v1/responses'
  requestId: string; // client-generated UUID
  attempt: number; // retry attempt number (1-based)
  params?: Record<string, unknown>; // sanitized request params
  images?: Array<{ ref: string; length?: number; hash?: string }>; // references only
}

export interface ApiCallEndEvent {
  type: 'api_call_end';
  ts: string; // ISO timestamp
  requestId: string;
  status: ApiCallStatus;
  latencyMs?: number;
  providerResponseId?: string;
  httpStatus?: number;
  reasoningSummary?: string;
  tokenUsage?: { input?: number; output?: number; total?: number };
  error?: string; // sanitized message only
}

export type ApiCallEvent = ApiCallStartEvent | ApiCallEndEvent;

/**
 * Centralized model configuration type
 */
export interface ModelConfig {
  key: string;
  name: string;
  color: string;
  premium: boolean;
  cost: { input: string; output: string };
  supportsTemperature: boolean;
  provider: 'OpenAI' | 'Anthropic' | 'xAI' | 'Gemini' | 'DeepSeek' | 'OpenRouter';
  responseTime: { speed: 'fast' | 'moderate' | 'slow'; estimate: string };
  isReasoning?: boolean;
  apiModelName: string;
  modelType: 'gpt5' | 'gpt5_chat' | 'o3_o4' | 'claude' | 'grok' | 'gemini' | 'deepseek' | 'openrouter';
  maxOutputTokens?: number;
  contextWindow?: number;
  supportsFunctionCalling?: boolean;
  supportsSystemPrompts?: boolean;
  supportsStructuredOutput?: boolean;
  supportsVision?: boolean;
}

export interface ReasoningItem {
  title?: string;
  detail?: string;
  step?: number;
  category?: string;
}
