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
