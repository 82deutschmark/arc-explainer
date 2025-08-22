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
  source?: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval';
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
  extractionMethod?: string;
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
  explanationId: number;
  voteType: 'helpful' | 'not_helpful';
  comment: string | null;
  createdAt: string;
}

/**
 * Interface for detailed feedback with explanation context
 */
export interface DetailedFeedback extends Feedback {
  puzzleId: string;
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
  voteType?: 'helpful' | 'not_helpful';
  limit?: number;
  offset?: number;
  startDate?: string;
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
  feedbackByModel: Record<string, { helpful: number; notHelpful: number }>;
  feedbackByDay: Array<{ date: string; helpful: number; notHelpful: number }>;
}

/**
 * Available prompt templates for puzzle analysis
 * These templates allow users to choose different approaches to puzzle explanation
 */
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  alienCommunication: {
    id: "alienCommunication",
    name: "Alien Communication",
    description: "Our app frames the puzzles from the ARC-AGI prize as alien communication puzzles.",
    content: `Our app frames the puzzles from the ARC-AGI prize as alien communication puzzles. Your job is to explain in very simple terms why the correct answer is correct. Look at this puzzle where we already know the correct answer and determine the logic and transformations (as documented in the ARC-AGI prize transformations) used to solve it.`,
    emojiMapIncluded: true
  },
  standardExplanation: {
    id: "standardExplanation", 
    name: "Standard Explanation",
    description: "Explain the transformation rules observed in the {train} examples and applied to the {test} case. Your job is to explain in very simple terms what transformations were used.",
    content: `Explain the transformation rules observed in the {train} examples and applied to the {test} case. Your job is to explain in very simple terms what transformations were used.`,
    emojiMapIncluded: false
  },
  educationalApproach: {
    id: "educationalApproach",
    name: "Educational Approach", 
    description: "Help students understand complex reasoning problems. Explain in very simple terms what transformations were used, focusing on educational value.",
    content: `Help students understand complex reasoning problems. Explain in very simple terms what transformations were used, focusing on educational value.`,
    emojiMapIncluded: false
  },
  solver: {
    id: "solver",
    name: "Solver Mode",
    description: "Ask the AI to predict the correct answer based on training examples (no correct answer provided).",
    content: `Given these training examples, what do you predict the correct answer to the test case should be? Explain your reasoning step by step, identifying the transformation pattern and applying it to solve the test case.`,
    emojiMapIncluded: false
  },
  custom: {
    id: "custom",
    name: "Custom Prompt",
    description: "Use a custom prompt to override built-in templates per analysis run.",
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

export interface ReasoningItem {
  title?: string;
  detail?: string;
  step?: number;
  category?: string;
}
