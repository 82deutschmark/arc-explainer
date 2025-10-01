# HuggingFace Dataset Ingestion Plan
**Author:** Cascade using Claude Sonnet 4  
**Date:** 2025-09-30  
**Purpose:** Recurring ingestion of external AI model predictions from HuggingFace datasets into our explanations database with full validation

---

## Executive Summary

**Problem:** External AI model predictions (like Claude Sonnet 4.5) are published to HuggingFace but need to be ingested into our database to:
1. Compare against our internal AI model performance
2. Populate accuracy leaderboards with external benchmarks
3. Track state-of-the-art model capabilities over time

**Solution:** Two-phase approach:
- **Phase 1:** Proof-of-concept CLI script that validates and ingests one dataset
- **Phase 2:** GUI integration at `/model-config` for recurring weekly/monthly ingestion

**Critical Requirement:** MUST validate predictions against actual puzzle solutions BEFORE saving to database. This ensures `is_prediction_correct`, `multi_test_all_correct`, and accuracy scores are calculated correctly for leaderboards.

---

## Phase 1: Proof-of-Concept CLI Script

### Architecture Overview

```
HuggingFace JSON → Load Puzzle → Validate → Enrich → Save to DB
                         ↓             ↓          ↓
                   puzzleLoader  responseValidator  repositoryService
```

### Script Location & Name
`server/scripts/ingest-huggingface-dataset.ts`

### HuggingFace Data Structure Analysis

Based on inspection of `claude-sonnet-4-5-20250929/00576224.json`:

```typescript
interface HuggingFaceAttempt {
  answer: number[][];  // The predicted output grid
  metadata: {
    model: string;  // e.g., "claude-sonnet-4-5-20250929"
    provider: string;  // e.g., "anthropic"
    start_timestamp: string;
    end_timestamp: string;
    choices: [...];  // Contains prompt and response
  };
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: {
    prompt_cost: number;
    completion_cost: number;
    total_cost: number;
  };
  task_id: string;  // Maps to our puzzle_id
  pair_index: number;  // For multi-test puzzles (0, 1, 2...)
  test_id: string;  // Dataset identifier
  correct: boolean | null;  // We'll recalculate this ourselves
}

interface HuggingFaceDataset {
  attempt_1: HuggingFaceAttempt;
  attempt_2?: HuggingFaceAttempt;
  attempt_3?: HuggingFaceAttempt;
  // ... up to N attempts for multi-test puzzles
}
```

### Script Responsibilities (SRP Compliance)

**1. Dataset Download & Loading**
- Accept HuggingFace dataset URL/path as CLI argument
- Download JSON files to temporary directory
- Parse JSON structure per file

**2. Puzzle Matching**
- Map `task_id` → `puzzle_id` in our system
- Load original puzzle JSON using `puzzleLoader.loadPuzzle(puzzleId)`
- Handle puzzles not found in our local datasets (log warning, skip)

**3. Multi-Test Detection**
- Check for `attempt_1`, `attempt_2`, etc. in JSON
- Determine if single-test or multi-test puzzle
- Extract all prediction grids

**4. Validation (CRITICAL)**
- For single-test: Use `responseValidator.validatePrediction()`
  - Compare `answer` array vs `puzzleData.test[0].output`
  - Calculate `isPredictionCorrect` (exact match boolean)
  - Calculate `predictionAccuracyScore` (cell-by-cell accuracy 0.0-1.0)

- For multi-test: Use `responseValidator.validateMultipleTestPredictions()`
  - Map each `attempt_N.answer` to test case N
  - Validate each against `puzzleData.test[N].output`
  - Calculate `multiTestAllCorrect` (all must match)
  - Calculate `multiTestAverageAccuracy` (average across all tests)
  - Populate `multiTestResults` array with per-test validation

