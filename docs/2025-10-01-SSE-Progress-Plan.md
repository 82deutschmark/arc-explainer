# Real-Time Progress Implementation Plan
**Date:** 2025-10-01  
**Approach:** Reuse Saturn WebSocket Pattern
**Estimated Time:** 6-8 hours

## Strategy
Clone proven Saturn Visual Solver WebSocket architecture:
- ✅ WebSocket server exists (`wsService.ts`)
- ✅ Progress broadcasting works
- ✅ React hooks pattern (`useSaturnProgress.ts`)
- ✅ shadcn/ui components (`SaturnVisualSolver.tsx`)

## Architecture
```
FRONTEND → useIngestionProgress() Hook → WebSocket
           ↓
    IngestionProgressDialog (shadcn/ui)
    ├─ Progress Bar
    ├─ Live Stats  
    ├─ Log Terminal
    └─ Pause/Resume/Cancel Buttons

BACKEND → ingestionJobManager.ts (NEW)
          ├─ createJob() → jobId + EventEmitter
          ├─ pauseJob() → set flag
          ├─ resumeJob() → emit event
          └─ cancelJob() → set flag
          ↓
       ingest script checks flags + emits progress
          ↓
       wsService.broadcast(jobId, data)
```

## Implementation Tasks

### Phase 1: Backend (3-4 hours)
1. **Job Manager** (`server/services/ingestionJobManager.ts`)
   - State machine: idle → running → paused → completed
   - Pause/resume via flags + EventEmitter
   - Progress tracking

2. **Script Mods** (`ingest-huggingface-dataset.ts`)
   - Accept jobId parameter
   - Check pause/cancel flags before each puzzle
   - Emit progress after each puzzle
   - Wait on pause using `job.emitter.once('resume')`

3. **Controller** (`adminController.ts`)
   - Modify startIngestion() to create job, return jobId
   - Add pauseIngestion(jobId)
   - Add resumeIngestion(jobId)
   - Add cancelIngestion(jobId)

4. **Routes** (`routes.ts`)
   - POST /start-ingestion → jobId
   - POST /pause-ingestion/:jobId
   - POST /resume-ingestion/:jobId
   - POST /cancel-ingestion/:jobId

5. **WebSocket Path** (`wsService.ts`)
   - Add `/api/admin/ingestion-progress` path
   - Reuse existing broadcast infrastructure

### Phase 2: Frontend (2-3 hours)
1. **Hook** (`client/src/hooks/useIngestionProgress.ts`)
   - Clone useSaturnProgress pattern
   - Connect WebSocket to jobId
   - Expose: start(), pause(), resume(), cancel()

2. **Dialog** (`client/src/components/admin/IngestionProgressDialog.tsx`)
   - Progress bar (shadcn/ui)
   - Stats grid (successful/failed/skipped/current)
   - Log terminal (ScrollArea)
   - Pause/Resume/Cancel buttons
   - Auto-scroll logs

3. **Integration** (`HuggingFaceIngestion.tsx`)
   - Replace toast-only with progress dialog
   - Show dialog on "Start Ingestion"
   - Pass config to dialog
   - Refresh history on close

## Testing Plan
- [x] Basic flow (start → watch progress → completion)
- [x] Pause → verify stops → Resume → continues
- [x] Cancel → stops immediately
- [x] Error handling
- [x] Multiple concurrent ingestions

## Time Estimate
- Backend: 3-4 hours
- Frontend: 2-3 hours
- Testing: 1 hour
- **Total: 6-8 hours**

## Success Criteria
- Real-time progress bar updates
- Live stats (successful/failed/skipped)
- Current puzzle displayed
- Terminal shows processing logs
- Pause/Resume/Cancel all work
- Completion summary shown
- History auto-refreshes

Ready to start implementation!
