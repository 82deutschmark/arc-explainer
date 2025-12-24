# HuggingFace Model Automation & Latest Model Surfacing Plan

**Author:** Claude Code (Haiku 4.5)
**Date:** 2025-12-24  NEEDS AUDIT
**Purpose:** Automate HuggingFace model ingestion and surface the latest ingested model prominently on the Analytics Dashboard.

**Current State:** HuggingFace model ingestion is 100% manual—a developer must navigate to the HuggingFaceIngestion page, select folders, and click "Start Ingestion." The latest model is not explicitly surfaced on AnalyticsOverview.

**Goal:** Implement autonomous ingestion detection (new models trigger automatic imports) and prominently display the latest ingested model on AnalyticsOverview.

---

## Architecture Overview

### Current Data Flow

1. **HuggingFace Datasets** (`https://huggingface.co/arcprize/arc-agi`)
   ↓
2. **Manual Ingestion** (Admin UI: `client/src/pages/HuggingFaceIngestion.tsx`)
   ↓
3. **Backend Script** (`server/scripts/ingest-huggingface-dataset.ts`)
   - Fetches predictions from HF via `HF_TOKEN` env var
   - Validates against expected outputs
   - Aggregates multi-test predictions into 2 database entries (attempt1, attempt2)
   ↓
4. **Database** (`explanations` table)
   - Stores with `prompt_template_id = 'external-huggingface'`
   - Model name includes `-attempt1` or `-attempt2` suffix
   - Fields: `multiple_predicted_outputs`, `multi_test_results`, `multi_test_all_correct`, `estimated_cost`, `api_processing_time_ms`
   ↓
5. **Analytics Dashboard** (`client/src/pages/AnalyticsOverview.tsx`)
   - Queries available models via `useAvailableModels()` hook
   - User manually selects from dropdown (hardcoded preferences)

### Key Database Tables

- **explanations:** Stores model predictions with HF-specific fields
  - `prompt_template_id` = 'external-huggingface' (identifies HF imports)
  - `model_name` = model folder name with `-attempt1` or `-attempt2` suffix
  - `created_at` (when record was inserted)

- **ingestion_runs:** Audit trail of ingestion jobs
  - Fields: `dataset_name`, `base_url`, `source` (ARC1, ARC2-Eval, etc.)
  - Fields: `total_puzzles`, `successful`, `failed`, `skipped`, `duration_ms`, `accuracy_percent`
  - Timestamps: `started_at`, `completed_at`

---

## Implementation Plan

### Phase 1: Surface Latest Model on Dashboard

#### Step 1A: Add `ingested_at` Timestamp to Database Schema

**File to Modify:** `server/repositories/database/DatabaseSchema.ts` (lines ~80-150, the `explanations` table definition)

**Change Required:**
- Add a new column: `ingested_at: timestamp | null`
- This tracks when a prediction was ingested from HuggingFace
- Only populated for `prompt_template_id = 'external-huggingface'` records
- Use `created_at` as fallback if not explicitly set

**Migration Required:**
- Create a Drizzle migration file: `server/repositories/database/migrations/{timestamp}_add_ingested_at_to_explanations.ts`
- Migration should add the column with default `null`
- Backfill existing HF imports: `UPDATE explanations SET ingested_at = created_at WHERE prompt_template_id = 'external-huggingface'`

**Command to run after changes:**
```bash
npm run db:push
```

#### Step 1B: Update Ingestion Script to Set `ingested_at`

**File to Modify:** `server/scripts/ingest-huggingface-dataset.ts` (lines ~200-350, where predictions are inserted into DB)

**Change Required:**
- When inserting into `explanations` table, include `ingested_at: new Date()`
- This ensures all new HF imports are timestamped with ingestion time

#### Step 1C: Create Backend Endpoint to Get Latest Model

**File to Create:** `server/services/latestModelService.ts` (new file)

**Purpose:** Query logic to find the latest ingested HuggingFace model

**Implementation:**
```typescript
// Export function: getLatestHFModel()
// Query:
//   SELECT model_name, ingested_at
//   FROM explanations
//   WHERE prompt_template_id = 'external-huggingface'
//   ORDER BY ingested_at DESC
//   LIMIT 1

// Return: { modelName: string; ingestedAt: Date; daysAgo: number }
```

**Dependency:** Use existing `ExplanationRepository` pattern (see `server/repositories/explanationRepository.ts`)

