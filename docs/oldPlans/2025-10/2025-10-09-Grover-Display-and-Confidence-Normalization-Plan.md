# Grover Display & Confidence Normalization Fix Plan

**Author**: Cascade using Claude Sonnet 4.5  
**Date**: 2025-10-09T21:12:00-04:00  
**Status**: IN PROGRESS

## Executive Summary

Two critical issues identified:
1. **Grover results not displaying on PuzzleExaminer** - Database has data but frontend never receives it
2. **Confidence normalization bug** - Grok models return 0.85 (meaning 85%) but we store as 0.85% 

Both issues stem from incomplete data flow from database → API → frontend.

---

## Issue 1: Grover Display Problem

### Root Cause Analysis

**Problem**: Grover solver results saved to database but never appear on PuzzleExaminer page.

**Data Flow Breakdown**:
```
Backend Service (grover.ts) 
  ↓ Saves groverIterations, groverBestProgram, iterationCount to DB ✅
Database (explanations table)
  ↓ Columns exist: grover_iterations (JSONB), grover_best_program (TEXT), iteration_count (INTEGER) ✅
ExplanationRepository.ts
  ↓ SELECT queries MISSING these fields ❌ (FIXED)
API Response (/api/puzzle/:puzzleId/explanations)
  ↓ Never includes Grover fields ❌ (FIXED)
Frontend Hook (useExplanation.ts)
  ↓ Not mapping Grover fields ❌ (FIXED)
TypeScript Types (puzzle.ts)
  ↓ Missing Grover field definitions ❌ (FIXED)
UI Components (AnalysisResultCard, etc.)
  ↓ Not detecting or displaying Grover results ⚠️ (IN PROGRESS)
```

### Changes Completed

#### 1. Backend Repository Layer ✅
**File**: `server/repositories/ExplanationRepository.ts`

- **Lines 212-214**: Added to `getExplanationsForPuzzle()` SELECT:
  ```sql
  grover_iterations AS "groverIterations",
  grover_best_program AS "groverBestProgram",
  iteration_count AS "iterationCount",
  ```

- **Lines 256-258**: Added to `getExplanationById()` SELECT (same fields)

- **Line 575**: Added to `mapRowToExplanation()`:
  ```typescript
  groverIterations: this.safeJsonParse(row.groverIterations, 'groverIterations', null),
  ```

**Rationale**: These fields were in INSERT but never in SELECT, causing silent data loss on retrieval.

#### 2. Frontend Type Definitions ✅
**File**: `client/src/types/puzzle.ts`

- **Lines 106-109**: Added to `ExplanationData` interface:
  ```typescript
  // Grover iterative solver fields
  groverIterations?: any[] | null;
  groverBestProgram?: string | null;
  iterationCount?: number | null;
  ```

**Rationale**: TypeScript needs to know these fields exist for type safety and autocomplete.

#### 3. Frontend Data Hook ✅
**File**: `client/src/hooks/useExplanation.ts`

- **Lines 82-85**: Added field mapping:
  ```typescript
  // Map Grover iterative solver fields
  groverIterations: (raw as any).groverIterations,
  groverBestProgram: (raw as any).groverBestProgram,
  iterationCount: (raw as any).iterationCount,
  ```

**Rationale**: Transform API response (camelCase from SQL aliases) into frontend objects.

#### 4. UI Component Detection ✅
**File**: `client/src/components/puzzle/AnalysisResultCard.tsx`

- **Line 158**: Added Grover detection:
  ```typescript
  const isGroverResult = Boolean(result.groverIterations || result.groverBestProgram || result.iterationCount);
  ```

**Rationale**: Similar to `isSaturnResult`, detect when explanation came from Grover solver.

### Changes Still Required

#### 5. UI Component Display ⚠️ IN PROGRESS
**Files to modify**:

1. **`AnalysisResultHeader.tsx`**
   - Add `isGroverResult` prop
   - Show "🔄 Grover Iterative Solver" badge when true
   - Display iteration count in header

