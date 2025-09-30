# External API Reference

This document describes the public APIs that external applications rely on. These endpoints provide access to puzzle data, AI model analysis, user feedback, and performance metrics.

**🔄 Recent Changes (Sept 2025):** All artificial API result limits have been removed or significantly increased to support external applications.

## Core Data Endpoints SUPER IMPORTANT!!

### Puzzle Management
- `GET /api/puzzle/list` - Get paginated list of all puzzles
  - **Query params**: `page`, `limit`, `source` (ARC1, ARC1-Eval, ARC2, ARC2-Eval)
  - **Response**: Paginated puzzle list with metadata
  - **Limits**: No artificial limits - returns all puzzles by default

- `GET /api/puzzle/overview` - Get puzzle statistics and overview
  - **Response**: Puzzle counts by source, difficulty distribution
  - **Limits**: No limits

- `GET /api/puzzle/task/:taskId` - Get specific puzzle data by ID  
  - **Params**: `taskId` (string) - Puzzle identifier
  - **Response**: Complete puzzle data with input/output grids
  - **Limits**: Single puzzle fetch - no limits

- `POST /api/puzzle/analyze/:taskId/:model` - Analyze puzzle with specific AI model
  - **Params**: `taskId` (string), `model` (string) - Model name
  - **Body**: Analysis configuration options (see Debate Mode below for debate-specific options)
  - **Response**: Analysis result with explanation and predictions
  - **Limits**: No limits
  - **Debate Mode**: Include `originalExplanation` and `customChallenge` in body to generate debate rebuttals

- `GET /api/puzzle/:puzzleId/has-explanation` - Check if puzzle has existing explanation
  - **Params**: `puzzleId` (string)
  - **Response**: Boolean indicating explanation existence
  - **Limits**: No limits

- `POST /api/puzzle/reinitialize` - Reinitialize puzzle database
  - **Admin endpoint**: Reloads all ARC puzzle data
  - **Limits**: No limits

### AI Model Analysis SUPER IMPORTANT!!
- `GET /api/models` - List all available AI models and providers
  - **Limits**: No limits

### Model Dataset Performance Analysis ✨ NEW! 
- `GET /api/model-dataset/datasets` - Get all available ARC datasets dynamically
  - **Response**: Array of `DatasetInfo` objects with `name`, `puzzleCount`, and `path`
  - **Discovery**: Automatically scans `data/` directory for JSON puzzle files
  - **Examples**: evaluation (400 puzzles), training (400 puzzles), evaluation2 (117 puzzles), etc.
  - **Limits**: No limits - returns all discovered datasets

- `GET /api/model-dataset/models` - Get all models that have attempted puzzles
  - **Response**: Array of model names from database `explanations` table
  - **Data Source**: Distinct `model_name` values with existing attempts
  - **Limits**: No limits - returns all models with database entries

- `GET /api/model-dataset/performance/:modelName/:datasetName` - Get model performance on specific dataset
  - **Params**: `modelName` (string), `datasetName` (string) - Any model and any dataset
  - **Response**: `ModelDatasetPerformance` with categorized puzzle results:
    - `solved[]`: Puzzle IDs where `is_prediction_correct = true OR multi_test_all_correct = true`
    - `failed[]`: Puzzle IDs attempted but incorrect
    - `notAttempted[]`: Puzzle IDs with no database entries for this model
    - `summary`: Counts and success rate percentage
  - **Query Logic**: Uses exact same logic as `puzzle-analysis.ts` script
  - **Dynamic**: Works with ANY model name and ANY dataset discovered from filesystem
  - **Limits**: No limits

DEPRECATED BATCH ENDPOINTS (never worked correctly):
- `POST /api/model/batch-analyze` - Start batch analysis across multiple puzzles
- `GET /api/model/batch-status/:sessionId` - Get batch analysis progress
- `POST /api/model/batch-control/:sessionId` - Control batch analysis (pause/resume/stop)
- `GET /api/model/batch-results/:sessionId` - Get batch analysis results
- `GET /api/model/batch-sessions` - Get all batch analysis sessions

