# RE-ARC Result Persistence & Leaderboard Plan

**Author:** Claude Haiku 4.5
**Date:** 2025-12-31
**Status:** Design Phase — To be implemented after RE-ARC Bench MVP acceptance
**Related:** RE-ARC Bench PR #406, `/re-arc` route, `server/services/reArc/reArcService.ts`

---

## Overview

Currently, RE-ARC Bench evaluation results are ephemeral—users generate datasets, evaluate submissions, and get scores, but nothing persists. This plan adds:

1. **Result Persistence** — All evaluations auto-saved to database
2. **User Claims** — Users can optionally claim and verify results
3. **Read-Only Leaderboard** — Public rankings of claimed, verified submissions
4. **Submission Audit Trail** — Who submitted what, when, with what score

**Key Principle:** Users control visibility. Results are tracked automatically, but public sharing is opt-in.

---

## Database Schema

### New Tables

#### `rearc_datasets`
Tracks generated datasets for audit and re-verification.

```sql
CREATE TABLE rearc_datasets (
  id SERIAL PRIMARY KEY,
  seed_id BIGINT NOT NULL,
  internal_seed BYTEA NOT NULL,
  num_tasks INT NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Derived from seed_id (timestamp-encoded)
  generation_timestamp BIGINT NOT NULL,

  -- Optional: metadata for future steganography support
  message_bytes BYTEA,

  UNIQUE(seed_id),
  INDEX idx_generated_at (generated_at),
  INDEX idx_seed_id (seed_id)
);
```

#### `rearc_evaluations`
Persists every evaluation result, whether claimed or not.

```sql
CREATE TABLE rearc_evaluations (
  id SERIAL PRIMARY KEY,

  -- Reference to dataset
  rearc_dataset_id INT NOT NULL REFERENCES rearc_datasets(id),

  -- Submission metadata
  submission_file_name VARCHAR(255),
  submission_hash VARCHAR(64),  -- SHA-256 of JSON for deduplication

  -- Evaluation results
  total_pairs INT NOT NULL,
  solved_pairs INT NOT NULL,
  score DECIMAL(5,4) NOT NULL,  -- 0.0000 to 1.0000

  -- Per-pair breakdown (JSON for flexibility)
  pair_results JSONB,  -- [{ pair_index, attempt_1_correct, attempt_2_correct, correct }]

  -- Evaluation metadata
  evaluated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  evaluation_duration_ms INT,

  -- User claim (if any)
  claimed_by_user_id INT REFERENCES users(id),
  claimed_at TIMESTAMP,
  is_public BOOLEAN DEFAULT FALSE,

  -- Verification
  verified_at TIMESTAMP,
  verification_hash VARCHAR(64),  -- Hash of dataset + submission for re-verification

  INDEX idx_dataset_id (rearc_dataset_id),
  INDEX idx_claimed_by (claimed_by_user_id),
  INDEX idx_is_public (is_public),
  INDEX idx_score (score),
  INDEX idx_evaluated_at (evaluated_at)
);
```

#### `rearc_solver_profiles`
Public solver profiles (opt-in). Links multiple evaluations to a solver identity.

```sql
CREATE TABLE rearc_solver_profiles (
  id SERIAL PRIMARY KEY,

  -- User identity (can be anonymous alias)
  user_id INT REFERENCES users(id),
  solver_name VARCHAR(255) NOT NULL,  -- E.g., "MyAwesomeSolver v2.1"
  solver_description TEXT,

  -- Public visibility
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, solver_name),
  INDEX idx_is_public (is_public)
);
```

#### `rearc_evaluation_claims`
Many-to-many: evaluations can be claimed by a profile, supporting batch submissions.

```sql
CREATE TABLE rearc_evaluation_claims (
  id SERIAL PRIMARY KEY,
  rearc_evaluation_id INT NOT NULL REFERENCES rearc_evaluations(id),
  rearc_solver_profile_id INT NOT NULL REFERENCES rearc_solver_profiles(id),

  claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(rearc_evaluation_id, rearc_solver_profile_id),
  INDEX idx_profile_id (rearc_solver_profile_id)
);
```

