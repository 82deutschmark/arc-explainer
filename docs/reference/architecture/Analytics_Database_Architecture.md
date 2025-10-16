/**
 * Author: Claude Code using Sonnet 4
 * Date: 2025-09-24
 * PURPOSE: Complete documentation of the analytics database architecture and repository system.
 * Explains how statistics and scores are extracted from the database and displayed to users.
 * Documents the entire data pipeline from raw explanations table to UI components.
 * This is the critical knowledge future developers need to understand the analytics system.
 */

# Analytics Database Architecture Guide

*Last Updated: September 24, 2025*

This document explains how statistics and scores flow from the PostgreSQL database through the repository layer to the UI. Understanding this architecture is critical for adding new metrics, debugging data inconsistencies, and maintaining the analytics system.

## The Big Picture: Data Pipeline Architecture

```
Raw Data (explanations table)
         ↓
Domain-Specific Repositories (AccuracyRepository, TrustworthinessRepository, CostRepository)
         ↓
Aggregation Layer (MetricsRepository using delegation pattern)
         ↓
API Controllers (puzzleController, costController, metricsController)
         ↓
Frontend Hooks (useModelComparisons, useModelLeaderboards, usePerformanceInsights)
         ↓
UI Components (ModelComparisonMatrix, TrustworthinessLeaderboard, AccuracyLeaderboard)
```

## Core Database Schema: The `explanations` Table

All analytics derive from the central `explanations` table. Key fields for analytics:

### Accuracy Fields
- `is_prediction_correct` (boolean) - Single test correctness
- `multi_test_all_correct` (boolean) - All tests correct for multi-test puzzles
- `multi_test_average_accuracy` (double precision) - Average accuracy across tests
- `predicted_output_grid` (jsonb) - The actual prediction grids

### Trustworthiness/Confidence Fields
- `confidence` (integer) - AI's self-reported confidence (0-10)
- `prediction_accuracy_score` (double precision) - **THIS IS THE TRUSTWORTHINESS SCORE**
- `trustworthiness_score` (double precision) - Calculated reliability metric

### Performance Fields
- `api_processing_time_ms` (integer) - API response time
- `total_tokens` (integer) - Token usage
- `estimated_cost` (numeric) - Financial cost

### Metadata Fields
- `model_name` (varchar) - AI model identifier (needs normalization)
- `created_at` (timestamp) - When analysis was performed
- `puzzle_id` (varchar) - Which puzzle was analyzed

### Conversation Chaining & Prompt Traceability
- `provider_response_id` (text) - Responses API conversation ID used for chaining
- `system_prompt_used` (text) - Stored system prompt used for the analysis
- `user_prompt_used` (text) - Stored user prompt used for the analysis
- `prompt_template_id` (varchar) - Prompt template identifier (for analytics and provenance)
- `custom_prompt_text` (text) - Custom free‑form prompt text when provided

