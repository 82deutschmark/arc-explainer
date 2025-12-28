# Comprehensive Plan: Save All Generated Code Attempts to Database

**Date**: 2025-11-29
**Status**: Architecture + Implementation Plan
**Scope**: Full code attempt archival for Poetiq solver

---

## 1. OBJECTIVE

Save ALL code generated during Poetiq solving to the database—not just the final "best code". Enable researchers to analyze solution evolution, expert contributions, failure patterns, and feedback-driven improvements across iterations.

Current state: Only `generatedCode` (final best) is saved to `providerRawResponse.generatedCode`
Target state: Full `attempts` array with metadata, per-iteration code, training results, and cost/token breakdown

---

## 2. WHAT TO SAVE: Data Specification

### Per-Attempt Data
Each code generation attempt captures:
- **Code**: The actual generated Python transform() function
- **Metadata**: Expert ID, iteration number, timestamp, generation duration
- **Training Results**: Pass/fail counts, accuracy scores, execution errors
- **Token Usage**: Input/output tokens consumed for this attempt
- **Cost**: Estimated cost for this attempt
- **Model Info**: Model name, temperature, provider used
- **Feedback**: The explicit feedback sent to next iteration (if any)
- **Status**: "generated" | "tested" | "accepted" | "rejected"

### Aggregated Data (Summary)
- Best attempt ID (pointer to top performer)
- Total attempts generated
- Success rate across attempts
- Total tokens/cost for entire solve
- Per-expert contribution counts and costs

---

## 3. PROPOSED JSON STRUCTURE

### Updated providerRawResponse Schema

```typescript
// In server/services/poetiq/poetiqService.ts
// Update PoetiqExplanationData.providerRawResponse interface

providerRawResponse: {
  solver: "poetiq";
  iterationCount: number;

  // === NEW: Comprehensive attempts array ===
  attempts: Array<{
    // Identity & Ordering
    id: string;  // e.g., "expert_0_iter_3"
    expertId: number;  // Which expert (0-7)
    iterationNumber: number;  // Iteration number (1-10)
    timestamp: string;  // ISO 8601 when code was generated

    // The Code Itself
    code: string;  // Full Python transform() function
    codeLength: number;  // Characters (for analysis)
    language: "python";  // For future support of other languages

    // Training Validation
    trainingResults: {
      succeeded: boolean;  // Did code compile & run?
      score: number;  // 0.0-1.0 accuracy on training set
      passed: number;  // Training examples that passed
      total: number;  // Total training examples
      errors: string[];  // Any compilation/execution errors
      executionTimeMs?: number;  // Time to validate this code
    };

    // Feedback & Evolution
    feedback?: string;  // Explicit feedback for next iteration
    wasSelectedForRefinement: boolean;  // Did this get feedback?

    // Resource Usage
    tokens: {
      input: number;  // Tokens sent to LLM
      output: number;  // Tokens generated
      total: number;  // Sum
    };
    cost: {
      input: number;  // USD for input tokens
      output: number;  // USD for output tokens
      total: number;  // Total cost in USD
    };

    // Model Configuration
    model: string;  // Model ID used
    temperature: number;  // Sampling temperature
    provider: "openai" | "anthropic" | "gemini" | "openrouter";

    // Optional: Full LLM interaction (MVP doesn't need this)
    llmPrompt?: {
      system?: string;  // System prompt used
      user?: string;  // User prompt used
      reasoning?: string;  // Reasoning (for o1/gpt-5 models)
    };
    llmResponse?: {
      text?: string;  // Full response
      tokens?: number;  // Total tokens
    };

    // Metadata for debugging
    metadata?: {
      inMemoryIndex?: number;  // Position in Python solutions array
      expert?: number;  // Duplicate of expertId for clarity
      phase?: "generation" | "testing" | "selection";  // What phase produced this
    };
  }>;

  // === ENHANCED: Existing fields ===
  generatedCode: string | null;  // Still store best code for backward compat
  bestAttemptId?: string;  // Pointer to top performer
  bestScore?: number;  // Score of best attempt

  // === SUMMARY METRICS ===
  summary: {
    totalAttempts: number;  // Total code attempts
    successfulAttempts: number;  // How many compiled & ran
    successRate: number;  // Percent that compiled
    averageScore: number;  // Mean accuracy on training
    bestScore: number;  // Highest accuracy
    worstScore: number;  // Lowest accuracy

    tokens: {
      input: number;  // Total across all attempts
      output: number;  // Total across all attempts
      total: number;
    };
    cost: {
      total: number;  // Total USD spent
      perAttempt: number;  // Average cost per attempt
    };

    // Expert contributions
    expertContribution: Record<number, {
      attemptCount: number;
      successCount: number;
      totalTokens: number;
      totalCost: number;
      bestAttemptId?: string;
      bestScore?: number;
    }>;

    // Timeline
    startTime: string;  // When solver started
    endTime: string;  // When solver completed
    durationMs: number;  // Total elapsed time
  };

  // === EXISTING FIELDS (unchanged) ===
  config: any;  // Model config used
  validation?: {
    single?: ValidationResult;
    multi?: MultiValidationResult;
  };
  iterations: PoetiqIterationData[];  // Keep for backward compat
}
```

