# RE-ARC Result Persistence & Leaderboard Plan (Revised)

**Author:** Claude Opus 4.5
**Date:** 2025-12-30
**Status:** Design Phase
**Related:** RE-ARC Bench, `/re-arc` route

> **Special Thanks:** [conundrumer](https://github.com/conundrumer) for creating the RE-ARC project and contributing the core verification concept - "anyone can upload anyone else's submission to verify they're being truthful."

---

## Overview

RE-ARC Bench allows users to evaluate ARC solver submissions. This plan adds:

1. **Result Persistence** — All evaluations saved to database with solver name
2. **Public Leaderboard** — Rankings of all submissions
3. **Automatic Verification** — Hash matching to verify/detect duplicate submissions
4. **Two UI Flows** — "Evaluate Your Own" vs "Verify Someone Else's"

**Core Insight (conundrumer):** Anyone can upload anyone else's submission to verify they're being truthful. This is built into the system via submission hashing.

---

## User Flows

### Flow 1: "Evaluate Your Own Solution"
Primary use case - user submits their original work.

1. User clicks "Evaluate Your Own Solution"
2. User uploads submission JSON file
3. User enters their name (or we generate one like "Brave Pangolin")
4. System evaluates submission, streams results
5. System hashes submission, checks for matches in DB
6. Results display:
   - Score (e.g., "85% - 102/120 pairs solved")
   - **If matches exist** (suspicious): "This submission matches entries by: Alice, Bob"
7. Entry saved to leaderboard with name + hash

### Flow 2: "Verify Someone Else's"
Secondary use case - user wants to confirm someone's claimed score.

1. User clicks "Verify Someone Else's"
2. User uploads the submission file (shared by original submitter)
3. System evaluates submission, streams results
4. System hashes submission, checks for matches in DB
5. Results display:
   - Score (e.g., "85% - 102/120 pairs solved")
   - **If matches exist**: "This submission matches entries by: Alice" (verification successful)
   - **If no matches**: "No matching submissions found" (original claim unverified)
6. **Not saved to leaderboard** (this is verification, not a new entry)

---

## Database Schema (Simplified)

No login system. Just name + submission.

### `rearc_datasets`
Tracks generated datasets for reproducibility.

```sql
CREATE TABLE rearc_datasets (
  id SERIAL PRIMARY KEY,
  seed_id BIGINT NOT NULL UNIQUE,
  internal_seed BYTEA NOT NULL,
  num_tasks INT NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `rearc_submissions`
Every evaluated submission that goes on the leaderboard.

```sql
CREATE TABLE rearc_submissions (
  id SERIAL PRIMARY KEY,

  -- Solver identity (no login required)
  solver_name VARCHAR(255) NOT NULL,

  -- Reference to dataset
  rearc_dataset_id INT NOT NULL REFERENCES rearc_datasets(id),

  -- Submission fingerprint for verification
  submission_hash VARCHAR(64) NOT NULL,  -- SHA-256 of submission JSON
  submission_file_name VARCHAR(255),

  -- Evaluation results
  total_pairs INT NOT NULL,
  solved_pairs INT NOT NULL,
  score DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000

  -- Per-pair breakdown
  pair_results JSONB,  -- [{ taskId, pairIndex, attempt1Correct, attempt2Correct, solved }]

  -- Metadata
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  evaluation_duration_ms INT,

  -- Verification tracking
  verification_count INT DEFAULT 0,  -- Incremented when others verify this
  last_verified_at TIMESTAMP,

  INDEX idx_submission_hash (submission_hash),
  INDEX idx_score (score DESC),
  INDEX idx_evaluated_at (evaluated_at DESC),
  INDEX idx_solver_name (solver_name)
);
```

---

## API Endpoints

### Evaluate Own Submission (saves to leaderboard)
```
POST /api/rearc/evaluate
Body: {
  seedId: number,
  solverName: string,
  submission: object  // The submission JSON
}
Response (SSE stream):
  - Progress events during evaluation
  - Complete event: {
      type: "complete",
      submissionId: 12345,
      score: 0.85,
      solvedPairs: 102,
      totalPairs: 120,
      matchingSubmissions: [
        { id: 999, solverName: "Alice", score: 0.85 }
      ]  // Empty array if unique (expected case)
    }
```

### Verify Someone Else's Submission (does NOT save)
```
POST /api/rearc/verify
Body: {
  seedId: number,
  submission: object  // The submission JSON to verify
}
Response (SSE stream):
  - Progress events during evaluation
  - Complete event: {
      type: "complete",
      score: 0.85,
      solvedPairs: 102,
      totalPairs: 120,
      matchingSubmissions: [
        { id: 123, solverName: "Alice", score: 0.85, evaluatedAt: "..." }
      ]
    }
```

### Get Leaderboard
```
GET /api/rearc/leaderboard?limit=100&offset=0&sort=score
Query params:
  - sort: "score" (default) | "latest" | "verified"
  - seedId: filter by dataset (optional)
Response: {
  submissions: [
    {
      id: 123,
      solverName: "Alice",
      score: 0.85,
      solvedPairs: 102,
      totalPairs: 120,
      evaluatedAt: "2025-12-30T...",
      verificationCount: 3
    }
  ],
  totalCount: 47
}
```

### Get Submission Details
```
GET /api/rearc/submissions/:id
Response: {
  id: 123,
  solverName: "Alice",
  score: 0.85,
  solvedPairs: 102,
  totalPairs: 120,
  pairResults: [...],
  evaluatedAt: "...",
  verificationCount: 3,
  matchingSubmissions: [...]  // Others with same hash
}
```

---

## Frontend Components

### RE-ARC Page Changes

**Two primary action buttons:**
1. "Evaluate Your Own Solution" - Opens evaluation flow
2. "Verify Someone Else's" - Opens verification flow

**Evaluation Flow UI:**
1. File upload dropzone
2. Name input field (with "Generate Random Name" button)
3. "Evaluate & Submit" button
4. Results card showing:
   - Score prominently
   - Pair breakdown
   - Match warning (if any): "This matches submissions by: X, Y"
   - "View on Leaderboard" link

**Verification Flow UI:**
1. File upload dropzone
2. "Verify" button (no name needed - not saving)
3. Results card showing:
   - Score
   - Match results: "Matches: Alice (85%, submitted Dec 30)" or "No matches found"

### New Pages

**Leaderboard Page (`/re-arc/leaderboard`)**
- Table: Rank, Solver Name, Score, Pairs Solved, Verified By, Date
- Sort options: Score, Latest, Most Verified
- Click row to see submission details
- Filter by dataset seed (dropdown)

**Submission Detail Page (`/re-arc/submissions/:id`)**
- Full score breakdown
- Per-task results
- Verification history

---

## Name Generation

When user doesn't enter a name, generate a fun one:

```typescript
const adjectives = ['Brave', 'Swift', 'Clever', 'Noble', 'Cosmic', 'Quantum', ...];
const animals = ['Pangolin', 'Axolotl', 'Narwhal', 'Quokka', 'Capybara', ...];

function generateSolverName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${adj} ${animal}`;
}
```

---

## Verification Logic

```typescript
async function findMatchingSubmissions(submissionHash: string): Promise<Submission[]> {
  return db.query(`
    SELECT id, solver_name, score, evaluated_at
    FROM rearc_submissions
    WHERE submission_hash = $1
    ORDER BY evaluated_at ASC
  `, [submissionHash]);
}

async function incrementVerificationCount(submissionIds: number[]): Promise<void> {
  await db.query(`
    UPDATE rearc_submissions
    SET verification_count = verification_count + 1,
        last_verified_at = NOW()
    WHERE id = ANY($1)
  `, [submissionIds]);
}
```

When verification flow finds matches, increment their verification_count.

---

## Implementation Phases

### Phase 1: Core Persistence & Leaderboard
- [ ] Create Drizzle schema for `rearc_datasets`, `rearc_submissions`
- [ ] Create `ReArcRepository.ts` with SRP methods
- [ ] Modify evaluation endpoint to save submissions
- [ ] Add submission hash computation (SHA-256 of JSON)
- [ ] Add matching submission lookup
- [ ] Implement `GET /api/rearc/leaderboard` endpoint
- [ ] Create leaderboard page UI
- [ ] Add name input + generation to evaluation flow

### Phase 2: Verification Flow
- [ ] Create `POST /api/rearc/verify` endpoint (evaluate without saving)
- [ ] Add "Verify Someone Else's" UI flow
- [ ] Increment verification_count on matches
- [ ] Show verification count on leaderboard
- [ ] Add submission detail page

### Phase 3: Polish
- [ ] Filter leaderboard by dataset seed
- [ ] Sort by verification count
- [ ] Pagination for large leaderboards

---

## Files to Create/Modify

**New Files:**
- `server/db/schema/rearc.ts` — Drizzle schema
- `server/repositories/ReArcRepository.ts` — Data access
- `server/controllers/reArcLeaderboardController.ts` — Leaderboard endpoints
- `client/src/pages/ReArcLeaderboard.tsx` — Leaderboard page
- `client/src/components/rearc/VerificationFlow.tsx` — Verify UI
- `server/utils/nameGenerator.ts` — Fun name generation

**Modify:**
- `server/services/reArc/reArcService.ts` — Add persistence
- `server/controllers/reArcController.ts` — Add verify endpoint
- `client/src/pages/ReArc.tsx` — Two-flow UI
- `server/routes.ts` — New routes
- `client/src/App.tsx` — New route

---

## Design Decisions

1. **Verification requires same dataset seed** - Stricter verification ensures same test conditions

2. **Duplicate submissions allowed** - If someone submits the same file twice with different names, we allow it. The matching hash reveals this.

3. **Submission hash shown on detail page only** - Transparency without confusing non-technical users on the main leaderboard

---

## Success Criteria

- Users can evaluate and appear on leaderboard with just a name
- Verification flow correctly identifies matching submissions
- Leaderboard loads quickly with 100+ entries
- Hash matching is reliable (SHA-256 of normalized JSON)
