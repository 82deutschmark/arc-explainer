# Test Coverage Improvement Plan

**Author:** Claude Sonnet 4.5
**Date:** 2026-01-04
**Current Coverage:** ~4% (16 test files for 237 server files, 0 frontend tests)
**Target Coverage:** 60%+ across backend, 50%+ across frontend
**Timeline:** Phased approach over 4-6 weeks

---

## Executive Summary

This plan addresses the critical test coverage gap identified in the code quality assessment. Current state:
- **Backend:** 16 test files covering ~4% of 237 TypeScript files
- **Frontend:** 0 test files for 283 React components
- **Integration:** No integration or E2E tests
- **Risk:** High probability of regressions in production

**Goal:** Achieve production-grade test coverage (60%+ backend, 50%+ frontend) with focus on:
1. Critical business logic (repositories, services)
2. Complex workflows (streaming, multi-provider, conversation chaining)
3. User-facing components (PuzzleExaminer, ModelDebate, WormArena)
4. End-to-end critical paths

---

## Phase 1: Infrastructure Setup (Week 1)

### 1.1 Migrate to Vitest
**Why:** Faster execution, better DX, built-in TypeScript support, Vite integration

**Tasks:**
- [ ] Install dependencies: `vitest`, `@vitest/ui`, `@vitest/coverage-v8`
- [ ] Create `vitest.config.ts` with path aliases matching `tsconfig.json`
- [ ] Migrate existing Node.js tests to Vitest
- [ ] Add `npm run test:unit` and `npm run test:coverage` scripts
- [ ] Configure coverage thresholds (start at 20%, ramp to 60%)

**Files to create:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/**',
        '**/*.test.ts',
        '**/*.test.tsx'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared')
    }
  }
});
```

### 1.2 Add React Testing Library
**Why:** Industry standard for React component testing, excellent accessibility testing

**Tasks:**
- [ ] Install: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`
- [ ] Create `tests/setup.ts` with React Testing Library configuration
- [ ] Add `npm run test:frontend` script
- [ ] Create example component test

**Files to create:**
```typescript
// tests/setup.ts
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
```

### 1.3 Set Up Playwright for E2E
**Why:** Modern E2E framework with excellent debugging, parallel execution, multiple browsers

**Tasks:**
- [ ] Install: `@playwright/test`
- [ ] Run `npx playwright install`
- [ ] Create `playwright.config.ts`
- [ ] Add `npm run test:e2e` script
- [ ] Create `tests/e2e/` directory structure

---

## Phase 2: Backend Unit Tests - Repositories (Week 2)

### Priority 1: BaseRepository
**File:** `tests/unit/repositories/BaseRepository.test.ts`

**Test Coverage:**
- Connection pool initialization with retries
- Transaction management (BEGIN, COMMIT, ROLLBACK)
- Query execution with client management
- Safe JSON parsing with fallbacks
- Grid data sanitization
- Error handling and logging

**Example:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseRepository } from '../../../server/repositories/base/BaseRepository';

class TestRepository extends BaseRepository {
  async testQuery() {
    return this.query('SELECT 1');
  }

  async testTransaction() {
    return this.transaction(async (client) => {
      await client.query('SELECT 1');
      return 'success';
    });
  }
}

