# Model Comparison Architecture Analysis
**Author:** Cascade using Claude Sonnet 4.5  
**Date:** 2025-10-10T16:50:00-04:00  
**Purpose:** Deep analysis of the model comparison feature architecture to identify DRY/SRP violations

---

## Problem Statement

The model comparison feature returns 0 results or missing data when comparing models on datasets. Previous assistant suggested this was due to architectural violations and incorrect use of `puzzleLoader` vs. direct filesystem access.

---

## Current Architecture

### 1. Data Flow

```
Frontend (AnalyticsOverview.tsx)
  ↓ GET /api/metrics/compare?model1=X&model2=Y&dataset=evaluation2
MetricsController.getModelComparison()
  ↓ calls repositoryService.metrics.getModelComparison(models, dataset)
MetricsRepository.getModelComparison()
  ↓ calls this.getPuzzleIdsForDataset(dataset)
MetricsRepository.getPuzzleIdsForDataset() ← **CRITICAL METHOD**
  ↓ uses puzzleLoader.getPuzzleList({ source: mappedSource })
  ↓ queries database for model results on those puzzle IDs
  ↓ returns comparison results
```

### 2. Two Different Ways to Get Puzzle IDs

#### **Method A: MetricsRepository.getPuzzleIdsForDataset()** (lines 833-863)
```typescript
// Uses puzzleLoader with source mapping
const datasetSourceMap: Record<string, string> = {
  'evaluation': 'ARC1-Eval',
  'training': 'ARC1',
  'evaluation2': 'ARC2-Eval',
  'training2': 'ARC2',
  'arc-heavy': 'ARC-Heavy',
  'concept-arc': 'ConceptARC'
};
const source = datasetSourceMap[dataset] || dataset;
const puzzles = puzzleLoader.getPuzzleList({ source: source as any });
const puzzleIds = puzzles.map(p => p.id).sort();
```

#### **Method B: ModelDatasetRepository.getPuzzleIdsFromDataset()** (lines 86-112)
```typescript
// PRIVATE method - directly reads filesystem
const directory = path.join(process.cwd(), 'data', datasetName);
const files = fs.readdirSync(directory)
  .filter(file => file.endsWith('.json'))
  .map(file => path.basename(file, '.json'));
return files.sort();
```

### 3. How puzzleLoader Works

**Priority Loading System:**
- Loads all puzzle files across all directories
- Assigns source tags based on FIRST OCCURRENCE (priority order)
- Priority: ARC1-Eval (1) > ARC1 (2) > ARC2-Eval (3) > ARC2 (4) > ARC-Heavy (5) > ConceptARC (6)

**Critical Implication:**
If a puzzle exists in BOTH `data/evaluation/` and `data/evaluation2/`:
- puzzleLoader tags it as `'ARC1-Eval'` (higher priority)
- When you query for `source: 'ARC2-Eval'`, this puzzle is EXCLUDED

---

## The Bug Hypothesis

### Scenario: User selects dataset='evaluation2' for comparison

**Expected behavior:**
- Compare models on ALL 120 puzzles in `data/evaluation2/` directory

**Actual behavior with puzzleLoader:**
1. Maps 'evaluation2' → 'ARC2-Eval'
2. Calls `puzzleLoader.getPuzzleList({ source: 'ARC2-Eval' })`
3. Returns ONLY puzzles where `puzzle.source === 'ARC2-Eval'`
4. **Excludes any puzzles that also exist in higher-priority directories**
5. Result: Fewer puzzle IDs than actually exist in the directory

**What should happen with direct filesystem:**
1. Read ALL .json files from `data/evaluation2/`
2. Return ALL 120 puzzle IDs regardless of priority/source
3. Query database for model results on ALL 120 puzzles

---

## DRY Violation Analysis

**Two implementations of "get puzzle IDs from dataset":**

1. **MetricsRepository.getPuzzleIdsForDataset()** - Public, complex, uses puzzleLoader + source mapping
2. **ModelDatasetRepository.getPuzzleIdsFromDataset()** - Private, simple, direct filesystem access

