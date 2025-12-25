# RE-ARC Dataset Generation & Verification Interface

**Author:** Claude Code using Sonnet 4.5
**Date:** 2025-12-24
**Purpose:** Plan for implementing a stateless RE-ARC dataset generation and verification interface

## Overview

Create a web interface that allows users to:
1. Generate RE-ARC datasets on demand
2. Submit solutions for verification
3. Verification works via XOR of task IDs to regenerate the seed (stateless, no DB needed)

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

type TaskMetadata = {
  numTrain: number;
  numTest: number;
  verifierLOC: number;
};

type ReArcMetadata = {
  [taskId: string]: TaskMetadata;  // Keyed by original ARC-AGI task ID
};
```

## High-Level Approach

### Generation Flow
1. User requests dataset generation
2. Backend generates dataset using internal configuration
3. Return dataset JSON for download

### Verification Flow
1. User uploads submission JSON
2. Validate submission structure
3. Extract task IDs, XOR to recover seed
4. Decode generation timestamp from sorted task IDs
5. Regenerate dataset deterministically
6. Compare submission attempts to ground truth
7. Return score + time elapsed (submission time - generation time)

### Components

- reArcController: /generate and /verify endpoints (SSE streaming)
- reArcService: orchestrate Python re-arc calls
- reArcSeed utils: XOR logic and message encoding/decoding
- Python scripts: wrap re-arc library
- rearc_metadata.json: cached metadata

## Backend Patterns (from existing codebase)

**Controllers:**
- Export functions wrapped with `asyncHandler` middleware
- Use `formatResponse` utility for consistent responses
- Import from services, don't do DB queries directly

**Services:**
- Orchestrate Python subprocess calls via `child_process.spawn`
- Handle stdout/stderr streaming for progress updates

## Implementation Steps

### Phase 1: Setup & Install
- [ ] Clone re-arc library from GitHub
- [ ] Review re-arc codebase structure (generators.py, verifiers.py, main.py)
- [ ] Understand how to extract verifier LOC
- [ ] Test re-arc generation with sample seed
- [ ] Verify deterministic generation

### Phase 1.5: Metadata Pre-processing
- [ ] Create script to extract metadata from all 400 ARC tasks
- [ ] For each task in `data/training/`:
  - [ ] Count train/test examples
  - [ ] Extract verifier function from re-arc `verifiers.py`
  - [ ] Count lines of code in verifier function
- [ ] Generate `data/rearc_metadata.json`
- [ ] Version control this file

### Phase 2: Core Infrastructure
- [ ] Create type definitions in `shared/types.ts`
- [ ] Implement XOR seed logic in `server/utils/reArcSeed.ts`
- [ ] Write tests for XOR seed logic (`tests/reArcSeed.test.ts`)
- [ ] Create Python wrapper scripts for re-arc library
- [ ] Implement `reArcService.ts` with generation and verification methods
- [ ] Write integration tests (`tests/reArcService.test.ts`)

### Phase 3: Backend API
- [ ] Create `reArcController.ts` with generation endpoint
- [ ] Create verification endpoint
- [ ] Add routes to `server/routes.ts` (follow existing pattern)
- [ ] Write endpoint tests (`tests/reArcController.test.ts`)
- [ ] Add error handling and validation

---

**Frontend implementation:** See `2025-12-24-rearc-frontend-design.md`

## Key Technical Details

### XOR Seed Recovery & Steganographic Encoding
**Task IDs:** 8 hex chars (32 bits)
- Upper 16 bits: unique random from PRNG(seed)
- Lower 16 bits: random from PRNG, optionally XOR'd with message bytes

**Seed recovery:** `XOR(all_task_ids) = seed`

**Steganographic message encoding:**
- XOR arbitrary message bytes into lower 16 bits of sorted task IDs
- Decode by regenerating PRNG sequence and XOR'ing back
- Looks like random noise without seed
- Max message: `(n_tasks - 1) * 2` bytes

**Current encoded message format:**
- Version: 1 byte (value = 0)
- Generation timestamp: 4 bytes (Unix seconds, big-endian)
- Total: 5 bytes
- (Format may change in future versions)

### Task Mapping
- Sort original ARC tasks by complexity (LOC descending)
- Select top n_tasks
- Map: `generated_ids[i] ↔ selected_original_tasks[i]`

### Scoring
- Each task worth 1.0 point, divided equally across its test pairs
- Test pair solved if ANY of 2 attempts correct
- Overall score = (sum of task scores) / (total tasks)

## Files to Create

**Backend:**
```
server/
├── controllers/reArcController.ts
├── services/reArc/
│   ├── reArcService.ts
│   ├── rearc_generator.py
│   └── rearc_verifier.py
├── utils/reArcSeed.ts
└── routes.ts (add routes)
```

**Data:**
```
data/rearc_metadata.json
```

**Tests:**
```
tests/
├── reArcSeed.test.ts          # XOR logic, message encoding
├── reArcService.test.ts       # Python integration, generation
└── reArcController.test.ts    # API endpoints
```

**Types:**
```
shared/types.ts (add ReArc types)
```

## API

**Generation endpoint:** `POST /api/rearc-eval/generate` (SSE stream)
- No parameters
- Returns Server-Sent Events:
  ```
  event: progress
  data: {"current": 47, "total": 400}

  event: complete
  data: {<Dataset JSON>}

  event: error
  data: {"message": "Generation failed: ..."}
  ```

**Verification endpoint:** `POST /api/rearc-eval/verify` (SSE stream)
- Body: `{ submission: Submission }`
- Client-side validation before upload:
  - JSON format and structure
  - Grid dimensions (min 1x1, max 30x30)
  - Grid cells are integers
- Returns Server-Sent Events:
  ```
  event: progress
  data: {"current": 47, "total": 400}

  event: complete
  data: {"score": 0.875, "timeElapsedSeconds": 3847}

  event: error
  data: {"message": "Verification failed"}
  ```

**Error Handling:**
- Seed recovery failure: specific error message ("Could not verify submission. Task IDs don't match or file is corrupted.")
- Other failures: generic 500 error ("Verification failed")
- Grid validation handled entirely client-side

**Internal configuration (from config file):**
- `n_tasks`: number of tasks to generate
- `diff_lb`, `diff_ub`: re-arc difficulty bounds
- `rearc_metadata.json`: task metadata sorted by LOC