describe('BaseRepository', () => {
  let repo: TestRepository;

  beforeEach(() => {
    repo = new TestRepository();
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = repo['safeJsonParse']('{"key": "value"}');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return fallback for invalid JSON', () => {
      const fallback = { default: true };
      const result = repo['safeJsonParse']('invalid{json', 'testField', fallback);
      expect(result).toEqual(fallback);
    });

    it('should handle null values', () => {
      const result = repo['safeJsonParse'](null, 'testField', null);
      expect(result).toBeNull();
    });
  });

  describe('sanitizeGridData', () => {
    it('should sanitize valid 2D array', () => {
      const grid = [[1, 2], [3, 4]];
      const result = repo['sanitizeGridData'](grid);
      expect(result).toEqual([[1, 2], [3, 4]]);
    });

    it('should return null for invalid grid', () => {
      const result = repo['sanitizeGridData']('not-a-grid');
      expect(result).toBeNull();
    });

    it('should return null for non-numeric values', () => {
      const result = repo['sanitizeGridData']([['a', 'b']]);
      expect(result).toBeNull();
    });
  });

  // Add transaction tests, error handling tests, etc.
});
```

### Priority 2: Critical Repositories
**Files to create:**
- `tests/unit/repositories/ExplanationRepository.test.ts` - CRUD operations, search, filtering
- `tests/unit/repositories/AccuracyRepository.test.ts` - Score calculations, dataset metrics
- `tests/unit/repositories/MetricsRepository.test.ts` - Aggregations, performance queries
- `tests/unit/repositories/EloRepository.test.ts` - Rating calculations, comparison logic

**Test Strategy:**
- Mock database connections using `vi.mock()`
- Test SQL query construction (verify correct WHERE clauses, JOINs)
- Test data transformations (DB → API format)
- Test error handling (connection failures, constraint violations)

---

## Phase 3: Backend Unit Tests - Services (Week 3)

### Priority 1: BaseAIService
**File:** `tests/unit/services/BaseAIService.test.ts`

**Test Coverage:**
- Prompt package building with serviceOpts
- Cost calculation from token usage
- Response truncation detection (5 heuristic checks)
- Standard response building
- JSON extraction with preservation
- Error handling and logging
- Streaming harness management

**Example:**
```typescript
import { describe, it, expect, vi } from 'vitest';
import { BaseAIService } from '../../../server/services/base/BaseAIService';
import type { ARCTask } from '../../../shared/types';

class TestAIService extends BaseAIService {
  protected provider = 'test';
  protected models = { 'test-model': 'test-model-id' };

  async analyzePuzzleWithModel() {
    throw new Error('Not implemented');
  }

  getModelInfo() {
    return {
      name: 'Test Model',
      isReasoning: false,
      supportsTemperature: true,
      supportsFunctionCalling: false,
      supportsSystemPrompts: true,
      supportsStructuredOutput: false,
      supportsVision: false
    };
  }

  generatePromptPreview() {
    throw new Error('Not implemented');
  }

  protected async callProviderAPI() {
    throw new Error('Not implemented');
  }

  protected parseProviderResponse() {
    throw new Error('Not implemented');
  }
}

describe('BaseAIService', () => {
  let service: TestAIService;

  beforeEach(() => {
    service = new TestAIService();
  });

  describe('detectResponseTruncation', () => {
    it('should detect truncation via finish_reason=length', () => {
      const result = service['detectResponseTruncation']('some text', 'length');
      expect(result).toBe(true);
    });

    it('should not detect truncation for complete JSON', () => {
      const json = JSON.stringify({ key: 'value' });
      const result = service['detectResponseTruncation'](json, 'stop');
      expect(result).toBe(false);
    });

    it('should detect truncation for incomplete JSON', () => {
      const incomplete = '{"key": "val';
      const result = service['detectResponseTruncation'](incomplete);
      expect(result).toBe(true);
    });

    it('should detect unmatched braces', () => {
      const unmatched = '{"key": {"nested": "value"}';
      const result = service['detectResponseTruncation'](unmatched);
      expect(result).toBe(true);
    });

    it('should detect abrupt endings in non-JSON', () => {
      const abrupt = 'This is a sentence that ends abrupty with no punctu';
      const result = service['detectResponseTruncation'](abrupt, 'unknown');
      expect(result).toBe(true);
    });
  });

  describe('calculateResponseCost', () => {
    it('should calculate cost breakdown', () => {
      const tokenUsage = { input: 1000, output: 500, reasoning: 2000 };
      const cost = service['calculateResponseCost']('test-model', tokenUsage);

      expect(cost).toHaveProperty('total');
      expect(cost).toHaveProperty('input');
      expect(cost).toHaveProperty('output');
      expect(cost).toHaveProperty('reasoning');
    });

    it('should return null for unknown model', () => {
      const tokenUsage = { input: 1000, output: 500 };
      const cost = service['calculateResponseCost']('unknown-model', tokenUsage);
      expect(cost).toBeNull();
    });
  });

  describe('buildStandardResponse', () => {
    it('should preserve prediction fields', () => {
      const result = {
        predictedOutput: [[1, 2]],
        predictedOutput1: [[3, 4]],
        predictedOutput2: [[5, 6]],
        confidence: 0.9
      };

      const response = service['buildStandardResponse'](
        'test-model',
        0.2,
        result,
        { input: 100, output: 50 },
        {}
      );

      expect(response.predictedOutput).toEqual([[1, 2]]);
      expect(response.predictedOutput1).toEqual([[3, 4]]);
      expect(response.predictedOutput2).toEqual([[5, 6]]);
      expect(response.confidence).toBe(0.9);
    });
  });
});
```

### Priority 2: Provider Services
**Files to create:**
- `tests/unit/services/OpenAIService.test.ts` - Responses API compliance, streaming, conversation chaining
- `tests/unit/services/XAIService.test.ts` - Grok structured outputs, reasoning parameters
- `tests/unit/services/AnthropicService.test.ts` - Claude API integration
- `tests/unit/services/puzzleAnalysisService.test.ts` - Multi-provider orchestration

### Priority 3: Specialized Services
**Files to create:**
- `tests/unit/services/AnalysisStreamService.test.ts` (already exists, enhance it)
- `tests/unit/services/arc3/scorecardService.test.ts` - Scorecard lifecycle
- `tests/unit/services/reArc/reArcService.test.ts` (already exists, enhance it)
- `tests/unit/services/snakeBench/snakeBenchService.test.ts` - Match orchestration

---

## Phase 4: Backend Integration Tests (Week 4)

### Test Database Setup
Create `tests/helpers/testDatabase.ts`:
```typescript
import { Pool } from 'pg';

