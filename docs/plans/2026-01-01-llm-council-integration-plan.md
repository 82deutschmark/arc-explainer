# LLM Council Integration Plan (new `/council` endpoint)

**Date**: 2026-01-01  
**Updated**: 2026-01-02 (Claude Sonnet 4) - Implemented subprocess integration (like Saturn/Grover)  
**Objective**: Ship a dedicated `/council` endpoint that lets the llm-council vote on two solutions for the same ARC task, deciding which is better or if both are bad/wrong, and feed that into the ELO system.  
**Status**: **PARTIALLY IMPLEMENTED** - Core bridge, service, controller, and UI complete. ELO integration and persistence pending.  
**Constraint**: All API endpoints remain public (no auth middleware).

## Implementation Status (2026-01-02)

| Component | Status | Files |
|-----------|--------|-------|
| Python Wrapper | Done | `server/python/council_wrapper.py` |
| Council Bridge | Done | `server/services/council/councilBridge.ts` (subprocess) |
| Council Service | Done | `server/services/council/councilService.ts` |
| Council Controller | Done | `server/controllers/councilController.ts` |
| API Routes | Done | `server/routes.ts` (5 endpoints) |
| Frontend UI | Done | `client/src/pages/LLMCouncil.tsx` |
| Frontend Routes | Done | `/council`, `/council/:taskId` |
| Env Configuration | Done | `COUNCIL_TIMEOUT_MS`, `OPENROUTER_API_KEY` |
| ELO Integration | **TODO** | Needs vote persistence and weight config |
| DB Migration | **TODO** | `council_votes` table not created |

## Integration Architecture (Subprocess - like Saturn/Grover)

The llm-council is integrated via **Python subprocess**, following the same pattern as Saturn, Grover, and Beetree solvers. **No separate service deployment required.**

### How It Works
1. `councilBridge.ts` spawns `server/python/council_wrapper.py` as a subprocess
2. JSON payload sent via stdin
3. NDJSON events streamed back via stdout (progress, stage completions, final result)
4. `council_wrapper.py` imports and runs the llm-council backend modules directly

### Requirements
- Python 3.x installed (same as Saturn/Grover/Beetree)
- `llm-council` Git submodule checked out
- `OPENROUTER_API_KEY` environment variable set

### Environment Variables
```bash
# Required - council uses OpenRouter for multi-model queries
OPENROUTER_API_KEY=sk-or-v1-...

# Optional - timeout for council deliberation (default: 180000ms = 3 minutes)
COUNCIL_TIMEOUT_MS=180000
```

### Health Check
The `/api/council/health` endpoint checks:
- `council_wrapper.py` exists
- `llm-council` submodule directory exists
- Python binary available
- `OPENROUTER_API_KEY` is set  

## Overview

### Current State
- **llm-council submodule**: Present at repo root (`llm-council/`), FastAPI, 3-stage orchestration.
- **ELO flow**: Users rate which of two explanations is better (or both bad) via `/elo` page + backend vote handling.
- **Debate endpoint**: Legacy path; being superseded by `/council`.

### Goal
Create a first-class `/api/council/compare` endpoint that:
1) Accepts two solutions/explanations for the same puzzle/task.  
2) Invokes llm-council to judge: A better, B better, tie, or both bad/wrong.  
3) Returns an auditable CouncilVote payload with rationale and stage artifacts.  
4) Records the council decision as a special voter in the ELO system (single voter with configurable weight).  
5) Leaves existing user ELO flows intact.

## Scope & Non-Goals
- In scope: Backend council bridge, API contract, DB tracking, ELO integration, minimal client wiring for any existing debate/elo callers.  
- Out of scope: UI redesign of /elo page (optional display hook only), streaming UI, non-ARC tasks.

## Target Architecture
- **Python (llm-council)**: Orchestrates 3 stages and emits structured verdict.  
- **TypeScript bridge**: `councilService` calls Python via HTTP to FastAPI (preferred) or subprocess fallback; handles timeouts/retries.  
- **API layer**: `councilController` exposes POST `/api/council/compare`. Public, no auth.  
- **Persistence**: Store council vote with voter_type='council' (or dedicated table) for audit + ELO updates.  
- **ELO integration**: Treat council as one rater with optional weight; update ratings accordingly.

## API Contract (proposed)
- **Endpoint**: `POST /api/council/compare`  
- **Request body**:
```json
{
  "puzzleId": "string",
  "solutionAId": "string",   // or explanationAId
  "solutionBId": "string"    // or explanationBId
}
```
- **Response (200)**:
```json
{
  "winner": "A" | "B" | "tie" | "both_bad",
  "confidence": number,             // 0–1
  "reasoning": "string",            // final synthesis
  "stage1_votes": { "model": "verdict" },
  "stage2_rankings": { "model": ["A","B","tie","both_bad"] },
  "stage3_synthesis": "string",
  "raw": "object"                   // optional passthrough for audit
}
```
- **Errors**: 400 invalid ids, 502 council unavailable/timeout, 500 unexpected. No auth errors.  
- **Compatibility note**: If any client still calls `/debate`, add a thin redirector or deprecate with 410 + message.

## Data Model
- Option A (prefer): Extend existing vote table with `voter_type='council'`, `confidence`, `reasoning`, `winner`, `raw`.  
- Option B: New table `council_votes` keyed by puzzle_id + solution ids + created_at; include stage artifacts for audit.  
- Add index on `(puzzle_id, created_at)` for leaderboard queries.  
- Migration via Drizzle SQL file.

## Backend Implementation Plan

