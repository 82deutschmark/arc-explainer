# Kaggle-style ARC Submission Interface Plan

**Author:** Cascade (ChatGPT)
**Date:** 2025-12-30
**Goal:** Replace the deprecated Kaggle Readiness Validation page with a Kaggle-style submission workflow where users upload ARC solution notebooks for offline evaluation against a private dataset.

---

## Executive Summary
- Build a single submission page where users upload `.ipynb` files, see their submission added to a queue, and later view the recorded score/results once processing completes.
- No streaming, live logs, or mid-run visibility—parity with Kaggle’s “queued → running → finished” experience.
- Kaggle Readiness Validation assets are removed entirely; the new page lives at `/submissions` and becomes the canonical entry point for ARC evaluations.
- Initial milestone excludes leaderboards; focus is on safe ingestion, deterministic scoring, and historical submission visibility for each user/session.

---

## Scope & Non-Goals

| In Scope | Out of Scope |
| --- | --- |
| Notebook upload, validation, storage, execution queueing, scoring, historical submission list | Real-time streaming/logs, live progress UI, public leaderboard, BYO dataset selection |
| Private ARC evaluation dataset execution | Arbitrary datasets or interactive debugging |
| Basic status polling (queued/running/completed/failed) | Websocket/SSE push updates |
| Submission quotas and sandboxing | Full multi-tenant auth (unless mandated later) |

---

## Inconsistencies Resolved
1. **Streaming vs. Batch:** Removed all SSE references; execution is strictly offline batch.
2. **Kaggle Readiness Page:** Fully deprecated; no shared routing or component reuse requirements remain.
3. **Leaderboard Scope:** Leaderboard postponed until scoring pipeline is proven; success criteria now reflect that.
4. **Auth vs. Anonymous:** Plan now treats `user_id` as optional (nullable) until we finalize identity strategy; session fingerprinting fills the gap short-term.
5. **Status Visibility:** UI only shows discrete states with timestamps (queued, running, completed, failed) rather than continuous progress bars/logs.

---

## System Overview
1. **Upload Service (API tier):** Receives `.ipynb`, validates metadata, stores raw file, creates DB row with `status='queued'`.
2. **Queue Broker:** Lightweight job queue (BullMQ/Redis or Drizzle-backed table) ensures workers pull submissions FIFO with retry policies.
3. **Execution Workers:** Node service orchestrating Python runner in Docker, ensures deterministic environment, enforces resource limits, and writes artifacts/logs to storage.
4. **Scoring Service:** Applies ARC Prize scoring (two attempts per pair, exact match) and aggregates metrics persisted back to DB.
5. **Frontend:** Single page for upload + submission history table with filters; users refresh or revisit to see updated statuses.

---

## User Flow
1. User visits `/submissions`.
2. Upload form accepts `.ipynb` ≤ 10 MB; user optionally inputs label/notes.
3. API returns submission ID; UI confirms “Queued” and stores ID locally for future lookups.
4. Worker picks submission, updates status “Running,” executes notebook in sandbox against private evaluation set.
5. Upon completion, score + per-task summary saved; status flips to “Completed” or “Failed” with failure reason.
6. User reloads page to see updated status/results table; no mid-run inspection.

---

## Frontend Deliverables
1. **`client/src/pages/ARCSubmissions.tsx`**
   - Layout: left column for upload form, right column for recent submissions (mobile stacks vertically).
   - Pulls data via `GET /api/submissions?limit=20`.
2. **Components**
   - `NotebookUploader.tsx`: file picker, validation messages, submission metadata (filename, size).
   - `SubmissionTable.tsx`: tabular history with columns (ID, submitted at, status, score, duration) plus “View details” action.
   - `SubmissionDetailsDrawer.tsx`: shows per-task breakdown and raw log excerpt after completion.
3. **State Handling**
   - Local optimistic row inserted immediately after upload (status = queued).
   - Background polling (every 30s) or manual refresh button; no SSE/WebSocket.
4. **Deprecation Cleanup**
   - Remove `client/src/pages/KaggleReadinessValidation.tsx` and its route, nav links, translation keys, tests.

---

## Backend/API Deliverables
1. **Endpoints**
   - `POST /api/submissions` – multipart upload (multer). Returns `{ submissionId }`.
   - `POST /api/submissions/:id/queue` – (optional) explicit “submit” after upload; default immediate queueing so we may omit.
   - `GET /api/submissions` – list submissions filtered by user/session with pagination.
   - `GET /api/submissions/:id` – returns metadata, status, score, and summary JSON.
   - `GET /api/submissions/:id/log` – truncated execution log/plaintext for post-mortem (completed/failed only).