### Explanation Management   SUPER IMPORTANT!!
- `GET /api/puzzle/:puzzleId/explanations` - Get all explanations for a puzzle
  - **Query params**: `correctness` (optional) - Filter by 'correct', 'incorrect', or 'all'
  - **Limits**: No limits - returns all explanations
  - **Use case**: ModelDebate page uses `?correctness=incorrect` to show only wrong answers for debate
- `GET /api/puzzle/:puzzleId/explanation` - Get single explanation for a puzzle
  - **Limits**: Single result - no limits
- `POST /api/puzzle/save-explained/:puzzleId` - Save AI-generated explanation
  - **Limits**: No limits

### Debate & Rebuttal Tracking  ✨ NEW! (September 2025)

#### Generate Debate Rebuttal
- `POST /api/puzzle/analyze/:taskId/:model` - Generate AI challenge to existing explanation
  - **Debate Mode Body**:
    ```json
    {
      "originalExplanation": {
        "id": 123,
        "modelName": "gpt-4o",
        "patternDescription": "...",
        "solvingStrategy": "...",
        "hints": ["..."],
        "confidence": 85,
        "isPredictionCorrect": false
      },
      "customChallenge": "Focus on edge cases in corners",
      "temperature": 0.2,
      "promptId": "debate"
    }
    ```
  - **Response**: New explanation with `rebuttingExplanationId` set to original explanation's ID
  - **Use case**: AI-vs-AI debate where one model critiques another's reasoning
  - **Database**: Stores relationship in `rebutting_explanation_id` column

#### Query Debate Chains
- `GET /api/explanations/:id/chain` - Get full rebuttal chain for an explanation
  - **Params**: `id` (number) - Explanation ID to get debate chain for
  - **Response**: Array of `ExplanationData` objects in chronological order (original → rebuttals)
  - **Use case**: Display complete debate thread showing which AIs challenged which
  - **Database**: Uses recursive CTE query to walk rebuttal relationships
  - **Limits**: No limits - returns entire chain regardless of depth
  - **Example Response**:
    ```json
    {
      "success": true,
      "data": [
        { "id": 100, "modelName": "gpt-4o", "rebuttingExplanationId": null },
        { "id": 101, "modelName": "claude-3.5-sonnet", "rebuttingExplanationId": 100 },
        { "id": 102, "modelName": "gemini-2.5-pro", "rebuttingExplanationId": 101 }
      ]
    }
    ```

- `GET /api/explanations/:id/original` - Get parent explanation that a rebuttal is challenging
  - **Params**: `id` (number) - Rebuttal explanation ID
  - **Response**: Single `ExplanationData` object or 404 if not a rebuttal
  - **Use case**: Navigate from challenge back to original explanation
  - **Database**: Joins on `rebutting_explanation_id` foreign key
  - **Returns 404**: If explanation is not a rebuttal or parent doesn't exist

### User Feedback  VERY IMPORTANT!!
- `POST /api/feedback` - Submit user feedback on explanations
  - **Limits**: No limits
- `GET /api/explanation/:explanationId/feedback` - Get feedback for specific explanation
  - **Limits**: No limits
- `GET /api/puzzle/:puzzleId/feedback` - Get all feedback for a puzzle
  - **Limits**: No limits
- `GET /api/feedback` - Get all feedback with optional filtering
  - **Query params**: `limit` (max 10000, increased from 1000), `offset`, filters
  - **Limits**: Maximum 10000 results per request (previously 1000)
- `GET /api/feedback/stats` - Get feedback summary statistics
  - **Limits**: No limits

## Analytics and Metrics Endpoints  SUPER IMPORTANT!!

### Performance Statistics SUPER IMPORTANT!!

#### Accuracy Statistics
- `GET /api/feedback/accuracy-stats` - **Primary accuracy endpoint** - Pure puzzle-solving accuracy statistics
  - **Response**: `PureAccuracyStats` with `modelAccuracyRankings[]` (used by AccuracyLeaderboard)
  - **Sort Order**: Ascending by accuracy (worst performers first - "Models Needing Improvement")
  - **Data Source**: `is_prediction_correct` and `multi_test_all_correct` boolean fields only
  - **🔄 CHANGED**: No longer limited to 10 results - returns ALL models with stats