#### Step 1D: Add API Endpoint to Expose Latest Model

**File to Modify:** `server/controllers/metricsController.ts` (or create `server/controllers/latestModelController.ts`)

**Endpoint to Add:**
```
GET /api/metrics/latest-model
```

**Response:**
```json
{
  "success": true,
  "data": {
    "modelName": "gemini-3-flash-preview-thinking-high-attempt1",
    "ingestedAt": "2025-12-24T14:32:00Z",
    "daysAgo": 2,
    "displayLabel": "Latest: Gemini 3.5 Flash (2 days ago)"
  }
}
```

**File to Modify:** `server/routes.ts` (lines ~280-300, where other `/api/metrics/` endpoints are registered)

**Change Required:**
- Register the new endpoint: `app.get('/api/metrics/latest-model', latestModelController.getLatestModel)`

#### Step 1E: Create React Hook for Latest Model

**File to Create:** `client/src/hooks/useLatestHFModel.ts` (new file)

**Purpose:** React Query hook to fetch latest model data

**Implementation:**
```typescript
export function useLatestHFModel() {
  return useQuery({
    queryKey: ['latestHFModel'],
    queryFn: async () => {
      const res = await fetch('/api/metrics/latest-model');
      if (!res.ok) throw new Error('Failed to fetch latest model');
      const data = await res.json();
      return data.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
```

#### Step 1F: Update AnalyticsOverview to Display Latest Model

**File to Modify:** `client/src/pages/AnalyticsOverview.tsx` (lines ~270-295, the header section)

**Changes Required:**

1. Import the new hook:
   ```typescript
   import { useLatestHFModel } from '@/hooks/useLatestHFModel';
   ```

2. Call the hook:
   ```typescript
   const { data: latestModel, isLoading: loadingLatestModel } = useLatestHFModel();
   ```

3. Add a hero card below the main header (around line 294) to display:
   ```
   "Latest Ingested Model: [Model Name]"
   "Ingested: [X days ago]"
   Button: "Use This Model" (pre-selects it in the dropdown)
   ```

4. When "Use This Model" is clicked:
   ```typescript
   setSelectedModelForDataset(latestModel.modelName);
   ```

---

### Phase 2: Implement Autonomous HuggingFace Ingestion Detection

#### Step 2A: Create Model Sync Service

**File to Create:** `server/services/hfModelSyncService.ts` (new file)

**Purpose:** Detect new models on HuggingFace and determine which need ingestion

**Core Function:**
```typescript
export async function detectNewHFModels(): Promise<{
  allModels: string[];
  newModels: string[];
  alreadyIngested: string[];
}> {
  // 1. Fetch available folders from HuggingFace repo
  //    (use the existing listHFFolders() pattern from adminController.ts)

  // 2. Query database for already-ingested models
  //    SELECT DISTINCT SUBSTRING(model_name, 1, LENGTH(model_name) - 9) AS base_name
  //    FROM explanations
  //    WHERE prompt_template_id = 'external-huggingface'

  // 3. Return diff: new = allModels - alreadyIngested
}
```

**Dependencies:**
- Use existing `ExplanationRepository` to query ingested models
- Use existing HuggingFace API fetching logic from `adminController.ts` (lines ~240-270)

#### Step 2B: Create Sync Command Script

**File to Create:** `server/scripts/sync-hf-models.ts` (new file)

**Purpose:** CLI command that developers/cron jobs can execute to detect and optionally ingest new models

**Behavior:**
```bash
npm run sync-hf-models --check-only      # Just list new models, don't ingest
npm run sync-hf-models --auto-ingest     # Detect and auto-ingest new models
npm run sync-hf-models --auto-ingest --verbose  # With logging
```

**Implementation:**
1. Call `detectNewHFModels()` from hfModelSyncService
2. If `--check-only`: Print results and exit
3. If `--auto-ingest`: For each new model, call the existing ingestion script
   - Use the code pattern from `ingest-huggingface-dataset.ts` (lines ~1-50, the function signature)
   - Call it for each new model folder
   - Log success/failure for each

**File to Modify:** `package.json` (scripts section)

**Change Required:** Add new script:
```json
"sync-hf-models": "ts-node server/scripts/sync-hf-models.ts"
```

#### Step 2C: Create Cron Job Service

**File to Create:** `server/services/cronJobManager.ts` (new file)

**Purpose:** Manages scheduled ingestion syncs