---

## API Endpoints (New/Extended)

### Evaluation with Auto-Persistence
```
POST /api/rearc/evaluate
```
**Current behavior:** Streams SSE evaluation
**New behavior:** Also inserts row into `rearc_evaluations` and returns `evaluationId` in completion event
**Response addition:**
```json
{
  "type": "complete",
  "evaluationId": 12345,
  "scoreDetails": {
    "score": 0.875,
    "solvedPairs": 105,
    "totalPairs": 120
  }
}
```

### Claim Evaluation Result
```
POST /api/rearc/claims
Body:
{
  "evaluationId": 12345,
  "solverProfileId": 789,
  "makePublic": true
}
Response: { success: true, claimId: 456 }
```

### Get User's Evaluations
```
GET /api/rearc/my-evaluations?limit=50&offset=0
Query: ?public_only=false (show claimed private results too)
Response: {
  evaluations: [
    {
      id: 12345,
      score: 0.875,
      evaluatedAt: "2025-12-31T...",
      isPublic: true,
      solverProfile: { id: 789, name: "MyAwesomeSolver v2.1" }
    }
  ],
  totalCount: 43
}
```

### Leaderboard (Read-Only)
```
GET /api/rearc/leaderboard?sort=score&limit=100&offset=0
Query: ?sort=score | &sort=latest | &datasetSeedId=xyz (filter by dataset)
Response: {
  rankings: [
    {
      rank: 1,
      solverName: "DeepARC Neural v3.0",
      score: 0.95,
      solvedPairs: 114,
      totalPairs: 120,
      evaluations: 5,  // Number of claimed evals
      userId: 42,  // If public
      latestEvalAt: "2025-12-31T..."
    }
  ],
  totalRankedSolvers: 23
}
```

### Re-Verify Submission (Optional)
```
POST /api/rearc/verify-claim/:claimId
Body: { submissionJson: [...] }
Response: {
  verified: true,
  originalScore: 0.875,
  recomputedScore: 0.875,
  datasetSeedId: 1735689600
}
```

---

## Frontend Components (New/Extended)

### RE-ARC Page Changes
1. **Evaluation Result Card** — After score display:
   - "Claim this result" button (if user logged in)
   - "Make public" toggle after claiming
   - Display evaluationId for sharing

2. **My Results Dashboard** (`/re-arc/my-results`)
   - Table of user's evaluations (public + private)
   - Filter/sort by score, date, public status
   - Claim/unclaim actions
   - Copy-to-clipboard evaluationId for sharing

### New Pages
1. **Leaderboard** (`/re-arc/leaderboard`)
   - Public rankings by solver
   - Sort options: score, latest submission, evaluation count
   - Filter by dataset seed
   - Click to view solver profile

2. **Solver Profile** (`/re-arc/solver/:profileId`)
   - Solver name, description
   - All public evaluations
   - Best score, average score
   - Evaluation history timeline

---

## Implementation Phases

### Phase 1: Core Persistence (Prerequisite)
**Scope:** Auto-save evaluations, simple claim system
**Priority:** HIGH — Required for leaderboard foundation

**Tasks:**
- [ ] Create `rearc_datasets`, `rearc_evaluations` tables
- [ ] Modify `POST /api/rearc/evaluate` controller to insert `rearc_evaluations` row
- [ ] Add `evaluationId` to SSE completion event
- [ ] Create `rearc_solver_profiles` table
- [ ] Implement `POST /api/rearc/claims` endpoint (basic claim without profile)
- [ ] Implement `GET /api/rearc/my-evaluations` endpoint
- [ ] Add "Claim this result" UI to evaluation card

**Estimated:** 4-6 hours

### Phase 2: Leaderboard & Profile Pages
**Scope:** Public rankings, solver profiles
**Priority:** HIGH — Core feature

