# Test Infrastructure Dependencies Installation Guide

**Author:** Claude Sonnet 4.5
**Date:** 2026-01-04
**Purpose:** Installation guide for all testing dependencies

---

## Required Dependencies

Run the following command to install all testing dependencies:

```bash
npm install --save-dev \
  vitest \
  @vitest/ui \
  @vitest/coverage-v8 \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  jsdom \
  @playwright/test \
  happy-dom
```

---

## Dependency Breakdown

### Vitest (Test Runner)
```bash
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8
```

**Purpose:**
- `vitest` - Fast Vite-native test framework
- `@vitest/ui` - Interactive UI for debugging tests
- `@vitest/coverage-v8` - Code coverage reporting via V8

**Why Vitest over Jest:**
1. Native ESM support (matches our codebase)
2. 10x faster than Jest for Vite projects
3. Compatible API (easy migration)
4. Better TypeScript support out of the box

### React Testing Library
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

**Purpose:**
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom matchers for DOM assertions
- `@testing-library/user-event` - Realistic user interaction simulation

**Why React Testing Library:**
1. Industry standard for React testing
2. Encourages testing from user perspective
3. Excellent accessibility testing support
4. Works seamlessly with Vitest

### DOM Environment
```bash
npm install --save-dev jsdom happy-dom
```

**Purpose:**
- `jsdom` - Full DOM implementation for Node.js (slower, more compatible)
- `happy-dom` - Lightweight DOM implementation (faster, good for most cases)

**We use jsdom for safety**, but happy-dom is available for speed optimization later.

### Playwright (E2E Testing)
```bash
npm install --save-dev @playwright/test
npx playwright install  # Downloads browser binaries
```

**Purpose:**
- End-to-end testing across multiple browsers
- Automatic waiting and retry logic
- Excellent debugging tools
- Parallel test execution

**Why Playwright over Cypress:**
1. True multi-browser support (Chrome, Firefox, Safari)
2. Faster execution
3. Better CI/CD integration
4. Native TypeScript support

---

## Post-Installation Setup

### 1. Initialize Playwright
```bash
npx playwright install --with-deps
```

This downloads browser binaries for Chromium, Firefox, and WebKit.

### 2. Verify Installation
```bash
# Run existing tests with Vitest
npm run test

# Check coverage
npm run test:coverage

# Open Vitest UI
npm run test:ui
```

### 3. Create .gitignore entries
Add to `.gitignore`:
```
# Test coverage
coverage/
coverage-frontend/
.nyc_output/

# Playwright
playwright-report/
test-results/
playwright/.cache/
```

---

## Package.json Scripts Reference

After installation, you'll have these scripts available:

```json
{
  "scripts": {
    "test": "vitest",                                    // Watch mode
    "test:unit": "vitest run tests/unit --coverage",     // Backend unit tests with coverage
    "test:integration": "vitest run tests/integration --coverage",  // Integration tests
    "test:frontend": "vitest run --config vitest.frontend.config.ts", // Frontend tests
    "test:e2e": "playwright test",                       // E2E tests
    "test:all": "npm run test:unit && npm run test:frontend && npm run test:e2e", // All tests
    "test:watch": "vitest watch",                        // Watch mode
    "test:ui": "vitest --ui",                            // Interactive UI
    "test:coverage": "vitest run --coverage"             // Full coverage report
  }
}
```

---

## Verification Checklist

After installation, verify everything works:

- [ ] `npm run test` runs without errors
- [ ] `npm run test:unit` executes BaseRepository and BaseAIService tests
- [ ] `npm run test:coverage` generates coverage report
- [ ] `npm run test:ui` opens interactive UI at http://localhost:51204
- [ ] `npx playwright test --list` shows available E2E tests
- [ ] Coverage thresholds pass (20% initially)

---

## Troubleshooting

### Issue: "Cannot find module 'vitest'"
**Solution:** Run `npm install` again, ensure `node_modules/` exists

### Issue: Playwright browsers not found
**Solution:** Run `npx playwright install --with-deps`

### Issue: jsdom errors in frontend tests
**Solution:** Ensure `tests/setup.frontend.ts` is created and referenced in `vitest.frontend.config.ts`

### Issue: Path alias errors (@/ and @shared/)
**Solution:** Check `vitest.config.ts` has correct resolve.alias configuration

### Issue: Coverage thresholds failing
**Solution:** This is expected initially. Run `npm run test:coverage` to see current coverage %.
Lower thresholds in `vitest.config.ts` if needed:
```typescript
thresholds: {
  lines: 10,  // Lower to current level
  functions: 10,
  branches: 10,
  statements: 10
}
```

---

## Next Steps

1. Install dependencies: `npm install`
2. Run tests: `npm run test`
3. Check coverage: `npm run test:coverage`
4. Open coverage report: `open coverage/index.html` (macOS) or `start coverage/index.html` (Windows)
5. Start writing tests (see test-coverage-improvement-plan.md)

---

## Cost of Dependencies

**Total size:** ~200MB (including Playwright browsers)
**Install time:** ~2-3 minutes on average connection
**Impact on build:** None (devDependencies only)

All dependencies are devDependencies and won't affect production bundle size or runtime.
