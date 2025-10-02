# HuggingFace Dataset Ingestion UI - Complete Implementation Plan

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-10-01
**Status:** Plan Document for Future Implementation

---STILL NOT WORKING CORRECTLY!!!

## Executive Summary

Create a comprehensive admin interface for managing HuggingFace dataset ingestion with proper separation of concerns. This will include:
1. **Admin Hub** (`/admin`) - Central dashboard linking to all admin tools
2. **Dataset Ingestion Page** (`/admin/ingest-hf`) - Dedicated ingestion interface
3. **Model Management** (`/admin/models`) - Existing page, moved under admin

---

## Architecture Overview

### Page Structure

```
/admin                    → Admin Hub (new)
  /admin/models           → Model Configuration Management (existing, relocated)
  /admin/ingest-hf        → HuggingFace Dataset Ingestion (new)
  /admin/system-health    → System Health Dashboard (future)
```

### SRP Compliance

**DO NOT** wedge features onto existing pages. Each page has ONE responsibility:

- `/admin/models` - ONLY model config viewing/management
- `/admin/ingest-hf` - ONLY dataset ingestion
- `/admin` - ONLY admin navigation hub

---

## 1. Admin Hub Page (`/admin`)

**File:** `client/src/pages/AdminHub.tsx`

### Purpose
Centralized dashboard for all administrative functions.

### Features
- **Quick Stats Cards:**
  - Total models configured
  - Total explanations in database
  - Database connection status
  - Last ingestion date/time

- **Admin Tool Links:**
  - Model Configuration → `/admin/models`
  - Dataset Ingestion → `/admin/ingest-hf`
  - System Health → `/admin/system-health` (future)

- **Recent Activity Feed:**
  - Last 10 ingestion runs (timestamp, dataset, status)
  - Last 5 model additions/removals

### shadcn/ui Components
- Card, CardContent, CardHeader, CardTitle
- Button (for navigation links)
- Badge (for status indicators)
- Separator

### API Endpoints Needed
- `GET /api/admin/quick-stats` - Returns dashboard stats
- `GET /api/admin/recent-activity` - Returns recent admin actions

---

## 2. Dataset Ingestion Page (`/admin/ingest-hf`)

**File:** `client/src/pages/HuggingFaceIngestion.tsx`

### Purpose
Dedicated interface for ingesting external model predictions from HuggingFace datasets.

### Core Features

#### 2.1 Configuration Form

**Fields:**
- **Dataset Name** (text input, required)
  - Default: `claude-sonnet-4-5-20250929-thinking-32k`
  - Tooltip: "This becomes the model name in database"
  - Validation: Cannot be empty

- **Base URL** (text input, required)
  - Default: `https://huggingface.co/datasets/arcprize/arc_agi_v1_public_eval/resolve/main`
  - Auto-detect dropdown for common URLs:
    - arcprize/arc_agi_v1_public_eval
    - arcprize/arc_agi_v1_training
    - arcprize/arc_agi_v2_public_eval
    - arcprize/arc_agi_v2_training

- **Source** (dropdown, optional)
  - Options: Auto-detect, ARC1-Eval, ARC1, ARC2-Eval, ARC2, ARC-Heavy
  - Default: Auto-detect
  - Tooltip: "Will auto-detect from URL if not specified"

- **Limit** (number input, optional)
  - Default: empty (process all)
  - Placeholder: "Leave empty to process all puzzles"
  - Help text: "For testing, start with 5-10 puzzles"

- **Delay** (number input, required)
  - Default: 100
  - Unit: milliseconds
  - Help text: "Delay between HTTP requests to avoid rate limiting"

**Checkboxes:**
- ☐ **Dry Run** - Preview without saving to database
- ☐ **Force Overwrite** - Replace existing entries (default: skip duplicates)
- ☐ **Verbose Logging** - Show detailed progress in console

**Buttons:**
- **Validate Configuration** - Check URL/dataset exists before running
- **Start Ingestion** - Begin ingestion process
- **Cancel** - Stop ongoing ingestion (if running)

#### 2.2 Real-Time Progress Display

**Progress Indicators:**
- Overall progress bar: `[=======>    ] 45/400 puzzles (11%)`
- Current status: "Processing puzzle be03b35f (attempt 1/2)..."
- Live counters:
  - ✅ Successful: 87 entries
  - ⚠️ Skipped: 3 duplicates
  - ❌ Failed: 2 errors
