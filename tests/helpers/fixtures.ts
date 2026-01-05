/**
 * Author: Cascade
 * Date: 2026-01-05T17:20:00Z
 * PURPOSE: Centralized factories for ARC puzzles, explanations, and related test fixtures.
 *          Keeps unit tests consistent while documenting expected default shapes.
 * SRP/DRY check: Pass — reusing shared builders avoids duplicate inline mock definitions.
 */

import type { ARCTask, ARCExample } from '../../shared/types.js';

/**
 * Create a mock ARC puzzle with sensible defaults
 */
export function createMockPuzzle(overrides: Partial<ARCTask> = {}): ARCTask {
  const defaultTrain: ARCExample[] = [
    {
      input: [[1, 2], [3, 4]],
      output: [[5, 6], [7, 8]]
    },
    {
      input: [[0, 1], [1, 0]],
      output: [[1, 0], [0, 1]]
    }
  ];

  const defaultTest: ARCExample[] = [
    {
      input: [[2, 3], [4, 5]],
      output: [[5, 4], [3, 2]]
    }
  ];

  return {
    train: defaultTrain,
    test: defaultTest,
    ...overrides
  };
}

/**
 * Create a mock explanation record
 */
export function createMockExplanation(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    taskId: 'test-abc123',
    modelKey: 'gpt-4',
    patternDescription: 'Test pattern description',
    solvingStrategy: 'Test solving strategy',
    hints: ['Hint 1', 'Hint 2'],
    confidence: 0.85,
    predictedOutput: [[1, 2], [3, 4]],
    isPredictionCorrect: true,
    temperature: 0.2,
    timestamp: new Date('2026-01-04T00:00:00Z'),
    inputTokens: 1000,
    outputTokens: 500,
    reasoningTokens: 2000,
    estimatedCost: 0.05,
    ...overrides
  };
}

/**
 * Create a mock AI service response
 */
export function createMockAIResponse(overrides: Record<string, any> = {}) {
  return {
    model: 'gpt-4',
    reasoningLog: 'Test reasoning log',
    hasReasoningLog: true,
    temperature: 0.2,
    reasoningEffort: 'medium',
    reasoningVerbosity: 'high',
    reasoningSummaryType: 'detailed',
    inputTokens: 1000,
    outputTokens: 500,
    reasoningTokens: 2000,
    totalTokens: 3500,
    estimatedCost: 0.05,
    status: 'complete',
    incomplete: false,
    patternDescription: 'Test pattern',
    solvingStrategy: 'Test strategy',
    hints: ['Hint 1'],
    confidence: 0.85,
    predictedOutput: [[1, 2]],
    ...overrides
  };
}

/**
 * Create a mock feedback record
 */
export function createMockFeedback(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    explanationId: 1,
    feedbackType: 'helpful',
    comment: 'Test feedback comment',
    timestamp: new Date('2026-01-04T00:00:00Z'),
    ...overrides
  };
}

/**
 * Create a mock batch analysis session
 */
export function createMockBatchSession(overrides: Record<string, any> = {}) {
  return {
    sessionId: 'test-session-123',
    modelKey: 'gpt-4',
    temperature: 0.2,
    totalTasks: 10,
    completedTasks: 5,
    status: 'running',
    createdAt: new Date('2026-01-04T00:00:00Z'),
    ...overrides
  };
}

/**
 * Create a mock Elo rating record
 */
export function createMockEloRating(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    modelKey: 'gpt-4',
    rating: 1500,
    deviation: 200,
    volatility: 0.06,
    gamesPlayed: 10,
    lastUpdated: new Date('2026-01-04T00:00:00Z'),
    ...overrides
  };
}

/**
 * Create a mock ARC3 session
 */
export function createMockArc3Session(overrides: Record<string, any> = {}) {
  return {
    sessionId: 'test-arc3-session',
    guid: 'test-game-guid',
    gameId: 'game-123',
    modelKey: 'gpt-4',
    status: 'active',
    scorecardId: 'test-scorecard',
    createdAt: new Date('2026-01-04T00:00:00Z'),
    ...overrides
  };
}

/**
 * Create a mock scorecard
 */
export function createMockScorecard(overrides: Record<string, any> = {}) {
  return {
    cardId: 'test-scorecard-123',
    sourceUrl: 'https://test.com/scorecard',
    tags: ['test', 'example'],
    opaque: false,
    isActive: true,
    createdAt: new Date('2026-01-04T00:00:00Z'),
    closedAt: null,
    ...overrides
  };
}

/**
 * Create a mock token usage object
 */
export function createMockTokenUsage(overrides: Record<string, any> = {}) {
  return {
    input: 1000,
    output: 500,
    reasoning: 2000,
    ...overrides
  };
}

/**
 * Create a mock grid (2D array of numbers)
 */
export function createMockGrid(rows: number = 3, cols: number = 3, fillValue: number = 0): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => fillValue)
  );
}

/**
 * Create a random grid with varied values (0-9)
 */
export function createRandomGrid(rows: number = 3, cols: number = 3): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.floor(Math.random() * 10))
  );
}