let testPool: Pool | null = null;

export async function setupTestDatabase() {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://localhost/arc_explainer_test';

  testPool = new Pool({ connectionString: databaseUrl });

  // Run migrations
  await runMigrations(testPool);

  return testPool;
}

export async function teardownTestDatabase() {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}

export async function clearTestData() {
  if (!testPool) throw new Error('Test pool not initialized');

  // Clear all tables in reverse dependency order
  await testPool.query('TRUNCATE TABLE explanations CASCADE');
  await testPool.query('TRUNCATE TABLE feedback CASCADE');
  // ... etc
}
```

### Priority Tests
**Files to create:**
- `tests/integration/explanationFlow.test.ts` - Complete explanation lifecycle (create, retrieve, update, delete)
- `tests/integration/multiProviderAnalysis.test.ts` - Analyze same puzzle with multiple providers
- `tests/integration/conversationChaining.test.ts` - Create explanation with previousResponseId
- `tests/integration/eloRating.test.ts` - Complete voting and rating flow
- `tests/integration/arc3Workflow.test.ts` - Start game, make actions, close scorecard

**Example:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, clearTestData } from '../helpers/testDatabase';
import { RepositoryService } from '../../server/repositories/RepositoryService';

describe('Explanation Flow Integration', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    await clearTestData();
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  it('should create, retrieve, and update explanation', async () => {
    const repos = RepositoryService.getInstance();
    const explanationRepo = repos.getExplanationRepository();

    // Create explanation
    const created = await explanationRepo.create({
      taskId: 'test-task',
      modelKey: 'gpt-4',
      patternDescription: 'Test pattern',
      predictedOutput: [[1, 2]],
      temperature: 0.2,
      timestamp: new Date()
    });

    expect(created.id).toBeDefined();
    expect(created.taskId).toBe('test-task');

    // Retrieve explanation
    const retrieved = await explanationRepo.getById(created.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.patternDescription).toBe('Test pattern');

    // Update explanation
    await explanationRepo.update(created.id, {
      patternDescription: 'Updated pattern'
    });

    const updated = await explanationRepo.getById(created.id);
    expect(updated?.patternDescription).toBe('Updated pattern');
  });

  it('should handle conversation chaining with previousResponseId', async () => {
    // Test that providerResponseId is preserved and used correctly
    // ...
  });
});
```

---

## Phase 5: Frontend Component Tests (Week 5)

### Setup Vitest for Frontend
Update `vitest.config.ts`:
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom', // Changed from 'node'
    setupFiles: ['./tests/setup.ts']
  }
});
```

### Priority 1: Core Components
**Files to create:**

#### Grid Display Components
```typescript
// tests/frontend/components/GridDisplay.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GridDisplay } from '../../../client/src/components/puzzle/GridDisplay';