**5. Data Enrichment**
- Map HuggingFace structure → ExplanationData interface:
  ```typescript
  {
    puzzleId: task_id,
    modelName: metadata.model,
    predictedOutputGrid: answer (for single-test),
    isPredictionCorrect: validation.isPredictionCorrect,
    predictionAccuracyScore: validation.predictionAccuracyScore,
    
    // Multi-test fields
    hasMultiplePredictions: boolean,
    multiplePredictedOutputs: [attempt_1.answer, attempt_2.answer, ...],
    multiTestPredictionGrids: [...],
    multiTestResults: validation.multiTestResults,
    multiTestAllCorrect: validation.multiTestAllCorrect,
    multiTestAverageAccuracy: validation.multiTestAverageAccuracy,
    
    // Token usage
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    
    // Cost
    estimatedCost: cost.total_cost,
    
    // Timing
    apiProcessingTimeMs: calculateTimeDiff(start_timestamp, end_timestamp),
    
    // Metadata
    providerRawResponse: JSON.stringify(originalJSON),
    patternDescription: "External dataset import - no analysis provided",
    solvingStrategy: null,
    hints: [],
    confidence: null,  // External predictions don't include confidence
    
    // Prompt tracking
    systemPromptUsed: metadata.choices[0]?.message?.content,
    userPromptUsed: null,
    promptTemplateId: "external-huggingface",
    customPromptText: null
  }
  ```

**6. Database Save**
- Use `repositoryService.explanations.saveExplanation(enrichedData)`
- Handle duplicate detection (puzzle_id + model_name uniqueness)
- Log success/failure per puzzle

**7. Error Handling**
- Validation failures: Log detailed error, skip puzzle, continue
- Database errors: Log error, skip puzzle, continue
- Network errors: Retry with exponential backoff
- Generate summary report at end

### Script CLI Interface

```bash
# Basic ingestion
npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --source huggingface

# With custom download path
npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --source local --path ./downloaded-data

# Dry run (validate without saving)
npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --dry-run

# Verbose logging
npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --verbose

# Skip duplicates (default behavior)
npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --skip-duplicates

# Force overwrite duplicates
npm run ingest-hf -- --dataset claude-sonnet-4-5-20250929 --force-overwrite
```

### Configuration Interface

```typescript
interface IngestionConfig {
  datasetName: string;  // e.g., "claude-sonnet-4-5-20250929"
  source: 'huggingface' | 'local';
  localPath?: string;
  dryRun: boolean;
  verbose: boolean;
  skipDuplicates: boolean;
  forceOverwrite: boolean;
  huggingFaceUrl?: string;  // Auto-constructed if not provided
}
```

### Validation Flow (Matches Existing Architecture)

```typescript
// This EXACTLY matches how puzzleAnalysisService validates:
async function validateAndEnrich(
  hfData: HuggingFaceDataset,
  puzzleData: ARCTask,
  config: IngestionConfig
): Promise<ExplanationData> {
  
  const isSingleTest = !hfData.attempt_2;
  
  if (isSingleTest) {
    // Single-test validation
    const validation = await responseValidator.validatePrediction(
      { predictedOutput: hfData.attempt_1.answer },
      puzzleData.test[0].output,
      null  // no confidence for external data
    );
    
    return {
      ...baseFields,
      predictedOutputGrid: validation.predictedGrid,
      isPredictionCorrect: validation.isPredictionCorrect,
      predictionAccuracyScore: validation.predictionAccuracyScore,
      hasMultiplePredictions: false,
      multiplePredictedOutputs: null,
      multiTestResults: null,
      multiTestAllCorrect: null,
      multiTestAverageAccuracy: null
    };
    
  } else {
    // Multi-test validation
    const attempts = extractAllAttempts(hfData);
    const expectedOutputs = puzzleData.test.map(t => t.output);
    
    const multiValidation = await responseValidator.validateMultipleTestPredictions(
      { multiplePredictedOutputs: attempts },
      expectedOutputs,
      null  // no confidence
    );
    
    return {
      ...baseFields,
      predictedOutputGrid: attempts[0],  // First prediction as primary
      isPredictionCorrect: multiValidation.multiTestAllCorrect,
      predictionAccuracyScore: multiValidation.multiTestAverageAccuracy,
      hasMultiplePredictions: true,
      multiplePredictedOutputs: attempts,
      multiTestPredictionGrids: multiValidation.multiTestPredictionGrids,
      multiTestResults: multiValidation.multiTestResults,
      multiTestAllCorrect: multiValidation.multiTestAllCorrect,
      multiTestAverageAccuracy: multiValidation.multiTestAverageAccuracy
    };
  }
}
```

### Progress Reporting

```typescript
interface IngestionProgress {
  total: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  validationErrors: number;
  databaseErrors: number;
  currentPuzzle: string | null;
  startTime: Date;
  estimatedCompletion: Date | null;
}
```

