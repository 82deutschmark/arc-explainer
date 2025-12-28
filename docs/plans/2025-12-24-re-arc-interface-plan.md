# RE-ARC Dataset Generation & Evaluation Interface

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-12-24
**Purpose:** Plan for implementing a stateless RE-ARC dataset generation and evaluation interface

## Overview

Create a web interface that allows users to:
1. Generate RE-ARC datasets on demand
2. Submit solutions for evaluation
3. Evaluation works via XOR of task IDs to regenerate the seed (stateless, no DB needed)

## Data Structures

```typescript
type Task = {
  train: { input: number[][]; output: number[][] }[];
  test: { input: number[][]; output?: number[][] }[];
};

type Dataset = {
  [taskId: string]: Task;
};

type Submission = {
  [taskId: string]: {
    attempt_1: number[][];
    attempt_2: number[][];
  }[];
};
```

## High-Level Approach

### Generation Flow
1. User requests dataset generation
2. Backend immediately starts HTTP response with download headers
3. Backend streams JSON incrementally as tasks are generated
4. Client receives streaming download (~10 seconds total)
5. File download completes when all tasks generated

### Evaluation Flow
1. User uploads submission JSON
2. Validate submission structure
3. Extract task IDs, XOR to recover seed (seed = generation timestamp)
4. Regenerate dataset deterministically using recovered seed
5. Compare submission attempts to ground truth
6. Return score

### Components

- reArcController: /generate (streaming download) and /evaluate (SSE streaming) endpoints
- reArcService: orchestrate Python re-arc library calls
- reArcCodec utils: XOR logic and message encoding/decoding

## Backend Patterns (from existing codebase)

**Controllers:**
- Export functions wrapped with `asyncHandler` middleware
- Use `formatResponse` utility for consistent responses
- Import from services, don't do DB queries directly

**Services:**
- Orchestrate Python subprocess calls via `child_process.spawn`
- Handle stdout/stderr streaming for progress updates
- For /generate: Stream JSON chunks directly to HTTP response as tasks complete

## Implementation Steps

### Phase 1: Setup & Install
- [x] Clone re-arc library from GitHub (added as submodule at `external/re-arc`)
- [x] Install `express-rate-limit` for API rate limiting
- [x] Update Dockerfile with re-arc fallback clone logic

### Phase 2: Task ID Encoding and Decoding
- [x] Implement XOR seed logic in `server/utils/reArcCodec.ts`
- [x] Write tests for XOR seed logic (`tests/reArcCodec.test.ts`)

### Phase 3: RE-ARC Integration
- [x] Review and test re-arc library (lib.py)
- [x] Create type definitions in `shared/types.ts` (top of file)
- [x] Implement re-arc integration `server/services/reArc/reArcService.ts`
- [x] Write integration tests (`tests/reArcService.test.ts`)
- [x] Update codec to return ordered task IDs (`server/utils/reArcCodec.ts`)

**Test execution:**
```bash
node --import tsx --test tests/reArcService.test.ts
```

### Phase 4: Backend API
- [x] Create `reArcController.ts` with generation endpoint
- [x] Create evaluation endpoint
- [x] Add routes to `server/routes.ts` (follow existing pattern)
- [x] Write endpoint tests (`tests/reArcController.test.ts`)
- [x] Add error handling and validation
- [x] Add rate limiting middleware

---

**Frontend implementation:** See `2025-12-24-rearc-frontend-design.md`

## Key Technical Details

### XOR Seed Recovery & Steganographic Encoding
**Task IDs:** 8 hex chars (32 bits)
- Upper 16 bits: unique random from PRNG(seed) - acts as position identifier
- Lower 16 bits: random from PRNG, optionally XOR'd with message bytes

**Seed recovery:** `XOR(all_task_ids) = seed` (order-independent)

**Steganographic message encoding (available for future use):**
- XOR arbitrary message bytes into lower 16 bits of task IDs in seed order
- Decode: regenerate PRNG, match upper 16 bits to find generation order, XOR lower bits back
- Submission order doesn't matter - upper bits identify which task was at each generation position
- Looks like random noise without seed
- Max message: `(n_tasks - 1) * 2` bytes

**Current implementation:**
- Seed = Unix timestamp (seconds) at generation time
- No message encoding in this iteration

### Scoring
- Each task worth 1.0 point, divided equally across its test inputs
- Test input solved if ANY of 2 prediction attempts correct
- Overall score = (sum of task scores) / (total tasks)

## Files to Create

**Backend:**
```
server/
├── controllers/reArcController.ts
├── services/reArc/
│   └── reArcService.ts
├── utils/reArcCodec.ts
└── routes.ts (add routes)
```

**Tests:**
```
tests/
├── reArcCodec.test.ts         # XOR logic, message encoding
├── reArcService.test.ts       # Python integration, generation
└── reArcController.test.ts    # API endpoints
```

**Types:**
```
shared/types.ts (add ReArc types)
```

## API

Use `express-rate-limit` for API rate limiting

**Generation endpoint:** `POST /api/rearc/generate` (Streaming Download)
- No parameters
- Returns chunked HTTP response with headers:
  - `Content-Type: application/json`
  - `Content-Disposition: attachment; filename="rearc_test_challenges-{timestamp}.json"`
  - `Transfer-Encoding: chunked`
  - `Content-Encoding: gzip`
- Response body: JSON object streamed incrementally as tasks are generated
- Format: Valid JSON object `{ "taskId1": {...}, "taskId2": {...}, ... }`
- Each task contains training pairs (input+output) and test inputs (input only; ground truth reserved for evaluation)
- Tasks stream in real-time (~10 seconds for full dataset)

**Evaluation endpoint:** `POST /api/rearc/evaluate` (SSE stream)
- Body: Submission JSON
- Returns Server-Sent Events:
  ```
  event: progress
  data: {"current": 47, "total": 128}

  event: complete
  data: {"type": "score", "score": 0.875}
  data: {"type": "mismatches", "mismatches": {taskId, expectedPredictions, submittedPredictions}[]}
  data: {"type": "malformed"}
  ```

Note completion event differs from `EvaluationResult`: `taskIndex` and `error` are excluded