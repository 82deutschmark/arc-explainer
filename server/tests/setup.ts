/**
 * Jest test setup configuration
 * Sets up test environment, mocks, and global test utilities
 * 
 * @author Cascade
 */

import { jest } from '@jest/globals';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/arc_explainer_test';

// Mock console methods to reduce noise in tests unless needed
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Mock WebSocket service to prevent actual connections in tests
jest.mock('../services/wsService', () => ({
  broadcast: jest.fn(),
  clearSession: jest.fn(),
}));

// Mock puzzle loader to prevent file system dependencies
jest.mock('../services/puzzleLoader', () => ({
  puzzleLoader: {
    loadPuzzle: jest.fn(),
    getPuzzleList: jest.fn().mockResolvedValue([]),
    validateTask: jest.fn().mockReturnValue(true),
  }
}));
