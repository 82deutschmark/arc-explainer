# External API Reference

This document describes the public APIs that external applications rely on. These endpoints provide access to puzzle data, AI model analysis, user feedback, and performance metrics.

**🔄 Recent Changes (Sept 2025):** All artificial API result limits have been removed or significantly increased to support external applications.

## 🚀 NEW: ARC API Client for Python Researchers

**Simple Python client for contributing analyses to ARC Explainer encyclopedia.**

### Installation & Usage
```bash
# Copy to your project
cp tools/api-client/arc_client.py your_project/
```

```python
from arc_client import contribute_to_arc_explainer

# One-line contribution to encyclopedia
result = contribute_to_arc_explainer(
    "3a25b0d8", analysis_result, "grok-4-2025-10-13",
    "https://arc-explainer-staging.up.railway.app", "your-api-key"
)
```

**Features:**
- ✅ One-line integration for any Python researcher
- ✅ Current October 2025 model names (no deprecated models)
- ✅ Uses existing `POST /api/puzzle/save-explained/:puzzleId` endpoint
- ✅ Model-specific functions: `contribute_grok4_analysis()`, `contribute_gpt5_analysis()`
- ✅ Batch processing for multiple puzzles
- ✅ Zero external dependencies (only `requests`)

**Complete Documentation:** `tools/api-client/README.md`

---

## Authentication

**NEW (Oct 2025):** API key authentication now available for contribution endpoints.

### API Key Authentication
Some endpoints now require API key authentication via `Authorization: Bearer <api-key>` header.

**Available API Keys:**
- `arc-explainer-public-key-2025` - Public access key for researchers
- `researcher-access-key-001` - Researcher access key
- `demo-api-key-for-researchers` - Demo key for testing

**Environment Variables:**
- `ARC_EXPLAINER_API_KEY` - Master API key (set in `.env`)
- `PUBLIC_API_KEYS` - Comma-separated list of additional valid keys

**Endpoints Requiring Authentication:**
- `POST /api/puzzle/save-explained/:puzzleId` - Save AI-generated explanation
- `POST /api/feedback` - Submit user feedback
- `POST /api/puzzles/:puzzleId/solutions` - Submit community solution
- `POST /api/solutions/:solutionId/vote` - Vote on community solutions

**Endpoints Open (No Authentication Required):**
- `GET /api/puzzle/list` - Get puzzle list
- `GET /api/puzzle/task/:taskId` - Get puzzle data
- `GET /api/puzzle/:puzzleId/explanations` - Get explanations
- `GET /api/models` - List available models
- `GET /api/metrics/*` - Performance statistics
- All analytics and read-only endpoints

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
  - **Body**: Analysis configuration options (see Debate Mode below for debate-specific options). For conversation chaining via the Responses API, include `previousResponseId` to continue a prior analysis.
  - **Response**: Analysis result with explanation and predictions
  - **Limits**: No limits
  - **Debate Mode**: Include `originalExplanation` and `customChallenge` in body to generate debate rebuttals
- `GET /api/stream/analyze/:taskId/:modelKey` - Start Server-Sent Events stream for token-by-token analysis
  - **Params**: `taskId` (string), `modelKey` (string) - Model name
  - **Query**: Accepts same analysis options as the POST endpoint (`temperature`, `promptId`, `omitAnswer`, `reasoningEffort`, etc.)
  - **Response**: SSE channel emitting `stream.init`, `stream.chunk`, `stream.status`, `stream.complete`, `stream.error`
  - **Notes**: Enabled when `ENABLE_SSE_STREAMING=true`; currently implemented for GPT-5 mini/nano and Grok-4(-Fast) models
  - **Client**: New `createAnalysisStream` utility in `client/src/lib/streaming/analysisStream.ts` provides a typed wrapper

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

### Conversation Chaining (Responses API) ✨ NEW! (October 2025)

Multi-turn conversations with full context retention using provider-native conversation chaining.

#### How It Works
1. Each AI analysis returns a `providerResponseId` in the response
2. Pass `previousResponseId` in the next analysis request to maintain context
3. Provider automatically retrieves ALL previous reasoning and responses (server-side)
4. No token cost for accessing previous reasoning (30-day retention)

#### Supported Providers
- **OpenAI**: o-series models (o3, o4, o4-mini) and GPT-5
- **xAI**: Grok-4 models
- **Provider Compatibility**: Response IDs only work within the same provider
  - OpenAI ID → OpenAI models ✅
  - xAI ID → xAI models ✅  
  - Cross-provider chaining ❌ (will start new conversation)

