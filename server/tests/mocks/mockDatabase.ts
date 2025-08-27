/**
 * Mock database setup for unit tests
 * Provides in-memory database simulation for testing repositories
 * 
 * @author Cascade
 */

import { jest } from '@jest/globals';

// Mock database client interface
export interface MockClient {
  query: jest.MockedFunction<any>;
  release: jest.MockedFunction<any>;
}

// Mock database pool
export const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
};

// Create mock client
export const createMockClient = (): MockClient => ({
  query: jest.fn(),
  release: jest.fn(),
});

// Mock data for testing
export const mockExplanationData = {
  id: 1,
  task_id: 'test-puzzle-1',
  pattern_description: 'Test pattern description',
  transformation_rule: 'Test transformation rule',
  model_name: 'gpt-4',
  confidence: 0.85,
  api_processing_time_ms: 1500,
  estimated_cost: 0.01,
  created_at: new Date('2025-01-01T00:00:00Z'),
  has_reasoning_log: true,
  reasoning_log: 'Test reasoning log'
};

export const mockBatchSessionData = {
  id: 'test-session-1',
  model: 'gpt-4',
  temperature: 0.7,
  max_tokens: 2000,
  status: 'running',
  total_puzzles: 10,
  completed_puzzles: 5,
  successful_puzzles: 3,
  failed_puzzles: 2,
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:10:00Z'),
  estimated_cost: 0.50
};

export const mockFeedbackData = {
  id: 1,
  explanation_id: 1,
  vote_type: 'helpful',
  comment: 'Very helpful explanation',
  created_at: new Date('2025-01-01T00:00:00Z'),
  user_agent: 'test-agent',
  session_id: 'test-session'
};
