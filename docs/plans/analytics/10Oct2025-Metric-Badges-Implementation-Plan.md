# Metric Badges Implementation Plan
**Date:** October 10, 2025  
**Author:** Cascade using Claude Sonnet 4.5  
**Purpose:** Add aggregate metric badges (cost, time, tokens) to Analytics Overview stat cards

## Objective

Display aggregate metrics (cost, processing time, tokens) as shadcn/ui Badge components in the Analytics Overview stat cards for Correct, Incorrect, and Not Attempted puzzle categories.

## Architecture & SRP Compliance

### Single Responsibility Principle (SRP) Analysis

**Domain Separation:**
1. **ModelDatasetRepository** - ALREADY owns model-dataset operations (performance queries)
2. **Metrics Domain** - NEW method in ModelDatasetRepository for aggregate metrics
3. **ModelDatasetController** - NEW endpoint for metrics
4. **Frontend Hook** - NEW hook or extend useModelDatasetPerformance
5. **UI Component** - AnalyticsOverview displays badges

**Why ModelDatasetRepository (not MetricsRepository)?**
- MetricsRepository handles CROSS-model comparisons and complex analytics
- ModelDatasetRepository handles SINGLE model-dataset operations
- This is a single-model metric aggregation → belongs in ModelDatasetRepository
- Follows existing pattern: getModelDatasetPerformance() is already there
- Avoids DRY violation (don't scatter model-dataset logic)

### Database Fields Available

From `explanations` table (verified from AGENTS.md and schema):
- `estimated_cost` (numeric) - Cost in USD
- `api_processing_time_ms` (integer) - Processing time in milliseconds
- `input_tokens` (integer)
- `output_tokens` (integer)
- `reasoning_tokens` (integer)
- `total_tokens` (integer)
- `is_prediction_correct` (boolean)
- `multi_test_all_correct` (boolean)
- `puzzle_id` (varchar)
- `model_name` (varchar)

## Implementation Plan

### Phase 1: Backend - Repository Method (SRP: Data Access)

**File:** `server/repositories/ModelDatasetRepository.ts`

**New Method:** `getModelDatasetMetrics(modelName: string, datasetName: string)`

**Returns:**
```typescript
interface ModelDatasetMetrics {
  modelName: string;
  dataset: string;
  overall: {
    count: number;
    avgCost: number;
    totalCost: number;
    avgTime: number;  // in milliseconds
    totalTime: number;
    avgTokens: number;
    totalTokens: number;
  };
  correct: {
    count: number;
    avgCost: number;
    totalCost: number;
    avgTime: number;
    avgTokens: number;
  };
  incorrect: {
    count: number;
    avgCost: number;
    totalCost: number;
    avgTime: number;
    avgTokens: number;
  };
}
```

**SQL Query Strategy:**
```sql
-- Single query with CASE WHEN for performance
SELECT 
  COUNT(*) as total_count,
  AVG(estimated_cost) as avg_cost_all,
  SUM(estimated_cost) as total_cost_all,
  AVG(api_processing_time_ms) as avg_time_all,
  SUM(api_processing_time_ms) as total_time_all,
  AVG(total_tokens) as avg_tokens_all,
  SUM(total_tokens) as total_tokens_all,
  
  -- Correct subset
  COUNT(*) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true) as count_correct,
  AVG(estimated_cost) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true) as avg_cost_correct,
  SUM(estimated_cost) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true) as total_cost_correct,
  AVG(api_processing_time_ms) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true) as avg_time_correct,
  AVG(total_tokens) FILTER (WHERE is_prediction_correct = true OR multi_test_all_correct = true) as avg_tokens_correct,
  
  -- Incorrect subset
  COUNT(*) FILTER (WHERE (is_prediction_correct = false OR multi_test_all_correct = false)) as count_incorrect,
  AVG(estimated_cost) FILTER (WHERE (is_prediction_correct = false OR multi_test_all_correct = false)) as avg_cost_incorrect,
  SUM(estimated_cost) FILTER (WHERE (is_prediction_correct = false OR multi_test_all_correct = false)) as total_cost_incorrect,
  AVG(api_processing_time_ms) FILTER (WHERE (is_prediction_correct = false OR multi_test_all_correct = false)) as avg_time_incorrect,
  AVG(total_tokens) FILTER (WHERE (is_prediction_correct = false OR multi_test_all_correct = false)) as avg_tokens_incorrect
FROM explanations
WHERE model_name ILIKE $1
AND puzzle_id = ANY($2)
AND (predicted_output_grid IS NOT NULL OR multi_test_prediction_grids IS NOT NULL)
```

**DRY Compliance:**
- Reuses existing `getPuzzleIdsFromDataset()` method
- Follows same pattern as `getModelDatasetPerformance()`
- Single query instead of multiple separate queries

### Phase 2: Backend - Controller & Route (SRP: HTTP Layer)

**File:** `server/controllers/modelDatasetController.ts`

**New Method:** `getModelDatasetMetrics`

```typescript
getModelDatasetMetrics = asyncHandler(async (req: Request, res: Response) => {
  const { modelName, datasetName } = req.params;
  
  if (!modelName || !datasetName) {
    return res.status(400).json({
      success: false,
      message: 'Model name and dataset name are required',
    });
  }

  const metrics = await repositoryService.modelDataset.getModelDatasetMetrics(
    modelName,
    datasetName
  );

  res.status(200).json({
    success: true,
    data: metrics,
  });
});
```

**File:** `server/routes.ts`

**New Route:**
```typescript
router.get(
  '/api/model-dataset/metrics/:modelName/:datasetName',
  modelDatasetController.getModelDatasetMetrics
);
```

**SRP Compliance:**
- Controller only handles HTTP request/response
- All business logic in repository
- Follows existing pattern from getModelPerformance

### Phase 3: Frontend - Hook (SRP: Data Fetching)

**Option A: Extend existing hook**
**File:** `client/src/hooks/useModelDatasetPerformance.ts`

**New Hook:** `useModelDatasetMetrics(modelName, datasetName)`

```typescript
export interface ModelDatasetMetrics {
  // Same structure as backend response
}

export function useModelDatasetMetrics(
  modelName: string | null,
  datasetName: string | null
): {
  metrics: ModelDatasetMetrics | null;
  loading: boolean;
  error: string | null;
} {
  // Standard fetch pattern matching useModelDatasetPerformance
}
```

**DRY Compliance:**
- Reuses same pattern as useModelDatasetPerformance
- Same error handling
- Same loading states

### Phase 4: Frontend - UI Component (SRP: Display)

**File:** `client/src/pages/AnalyticsOverview.tsx`

**Integration Points:**

1. **Import hook:**
```typescript
import { useModelDatasetMetrics } from '@/hooks/useModelDatasetPerformance';
```

2. **Fetch metrics:**
```typescript
const { metrics, loading: loadingMetrics } = useModelDatasetMetrics(
  selectedModelForDataset,
  selectedDataset
);
```

3. **Display badges in stat cards:**

**Correct Card:**
```tsx
{metrics && (
  <div className="mt-2 flex flex-wrap gap-1">
    <Badge variant="outline" className="text-[10px] bg-green-50">
      💰 ${metrics.correct.avgCost.toFixed(4)} avg
    </Badge>
    <Badge variant="outline" className="text-[10px] bg-green-50">
      ⏱️ {(metrics.correct.avgTime / 1000).toFixed(2)}s avg
    </Badge>
    <Badge variant="outline" className="text-[10px] bg-green-50">
      🔤 {Math.round(metrics.correct.avgTokens).toLocaleString()} tokens
    </Badge>
  </div>
)}
```

**Incorrect Card:**
```tsx
{metrics && (
  <div className="mt-2 flex flex-wrap gap-1">
    <Badge variant="outline" className="text-[10px] bg-red-50">
      💰 ${metrics.incorrect.avgCost.toFixed(4)} avg
    </Badge>
    <Badge variant="outline" className="text-[10px] bg-red-50">
      ⏱️ {(metrics.incorrect.avgTime / 1000).toFixed(2)}s avg
    </Badge>
    <Badge variant="outline" className="text-[10px] bg-red-50">
      🔤 {Math.round(metrics.incorrect.avgTokens).toLocaleString()} tokens
    </Badge>
  </div>
)}
```

**Not Attempted Card:**
- No metrics (no attempts = no cost/time/tokens data)

**DRY Compliance:**
- Could extract badge rendering to helper function if pattern repeats
- Reuses shadcn/ui Badge component
- Follows existing display patterns

## Display Format Specifications

### Cost Display
- Format: `$X.XXXX` (4 decimal places for precision)
- Example: `$0.0023 avg`
- Prefix: 💰

### Time Display
- Format: `X.XXs` (convert ms to seconds, 2 decimal places)
- Example: `12.45s avg`
- Prefix: ⏱️

### Tokens Display
- Format: `X,XXX` (integer with thousand separators)
- Example: `2,450 tokens`
- Prefix: 🔤

### Badge Styling
- Size: `text-[10px]` for compact display
- Variant: `outline` 
- Background: Match card color (green-50, red-50, gray-50)
- Gap: `gap-1` between badges
- Wrap: `flex-wrap` to prevent overflow

## Error Handling

### Backend
- Return null/zero values if no data found
- Log warnings for database connection issues
- Return empty object with zeros if dataset doesn't exist

### Frontend
- Handle loading state (show skeleton or nothing)
- Handle error state (show nothing, don't break UI)
- Handle null metrics (don't display badges)
- Graceful degradation: UI works with or without metrics

## Testing Strategy

1. **Backend SQL Query:**
   - Test with model that has correct/incorrect puzzles
   - Test with model that has no attempts
   - Verify NULL handling in SQL FILTER clauses

2. **API Endpoint:**
   - Test with valid model/dataset
   - Test with invalid model/dataset
   - Test with special characters in model name

3. **Frontend Display:**
   - Test with metrics present
   - Test with metrics null (no data)
   - Test with loading state
   - Test with very large/small numbers

## Files to Modify

### Backend
1. `server/repositories/ModelDatasetRepository.ts` - Add getModelDatasetMetrics()
2. `server/controllers/modelDatasetController.ts` - Add getModelDatasetMetrics()
3. `server/routes.ts` - Add /api/model-dataset/metrics/:modelName/:datasetName

### Frontend
4. `client/src/hooks/useModelDatasetPerformance.ts` - Add useModelDatasetMetrics()
5. `client/src/pages/AnalyticsOverview.tsx` - Add badge display

### Documentation
6. `docs/EXTERNAL_API.md` - Document new endpoint
7. `CHANGELOG.md` - Add v4.0.11 entry

## Estimated Complexity

- **Backend Repository:** Medium (SQL with FILTER clauses, NULL handling)
- **Backend Controller:** Low (standard pattern)
- **Frontend Hook:** Low (standard pattern)
- **Frontend UI:** Low (badge rendering)
- **Overall:** Medium complexity, high value

## Future Enhancements

1. **Model Comparison Metrics:**
   - Aggregate metrics across models in comparison dialog
   - Show cost efficiency comparisons
   - Highlight fastest/cheapest model

2. **Trend Analysis:**
   - Cost over time for a model
   - Performance degradation detection
   - Token usage trends

3. **Budget Alerts:**
   - Warn when average cost exceeds threshold
   - Show total cost for all attempts
   - Cost per correct answer calculations

## Dependencies

- ✅ Database schema has required fields
- ✅ ModelDatasetRepository exists
- ✅ Badge component from shadcn/ui exists
- ✅ Existing hook patterns to follow
- ✅ No external API dependencies

## Rollback Plan

If issues arise:
1. Frontend: Remove badge display (won't break UI)
2. Backend: Comment out route (404 error handled gracefully)
3. Repository: No dependencies, safe to rollback

## Success Criteria

- [ ] Backend endpoint returns correct aggregate metrics
- [ ] Frontend displays badges without breaking layout
- [ ] Metrics show 2 decimal precision for percentages (already fixed)
- [ ] Metrics show 4 decimal precision for costs
- [ ] Loading states handled gracefully
- [ ] No performance degradation on Analytics page
- [ ] Documentation updated
- [ ] Changelog updated
