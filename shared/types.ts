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
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';
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
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'ARC-Heavy' | 'ConceptARC';
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
  trustworthinessScore?: number;
}

// ELO comparison system types
export type ComparisonOutcome = 'A_WINS' | 'B_WINS' | 'BOTH_BAD';

export interface EloVoteData {
  sessionId: string;
  explanationAId: number;
  explanationBId: number;
  outcome: ComparisonOutcome;
  puzzleId: string;
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
 * Shared prompt telemetry payload for Poetiq solver runs.
 * Keeps backend + frontend prompt inspectors in sync.
 */
export type PoetiqPromptRole = 'system' | 'user' | 'assistant' | 'developer' | 'tool';

export interface PoetiqPromptMessage {
  role: PoetiqPromptRole;
  /**
   * Optional friendly label (e.g., "Puzzle Setup", "Expert #1 Attempt").
   */
  label?: string;
  content: string;
  /**
   * Optional metadata so UI can render badges (scores, pass counts, etc.).
   */
  metadata?: Record<string, unknown>;
}

export type PoetiqAgentToolStatus = 'started' | 'completed' | 'failed';

export interface PoetiqAgentTimelineItem {
  id: string;
  type: 'reasoning' | 'tool_call' | 'tool_result' | 'status' | 'output';
  /**
   * Stable identifier for the Agent run (provider response ID / run id).
   */
  runId?: string;
  iteration?: number;
  toolName?: string;
  status?: PoetiqAgentToolStatus;
  label?: string;
  message?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export interface PoetiqAgentReasoningDelta {
  runId: string;
  channel: 'text' | 'reasoning';
  delta: string;
  cumulativeText?: string;
  timestamp?: string;
}

export interface PoetiqPromptData {
  systemPrompt?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  provider?: string;
  apiStyle?: string;
  reasoningParams?: {
    effort?: string;
    verbosity?: string;
    summary?: string;
  } | null;
  iteration?: number;
  expert?: number;
  timestamp?: string;
  problemSection?: string;
  feedbackSection?: string | null;
  stats?: {
    systemPromptChars?: number;
    userPromptChars?: number;
    problemChars?: number;
    feedbackChars?: number;
    previousSolutionCount?: number;
  } | null;
  /**
   * Structured conversation turns for Responses API-compatible replay.
   */
  messages?: PoetiqPromptMessage[];
  /**
   * OpenAI Agents SDK telemetry when Poetiq runs in Agents mode.
   */
  agentRunId?: string;
  agentModel?: string;
  agentTimeline?: PoetiqAgentTimelineItem[];
  agentReasoning?: PoetiqAgentReasoningDelta[];
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
  topModels: Array<{
    modelName: string;
    feedbackCount: number;
    helpfulCount: number;
    helpfulPercentage: number;
    avgConfidence: number;
  }>;
  topPuzzles: Array<{
    puzzleId: string;
    feedbackCount: number;
    helpfulCount: number;
    notHelpfulCount: number;
    helpfulPercentage: number;
    latestFeedbackAt: string;
  }>;
  feedbackTrends: {
    daily: Array<{ date: string; total: number; helpful: number; notHelpful: number }>;
    weekly: Array<{ date: string; total: number; helpful: number; notHelpful: number }>;
  };
  feedbackByModel: Record<string, { helpful: number; notHelpful: number; total: number }>;
  feedbackByDay: Array<{ date: string; total: number; helpful: number; notHelpful: number }>;
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
  trustworthiness_score: number | null;
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
  status: string | null;
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
  trustworthinessScore: number | null;
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
  status: string | null;
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
 * contains trustworthiness data filtered by trustworthiness_score.
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
 * Uses trustworthiness_score field (despite misleading name, this measures trustworthiness).
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

// SnakeBench integration types
export type SnakeBenchResultLabel = 'won' | 'lost' | 'tied';

export interface SnakeBenchRunMatchRequest {
  modelA: string;
  modelB: string;
  width?: number;
  height?: number;
  maxRounds?: number;
  numApples?: number;
  /** Optional per-request BYO API key (never stored/logged) */
  apiKey?: string;
  /** Optional provider for BYO key; if omitted, defaults to OpenRouter */
  provider?: 'openrouter' | 'openai' | 'anthropic' | 'xai' | 'gemini';
}

export interface SnakeBenchRunMatchResult {
  /** SnakeBench internal game id */
  gameId: string;
  /** Model name for snake slot 0 */
  modelA: string;
  /** Model name for snake slot 1 */
  modelB: string;
  /** Final scores keyed by model name */
  scores: Record<string, number>;
  /** Results keyed by model name (won/lost/tied) */
  results: Record<string, SnakeBenchResultLabel>;
  /** Optional on-disk path to the completed game JSON for replay */
  completedGamePath?: string;
}

export interface SnakeBenchRunMatchResponse {
  success: boolean;
  result?: SnakeBenchRunMatchResult;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchRunBatchRequest extends SnakeBenchRunMatchRequest {
  /** Number of matches to run sequentially (small, bounded value) */
  count: number;
}

export interface SnakeBenchRunBatchResult {
  results: SnakeBenchRunMatchResult[];
  errors?: Array<{
    index: number;
    error: string;
  }>;
}

export interface SnakeBenchRunBatchResponse {
  success: boolean;
  batch?: SnakeBenchRunBatchResult;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchGameSummary {
  gameId: string;
  filename: string;
  startedAt: string;
  totalScore: number;
  roundsPlayed: number;
  /** Optional on-disk path to the completed game JSON for replay */
  path?: string;
}

export interface SnakeBenchListGamesResponse {
  success: boolean;
  games: SnakeBenchGameSummary[];
  total: number;
  timestamp: number;
}

export type SnakeBenchMatchSearchResultLabel = SnakeBenchResultLabel;

export type SnakeBenchMatchSearchSortBy =
  | 'startedAt'
  | 'rounds'
  | 'totalCost'
  | 'maxFinalScore'
  | 'scoreDelta';

export type SnakeBenchMatchSearchSortDir = 'asc' | 'desc';

export interface SnakeBenchMatchSearchQuery {
  model: string;
  opponent?: string;
  result?: SnakeBenchMatchSearchResultLabel;
  minRounds?: number;
  from?: string;
  to?: string;
  sortBy?: SnakeBenchMatchSearchSortBy;
  sortDir?: SnakeBenchMatchSearchSortDir;
  limit?: number;
  offset?: number;
}

export interface SnakeBenchMatchSearchRow {
  gameId: string;
  startedAt: string;
  model: string;
  opponent: string;
  result: SnakeBenchMatchSearchResultLabel;
  myScore: number;
  opponentScore: number;
  roundsPlayed: number;
  totalCost: number;
  maxFinalScore: number;
  scoreDelta: number;
  boardWidth: number;
  boardHeight: number;
}

export interface SnakeBenchMatchSearchResponse {
  success: boolean;
  model: string;
  rows: SnakeBenchMatchSearchRow[];
  total: number;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchGameDetailResponse {
  success: boolean;
  gameId: string;
  /** Full SnakeBench game JSON payload for replay/inspection */
  data?: any;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchHealthResponse {
  success: boolean;
  status: 'ok' | 'degraded' | 'error';
  pythonAvailable: boolean;
  backendDirExists: boolean;
  runnerExists: boolean;
  message?: string;
  timestamp: number;
}

export interface SnakeBenchArcExplainerStats {
  totalGames: number;
  activeModels: number;
  topApples: number;
  totalCost: number;
}

export interface SnakeBenchModelRating {
  modelSlug: string;
  mu: number;
  sigma: number;
  exposed: number;
  displayScore: number;
  wins: number;
  losses: number;
  ties: number;
  applesEaten: number;
  gamesPlayed: number;
  totalCost: number;
  isActive?: boolean;
}

export interface SnakeBenchModelMatchHistoryEntry {
  gameId: string;
  startedAt: string;
  opponentSlug: string;
  result: SnakeBenchResultLabel;
  myScore: number;
  opponentScore: number;
  rounds: number;
  deathReason: string | null;
  boardWidth: number;
  boardHeight: number;
}

export interface SnakeBenchStatsResponse {
  success: boolean;
  stats: SnakeBenchArcExplainerStats;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchModelRatingResponse {
  success: boolean;
  rating?: SnakeBenchModelRating | null;
  error?: string;
  timestamp: number;
}

export interface SnakeBenchModelHistoryResponse {
  success: boolean;
  modelSlug: string;
  history: SnakeBenchModelMatchHistoryEntry[];
  error?: string;
  timestamp: number;
}

export interface SnakeBenchTrueSkillLeaderboardEntry {
  modelSlug: string;
  mu: number;
  sigma: number;
  exposed: number;
  displayScore: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  applesEaten: number;
  topScore: number;
  winRate?: number;
  totalCost: number;
}

export interface SnakeBenchTrueSkillLeaderboardResponse {
  success: boolean;
  entries: SnakeBenchTrueSkillLeaderboardEntry[];
  error?: string;
  timestamp: number;
}

/**
 * Worm Arena "Greatest Hits" summary types
 * Compact per-game view used by the replay UI to surface memorable matches.
 */
export interface WormArenaGreatestHitGame {
  gameId: string;
  startedAt: string;
  modelA: string;
  modelB: string;
  roundsPlayed: number;
  maxRounds: number;
  totalCost: number;
  maxFinalScore: number;
  scoreDelta: number;
  boardWidth: number;
  boardHeight: number;
  highlightReason: string;
}

export interface WormArenaGreatestHitsResponse {
  success: boolean;
  games: WormArenaGreatestHitGame[];
  error?: string;
  timestamp: number;
}

/**
 * Worm Arena streaming status (lightweight, matches other streaming flows).
 */
export interface WormArenaStreamStatus {
  state: 'idle' | 'starting' | 'in_progress' | 'completed' | 'failed';
  phase?: string;
  message?: string;
  round?: number;
  tokenUsage?: {
    input?: number;
    output?: number;
    reasoning?: number;
  };
}

/**
 * Single frame event for live Worm Arena streaming.
 */
export interface WormArenaFrameEvent {
  round: number;
  frame: any;
  timestamp: number;
}

/**
 * Final summary for a live Worm Arena match.
 */
export interface WormArenaFinalSummary {
  gameId: string;
  modelA: string;
  modelB: string;
  scores: Record<string, number>;
  results: Record<string, SnakeBenchResultLabel>;
  roundsPlayed?: number;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Batch run event types for Worm Arena streaming
 */
export interface WormArenaBatchMatchStart {
  index: number;
  total: number;
  modelA: string;
  modelB: string;
}

export interface WormArenaBatchMatchComplete {
  index: number;
  total: number;
  gameId: string;
  modelA: string;
  modelB: string;
  scores: Record<string, number>;
  results: Record<string, SnakeBenchResultLabel>;
}

export interface WormArenaBatchComplete {
  totalMatches: number;
  completedMatches: number;
  failedMatches: number;
}

export interface WormArenaBatchError {
  index: number;
  total: number;
  error: string;
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
    content: `Frames the puzzles from the ARC-AGI prize as alien communication puzzles. Your job is to explain in very simple terms why the correct answer is correct. Look at this puzzle where we already know the correct answer and determine the logic and transformations (as documented in the ARC-AGI prize transformations) used to solve it.`,
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
  gepa: {
    id: "gepa",
    name: "🔍 GEPA Solver",
    description: "Systematic strategy analysis solver - uses structured approach with proven strategies to analyze and solve ARC-AGI puzzles. Credit: https://github.com/gepa-ai/gepa",
    content: `Analyze the provided input/output matrix pairs from the Abstraction and Reasoning Corpus (ARC). Deduce the single, underlying transformation rule that converts each input matrix to its corresponding output matrix. Describe this rule in clear, step-by-step, unambiguous English. Focus on the logic, not Python code.`,
    emojiMapIncluded: false
  },
  custom: {
    id: "custom",
    name: "⚙️ Custom Prompt",
    description: "Full control over AI instructions - write your own custom prompt to guide the AI's analysis approach and output style exactly as you want.",
    content: "",
    emojiMapIncluded: false
  },
  debate: {
    id: "debate",
    name: "⚔️ Debate Mode",
    description: "AI-vs-AI challenge mode - critique and improve another AI's explanation with superior reasoning and problem-solving.",
    content: "You are participating in an AI model debate. Another AI model has provided an explanation for this puzzle. Critically evaluate their reasoning, identify flaws or weaknesses, and provide a superior analysis with the correct solution.",
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
  provider: 'OpenAI' | 'Anthropic' | 'xAI' | 'Gemini' | 'DeepSeek' | 'OpenRouter' | 'Grover' | 'Saturn' | 'Beetree';
  responseTime: { speed: 'fast' | 'moderate' | 'slow'; estimate: string };
  isReasoning?: boolean;
  apiModelName: string;
  modelType: 'gpt5_chat' | 'gpt5' | 'o3_o4' | 'claude' | 'grok' | 'gemini' | 'deepseek' | 'openrouter' | 'grover' | 'saturn' | 'beetree';
  contextWindow?: number;
  maxOutputTokens?: number; // Only used for some models
  releaseDate?: string; // Release date in YYYY-MM format
  supportsFunctionCalling?: boolean;
  supportsSystemPrompts?: boolean;
  supportsStructuredOutput?: boolean;
  supportsVision?: boolean;
  requiresPromptFormat?: boolean; // For OpenRouter models that need "prompt" instead of "messages"
  supportsStreaming?: boolean;
  
  // Model Management fields
  isActive?: boolean; // Controls whether model appears in selectors (default: true)
  aliasFor?: string; // Key of the model this is an alias for
  notes?: string; // Admin notes about this model
  addedVia?: 'config' | 'ui' | 'openrouter'; // How this model was added
  addedAt?: string; // ISO timestamp when added
}

export interface ReasoningItem {
  title?: string;
  detail?: string;
  step?: number;
  category?: string;
}

/**
 * Grover iteration tracking types
 */
export interface GroverIteration {
  iteration: number;
  programs: string[];            // Generated code candidates
  executionResults: {
    programIdx: number;
    score: number;              // 0-10 grading
    output: number[][] | null;  // Predicted grid
    error?: string;             // Execution error if any
    code: string;
  }[];
  best: {
    programIdx: number;
    score: number;
    code: string;
  };
  timestamp: number;
}

export interface GroverExplanationData extends ExplanationRecord {
  groverIterations?: GroverIteration[];
  groverBestProgram?: string;
  iterationCount?: number;
}

// Beetree-specific types for ensemble solver
export interface BeetreeRunConfig {
  taskId: string;
  testIndex: number;
  mode: 'testing' | 'production';
  runTimestamp?: string;
}

export interface BeetreeModelCostInfo {
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number;
}

export interface BeetreeStageCostInfo {
  stage: string;
  cost: number;
  duration_ms: number;
}

export interface BeetreeTokenUsage {
  input: number;
  output: number;
  reasoning: number;
}

export interface BeetreeCostBreakdown {
  total_cost: number;
  by_model: BeetreeModelCostInfo[];
  by_stage: BeetreeStageCostInfo[];
  total_tokens: BeetreeTokenUsage;
  estimated_cost: number;
  cost_variance: number;
}

export interface BeetreeModelPrediction {
  model_name: string;
  prediction: number[][];
  confidence?: number;
  reasoning?: string;
  stage: string;
}

export interface BeetreeConsensusResult {
  consensus_grid: number[][];
  consensus_strength: number; // 0-1, higher = stronger consensus
  model_agreement: number; // 0-1, percentage of models agreeing
  top_solutions: Array<{
    grid: number[][];
    support_count: number;
    supporting_models: string[];
    confidence: number;
  }>;
  diversity_score: number; // 0-1, higher = more diverse solutions
  stage_distribution: Record<string, number>; // Which stages produced which solutions
}

export interface BeetreeStageConfig {
  name: string;
  enabled: boolean;
  models: string[];
  max_tokens: number;
  temperature: number;
  early_termination_enabled: boolean;
  consensus_threshold: number;
}

export interface BeetreeOrchestrationState {
  current_stage: number;
  total_stages: number;
  stage_results: Array<{
    stage_name: string;
    predictions: BeetreeModelPrediction[];
    consensus: BeetreeConsensusResult;
    cost: number;
    duration_ms: number;
    completed_at: number;
  }>;
  should_terminate: boolean;
  termination_reason?: string;
  final_consensus?: BeetreeConsensusResult;
}

export interface BeetreeTerminationCriteria {
  consensus_threshold: number; // Minimum consensus strength to stop
  cost_limit: number; // Maximum cost in USD
  time_limit: number; // Maximum time in milliseconds
  min_solutions: number; // Minimum number of distinct solutions required
}

export interface BeetreeRunResult {
  taskId: string;
  testIndex: number;
  mode: string;
  runTimestamp: string;
  predictions: number[][][];
  costBreakdown: BeetreeCostBreakdown;
  verboseLog: string;
  consensus: BeetreeConsensusResult;
  orchestration: BeetreeOrchestrationState;
}

// Beetree types (moved here to avoid conflicts)
export interface BeetreeBridgeOptions {
  taskId: string;
  testIndex: number;
  mode: 'testing' | 'production';
  runTimestamp?: string;
}

export type BeetreeBridgeEvent =
  | { type: 'start'; message?: string; metadata?: any; timestamp?: number; source?: 'python' }
  | {
      type: 'progress';
      status: string;
      stage: string;
      outcome?: string;
      event?: string;
      predictions?: number[][][];
      costSoFar?: number;
      tokensUsed?: BeetreeTokenUsage;
      timestamp?: number;
      source?: 'python';
    }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string; timestamp?: number; source?: 'python' }
  | {
      type: 'final';
      success: boolean;
      predictions?: number[][][];
      result: BeetreeRunResult;
      timingMs: number;
      timestamp?: number;
      source?: 'python';
    }
  | { type: 'error'; message: string; timestamp?: number; source?: 'python' };

// Database extension for beetree-specific fields
export interface BeetreeExplanationData extends ExplanationRecord {
  beetreeStage?: string;
  beetreeConsensusCount?: number;
  beetreeModelResults?: BeetreeModelCostInfo[];
  beetreeCostBreakdown?: BeetreeCostBreakdown;
  beetreeTokenUsage?: BeetreeTokenUsage;
  beetreeRunTimestamp?: string;
  beetreeMode?: 'testing' | 'production';
  beetreeConsensusStrength?: number;
  beetreeDiversityScore?: number;
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