- Estimated time remaining: "~15 minutes remaining"

**Live Log Stream:**
```
[12:34:56] Starting ingestion for dataset: claude-sonnet-4-5-20250929-thinking-32k
[12:34:56] Auto-detected source: ARC1-Eval (400 puzzles)
[12:34:57] Processing 00576224... ✓ Saved 2/2 attempts (2 correct)
[12:34:58] Processing 009d5c81... ✓ Saved 2/2 attempts (1 correct)
[12:34:59] Processing 00dbd492... ⚠ Skipped (duplicate exists)
```

**Update Frequency:**
- Progress bar: Every puzzle
- Log stream: Real-time via WebSocket or Server-Sent Events
- Stats: Every 10 puzzles

#### 2.3 Results Summary

**After Completion:**

```
📊 INGESTION COMPLETE

Duration: 12m 34s
Mode: LIVE (data saved to database)

Results:
├─ Total Puzzles: 400
├─ ✅ Successful: 784 entries (392 puzzles × 2 attempts)
├─ ⚠️ Skipped: 16 duplicates
└─ ❌ Failed: 0

Accuracy Breakdown:
├─ Both attempts correct: 156 puzzles (39%)
├─ One attempt correct: 89 puzzles (22%)
└─ Both incorrect: 147 puzzles (37%)

Overall Accuracy: 60.2% (473/784 attempts)

Cost Estimate: $45.67
Tokens Used: 15,234,567 total
```

**Action Buttons:**
- **View Ingested Data** → Link to filtered explanations page
- **Download Report** → CSV/JSON export of results
- **Run Another Ingestion** → Reset form

#### 2.4 Validation Preview (Before Running)

When user clicks "Validate Configuration":

```
✓ Dataset URL accessible
✓ HF_TOKEN environment variable found
✓ Database connection active
✓ Source auto-detected: ARC1-Eval
✓ 400 puzzles found locally

Sample Data Preview:
First puzzle: 00576224
  - Test cases: 1
  - HF data found: Yes
  - Existing entries: 0

Ready to ingest!
```

#### 2.5 Error Handling

**Error Display:**
- In-line field validation (red borders, error messages)
- Modal dialog for critical errors
- Expandable error details in results

**Common Errors & Solutions:**
```
❌ 401 Unauthorized
→ Check HF_TOKEN environment variable

❌ 404 Not Found
→ Verify dataset name and base URL are correct

❌ Database not available
→ Check DATABASE_URL environment variable

❌ Puzzle not found locally
→ Ensure puzzle exists in data/evaluation or data/training
```

#### 2.6 Ingestion History

**Table showing past ingestions:**

| Date | Dataset | Puzzles | Success | Failed | Duration | Dry Run | Actions |
|------|---------|---------|---------|--------|----------|---------|---------|
| 2025-10-01 14:23 | claude-sonnet-4-5-... | 400 | 784 | 0 | 12m 34s | No | View |
| 2025-10-01 12:15 | gpt-4o-2024-11-20 | 50 | 98 | 2 | 1m 45s | Yes | View |

**Features:**
- Sort by date (newest first)
- Filter by dataset name
- Click row to see full details
- "View" button → Show detailed results
- Export history to CSV

**API Endpoint:**
- `GET /api/admin/ingestion-history` - Returns past ingestion runs
  - Stored in new table: `ingestion_runs`

---

## 3. Backend Requirements

### 3.1 New API Endpoints

**`POST /api/admin/ingest-hf`**
```typescript
Request Body:
{
  datasetName: string;
  baseUrl: string;
  source?: 'ARC1-Eval' | 'ARC1' | 'ARC2-Eval' | 'ARC2' | 'ARC-Heavy';
  limit?: number;
  delay: number;
  dryRun: boolean;
  forceOverwrite: boolean;
  verbose: boolean;
}

Response (streaming via SSE or WebSocket):
{
  type: 'progress' | 'log' | 'complete';
  data: {
    current: number;
    total: number;
    currentPuzzle: string;
    stats: { successful, failed, skipped };
    message?: string;
  }
}
```

