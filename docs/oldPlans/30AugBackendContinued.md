# Backend Repository Confusion Analysis & Fix Plan
**Date**: August 30, 2025  
**Priority**: HIGH - Critical Database Schema Understanding Issue  

## Critical Findings for Next Developer

### The Core Problem
The `FeedbackRepository.ts` was written by a developer who **did not understand the database schema**. The code contains:

1. **Misleading variable names** that confuse different metrics
2. **Mixed concepts** - pure accuracy vs trustworthiness treated as same thing
3. **Confusing method names** that don't reflect what they actually return
4. **Poor commenting** leaving future developers to guess what metrics mean

### Database Schema Reality (Source of Truth)

**Three distinct concepts that must not be confused:**

1. **Pure Accuracy** = `is_prediction_correct` (boolean)
   - Did the AI actually solve the puzzle correctly?
   - Simple percentage: correct predictions / total attempts in solver table (not feedback table or explanation table)

2. **Confidence** = `confidence` (integer 0-100)
   - How confident was the AI in its answer?
   - Self-reported by the AI model and stored in the DB! (not computed by us)

3. **Trustworthiness** = `prediction_accuracy_score` (double precision)
   - **THIS IS NOT ACCURACY!** Misleading name in DB schema
   - Computed metric combining confidence AND correctness
   - Used to measure reliability of AI confidence claims 
   - This project is all about measuring trustworthiness of AI confidence claims, accuracy is only secondary because most models cannot solve puzzles correctly, yet will almost always claim very high confidence.
   - Trustworthiness is the unique metric we are interested in.
   - We need to audit this score in the validation process to ensure it is computed correctly.

### Current Repository Problems

**Method: `getAccuracyStats()`**
- **Claims to return**: Accuracy statistics
- **Actually returns**: Mix of accuracy and trustworthiness data
- **Variable `accuracyByModel`**: Actually contains trustworthiness scores
- **Problem**: Next developer thinks they're getting accuracy, gets trustworthiness

**Method: `getRealPerformanceStats()`**
- **Contains**: `trustworthinessLeaders` array
- **Uses**: `prediction_accuracy_score` (correct)
- **Problem**: Other parts of codebase call this "accuracy"

**Root Issue**: The repository conflates three separate concepts without clear distinction.

## Critical Knowledge for Next Developer

### 1. Database Column Understanding
```sql
-- PURE ACCURACY (puzzle solving success rate)
is_prediction_correct  -- boolean: did they solve it?

-- CONFIDENCE (self-reported certainty)
confidence  -- integer: how sure were they?

-- TRUSTWORTHINESS (reliability of confidence)
prediction_accuracy_score  -- double: are their confidence claims accurate?
```

### 2. What Each Metric Should Measure
- **Model Accuracy Rankings**: Use `is_prediction_correct` counts
- **Model Trustworthiness Rankings**: Use `prediction_accuracy_score` averages  
- **Confidence Analysis**: Average `confidence` on entries where `is_prediction_correct` false  compared to average `confidence` on entries where `is_prediction_correct` true

### 3. Current Code Issues
- `accuracyByModel` returns trustworthiness data (not accuracy)
- Method names don't match return data
- No clear comments explaining metric differences
- Future developers will misinterpret what data they're getting

## Fix Plan Tasks
Comment all your changes very thoroughly. Commit after each file change.
### Task 1: Clarify Method Names and Return Values
**File**: `server/repositories/FeedbackRepository.ts`

**Actions**:
- Rename `getAccuracyStats()` to clearly indicate it returns mixed data
- Separate pure accuracy from trustworthiness in return objects
- Fix misleading variable names like `accuracyByModel`


### Task 2: Create Separate Methods for Each Metric Type
**File**: `server/repositories/FeedbackRepository.ts`

**Actions**:
- `getPureAccuracyStats()` - only `is_prediction_correct` based metrics
- `getTrustworthinessStats()` - only `prediction_accuracy_score` based metrics  
- `getConfidenceStats()` - only `confidence` field analysis
- Keep existing methods for backward compatibility but mark deprecated

### Task 3: Update Type Definitions
**File**: `shared/types.ts`

**Actions**:
- Create separate interfaces for accuracy vs trustworthiness data
- Add clear naming: `AccuracyStats`, `TrustworthinessStats`, `ConfidenceStats`
- Update existing interfaces to be explicit about data content

### Task 4: Add Comprehensive Comments
**File**: `server/repositories/FeedbackRepository.ts`

**Actions**:
- Add header comments explaining the three metric types
- Comment each SQL query explaining what it measures
- Comment return objects explaining data meaning
- Add warnings about common confusion points

### Task 5: Fix Frontend Usage
**Files**: Components consuming repository data

**Actions**:
- Audit frontend components using accuracy stats
- Verify they're interpreting data correctly (accuracy vs trustworthiness)
- Update variable names and display labels to match actual data
- Update any comments or documentation about accuracy metrics to be correct
- 

### Task 6: Update API Endpoint Documentation
**Files**: Route handlers and documentation

**Actions**:
- Clarify what each endpoint actually returns
- Update endpoint names if needed for clarity
- Ensure frontend knows whether it's getting accuracy or trustworthiness

## Implementation Strategy

### Phase 1: Repository Layer Cleanup
- Add comprehensive comments to existing methods
- Create new clearly-named methods
- Maintain backward compatibility

### Phase 2: Type System Updates  
- Create explicit type interfaces
- Update method signatures
- Ensure type safety

### Phase 3: Frontend Integration
- Audit frontend usage of repository data
- Update display logic and labels
- Verify correct interpretation of metrics

## Success Criteria

- [ ] Next developer can clearly understand difference between accuracy/trustworthiness
- [ ] Method names accurately reflect return data
- [ ] Frontend displays correct metric labels  
- [ ] No confusion about what data represents
- [ ] Comprehensive comments prevent future misunderstanding

## Warning for Future Development

**Do not assume variable names are accurate.** The database schema uses misleading names like `prediction_accuracy_score` for trustworthiness data. Always verify what data actually represents before using it.

---
**Critical Message**: This repository was written without understanding the database schema. The fix requires separating three distinct concepts that were wrongly conflated. Take time to understand the metrics before making changes.