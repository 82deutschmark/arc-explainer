# Worst-Performing Puzzles Endpoint

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-11-22
**PURPOSE:** Complete technical documentation for the worst-performing puzzles API endpoint, including metric calculation algorithms, database query architecture, and usage patterns for external integrations.

---

## Overview

The worst-performing puzzles endpoint identifies ARC puzzles where large language models have demonstrated the least success. This endpoint is critical for:

- **Benchmark Creation**: Identifying challenging puzzles for AI evaluation datasets
- **Model Training**: Finding edge cases that expose model weaknesses
- **Research Analysis**: Studying patterns in AI reasoning failures
- **User Interface**: Powering the PuzzleDBViewer and analytics dashboards

---

## Endpoint Specification

### **Route**
```
GET /api/puzzle/worst-performing
```

### **Authentication**
None required - all endpoints are publicly accessible

### **Query Parameters**

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `limit` | number | 20 | 500 | Number of results to return |
| `sortBy` | string | 'composite' | - | Sort algorithm (see below) |
| `minAccuracy` | number | - | 1.0 | Minimum average accuracy filter (0-1) |
| `maxAccuracy` | number | - | 1.0 | Maximum average accuracy filter (0-1) |
| `zeroAccuracyOnly` | boolean | false | - | Only puzzles with zero correct solutions |
| `source` | string | - | - | Dataset filter: 'ARC1', 'ARC1-Eval', 'ARC2', 'ARC2-Eval', 'ARC-Heavy', 'ConceptARC' |
| `multiTestFilter` | string | - | - | Test type filter: 'single' or 'multi' |
| `includeRichMetrics` | boolean | false | - | Include cost, tokens, and performance metrics |

### **Sort Options**

- **`composite`** (default) - Multi-factor weighted scoring (see algorithm below)
- **`accuracy`** - Average trustworthiness/accuracy score (ascending)
- **`confidence`** - Average AI confidence level (ascending)
- **`feedback`** - Negative user feedback count (descending)
- **`cost`** - Average cost per attempt (descending)
- **`processing_time`** - Average API processing time (descending)

### **Response Format**

```json
{
  "success": true,
  "data": {
    "puzzles": [
      {
        "id": "00d62c1b",
        "source": "ARC1-Eval",
        "train": [...],
        "test": [...],
        "performanceData": {
          "wrongCount": 12,
          "avgAccuracy": 0.23,
          "avgConfidence": 18.5,
          "totalExplanations": 15,
          "negativeFeedback": 3,
          "totalFeedback": 8,
          "latestAnalysis": "2025-11-20T15:30:00Z",
          "worstExplanationId": 4523,
          "compositeScore": 83.5,

          // Rich metrics (when includeRichMetrics=true)
          "avgCost": 0.0245,
          "avgProcessingTime": 3420,
          "avgReasoningTokens": 12450,
          "avgInputTokens": 1850,
          "avgOutputTokens": 580,
          "avgTotalTokens": 14880,
          "multiTestCount": 8,
          "singleTestCount": 7,
          "lowestNonZeroConfidence": 5.2,
          "modelsAttemptedCount": 6,
          "reasoningEffortsCount": 3
        }
      }
    ],
    "total": 1
  }
}
```

---

## Metric Calculation Algorithm

### **Composite Score Formula**

The composite scoring algorithm prioritizes multiple failure indicators with weighted importance:

```sql
composite_score =
  (wrong_count * 5.0) +                          -- Weight: 5.0 per incorrect attempt
  (avg_accuracy < 0.6 ? 10.0 : 0.0) +            -- Weight: 10.0 for low accuracy
  (avg_confidence < 50 ? 3.0 : 0.0) +            -- Weight: 3.0 for low confidence
  (negative_feedback * 2.0)                      -- Weight: 2.0 per negative feedback
```

**Design Rationale:**
- **Incorrect attempts** are weighted highest (5.0x) because they represent direct model failures
- **Low accuracy threshold** (60%) triggers a 10-point penalty for systemic poor performance
- **Low confidence** (below 50%) adds a 3-point penalty indicating model uncertainty
- **User feedback** validates the technical metrics with human judgment

### **Aggregated Metrics**

Each metric is calculated per puzzle across all model attempts:

#### 1. **Wrong Count** (`wrong_count`)
```sql
COUNT(DISTINCT e.id) FILTER (
  WHERE (has_multiple_predictions = false AND is_prediction_correct = false)
     OR (has_multiple_predictions = true AND multi_test_all_correct = false)
)
```
- Counts unique incorrect explanations
- Handles both single-test and multi-test validation methods
- Uses `DISTINCT` to avoid JOIN duplication

