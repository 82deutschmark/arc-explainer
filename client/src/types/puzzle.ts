/**
 * Types for puzzles and related components in the ARC Explainer
 * This file contains interfaces and types used throughout the puzzle components
 * Author: Cascade
 */

/**
 * Configuration for AI models that can analyze puzzles
 */
export interface ModelConfig {
  key: string;
  name: string;
  color: string;
  premium: boolean;
  cost: { input: string; output: string };
  supportsTemperature: boolean;
  provider: 'OpenAI' | 'Anthropic' | 'xAI' | 'Gemini' | 'DeepSeek';
  responseTime?: {
    speed: 'fast' | 'moderate' | 'slow';
    estimate?: string;
  };
  supportsReasoning?: boolean; // Whether model supports reasoning log capture
}

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
 * Size classes for grid cells
 */
export const SIZE_CLASSES = {
  small: "w-4 h-4 text-xs",
  normal: "w-6 h-6 text-sm", 
  large: "w-8 h-8 text-base"
} as const;

/**
 * Props for the GridCell component
 */
export interface GridCellProps {
  value: number;
  showEmojis: boolean;
  size?: keyof typeof SIZE_CLASSES;
}

/**
 * Props for the PuzzleGrid component
 */
export interface PuzzleGridProps {
  grid: number[][];
  title: string;
  showEmojis: boolean;
  highlight?: boolean;
}

/**
 * Props for the ModelButton component
 */
export interface ModelButtonProps {
  model: ModelConfig;
  isAnalyzing: boolean;
  explanationCount: number;
  onAnalyze: (modelKey: string) => void;
  disabled: boolean;
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
  hasReasoningLog?: boolean; // Whether reasoning log is available
  apiProcessingTimeMs?: number; // Backend API processing time in milliseconds
}

/**
 * Props for the AnalysisResultCard component
 */
export interface AnalysisResultCardProps {
  modelKey: string;
  result: ExplanationData; // Use the database type directly
  model?: ModelConfig;
}
