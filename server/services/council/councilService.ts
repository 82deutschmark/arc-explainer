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
import { getEffectiveApiKey } from '../../utils/environmentPolicy.ts';

/**
 * Get the server API key for a given provider
 * Council currently only supports OpenRouter
 */
function getServerKey(provider?: string): string | undefined {
  // Council currently only uses OpenRouter
  return process.env.OPENROUTER_API_KEY;
}

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
  apiKey?: string;
  provider?: string;
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
  request: CouncilAssessmentRequest,
  onEvent?: (evt: any) => void
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

  // Resolve API key: prefer user key, fallback to server key in dev/staging
  const effectiveApiKey = getEffectiveApiKey(request.apiKey, getServerKey(request.provider));
  if (!effectiveApiKey) {
    throw new Error('API key resolution failed - this should not happen if controller validation passed');
  }

  // Run council via subprocess with optional event callback
  const response = await councilBridge.runCouncil(prompt, effectiveApiKey, onEvent);

  logger.info(`[CouncilService] Assessment complete for ${request.taskId}`);

  const assessmentResult: CouncilAssessmentResult = {
    taskId: request.taskId,
    mode: request.mode,
    stage1: response.stage1,
    stage2: response.stage2,
    stage3: response.stage3,
    metadata: response.metadata,
    promptUsed: prompt,
  };

  // Save result to database (Phase 4)
  try {
    await saveCouncilResult(assessmentResult, request.explanationIds);
  } catch (error) {
    logger.error(`[CouncilService] Failed to persist council result: ${error instanceof Error ? error.message : String(error)}`);
    // Don't rethrow - assessment succeeded, persistence is secondary
  }

  return assessmentResult;
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

/**
 * Extract a predicted output grid from the chairman's stage3 synthesis text.
 * Looks for grid-like patterns (arrays of numbers) in the response.
 */
function extractPredictedGridFromSynthesis(stage3Response: any): number[][] | null {
  if (!stage3Response) return null;

  const responseText = typeof stage3Response === 'string'
    ? stage3Response
    : (stage3Response.response ?? stage3Response.text ?? JSON.stringify(stage3Response));

  // Pattern: Look for [[ patterns followed by numbers and brackets
  const gridPattern = /\[\s*\[\s*\d+[\s\d,\[\]]*\]\s*\]/g;
  const matches = responseText.match(gridPattern);

  if (!matches || matches.length === 0) {
    return null;
  }

  try {
    // Try to parse the first grid-like structure found
    const gridStr = matches[0];
    const parsed = JSON.parse(gridStr);

    // Validate it's a 2D array of numbers
    if (Array.isArray(parsed) && parsed.every(row =>
      Array.isArray(row) && row.every(val => typeof val === 'number')
    )) {
      return parsed;
    }
  } catch (error) {
    logger.warn(`[CouncilService] Failed to parse predicted grid: ${error instanceof Error ? error.message : String(error)}`);
  }

  return null;
}

/**
 * Derive confidence score from council aggregate rankings.
 * Higher rankings = higher confidence.
 * Formula: 100 - (average_rank_position * 20)
 */
function deriveConfidenceFromRankings(aggregateRankings: any): number {
  if (!aggregateRankings) return 50; // Default neutral

  try {
    // aggregateRankings should be an object with ranking info
    // Typical structure: { ranking_1: count, ranking_2: count, ranking_3: count }
    if (typeof aggregateRankings !== 'object') return 50;

    const entries = Object.entries(aggregateRankings);
    if (entries.length === 0) return 50;

    let totalRank = 0;
    let totalCount = 0;

    for (const [rankKey, count] of entries) {
      // Parse rank from key like 'ranking_1', 'ranking_2', etc.
      const rankMatch = rankKey.match(/\d+/);
      if (rankMatch) {
        const rank = parseInt(rankMatch[0], 10);
        const countNum = typeof count === 'number' ? count : 1;
        totalRank += rank * countNum;
        totalCount += countNum;
      }
    }

    if (totalCount === 0) return 50;

    const avgRank = totalRank / totalCount;
    const confidence = Math.max(0, Math.min(100, 100 - (avgRank * 20)));

    return Math.round(confidence);
  } catch (error) {
    logger.warn(`[CouncilService] Failed to derive confidence: ${error instanceof Error ? error.message : String(error)}`);
    return 50;
  }
}

/**
 * Transform CouncilAssessmentResult into ExplanationData for database persistence.
 * Follows the same pattern as Beetree ensemble solver.
 */
function transformCouncilResult(
  result: CouncilAssessmentResult,
  explanationIds?: number[]
): any {
  const predictedGrid = extractPredictedGridFromSynthesis(result.stage3);
  const confidence = deriveConfidenceFromRankings(result.metadata?.aggregate_rankings);

  // Extract stage3 text for pattern description
  const stage3Text = typeof result.stage3 === 'string'
    ? result.stage3
    : (result.stage3?.response ?? JSON.stringify(result.stage3));

  return {
    puzzleId: result.taskId,
    modelName: 'llm-council',
    patternDescription: stage3Text,
    solvingStrategy: 'Multi-model consensus deliberation across 3 stages',
    confidence,
    predictedOutputGrid: predictedGrid,
    isPredictionCorrect: null, // Will be scored separately if prediction exists
    councilMode: result.mode,
    councilStage1Results: result.stage1,
    councilStage2Rankings: result.stage2,
    councilStage3Synthesis: result.stage3,
    councilMetadata: result.metadata,
    councilAssessedExplanationIds: explanationIds ?? null,
    councilAggregateRankings: result.metadata?.aggregate_rankings,
    councilPromptUsed: result.promptUsed,
    hints: [],
  };
}

/**
 * Save council assessment result to database as an explanation.
 * Includes prediction scoring if a grid was extracted.
 */
async function saveCouncilResult(
  result: CouncilAssessmentResult,
  explanationIds?: number[]
): Promise<void> {
  try {
    const explanationData = transformCouncilResult(result, explanationIds);

    // If we have a predicted grid, score it
    if (explanationData.predictedOutputGrid) {
      const puzzle = await puzzleLoader.loadPuzzle(result.taskId);
      if (puzzle && puzzle.test && puzzle.test.length > 0) {
        // Use simple grid comparison (exact match to first test output)
        const groundTruth = puzzle.test[0]?.output;
        if (groundTruth) {
          const predicted = explanationData.predictedOutputGrid;
          // Simple grid comparison: exact match
          explanationData.isPredictionCorrect =
            JSON.stringify(predicted) === JSON.stringify(groundTruth);
        }
      }
    }

    await repositoryService.explanations.saveExplanation(explanationData);
    logger.info(`[CouncilService] Saved council result for ${result.taskId}`);
  } catch (error) {
    logger.error(
      `[CouncilService] Failed to save council result: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export const councilService = {
  assessPuzzle,
  getUnsolvedPuzzles,
  getExplanationsForAssessment,
  saveCouncilResult,
};
