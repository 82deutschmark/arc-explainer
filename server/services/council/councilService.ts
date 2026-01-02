/**
 * Author: Claude Sonnet 4 (Cascade)
 * Date: 2026-01-02
 * PURPOSE: Council service that orchestrates ARC puzzle assessment via the llm-council.
 *          Formats puzzles for council evaluation and processes responses.
 *          Integrated via subprocess (like Saturn/Grover) - no separate deployment needed.
 * SRP/DRY check: Pass - Single responsibility: ARC puzzle formatting and council orchestration.
 */

import { councilBridge, type CouncilResponse } from './councilBridge.ts';
import { puzzleLoader } from '../puzzleLoader.ts';
import { repositoryService } from '../../repositories/RepositoryService.ts';
import { logger } from '../../utils/logger.ts';

export interface PuzzleForCouncil {
  taskId: string;
  source?: string;
  train: Array<{ input: number[][]; output: number[][] }>;
  test: Array<{ input: number[][]; output?: number[][] }>;
}

export interface ExplanationForCouncil {
  id: number;
  modelName: string;
  explanation: string;
  predictedOutput?: number[][];
  isCorrect?: boolean;
  confidenceScore?: number;
  createdAt: string;
}

export interface CouncilAssessmentRequest {
  taskId: string;
  mode: 'solve' | 'assess';
  explanationIds?: number[]; // For 'assess' mode - which explanations to evaluate
}

export interface CouncilAssessmentResult {
  taskId: string;
  mode: 'solve' | 'assess';
  stage1: CouncilResponse['stage1'];
  stage2: CouncilResponse['stage2'];
  stage3: CouncilResponse['stage3'];
  metadata: CouncilResponse['metadata'];
  promptUsed: string;
}

/**
 * Format a 2D grid as a string representation
 */
function formatGrid(grid: number[][]): string {
  return grid.map(row => row.join(' ')).join('\n');
}

/**
 * Format puzzle examples for the council prompt
 */
function formatPuzzleExamples(puzzle: PuzzleForCouncil): string {
  let prompt = '';
  
  // Training examples
  puzzle.train.forEach((example, idx) => {
    prompt += `\n### Training Example ${idx + 1}\n`;
    prompt += `**Input:**\n\`\`\`\n${formatGrid(example.input)}\n\`\`\`\n`;
    prompt += `**Output:**\n\`\`\`\n${formatGrid(example.output)}\n\`\`\`\n`;
  });
  
  // Test input (without output for solve mode)
  prompt += `\n### Test Input\n`;
  prompt += `\`\`\`\n${formatGrid(puzzle.test[0].input)}\n\`\`\`\n`;
  
  return prompt;
}

/**
 * Build a prompt for the council to solve an ARC puzzle
 */
function buildSolvePrompt(puzzle: PuzzleForCouncil): string {
  const examples = formatPuzzleExamples(puzzle);
  
  return `# ARC-AGI Puzzle Assessment: ${puzzle.taskId}

You are evaluating an ARC-AGI (Abstraction and Reasoning Corpus) puzzle. These puzzles test abstract reasoning by showing input-output grid transformations.

## The Puzzle
${examples}

## Your Task

1. **Analyze the Pattern**: Study the training examples to identify the transformation rule.
2. **Describe the Rule**: Explain in clear terms what transformation is being applied.
3. **Predict the Output**: Based on your analysis, predict what the test output grid should be.
4. **Confidence Assessment**: Rate your confidence in your prediction (low/medium/high) and explain why.

Please provide a detailed analysis and your predicted output grid.`;
}

/**
 * Build a prompt for the council to assess existing explanations
 */
function buildAssessPrompt(
  puzzle: PuzzleForCouncil,
  explanations: ExplanationForCouncil[]
): string {
  const examples = formatPuzzleExamples(puzzle);
  
  let explanationsText = '';
  explanations.forEach((exp, idx) => {
    explanationsText += `\n### Explanation ${idx + 1} (by ${exp.modelName})\n`;
    explanationsText += `${exp.explanation}\n`;
    if (exp.predictedOutput) {
      explanationsText += `\n**Predicted Output:**\n\`\`\`\n${formatGrid(exp.predictedOutput)}\n\`\`\`\n`;
    }
    if (exp.confidenceScore !== undefined) {
      explanationsText += `**Confidence Score:** ${(exp.confidenceScore * 100).toFixed(0)}%\n`;
    }
  });
  
  return `# ARC-AGI Puzzle Assessment: ${puzzle.taskId}

You are evaluating AI-generated explanations for an ARC-AGI puzzle.

## The Puzzle
${examples}

## Explanations to Assess
${explanationsText}

## Your Task

1. **Evaluate Each Explanation**: Assess the quality, accuracy, and completeness of each explanation.
2. **Identify Strengths**: What does each explanation do well?
3. **Identify Weaknesses**: What errors or gaps exist in each explanation?
4. **Rank the Explanations**: Which explanation best captures the transformation rule?
5. **Synthesize**: What would the ideal explanation look like, combining the best insights?

Please provide a thorough assessment.`;
}

