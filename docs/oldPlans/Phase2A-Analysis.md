# Phase 2A Analysis - Repository Refactoring

## **Analysis Overview**

This document provides a comprehensive analysis of the current repository architecture, identifying Single Responsibility Principle violations, duplicate code patterns, and opportunities for refactoring.

**Date**: September 11, 2025  
**Status**: Phase 2A Complete - Analysis Phase  
**Next**: Phase 2B - Implementation

---

## **Current Repository Architecture Issues**

### **1. MetricsRepository SRP Violations**

**Current Responsibilities** (violates SRP):
- ✗ Data aggregation from multiple repositories  
- ✗ Business logic calculations (cost efficiency, danger levels)
- ✗ Complex SQL query construction
- ✗ Data transformation and formatting
- ✗ Infrastructure metrics (API timing, tokens, costs)

**Should Only Be Responsible For**:
- ✓ Coordinating data from specialized repositories
- ✓ Simple data transformation for dashboard format

#### **Methods Analysis:**

1. **`getGeneralModelStats()`** - **SRP VIOLATION**
   - **Problem**: Mixes trustworthiness data with accuracy data in same method
   - **Lines**: Complex 80-line method with embedded business logic
   - **Fix**: Delegate to specialized repositories, only aggregate results

2. **`getRawDatabaseStats()`** - **ACCEPTABLE** 
   - **Problem**: None - focuses only on infrastructure metrics
   - **Fix**: Minor cleanup of magic numbers

3. **`getComprehensiveDashboard()`** - **GOOD PATTERN**
   - **Problem**: Correctly delegates to specialized repositories
   - **Fix**: Use as template for other methods

4. **`generateModelComparisons()`** - **MAJOR SRP VIOLATION**
   - **Problem**: 75-line method with complex CTE, business calculations
   - **Fix**: Break into smaller focused methods, use query builder

5. **`getModelReliabilityStats()`** - **ACCEPTABLE**
   - **Problem**: Simple focused responsibility
   - **Fix**: Minor cleanup only

---

## **2. Duplicate SQL Patterns Analysis**

### **Pattern 1: Model Filtering**
**Duplicated 13 times across repositories:**
```sql
WHERE e.model_name IS NOT NULL
```
**Files**: MetricsRepository.ts, AccuracyRepository.ts, TrustworthinessRepository.ts, FeedbackRepository.ts

### **Pattern 2: Solver Attempt Detection**
**Duplicated 11 times across repositories:**
```sql
(predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
```
**Files**: AccuracyRepository.ts (5x), MetricsRepository.ts (5x), TrustworthinessRepository.ts (2x)

### **Pattern 3: Correctness Calculation**  
**Duplicated 15 times across repositories:**
```sql
CASE WHEN is_prediction_correct = true OR multi_test_all_correct = true THEN 1 ELSE 0 END
```
**Files**: AccuracyRepository.ts (10x), MetricsRepository.ts (4x), TrustworthinessRepository.ts (2x)

### **Pattern 4: Confidence Analysis**
**Duplicated 6 times across repositories:**
```sql
AVG(CASE WHEN (is_prediction_correct = true OR multi_test_all_correct = true) THEN confidence END)
```
**Files**: TrustworthinessRepository.ts (4x), MetricsRepository.ts (2x)

### **Pattern 5: Trustworthiness Filtering**
**Duplicated 8 times across repositories:**
```sql
WHERE trustworthiness_score IS NOT NULL
  AND NOT (trustworthiness_score = 1.0 AND confidence = 0)
```
**Files**: TrustworthinessRepository.ts (6x), MetricsRepository.ts (2x)

---

## **3. Complex Query Analysis**

### **`generateModelComparisons()` CTE Issues:**

**Current Structure** (lines 430-501):
```sql
WITH model_accuracy AS (
  -- 15 lines of complex aggregation logic
),
model_feedback AS (
  -- 10 lines of feedback logic  
)
SELECT 
  -- 25 lines of CASE statements with hardcoded values
  CASE 
    WHEN ma.avg_cost IS NULL OR ma.avg_cost = 0 THEN 0
    WHEN ma.avg_trustworthiness IS NULL OR ma.avg_trustworthiness <= 0.001 THEN 999
    WHEN ma.avg_cost / ma.avg_trustworthiness > 999 THEN 999
    ELSE ma.avg_cost / ma.avg_trustworthiness
  END as cost_efficiency
```

**Problems**:
- Magic numbers: 999, 0.001, 100  
- Complex nested CASE statements
- Business logic mixed with data retrieval
- No error handling for division by zero edge cases

---

## **4. Repository Dependency Analysis**

### **Current Dependencies:**
```
MetricsRepository
├── AccuracyRepository.getPureAccuracyStats()         ✓ Good delegation
├── TrustworthinessRepository.getTrustworthinessStats() ✓ Good delegation  
├── FeedbackRepository.getFeedbackSummaryStats()      ✓ Good delegation
└── Direct database queries                            ✗ SRP violation
```

### **External API Dependencies:**
- `/api/metrics/comprehensive-dashboard` → `getComprehensiveDashboard()`
- `/api/metrics/reliability` → `getModelReliabilityStats()`
- Frontend: `useModelComparisons.ts` hook
- Frontend: `ModelComparisonMatrix.tsx` component