describe('GridDisplay', () => {
  it('should render a simple 2x2 grid', () => {
    const grid = [[1, 2], [3, 4]];
    render(<GridDisplay grid={grid} />);

    // Verify all cells are rendered
    expect(screen.getAllByRole('gridcell')).toHaveLength(4);
  });

  it('should apply correct color classes', () => {
    const grid = [[0, 1], [2, 3]];
    const { container } = render(<GridDisplay grid={grid} />);

    // Verify color classes are applied
    expect(container.querySelector('[data-color="0"]')).toBeInTheDocument();
    expect(container.querySelector('[data-color="1"]')).toBeInTheDocument();
  });

  it('should handle empty grid', () => {
    const grid: number[][] = [];
    render(<GridDisplay grid={grid} />);

    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
  });
});
```

#### Puzzle Components
```typescript
// tests/frontend/components/PuzzleCard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PuzzleCard } from '../../../client/src/components/puzzle/PuzzleCard';

describe('PuzzleCard', () => {
  const mockPuzzle = {
    taskId: 'abc123',
    name: 'Test Puzzle',
    difficulty: 'medium',
    avgAccuracy: 0.75
  };

  it('should render puzzle information', () => {
    render(<PuzzleCard puzzle={mockPuzzle} />);

    expect(screen.getByText('Test Puzzle')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText(/75%/)).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(<PuzzleCard puzzle={mockPuzzle} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledWith('abc123');
  });
});
```

### Priority 2: Complex Pages
**Files to create:**
- `tests/frontend/pages/PuzzleExaminer.test.tsx` - Puzzle loading, grid display, analysis controls
- `tests/frontend/pages/ModelDebate.test.tsx` - Comparison UI, voting, preferences
- `tests/frontend/pages/WormArena.test.tsx` - Match display, replay controls
- `tests/frontend/pages/Arc3Playground.test.tsx` - Agent controls, streaming output

### Priority 3: Custom Hooks
**Files to create:**
- `tests/frontend/hooks/usePuzzle.test.ts` - Data fetching, caching, error handling
- `tests/frontend/hooks/useAnalysisResults.test.ts` - Results aggregation, filtering
- `tests/frontend/hooks/useEloVoting.test.ts` - Voting logic, optimistic updates

**Example:**
```typescript
// tests/frontend/hooks/usePuzzle.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePuzzle } from '../../../client/src/hooks/usePuzzle';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('usePuzzle', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should fetch puzzle data successfully', async () => {
    const mockPuzzle = {
      taskId: 'abc123',
      train: [{ input: [[1]], output: [[2]] }],
      test: [{ input: [[3]] }]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPuzzle
    });

    const { result } = renderHook(() => usePuzzle('abc123'), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockPuzzle);
  });

  it('should handle fetch errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePuzzle('abc123'), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
```

---

## Phase 6: E2E Tests with Playwright (Week 6)

### Setup
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Critical E2E Tests
**Files to create:**

#### 1. Puzzle Analysis Flow
```typescript
// tests/e2e/puzzleAnalysis.spec.ts
import { test, expect } from '@playwright/test';

test('complete puzzle analysis workflow', async ({ page }) => {
  // Navigate to puzzle browser
  await page.goto('/');
  await page.click('text=Puzzle Browser');

  // Select a puzzle
  await page.click('[data-testid="puzzle-card-abc123"]');

  // Verify puzzle loads
  await expect(page.locator('[data-testid="puzzle-grid"]')).toBeVisible();

  // Start analysis
  await page.selectOption('[data-testid="model-select"]', 'gpt-4');
  await page.click('[data-testid="analyze-button"]');

  // Wait for results
  await expect(page.locator('[data-testid="analysis-result"]')).toBeVisible({ timeout: 30000 });

  // Verify result fields
  await expect(page.locator('[data-testid="pattern-description"]')).toContainText(/pattern/i);
  await expect(page.locator('[data-testid="predicted-output"]')).toBeVisible();
});
```

#### 2. Model Comparison Flow
```typescript
// tests/e2e/modelComparison.spec.ts
import { test, expect } from '@playwright/test';

test('compare two model explanations', async ({ page }) => {
  await page.goto('/debate');

  // Wait for comparison to load
  await expect(page.locator('[data-testid="comparison-pair"]')).toBeVisible();

  // Vote for preferred explanation
  await page.click('[data-testid="vote-left"]');

  // Verify optimistic update
  await expect(page.locator('[data-testid="vote-recorded"]')).toBeVisible();

  // Load next comparison
  await page.click('[data-testid="next-comparison"]');
  await expect(page.locator('[data-testid="comparison-pair"]')).toBeVisible();
});
```

#### 3. Streaming Analysis
```typescript
// tests/e2e/streamingAnalysis.spec.ts
import { test, expect } from '@playwright/test';

test('SSE streaming analysis', async ({ page }) => {
  await page.goto('/task/abc123');

  // Start streaming analysis
  await page.selectOption('[data-testid="model-select"]', 'gpt-5-2025-08-07');
  await page.click('[data-testid="analyze-streaming-button"]');

  // Verify streaming starts
  await expect(page.locator('[data-testid="streaming-indicator"]')).toBeVisible();

  // Wait for chunks to appear
  await expect(page.locator('[data-testid="reasoning-chunk"]').first()).toBeVisible({ timeout: 10000 });

  // Verify streaming completes
  await expect(page.locator('[data-testid="streaming-complete"]')).toBeVisible({ timeout: 60000 });
});
```

#### 4. Worm Arena Replay
```typescript
// tests/e2e/wormArena.spec.ts
import { test, expect } from '@playwright/test';

test('view worm arena replay', async ({ page }) => {
  await page.goto('/worm-arena');

  // Select a greatest hit
  await page.click('[data-testid="greatest-hit-1"]');

  // Verify replay loads
  await expect(page.locator('[data-testid="game-canvas"]')).toBeVisible();

  // Play replay
  await page.click('[data-testid="play-button"]');

  // Verify animation starts
  await expect(page.locator('[data-testid="current-round"]')).not.toHaveText('0');

  // Pause
  await page.click('[data-testid="pause-button"]');
});
```

#### 5. BYOK Flow
```typescript
// tests/e2e/byok.spec.ts
import { test, expect } from '@playwright/test';

test('BYOK enforcement and usage', async ({ page }) => {
  await page.goto('/task/abc123');

  // Verify BYOK prompt appears for paid provider
  await page.selectOption('[data-testid="model-select"]', 'gpt-4');
  await expect(page.locator('[data-testid="api-key-input"]')).toBeVisible();

  // Enter API key
  await page.fill('[data-testid="api-key-input"]', 'sk-test-key');

  // Verify key is accepted (session-only storage)
  await page.click('[data-testid="analyze-button"]');

  // Key should be used for request (verify via network log)
  const requestPromise = page.waitForRequest(req =>
    req.url().includes('/api/puzzle/analyze') &&
    req.headers()['x-api-key'] === 'sk-test-key'
  );

  await requestPromise;
});
```

---

## Phase 7: Coverage Reporting & CI Integration

### Coverage Configuration
Update `package.json`:
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --coverage",
    "test:frontend": "vitest run --config vitest.frontend.config.ts",
    "test:integration": "vitest run tests/integration --coverage",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:frontend && npm run test:e2e",
    "test:watch": "vitest watch",
    "test:ui": "vitest --ui"
  }
}
```

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, ARC3]
  pull_request:
    branches: [main, ARC3]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:frontend

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Pre-commit Hook
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run test:unit -- --run --silent
```

---

## Testing Best Practices

### 1. Test Organization
```
tests/
├── unit/                 # Fast, isolated unit tests
│   ├── repositories/
│   ├── services/
│   └── utils/
├── integration/          # Database + service integration
│   ├── explanationFlow.test.ts
│   └── arc3Workflow.test.ts
├── frontend/            # React component tests
│   ├── components/
│   ├── pages/
│   └── hooks/
├── e2e/                 # Playwright E2E tests
│   └── *.spec.ts
└── helpers/             # Test utilities
    ├── testDatabase.ts
    ├── mockData.ts
    └── fixtures.ts