Console output during ingestion:
```
🔄 HuggingFace Dataset Ingestion
════════════════════════════════════════════════════════════
Dataset: claude-sonnet-4-5-20250929
Source: HuggingFace
Total Puzzles: 400
════════════════════════════════════════════════════════════

[001/400] ✅ 00576224 - Validated & Saved (single-test, correct)
[002/400] ✅ 009d5c81 - Validated & Saved (multi-test, 2/3 correct)
[003/400] ⚠️  00d62c1b - Skipped (duplicate exists)
[004/400] ❌ 017c7c7b - Validation Failed (grid dimension mismatch)
[005/400] ✅ 025d127b - Validated & Saved (single-test, incorrect)
...

════════════════════════════════════════════════════════════
INGESTION SUMMARY
════════════════════════════════════════════════════════════
Total Processed: 400
✅ Successful: 387
⚠️  Skipped (duplicates): 8
❌ Failed: 5
  - Validation errors: 3
  - Database errors: 2
  - Puzzle not found: 0

Accuracy Statistics:
  - Single-test correct: 145/287 (50.5%)
  - Multi-test all correct: 23/100 (23.0%)
  - Average accuracy score: 0.614

Duration: 2m 34s
Saved to database: 387 new explanations
════════════════════════════════════════════════════════════
```

### Error Handling Strategy

**1. Puzzle Not Found Locally**
- Log warning with puzzle ID
- Increment `skipped` counter
- Continue to next puzzle
- Add to summary report

**2. Validation Failure**
- Log detailed error (expected vs actual dimensions, etc.)
- Do NOT save to database
- Increment `validationErrors` counter
- Continue to next puzzle

**3. Database Save Failure**
- Log error with full stack trace
- Increment `databaseErrors` counter
- Continue to next puzzle
- Option to generate retry list

**4. Duplicate Detection**
- Query: `SELECT id FROM explanations WHERE puzzle_id = ? AND model_name = ?`
- If `skipDuplicates` flag: Log and skip
- If `forceOverwrite` flag: Delete existing, insert new
- Default behavior: Skip duplicates

**5. Network/Download Errors**
- Retry 3 times with exponential backoff (1s, 2s, 4s)
- If all retries fail, abort with error message
- Suggest using `--source local` with pre-downloaded data

---

## Phase 2: GUI Integration at `/model-config`

### Design Philosophy
Follow the existing Model Management page pattern but add a new "Dataset Ingestion" tab/section.

### UI Components (shadcn/ui)

**New Route:** `/model-config` (already exists, extend it)

**New Tab/Section:** "External Datasets"

**Layout Structure:**
```
┌─────────────────────────────────────────────────────────┐
│ Model Configuration                                      │
├─────────────────────────────────────────────────────────┤
│ [Models] [External Datasets] ← New Tab                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📦 Import External Predictions                          │
│  ────────────────────────────────────────────────────── │
│                                                          │
│  Dataset Source:                                         │
│  ○ HuggingFace  ● Local Upload                          │
│                                                          │
│  Dataset Name: [claude-sonnet-4-5-20250929        ▼]    │
│                                                          │
│  Or upload ZIP: [Choose File]                           │
│                                                          │
│  Options:                                                │
│  ☑ Skip existing duplicates                             │
│  ☐ Verbose logging                                      │
│  ☐ Dry run (preview only)                               │
│                                                          │
│  [Start Ingestion]                                       │
│                                                          │
│  ────────────────────────────────────────────────────── │
│                                                          │
│  📊 Recent Ingestions                                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ claude-sonnet-4.5     2025-09-29  387/400  98%  │  │
│  │ gpt-5-mini           2025-09-25  400/400 100%   │  │
│  │ gemini-2.0-flash     2025-09-20  395/400  99%   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Real-Time Progress Display

During ingestion, replace the form with a live progress view:

```
┌─────────────────────────────────────────────────────────┐
│  ⚡ Ingesting claude-sonnet-4-5-20250929                 │
│  ────────────────────────────────────────────────────── │
│                                                          │
│  [████████████████░░░░░░░░░░░░] 245 / 400 (61%)        │
│                                                          │
│  Current: Processing puzzle 1d398264...                 │
│  Elapsed: 1m 23s  │  Remaining: ~1m 12s                 │
│                                                          │
│  ✅ Successful: 237                                      │
│  ⚠️  Skipped: 5                                          │
│  ❌ Failed: 3                                            │
│                                                          │
│  [View Detailed Log]  [Cancel]                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Backend API Endpoints