**Implementation:**
```typescript
import cron from 'node-cron';

export function initializeCronJobs() {
  // Schedule nightly sync at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('[CRON] Starting HuggingFace model sync...');
    try {
      const { newModels } = await detectNewHFModels();
      if (newModels.length > 0) {
        console.log(`[CRON] Found ${newModels.length} new models, starting ingestion...`);
        // Trigger auto-ingestion
        await autoIngestNewModels(newModels);
        console.log('[CRON] Ingestion completed');
      } else {
        console.log('[CRON] No new models found');
      }
    } catch (error) {
      console.error('[CRON] Error during sync:', error);
      // TODO: Send alert (email, Slack, etc.)
    }
  });
}
```

**Dependencies:**
- Install `node-cron` package if not already installed
- Call `initializeCronJobs()` during server startup in `server.ts` (lines ~1-30)

**File to Modify:** `server.ts` (around lines 20-40, after Express app initialization)

**Change Required:**
```typescript
// Add this after other initialization
import { initializeCronJobs } from './services/cronJobManager';
initializeCronJobs();
```

#### Step 2D: Create Cron Status Endpoint (Optional but Recommended)

**File to Modify:** `server/controllers/adminController.ts` (add new function)

**Endpoint to Add:** `GET /api/admin/cron-status`

**Purpose:** Allow dashboard to show when next scheduled sync will run

**Response:**
```json
{
  "cronEnabled": true,
  "nextRun": "2025-12-25T02:00:00Z",
  "lastRun": "2025-12-24T02:15:30Z",
  "lastStatus": "success",
  "lastNewModelsFound": 2
}
```

**File to Modify:** `server/routes.ts` (lines ~280-300)

**Change Required:**
- Register endpoint: `app.get('/api/admin/cron-status', adminController.getCronStatus)`

#### Step 2E: Update Ingestion History UI (Frontend Enhancement)

**File to Modify:** `client/src/pages/HuggingFaceIngestion.tsx` (around lines ~150-250, the ingestion history table)

**Changes Required:**
1. Add a new column to the ingestion history table: "Auto-Triggered" (boolean)
2. Add filter/sort: show recent ingestions, highlight auto-triggered ones
3. Add a badge to show "Next scheduled sync: [date/time]" (fetch from `GET /api/admin/cron-status`)
4. Add explanatory text: "New models are automatically detected and ingested nightly at 2 AM UTC"

---

### Phase 3: Configuration & Environment

#### Step 3A: Document Environment Variables

**File to Modify (or create):** `docs/DEPLOYMENT.md` or `.env.example`

**Variables Required:**
```
HF_TOKEN=your_huggingface_token_here  # Already required for ingestion
ENABLE_CRON_JOBS=true                 # New: Control whether cron runs in production
HF_SYNC_SCHEDULE="0 2 * * *"          # New: Cron expression (default: 2 AM UTC)
HF_SYNC_AUTO_INGEST=true              # New: Auto-ingest when sync runs
```

#### Step 3B: Add Feature Flag (Optional)

**File to Modify:** `server/config/featureFlags.ts` (if it exists, or create it)

**Purpose:** Allow toggling auto-ingestion on/off without code changes

**Implementation:**
```typescript
export const FEATURES = {
  AUTO_INGEST_HF_MODELS: process.env.HF_SYNC_AUTO_INGEST === 'true',
  HF_MODEL_CRON_ENABLED: process.env.ENABLE_CRON_JOBS === 'true',
};
```

---

## Files Summary

### Files to Create (New)
1. `server/services/latestModelService.ts` — Query latest HF model
2. `server/services/hfModelSyncService.ts` — Detect new models on HF
3. `server/services/cronJobManager.ts` — Manage scheduled syncs
4. `server/scripts/sync-hf-models.ts` — CLI command for manual/scheduled sync
5. `client/src/hooks/useLatestHFModel.ts` — React hook to fetch latest model
6. `server/repositories/database/migrations/{timestamp}_add_ingested_at_to_explanations.ts` — DB migration