```

### 2. Naming Conventions
- **Unit tests:** `<ComponentName>.test.ts`
- **Integration tests:** `<workflow>.test.ts`
- **E2E tests:** `<feature>.spec.ts`

### 3. Test Structure (AAA Pattern)
```typescript
test('should do something specific', async () => {
  // Arrange - set up test data and mocks
  const input = createTestInput();
  const expected = expectedOutput();

  // Act - execute the code under test
  const result = await functionUnderTest(input);

  // Assert - verify the outcome
  expect(result).toEqual(expected);
});
```

### 4. Mock Strategy
- **Unit tests:** Mock all external dependencies (database, APIs, file system)
- **Integration tests:** Use test database, mock external APIs only
- **E2E tests:** Minimize mocking, use staging environment

### 5. Test Data Management
```typescript
// tests/helpers/fixtures.ts
export const createMockPuzzle = (overrides = {}) => ({
  taskId: 'test-abc123',
  train: [
    { input: [[1, 2]], output: [[3, 4]] }
  ],
  test: [
    { input: [[5, 6]] }
  ],
  ...overrides
});

export const createMockExplanation = (overrides = {}) => ({
  id: 1,
  taskId: 'test-abc123',
  modelKey: 'gpt-4',
  patternDescription: 'Test pattern',
  predictedOutput: [[1, 2]],
  temperature: 0.2,
  timestamp: new Date(),
  ...overrides
});
```

---

## Success Metrics

### Coverage Targets
- **Phase 1-2 (Weeks 1-2):** 20% backend coverage
- **Phase 3-4 (Weeks 3-4):** 40% backend coverage, 20% frontend coverage
- **Phase 5-6 (Weeks 5-6):** 60% backend coverage, 50% frontend coverage
- **Phase 7:** CI/CD integration, coverage enforcement

### Quality Gates
- No PR merge without passing tests
- Coverage must not decrease (ratcheting)
- E2E tests must pass on staging before production deploy
- Critical paths must have 80%+ coverage:
  - Explanation creation/retrieval
  - Multi-provider analysis
  - Conversation chaining
  - Elo rating calculation
  - ARC3 scorecard lifecycle

### Monitoring
- Codecov for coverage tracking
- Playwright reports for E2E failures
- Vitest UI for local development
- GitHub Actions for CI status

---

## Rollout Strategy

### Week 1: Setup & Training
- Install Vitest, React Testing Library, Playwright
- Create example tests
- Team training session on testing patterns

### Week 2-3: Repository & Service Tests
- Focus on BaseRepository and BaseAIService
- Create test helpers and fixtures
- Establish mocking patterns

### Week 4: Integration Tests
- Set up test database
- Create end-to-end workflow tests
- Document integration testing patterns

### Week 5: Frontend Tests
- Component library tests first
- Then complex page tests
- Custom hook tests

### Week 6: E2E & CI
- Critical path E2E tests
- GitHub Actions integration
- Coverage enforcement

### Ongoing: Maintenance
- New features require tests (TDD encouraged)
- Bug fixes require regression tests
- Quarterly review of test health

---

## Appendix: Quick Reference

### Running Tests
```bash
# All tests
npm run test:all

