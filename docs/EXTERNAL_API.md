# External API Reference

This document describes the public APIs that external applications rely on. These endpoints provide access to puzzle data, AI model analysis, user feedback, and performance metrics.

## Core Data Endpoints

### Puzzle Management
- `GET /api/puzzle/list` - Get paginated list of all puzzles
  - **Query params**: `page`, `limit`, `source` (ARC1, ARC1-Eval, ARC2, ARC2-Eval)
  - **Response**: Paginated puzzle list with metadata

- `GET /api/puzzle/overview` - Get puzzle statistics and overview
  - **Response**: Puzzle counts by source, difficulty distribution

- `GET /api/puzzle/task/:taskId` - Get specific puzzle data by ID  
  - **Params**: `taskId` (string) - Puzzle identifier
  - **Response**: Complete puzzle data with input/output grids

- `POST /api/puzzle/analyze/:taskId/:model` - Analyze puzzle with specific AI model
  - **Params**: `taskId` (string), `model` (string) - Model name  
  - **Body**: Analysis configuration options
  - **Response**: Analysis result with explanation and predictions

- `GET /api/puzzle/:puzzleId/has-explanation` - Check if puzzle has existing explanation
  - **Params**: `puzzleId` (string)
  - **Response**: Boolean indicating explanation existence

- `POST /api/puzzle/reinitialize` - Reinitialize puzzle database
  - **Admin endpoint**: Reloads all ARC puzzle data

### AI Model Analysis
- `GET /api/models` - List all available AI models and providers
- `POST /api/model/batch-analyze` - Start batch analysis across multiple puzzles
- `GET /api/model/batch-status/:sessionId` - Get batch analysis progress
- `POST /api/model/batch-control/:sessionId` - Control batch analysis (pause/resume/stop)
- `GET /api/model/batch-results/:sessionId` - Get batch analysis results
- `GET /api/model/batch-sessions` - Get all batch analysis sessions

### Explanation Management  
- `GET /api/puzzle/:puzzleId/explanations` - Get all explanations for a puzzle
- `GET /api/puzzle/:puzzleId/explanation` - Get single explanation for a puzzle
- `POST /api/puzzle/save-explained/:puzzleId` - Save AI-generated explanation

### User Feedback
- `POST /api/feedback` - Submit user feedback on explanations
- `GET /api/explanation/:explanationId/feedback` - Get feedback for specific explanation
- `GET /api/puzzle/:puzzleId/feedback` - Get all feedback for a puzzle
- `GET /api/feedback` - Get all feedback with optional filtering
- `GET /api/feedback/stats` - Get feedback summary statistics

## Analytics and Metrics Endpoints

### Performance Statistics

#### Accuracy Statistics
- `GET /api/feedback/accuracy-stats` - **Primary accuracy endpoint** - Pure puzzle-solving accuracy statistics
  - **Response**: `PureAccuracyStats` with `modelAccuracyRankings[]` (used by AccuracyLeaderboard)
  - **Sort Order**: Ascending by accuracy (worst performers first - "Models Needing Improvement")
  - **Data Source**: `is_prediction_correct` and `multi_test_all_correct` boolean fields only

#### Trustworthiness Statistics  
- `GET /api/puzzle/performance-stats` - Trustworthiness and confidence reliability metrics
  - **Response**: `PerformanceLeaderboards` with `trustworthinessLeaders[]`
  - **Data Source**: `prediction_accuracy_score` field (AI confidence reliability)

#### Combined Analytics
- `GET /api/puzzle/accuracy-stats` - **DEPRECATED** - Mixed accuracy/trustworthiness data
  - **Warning**: Despite name, contains trustworthiness-filtered results
- `GET /api/puzzle/general-stats` - General model statistics (mixed data from MetricsRepository)
- `GET /api/puzzle/raw-stats` - Infrastructure and database performance metrics
- `GET /api/metrics/comprehensive-dashboard` - Combined analytics dashboard from all repositories

### Model Analysis
- `GET /api/puzzle/confidence-stats` - Model confidence analysis
- `GET /api/puzzle/worst-performing` - Identify problematic puzzles

## Real-time and Advanced Features

### Saturn Visual Solver
- `POST /api/saturn/analyze/:taskId` - Analyze puzzle with Saturn visual solver
- `POST /api/saturn/analyze-with-reasoning/:taskId` - Saturn analysis with reasoning steps
- `GET /api/saturn/status/:sessionId` - Get Saturn analysis progress
- **WebSocket**: Real-time Saturn solver progress updates

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

### Key Response Interfaces

#### PureAccuracyStats (from `/api/feedback/accuracy-stats`)
```typescript
interface PureAccuracyStats {
  totalSolverAttempts: number;
  totalCorrectPredictions: number; 
  overallAccuracyPercentage: number;
  modelAccuracyRankings: ModelAccuracyRanking[];
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

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalSolverAttempts": 1250,
    "totalCorrectPredictions": 342,
    "overallAccuracyPercentage": 27.4,
    "modelAccuracyRankings": [
      {
        "modelName": "gpt-4o-mini",
        "totalAttempts": 45,
        "correctPredictions": 8,
        "accuracyPercentage": 17.8,
        "singleTestAccuracy": 18.2,
        "multiTestAccuracy": 16.7
      }
    ]
  }
}
```

#### PerformanceLeaderboards (from `/api/puzzle/performance-stats`)
```typescript
interface PerformanceLeaderboards {
  trustworthinessLeaders: Array<{
    modelName: string;
    avgTrustworthiness: number;
    avgConfidence: number;
    avgProcessingTime: number;
    avgCost: number;
    totalCost: number;
  }>;
  speedLeaders: any[];
  efficiencyLeaders: any[];
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

## Important Notes

- **Mixed Data Warning**: `/api/puzzle/accuracy-stats` contains mixed accuracy/trustworthiness data despite its name
- **Pure Accuracy**: Use `/api/feedback/accuracy-stats` for true puzzle-solving accuracy
- **Database Dependency**: Most endpoints require PostgreSQL connection. Fall back to in-memory mode if unavailable
- **Token Tracking**: API calls with AI models consume tokens and incur costs tracked in the database