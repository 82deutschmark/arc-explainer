# Service Layer Migration & Unit Testing Handoff Guide

**Date**: 2025-08-27  
**Author**: Cascade claude-3-5-sonnet-20241022  
**For**: Next Developer  
**Priority**: Complete remaining service layer migration and add comprehensive unit tests

## Executive Summary

Phases 1 & 2 of the Strategic Refactoring Plan are **COMPLETED**. The foundation work is done:
- ✅ Repository pattern implemented with dependency injection
- ✅ BaseAIService eliminates 90%+ code duplication 
- ✅ Database corruption fixed, validation middleware added
- ✅ Major controller methods decomposed

**YOUR MISSION**: Complete service layer migration from `dbService` to repositories and add comprehensive unit tests.

## Current Architecture State

### ✅ What's Already Migrated
- **feedbackController.ts** - Fully migrated to `repositoryService.feedback`
- **Repository Classes Created**:
  - `BaseRepository` - Transaction management, shared utilities
  - `ExplanationRepository` - Analysis/explanation operations
  - `FeedbackRepository` - Rating and feedback operations  
  - `BatchAnalysisRepository` - Batch processing operations
- **Dependency Injection**: `RepositoryService` provides unified interface

### 🔄 What Still Needs Migration
Based on `grep` analysis, these files still import/use `dbService`:

1. **server/services/batchAnalysisService.ts** (15 usages) - HIGH PRIORITY
2. **server/services/explanationService.ts** (4 usages) - HIGH PRIORITY  
3. **server/routes.ts** (3 usages) - MEDIUM PRIORITY
4. **server/services/feedbackService.ts** (2 usages) - LOW PRIORITY (may be unused)
5. **server/services/puzzleService.ts** (2 usages) - MEDIUM PRIORITY
6. **server/services/saturnVisualService.ts** (2 usages) - LOW PRIORITY
7. **server/index.ts** (1 usage) - INITIALIZATION ONLY
8. **server/controllers/puzzleController.ts** (import only, appears unused)

## Phase 3A: Service Layer Migration Plan

### Step 1: High Priority Services (Start Here)

#### 1.1 Migrate batchAnalysisService.ts
**Impact**: Critical - handles batch processing core logic

**Current State**: 15 `dbService` calls
**Target**: Use `repositoryService.batchAnalysis` methods

**Migration Steps**:
```typescript
// Before
import { dbService } from './dbService';
const result = await dbService.saveBatchRun(batchData);

// After  
import { repositoryService } from '../repositories/RepositoryService';
const result = await repositoryService.batchAnalysis.saveBatchRun(batchData);
```

**Files to Update**:
- Replace all `dbService.` calls with appropriate repository methods
- Update imports to use `repositoryService` 
- Verify all batch operations work with new repository layer

#### 1.2 Migrate explanationService.ts
**Impact**: High - handles explanation creation/retrieval

**Current State**: 4 `dbService` calls
**Target**: Use `repositoryService.explanation` methods

**Migration Pattern**:
```typescript
// Before
await dbService.saveExplanation(explanationData);
const explanations = await dbService.getExplanations(taskId);

// After
await repositoryService.explanation.saveExplanation(explanationData);
const explanations = await repositoryService.explanation.getExplanations(taskId);
```

### Step 2: Medium Priority Services

#### 2.1 Migrate puzzleService.ts  
**Current State**: 2 `dbService` calls
**Target**: Create `PuzzleRepository` if needed, or use existing repositories

#### 2.2 Update routes.ts
**Current State**: 3 `dbService` calls  
**Target**: Route-level database calls should be moved to appropriate services/repositories

### Step 3: Clean Up & Validation

#### 3.1 Remove Unused Imports
- **puzzleController.ts**: Remove unused `dbService` import
- **feedbackService.ts**: Verify if still needed, remove if unused

#### 3.2 Final DbService Retirement
**Only after ALL migrations complete:**
- Remove `server/services/dbService.ts` 
- Update any remaining references
- Verify no build errors

## Phase 3B: Unit Testing Strategy

### Testing Architecture Overview