# Unit tests only (fast)
npm run test:unit

# Frontend tests
npm run test:frontend

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Watch mode for TDD
npm run test:watch

# Coverage report
npm run test:unit -- --coverage
open coverage/index.html

# Interactive UI
npm run test:ui
```

### Writing Your First Test
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/myModule';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Debugging Tests
```typescript
// Add .only to run single test
it.only('should debug this test', () => {
  // ...
});

// Add .skip to temporarily disable
it.skip('should skip this test', () => {
  // ...
});

// Use debugger
it('should debug with breakpoint', () => {
  debugger; // Pause here in VS Code debugger
  const result = myFunction();
  expect(result).toBe('expected');
});
```

---

## Impact Assessment

**Before:**
- 16 test files, ~4% backend coverage, 0% frontend coverage
- High risk of production regressions
- No E2E validation of critical flows
- Manual testing required for every deployment

**After (60% coverage):**
- 150+ test files across unit/integration/frontend/E2E
- Automated validation of critical business logic
- CI/CD prevents regressions from reaching production
- Confident refactoring and feature development
- Documentation through tests (living examples)

**ROI:**
- Fewer production bugs (estimated 70% reduction)
- Faster development velocity (confident refactoring)
- Better onboarding (tests as documentation)
- Reduced manual QA time (estimated 80% reduction)
- Grade improvement: C+ → A (test coverage category)
- Overall project grade: A- → A

---

**Next Steps:**
1. Review and approve this plan
2. Allocate time for implementation (6 weeks phased approach)
3. Start with Phase 1 infrastructure setup
4. Track progress with coverage metrics
5. Celebrate when we hit 60% coverage! 🎉