2. **Controller/Service Files**
   - `server/controllers/submissionsController.ts`
   - `server/services/submissionService.ts`
   - `server/services/notebookExecutor.ts`
   - `server/services/arcScorer.ts`
   - `server/repositories/submissionsRepository.ts`
3. **Queue Integration**
   - `server/queues/submissionQueue.ts` (BullMQ or similar) to decouple worker from API thread.
4. **Validation Rules**
   - MIME/type sniffing, size limit, virus scan (ClamAV or Defender on Windows), block embedded secrets.

---

## Execution & Scoring Pipeline
1. **File Storage**
   - `data/submissions/{submission_id}/submission.ipynb`
   - Derived artifacts (stdout.log, stderr.log, results.json) stay in same directory.
2. **Sandbox**
   - Docker image `arc-submission-runner` with pinned Python + dependencies.
   - Resource caps: CPU 2 cores, RAM 8 GB, wall-clock timeout 30 min.
   - No outbound network except S3/GCS for dataset fetch (pre-mounted read-only).
3. **Notebook Runner**
   - Use `papermill` or `nbconvert` CLI to execute; fail if writes to disallowed paths.
4. **Scoring**
   - Worker loads outputs, computes per-task attempt results, writes `results_json` and normalized score.
   - Supports optional secondary metrics (duration, cells executed) for future leaderboard.
5. **Status Updates**
   - Queue worker updates DB statuses at lifecycle checkpoints; API simply reads these values.

---

## Data & Schema
```sql
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255), -- nullable until auth enforced
  session_fingerprint VARCHAR(255),
  notebook_file_path TEXT NOT NULL,
  status VARCHAR(32) NOT NULL, -- queued, running, completed, failed
  score NUMERIC(5,4),
  total_pairs INT,
  solved_pairs INT,
  failure_reason TEXT,
  results_json JSONB,
  log_path TEXT,
  submitted_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_submissions_user ON submissions(user_id);
CREATE INDEX idx_submissions_session ON submissions(session_fingerprint);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_score ON submissions(score DESC NULLS LAST);
```

Retention policy: store raw notebooks + logs for 30 days, aggregate results forever (or until user deletes).

---

## Security, Compliance, and Operations
1. **Sandboxing:** Docker with read-only datasets, no host volume mounts beyond submission folder, SELinux/AppArmor profile.
2. **Resource Limits:** Timeout, memory, disk quota per submission; terminate runaway kernels.
3. **Code Scanning:** Basic static lint (e.g., reject `os.system("curl ...")` attempts) plus antivirus scan before queueing.
4. **Secret Handling:** Notebooks cannot access environment secrets; run with empty env except dataset paths.
5. **Monitoring:** Metrics on queue depth, success/failure counts, average runtime; alerts for >X failures in Y minutes.
6. **Cleanup:** Nightly job purges expired artifacts and orphaned temporary files.
7. **Quotas:** Default 5 active submissions per user/session, configurable via env.

---

## Testing Strategy
1. **Unit Tests:** Upload validation, repository interactions, scoring math (two-attempt logic).
2. **Integration Tests:** Simulated worker executing a stub notebook, verifying DB transitions.
3. **End-to-End Smoke:** Use a minimal notebook that solves one ARC task to ensure scoring/regression detection.
4. **Failure Scenarios:** Corrupt notebook, timeout, deliberate exception, file too large.
5. **Load/Capacity:** Stress queue with concurrent uploads to measure worker throughput and disk impact.

---

## Migration Plan
1. Remove `KaggleReadinessValidation` page, routes, navigation references, and any feature flags guarding it.
2. Redirect `/kaggle-readiness-validation` to `/submissions` until clients update bookmarks.
3. Update documentation (README, docs/reference/frontend) to point to the new workflow.
4. Drop any legacy APIs or backend logic specific to readiness validation once the new endpoints ship.

---

## Open Questions
- Do we require authentication before allowing uploads, or will session fingerprint + email optional field suffice?
- What storage backend is preferred for notebook artifacts if disk space becomes a constraint (S3, Azure Blob, etc.)?
- Should we expose submission logs for failed runs to users, or keep them internal for now?
- Are there legal/privacy constraints around storing user-submitted notebooks indefinitely?

---

## Success Criteria (Milestone 1)
1. Users can upload `.ipynb` files and receive a submission ID.
2. Submissions are executed in a sandboxed environment against the private ARC evaluation set.
3. Scores are computed using ARC Prize methodology (two attempts per pair, exact match scoring).
4. Users can revisit `/submissions` to see historical submissions with accurate statuses and scores.
5. System gracefully handles invalid notebooks, oversize files, timeouts, and worker crashes without affecting other jobs.
6. Kaggle Readiness Validation path is removed and no longer exposed anywhere in the product.

Future milestone: add leaderboards, notifications, and richer analytics once the batch pipeline is stable.