#### 2. **Average Accuracy** (`avg_accuracy`)
```sql
AVG(COALESCE(trustworthiness_score, multi_test_average_accuracy, 0))
```
- Prioritizes `trustworthiness_score` (confidence-weighted correctness)
- Falls back to `multi_test_average_accuracy` for multi-test puzzles
- Clamped to 0-1 range in post-processing

#### 3. **Average Confidence** (`avg_confidence`)
```sql
AVG(e.confidence)
```
- Average self-reported AI confidence (0-100 scale)
- NULL values excluded from average

#### 4. **Negative Feedback** (`negative_feedback`)
```sql
COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful')
```
- Counts user-submitted "not helpful" feedback
- Joined from `feedback` table

#### 5. **Total Explanations** (`total_explanations`)
```sql
COUNT(DISTINCT e.id)
```
- Total number of attempts across all models
- Indicates puzzle exploration depth

---

## Database Query Architecture

### **Source Files**
- **Repository:** `/server/repositories/MetricsRepository.ts:1252` *(moved from ExplanationRepository in v5.19.0 - SRP fix)*
- **Service:** `/server/services/puzzleOverviewService.ts:277`
- **Controller:** `/server/controllers/puzzleController.ts:400`
- **Routes:** `/server/routes.ts:123`

**Architecture Note (v5.19.0):** The `getWorstPerformingPuzzles()` method was moved from ExplanationRepository to MetricsRepository as part of Phase 2 architectural refactoring. This method performs cross-table analytics (explanations + feedback) and composite scoring, which is analytics work that belongs in the MetricsRepository orchestration layer, not in a CRUD repository.

### **SQL Query Structure**

```sql
SELECT *
FROM (
  SELECT
    e.puzzle_id,
    COUNT(DISTINCT e.id) FILTER (
      WHERE (COALESCE(e.has_multiple_predictions, false) = false
             AND COALESCE(e.is_prediction_correct, false) = false)
         OR (COALESCE(e.has_multiple_predictions, false) = true
             AND COALESCE(e.multi_test_all_correct, false) = false)
    ) as wrong_count,
    AVG(COALESCE(e.trustworthiness_score, e.multi_test_average_accuracy, 0)) as avg_accuracy,
    AVG(e.confidence) as avg_confidence,
    COUNT(DISTINCT e.id) as total_explanations,
    COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') as negative_feedback,
    COUNT(f.id) as total_feedback,
    MAX(e.created_at) as latest_analysis,
    MIN(e.id) FILTER (...) as worst_explanation_id,
    -- Composite score calculation inline
    (
      COUNT(DISTINCT e.id) FILTER (...) * 5.0 +
      CASE WHEN AVG(COALESCE(e.trustworthiness_score, ...)) < 0.6 THEN 10.0 ELSE 0.0 END +
      CASE WHEN AVG(e.confidence) < 50 THEN 3.0 ELSE 0.0 END +
      COUNT(f.id) FILTER (WHERE f.feedback_type = 'not_helpful') * 2.0
    ) as composite_score
  FROM explanations e
  LEFT JOIN feedback f ON e.id = f.explanation_id
  WHERE e.puzzle_id IS NOT NULL
  GROUP BY e.puzzle_id
  HAVING COUNT(DISTINCT e.id) > 0
    AND (wrong_count > 0 OR avg_accuracy < 0.5 OR negative_feedback > 0)
) as performance_data
ORDER BY
  CASE WHEN $2 = 'composite' THEN performance_data.composite_score END DESC,
  CASE WHEN $2 = 'accuracy' THEN performance_data.avg_accuracy END ASC NULLS LAST,
  ...
LIMIT $1
```

### **Performance Optimizations**

1. **COUNT(DISTINCT) with FILTER** - Prevents JOIN duplication issues
2. **Conditional rich metrics** - Expensive aggregations only when requested
3. **HAVING clause filtering** - Reduces result set before ordering
4. **Indexed columns** - Queries leverage indexes on `puzzle_id`, `created_at`, `is_prediction_correct`

**Critical Note:** The `includeRichMetrics=false` flag prevents PostgreSQL temp disk overflow by avoiding `STRING_AGG` operations on large datasets (4000+ puzzles).

---

## Filtering Logic

### **Default Filter (Composite Mode)**

Shows puzzles that meet ANY of these criteria:
```sql
wrong_count > 0 OR
avg_accuracy < 0.5 OR
negative_feedback > 0
```

### **Confidence Mode** (`sortBy=confidence`)

Shows only low-confidence attempts (excluding zeros):
```sql
avg_confidence > 0 AND avg_confidence <= 25
```

### **Zero Accuracy Mode** (`zeroAccuracyOnly=true`)

