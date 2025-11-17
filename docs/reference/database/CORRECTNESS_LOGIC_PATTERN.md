# Correctness Logic Pattern Guide

## Overview

ARC Explainer has **two parallel correctness tracking systems** for puzzle predictions:

1. **Single Test Predictions**: `is_prediction_correct` (boolean)
2. **Multi-Test Predictions**: `multi_test_all_correct` (boolean)

The `has_multiple_predictions` flag determines which system to use for a given explanation.

## The Problem

Using simple OR logic like `is_prediction_correct = true OR multi_test_all_correct = true` causes bugs when aggregating data because:

1. **NULL Handling**: When `has_multiple_predictions = false`, `multi_test_all_correct` is typically NULL
2. **SQL Semantics**: `NULL = false` evaluates to FALSE (not TRUE), so OR logic can incorrectly classify predictions
3. **Cross-Contamination**: Single-test and multi-test predictions get mixed together, skewing statistics

## The Solution

### ✅ CORRECT Pattern for Aggregation Queries

For **COUNT**, **SUM**, **AVG** operations:

```sql
-- Using COUNT with CASE
COUNT(CASE
  WHEN (COALESCE(has_multiple_predictions, false) = false AND COALESCE(is_prediction_correct, false) = true)
    OR (COALESCE(has_multiple_predictions, false) = true AND COALESCE(multi_test_all_correct, false) = true)
  THEN 1
END)

-- Using COUNT with FILTER (preferred when JOINs are present)
COUNT(DISTINCT e.id) FILTER (
  WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = true)
    OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = true)
)

-- Using SUM
SUM(CASE
  WHEN (COALESCE(has_multiple_predictions, false) = false AND COALESCE(is_prediction_correct, false) = true)
    OR (COALESCE(has_multiple_predictions, false) = true AND COALESCE(multi_test_all_correct, false) = true)
  THEN 1
  ELSE 0
END)

-- Using AVG for confidence
AVG(CASE
  WHEN (COALESCE(has_multiple_predictions, false) = false AND COALESCE(is_prediction_correct, false) = true)
    OR (COALESCE(has_multiple_predictions, false) = true AND COALESCE(multi_test_all_correct, false) = true)
  THEN confidence
END)
```

### ✅ ACCEPTABLE Pattern for Boolean Filtering

For **WHERE**, **HAVING**, **EXISTS** clauses (no aggregation):

```sql
-- This is acceptable because we're just filtering, not aggregating
WHERE is_prediction_correct = true OR multi_test_all_correct = true

-- Or equivalently
WHERE NOT (is_prediction_correct = false AND multi_test_all_correct = false)
```

**Why this works**: Boolean filters don't need to distinguish between prediction types because they're just including/excluding rows, not counting or averaging them.

### ❌ WRONG Pattern (Causes Bugs)

```sql
-- WRONG: Simple OR in aggregation
COUNT(CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 END)

-- WRONG: Simple AND in aggregation
COUNT(CASE WHEN is_prediction_correct = false OR multi_test_all_correct = false THEN 1 END)

-- WRONG: Missing DISTINCT when JOINs duplicate rows
COUNT(CASE ...) -- when LEFT JOIN feedback creates multiple rows per explanation
```

## When to Use DISTINCT

**Always use COUNT(DISTINCT e.id)** when:

1. Your query contains **any JOIN** (especially LEFT JOIN with feedback, rebuttals, etc.)
2. The JOIN could create duplicate rows for a single explanation
3. You're counting explanations (not counting total rows)

**Example**:

```sql
-- WRONG: JOIN duplicates rows, COUNT inflates
SELECT
  puzzle_id,
  COUNT(CASE WHEN ... THEN 1 END) as wrong_count  -- Will count duplicates!
FROM explanations e
LEFT JOIN feedback f ON e.id = f.explanation_id  -- Creates multiple rows if multiple feedback entries
GROUP BY puzzle_id

-- CORRECT: DISTINCT prevents duplication
SELECT
  puzzle_id,
  COUNT(DISTINCT e.id) FILTER (WHERE ...) as wrong_count  -- Counts unique explanations only
FROM explanations e
LEFT JOIN feedback f ON e.id = f.explanation_id
GROUP BY puzzle_id
```

## Database Schema Reference

| Field | Type | Purpose |
|-------|------|---------|
| `has_multiple_predictions` | BOOLEAN | Flag indicating which prediction type (false/NULL = single, true = multi) |
| `is_prediction_correct` | BOOLEAN | Correctness for **single test** predictions |
| `multi_test_all_correct` | BOOLEAN | Correctness for **multi-test** predictions (ALL tests must pass) |
| `predicted_output_grid` | JSONB | Single test prediction data |
| `multi_test_prediction_grids` | JSONB | Multiple test predictions data |

## Logic Flow

```
1. Check has_multiple_predictions
   ├─ FALSE or NULL → Use is_prediction_correct
   └─ TRUE → Use multi_test_all_correct

2. Apply COALESCE for NULL safety
   ├─ COALESCE(has_multiple_predictions, false)
   ├─ COALESCE(is_prediction_correct, false)
   └─ COALESCE(multi_test_all_correct, false)

3. Combine with OR logic
   └─ (single-test condition) OR (multi-test condition)
```

## Reference Implementation

The **gold standard** implementation is in:

**File**: `server/repositories/ExplanationRepository.ts`
**Method**: `getExplanationSummariesForPuzzle()`
**Lines**: 246-268

