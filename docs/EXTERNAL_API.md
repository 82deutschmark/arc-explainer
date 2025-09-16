# External API Reference

This document describes the public APIs that external applications rely on. These endpoints provide access to puzzle data, AI model analysis, user feedback, and performance metrics.

**🔄 Recent Changes (January 2025):** All artificial API result limits have been removed or significantly increased to support external applications.

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
  - **Body**: Analysis configuration options
  - **Response**: Analysis result with explanation and predictions
  - **Limits**: No limits

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

THESE ARE LARGELY DEPRECATED!  They never worked correctly.
- `POST /api/model/batch-analyze` - Start batch analysis across multiple puzzles
- `GET /api/model/batch-status/:sessionId` - Get batch analysis progress
- `POST /api/model/batch-control/:sessionId` - Control batch analysis (pause/resume/stop)
- `GET /api/model/batch-results/:sessionId` - Get batch analysis results
  - **Query params**: `limit`, `offset`, `status`
  - **Default limit**: 50 (configurable up to 10000)
- `GET /api/model/batch-sessions` - Get all batch analysis sessions
  - **Query params**: `limit`, `offset`
  - **Default limit**: 50 (configurable up to 10000)

### Explanation Management   SUPER IMPORTANT!!
- `GET /api/puzzle/:puzzleId/explanations` - Get all explanations for a puzzle
  - **Limits**: No limits - returns all explanations
- `GET /api/puzzle/:puzzleId/explanation` - Get single explanation for a puzzle
  - **Limits**: Single result - no limits
- `POST /api/puzzle/save-explained/:puzzleId` - Save AI-generated explanation
  - **Limits**: No limits

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