1) Discovery & alignment  
   - Locate existing ELO/debate controllers, services, DB schema for votes, and ELO updater to reuse patterns.  
   - Confirm explanation/solution entity shape in `shared/types.ts` and DB.  

2) Council bridge  
   - Implement `server/services/council/councilBridge.ts` (HTTP client to llm-council FastAPI; fallback to subprocess if needed).  
   - Env: `COUNCIL_BASE_URL`, `COUNCIL_MODELS`, `COUNCIL_CHAIR_MODEL`, `COUNCIL_REASONING_EFFORT` (medium/high), `COUNCIL_TIMEOUT_MS`.  
   - Handle retries, timeouts, and structured error mapping.

3) Council service  
   - `server/services/council/councilService.ts`: Fetch puzzle + solutions, build prompt payload, call bridge, map to CouncilVote domain, and persist vote if enabled.  
   - Normalize council verdict to `{winner: A|B|tie|both_bad, confidence, reasoning}` and stage artifacts.

4) Controller + routes  
   - `server/controllers/councilController.ts`: POST `/api/council/compare`, validate body, call service, return CouncilVote.  
   - Wire in `server/routes.ts` (public; do NOT add auth middleware).  

5) ELO integration  
   - Update ELO service to accept council-origin votes with optional weight (config `COUNCIL_ELO_WEIGHT`, default 1.0).  
   - Ensure no double-count with user votes; decide whether to immediately update ratings or queue.  
   - Update leaderboard queries if they filter by voter type.

6) Persistence  
   - Add migration for council votes (Option A or B). Include `confidence`, `reasoning`, `winner`, `raw`, timestamps.  
   - Seed path for backfill/testing fixtures.

7) Configuration & ops  
   - Document env in `.env.example` + `docs/` config section.  
   - Define healthcheck for llm-council (e.g., `GET /healthz`).  
   - Timeout/retry policy and logging to existing logger.

8) Frontend touchpoints (minimal)  
   - Find any callers to `/debate`; retarget to `/api/council/compare` or remove debate UI.  
   - Optional: show council verdict badge in ELO UI (winner, confidence). Keep UX small to avoid scope creep.

9) Testing  
   - Unit: councilService mapping, error handling, ELO update with council weight.  
   - Integration: POST `/api/council/compare` happy path + timeout path (mock bridge).  
   - Migration test: ensure schema deploys and vote persisted/read.  
   - Contract test: bridge to llm-council FastAPI (requires env).  

## Files to Create/Modify
- Create: `server/services/council/councilBridge.ts` (HTTP client to llm-council)  
- Create: `server/services/council/councilService.ts` (domain orchestration + persistence)  
- Create: `server/controllers/councilController.ts` (API handler)  
- Modify: `server/routes.ts` (add POST /api/council/compare)  
- Modify: `server/services/elo/*.ts` (or equivalent) to accept council votes/weighting  
- Modify: `shared/types.ts` (CouncilVote, request/response DTOs)  
- Modify: `migrations/XXXX_council_votes.sql` (new table or columns)  
- Modify: `.env.example` (COUNCIL_* vars)  
- Modify: `docs/` config reference (llm-council setup, healthcheck)  
- Modify: `CHANGELOG.md` (what/why/how, SemVer)  
- (Optional) Modify: frontend caller(s) that used `/debate` to point to `/api/council/compare`

## Configuration
- Required: `COUNCIL_BASE_URL` (FastAPI host), `OPENROUTER_API_KEY` (already used), `COUNCIL_TIMEOUT_MS` (e.g., 30000).  
- Optional: `COUNCIL_MODELS`, `COUNCIL_CHAIR_MODEL`, `COUNCIL_REASONING_EFFORT`, `COUNCIL_ELO_WEIGHT`, `COUNCIL_LOG_RAW=boolean`.  
- Keep endpoints public; do not enable `apiKeyAuth` middleware.

## Prompt / Payload Shape (to llm-council)
- Include puzzle metadata (id, title, brief description if available).  
- Solutions A/B: text, author/model metadata, timestamps (if helpful), and any scores.  
- Ask explicitly: “Which solution better solves the task? Choices: A, B, tie, both bad/wrong.”  
- Truncate long texts to avoid token blowups; log truncation.

## Failure Handling & Observability
- Timeouts -> 502 to client; log with request ids.  
- Retries: 1–2 light retries on 5xx from llm-council; no retry on 4xx.  
- Metrics: success/failure counts, latency, verdict distribution.  
- Store raw council response for audits when `COUNCIL_LOG_RAW=true`.  
- If llm-council unavailable: optionally skip ELO update and return error; no silent fallback to random choice.

## Testing Checklist
- [ ] Council bridge talks to FastAPI (health + happy path)  
- [ ] councilService maps council verdicts to {winner|confidence|reasoning} and persists vote  
- [ ] POST /api/council/compare returns correct shapes and errors on bad ids/timeouts  
- [ ] ELO updates incorporate council weight once per request (no double count)  
- [ ] Migration applies and council votes queryable  
- [ ] Frontend callers (if any) updated off `/debate`  
- [ ] Logging/metrics emitted for failures and timeouts  

## Open Questions (to finalize before build)
1) Schema choice: extend existing vote table vs. new `council_votes`?  
2) Weight: should council vote weight differ from 1.0?  
3) Should we store full stage artifacts or only synthesis + winner?  
4) Do we need a debounce/throttle to avoid hammering llm-council on rapid requests?  
5) If debate callers remain, should we 410 them or proxy to council for now?