**Why this violates DRY:**
- Same conceptual operation: "given a dataset name, return puzzle IDs"
- Different implementations with different behaviors
- No single source of truth
- Maintenance burden: changes to dataset structure require updates in multiple places

---

## SRP Violation Analysis

**MetricsRepository responsibilities:**
- ✅ Should aggregate metrics across multiple specialized repositories
- ✅ Should coordinate cross-repository analytics
- ❌ Should NOT know about puzzleLoader internals
- ❌ Should NOT know about dataset-to-source mapping
- ❌ Should NOT implement dataset discovery logic

**ModelDatasetRepository responsibilities:**
- ✅ Owns all dataset-related operations
- ✅ Knows how to map dataset names to directories
- ✅ Knows how to read puzzle IDs from directories
- ❌ Currently has getPuzzleIdsFromDataset() as PRIVATE (not reusable)

---

## Root Cause

**The issue is NOT that puzzleLoader is wrong** - puzzleLoader is designed for priority-based puzzle management across multiple datasets.

**The issue IS that model comparison needs a different semantic:**
- puzzleLoader: "Get all puzzles from this SOURCE (deduplicated across directories)"
- Model comparison: "Get all puzzles from this DIRECTORY (regardless of priority)"

**MetricsRepository is using the wrong tool for the job.**

---

## Proposed Solution

### Step 1: Make ModelDatasetRepository.getPuzzleIdsFromDataset() public
```typescript
// Change from private to public
public getPuzzleIdsFromDataset(datasetName: string): string[] {
  // ... existing implementation
}
```

### Step 2: Update MetricsRepository.getPuzzleIdsForDataset() to delegate
```typescript
private async getPuzzleIdsForDataset(dataset: string): Promise<string[]> {
  if (dataset === 'all') {
    const result = await this.query('SELECT DISTINCT puzzle_id FROM explanations ORDER BY puzzle_id');
    return result.rows.map(r => r.puzzle_id);
  }
  
  // DELEGATE to ModelDatasetRepository - single source of truth
  const { default: modelDatasetRepo } = await import('./ModelDatasetRepository.ts');
  return modelDatasetRepo.getPuzzleIdsFromDataset(dataset);
}
```

### Step 3: Remove puzzleLoader logic and mapping from MetricsRepository
- Delete lines 839-863 (puzzleLoader import and usage)
- Remove datasetSourceMap entirely
- Let ModelDatasetRepository own dataset operations

---

## Benefits

1. **Single Source of Truth:** Only ModelDatasetRepository knows how to map dataset names to directories
2. **Correct Behavior:** Model comparison gets ALL puzzles in a directory, not priority-filtered subset
3. **SRP Compliance:** MetricsRepository delegates dataset operations to the proper owner
4. **DRY Compliance:** No duplicate implementation of "get puzzle IDs from dataset"
5. **Maintainability:** Dataset structure changes only require updates in one place

---

## Verification Steps

After implementing the fix:

1. **Test dataset='evaluation2':**
   - Should return exactly 120 puzzle IDs (matching filesystem)
   - Not fewer due to priority filtering

2. **Test model comparison:**
   - Should return results for all puzzles in the selected dataset
   - Summary counts should match directory file counts

3. **Test dataset='all':**
   - Should still work using database query (no filesystem dependency)

---

## Additional Considerations

**Q: Should we remove puzzleLoader entirely?**  
A: No - puzzleLoader serves a valid purpose for the puzzle browser and priority-based puzzle loading. It's just the wrong tool for model comparison.

**Q: What about the mapping in MetricsRepository?**  
A: The mapping is unnecessary when using direct filesystem access. ModelDatasetRepository already knows that dataset='evaluation2' means 'data/evaluation2/'.

**Q: Won't this break other things?**  
A: No - this only changes MetricsRepository.getPuzzleIdsForDataset() which is a private method only used by getModelComparison(). The change is isolated.