#### Test Structure
```
server/
├── __tests__/
│   ├── repositories/
│   │   ├── base/
│   │   │   └── BaseRepository.test.ts
│   │   ├── ExplanationRepository.test.ts  
│   │   ├── FeedbackRepository.test.ts
│   │   ├── BatchAnalysisRepository.test.ts
│   │   └── RepositoryService.test.ts
│   ├── services/
│   │   ├── base/
│   │   │   └── BaseAIService.test.ts
│   │   ├── explanationService.test.ts
│   │   ├── batchAnalysisService.test.ts
│   │   └── aiServiceFactory.test.ts
│   ├── controllers/
│   │   ├── puzzleController.test.ts
│   │   ├── feedbackController.test.ts
│   │   └── batchAnalysisController.test.ts
│   └── utils/
│       ├── CommonUtilities.test.ts
│       └── dataTransformers.test.ts
```

### Testing Dependencies Setup

#### Required Packages
```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",  
    "ts-jest": "^29.0.0",
    "supertest": "^6.0.0",
    "@types/supertest": "^2.0.0",
    "testcontainers": "^9.0.0"  // For PostgreSQL integration tests
  }
}
```

#### Jest Configuration (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.test.ts',
    '!server/**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.ts']
};
```

### Priority 1: Repository Unit Tests

#### Template: ExplanationRepository.test.ts
```typescript
import { ExplanationRepository } from '../repositories/ExplanationRepository';
import { BaseRepository } from '../repositories/base/BaseRepository';
import { Pool } from 'pg';

// Mock the database pool
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  }))
}));

describe('ExplanationRepository', () => {
  let repository: ExplanationRepository;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    repository = new ExplanationRepository(mockPool);
  });

  describe('saveExplanation', () => {
    it('should save explanation with correct data transformation', async () => {
      const mockExplanation = {
        taskId: 'test-123',
        explanation: 'Test explanation',
        confidence: 0.85
      };

      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ id: 1, ...mockExplanation }] 
      });

      const result = await repository.saveExplanation(mockExplanation);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO explanations'),
        expect.arrayContaining(['test-123', 'Test explanation', 0.85])
      );
      expect(result.id).toBe(1);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'));

      await expect(repository.saveExplanation({}))
        .rejects.toThrow('DB connection failed');
    });
  });

  describe('getExplanationsByTaskId', () => {
    it('should retrieve and transform explanations correctly', async () => {
      // Test implementation
    });
  });
});
```

### Priority 2: Service Layer Tests

#### Template: explanationService.test.ts  
```typescript
import { explanationService } from '../services/explanationService';
import { repositoryService } from '../repositories/RepositoryService';

jest.mock('../repositories/RepositoryService');

describe('explanationService', () => {
  const mockRepositoryService = repositoryService as jest.Mocked<typeof repositoryService>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createExplanation', () => {
    it('should validate input and call repository correctly', async () => {
      const explanationData = {
        taskId: 'test-123',
        explanation: 'Test explanation'
      };

      mockRepositoryService.explanation.saveExplanation.mockResolvedValueOnce({
        id: 1, 
        ...explanationData
      });

      const result = await explanationService.createExplanation(explanationData);

      expect(mockRepositoryService.explanation.saveExplanation)
        .toHaveBeenCalledWith(explanationData);
      expect(result.id).toBe(1);
    });
  });
});
```

### Priority 3: Controller Integration Tests

#### Template: feedbackController.test.ts
```typescript
import request from 'supertest';
import express from 'express';
import { feedbackController } from '../controllers/feedbackController';

const app = express();
app.use(express.json());
app.post('/feedback', feedbackController.submitFeedback);