**`POST /api/admin/validate-ingestion`**
```typescript
Request Body:
{
  datasetName: string;
  baseUrl: string;
}

Response:
{
  valid: boolean;
  checks: {
    urlAccessible: boolean;
    tokenPresent: boolean;
    databaseConnected: boolean;
    sourceDetected: string | null;
    puzzleCount: number;
    samplePuzzle: { id: string, hasData: boolean, existingEntries: number };
  };
  errors: string[];
}
```

**`GET /api/admin/ingestion-history`**
```typescript
Response:
{
  runs: Array<{
    id: number;
    timestamp: string;
    datasetName: string;
    baseUrl: string;
    totalPuzzles: number;
    successful: number;
    failed: number;
    skipped: number;
    duration: number;
    dryRun: boolean;
    accuracyPercent: number;
  }>;
}
```

### 3.2 Database Schema Addition

**New Table: `ingestion_runs`**
```sql
CREATE TABLE ingestion_runs (
  id SERIAL PRIMARY KEY,
  dataset_name VARCHAR(255) NOT NULL,
  base_url TEXT NOT NULL,
  source VARCHAR(50),
  total_puzzles INTEGER NOT NULL,
  successful INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  skipped INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  dry_run BOOLEAN DEFAULT FALSE,
  accuracy_percent DECIMAL(5,2),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  error_log TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ingestion_runs_dataset ON ingestion_runs(dataset_name);
CREATE INDEX idx_ingestion_runs_started ON ingestion_runs(started_at DESC);
```

### 3.3 Controller Structure

**File:** `server/controllers/adminController.ts`

```typescript
// Separate from modelManagementController.ts
export async function validateIngestion(req, res) { ... }
export async function startIngestion(req, res) { ... }
export async function getIngestionHistory(req, res) { ... }
export async function getQuickStats(req, res) { ... }
export async function getRecentActivity(req, res) { ... }
```

**Apply SAME FIXES from CLI script:**
- ✅ Use `datasetName` for model name (not metadata.model)
- ✅ Store `predictedGrids[0]` (not validationResult.predictedGrid)
- ✅ Map `content` → `patternDescription`
- ✅ Map `reasoning_summary` → `reasoningLog`
- ✅ Map `total_cost` → `estimatedCost`

---

## 4. Real-Time Progress Implementation

### Option A: Server-Sent Events (SSE) - RECOMMENDED

**Why SSE:**
- Simpler than WebSockets
- One-way server→client (perfect for progress updates)
- Automatic reconnection
- Works through proxies/firewalls

**Implementation:**

```typescript
// Backend
app.get('/api/admin/ingest-hf/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send progress updates
  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Run ingestion with callbacks
  await runIngestion({
    onProgress: (progress) => sendEvent({ type: 'progress', data: progress }),
    onLog: (message) => sendEvent({ type: 'log', data: { message } }),
    onComplete: (summary) => sendEvent({ type: 'complete', data: summary })
  });

  res.end();
});

// Frontend
const eventSource = new EventSource('/api/admin/ingest-hf/stream?...');
eventSource.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'progress') updateProgress(data);
  if (type === 'log') appendLog(data.message);
  if (type === 'complete') showResults(data);
};
```

### Option B: Polling - FALLBACK

If SSE isn't feasible:
- Start ingestion via POST, get `runId`
- Poll `GET /api/admin/ingestion-status/:runId` every 2 seconds
- Display cached progress/logs

---

## 5. shadcn/ui Components Usage

### Ingestion Page Components:
- **Card** - Wrap form sections
- **Input** - Text/number fields
- **Select** - Dropdowns (source, preset URLs)
- **Button** - Action triggers
- **Progress** - Progress bar
- **Badge** - Status indicators (success/failed/skipped)
- **Alert** - Error messages
- **Tabs** - Switch between Configuration/Progress/History
- **Table** - Ingestion history
- **Dialog** - Validation preview modal
- **Separator** - Visual breaks

---

## 6. Implementation Order

### Phase 1: Backend (Do This First)
1. Create `adminController.ts` with ingestion logic
2. Add routes in `routes.ts`
3. Create `ingestion_runs` table migration
4. Test API endpoints with Postman/curl