Shows only puzzles with NO correct solutions:
```sql
COUNT(correct_attempts) = 0
```

### **Accuracy Range Mode** (`minAccuracy`/`maxAccuracy`)

Custom range filtering:
```sql
avg_accuracy >= minAccuracy AND avg_accuracy <= maxAccuracy
```

---

## Frontend Integration

### **React Hook: `usePuzzleDBStats`**

**Location:** `/client/src/hooks/usePuzzleDBStats.ts`

```typescript
import { usePuzzleDBStats } from '@/hooks/usePuzzleDBStats';

function MyComponent() {
  const { data: puzzles, isLoading } = usePuzzleDBStats({
    limit: 50,
    sortBy: 'composite',
    zeroAccuracyOnly: true,
    includeRichMetrics: true
  });

  return (
    <div>
      {puzzles?.map(puzzle => (
        <PuzzleCard
          key={puzzle.id}
          puzzle={puzzle}
          performance={puzzle.performanceData}
        />
      ))}
    </div>
  );
}
```

### **Alternative Hook: `useAllPuzzleStats`**

For comprehensive puzzle overview (includes unexplored puzzles):

```typescript
const { data: allPuzzles } = useAllPuzzleStats();
// Returns ALL 2,220+ puzzles with performance data or empty metrics
```

---

## Use Cases

### 1. **Identifying Unsolved Puzzles**

```bash
GET /api/puzzle/worst-performing?zeroAccuracyOnly=true&limit=100
```

Returns puzzles where NO model has achieved a correct solution.

### 2. **Finding Low-Confidence Failures**

```bash
GET /api/puzzle/worst-performing?sortBy=confidence&limit=50
```

Shows puzzles where models attempted solutions but expressed low confidence (1-25%).

### 3. **Dataset-Specific Analysis**

```bash
GET /api/puzzle/worst-performing?source=ARC2-Eval&sortBy=composite&limit=100
```

Identifies the hardest puzzles specifically from the ARC2 evaluation set.

### 4. **Cost Analysis for Difficult Puzzles**

```bash
GET /api/puzzle/worst-performing?includeRichMetrics=true&sortBy=cost
```

Reveals which difficult puzzles consumed the most API credits.

### 5. **Multi-Test vs Single-Test Performance**

```bash
# Multi-test puzzles only
GET /api/puzzle/worst-performing?multiTestFilter=multi&sortBy=accuracy

# Single-test puzzles only
GET /api/puzzle/worst-performing?multiTestFilter=single&sortBy=accuracy
```

Compares performance across different validation strategies.

---

## Rich Metrics Specification

When `includeRichMetrics=true`, the following additional fields are included:

| Field | Type | Description |
|-------|------|-------------|
| `avgCost` | number | Average estimated API cost per attempt (USD) |
| `avgProcessingTime` | number | Average API processing time (milliseconds) |
| `avgReasoningTokens` | number | Average reasoning tokens (o-series models) |
| `avgInputTokens` | number | Average input tokens consumed |
| `avgOutputTokens` | number | Average output tokens generated |
| `avgTotalTokens` | number | Average total tokens (input + output + reasoning) |
| `multiTestCount` | number | Count of multi-test attempts |
| `singleTestCount` | number | Count of single-test attempts |
| `lowestNonZeroConfidence` | number \| null | Minimum non-zero confidence reported |
| `modelsAttemptedCount` | number | Number of distinct models that attempted this puzzle |
| `reasoningEffortsCount` | number | Number of distinct reasoning effort levels used |

**Note:** Rich metrics incur additional query overhead and should only be requested when necessary.

---

## External API Integration

### **Python Example**

```python
import requests

def get_hardest_arc_puzzles(limit=50, dataset='ARC2-Eval'):
    """Fetch the hardest puzzles from ARC Explainer."""

    base_url = "https://arc-explainer-staging.up.railway.app"
    endpoint = f"{base_url}/api/puzzle/worst-performing"

    params = {
        'limit': limit,
        'sortBy': 'composite',
        'source': dataset,
        'zeroAccuracyOnly': 'true',
        'includeRichMetrics': 'true'
    }

    response = requests.get(endpoint, params=params)
    response.raise_for_status()

    data = response.json()
    puzzles = data['data']['puzzles']

    for puzzle in puzzles:
        perf = puzzle['performanceData']
        print(f"Puzzle {puzzle['id']}: {perf['totalExplanations']} attempts, "
              f"{perf['wrongCount']} failures, "
              f"avg confidence: {perf['avgConfidence']:.1f}%")

    return puzzles

# Usage
unsolved_puzzles = get_hardest_arc_puzzles(limit=100, dataset='ARC2-Eval')
```