2. **`AnalysisResultContent.tsx`**
   - Add `isGroverResult` prop
   - Show "Grover Iterative Search" section heading
   - Display best program code in collapsible section
   - Show iteration count and search progress

3. **`AnalysisResultMetrics.tsx`**
   - Add Grover-specific metrics display
   - Show iteration count, convergence, program evolution

4. **`AnalysisResultCard.tsx`** (continued)
   - Pass `isGroverResult` to child components
   - Add Grover metrics section (similar to Saturn line 224)

#### Implementation Plan for UI Display

```typescript
// In AnalysisResultContent.tsx, add Grover section:

{isGroverResult && result.groverBestProgram && (
  <div className="bg-green-50 border border-green-200 rounded">
    <button onClick={() => setShowGroverProgram(!showGroverProgram)}>
      <div className="flex items-center gap-2">
        <span className="text-sm">🔄</span>
        <h5 className="font-semibold text-green-800">Grover Discovered Program</h5>
        <Badge variant="outline" className="text-xs bg-green-50 border-green-200">
          {result.iterationCount} iterations
        </Badge>
      </div>
    </button>
    {showGroverProgram && (
      <div className="px-3 pb-3">
        <div className="bg-white p-3 rounded border border-green-100">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
            {result.groverBestProgram}
          </pre>
        </div>
      </div>
    )}
  </div>
)}
```

---

## Issue 2: Confidence Normalization Bug

### Root Cause Analysis

**Problem**: Grok models return confidence as decimal (0.85 = 85%, 1 = 100%) but we store as-is, treating 1 as 1%.

**Evidence**:
- DB record id: 33701 has `confidence: 1` (should be 100)
- Breaks Trustworthiness metrics (expects 0-100 scale)
- Grok consistently returns 0-1 range, other models return 0-100 range

**Impact**:
- Grok results excluded from leaderboards (0-1% confidence looks unreliable)
- Trustworthiness calculations incorrect
- User perception: "Why is Grok always showing <1% confidence?"

### Current Normalization Logic

**File**: `server/repositories/ExplanationRepository.ts`

**Lines 686-710**: `normalizeConfidence()` method:
```typescript
private normalizeConfidence(confidence: any): number | null {
  if (confidence === null || confidence === undefined) {
    return null;
  }

  const confNum = typeof confidence === 'string' 
    ? parseFloat(confidence.replace('%', '')) 
    : confidence;

  if (isNaN(confNum)) {
    return null;
  }

  // If confidence is between 0 and 1, assume it's a percentage (like 0.85 = 85%)
  if (confNum > 0 && confNum <= 1) {
    return Math.round(confNum * 100);
  }

  // If confidence is between 1 and 100, it's already a percentage
  if (confNum > 1 && confNum <= 100) {
    return Math.round(confNum);
  }

  return Math.round(confNum);
}
```

**STATUS**: ✅ **ALREADY CORRECT!**

The normalization logic IS correctly handling 0-1 scale! It multiplies by 100 for values ≤ 1.

### The Real Problem

**Database already has incorrect data** from before normalization was added!

**Solution**: Migration script to fix existing records.

### Migration Script Required

**File to create**: `scripts/fix-grok-confidence.js`

```javascript
/**
 * Fix confidence values for Grok model entries
 * Grok models return 0-1 range (0.85 = 85%) but old entries stored raw
 * This script multiplies by 100 for Grok models where confidence ≤ 1
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client);

async function fixGroverConfidence() {
  console.log('Finding Grok entries with confidence ≤ 1...');
  
  const result = await db.execute(sql`
    UPDATE explanations
    SET confidence = confidence * 100
    WHERE model_name LIKE 'grok%'
      AND confidence <= 1
      AND confidence > 0
    RETURNING id, model_name, confidence
  `);
  
  console.log(`Fixed ${result.rowCount} Grok entries`);
  console.log('Sample updated records:', result.rows.slice(0, 5));
}

await fixGroverConfidence();
await client.end();
```

