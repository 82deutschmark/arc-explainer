# Web UI-Triggered Batch Testing System

*Created: August 23, 2025*  
*Author: Cascade*

## Overview

A comprehensive batch testing system that allows triggering evaluation of all 118 puzzles in `data/evaluation2` from the web UI using any configured AI model (e.g., GPT-5-Nano). The system leverages existing TypeScript infrastructure instead of Python scripts, ensuring consistent behavior and seamless integration.

## Architecture Strategy

**Reuse Existing Infrastructure:**
- `puzzleController.analyze()` for individual puzzle processing
- `aiServiceFactory` and all existing AI services 
- `dbService` for result storage and retrieval
- `wsService` for real-time progress streaming
- WebSocket hooks like `useSaturnProgress` for UI updates

**Zero Code Duplication:** The batch system orchestrates existing proven components rather than reimplementing puzzle analysis logic.

## Core Components

### 1. Backend Services

**Batch Controller** (`server/controllers/batchController.ts`)
- `POST /api/batch/start` - Initiate batch run with model and dataset selection
- `GET /api/batch/:id` - Get batch run status and progress
- `POST /api/batch/:id/stop` - Stop running batch run
- `GET /api/batch/runs` - List all batch runs with filtering
- `GET /api/batch/:id/results` - Get detailed results for completed batch run

**Batch Service** (`server/services/batchService.ts`)
- Core orchestration logic for puzzle queue management
- Rate limiting (configurable 2-5 second delays)
- Error recovery with automatic retries
- Progress tracking and WebSocket broadcasting
- Resume capability for interrupted runs

**Database Extensions** (`server/services/dbService.ts`)
```sql
-- New tables for batch tracking
CREATE TABLE batch_runs (
    id SERIAL PRIMARY KEY,
    status VARCHAR(20) NOT NULL, -- 'running', 'completed', 'stopped', 'error'
    model VARCHAR(50) NOT NULL,
    dataset_path VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    total_puzzles INTEGER NOT NULL,
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    average_accuracy DECIMAL(5,2),
    total_processing_time_ms BIGINT DEFAULT 0,
    config JSONB -- stores rate limiting, retry settings, etc.
);

CREATE TABLE batch_results (
    id SERIAL PRIMARY KEY,
    batch_run_id INTEGER REFERENCES batch_runs(id),
    puzzle_id VARCHAR(50) NOT NULL,
    explanation_id INTEGER REFERENCES explanations(id),
    processing_time_ms INTEGER,
    accuracy_score DECIMAL(5,2),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. WebSocket Extensions

**Batch Progress Channel** (`server/services/wsService.ts`)
- Extend existing WebSocket infrastructure with `/api/batch/progress?batchId=...`
- Real-time updates: current puzzle, overall progress, success/failure counts
- Live error reporting and recovery notifications
- Progress snapshots for resume capability

### 3. Frontend Components

**Batch Testing Page** (`client/src/pages/BatchTesting.tsx`)
- Model selection dropdown (GPT-5-Nano, GPT-4, Claude, etc.)
- Dataset selector (evaluation2, training2, evaluation, training)
- Batch configuration (rate limiting, retry settings)
- Start/stop batch controls

**Progress Dashboard** (`client/src/components/BatchProgress.tsx`)
- Real-time progress bars (overall + current puzzle)
- Live console showing processing status
- Success/failure counters with accuracy metrics
- Estimated time remaining

**Results Analytics** (`client/src/components/BatchResults.tsx`) 
- Batch run history with filtering
- Accuracy score distributions and success rates
- Per-puzzle breakdown with error analysis
- Performance metrics (processing times, throughput)

## Implementation Flow

### Phase 1: Backend Infrastructure
1. **Database Schema** - Add batch_runs and batch_results tables
2. **Batch Service** - Core orchestration with rate limiting and queuing
3. **Batch Controller** - HTTP endpoints for batch operations
4. **WebSocket Extensions** - Real-time progress streaming

### Phase 2: Frontend Integration  
1. **Batch Testing Page** - UI for initiating batch runs
2. **Progress Components** - Real-time status display
3. **Navigation Updates** - Add batch testing to main navigation

### Phase 3: Analytics & Polish
1. **Results Dashboard** - Historical batch run analysis
2. **Error Recovery UI** - Manual retry controls
3. **Performance Optimization** - Concurrency and memory management

## Technical Specifications

### Batch Processing Logic
```typescript
interface BatchRun {
  id: number;
  status: 'running' | 'completed' | 'stopped' | 'error';
  model: string;
  datasetPath: string;
  totalPuzzles: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  config: BatchConfig;
}

interface BatchConfig {
  rateLimitDelayMs: number; // 2000-5000ms typical
  maxRetries: number; // 3 typical
  timeoutPerPuzzleMs: number; // 300000 (5 minutes)
  concurrency: number; // 1 for now, future enhancement
}
```

### Error Handling Strategy
- **Transient Failures**: Automatic retry with exponential backoff
- **Permanent Failures**: Log error, continue with next puzzle
- **System Failures**: Save progress, enable manual resume
- **Rate Limiting**: Respect API limits with configurable delays

### Performance Considerations
- **Memory Management**: Process puzzles individually, not bulk loading
- **Database Efficiency**: Batch insert results every N puzzles
- **WebSocket Optimization**: Throttle progress updates to avoid spam
- **Graceful Shutdown**: Clean termination with progress preservation

## Integration Benefits

✅ **Consistent Behavior** - Uses identical prompts, validation, and storage as manual UI analysis  
✅ **No Duplicate Code** - Leverages all existing puzzle analysis infrastructure  
✅ **Real-time Visibility** - Live progress via proven WebSocket system  
✅ **Resume Capability** - Database-backed progress tracking survives restarts  
✅ **Multi-Model Support** - Works with any configured AI provider  
✅ **Scalable Design** - Foundation for future enhancements (concurrency, scheduling)

## Expected Performance

**GPT-5-Nano on Evaluation2 Dataset (118 puzzles):**
- **Total Runtime**: ~8-12 minutes (with 3-second rate limiting + processing time)
- **Success Rate**: Dependent on model performance and puzzle complexity  
- **Storage**: All results automatically stored in existing DB schema
- **Memory Usage**: Minimal (processes one puzzle at a time)

## Usage Workflow

1. **Navigate** to `/batch-testing` page from main navigation
2. **Configure** batch run (model: GPT-5-Nano, dataset: evaluation2)
3. **Start** batch run - system begins processing puzzles sequentially  
4. **Monitor** real-time progress via WebSocket updates
5. **Analyze** results in batch dashboard upon completion

This system transforms batch testing from external scripts into a first-class feature of your ARC puzzle analysis platform.