#### API Usage
```typescript
// Request 1: Initial analysis
POST /api/puzzle/analyze/00d62c1b/openai%2Fo4-mini
Body: { "promptId": "solver" }
Response: { "providerResponseId": "resp_abc123", ... }

// Request 2: Follow-up with full context
POST /api/puzzle/analyze/00d62c1b/openai%2Fo4-mini
Body: { 
  "promptId": "solver",
  "previousResponseId": "resp_abc123"  // Maintains context
}
Response: { "providerResponseId": "resp_def456", ... }
```

#### Database Storage
- **Column**: `provider_response_id` (text) in `explanations` table
- **Frontend Field**: `providerResponseId` in `ExplanationData` type
- **Mapping**: Automatically handled by `useExplanation` hook

#### Get Eligible Explanations for Discussion
- `GET /api/discussion/eligible` - Get recent explanations eligible for conversation chaining
  - **Query params**: `limit` (default 20), `offset` (default 0)
  - **Eligibility Criteria**:
    - Has `provider_response_id` in database
    - Created within last 30 days (provider retention window)
    - **NO model type restrictions** - any model with response ID is eligible
  - **Response**: Array of eligible explanations with metadata
    ```json
    {
      "explanations": [
        {
          "id": 29432,
          "puzzleId": "e8dc4411",
          "modelName": "openai/o4-mini",
          "provider": "openai",
          "createdAt": "2025-10-06T12:00:00Z",
          "daysOld": 3,
          "hasProviderResponseId": true,
          "confidence": 85,
          "isCorrect": true
        }
      ],
      "total": 1,
      "limit": 20,
      "offset": 0
    }
    ```
  - **Use case**: PuzzleDiscussion landing page shows recent eligible analyses
  - **Limits**: Server-side pagination with configurable limit

#### Documentation
- `docs/API_Conversation_Chaining.md` - Complete usage guide
- `docs/Responses_API_Chain_Storage_Analysis.md` - Technical implementation details

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

**🚨 CRITICAL CHANGE (Sept 30, 2025):** Solver accuracy and debate accuracy are now tracked separately to prevent data pollution.

- `GET /api/feedback/accuracy-stats` - **Primary solver accuracy endpoint** - Pure 1-shot puzzle-solving accuracy
  - **Response**: `PureAccuracyStats` with `modelAccuracyRankings[]` (used by AccuracyLeaderboard)
  - **Sort Order**: Ascending by accuracy (worst performers first - "Models Needing Improvement")
  - **Data Source**: `is_prediction_correct` and `multi_test_all_correct` boolean fields only
  - **Filtering**: `WHERE rebutting_explanation_id IS NULL` - **EXCLUDES debate rebuttals**
  - **Use Case**: Fair apples-to-apples model comparison for pure puzzle solving (no contextual advantage)
  - **🔄 CHANGED**: No longer limited to 10 results - returns ALL models with stats

- `GET /api/feedback/debate-accuracy-stats` - **Debate challenger accuracy** - Success rate for AI challenges/rebuttals
  - **Response**: `PureAccuracyStats` with `modelAccuracyRankings[]` (same structure as solver accuracy)
  - **Sort Order**: Descending by accuracy (best performers first - "Top Debate Challengers")
  - **Data Source**: `is_prediction_correct` and `multi_test_all_correct` boolean fields only
  - **Filtering**: `WHERE rebutting_explanation_id IS NOT NULL` - **ONLY debate rebuttals**
  - **Use Case**: Identify which models excel at challenging/critiquing incorrect explanations
  - **Research Value**: Compare solver vs. critique capabilities across models

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

### Model Comparison & Analysis ✨

#### Model-to-Model Comparison
- `GET /api/metrics/compare` - Compare specific models on a dataset
  - **Query params**: `model1` (required), `model2` (required), `model3` (optional), `model4` (optional), `dataset` (required)
  - **Response**: `ModelComparisonResult` with detailed puzzle-by-puzzle comparison
  - **Data Structure**:
    ```typescript
    {
      summary: {
        totalPuzzles: number;
        model1Name: string;
        model2Name: string;
        model3Name?: string;
        model4Name?: string;
        dataset: string;
        allCorrect: number;        // All models got it right
        allIncorrect: number;      // All models got it wrong
        allNotAttempted: number;   // No model tried
        threeCorrect?: number;     // Exactly 3 correct (4-model comparison)
        twoCorrect?: number;       // Exactly 2 correct
        oneCorrect?: number;       // Exactly 1 correct
        model1OnlyCorrect: number; // Only model 1 correct
        model2OnlyCorrect: number; // Only model 2 correct
        model3OnlyCorrect?: number;
        model4OnlyCorrect?: number;
      },
      details: PuzzleComparisonDetail[];  // Per-puzzle results
    }
    ```
  - **Use Case**: Head-to-head model performance comparison on specific datasets
  - **Example**: `/api/metrics/compare?model1=gpt-5-pro&model2=grok-4&dataset=evaluation2`
  - **Limits**: Up to 4 models simultaneously, any dataset from data/ directory