---

## 4. COLLECTION POINTS & FLOW

### Flow Diagram
```
Python Solver                Node Service                Database
===============            ============               ========

Generate code 1  ---→  Event: progress             Store in
  ↓ train 1           code, iteration,            memory
  ↓ feedback          trainScore, tokens,   ---→  Accumulate
                      cost, expert, model
Generate code 2  ---→  Event: progress
  ↓ train 2
  ↓ feedback          ...

Final result     ---→  Event: final
  iterations []       (all attempts)  ---→  Transform
  best code                           ---→  Store to
  metadata                                 providerRawResponse
                                           as JSON
```

### Collection Points

#### 1. **Python Wrapper** (`server/python/poetiq_wrapper.py`)
**Current State**:
- Maintains `solutions` list in memory
- Emits progress events with `code`, `trainResults`, etc.
- Only final best code extracted for "final" event

**Changes Needed** (Minimal):
- Ensure progress events include:
  - `expertId` (which expert generated this)
  - `iterationNumber` (which iteration)
  - `code` (the generated code)
  - `trainResults` (training validation output)
  - `tokens` (usage for this generation)
  - `cost` (estimated cost)
- Add metadata to final event:
  - `allAttempts: [{code, iteration, expert, trainResults, tokens}]`
  - Timestamp for each
  - Phase (generation | testing | selection)

**Rationale**: Python solver already has all this data. Just ensure it stays in the event stream.

#### 2. **Node Service** (`server/services/poetiq/poetiqService.ts`)
**Current State**:
- Receives events from Python
- Extracts final result
- Transforms to `PoetiqExplanationData`
- Stores only `generatedCode`

**Changes Needed** (Medium):
- Update `transformToExplanationData()` to:
  1. Build `attempts` array from `result.iterations`
  2. Add expert ID, timestamp, token/cost breakdown
  3. Calculate summary metrics
  4. Pointer to best attempt
  5. Build complete `providerRawResponse` structure

**Code Changes**:
```typescript
// Existing: result.iterations has [{index, iteration, code, trainScore, trainResults}]
// Transform: Build attempts[] with full metadata

const attempts = result.iterations.map((iter, idx) => ({
  id: `expert_${iter.expertId || 0}_iter_${iter.iteration}`,
  expertId: iter.expertId || 0,
  iterationNumber: iter.iteration,
  timestamp: iter.timestamp || new Date().toISOString(),
  code: iter.code || null,
  codeLength: iter.code?.length || 0,
  language: "python",
  trainingResults: {
    succeeded: iter.trainResults.length > 0,
    score: iter.trainScore,
    passed: iter.trainResults.filter(r => r.success).length,
    total: iter.trainResults.length,
    errors: iter.trainResults.filter(r => r.error).map(r => r.error),
  },
  tokens: iter.tokens || { input: 0, output: 0, total: 0 },
  cost: iter.cost || { input: 0, output: 0, total: 0 },
  model: result.config?.model || 'unknown',
  temperature: result.config?.temperature || 0.7,
  provider: result.config?.provider || 'unknown',
  metadata: {
    inMemoryIndex: idx,
    expert: iter.expertId,
  },
}));

// Calculate summary metrics
const summary = {
  totalAttempts: attempts.length,
  successfulAttempts: attempts.filter(a => a.trainingResults.succeeded).length,
  successRate: attempts.filter(a => a.trainingResults.succeeded).length / attempts.length,
  averageScore: attempts.reduce((sum, a) => sum + a.trainingResults.score, 0) / attempts.length,
  bestScore: Math.max(...attempts.map(a => a.trainingResults.score), 0),
  // ... tokens, cost, expert contribution breakdown
};

return {
  ...existingData,
  providerRawResponse: {
    solver: 'poetiq',
    attempts,
    generatedCode: result.generatedCode || null,
    bestAttemptId: /* pointer to max score */,
    summary,
    config: result.config,
    // ...
  },
};
```

