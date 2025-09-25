<!--
  Analysis_Data_Flow_Trace.md
  What: A step-by-step trace of the data flow for puzzle analysis.
  How: Explains the process from a user click to the result display.
  Author: Cascade
  Last Updated: August 24, 2025
-->

# Analysis Data Flow Trace

*Last Updated: August 23, 2025*

> **Note:** For recent changes, see the [Changelog](../Changelog.md#august-23-2025) for details on the multi-output prediction support added on this date.

This document provides a detailed, step-by-step trace of the data flow that occurs when a user initiates a puzzle analysis in the ARC Explainer application. Understanding this flow is key to debugging and extending the application's capabilities.

## The Big Picture

The process follows a "database-first" architecture. The frontend UI doesn't display results directly from the AI. Instead, it triggers a backend process, waits for the results to be saved to the database, and then re-fetches the data from the database to update the display. 

```
Frontend (Browser)         Backend (Server)              External AI (e.g., OpenAI)
+----------------+         +-------------------+           +------------------------+
| 1. User Clicks | ------> | 2. API Request    |           |                        |
|   'Analyze'    |         |    Arrives        |           |                        |
|                |         |                   |           |                        |
|                |         | 3. Build Prompt   |           |                        |
|                |         |                   |           |                        |
|                |         | 4. Call AI API    | --------> | 5. Process & Respond   |
|                |         |                   | <-------- |                        |
|                |         |                   |           |                        |
|                |         | 6. Validate & Save|           |                        |
|                |         |    to Database    |           |                        |
|                |         |                   |           |                        |
| 8. Refetch &   | <------ | 7. Send Success   |           |                        |
|    Update UI   |         |    Response       |           |                        |
+----------------+         +-------------------+           +------------------------+
```

## Step-by-Step Data Flow

The process is broken down into two main parts: the Frontend (what happens in the user's browser) and the Backend (what happens on our server).

### Part 1: The Frontend (User's Browser)

1.  **User Clicks "Analyze"**
    *   **Where**: `PuzzleExaminer.tsx` page.
    *   **What**: The user clicks a `ModelButton` component for a specific AI model.
    *   **Action**: This triggers the `onAnalyze` function that was passed to the button.

2.  **The `useAnalysisResults` Hook Takes Over**
    *   **Where**: `client/src/hooks/useAnalysisResults.ts`.
    *   **What**: The `onAnalyze` function belongs to this hook. It immediately sets an `isAnalyzing` state for that model to `true`.
    *   **Action**: The UI reacts, disabling the button and showing a loading spinner to provide feedback to the user.

3.  **API Request to the Backend**
    *   **What**: The hook calls `analyzePuzzleWithModel`, which uses the browser's `fetch` API to send a `POST` request to the server.
    *   **Endpoint**: `/api/puzzle/analyze`.
    *   **Payload**: The request body contains the `puzzleId`, the selected `modelKey`, and any advanced parameters like `temperature`.

4.  **UI Waits for the Result**
    *   **What**: The frontend now waits asynchronously for the backend to complete the entire analysis and database-saving process.

5.  **UI Refreshes with New Data**
    *   **What**: Once the backend sends a success response, the `useAnalysisResults` hook calls the `refetchExplanations` function (from the `useExplanation` hook).
    *   **Action**: This triggers another API call (`GET /api/explanations/:puzzleId`) to fetch a fresh, complete list of all explanations for the puzzle directly from the database.
    *   **Result**: React detects the updated list of explanations, re-renders the component, and the new `AnalysisResultCard` appears on the screen.

### Part 2: The Backend (The Server)

1.  **API Request Arrives**
    *   **Where**: `server/routes.ts` and `server/controllers/puzzleController.ts`.
    *   **What**: The server's router maps the `/api/puzzle/analyze` endpoint to the `analyzePuzzle` function in the `puzzleController`.

2.  **The `puzzleController` Gets to Work**
    *   **What**: The controller orchestrates the entire backend process. It first fetches the complete puzzle data from the local file system using the `puzzleService`.

3.  **Building the Prompt**
    *   **Where**: `server/services/promptBuilder.ts`.
    *   **What**: The controller calls the `promptBuilder` to construct the precise prompt to be sent to the AI. This includes formatting the puzzle grids, adding instructions, and incorporating any selected prompt templates.

4.  **Calling the AI Model**
    *   **Where**: `server/services/openai.ts` (or other provider services).
    *   **What**: The controller determines the correct AI provider based on the `modelKey` and calls its `analyzePuzzleWithModel` function. This service is responsible for making the actual API call to the external AI provider (e.g., OpenAI's API).
    *   **Model Configuration**: All AI model configurations are now centralized in `server/config/models.ts` which provides:
        - Single source of truth for model capabilities (temperature support, reasoning support)
        - Helper functions: `getModelConfig()`, `modelSupportsTemperature()`, `modelSupportsReasoning()`
        - API model name mapping via `getApiModelName()`
        - Eliminates scattered hardcoded model lists across codebase

5.  **Validating the AI's Answer**
    *   **Where**: `server/services/responseValidator.ts`.
    *   **What**: After the AI model responds, its output is passed to the `responseValidator`. This service extracts the predicted grid(s) from the JSON response and compares them to the actual correct output grids from the puzzle file. It calculates correctness and accuracy scores.

6.  **Validate & Save**
    *   **Where**: `puzzleController.ts` calls validation services and then `explanationService.saveExplanation`.
    *   **What**: The AI response is validated and then saved to the database.

    **Detailed Step 6 Process:**

    6a. **Response Validation** - The controller determines whether this is a single-test or multi-test puzzle:
        - For **single test cases**: Calls `validateSolverResponse()` which extracts the predicted grid from the AI response and validates it against the expected output.
        - For **multi-test cases**: Calls `validateSolverResponseMulti()` which:
          - Extracts multiple predicted grids using the new `multiplePredictedOutputs` format
          - Validates each prediction against its corresponding expected output  
          - Returns aggregated results including accuracy scores and correctness flags

    6b. **Field Mapping** - The controller maps validation results to database-compatible field names:
        - `multi.predictedGrids` → `result.multiplePredictedOutputs`
        - `multi.itemResults` → `result.multiTestResults` 
        - `multi.allCorrect` → `result.multiTestAllCorrect`
        - `multi.averageAccuracyScore` → `result.multiTestAverageAccuracy`

    6c. **Database Persistence** - `explanationService.saveExplanation()` calls `dbService.saveExplanation()` which:
        - Inserts the explanation into the `explanations` table
        - For multi-output cases, stores additional columns:
          - `multiple_predicted_outputs` (JSONB) - Array of predicted grids
          - `multi_test_results` (JSONB) - Detailed validation results for each test case
          - `multi_test_all_correct` (BOOLEAN) - Whether all predictions were correct
          - `multi_test_average_accuracy` (FLOAT) - Average accuracy across all test cases
    *   **Where**: `server/services/dbService.ts`.
    *   **What**: The controller takes the full, validated result—including the AI's text explanation, the predicted grids, correctness flags, and performance scores—and calls `dbService.saveExplanation`.
    *   **Action**: This service function inserts a new record into the `explanations` table in the PostgreSQL database.

7.  **Sending Success Back to Frontend**
    *   **What**: Once the database write is successful, the controller sends a success status (e.g., `200 OK`) back to the frontend.
    *   **Action**: This response signals to the frontend that the process is complete, which triggers the data refetching step (Part 1, Step 5).

## Analytics Data Flow: From Explanations to Statistics

*Added September 24, 2025*

Once analysis results are saved to the `explanations` table, they become the foundation for all statistics and leaderboards shown throughout the application. This section traces how raw analysis data becomes the analytics users see.

### The Analytics Pipeline Architecture

```
explanations table (raw data)
         ↓
Domain-Specific Repositories (extract & calculate metrics)
         ↓
API Controllers (serve statistics)
         ↓
Frontend Hooks (fetch & cache statistics)
         ↓
UI Components (display leaderboards & comparisons)
```

### Step 1: Repository Layer Calculates Statistics

**Where**: `server/repositories/` - AccuracyRepository, TrustworthinessRepository, CostRepository, etc.

**What Happens**:
Each repository is responsible for ONE domain of analytics:

- **AccuracyRepository**: Calculates pure puzzle-solving correctness from `is_prediction_correct` and `multi_test_all_correct` fields
- **TrustworthinessRepository**: Analyzes AI confidence reliability using `confidence` vs `prediction_accuracy_score` correlation
- **CostRepository**: Aggregates financial costs from `estimated_cost` field
- **MetricsRepository**: Combines data from multiple repositories using delegation pattern

**Critical Business Logic Examples**:
```sql
-- Accuracy calculation (AccuracyRepository)
SELECT
  COUNT(CASE WHEN is_prediction_correct = true THEN 1 END) * 100.0 / COUNT(*) as accuracy_percentage
FROM explanations
WHERE predicted_output_grid IS NOT NULL

-- Trustworthiness calculation (TrustworthinessRepository)
SELECT
  AVG(prediction_accuracy_score) as trustworthiness_score,
  AVG(confidence) as avg_confidence
FROM explanations
WHERE trustworthiness_score IS NOT NULL AND confidence IS NOT NULL
```

### Step 2: API Endpoints Serve Statistics

**Where**: `server/controllers/puzzleController.ts`, `costController.ts`, etc.

**Key Analytics Endpoints**:
- `/api/feedback/accuracy-stats` → AccuracyRepository directly
- `/api/puzzle/performance-stats` → TrustworthinessRepository + CostRepository combination
- `/api/metrics/comprehensive-dashboard` → MetricsRepository delegation to multiple repositories

**Example - Combined Statistics API**:
```typescript
// puzzleController.ts - combines trustworthiness + cost data
async getRealPerformanceStats(req: Request, res: Response) {
  const trustworthinessStats = await repositoryService.trustworthiness.getRealPerformanceStats();
  const costMap = await repositoryService.cost.getModelCostMap();

  // Combine data to maintain API contract
  const combinedStats = {
    ...trustworthinessStats,
    trustworthinessLeaders: trustworthinessStats.trustworthinessLeaders.map(leader => ({
      ...leader,
      avgCost: costMap[leader.modelName]?.avgCost || 0,
      totalCost: costMap[leader.modelName]?.totalCost || 0
    }))
  };

  res.json(combinedStats);
}
```

### Step 3: Frontend Hooks Fetch & Cache Statistics

**Where**: `client/src/hooks/` - useModelLeaderboards, useModelComparisons, usePerformanceInsights

**What Happens**:
React Query hooks fetch statistics from API endpoints and provide caching, loading states, and error handling.

**Example Hook**:
```typescript
// useModelLeaderboards.ts
export function useModelLeaderboards() {
  return useQuery({
    queryKey: ['performance-stats-leaderboards'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/puzzle/performance-stats');
      return response.json().data as PerformanceLeaderboards;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
```

### Step 4: UI Components Display Statistics

**Where**: `client/src/components/` - TrustworthinessLeaderboard, ModelComparisonMatrix, AccuracyLeaderboard

**What Happens**:
Components consume hooks to display statistics with loading states, error handling, and user interactions.

**Data Flow Example - TrustworthinessLeaderboard**:
1. Component calls `useModelLeaderboards()` hook
2. Hook fetches from `/api/puzzle/performance-stats`
3. Controller combines TrustworthinessRepository + CostRepository data
4. Repositories query `explanations` table with domain-specific logic
5. Results flow back through the chain to component
6. Component renders leaderboard with model rankings

### Step 5: Model Name Normalization (Critical)

**Problem**: Same model appears with different suffixes:
- `claude-3.5-sonnet`
- `claude-3.5-sonnet:beta`
- `claude-3.5-sonnet:free`

**Solution**: All repositories use `utils/modelNormalizer.ts` for consistent grouping:
```typescript
// Before normalization: 3 separate entries
// After normalization: 1 combined entry with aggregated statistics
```

**Impact**: Ensures statistics are properly aggregated per model, not fragmented by version suffixes.

### Database Performance for Analytics

**Indexes for Statistics Queries** (added September 2025):
```sql
-- Model-based analytics performance
CREATE INDEX idx_explanations_model_accuracy ON explanations(model_name, is_prediction_correct);
CREATE INDEX idx_explanations_trustworthiness ON explanations(model_name, trustworthiness_score) WHERE trustworthiness_score IS NOT NULL;
CREATE INDEX idx_explanations_cost_model ON explanations(model_name, estimated_cost) WHERE estimated_cost IS NOT NULL;
```

These indexes dramatically improve performance of leaderboard and statistics queries by enabling efficient model-grouped aggregations.

## Repository Architecture Principles (September 2025 Refactor)

### Single Responsibility Principle (SRP)
Each repository handles exactly one domain:
- **AccuracyRepository** → Pure puzzle correctness only
- **TrustworthinessRepository** → AI confidence reliability only
- **CostRepository** → Financial cost calculations only
- **MetricsRepository** → Cross-domain aggregation via delegation

### DRY (Don't Repeat Yourself)
- Model name normalization: Shared `utils/modelNormalizer.ts`
- No duplicate business logic across repositories
- Cross-repository data access via delegation pattern

### Domain Separation
- **WRONG**: TrustworthinessRepository calculating costs (mixing unrelated domains)
- **RIGHT**: TrustworthinessRepository → trustworthiness, CostRepository → costs

This architecture ensures maintainable, consistent analytics across the entire application.

## Conclusion

This dual data flow - analysis creation AND analytics generation - ensures complete data integrity. The database serves as the single source of truth for both individual analysis results and aggregated statistics. By maintaining proper domain separation in the repository layer, we guarantee that statistics are calculated consistently and displayed accurately across all UI components.