```typescript
const countsResult = await this.query(`
  SELECT
    COUNT(*)::int AS "all",
    COUNT(
      CASE
        WHEN (COALESCE(has_multiple_predictions, false) = false AND COALESCE(is_prediction_correct, false) = true)
          OR (COALESCE(has_multiple_predictions, false) = true AND COALESCE(multi_test_all_correct, false) = true)
        THEN 1
      END
    )::int AS "correct",
    COUNT(
      CASE
        WHEN (COALESCE(has_multiple_predictions, false) = false AND COALESCE(is_prediction_correct, false) = false)
          OR (COALESCE(has_multiple_predictions, false) = true AND COALESCE(multi_test_all_correct, false) = false)
        THEN 1
      END
    )::int AS "incorrect"
  FROM explanations
  WHERE puzzle_id = $1
`, [puzzleId]);
```

This is used by **PuzzleExaminer** and is known to be correct.

## Utility Functions

For consistency, use the shared utility functions in `MetricsQueryBuilder.ts`:

```typescript
import { MetricsQueryBuilder } from '../repositories/utils/MetricsQueryBuilder';

// For CASE-based correctness (returns 1 or 0)
const correctnessSQL = MetricsQueryBuilder.correctnessCalculation('e');
// Usage: SUM(${correctnessSQL})

// For confidence when correct
const confidenceSQL = MetricsQueryBuilder.confidenceStats('e');
// Usage: ${confidenceSQL}
```

These utilities were **fixed in v5.10.13** and now use the correct conditional logic.

## Examples

### Example 1: Counting Correct Predictions

```sql
-- Count how many predictions were correct per model
SELECT
  model_name,
  COUNT(DISTINCT e.id) FILTER (
    WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = true)
      OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = true)
  ) as correct_count
FROM explanations e
GROUP BY model_name
```

### Example 2: Accuracy Percentage

```sql
-- Calculate accuracy percentage per model
SELECT
  model_name,
  CASE
    WHEN COUNT(e.id) > 0
    THEN (SUM(CASE
      WHEN (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = true)
        OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = true)
      THEN 1
      ELSE 0
    END) * 100.0 / COUNT(e.id))
    ELSE 0
  END as accuracy_percentage
FROM explanations e
WHERE predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL
GROUP BY model_name
```

### Example 3: Average Confidence When Correct

```sql
-- Average confidence for correct predictions only
SELECT
  model_name,
  AVG(CASE
    WHEN (COALESCE(has_multiple_predictions, false) = false AND COALESCE(is_prediction_correct, false) = true)
      OR (COALESCE(has_multiple_predictions, false) = true AND COALESCE(multi_test_all_correct, false) = true)
    THEN confidence
  END) as avg_confidence_when_correct
FROM explanations
WHERE confidence IS NOT NULL
GROUP BY model_name
```

### Example 4: With JOINs (DISTINCT Required)

```sql
-- When JOINs are present, use DISTINCT
SELECT
  e.puzzle_id,
  COUNT(DISTINCT e.id) FILTER (
    WHERE (COALESCE(e.has_multiple_predictions, false) = false AND COALESCE(e.is_prediction_correct, false) = false)
      OR (COALESCE(e.has_multiple_predictions, false) = true AND COALESCE(e.multi_test_all_correct, false) = false)
  ) as wrong_count,
  COUNT(DISTINCT e.id) as total_explanations,
  COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') as negative_feedback
FROM explanations e
LEFT JOIN feedback f ON e.id = f.explanation_id
GROUP BY e.puzzle_id
```

## Impact of v5.10.13 Fixes

The following files were fixed to use correct conditional logic:

| File | Methods Fixed | Impact |
|------|---------------|--------|
| `AccuracyRepository.ts` | `getModelsWithHighConfidenceWrongPredictions()`, `getOverconfidentModels()` | Analytics badges now show accurate counts |
| `TrustworthinessRepository.ts` | `getConfidenceAnalysis()` | Confidence calibration stats are now correct |
| `ModelDatasetRepository.ts` | `getModelDatasetPerformance()`, `getModelDatasetMetrics()` | Model Browser dataset cards show accurate metrics |
| `MetricsQueryBuilder.ts` | `correctnessCalculation()`, `confidenceStats()` | All consumers of these utilities now use correct logic |
| `ExplanationRepository.ts` | `getWorstPerformingPuzzles()` | Trading cards show accurate win/loss records |

## Quick Reference Checklist

When writing queries involving correctness:

- [ ] Am I aggregating data (COUNT, SUM, AVG)? → Use conditional logic
- [ ] Does my query have JOINs? → Use COUNT(DISTINCT ...)
- [ ] Am I just filtering (WHERE, HAVING)? → Simple OR is acceptable
- [ ] Have I used COALESCE for NULL safety? → Always use it
- [ ] Does my logic check `has_multiple_predictions` first? → Required for aggregation
- [ ] Can I use `MetricsQueryBuilder` utilities instead? → Prefer shared utilities

## Testing Your Query

To verify your query is correct:

```sql
-- Test query: Count should match PuzzleExaminer for a known puzzle
SELECT
  COUNT(*) as total,
  -- Your aggregation logic here
FROM explanations
WHERE puzzle_id = '00d62c1b'  -- Known test case
```

Compare results with PuzzleExaminer page for the same puzzle. They should match exactly.

## Related Documentation

- `CHANGELOG.md` - v5.10.13 for detailed fix explanation
- `server/repositories/ExplanationRepository.ts:246-268` - Reference implementation
- `server/repositories/utils/MetricsQueryBuilder.ts` - Shared utility functions
- `server/repositories/AccuracyRepository.ts` - Example usage in production code

---

**Last Updated**: 2025-11-16 (v5.10.13)
**Author**: Claude Code using Sonnet 4.5
**Purpose**: Prevent correctness logic bugs by providing clear patterns and examples