**Critical**: API contracts must remain identical after refactoring

---

## **Phase 2B Implementation Plan**

### **Task 1: Create MetricsQueryBuilder Utility**

**File**: `server/repositories/utils/MetricsQueryBuilder.ts`

**Reusable Query Fragments Needed:**
```typescript
class MetricsQueryBuilder {
  // Common WHERE clauses
  static modelFilter(): string
  static solverAttemptFilter(): string  
  static trustworthinessFilter(): string
  static confidenceFilter(): string
  
  // Common SELECT fragments
  static correctnessCalculation(): string
  static accuracyPercentage(): string
  static solverAttemptCount(): string
  static trustworthinessStats(): string
  static confidenceStats(): string
  
  // Common aggregations
  static modelGroupBy(): string
  static basicModelStats(): string
  static performanceStats(): string
}
```

### **Task 2: Refactor MetricsRepository Methods**

#### **2A: Fix `getGeneralModelStats()` SRP Violation**
**Before** (80 lines): Mixed data + calculations
**After** (15 lines): Pure aggregation pattern
```typescript
async getGeneralModelStats(): Promise<GeneralModelStats> {
  const [accuracyStats, trustworthinessStats] = await Promise.all([
    this.accuracyRepo.getBasicStats(),
    this.trustworthinessRepo.getBasicStats()
  ]);
  return this.combineGeneralStats(accuracyStats, trustworthinessStats);
}
```

#### **2B: Refactor `generateModelComparisons()` Complex CTE**
**Before** (75 lines): Complex CTE with business logic
**After** (25 lines): Delegated calculations with query builder
```typescript
private async generateModelComparisons(): Promise<ModelComparison[]> {
  const [accuracyData, trustworthinessData, feedbackData] = await Promise.all([
    this.accuracyRepo.getModelAccuracyMap(),
    this.trustworthinessRepo.getModelTrustworthinessMap(), 
    this.feedbackRepo.getModelFeedbackMap()
  ]);
  return this.combineModelComparisons(accuracyData, trustworthinessData, feedbackData);
}
```

### **Task 3: Add Missing Repository Methods**

**AccuracyRepository** needs:
- `getBasicStats()` - for MetricsRepository delegation
- `getModelAccuracyMap()` - for model comparisons

**TrustworthinessRepository** needs:
- `getBasicStats()` - for MetricsRepository delegation  
- `getModelTrustworthinessMap()` - for model comparisons

**FeedbackRepository** needs:
- `getModelFeedbackMap()` - for model comparisons

### **Task 4: Extract Business Logic Constants**

**File**: `server/constants/metricsConstants.ts`
```typescript
export const METRICS_CONSTANTS = {
  HIGH_CONFIDENCE_THRESHOLD: 90,
  MIN_ATTEMPTS_FOR_RANKING: 3,
  MAX_COST_EFFICIENCY: 999,
  MIN_TRUSTWORTHINESS_THRESHOLD: 0.001,
  PERFECT_TRUSTWORTHINESS_SCORE: 1.0,
  ZERO_CONFIDENCE_VALUE: 0
} as const;
```

### **Task 5: Performance Optimizations**

**Database Indexes Needed:**
```sql
-- Already exist, verify performance
CREATE INDEX IF NOT EXISTS idx_explanations_model_name ON explanations(model_name);
CREATE INDEX IF NOT EXISTS idx_explanations_trustworthiness ON explanations(trustworthiness_score);
CREATE INDEX IF NOT EXISTS idx_explanations_prediction_grids ON explanations(predicted_output_grid, multi_test_prediction_grids);
```

---

## **Expected Outcomes**

### **Code Quality Improvements:**
- ✅ **SRP Compliance**: Each repository has single, clear responsibility
- ✅ **DRY Principle**: 90% reduction in duplicate SQL patterns  
- ✅ **Maintainability**: Complex methods broken into focused functions
- ✅ **Testability**: Pure functions easier to unit test
- ✅ **Performance**: Optimized queries with proper delegation

### **Metrics:**
- **Lines of Code**: MetricsRepository: 555 lines → ~200 lines (-64%)
- **Cyclomatic Complexity**: High complexity methods simplified
- **Code Duplication**: 40+ duplicate patterns → <5 patterns
- **Method Length**: Max method length: 80 lines → <25 lines

### **API Contract Guarantee:**
All external APIs return **identical data structures** after refactoring:
- `/api/metrics/comprehensive-dashboard` - Same ComprehensiveDashboard interface
- `/api/metrics/reliability` - Same ModelReliabilityStat[] interface
- Frontend components require **zero changes**

---

## **Implementation Sequence**

1. **Create MetricsQueryBuilder** with reusable fragments
2. **Add missing methods** to AccuracyRepository, TrustworthinessRepository, FeedbackRepository  
3. **Refactor MetricsRepository** to use pure aggregation pattern
4. **Extract constants** and simplify business logic
5. **Add comprehensive JSDoc** documentation
6. **Verify API contracts** remain identical

**Risk Mitigation**: Each step maintains backward compatibility and can be tested independently.

---

**Phase 2A Status**: ✅ **ANALYSIS COMPLETE**  
**Next Phase**: Phase 2B Implementation  
**Estimated Effort**: 3-4 hours for complete refactoring