Recommended indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_explanations_provider_response_id
  ON explanations(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_explanations_prompt_template
  ON explanations(prompt_template_id) WHERE prompt_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_explanations_custom_prompt_hash
  ON explanations(MD5(custom_prompt_text)) WHERE custom_prompt_text IS NOT NULL;
```

## Repository Architecture: Domain Separation

### 1. AccuracyRepository - Pure Puzzle-Solving Correctness

**Domain**: Boolean puzzle correctness only
**Key Methods**:
- `getPureAccuracyStats()` - Overall accuracy statistics
- `getModelAccuracyMap()` - Accuracy by model for cross-repository use

**Business Logic**:
```sql
-- Single test accuracy
SELECT
  COUNT(CASE WHEN is_prediction_correct = true THEN 1 END) as correct,
  COUNT(*) as total
FROM explanations
WHERE predicted_output_grid IS NOT NULL

-- Multi-test accuracy (for puzzles with multiple tests)
SELECT
  COUNT(CASE WHEN multi_test_all_correct = true THEN 1 END) as all_correct,
  AVG(multi_test_average_accuracy) as avg_accuracy
FROM explanations
WHERE has_multiple_predictions = true
```

**UI Consumers**: AccuracyLeaderboard

### 2. TrustworthinessRepository - AI Confidence Reliability

**Domain**: How reliable is the AI's confidence vs actual performance
**Key Methods**:
- `getTrustworthinessStats()` - Confidence reliability analysis
- `getModelTrustworthinessMap()` - Trustworthiness by model

**Business Logic**:
```sql
-- Trustworthiness = how well AI confidence correlates with actual accuracy
SELECT
  model_name,
  AVG(prediction_accuracy_score) as avg_trustworthiness,
  AVG(confidence) as avg_confidence
FROM explanations
WHERE trustworthiness_score IS NOT NULL
  AND confidence IS NOT NULL
  AND NOT (trustworthiness_score = 1.0 AND confidence = 0) -- Filter corrupted data
```

**Filtering Rules**:
- Excludes records without trustworthiness scores
- Filters out corrupted "perfect score with 0 confidence" entries
- Uses complex model name normalization

**UI Consumers**: TrustworthinessLeaderboard, ModelDebugModal

### 3. CostRepository - Financial Cost Analysis

**Domain**: All cost calculations and cost-related metrics
**Key Methods**:
- `getAllModelCosts()` - Cost summaries for all models
- `getModelCostMap()` - Cost data for cross-repository integration
- `getCostTrends()` - Historical cost analysis

**Business Logic**:
```sql
-- Cost aggregation with model normalization
SELECT
  CASE
    WHEN model_name LIKE '%:free' THEN REGEXP_REPLACE(model_name, ':free$', '')
    WHEN model_name LIKE '%:beta' THEN REGEXP_REPLACE(model_name, ':beta$', '')
    -- ... more normalization rules
  END as normalized_model_name,
  SUM(COALESCE(estimated_cost, 0)) as total_cost,
  AVG(COALESCE(estimated_cost, 0)) as average_cost,
  COUNT(*) as attempts
FROM explanations
WHERE estimated_cost IS NOT NULL AND estimated_cost > 0
GROUP BY normalized_model_name
```

**UI Consumers**: ModelComparisonMatrix (via comprehensive dashboard), any cost-related displays

### 4. MetricsRepository - Aggregated Cross-Domain Analytics

**Domain**: Combines data from multiple repositories using delegation pattern
**Key Methods**:
- `getComprehensiveDashboard()` - Combines accuracy + trustworthiness + feedback + cost
- `generateModelComparisons()` - Cross-domain model comparison data

**Architecture Pattern**:
```typescript
async getComprehensiveDashboard() {
  // Parallel data fetching from domain repositories
  const [accuracyStats, trustworthinessStats, feedbackStats] = await Promise.all([
    this.accuracyRepo.getPureAccuracyStats(),      // Pure accuracy domain
    this.trustworthinessRepo.getTrustworthinessStats(),  // Trustworthiness domain
    this.feedbackRepo.getFeedbackSummaryStats()          // User feedback domain
  ]);

  // Get cost data from dedicated cost repository
  const costMap = await this.costRepo.getModelCostMap();

  // Pure aggregation - no business logic duplication
  return this.combineModelComparisons(accuracyStats, trustworthinessStats, feedbackStats, costMap);
}
```

**UI Consumers**: ModelComparisonMatrix, comprehensive dashboard views

## Model Name Normalization: Critical Data Consistency

**Problem**: Same model appears with different suffixes in database:
- `claude-3.5-sonnet`
- `claude-3.5-sonnet:beta`
- `claude-3.5-sonnet:free`
- `z-ai/glm-4.5-air:free`

**Solution**: Standardized normalization via `utils/modelNormalizer.ts`:

```typescript
export function normalizeModelName(rawModelName: string): string {
  // Handle special cases first
  if (rawModelName === 'z-ai/glm-4.5-air:free' || rawModelName.startsWith('z-ai/glm-4.5-air')) {
    return 'z-ai/glm-4.5';
  }

  // Remove standard suffixes
  return rawModelName
    .replace(/:free$/, '')
    .replace(/:beta$/, '')
    .replace(/:alpha$/, '');
}
```

**Usage**: ALL repositories must use consistent normalization to avoid data fragmentation.

## Data Flow Patterns: From Database to UI

### Pattern 1: Single Domain Display
```
Database → AccuracyRepository → API Controller → Frontend Hook → AccuracyLeaderboard
```

Example: AccuracyLeaderboard showing pure puzzle-solving performance

### Pattern 2: Cross-Domain Aggregation
```
Database → Multiple Repositories → MetricsRepository (delegation) → API Controller → Frontend Hook → ModelComparisonMatrix
```

Example: ModelComparisonMatrix showing accuracy + trustworthiness + cost + user satisfaction

### Pattern 3: Combined Data API
```
Database → TrustworthinessRepository + CostRepository → puzzleController (combination) → Frontend Hook → ModelDebugModal
```

Example: ModelDebugModal needs both trustworthiness data and cost data from separate repositories

## API Endpoint Architecture

### Domain-Specific Endpoints
- `/api/feedback/accuracy-stats` → AccuracyRepository directly
- `/api/puzzle/performance-stats` → TrustworthinessRepository + CostRepository combination
- `/api/metrics/costs/models` → CostRepository directly

### Aggregated Endpoints
- `/api/metrics/comprehensive-dashboard` → MetricsRepository delegation to multiple repositories

### Cross-Repository Endpoints
- `/api/puzzle/performance-stats` → Combines trustworthiness + cost data to maintain API contract

## Database Performance Optimizations

### Indexes for Analytics Queries
```sql
-- Model-based analytics
CREATE INDEX idx_explanations_model_accuracy ON explanations(model_name, is_prediction_correct, multi_test_all_correct);

-- Trustworthiness calculations
CREATE INDEX idx_explanations_trustworthiness ON explanations(model_name, trustworthiness_score, confidence) WHERE trustworthiness_score IS NOT NULL;

-- Cost calculations (added Sept 2025)
CREATE INDEX idx_explanations_cost_model ON explanations(model_name, estimated_cost) WHERE estimated_cost IS NOT NULL;
CREATE INDEX idx_explanations_cost_date ON explanations(created_at, estimated_cost, model_name) WHERE estimated_cost IS NOT NULL;

-- Multi-test puzzle analytics
CREATE INDEX idx_explanations_multitest ON explanations(has_multiple_predictions, multi_test_all_correct) WHERE has_multiple_predictions = true;
```

## Critical Architectural Lessons (September 2025)

### What Went Wrong: SRP Violations
- TrustworthinessRepository was calculating cost metrics (mixed domains)
- Multiple repositories had duplicate model normalization logic
- Same models showed different values in different UI components

### What Was Fixed: Domain Separation
- Created dedicated CostRepository for all cost calculations
- Centralized model normalization in shared utility
- Eliminated duplicate business logic across repositories
- All UI components now show consistent data for same models

### Prevention Guidelines for Future Development

#### ✅ DO:
1. **Identify the domain** before adding new metrics (accuracy, trustworthiness, cost, performance, etc.)
2. **Add logic to appropriate repository** - don't mix unrelated domains
3. **Use delegation pattern** when multiple repositories needed (like MetricsRepository)
4. **Reuse existing utilities** like model normalization
5. **Add database indexes** for new analytics queries

#### ❌ DON'T:
1. **Mix domains** - don't add cost logic to TrustworthinessRepository
2. **Duplicate business logic** - reuse existing calculation methods
3. **Skip normalization** - always normalize model names consistently
4. **Create inconsistent APIs** - maintain data consistency across endpoints
5. **Forget indexes** - analytics queries need proper database optimization

## Adding New Metrics: Step-by-Step Guide

### 1. Identify the Domain
- **Accuracy**: Boolean puzzle correctness → AccuracyRepository
- **Trustworthiness**: AI confidence reliability → TrustworthinessRepository
- **Cost**: Financial metrics → CostRepository
- **Performance**: Speed/efficiency → New dedicated repository
- **Cross-Domain**: Aggregated metrics → MetricsRepository delegation

### 2. Implement Repository Logic
```typescript
// Add method to appropriate domain repository
async getNewMetricStats(): Promise<NewMetricStats> {
  const query = `
    SELECT
      ${MODEL_NAME_NORMALIZATION_SQL},  -- Use shared normalization
      COUNT(*) as attempts,
      AVG(new_metric_field) as avg_metric
    FROM explanations
    WHERE new_metric_field IS NOT NULL
    GROUP BY normalized_model_name
    HAVING COUNT(*) >= ${ANALYSIS_CRITERIA.BASIC_STATISTICS.minAttempts}
  `;

  return this.processResults(await this.query(query));
}
```

### 3. Add Database Indexes
```sql
CREATE INDEX idx_explanations_new_metric ON explanations(model_name, new_metric_field) WHERE new_metric_field IS NOT NULL;
```

### 4. Create API Endpoint
```typescript
// In appropriate controller
async getNewMetricStats(req: Request, res: Response) {
  const stats = await repositoryService.appropriateDomain.getNewMetricStats();
  res.json(formatResponse.success(stats));
}
```

### 5. Update Frontend Integration
```typescript
// Create or update hook
export function useNewMetric() {
  return useQuery({
    queryKey: ['new-metric-stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/domain/new-metric-stats');
      return response.json();
    }
  });
}
```

### 6. Document in EXTERNAL_API.md
Update the external API documentation with the new endpoint, response format, and usage examples.

## Troubleshooting Common Issues

### Data Inconsistency Between UI Components
**Symptoms**: Same model shows different values in different parts of UI
**Cause**: Different components using different repositories with different business rules
**Solution**: Ensure all components use same data source or properly combined data from consistent repositories

### Performance Issues with Analytics Queries
**Symptoms**: Slow loading of leaderboards or statistics
**Cause**: Missing database indexes for analytics queries
**Solution**: Add appropriate indexes on frequently queried fields

### Model Names Not Grouping Properly
**Symptoms**: `claude-3.5-sonnet` and `claude-3.5-sonnet:beta` appearing as separate entries
**Cause**: Missing or inconsistent model name normalization
**Solution**: Use `normalizeModelName()` utility in all analytics queries

### Corrupted Statistics
**Symptoms**: Perfect scores with zero confidence, impossible values
**Cause**: Missing data validation filters in repository queries
**Solution**: Add appropriate WHERE clauses to filter corrupted data

---

This architecture enables maintainable, consistent, and performant analytics across the entire ARC Explainer application. The domain separation ensures that future developers can add new metrics without violating architectural principles or creating data inconsistencies.
