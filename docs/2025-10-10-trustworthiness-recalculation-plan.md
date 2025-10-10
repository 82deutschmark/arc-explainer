# Trustworthiness Score Recalculation Plan

**Author:** Cascade using Claude Sonnet 4.5  
**Date:** 2025-10-10T13:15:00-04:00  
**Context:** Yesterday's confidence normalization fix (commit 1cf3961) updated confidence scores but didn't recalculate trustworthiness_score

## Problem Statement

The `trustworthiness_score` field in the database was calculated using old, possibly incorrect confidence values. After yesterday's fix to normalize confidence decimals (handling cases where models return 0.85 meaning 85%, or 1 meaning 100%), we need to **revalidate and recalculate ALL trustworthiness scores** using:

1. The corrected/normalized confidence scores
2. The proper correctness determination (is_prediction_correct OR multi_test_all_correct)
3. Default confidence of 50 for null/undefined/empty values

## Critical Understanding: Confidence vs Trustworthiness

**CONFIDENCE** (what the model claims):
- Raw value from the AI model: "I'm 95% confident"
- Models are almost always confident (usually 80-100%)
- Being confident doesn't mean being right!
- Stored in: `confidence` field (0-100 integer)

**TRUSTWORTHINESS** (reliability metric combining confidence + correctness):
- Computed metric: How well does confidence predict actual performance?
- Rewards honest uncertainty, penalizes overconfidence
- The PRIMARY RESEARCH METRIC for this project
- Stored in: `trustworthiness_score` field (0.0-1.0 float)

## Current Trustworthiness Calculation

From `server/services/responseValidator.ts` lines 410-434:

```typescript
function calculateTrustworthinessScore(
  isCorrect: boolean, 
  confidence: number | null,
  hasConfidence: boolean = true
): number {
  // For external data without confidence, return pure correctness
  if (!hasConfidence || confidence === null) {
    return isCorrect ? 1.0 : 0.0;
  }
  
  // Normalize confidence to 0-1 range
  const normalizedConfidence = Math.max(0, Math.min(100, confidence)) / 100;
  
  if (isCorrect) {
    // Correct answers get higher scores (minimum 0.5)
    return Math.max(0.5, 0.5 + (normalizedConfidence * 0.5));
  } else {
    // Incorrect answers: reward low confidence, penalize high confidence
    return 1.0 - normalizedConfidence;
  }
}
```

**Key Logic:**
- **Correct + High Confidence**: Score 0.75 - 1.0 (good alignment)
- **Correct + Low Confidence**: Score 0.5 - 0.75 (still rewards correctness)
- **Incorrect + High Confidence**: Score 0.0 - 0.05 (heavily penalized overconfidence)
- **Incorrect + Low Confidence**: Score 0.5 - 1.0 (rewards honest uncertainty)
- **No Confidence Data**: Return pure correctness (0.0 or 1.0)

## Correctness Determination

From `shared/utils/correctness.ts` lines 56-84:

```typescript
const correctnessValue = result.multiTestAllCorrect ?? result.allPredictionsCorrect ?? result.isPredictionCorrect;

if (correctnessValue === true) {
  return { isCorrect: true, ... };
} else {
  // false, null, or undefined - all count as incorrect
  return { isCorrect: false, ... };
}
```

**Database Fields:**
- `is_prediction_correct` (boolean) - single-test correctness
- `multi_test_all_correct` (boolean) - multi-test all correct
- **Priority:** multi_test_all_correct first, then is_prediction_correct
- **Null/undefined/false = incorrect**

## Default Confidence Handling

From `server/utils/CommonUtilities.ts` lines 108-193:

The `normalizeConfidence()` function handles:
- Null/undefined → 50 (default)
- String "0.85" → 85
- String "85%" → 85
- Number 0.85 → 85
- Number 1 → 100
- Boolean true → 100, false → 0
- Empty string → 50

**User Requirement:** Any null/undefined/blank confidence = 50% default

## Recalculation Strategy

### Step 1: Identify All Entries Needing Recalculation

```sql
SELECT 
  id,
  puzzle_id,
  model_name,
  confidence,
  is_prediction_correct,
  multi_test_all_correct,
  trustworthiness_score
FROM explanations
WHERE 1=1  -- All entries need recalculation
ORDER BY id ASC;
```

**Expected Count:** ~50,000-100,000+ entries (entire database)

### Step 2: Recalculate Each Entry

For each row:

1. **Determine Correctness:**
   ```typescript
   const isCorrect = row.multi_test_all_correct ?? row.is_prediction_correct ?? false;
   ```

2. **Normalize Confidence:**
   ```typescript
   const confidence = normalizeConfidence(row.confidence); // Uses existing utility, defaults to 50
   ```

3. **Calculate Trustworthiness:**
   ```typescript
   const hasConfidence = row.confidence !== null && row.confidence !== undefined;
   const trustworthiness = calculateTrustworthinessScore(isCorrect, confidence, hasConfidence);
   ```