**Tasks:**
- [ ] Implement `GET /api/rearc/leaderboard` (sorting, pagination)
- [ ] Create `/re-arc/leaderboard` page
- [ ] Create `/re-arc/solver/:profileId` page
- [ ] Add database indexes for leaderboard queries
- [ ] Test leaderboard performance with 100+ submissions

**Estimated:** 5-7 hours

### Phase 3: Advanced Features (Nice-to-Have)
**Scope:** Re-verification, dataset filtering, solver comparisons
**Priority:** LOW — Post-MVP refinement

**Tasks:**
- [ ] Implement `POST /api/rearc/verify-claim/:claimId`
- [ ] Add leaderboard filter by dataset seed
- [ ] Add solver comparison view
- [ ] Build "Trending Solvers" widget (last 7 days)
- [ ] Add export/CSV of leaderboard

**Estimated:** 4-5 hours

---

## Repository Pattern (SRP)

Create `server/repositories/ReArcRepository.ts`:

```typescript
class ReArcRepository {
  // Datasets
  async getOrCreateDataset(seedId: bigint, internalSeed: Buffer): Promise<ReArcDataset>
  async getDataset(seedId: bigint): Promise<ReArcDataset | null>

  // Evaluations
  async createEvaluation(eval: ReArcEvaluationInput): Promise<ReArcEvaluation>
  async getEvaluation(evaluationId: number): Promise<ReArcEvaluation | null>
  async getUserEvaluations(userId: number, limit: number): Promise<ReArcEvaluation[]>
  async getPublicEvaluations(limit: number): Promise<ReArcEvaluation[]>

  // Profiles & Claims
  async createSolverProfile(userId: number, name: string, desc?: string): Promise<ReArcSolverProfile>
  async claimEvaluation(evalId: number, profileId: number, makePublic: boolean): Promise<ReArcEvaluationClaim>
  async getLeaderboard(sort: 'score' | 'latest', limit: number, offset: number): Promise<LeaderboardEntry[]>

  // Verification
  async verifyClaim(claimId: number, submissionHash: string): Promise<VerificationResult>
}
```

---

## Considerations & Open Questions

1. **User Accounts** — Does RE-ARC require login?
   - Current: NO auth required for evaluation
   - Future: Suggest soft login (optional, for claiming)
   - Alternative: Allow anonymous claims with email verification

2. **Data Privacy** — What PII gets logged?
   - Evaluation data is safe (just scores)
   - Optional: User can choose pseudonym for profile

3. **Leaderboard Cheating Prevention**
   - Submissions tied to dataset seed (prevents overfitting claims)
   - Re-verification available but not enforced (community-driven verification)
   - No scoring manipulation risk (external evaluator)

4. **Performance at Scale**
   - Leaderboard queries need indexes on `is_public`, `score`, `evaluated_at`
   - Consider pagination and caching (Redis)
   - If 1000+ evaluations, may need materialized views

5. **Dataset Retention**
   - Keep `rearc_datasets` rows forever? (for re-verification)
   - Or expire after N days?
   - Recommendation: Archive after 90 days, keep for re-verification only if claimed

---

## Success Criteria

✅ **Phase 1 Complete When:**
- All evaluations auto-saved to DB
- Users can claim and make results public
- `/re-arc/my-results` shows personal history

✅ **Phase 2 Complete When:**
- Leaderboard page loads in <500ms with 100+ entries
- Solver profiles display with evaluation history
- Filtering/sorting works smoothly

✅ **Phase 3 Complete When:**
- Re-verification works correctly
- Community has submitted 20+ unique solvers
- No fraud detected in leaderboard

---

## Related Docs

- `docs/plans/2025-12-24-re-arc-interface-plan.md` — Original RE-ARC Bench design
- `docs/reference/api/EXTERNAL_API.md` — Current API reference (update with new endpoints)
- `CHANGELOG.md` — Document schema changes and new endpoints per SemVer

---

**Next Steps for Implementer:**

1. Review this plan with Mark
2. Create database migration files (Drizzle)
3. Implement Phase 1 (core persistence)
4. Test with 50+ mock evaluations
5. Measure leaderboard query performance
6. Plan Phase 2 frontend work