**New Controller:** `server/controllers/datasetIngestionController.ts`

**Endpoints:**

1. **POST `/api/dataset-ingestion/start`**
   - Body: `{ datasetName, source, options }`
   - Returns: `{ jobId, message }`
   - Starts background job, returns immediately

2. **GET `/api/dataset-ingestion/status/:jobId`**
   - Returns: IngestionProgress object
   - Polled every 2 seconds by frontend

3. **GET `/api/dataset-ingestion/history`**
   - Returns: List of past ingestion jobs
   - Includes completion status, stats, timestamps

4. **POST `/api/dataset-ingestion/cancel/:jobId`**
   - Cancels running ingestion job
   - Returns: `{ cancelled: boolean, reason? }`

5. **GET `/api/dataset-ingestion/available-datasets`**
   - Returns: List of known HuggingFace datasets
   - Could scrape from HuggingFace API or use hardcoded list

6. **POST `/api/dataset-ingestion/upload`**
   - Multipart form upload of ZIP file
   - Extracts to temp directory
   - Returns: `{ path, fileCount }`

### Background Job Architecture

**Why Background Jobs?**
Ingestion can take 2-5 minutes for 400 puzzles. Can't block HTTP request.

**Implementation Options:**

**Option A: Simple In-Memory Queue (Recommended for PoC)**
```typescript
// server/services/ingestionQueue.ts
class IngestionQueue {
  private jobs: Map<string, IngestionJob> = new Map();
  
  async enqueue(config: IngestionConfig): Promise<string> {
    const jobId = generateUUID();
    const job = new IngestionJob(jobId, config);
    this.jobs.set(jobId, job);
    job.start();  // Fire and forget
    return jobId;
  }
  
  getStatus(jobId: string): IngestionProgress | null {
    return this.jobs.get(jobId)?.progress || null;
  }
  
  cancel(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job) {
      job.cancel();
      return true;
    }
    return false;
  }
}
```

**Option B: Database-Backed Queue (Future Enhancement)**
- Create `ingestion_jobs` table
- Store progress in database
- Survives server restarts
- Can resume failed jobs

**Option C: Bull/BullMQ with Redis (Enterprise)**
- Overkill for hobby project
- Skip for now

### Frontend State Management

**React Query for API calls:**
```typescript
// Start ingestion
const startMutation = useMutation({
  mutationFn: (config: IngestionConfig) => 
    fetch('/api/dataset-ingestion/start', {
      method: 'POST',
      body: JSON.stringify(config)
    }),
  onSuccess: (data) => {
    setJobId(data.jobId);
    setIsIngesting(true);
  }
});

// Poll for progress
const { data: progress } = useQuery({
  queryKey: ['ingestion-progress', jobId],
  queryFn: () => fetch(`/api/dataset-ingestion/status/${jobId}`),
  enabled: isIngesting && !!jobId,
  refetchInterval: 2000  // Poll every 2 seconds
});

// Cancel ingestion
const cancelMutation = useMutation({
  mutationFn: (jobId: string) =>
    fetch(`/api/dataset-ingestion/cancel/${jobId}`, { method: 'POST' })
});
```

### shadcn/ui Components Used

- **Card, CardHeader, CardTitle, CardContent** - Main container
- **Tabs, TabsList, TabsTrigger, TabsContent** - Navigation
- **Button** - Actions
- **Input** - Text fields
- **Select** - Dropdown for dataset selection
- **Checkbox** - Options
- **Progress** - Progress bar
- **Badge** - Status indicators
- **Alert, AlertDescription** - Error messages
- **Separator** - Visual dividers
- **ScrollArea** - Log viewer

### File Upload Handling

**Frontend:**
```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('dataset', file);
  
  const response = await fetch('/api/dataset-ingestion/upload', {
    method: 'POST',
    body: formData
  });
  
  const { path, fileCount } = await response.json();
  
  // Update config to use local path
  setConfig({
    ...config,
    source: 'local',
    localPath: path
  });
};
```

**Backend (Express + Multer):**
```typescript
import multer from 'multer';
import unzipper from 'unzipper';

const upload = multer({ dest: 'temp/uploads/' });

router.post('/upload', upload.single('dataset'), async (req, res) => {
  const zipPath = req.file.path;
  const extractPath = `temp/extracted/${Date.now()}`;
  
  // Extract ZIP
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: extractPath }))
    .promise();
  
  // Count JSON files
  const files = await fs.readdir(extractPath);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  res.json({
    path: extractPath,
    fileCount: jsonFiles.length
  });
});
```