### **JavaScript/TypeScript Example**

```typescript
interface WorstPuzzleFilters {
  limit?: number;
  sortBy?: 'composite' | 'accuracy' | 'confidence' | 'feedback';
  zeroAccuracyOnly?: boolean;
  source?: string;
  includeRichMetrics?: boolean;
}

async function fetchWorstPerformingPuzzles(
  filters: WorstPuzzleFilters = {}
): Promise<any[]> {
  const params = new URLSearchParams();

  params.append('limit', (filters.limit || 20).toString());
  params.append('sortBy', filters.sortBy || 'composite');

  if (filters.zeroAccuracyOnly) {
    params.append('zeroAccuracyOnly', 'true');
  }

  if (filters.source) {
    params.append('source', filters.source);
  }

  if (filters.includeRichMetrics) {
    params.append('includeRichMetrics', 'true');
  }

  const response = await fetch(
    `https://arc-explainer-staging.up.railway.app/api/puzzle/worst-performing?${params}`
  );

  const json = await response.json();
  return json.data.puzzles;
}

// Usage
const hardestPuzzles = await fetchWorstPerformingPuzzles({
  limit: 100,
  zeroAccuracyOnly: true,
  includeRichMetrics: true
});
```

---

## Related Endpoints

- **`GET /api/puzzles/stats`** - Alternative endpoint that includes ALL puzzles (analyzed + unexplored)
- **`GET /api/puzzle/confidence-stats`** - Model confidence analysis across all puzzles
- **`GET /api/feedback/accuracy-stats`** - Pure solver accuracy statistics (excludes debate rebuttals)
- **`GET /api/model-dataset/performance/:modelName/:datasetName`** - Model-specific performance on datasets

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v5.x | Sept 2025 | Increased max limit from 50 to 500 |
| v5.x | Sept 2025 | Added rich metrics support (`includeRichMetrics`) |
| v5.x | Oct 2025 | Added `multiTestFilter` parameter |
| v5.x | Nov 2025 | Optimized query to prevent temp disk overflow |

---

## Performance Considerations

### **Query Execution Time**

- **Without rich metrics:** ~200-500ms for 500 results
- **With rich metrics:** ~800-1500ms for 500 results (due to additional aggregations)

### **Database Impact**

- Uses indexed columns for optimal performance
- Aggregation happens at database level (efficient)
- LEFT JOIN with feedback table is performant due to indexes

### **Recommended Limits**

- **UI dashboards:** 20-50 results
- **Analytics exports:** 100-500 results
- **Research datasets:** Use `/api/puzzles/stats` for comprehensive data

---

## Error Handling

### **Database Disconnected**

Returns empty array:
```json
{
  "success": true,
  "data": {
    "puzzles": [],
    "total": 0
  }
}
```

### **Invalid Parameters**

Returns 500 error with details:
```json
{
  "success": false,
  "error": "Failed to fetch worst-performing puzzles",
  "details": "Invalid sortBy parameter"
}
```

---

## Testing

### **Manual Testing**

```bash
# Test basic endpoint
curl "http://localhost:5000/api/puzzle/worst-performing?limit=10"

# Test with filters
curl "http://localhost:5000/api/puzzle/worst-performing?zeroAccuracyOnly=true&includeRichMetrics=true"

# Test sorting options
curl "http://localhost:5000/api/puzzle/worst-performing?sortBy=confidence&limit=20"
```

### **Expected Behaviors**

1. Results are always ordered by the specified `sortBy` parameter
2. `compositeScore` decreases as you paginate (in composite mode)
3. Puzzles without any attempts are excluded (unless using `/api/puzzles/stats`)
4. Rich metrics are only present when `includeRichMetrics=true`

---

## Future Enhancements

Potential improvements tracked in GitHub issues:

- [ ] Add pagination support (offset parameter)
- [ ] Support multiple dataset filtering (`source=ARC1,ARC2`)
- [ ] Add time-based filtering (puzzles attempted in last N days)
- [ ] Cache expensive queries with Redis
- [ ] Add GraphQL endpoint for flexible querying
- [ ] Support model-specific filtering (exclude certain models)

---

## References

- **API Documentation:** `/docs/reference/api/EXTERNAL_API.md:413`
- **Database Schema:** `/docs/reference/database/`
- **Frontend Components:** `/client/src/pages/PuzzleDBViewer.tsx`
- **Related Service:** `/server/services/puzzleOverviewService.ts`

---

## Support

For questions or issues with this endpoint:

1. Check the [External API Documentation](./EXTERNAL_API.md)
2. Review the [Database Correctness Logic](../database/CORRECTNESS_LOGIC_PATTERN.md)
3. Open an issue on GitHub with the `api` label
