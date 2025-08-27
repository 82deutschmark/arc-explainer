# Database Schema Mismatch Analysis

**Date**: 2025-08-27  
**Issue**: Repository code using non-existent database columns  
**Root Cause**: Sloppy implementation during service layer migration

## Executive Summary

During the recent service layer migration, the previous developer created repository classes that reference **non-existent database columns**. 

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

#
- Not making assumptions about column names without verification
- Treating the database as the authoritative source of truth

The previous developer made assumptions about column names without checking the actual database structure, leading to runtime failures in production.