- `POST /api/puzzle/analyze-list` - Analyze specific puzzles across ALL models
  - **Body**: `{ puzzleIds: string[] }` - Array of puzzle IDs (max 500)
  - **Response**: `PuzzleListAnalysisResponse` with model-puzzle matrix
  - **Data Structure**:
    ```typescript
    {
      modelPuzzleMatrix: Array<{
        modelName: string;
        puzzleStatuses: Array<{
          puzzleId: string;
          status: 'correct' | 'incorrect' | 'not_attempted';
        }>;
      }>;
      puzzleResults: Array<{
        puzzle_id: string;
        correct_models: string[];
        total_attempts: number;
      }>;
      summary: {
        totalPuzzles: number;
        totalModels: number;
        perfectModels: number;      // Got ALL puzzles correct
        partialModels: number;      // Got some correct, some wrong
        notAttemptedModels: number; // Never tried any
      };
    }
    ```
  - **Use Case**: Check which models solved specific user-selected puzzles (inverse of model comparison)
  - **Limits**: Max 500 puzzle IDs per request

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

## Conversation Chaining (Responses API)

Multi‑turn conversations with provider‑managed context retention using response IDs.

- Each analysis returns `providerResponseId` in the payload
- Subsequent requests may include `previousResponseId` to continue the chain
- Supported: OpenAI o‑series/GPT‑5 and xAI Grok‑4 (same‑provider chains only)
- Retention typically 30 days (when `store: true`); new requests still consume tokens

Example request body:
```json
{
  "promptId": "solver",
  "temperature": 0.2,
  "previousResponseId": "resp_abc123"
}
```

Storage and indexing:
```sql
-- Stored on each explanation row
provider_response_id TEXT DEFAULT NULL;

-- Recommended indexes
CREATE INDEX IF NOT EXISTS idx_explanations_provider_response_id
  ON explanations(provider_response_id) WHERE provider_response_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_explanations_created_recent
  ON explanations(created_at DESC);
```

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
  accuracyPercentage: number;
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

## Admin Dashboard & Ingestion ✨ NEW! (October 2025)

### Admin Dashboard Stats
- `GET /api/admin/quick-stats` - Dashboard statistics
  - **Response**: `{ totalModels, totalExplanations, databaseConnected, lastIngestion, timestamp }`
  - **Use case**: Admin Hub homepage quick stats
  - **Limits**: No limits

- `GET /api/admin/recent-activity` - Recent ingestion activity
  - **Response**: Array of last 10 ingestion runs with stats
  - **Limits**: Fixed at 10 most recent runs

### HuggingFace Dataset Ingestion
- `POST /api/admin/validate-ingestion` - Pre-flight validation before ingestion
  - **Body**: `{ datasetName, baseUrl }`
  - **Response**: Validation result with checks (URL accessible, token present, DB connected, etc.)
  - **Use case**: Validate configuration before starting ingestion
  - **Limits**: No limits

- `POST /api/admin/start-ingestion` - Start HuggingFace dataset ingestion
  - **Body**: `{ datasetName, baseUrl, source, limit, delay, dryRun, forceOverwrite, verbose }`
  - **Response**: `{ success, message, config }` (202 Accepted - async operation)
  - **Use case**: Import external model predictions from HuggingFace datasets
  - **Limits**: No limits
  - **Note**: Returns immediately; ingestion runs in background

- `GET /api/admin/ingestion-history` - Complete ingestion run history
  - **Response**: Array of all ingestion runs with full details
  - **Limits**: No limits - returns all historical runs

### Ingestion Data Model
```typescript
interface IngestionRun {
  id: number;
  datasetName: string;
  baseUrl: string;
  source: string;  // ARC1-Eval, ARC2-Eval, etc.
  totalPuzzles: number;
  successful: number;
  failed: number;
  skipped: number;
  durationMs: number;
  dryRun: boolean;
  accuracyPercent: number | null;
  startedAt: string;
  completedAt: string;
  errorLog: string | null;
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