describe('Feedback Controller', () => {
  describe('POST /feedback', () => {
    it('should accept valid feedback and return success', async () => {
      const validFeedback = {
        taskId: 'test-123',
        rating: 4,
        comment: 'Good explanation'
      };

      const response = await request(app)
        .post('/feedback')
        .send(validFeedback)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should reject invalid feedback with 400 error', async () => {
      const invalidFeedback = {
        rating: 'invalid'  // Should be number
      };

      const response = await request(app)
        .post('/feedback')  
        .send(invalidFeedback)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });
});
```

## Testing Best Practices

### 1. Test Categories
- **Unit Tests**: Individual functions/methods in isolation
- **Integration Tests**: Repository + database interactions  
- **Controller Tests**: HTTP endpoint behavior
- **E2E Tests**: Full workflow testing (optional)

### 2. Coverage Goals
- **Repositories**: 95%+ coverage (critical data layer)
- **Services**: 90%+ coverage (business logic)  
- **Controllers**: 85%+ coverage (API behavior)
- **Utils**: 90%+ coverage (shared utilities)

### 3. Test Data Management
```typescript
// Create test fixtures for consistent data
export const testFixtures = {
  validPuzzle: {
    taskId: 'test-puzzle-123',
    train: [/* puzzle data */],
    test: [/* test data */]
  },
  validExplanation: {
    taskId: 'test-puzzle-123',
    explanation: 'Test explanation text',
    confidence: 0.85
  }
};
```

### 4. Database Testing Strategy
- Use **testcontainers** for real PostgreSQL in CI/CD
- Use **in-memory SQLite** for fast local development  
- Always clean up test data after each test
- Use transactions that rollback for isolation

## Implementation Timeline

### Week 1: Service Migration
- **Day 1-2**: Migrate batchAnalysisService.ts and explanationService.ts
- **Day 3**: Migrate puzzleService.ts and routes.ts  
- **Day 4**: Clean up unused imports and validate migrations
- **Day 5**: Testing and validation of migrated services

### Week 2: Unit Testing  
- **Day 1-2**: Set up testing infrastructure and write repository tests
- **Day 3**: Write service layer unit tests
- **Day 4**: Write controller integration tests  
- **Day 5**: Achieve coverage goals and fix any issues

## Success Criteria

### Service Migration Complete ✅
- [ ] Zero `dbService` imports in service layer files
- [ ] All database operations use repository pattern
- [ ] No functionality regression after migration  
- [ ] DbService.ts file successfully removed

### Unit Testing Complete ✅  
- [ ] 90%+ code coverage across repositories and services
- [ ] All critical paths have test coverage
- [ ] CI/CD pipeline runs tests automatically
- [ ] Documentation updated with testing guidelines

## Common Pitfalls to Avoid

### Migration Issues
1. **Transaction Handling**: Ensure repositories maintain transaction boundaries
2. **Error Propagation**: Preserve existing error handling patterns
3. **Type Safety**: Maintain TypeScript strict mode compliance
4. **Async Patterns**: Don't change async/await patterns during migration

### Testing Issues  
1. **Test Isolation**: Each test should be independent 
2. **Mock Management**: Clear mocks between tests to avoid interference
3. **Database State**: Always clean up test data to prevent flaky tests
4. **Coverage Gaps**: Focus on edge cases and error conditions

## Helpful Commands

```bash
# Run all tests
npm test

# Run tests with coverage  
npm run test:coverage

# Run specific test file
npm test -- ExplanationRepository.test.ts

# Run tests in watch mode during development
npm test -- --watch

# Migrate a single service (example)
# 1. Update imports
# 2. Replace dbService calls  
# 3. Run tests to verify
npm test -- explanationService.test.ts
```

## Architecture Validation

After completing migration, verify:

```typescript
// This should NOT exist anywhere:
import { dbService } from './dbService';

// This SHOULD be the pattern everywhere:  
import { repositoryService } from '../repositories/RepositoryService';
await repositoryService.explanation.saveExplanation(data);
```

## Support Resources

- **Repository Examples**: Check `feedbackController.ts` for migration patterns
- **Test Examples**: Follow Jest best practices from existing codebase
- **Architecture Questions**: Refer to `Strategic_Refactoring_Plan_2025-08-27.md`
- **Database Schema**: See `server/repositories/database/` for table definitions

---

**Remember**: The foundation work is DONE. You're completing the final migration step and adding the safety net of comprehensive tests. Focus on consistency, maintain existing functionality, and achieve high test coverage.

Good luck! 🚀