### Files to Modify
1. `server/repositories/database/DatabaseSchema.ts` — Add `ingested_at` column to explanations table
2. `server/scripts/ingest-huggingface-dataset.ts` — Set `ingested_at` when inserting
3. `server/controllers/metricsController.ts` or new `server/controllers/latestModelController.ts` — Add GET /api/metrics/latest-model
4. `server/controllers/adminController.ts` — Add getCronStatus function
5. `server/routes.ts` — Register new endpoints (latest-model, cron-status)
6. `server.ts` — Initialize cron jobs on startup
7. `client/src/pages/AnalyticsOverview.tsx` — Display latest model hero card
8. `client/src/pages/HuggingFaceIngestion.tsx` — Show cron status, highlight auto-triggered runs
9. `package.json` — Add `sync-hf-models` npm script
10. `.env.example` or `docs/DEPLOYMENT.md` — Document new env vars

---

## Implementation Sequence (Recommended Order)

### Order 1: Database & Core Services
1. Create migration file and add `ingested_at` to schema
2. Run `npm run db:push` to apply migration
3. Create `latestModelService.ts`
4. Create `hfModelSyncService.ts`

### Order 2: Backend API
5. Create/modify controllers (metricsController + adminController)
6. Register endpoints in `server/routes.ts`
7. Verify with Postman/curl

### Order 3: Frontend
8. Create `useLatestHFModel.ts` hook
9. Update `AnalyticsOverview.tsx` to display latest model card
10. Update `HuggingFaceIngestion.tsx` to show auto-ingestion status

### Order 4: Automation
11. Create `cronJobManager.ts`
12. Create `sync-hf-models.ts` script
13. Update `server.ts` to initialize cron
14. Add npm script to `package.json`

### Order 5: Configuration & Testing
15. Document env vars
16. Test cron job manually: `npm run sync-hf-models --check-only`
17. Test full flow end-to-end

---

## Testing Checklist

- [ ] Migration runs without errors
- [ ] `npm run db:push` completes successfully
- [ ] `GET /api/metrics/latest-model` returns latest model name + timestamp
- [ ] Latest model card appears on AnalyticsOverview
- [ ] "Use This Model" button pre-selects the model in dropdown
- [ ] `npm run sync-hf-models --check-only` lists new models correctly
- [ ] Cron job can be triggered manually: check logs for "[CRON]" messages
- [ ] When a new model is added to HF, cron detects it and ingests it within the next sync window
- [ ] Ingestion history shows "Auto-Triggered: true" for cron-initiated jobs
- [ ] No errors in server logs during cron execution

---

## Decision Points for Developer

**Before starting implementation, clarify with user:**

1. **Latest Model Display Preference:**
   - As a sticky hero card at top of AnalyticsOverview? (recommended)
   - As a badge in the model selector dropdown?
   - Both?

2. **Auto-Ingestion Scope:**
   - Auto-ingest ONLY new models not in DB?
   - Also re-ingest existing models periodically to pick up updates?
   - Only sync on manual trigger?

3. **Notification Preference:**
   - When ingestion fails, should system alert?
   - Via email, Slack webhook, or just server logs?

4. **Scheduling:**
   - Nightly at 2 AM UTC is default—acceptable?
   - Any blackout times (e.g., don't run during business hours)?

5. **Fallback on Cron Failure:**
   - If cron fails to run (e.g., server downtime), should there be a catch-up mechanism?

---

## Notes for Developer

- **Existing Patterns:** This plan reuses established patterns:
  - Repository pattern for DB queries (see `ExplanationRepository.ts`)
  - React Query hooks (see `useAvailableModels()` in `useModelDatasetPerformance.ts`)
  - Admin endpoint pattern (see existing endpoints in `adminController.ts`)

- **Backward Compatibility:** All changes are additive; no breaking changes to existing code

- **Error Handling:** Cron jobs should not crash the server if ingestion fails; wrap in try/catch with logging

- **Performance:** Latest model query runs on every dashboard load; consider caching for 5 minutes (included in hook example)

- **Database:** Ensure migration runs during deployment; coordinate with DevOps if needed

---

## References

- **Ingestion Script:** `server/scripts/ingest-huggingface-dataset.ts`
- **Admin Controller:** `server/controllers/adminController.ts` (lines 240-270 for HF API pattern)
- **Database Schema:** `server/repositories/database/DatabaseSchema.ts` (lines 80-150)
- **Analytics Page:** `client/src/pages/AnalyticsOverview.tsx`
- **Ingestion UI:** `client/src/pages/HuggingFaceIngestion.tsx`
- **ExplanationRepository:** `server/repositories/explanationRepository.ts` (reference for DB queries)
- **useModelDatasetPerformance Hook:** `client/src/hooks/useModelDatasetPerformance.ts` (reference for React Query pattern)