#### Trustworthiness Statistics  
- `GET /api/puzzle/performance-stats` - Trustworthiness and confidence reliability metrics
  - **Response**: `PerformanceLeaderboards` with `trustworthinessLeaders[]`, `speedLeaders[]`, `efficiencyLeaders[]`
  - **Data Source**: `trustworthiness_score` field (AI confidence reliability)
  - **🔄 CHANGED**: No longer limited to 10 results - returns ALL models with stats

#### Combined Analytics
- `GET /api/puzzle/accuracy-stats` - **DEPRECATED** - Mixed accuracy/trustworthiness data
  - **Warning**: Despite name, contains trustworthiness-filtered results
- `GET /api/puzzle/general-stats` - General model statistics (mixed data from MetricsRepository)
- `GET /api/puzzle/raw-stats` - Infrastructure and database performance metrics
- `GET /api/metrics/comprehensive-dashboard` - Combined analytics dashboard from all repositories

#### Cost Statistics **NEW - September 2025**
**🚨 CRITICAL**: Cost calculations completely refactored for proper domain separation. All cost endpoints now use dedicated CostRepository following SRP principles.

- `GET /api/metrics/costs/models` - Get cost summaries for all models
  - **Response**: Array of `ModelCostSummary` objects with normalized model names
  - **Data**: Total cost, average cost, attempts, min/max costs per model
  - **Business Rules**: Uses consistent model name normalization (removes :free, :beta, :alpha suffixes)
  - **Limits**: No limits - returns all models with cost data

- `GET /api/metrics/costs/models/:modelName` - Get detailed cost summary for specific model
  - **Params**: `modelName` (normalized automatically - "claude-3.5-sonnet" matches "claude-3.5-sonnet:beta")
  - **Response**: Single `ModelCostSummary` object
  - **Limits**: Single model result

- `GET /api/metrics/costs/models/:modelName/trends?days=30` - Get cost trends over time for model
  - **Query params**: `days` (1-365, default: 30) - Time range for trend analysis
  - **Response**: Array of `CostTrend` objects with daily cost data
  - **Use case**: Cost optimization and pattern analysis
  - **Limits**: Maximum 365 days of historical data

- `GET /api/metrics/costs/system/stats` - Get system-wide cost statistics
  - **Response**: Total system cost, total requests, average cost per request, unique models, cost-bearing requests
  - **Use case**: Financial reporting and system cost analysis
  - **Limits**: System-wide aggregated data only

- `GET /api/metrics/costs/models/map` - Get cost map for cross-repository integration
  - **Response**: Object with modelName → {totalCost, avgCost, attempts} mapping
  - **Use case**: Internal cross-repository data integration (used by MetricsRepository)
  - **Limits**: No limits

**🔄 Data Consistency**: All cost endpoints now return identical values for the same model (eliminated previous inconsistencies between UI components).

**⚙️ Performance**: Cost queries optimized with database indexes on `(model_name, estimated_cost)` and `(created_at, estimated_cost, model_name)`.

### Model Analysis
- `GET /api/puzzle/confidence-stats` - Model confidence analysis
  - **Limits**: No limits
- `GET /api/puzzle/worst-performing` - Identify problematic puzzles
  - **Query params**: `limit` (max 500, increased from 50), `sortBy`, accuracy filters
  - **🔄 CHANGED**: Maximum limit increased from 50 to 500 results

### Solution Submission (Community Features)
- `GET /api/puzzles/:puzzleId/solutions` - Get community solutions for puzzle
- `POST /api/puzzles/:puzzleId/solutions` - Submit community solution
- `POST /api/solutions/:solutionId/vote` - Vote on community solutions
- `GET /api/solutions/:solutionId/votes` - Get solution vote counts

### Prompt Management
- `GET /api/prompts` - Get available prompt templates
- `POST /api/prompt-preview` - Preview AI prompt before analysis
- `POST /api/prompt/preview/:provider/:taskId` - Preview prompt for specific provider

## Administrative Endpoints

### Health and Recovery
- `GET /api/health/database` - Database connection status
- `GET /api/admin/recovery-stats` - Data recovery statistics
- `POST /api/admin/recover-multiple-predictions` - Recover missing prediction data

### Validation
- `POST /api/puzzle/validate` - Validate puzzle data structure

## 🔄 Major Changes for External Applications