/**
 * Assess an ARC puzzle using the LLM Council
 */
export async function assessPuzzle(
  request: CouncilAssessmentRequest
): Promise<CouncilAssessmentResult> {
  logger.info(`[CouncilService] Starting ${request.mode} assessment for puzzle ${request.taskId}`);
  
  // Check council health (Python wrapper + llm-council submodule + OPENROUTER_API_KEY)
  const isHealthy = await councilBridge.healthCheck();
  if (!isHealthy) {
    throw new Error('LLM Council not available. Check: Python installed, llm-council submodule present, OPENROUTER_API_KEY set.');
  }
  
  // Load the puzzle
  const puzzle = await puzzleLoader.loadPuzzle(request.taskId);
  if (!puzzle) {
    throw new Error(`Puzzle ${request.taskId} not found`);
  }
  
  const puzzleForCouncil: PuzzleForCouncil = {
    taskId: request.taskId,
    source: puzzle.source,
    train: puzzle.train,
    test: puzzle.test,
  };
  
  // Build the appropriate prompt
  let prompt: string;
  
  if (request.mode === 'assess' && request.explanationIds?.length) {
    // Load explanations to assess
    const explanations: ExplanationForCouncil[] = [];
    
    for (const id of request.explanationIds) {
      const exp = await repositoryService.explanations.getExplanationById(id);
      if (exp) {
        explanations.push({
          id: exp.id,
          modelName: exp.modelName,
          explanation: exp.patternDescription,
          predictedOutput: exp.predictedOutputGrid ?? undefined,
          isCorrect: exp.isPredictionCorrect ?? undefined,
          confidenceScore: exp.confidence ?? undefined,
          createdAt: exp.createdAt,
        });
      }
    }
    
    if (explanations.length === 0) {
      throw new Error('No valid explanations found for assessment');
    }
    
    prompt = buildAssessPrompt(puzzleForCouncil, explanations);
  } else {
    prompt = buildSolvePrompt(puzzleForCouncil);
  }
  
  // Run council via subprocess
  const response = await councilBridge.runCouncil(prompt);
  
  logger.info(`[CouncilService] Assessment complete for ${request.taskId}`);
  
  return {
    taskId: request.taskId,
    mode: request.mode,
    stage1: response.stage1,
    stage2: response.stage2,
    stage3: response.stage3,
    metadata: response.metadata,
    promptUsed: prompt,
  };
}

/**
 * Get the list of unsolved ARC2 Evaluation puzzles for council assessment
 */
export async function getUnsolvedPuzzles(): Promise<string[]> {
  // These are the 28 unsolved puzzles from ARC2 Evaluation as specified by user
  const unsolvedPuzzleIds = [
    '78332cb0', 'de809cff', '62593bfd', '5545f144', 'f560132c',
    'eee78d87', '2b83f449', '4c416de3', '8b7bacbf', '7b0280bc',
    '7b80bb43', 'b9e38dc0', '446ef5d2', '4e34c42c', '88bcf3b4',
    '221dfab4', 'faa9f03d', '269e22fb', '21897d95', 'e12f9a14',
    '4c7dc4dd', '3a25b0d8', 'a32d8b75', '9bbf930d', '6ffbe589',
    'd35bdbdc', '13e47133', '88e364bc'
  ];
  
  return unsolvedPuzzleIds;
}

/**
 * Get explanations for a puzzle that could be assessed by the council
 */
export async function getExplanationsForAssessment(
  taskId: string,
  limit: number = 10
): Promise<ExplanationForCouncil[]> {
  const explanations = await repositoryService.explanations.getExplanationsForPuzzle(taskId);
  
  // Sort by date and limit
  const sorted = explanations
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
  
  return sorted.map((exp) => ({
    id: exp.id,
    modelName: exp.modelName,
    explanation: exp.patternDescription,
    predictedOutput: exp.predictedOutputGrid ?? undefined,
    isCorrect: exp.isPredictionCorrect ?? undefined,
    confidenceScore: exp.confidence ?? undefined,
    createdAt: exp.createdAt,
  }));
}

export const councilService = {
  assessPuzzle,
  getUnsolvedPuzzles,
  getExplanationsForAssessment,
};
