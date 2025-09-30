# Rebuttal Tracking Implementation
**Date:** 2025-09-30
**Author:** Claude Code using Sonnet 4.5
**Purpose:** Track parent-child relationships between explanations for debate/improvement chains

## Problem
When an AI generates a challenge to fix a previous wrong explanation, we save it as a new explanation but have no link to the original. We can't show lineage or query "all attempts to fix explanation X".

## Solution
Add self-referencing FK `rebutting_explanation_id` to explanations table.

## Data Integrity
Each rebuttal is **still a full explanation record** with:
- ✅ `puzzle_id` - Same puzzle being solved
- ✅ `model_name` - Which model generated the rebuttal
- ✅ `predicted_output_grid` - The rebuttal's answer
- ✅ `is_prediction_correct` - Whether rebuttal got it right
- ✅ All other fields (tokens, cost, reasoning, etc.)

The `rebutting_explanation_id` is **ONLY** a link to say:
> "This explanation (id=456) was generated as an attempt to improve explanation (id=123)"

## Implementation

### 1. Database Schema Changes
**File:** `server/repositories/database/DatabaseSchema.ts`

**Canonical Schema (line 99):**
```sql
rebutting_explanation_id INTEGER DEFAULT NULL,
```

**Migration (line 272-294):**
```sql
-- Add column
ALTER TABLE explanations ADD COLUMN IF NOT EXISTS rebutting_explanation_id INTEGER DEFAULT NULL;

-- Add FK constraint
ALTER TABLE explanations
  ADD CONSTRAINT fk_rebutting_explanation
  FOREIGN KEY (rebutting_explanation_id)
  REFERENCES explanations(id)
  ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_explanations_rebutting_explanation_id
  ON explanations(rebutting_explanation_id)
  WHERE rebutting_explanation_id IS NOT NULL;
```

### 2. TypeScript Interfaces
**Files:**
- `server/repositories/interfaces/IExplanationRepository.ts` (line 53)
- `client/src/types/puzzle.ts` (line 145)

**Add:**
```typescript
rebuttingExplanationId?: number | null;
```

### 3. Repository INSERT
**File:** `server/repositories/ExplanationRepository.ts`

**Line 36-48:** Add to INSERT column list:
```sql
rebutting_explanation_id
```

**Line 96:** Add to VALUES list (41st parameter):
```typescript
data.rebuttingExplanationId || null
```

### 4. Service Layer Extraction
**File:** `server/services/puzzleAnalysisService.ts`

**Line 36:** Fix type:
```typescript
originalExplanation?: ExplanationData; // For debate mode
```

**Add import:**
```typescript
import type { ExplanationData } from '../repositories/interfaces/IExplanationRepository.ts';
```

**Where saveExplanation() is called (~line 200-250):**
```typescript
const rebuttingExplanationId = originalExplanation?.id || null;

const savedExplanation = await repositoryService.explanation.saveExplanation({
  // ... all other fields ...
  rebuttingExplanationId: rebuttingExplanationId
});
```

### 5. Query Methods
**File:** `server/repositories/ExplanationRepository.ts`

```typescript
async getRebuttalChain(explanationId: number): Promise<ExplanationResponse[]> {
  if (!this.isConnected()) return [];

  const result = await this.query(`
    WITH RECURSIVE rebuttal_chain AS (
      SELECT * FROM explanations WHERE id = $1
      UNION ALL
      SELECT e.*
      FROM explanations e
      INNER JOIN rebuttal_chain rc ON e.rebutting_explanation_id = rc.id
    )
    SELECT * FROM rebuttal_chain ORDER BY created_at ASC
  `, [explanationId]);

  return result.rows.map(this.mapRowToResponse.bind(this));
}

async getOriginalExplanation(rebuttalId: number): Promise<ExplanationResponse | null> {
  if (!this.isConnected()) return null;

  const result = await this.query(`
    SELECT parent.*
    FROM explanations child
    INNER JOIN explanations parent ON child.rebutting_explanation_id = parent.id
    WHERE child.id = $1
  `, [rebuttalId]);

  return result.rows.length > 0 ? this.mapRowToResponse(result.rows[0]) : null;
}
```

### 6. API Endpoints
**File:** `server/controllers/explanationController.ts`

```typescript
async getRebuttalChain(req: Request, res: Response) {
  const explanationId = parseInt(req.params.id);
  const chain = await repositoryService.explanation.getRebuttalChain(explanationId);
  res.json(chain);
}

async getOriginalExplanation(req: Request, res: Response) {
  const rebuttalId = parseInt(req.params.id);
  const original = await repositoryService.explanation.getOriginalExplanation(rebuttalId);

  if (!original) {
    return res.status(404).json({ error: 'Original explanation not found' });
  }

  res.json(original);
}
```

**Routes:**
```typescript
router.get('/explanations/:id/chain', explanationController.getRebuttalChain);
router.get('/explanations/:id/original', explanationController.getOriginalExplanation);
```

### 7. UI Display
**File:** `client/src/components/puzzle/debate/IndividualDebate.tsx`

```typescript
const { data: chain } = useQuery({
  queryKey: ['rebuttal-chain', explanation.id],
  queryFn: () => fetch(`/api/explanations/${explanation.id}/chain`).then(r => r.json()),
  enabled: !!explanation.rebuttingExplanationId
});

// Display chain
{chain && chain.length > 1 && (
  <div className="rebuttal-chain">
    {chain.map((exp, idx) => (
      <span key={exp.id}>
        {idx > 0 && ' → '}
        <Button variant={exp.id === explanation.id ? 'default' : 'ghost'}>
          {exp.modelName}
        </Button>
      </span>
    ))}
  </div>
)}
```

## Testing
1. Restart server → verify column exists
2. Generate rebuttal in debate mode → verify `rebutting_explanation_id` populated
3. Check UI → verify chain displays
4. Delete original → verify rebuttal's FK becomes NULL (not error)

## Estimated Time
- Database: 15 min ✅
- Interfaces: 10 min
- Repository INSERT: 10 min
- Service extraction: 10 min
- Query methods: 20 min
- API endpoints: 15 min
- UI display: 30 min
- Testing: 10 min

**Total:** ~2 hours