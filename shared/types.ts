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
  hints: string[];
  confidence: number;
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
 * Available prompt templates for puzzle analysis
 * These templates allow users to choose different approaches to puzzle explanation
 */
export const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  alienCommunication: {
    id: "alienCommunication",
    name: "Alien Communication",
    description: "Frames puzzles as alien communication challenges with emoji mappings",
    content: `You are the tutor for our app which frames the puzzles from the ARC-AGI prize as alien communication puzzles. Your job is to explain in very simple terms why the correct answer is correct. Look at this puzzle where we already know the correct answer and determine the logic used to solve it.`,
    emojiMapIncluded: true
  },
  standardExplanation: {
    id: "standardExplanation", 
    name: "Standard Explanation",
    description: "Provides straightforward puzzle explanations without thematic framing",
    content: `You are an expert in ARC-AGI puzzles. Your job is to explain in very simple terms why the correct answer is correct. Look at this puzzle where we already know the correct answer and determine the logic used to solve it.`,
    emojiMapIncluded: false
  },
  educationalApproach: {
    id: "educationalApproach",
    name: "Educational Approach", 
    description: "Focuses on teaching problem-solving strategies and pattern recognition",
    content: `You are a teacher helping students understand complex pattern recognition problems. Your job is to explain in very simple terms why the correct answer is correct, focusing on educational value. Look at this puzzle where we already know the correct answer and determine the logic used to solve it.`,
    emojiMapIncluded: false
  }
};