**Action Items**:
1. ✅ Verify `normalizeConfidence()` is called for ALL new inserts
2. ⚠️ Create and run migration script for existing records
3. ⚠️ Verify Grok entries in Trustworthiness leaderboard after fix

---

## Testing Checklist

### Grover Display Testing
- [ ] Run Grover solver on test puzzle
- [ ] Verify database INSERT includes grover_* fields
- [ ] Verify API response `/api/puzzle/:puzzleId/explanations` includes fields
- [ ] Verify frontend receives fields in React DevTools
- [ ] Verify AnalysisResultCard shows "🔄 Grover" badge
- [ ] Verify iteration count displays correctly
- [ ] Verify best program shows in collapsible section
- [ ] Verify raw DB view includes Grover fields

### Confidence Normalization Testing
- [ ] Query DB for Grok entries with confidence ≤ 1
- [ ] Run migration script
- [ ] Verify updated confidence values (0.85 → 85)
- [ ] Check Trustworthiness leaderboard includes Grok models
- [ ] Verify new Grok analyses store confidence correctly (85, not 0.85)
- [ ] Check edge case: OpenAI o3 with actual 1% confidence (should stay 1)

---

## Related Files

### Backend
- `server/services/grover.ts` - Generates groverIterations, groverBestProgram
- `server/repositories/ExplanationRepository.ts` - Database queries and normalization
- `server/repositories/interfaces/IExplanationRepository.ts` - Interface definitions
- `server/controllers/explanationController.ts` - API endpoint handlers

### Frontend
- `client/src/types/puzzle.ts` - TypeScript type definitions
- `client/src/hooks/useExplanation.ts` - Data fetching hook
- `client/src/components/puzzle/AnalysisResultCard.tsx` - Main display container
- `client/src/components/puzzle/AnalysisResultHeader.tsx` - Header with badges
- `client/src/components/puzzle/AnalysisResultContent.tsx` - Content sections
- `client/src/components/puzzle/AnalysisResultMetrics.tsx` - Metrics display

### Scripts
- `scripts/find-zero-confidence-entries.js` - Find problematic records
- `scripts/fix-grok-confidence.js` - Migration script (TO CREATE)

---

## Commit Strategy

1. **Commit 1**: "Fix: Add Grover fields to explanation SELECT queries"
   - ExplanationRepository.ts changes
   - Fixes silent data loss on retrieval

2. **Commit 2**: "Fix: Add Grover field types and mapping to frontend"
   - puzzle.ts type definitions
   - useExplanation.ts field mapping
   - AnalysisResultCard.tsx detection

3. **Commit 3**: "Feat: Display Grover results in PuzzleExaminer UI"
   - AnalysisResultHeader.tsx Grover badge
   - AnalysisResultContent.tsx program display
   - AnalysisResultMetrics.tsx iteration display

4. **Commit 4**: "Fix: Migrate Grok confidence values from decimal to percentage"
   - Migration script
   - Documentation update

---

## Risk Assessment

**Grover Display**:
- **Low risk**: Additive changes only, no breaking changes
- **Impact**: Positive - users finally see Grover results

**Confidence Migration**:
- **Medium risk**: UPDATE query modifies existing data
- **Mitigation**: Test on staging first, backup production DB
- **Rollback**: Divide by 100 if issues found

---

## Success Criteria

1. ✅ Grover explanations visible on PuzzleExaminer page
2. ✅ Iteration count and best program displayed
3. ✅ Grok models appear in Trustworthiness leaderboard
4. ✅ Confidence values normalized to 0-100 scale consistently
5. ✅ No data loss or corruption
6. ✅ E2E test: Run Grover → See full results on PuzzleExaminer

---

## Next Steps (Immediate)

1. ✅ Pass `isGroverResult` to child components
2. ⚠️ Add Grover display sections to AnalysisResultContent
3. ⚠️ Add Grover metrics to AnalysisResultMetrics
4. ⚠️ Test with real Grover data
5. ⚠️ Create confidence migration script
6. ⚠️ Update CHANGELOG.md