### Phase 2: Admin Hub
1. Create `AdminHub.tsx` page
2. Add route in `App.tsx`
3. Implement quick stats display
4. Add navigation links

### Phase 3: Ingestion Page
1. Create `HuggingFaceIngestion.tsx`
2. Build configuration form
3. Implement validation preview
4. Add SSE progress tracking
5. Build results display
6. Add ingestion history table

### Phase 4: Testing
1. Test dry run mode
2. Test live ingestion with small limit
3. Test error handling (bad URL, no token, etc.)
4. Test duplicate detection
5. Verify data mapping correctness

---

## 7. Critical Data Mapping (From CLI Script Fixes)

**MUST USE THESE MAPPINGS:**

```typescript
// ✅ CORRECT - Store actual HF predictions
predictedOutputGrid: predictedGrids[0]  // NOT validationResult.predictedGrid
multiplePredictedOutputs: predictedGrids  // NOT validationResult.multiplePredictedOutputs

// ✅ CORRECT - Use dataset name for model name
modelName: `${datasetName}-attempt${attemptNumber}`  // NOT metadata.model

// ✅ CORRECT - Field mappings
patternDescription: extractPatternDescription(metadata.choices)  // HF content
reasoningLog: metadata.reasoning_summary  // HF reasoning_summary
estimatedCost: totalCost  // HF total_cost aggregated
```

---

## 8. File Checklist

### New Files to Create:
- [ ] `client/src/pages/AdminHub.tsx`
- [ ] `client/src/pages/HuggingFaceIngestion.tsx`
- [ ] `server/controllers/adminController.ts`
- [ ] `server/migrations/YYYYMMDD_create_ingestion_runs.sql`

### Files to Modify:
- [ ] `client/src/App.tsx` - Add routes
- [ ] `server/routes.ts` - Add admin routes
- [ ] `client/src/pages/ModelManagement.tsx` - Move to `/admin/models`

### Files NOT to Touch:
- ❌ `server/scripts/ingest-huggingface-dataset.ts` - Already fixed
- ❌ `server/repositories/*` - No changes needed

---

## 9. Testing Checklist

Before marking as complete:
- [ ] `/admin` hub loads and shows stats
- [ ] `/admin/models` works (moved from `/model-config`)
- [ ] `/admin/ingest-hf` form validates input
- [ ] Validation preview shows correct info
- [ ] Dry run completes without saving
- [ ] Live ingestion saves correct data to DB
- [ ] Progress bar updates in real-time
- [ ] Error handling works (bad URL, no token, etc.)
- [ ] Ingestion history displays past runs
- [ ] Build succeeds with no TypeScript errors
- [ ] No console errors in browser

---

## 10. Success Criteria

**The implementation is complete when:**
1. User can navigate to `/admin` and see admin hub
2. User can click "Dataset Ingestion" → go to `/admin/ingest-hf`
3. User fills form, clicks "Validate", sees preview
4. User clicks "Start Ingestion", sees real-time progress
5. After completion, sees detailed results
6. User can view ingestion history
7. All data mappings match CLI script fixes
8. No wedged features - each page has ONE responsibility

---

## Appendix: Example User Flow

**Scenario:** User wants to ingest Claude Sonnet 4.5 thinking-32k results

1. Navigate to `/admin`
2. Click "Dataset Ingestion" card
3. Lands on `/admin/ingest-hf`
4. Form pre-filled with defaults
5. User changes limit to `10` (testing)
6. User enables "Dry Run"
7. User clicks "Validate Configuration"
8. Modal shows: ✓ All checks passed, 10 puzzles will be processed
9. User clicks "Start Ingestion"
10. Progress bar animates, logs stream in real-time
11. After 30 seconds: "Ingestion Complete (Dry Run)"
12. User sees: 10 puzzles, 20 entries would be saved, 85% accuracy
13. User satisfied, unchecks "Dry Run", clicks "Start Ingestion" again
14. After 30 seconds: "Ingestion Complete - 20 entries saved to database"
15. User clicks "View Ingested Data" → filters to this dataset's explanations

**Total time:** 2 minutes
**User satisfaction:** High - clear, guided, informative

---

## Document Status

**Status:** Ready for Implementation
**Next Step:** Implement Phase 1 (Backend)
**Estimated Effort:** 8-12 hours for complete implementation