4. **Update Database:**
   ```sql
   UPDATE explanations 
   SET trustworthiness_score = $1 
   WHERE id = $2;
   ```

### Step 3: Batch Processing

Process in batches of 1000 to avoid memory issues and provide progress updates:

```typescript
const BATCH_SIZE = 1000;
let offset = 0;
let processedCount = 0;

while (true) {
  const batch = await fetchBatch(offset, BATCH_SIZE);
  if (batch.length === 0) break;
  
  for (const row of batch) {
    const newTrustworthiness = recalculateTrustworthiness(row);
    await updateRow(row.id, newTrustworthiness);
    processedCount++;
    
    if (processedCount % 100 === 0) {
      console.log(`Processed ${processedCount} entries...`);
    }
  }
  
  offset += BATCH_SIZE;
}
```

## Implementation Plan

### File: `scripts/recalculate-trustworthiness.ts`

**Purpose:** One-time migration script to recalculate all trustworthiness scores

**Key Features:**
1. Uses existing `normalizeConfidence()` from CommonUtilities
2. Uses existing correctness logic from correctness.ts
3. Implements trustworthiness calculation matching responseValidator.ts
4. Batch processing with progress reporting
5. Dry-run mode for validation
6. Error handling and logging
7. Summary report at completion

**Validation Checks:**
- Count entries before/after
- Verify no entries skipped
- Report distribution of trustworthiness scores
- Identify any anomalies (e.g., all zeros, all ones)

## Testing Strategy

1. **Dry Run First:**
   - Calculate new trustworthiness values
   - Compare to existing values
   - Report discrepancies
   - No database writes

2. **Small Batch Test:**
   - Run on first 100 entries
   - Manually verify random samples
   - Check for expected patterns

3. **Full Migration:**
   - Process all entries
   - Monitor for errors
   - Generate completion report

## Expected Outcomes

**Before Migration:**
- Trustworthiness scores calculated with potentially incorrect confidence values
- Entries with 0.85 confidence treated as 0.85% instead of 85%
- Entries with confidence=1 treated as 1% instead of 100%

**After Migration:**
- All trustworthiness scores recalculated with normalized confidence
- Correct application of trustworthiness formula
- Consistent treatment of null/missing confidence (default 50)
- More accurate trustworthiness leaderboards and analytics

## Risks & Mitigations

**Risk:** Breaking existing trustworthiness scores  
**Mitigation:** Dry-run mode first, manual verification of samples

**Risk:** Long execution time on large database  
**Mitigation:** Batch processing with progress reporting, can pause/resume

**Risk:** Database connection issues  
**Mitigation:** Transaction batching, automatic retry logic

**Risk:** Incorrect calculation implementation  
**Mitigation:** Unit tests against known examples, comparison with existing logic

## Post-Migration Verification

1. **Statistics Check:**
   ```sql
   SELECT 
     COUNT(*) as total_entries,
     AVG(trustworthiness_score) as avg_trustworthiness,
     MIN(trustworthiness_score) as min_trustworthiness,
     MAX(trustworthiness_score) as max_trustworthiness,
     COUNT(*) FILTER (WHERE trustworthiness_score IS NULL) as null_count
   FROM explanations;
   ```

2. **Model Rankings Check:**
   - Compare before/after leaderboards
   - Verify rankings make sense
   - Check for unexpected dramatic shifts

3. **Edge Cases:**
   - Verify entries with null confidence → 50% default
   - Verify correct handling of multi-test vs single-test
   - Verify external data (no confidence) → pure correctness

## Success Criteria

✅ All database entries have recalculated trustworthiness_score  
✅ Calculation matches responseValidator.ts logic exactly  
✅ Default confidence (50) applied to null/undefined values  
✅ Correctness determination matches correctness.ts logic  
✅ No entries skipped or lost  
✅ Trustworthiness statistics within expected ranges  
✅ Model leaderboards updated and make sense  

## Next Steps

1. ✅ Create this plan document
2. ⏳ Create migration script `scripts/recalculate-trustworthiness.ts`
3. ⏳ Run dry-run validation
4. ⏳ Execute migration on full database
5. ⏳ Verify results and update CHANGELOG.md
6. ⏳ Commit with detailed message

---

## Notes for AI Agent

**Ultrathink Requirements:**
- This is NOT about "fixing confidence" - that was yesterday
- This IS about recalculating a DERIVED metric (trustworthiness) using corrected inputs
- Trustworthiness combines TWO inputs: confidence + correctness
- The formula is counterintuitive: high confidence + wrong = LOW trustworthiness
- Must handle both single-test and multi-test entries correctly
- Must respect null/undefined confidence → default 50
- This affects ~100k+ database entries - must be efficient
- This is the PRIMARY METRIC for the entire research project
