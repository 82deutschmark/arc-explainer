# ModelExaminer Implementation Plan
**Date**: August 25, 2025  
**Author**: Claude Code Assistant

## Overview
Create a ModelExaminer page that's the inverse of PuzzleExaminer - batch test a specific model and settings against all puzzles in a selected dataset, with real-time progress tracking and comprehensive results.

## Frontend Implementation

### 1. Main Page Component
**File**: `client/src/pages/ModelExaminer.tsx`
- Model selection dropdown (20+ models across 5 providers)
- Dataset selection (ARC1, ARC1-Eval, ARC2, ARC2-Eval, All)
- Model settings panel (temperature, reasoning parameters, prompt selection)
- Batch analysis controls (start/stop/pause)
- Real-time progress display with WebSocket integration
- Results summary dashboard (accuracy stats, timing metrics, error rates)
- Individual puzzle results grid with drill-down capability

### 2. Supporting Components
**Files**: `client/src/components/batch/`
- `ModelSelector.tsx` - Enhanced model picker with provider grouping
- `DatasetSelector.tsx` - Dataset selection with puzzle count preview
- `BatchAnalysisControls.tsx` - Start/stop controls with settings validation
- `BatchProgressDisplay.tsx` - Real-time progress bar and status
- `BatchResultsGrid.tsx` - Paginated results with sorting/filtering
- `ModelPerformanceStats.tsx` - Accuracy metrics and performance charts

### 3. Custom Hook
**File**: `client/src/hooks/useBatchAnalysis.ts`
- Manage batch analysis state and WebSocket connection
- Handle progress updates and result streaming
- Control analysis lifecycle (start, pause, stop, resume)

## Backend Implementation

### 1. New API Endpoints
**File**: `server/routes/models.ts` (extend existing)
- `POST /api/model/batch-analyze` - Start batch analysis session
- `GET /api/model/batch-status/:sessionId` - Get real-time status
- `POST /api/model/batch-control/:sessionId` - Pause/resume/cancel
- `GET /api/model/batch-results/:sessionId` - Get detailed results

### 2. Controllers & Services
**Files**: 
- `server/controllers/batchAnalysisController.ts` - Handle batch requests
- `server/services/batchAnalysisService.ts` - Core batch processing logic
- `server/services/batchProgressTracker.ts` - Progress tracking and WebSocket updates

### 3. Database Schema
**Tables**:
- `batch_analysis_sessions` - Track session state, settings, progress
- `batch_analysis_results` - Individual puzzle results within sessions

## Routing & Navigation

### 1. Add Route
**File**: `client/src/App.tsx`
- Add `/model-examiner` route
- Update navigation in existing pages

### 2. Cross-linking
- Add "Model Examiner" link to PuzzleBrowser
- Add "Switch to Puzzle Examiner" option in ModelExaminer

## Key Features

### 1. Analysis Configuration
- Model selection with provider filtering
- Dataset selection with size indicators
- Prompt template selection (solver, explainer, custom)
- Temperature and reasoning parameter controls
- Batch size and concurrency settings

### 2. Progress Tracking
- Real-time WebSocket updates
- Progress percentage and ETA calculation
- Individual puzzle completion status
- Error tracking and retry logic

### 3. Results Dashboard
- Overall accuracy and performance metrics
- Provider comparison charts
- Individual puzzle result browsing
- Export capabilities (CSV, JSON)
- Integration with existing explanation database

## Technical Considerations

### 1. Performance
- Implement queue-based processing to avoid overwhelming AI APIs
- Add rate limiting and retry logic for API failures
- Stream results as they complete rather than waiting for full batch

### 2. State Management
- Persist batch sessions across browser refreshes
- Allow resuming interrupted analyses
- Handle WebSocket reconnection gracefully

### 3. Integration Points
- Reuse existing model configurations and AI service infrastructure
- Leverage current database schema for storing individual results
- Maintain consistency with existing analysis result format

## Implementation Order
1. Database schema and migration
2. Backend batch analysis service and endpoints
3. Frontend components and hooks
4. WebSocket integration for progress
5. Results dashboard and visualization
6. Testing and error handling
7. Documentation and deployment

## Database Schema Details