---

## Implementation Checklist

### Phase 1: PoC Script
- [ ] Create `server/scripts/ingest-huggingface-dataset.ts`
- [ ] Implement CLI argument parsing
- [ ] Implement HuggingFace JSON loader
- [ ] Integrate with `puzzleLoader` for matching
- [ ] Integrate with `responseValidator` for validation
- [ ] Map HF structure → ExplanationData
- [ ] Implement `repositoryService.explanations.saveExplanation()` call
- [ ] Add duplicate detection logic
- [ ] Implement progress reporting
- [ ] Add error handling for all failure modes
- [ ] Generate summary report
- [ ] Write npm script in package.json: `"ingest-hf": "tsx server/scripts/ingest-huggingface-dataset.ts"`
- [ ] Test with `claude-sonnet-4-5-20250929` dataset
- [ ] Document results in CHANGELOG.md

### Phase 2: GUI Integration
- [ ] Create `server/controllers/datasetIngestionController.ts`
- [ ] Create `server/services/ingestionQueue.ts`
- [ ] Add API routes to `server/routes.ts`
- [ ] Create `client/src/components/dataset-ingestion/IngestionForm.tsx`
- [ ] Create `client/src/components/dataset-ingestion/IngestionProgress.tsx`
- [ ] Create `client/src/components/dataset-ingestion/IngestionHistory.tsx`
- [ ] Extend `client/src/pages/ModelManagement.tsx` with new tab
- [ ] Add React Query hooks for API calls
- [ ] Add file upload handling (multer backend + FormData frontend)
- [ ] Test end-to-end ingestion flow
- [ ] Add cancel functionality
- [ ] Add error notifications (toast/alert)
- [ ] Document in CHANGELOG.md

---

## Testing Strategy

### PoC Testing
1. **Single Dataset Test**
   - Download 10 puzzles from HuggingFace manually
   - Run script: `npm run ingest-hf -- --source local --path ./test-data --verbose`
   - Verify all 10 puzzles saved to database
   - Check accuracy calculations are correct

2. **Duplicate Handling**
   - Run same dataset twice
   - Verify skip behavior works
   - Test `--force-overwrite` flag

3. **Multi-Test Validation**
   - Identify multi-test puzzle in dataset
   - Verify all attempts validated separately
   - Check `multiTestAllCorrect` logic

4. **Error Recovery**
   - Introduce malformed JSON
   - Verify script continues processing
   - Check error summary report

### GUI Testing
1. **Happy Path**
   - Select dataset from dropdown
   - Click "Start Ingestion"
   - Verify progress updates
   - Verify completion notification

2. **File Upload**
   - Upload ZIP file
   - Verify extraction
   - Run ingestion
   - Verify results

3. **Cancel Operation**
   - Start ingestion
   - Click cancel mid-process
   - Verify graceful stop
   - Check partial results saved

4. **Error Handling**
   - Start ingestion with no puzzles
   - Verify error message
   - Test network failure during download
   - Verify retry logic

---

## Database Impact Analysis

### Expected Volume
- Per dataset: ~400 puzzles
- Per model: 1 entry per puzzle
- Monthly ingestion: ~4 datasets = 1,600 new rows

### Storage Growth
- Each explanation row: ~5-10 KB (with JSON fields)
- 1,600 rows = ~8-16 MB per month
- Annual growth: ~96-192 MB
- **Verdict:** Negligible impact for hobby project

### Index Considerations
Existing indexes should handle this:
- `explanations(puzzle_id)` - Used for matching
- `explanations(model_name)` - Used for deduplication
- `explanations(puzzle_id, model_name)` - Composite index would be ideal

**Optimization Suggestion:**
```sql
CREATE INDEX IF NOT EXISTS idx_explanations_puzzle_model 
ON explanations(puzzle_id, model_name);
```

---

## Security Considerations

### File Upload Risks
1. **Malicious ZIP files**
   - Limit upload size to 50 MB
   - Scan for zip bombs
   - Validate extracted file count

2. **Path traversal**
   - Use safe extraction (unzipper library)
   - Validate extracted filenames
   - Extract to isolated temp directory