#### 3. **Database** (`explanations` table)
**Current State**:
- `provider_raw_response` JSONB column exists
- No schema changes needed

**Changes Needed** (None!):
- Just store the enriched JSON
- JSONB indexing already supported by PostgreSQL

**Optional Optimization** (Future):
- Add JSONB index on `provider_raw_response -> 'summary' -> 'bestScore'` for faster queries
- Add JSONB index on `provider_raw_response -> 'attempts'` for filtering
- But not needed for MVP

---

## 5. IMPLEMENTATION COMPLEXITY & EFFORT

| Component | Complexity | Files | Est. LOC |
|-----------|-----------|-------|---------|
| Python wrapper | Very Low | `server/python/poetiq_wrapper.py` | +5-10 |
| Node transformer | Low | `server/services/poetiq/poetiqService.ts` | +30-50 |
| TypeScript types | Very Low | `server/services/poetiq/poetiqService.ts` | +20-30 |
| Database | None | None | 0 |
| **Total** | **Low** | **1-2** | **~100** |

**No schema migrations needed.** The `provider_raw_response` JSONB column can hold any structure.

---

## 6. STORAGE CONSIDERATIONS

### Capacity Analysis
- **Max attempts per puzzle**: 8 experts × 10 iterations = 80 attempts (typical)
- **Code per attempt**: 200-2000 characters (avg ~800)
- **Metadata per attempt**: ~200 bytes
- **Total per puzzle**: (800 + 200) × 80 = ~80 KB per puzzle

### Scale
- **80,000 puzzles × 80 KB** = ~6.4 GB total
- JSONB is efficient; compression at rest handles the rest
- PostgreSQL JSONB queries are fast; no perf concerns for MVP

### Query Performance
- JSONB index on `summary.bestScore`: allows filtering by success
- JSONB index on `attempts[*].expertId`: allows expert analysis
- No separate table needed unless doing heavy historical analytics

---

## 7. QUERYABILITY & RESEARCH FEATURES

### What Researchers Can Query (Post-MVP)

```typescript
// Example PostgreSQL queries enabled by this structure

// Find all attempts for a puzzle
SELECT provider_raw_response -> 'attempts'
FROM explanations
WHERE puzzle_id = '12345abc';

// Filter by success rate
SELECT puzzle_id, provider_raw_response -> 'summary' -> 'successRate'
FROM explanations
WHERE (provider_raw_response -> 'summary' ->> 'successRate')::float > 0.8;

// Find best attempt per expert
SELECT
  puzzle_id,
  provider_raw_response -> 'summary' -> 'expertContribution'
FROM explanations
WHERE puzzle_id = '12345abc';

// Timeline reconstruction
SELECT
  provider_raw_response -> 'attempts'
  -> 0 ->> 'timestamp' as first_attempt,
  provider_raw_response -> 'summary' ->> 'durationMs' as total_ms
FROM explanations;

// Code diff across iterations (application layer)
const attempts = result.providerRawResponse.attempts;
const iteration1 = attempts.find(a => a.iterationNumber === 1);
const iteration2 = attempts.find(a => a.iterationNumber === 2);
// Client-side diff visualization
```

### Power User Features Unlocked

| Feature | Enabled By | Complexity |
|---------|-----------|-----------|
| View code evolution timeline | `attempts[].code` + `timestamp` | Low |
| Compare expert outputs | `attempts[].expertId` grouped | Low |
| Analyze feedback impact | `feedback` field + next iteration code | Medium |
| Training accuracy progression | `attempts[].trainingResults.score` | Low |
| Cost efficiency analysis | `tokens` + `cost` per attempt | Low |
| Failure mode analysis | `trainingResults.errors` | Medium |
| Replay solving process | All above + `phase` metadata | High |
| Model comparison | Filter by `model` field across puzzles | Medium |

---

## 8. MVP vs. COMPREHENSIVE