### `batch_analysis_sessions` Table
```sql
CREATE TABLE batch_analysis_sessions (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) UNIQUE NOT NULL,
  model_key VARCHAR(100) NOT NULL,
  dataset VARCHAR(20) NOT NULL,
  prompt_id VARCHAR(50),
  custom_prompt TEXT,
  temperature DECIMAL(3,2),
  reasoning_effort VARCHAR(20),
  reasoning_verbosity VARCHAR(20),
  reasoning_summary_type VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_puzzles INTEGER NOT NULL DEFAULT 0,
  completed_puzzles INTEGER NOT NULL DEFAULT 0,
  successful_puzzles INTEGER NOT NULL DEFAULT 0,
  failed_puzzles INTEGER NOT NULL DEFAULT 0,
  average_processing_time DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);
```

### `batch_analysis_results` Table
```sql
CREATE TABLE batch_analysis_results (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL REFERENCES batch_analysis_sessions(session_id),
  puzzle_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  explanation_id INTEGER REFERENCES explanations(id),
  processing_time_ms INTEGER,
  accuracy_score DECIMAL(5,4),
  is_correct BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
```

## API Specification

### Start Batch Analysis
```
POST /api/model/batch-analyze
Body: {
  modelKey: string,
  dataset: 'ARC1' | 'ARC1-Eval' | 'ARC2' | 'ARC2-Eval' | 'All',
  promptId?: string,
  customPrompt?: string,
  temperature?: number,
  reasoningEffort?: string,
  reasoningVerbosity?: string,
  reasoningSummaryType?: string,
  batchSize?: number
}
Response: { sessionId: string }
```

### Get Batch Status
```
GET /api/model/batch-status/:sessionId
Response: {
  sessionId: string,
  status: 'pending' | 'running' | 'completed' | 'paused' | 'cancelled',
  progress: {
    total: number,
    completed: number,
    successful: number,
    failed: number,
    percentage: number
  },
  stats: {
    averageProcessingTime: number,
    overallAccuracy: number,
    eta: number
  }
}
```

### Control Batch Analysis
```
POST /api/model/batch-control/:sessionId
Body: { action: 'pause' | 'resume' | 'cancel' }
Response: { success: boolean }
```

## WebSocket Events

### Client → Server
- `join-session` - Join a batch analysis session for updates
- `leave-session` - Leave session updates

### Server → Client
- `session-progress` - Progress update with current stats
- `puzzle-completed` - Individual puzzle completion notification
- `session-completed` - Batch analysis finished
- `session-error` - Error in batch processing

## UI/UX Design

### Layout Structure
1. **Header**: Model Examiner title with navigation back to home
2. **Configuration Panel**: Model, dataset, and parameter selection
3. **Control Panel**: Start/pause/stop buttons with validation
4. **Progress Section**: Real-time progress bar and statistics
5. **Results Grid**: Paginated table of individual puzzle results
6. **Summary Dashboard**: Charts and overall performance metrics

### Key Interactions
- Model selection updates available parameters (temperature, reasoning)
- Dataset selection shows puzzle count preview
- Real-time progress updates without page refresh
- Click on individual results to view detailed explanation
- Export functionality for results data

## Error Handling

### Frontend
- Validate configuration before starting batch
- Handle WebSocket disconnections gracefully
- Show user-friendly error messages
- Allow retry of failed operations

### Backend
- Queue management for API rate limiting
- Automatic retry logic for transient failures
- Graceful degradation when AI services unavailable
- Comprehensive error logging and reporting

## Testing Strategy

### Unit Tests
- Individual component functionality
- API endpoint validation
- Database operations
- WebSocket message handling

### Integration Tests
- Full batch analysis workflow
- Error scenarios and recovery
- Performance under load
- Cross-browser compatibility

### Performance Tests
- Large dataset processing (1000+ puzzles)
- Concurrent batch analyses
- Memory usage monitoring
- API rate limit handling

## Deployment Considerations

### Database Migration
- Add new tables to existing PostgreSQL schema
- Create indexes for performance optimization
- Add foreign key constraints for data integrity

### Environment Variables
- WebSocket server configuration
- Batch processing limits and timeouts
- Queue management settings

### Monitoring
- Track batch analysis completion rates
- Monitor API usage and costs
- Alert on high failure rates
- Performance metrics dashboard