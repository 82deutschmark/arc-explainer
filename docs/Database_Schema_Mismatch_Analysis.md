# Database Schema Mismatch Analysis

**Date**: 2025-08-27  
**Issue**: Repository code using non-existent database columns  
**Root Cause**: Sloppy implementation during service layer migration

## Executive Summary

During the recent service layer migration, the previous developer created repository classes that reference **non-existent database columns**. This caused runtime database errors like:
```
column "all_predictions_correct" of relation "explanations" does not exist
```

## Actual Database Schema (Source of Truth)

Based on `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'explanations'`:

### ✅ REAL Database Columns:
```sql
id - integer (PRIMARY KEY)
puzzle_id - character varying(255)
pattern_description - text
solving_strategy - text  
hints - text[]
confidence - integer
alien_meaning_confidence - integer
alien_meaning - text
model_name - character varying(100)
reasoning_log - text
has_reasoning_log - boolean
provider_response_id - text
api_processing_time_ms - integer
saturn_images - jsonb
saturn_log - jsonb
saturn_events - jsonb
saturn_success - boolean
predicted_output_grid - jsonb
is_prediction_correct - boolean
prediction_accuracy_score - double precision
provider_raw_response - jsonb
reasoning_items - jsonb
temperature - double precision
reasoning_effort - text
reasoning_verbosity - text
reasoning_summary_type - text
input_tokens - integer
output_tokens - integer
reasoning_tokens - integer
total_tokens - integer
estimated_cost - numeric
multiple_predicted_outputs - jsonb
multi_test_results - jsonb
multi_test_all_correct - boolean
multi_test_average_accuracy - double precision
has_multiple_predictions - boolean
multi_test_prediction_grids - jsonb
created_at - timestamp with time zone
```

## ❌ HALLUCINATED Columns (DO NOT EXIST)

The following columns were **invented** by the previous developer and **DO NOT EXIST** in the database:

| Hallucinated Column | Correct Alternative | Status |
|-------------------|-------------------|--------|
| `all_predictions_correct` | `multi_test_all_correct` | ✅ Fixed |
| `average_prediction_accuracy_score` | `multi_test_average_accuracy` | ✅ Fixed |
| `extraction_method` | **No equivalent** | ✅ Removed |

## Files Already Fixed

### ✅ ExplanationRepository.ts
- **Fixed INSERT statement**: Removed non-existent columns, corrected parameter count
- **Fixed SELECT statements**: Removed references to hallucinated columns in all queries
- **Committed**: Database operations now match actual schema

## Files That Need Auditing

Search the entire codebase for references to these hallucinated columns:

### 🔍 Search Commands
```bash
# Search for hallucinated column names
grep -r "all_predictions_correct" server/
grep -r "average_prediction_accuracy_score" server/
grep -r "extraction_method" server/

# Search in TypeScript interface definitions
grep -r "allPredictionsCorrect" server/ shared/
grep -r "averagePredictionAccuracyScore" server/ shared/
grep -r "extractionMethod" server/ shared/
```

### 🎯 Priority Files to Check
1. **TypeScript Type Definitions**
   - `shared/types.ts` - Interface definitions
   - `server/repositories/interfaces/` - Repository interfaces
   
2. **Other Repository Classes**
   - `server/repositories/FeedbackRepository.ts`
   - `server/repositories/BatchAnalysisRepository.ts`
   - Check for similar schema mismatches

3. **Service Layer Files**
   - `server/services/explanationService.ts`
   - `server/services/batchAnalysisService.ts`
   - Any services that pass data to repositories

4. **Controller Files**
   - `server/controllers/explanationController.ts`
   - `server/controllers/batchAnalysisController.ts`

## Error Pattern Recognition

### Original Error Message
```
Error in explanationController.create for puzzle 6ffbe589: 
error: column "all_predictions_correct" of relation "explanations" does not exist
```

### Fix Applied
```typescript
// BEFORE (WRONG)
INSERT INTO explanations (..., all_predictions_correct, average_prediction_accuracy_score, extraction_method)

// AFTER (CORRECT) 
INSERT INTO explanations (..., multi_test_all_correct, multi_test_average_accuracy, has_multiple_predictions)
```

## Validation Checklist

- [ ] Search entire codebase for hallucinated column references
- [ ] Fix all TypeScript interfaces that reference non-existent columns  
- [ ] Update any services that map to these columns
- [ ] Check other repository classes for similar issues
- [ ] Verify no runtime database errors after fixes
- [ ] Update any documentation that references incorrect column names

## Prevention Measures

1. **Always check actual database schema** before writing repository code
2. **Use database introspection tools** to verify column existence
3. **Test database operations** before committing repository changes
4. **Database is the source of truth** - never assume column names

## Notes

This issue highlights the importance of:
- Validating against actual database schema during migration
- Testing database operations before deployment  
- Not making assumptions about column names without verification
- Treating the database as the authoritative source of truth

The previous developer made assumptions about column names without checking the actual database structure, leading to runtime failures in production.
