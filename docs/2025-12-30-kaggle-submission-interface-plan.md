# Kaggle-like ARC Submission Interface Plan

**Author:** Claude Opus 4.5
**Date:** 2025-12-30
**Goal:** Create a new ARC submission and evaluation page with supporting backend endpoints

## Overview
Build a new submission page where users can upload solution notebooks, track execution progress in real-time, and view their results. Leaderboard is out of scope for now.

## Deprecation Note
- `client/src/pages/KaggleReadinessValidation.tsx` can be deprecated/removed (not needed for this feature)

## Critical Files to Create

### Frontend
- **`client/src/pages/ARCSubmissions.tsx`** - New page component
- **Router update** - Add route for `/submissions` or `/compete`
- New components:
  - `client/src/components/submissions/NotebookUploader.tsx` - File upload UI
  - `client/src/components/submissions/ExecutionTracker.tsx` - Real-time execution status
  - `client/src/components/submissions/ResultsViewer.tsx` - Score and detailed results

### Backend
- **New endpoints:**
  - `POST /api/submissions/upload` - Accept notebook file
  - `POST /api/submissions/:id/execute` - Trigger execution
  - `GET /api/submissions/:id/status` - SSE stream for execution progress
  - `GET /api/submissions/:id/results` - Fetch final results

- **New files:**
  - `server/controllers/submissionsController.ts`
  - `server/services/notebookExecutor.ts`
  - `server/services/arcScorer.ts`
  - `server/repositories/submissionsRepository.ts`

### Database
- **New table:** `submissions` (id, user_id, notebook_file_path, status, score, results_json, execution_log, submitted_at, completed_at)

## Implementation Phases

### Phase 1: Page Scaffolding
1. Create new `ARCSubmissions.tsx` page
2. Add route to router configuration
3. Basic layout with two sections:
   - Upload section (left/top)
   - Results/tracking section (right/bottom)

### Phase 2: Upload Interface
1. Build `NotebookUploader` component
   - Accept `.ipynb` files only
   - File size validation (max 10MB)
   - Preview uploaded file metadata
   - Submit button that calls `POST /api/submissions/upload`
2. Show upload confirmation with submission ID

### Phase 3: Execution Tracking
1. Build `ExecutionTracker` component
   - Display current status (queued/running/completed/failed)
   - SSE connection to `GET /api/submissions/:id/status`
   - Live log output in scrollable terminal-style view
   - Progress indicator (e.g., "Task 23/100")

### Phase 4: Results Display
1. Build `ResultsViewer` component
   - Overall score (e.g., "73/100 tasks solved = 0.73")
   - Per-task breakdown table:
     - Task ID
     - Attempt 1 result
     - Attempt 2 result
     - Final result (solved/failed)
   - Filter controls (show only failed, show only solved)

### Phase 5: Backend - Upload & Storage
1. Create `POST /api/submissions/upload` endpoint
   - Use multer for file upload
   - Validate file type (.ipynb)
   - Store file in `data/submissions/` directory
   - Create database entry with status='pending'
   - Return submission ID

### Phase 6: Backend - Execution Engine
1. Create `notebookExecutor.ts` service
   - Spawn Python process to execute notebook
   - Use existing evaluation dataset
   - Capture stdout/stderr for logs
   - Stream progress via SSE
2. Create `arcScorer.ts` service
   - 2-attempt scoring (per ARC Prize rules)
   - Score = solved_pairs / total_pairs

### Phase 7: Backend - Status & Results
1. `GET /api/submissions/:id/status` SSE endpoint
2. `GET /api/submissions/:id/results` endpoint

## UI/UX Design Principles

### Visual Style
- **Avoid "AI slop"**: No excessive centered layouts, purple gradients, or uniform rounded corners
- Use functional, data-dense design inspired by Kaggle
- Tables with clear headers and zebra striping
- Minimal use of icons, focus on text and data
- Monospace font for logs and code-related content

### State Transitions
- Upload form → Confirmation → Execution tracker (auto-navigate)
- Execution tracker shows live updates, then auto-switches to results view
- No static lists or cluttered all-in-one views
- Collapse completed sections, expand active ones

### Real-time Updates
- Use SSE for execution status (no polling)
- Toast notifications for completion
- Auto-update leaderboard when new submissions complete

## Technical Decisions

### File Upload
- Store notebooks in `data/submissions/{user_id}/{submission_id}.ipynb`
- Max file size: 10MB
- Only accept `.ipynb` extension

### Execution Environment
- Use Python subprocess to execute notebooks
- Timeout: 30 minutes per submission
- Sandbox execution (consider using Docker or similar if needed later)
- Capture both stdout and stderr

### Scoring Implementation
- Follow ARC Prize scoring exactly:
  - 2 attempts per test pair
  - Exact match = 1 point, any mismatch = 0 points
  - Score = sum(solved_pairs) / total_pairs
  - Range: 0.00 to 1.00

### Database Schema
```sql
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  notebook_file_path TEXT NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, running, completed, failed
  score NUMERIC(5,4), -- 0.0000 to 1.0000
  results_json JSONB, -- detailed per-task results
  execution_log TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_score ON submissions(score DESC);
CREATE INDEX idx_submissions_status ON submissions(status);
```

## Dependencies to Add
- `multer` - File upload middleware (or existing upload solution)
- Potentially `dockerode` if we want Docker sandboxing (later phase)

## Testing Strategy
1. Manual testing with sample notebooks
2. Test with malformed notebooks (error handling)
3. Test with various scores (0.0, 0.5, 1.0)
4. Load test with multiple concurrent submissions

## Migration from Current Page
1. Keep route path `/kaggle-readiness-validation` or rename to `/compete` or `/submissions`
2. Remove all validation assessment logic
3. Preserve shadcn/ui component usage (Card, Button, Tabs, etc.)
4. Keep general layout structure but replace content

## Open Questions
- [ ] Should we support user accounts or just use session-based anonymous submissions?
- [ ] What's the max number of submissions per user?
- [ ] Should we show public leaderboard or only user's own submissions?
- [ ] Do we need submission quotas/rate limiting?
- [ ] Should we store user code or just execution results?

## Success Criteria
- ✅ User can upload .ipynb file
- ✅ System executes notebook against evaluation dataset
- ✅ User sees real-time execution progress
- ✅ System calculates score using ARC Prize methodology (2 attempts, exact match)
- ✅ User sees detailed per-task results
- ✅ Leaderboard displays all submissions ranked by score
- ✅ UI is clean, functional, and avoids generic AI design patterns