3. **Arbitrary JSON execution**
   - Use `JSON.parse()` only (no eval)
   - Validate JSON structure before processing

### API Rate Limiting
HuggingFace downloads:
- Use authenticated requests if available
- Implement exponential backoff
- Cache downloaded datasets locally

---

## Monitoring & Observability

### Metrics to Track
1. **Ingestion Success Rate**
   - Successful vs failed puzzles
   - Common failure reasons

2. **Validation Accuracy**
   - Percentage of correct predictions
   - Compare against internal models

3. **Processing Performance**
   - Average time per puzzle
   - Bottleneck identification

4. **Storage Growth**
   - Database size over time
   - Cleanup recommendations

### Logging Strategy
- Info: Progress updates, summary stats
- Warn: Skipped puzzles, duplicates
- Error: Validation failures, database errors
- Debug: Detailed JSON structures (verbose mode only)

---

## Future Enhancements

### v2 Features
1. **Scheduled Ingestion**
   - Cron job to check HuggingFace weekly
   - Auto-detect new datasets
   - Email notification on completion

2. **Comparison Dashboard**
   - Compare external vs internal models
   - Show accuracy delta
   - Identify puzzles where we outperform

3. **Batch Re-validation**
   - Re-run validation on existing entries
   - Fix historical accuracy calculations
   - Handle schema migrations

4. **Dataset Metadata Table**
   - Track ingestion history
   - Store dataset source URLs
   - Link to model configurations

---

## Success Criteria

### Phase 1 (PoC)
✅ Script successfully ingests 400 puzzles from HuggingFace  
✅ All predictions validated against actual puzzle solutions  
✅ Accuracy fields populated correctly in database  
✅ Duplicate detection works  
✅ Error handling prevents data corruption  
✅ Summary report is accurate and informative  

### Phase 2 (GUI)
✅ User can trigger ingestion from `/model-config` page  
✅ Real-time progress displayed accurately  
✅ File upload works for local datasets  
✅ Job cancellation works gracefully  
✅ History shows past ingestion results  
✅ No browser hangs during long ingestions  

---

## Timeline Estimate

**Phase 1 (PoC Script):**
- Core script: 3-4 hours
- Testing & debugging: 2-3 hours
- Documentation: 1 hour
- **Total: 6-8 hours**

**Phase 2 (GUI Integration):**
- Backend API: 2-3 hours
- Frontend components: 3-4 hours
- Integration & testing: 2-3 hours
- Polish & error handling: 1-2 hours
- **Total: 8-12 hours**

**Grand Total: 14-20 hours** (spread over multiple sessions)

---

## Key Differences from Other Dev's Plan

| Aspect | Other Dev's Plan | This Plan |
|--------|------------------|-----------|
| **Validation Timing** | After database save | Before database save ✅ |
| **Puzzle Loading** | Not mentioned | Required for validation ✅ |
| **Multi-Test Handling** | Vague "comparison pass" | Explicit validation logic ✅ |
| **Error Recovery** | Not specified | Comprehensive strategy ✅ |
| **GUI Integration** | Not planned | Phase 2 with `/model-config` ✅ |
| **SRP Compliance** | Unclear | Follows existing patterns ✅ |
| **Reusability** | One-time script | Recurring GUI workflow ✅ |

---

## Questions to Resolve Before Starting

1. **HuggingFace Access:** Do we need authentication for downloads? Or are datasets public?
2. **Model Name Normalization:** Should we use the HuggingFace dataset name as-is (`claude-sonnet-4-5-20250929`) or normalize to match our internal naming?
3. **Duplicate Strategy:** Default to skip or overwrite? (Recommendation: skip)
4. **Prompt Storage:** The HuggingFace data includes the full prompt text. Should we store this in `system_prompt_used` field?
5. **Confidence Field:** External data doesn't include confidence scores. Set to null or default value?
6. **Provider Mapping:** HuggingFace uses `"provider": "anthropic"`. Should we normalize to `"Anthropic"` (our convention)?

---

## Conclusion

This plan provides a robust, production-ready approach to ingesting external AI model predictions. The two-phase rollout ensures we validate the core logic in a controlled CLI environment before exposing it to users through the GUI. The architecture respects existing patterns, maintains SRP/DRY principles, and integrates seamlessly with the current codebase.

**Next Step:** Implement Phase 1 PoC script and run it on the `claude-sonnet-4-5-20250929` dataset to validate the approach.