### Removed Limits
- **Analytics endpoints**: No longer return only top 10 results
- **Performance stats**: All trustworthiness, speed, and efficiency data returned
- **Accuracy rankings**: Complete model accuracy data available

### Increased Limits
- **Feedback endpoint**: Maximum limit increased from 1000 to 10000 results
- **Worst-performing puzzles**: Maximum limit increased from 50 to 500 results
- **Batch results**: Configurable limits up to 10000 results

### No Change (Already Unlimited)
- **Puzzle list**: Returns all puzzles without pagination by default
- **Individual puzzle data**: No limits on single puzzle fetches
- **Model listings**: No limits on available models

## Response Format

All API endpoints return JSON responses in this format:

```json
{
  "success": true,
  "data": { /* response data */ },
  "message": "Operation completed successfully",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error description",
  "details": "Additional error information",
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

## Data Models and Examples

### Key Response Interfaces  USE THESE!!!

#### PureAccuracyStats (from `/api/feedback/accuracy-stats`)
```typescript
interface PureAccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number; 
  overallAccuracyPercentage: number;
  modelAccuracyRankings: ModelAccuracyRanking[]; // Now returns ALL models, not just 10
}

interface ModelAccuracyRanking {
  modelName: string;
  totalAttempts: number;
  correctPredictions: number;
  accuracyPercent age: number;
  singleTestAttempts: number;
  singleCorrectPredictions: number;
  singleTestAccuracy: number;
  multiTestAttempts: number; 
  multiCorrectPredictions: number;
  multiTestAccuracy: number;
}
```

#### PerformanceLeaderboards (from `/api/puzzle/performance-stats`)
```typescript
interface PerformanceLeaderboards {
  trustworthinessLeaders: Array<{ // Now returns ALL models, not just 10
    modelName: string;
    avgTrustworthiness: number;
    avgConfidence: number;
    avgProcessingTime: number;
    avgCost: number;
    totalCost: number;
  }>;
  speedLeaders: Array<{ // Now returns ALL models, not just 10
    modelName: string;
    avgProcessingTime: number;
    totalAttempts: number;
    avgTrustworthiness: number;
  }>;
  efficiencyLeaders: Array<{ // Now returns ALL models, not just 10
    modelName: string;
    costEfficiency: number;
    tokenEfficiency: number;
    avgTrustworthiness: number;
    totalAttempts: number;
  }>;
  overallTrustworthiness: number;
}
```

#### FeedbackStats (from `/api/feedback/stats`)
```typescript
interface FeedbackStats {
  totalFeedback: number;
  helpfulPercentage: number;
  topModels: Array<{
    modelName: string;
    feedbackCount: number;
    helpfulCount: number;
    notHelpfulCount: number;
    helpfulPercentage: number;
  }>;
  feedbackByModel: Record<string, {
    helpful: number;
    notHelpful: number;
  }>;
}
```

## Authentication

Currently no authentication required. All endpoints are publicly accessible.

## Rate Limiting

No explicit rate limiting implemented. Consider implementing for production use with external integrations.

## WebSocket Integration

The Saturn Visual Solver provides real-time updates via WebSockets:

- Connection endpoint: `ws://localhost:5000`
- Event types: `progress`, `image-update`, `completion`, `error`
- Session-based communication using `sessionId`

## Important Notes for External Applications

- **Complete Data Access**: Analytics endpoints now return complete datasets instead of arbitrary top-10 limits
- **Higher Limits**: Feedback and batch endpoints support much larger result sets
- **Backward Compatibility**: All existing query parameters continue to work
- **Performance**: Database queries have been optimized to handle larger result sets efficiently
- **Database Dependency**: Most endpoints require PostgreSQL connection. Fall back to in-memory mode if unavailable
- **Token Tracking**: API calls with AI models consume tokens and incur costs tracked in the database

## Real-time and Advanced Features

### Saturn Visual Solver   Largely deprecated!!
- `POST /api/saturn/analyze/:taskId` - Analyze puzzle with Saturn visual solver
- `POST /api/saturn/analyze-with-reasoning/:taskId` - Saturn analysis with reasoning steps
- `GET /api/saturn/status/:sessionId` - Get Saturn analysis progress
- **WebSocket**: Real-time Saturn solver progress updates