### MVP (Phase 1) – Save Immediately
**Minimum required to archive all code:**
- All code from all iterations
- Expert ID, iteration number
- Training results (pass/fail, score)
- Tokens and cost per attempt
- Timestamps
- Best attempt pointer
- Summary metrics

**Files**: `poetiqService.ts` only
**Time**: ~2-3 hours
**LOC**: ~100

### Comprehensive (Phase 2) – Nice-to-Have
- Full LLM prompts and responses (`llmPrompt`, `llmResponse`)
- Detailed feedback text per attempt
- Expert reasoning summaries
- Phase metadata (generation | testing | selection)
- Optional JSONB indexes for complex queries
- Analytics dashboard for researchers

**Files**: `poetiqService.ts` + optional new utility
**Time**: ~8-10 hours
**LOC**: ~300

**Recommendation**: Start with MVP. Add Phase 2 once researchers request specific features.

---

## 9. HISTORICAL COMPATIBILITY

### Old Data (Before This Change)
- Existing runs won't have `attempts` array
- `generatedCode` still populated
- No migration needed (JSONB is self-describing)

### New Data (After This Change)
- `attempts` array always populated
- `generatedCode` still set for backward compat
- Summary metrics included

### Handling in Queries
```typescript
// Safe accessor pattern
const attempts = providerRawResponse.attempts || [];
const bestScore = providerRawResponse.summary?.bestScore ??
                  providerRawResponse.bestTrainScore;
```

---

## 10. NAMING & ORGANIZATION

### Field Naming Principles
- **clarity**: Names explain what they contain
- **consistency**: Match existing patterns (e.g., `trainResults`, not `training_results`)
- **nesting**: Group related data (tokens, cost, metadata)
- **backward compat**: Keep `generatedCode`, `iterations` unchanged

### Example Field Walkthroughs

```typescript
// Each attempt tells a complete story:
{
  id: "expert_0_iter_3",  // "Which expert, which try"
  code: "def transform(x): ...",  // The artifact
  trainingResults: {
    score: 0.95,  // "How well did it work?"
    errors: ["IndexError: ..."]  // "Why did it fail?"
  },
  tokens: { total: 2048 },  // "What did it cost?"
  timestamp: "2025-11-29T14:32:10Z",  // "When?"
  feedback: "Use numpy.roll instead of loop",  // "How to improve?"
  wasSelectedForRefinement: true,  // "Did this matter?"
}

// Summary tells the arc:
{
  totalAttempts: 42,  // "How much work?"
  successRate: 0.88,  // "How reliable?"
  bestScore: 0.99,  // "How close to perfect?"
  cost: { total: 0.042 },  // "How expensive?"
  expertContribution: {
    0: { attemptCount: 5, bestScore: 0.99 }  // "Who was best?"
  }
}
```

---

## 11. VALIDATION CHECKLIST

After implementing, verify:

- [ ] `attempts` array populated for all new runs
- [ ] Each attempt has `code`, `trainingResults`, `tokens`, `cost`
- [ ] `bestAttemptId` points to highest `trainingResults.score`
- [ ] Summary metrics are accurate (count, rate, totals)
- [ ] Backward compat: `generatedCode` still set
- [ ] No schema migrations required
- [ ] Database stores entire JSON without truncation
- [ ] `timestamp` field ISO 8601 format for all attempts
- [ ] No sensitive data in code/feedback (no API keys, etc.)

---

## 12. RISKS & MITIGATIONS

| Risk | Mitigation |
|------|-----------|
| JSON too large (>1MB per puzzle) | Unlikely; max ~100KB. Monitor storage. |
| Backward compat broken | Keep `generatedCode`, `iterations` unchanged |
| Query performance degradation | JSONB queries fast; indexes optional for Phase 2 |
| Data inconsistency (missing fields) | Default all optional fields to null; validate in Node |
| Frontend doesn't expect `attempts` array | Assumes existing frontend only reads `generatedCode` |

---

## 13. DECISION SUMMARY

**What to Save**: All code + metadata from every iteration, indexed by expert & iteration number.

**Where**: Same `providerRawResponse` JSONB column (no migration).

**How**: Enhance Node transformer to build `attempts[]` + `summary` from existing `result.iterations`.

**When**: Immediately, zero database changes.

**Why**: Enable code evolution analysis, expert contribution tracking, cost breakdown, and future replay features without architectural changes.

**Who**: Agent implementing `poetiqService.ts` transformer.

---

