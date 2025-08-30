# dbService.ts Architectural Refactor Plan
**Date**: August 25, 2025  
**Author**: Cascade  
**Objective**: Extract parsing/transformation logic from dbService.ts to achieve pure database operations

## Problem Statement
`dbService.ts` is currently 1400+ lines and contains mixed responsibilities:
- ✅ Database operations (INSERT, SELECT, etc.)
- ❌ Data transformation (`normalizeConfidence`, `safeJsonStringify`)
- ❌ JSON parsing/serialization (`safeJsonParse` - duplicated in 2 places)
- ❌ Data validation (hints array processing)

**Architecture Violation**: Database service handling business logic instead of pure persistence.

## Root Cause Analysis
1. **JSON Serialization Bug**: `reasoning_items` JSONB column was receiving stringified data instead of raw objects
2. **Code Duplication**: `safeJsonParse()` function exists identically in 2+ places  
3. **Mixed Concerns**: Transformation logic scattered throughout database layer
4. **Brittle Type Handling**: `multiplePredictedOutputs` serving dual purpose (boolean flag + array data)

## Architectural Solution

### Phase 1: Extract Utilities ✅ COMPLETED
**Created**: `server/utils/dataTransformers.ts`
**Functions Extracted**:
- `normalizeConfidence()` - confidence value normalization
- `safeJsonStringify()` - object to JSON string serialization  
- `safeJsonParse()` - JSON string deserialization with error handling
- `processHints()` - hints array validation
- `processMultiplePredictedOutputs()` - boolean/array type handling

### Phase 2: Update dbService.ts Imports
**File**: `server/services/dbService.ts`
**Actions**:
1. Add import statement for dataTransformers utilities
2. Replace local `normalizeConfidence()` calls with imported version
3. Replace local `safeJsonStringify()` calls with imported version
4. Replace hints processing logic with `processHints()` utility
5. Replace multiplePredictedOutputs handling with utility function

### Phase 3: Remove Duplicate Logic
**Actions**:
1. Delete `normalizeConfidence()` function (lines 14-22)
2. Delete `safeJsonStringify()` function (lines 32-78) 
3. Replace both `safeJsonParse()` implementations (lines 852, 940) with imported version
4. Remove hints processing logic (lines 514-518)
5. Simplify multiplePredictedOutputs handling

### Phase 4: Update Other Services
**Check for usage in**:
- `explanationService.ts`
- `puzzleController.ts` 
- Any other services importing from dbService.ts

### Phase 5: Testing & Validation
**Test Cases**:
- Single-test puzzle analysis and database save
- Multi-test puzzle analysis and database save  
- JSON field retrieval and parsing
- Edge cases (null values, malformed data)

## Implementation Steps

### Step 1: Add Imports to dbService.ts
```typescript
import { 
  normalizeConfidence, 
  safeJsonStringify, 
  safeJsonParse, 
  processHints,
  processMultiplePredictedOutputs 
} from '../utils/dataTransformers.js';
```

### Step 2: Replace Function Calls
**Before**:
```typescript
normalizeConfidence(confidence)              // Line ~543
safeJsonStringify(saturnImages)              // Line ~553  
const hints = Array.isArray(rawHints)...    // Lines 514-518
```

**After**:
```typescript
normalizeConfidence(confidence)              // Uses imported function
safeJsonStringify(saturnImages)              // Uses imported function  
const hints = processHints(rawHints);        // Single utility call
```

### Step 3: Remove Local Function Definitions
- Delete `normalizeConfidence` (lines 14-22)
- Delete `safeJsonStringify` (lines 32-78)
- Delete hints processing block (lines 514-518)

### Step 4: Replace safeJsonParse Duplications
**Lines 852 & 940**: Replace local function definitions with imported `safeJsonParse`

### Step 5: Git Commits (Atomic Changes)
1. **Commit**: "Create dataTransformers utility module with extracted parsing functions"
2. **Commit**: "Add dataTransformers imports to dbService.ts"  
3. **Commit**: "Replace local parsing functions with dataTransformers utilities"
4. **Commit**: "Remove duplicate safeJsonParse implementations"
5. **Commit**: "Clean up dbService.ts - remove all local parsing logic"
6. **Commit**: "Test and validate architectural refactor"

## Expected Benefits
- **Reduced Complexity**: dbService.ts drops from 1400+ to ~1200 lines
- **Eliminated Duplication**: Remove 2 identical `safeJsonParse` functions
- **Clear Separation**: Database operations vs data transformation
- **Reusable Utilities**: Functions available across all services
- **Easier Testing**: Parsing logic can be unit tested independently
- **Fixed Bugs**: JSON serialization issues resolved

## Risk Assessment
**Low Risk**: 
- Pure extraction of existing functions
- No logic changes, only location changes
- Comprehensive testing planned

**Mitigation**:
- Atomic git commits for easy rollback
- Test each step before proceeding  
- Maintain backward compatibility

## Success Criteria
1. ✅ All existing functionality preserved
2. ✅ Multi-test puzzle JSON serialization works
3. ✅ Single-test puzzles continue working
4. ✅ Database queries return properly parsed data
5. ✅ Code is cleaner and more maintainable
6. ✅ No duplicate logic remains

---

## Implementation Log
- **Phase 1**: ✅ Created `dataTransformers.ts` utility module
- **Phase 2**: 🔄 IN PROGRESS - Updating dbService.ts imports
- **Phase 3**: ⏳ PENDING - Remove duplicate logic
- **Phase 4**: ⏳ PENDING - Update other services  
- **Phase 5**: ⏳ PENDING - Testing & validation


Title: What the junior dev is doing wrong (and how to fix it without more churn)
Date: 2025-08-25

Executive summary

The errors aren’t from “TEXT columns rejecting JSON.” They’re from casts/functions that expect json/jsonb receiving undefined or non‑JSON text.
Several debugging assumptions are incorrect (e.g., “NULL causes invalid input syntax for type json”).
The team keeps changing many things at once (migrations, wrappers, controller rewrites) without first verifying the actual DB schema and the $n → value mapping.
A single semantic error is present: reusing multiplePredictedOutputs for both a boolean and an array. Fix it, but don’t claim it explains every JSON error.
What’s wrong, specifically

Misdiagnosis of the PostgreSQL error
Claim: “Passing NULL to a TEXT column that holds JSON triggers invalid input syntax for type json.”
Reality: TEXT columns do not validate JSON; they accept NULL and any string. The error appears only when you cast to json/jsonb (e.g., $2::jsonb) or call a JSON function and the input is invalid (like the literal string undefined).
Claim: “Return the string 'null' to fix it.”
Reality: Mapping JS null/undefined to the literal "null" is a brittle hack. It hides real undefined bugs and plants the word "null" in TEXT columns. It is unnecessary to store the string "null" in TEXT; SQL NULL is valid, and for JSONB columns, null parameters cast fine to jsonb NULL.
2. Mixing conventions and applying the wrong one in the wrong place

Sometimes you pass native JS objects while also casting $n::jsonb in SQL; other times you stringify while leaving casts in place; elsewhere you send objects to TEXT columns. Pick one convention per column and enforce it in one chokepoint.
COALESCE($param, 'null') won’t save you if $param::jsonb is evaluated first; syntax errors occur before COALESCE can run. Also COALESCE does nothing for the case where the driver sent 'undefined'.
3. Not verifying the actual schema before coding “fixes”

You assumed migrations changed TEXT → JSONB, then wrote code for JSONB—but your schema still has TEXT. You never captured a schema snapshot in logs/tests from the running app process (which could have been three lines of code).
You tried to run risky ALTER TYPE flows during server startup. That’s the worst time to mutate a schema you haven’t verified.
4. Overwriting a boolean field with arrays (design error)

multiplePredictedOutputs (boolean) is later reassigned to the array of grids. This breaks downstream logic and guarantees type inconsistency if the database expects a boolean or a consistent JSON shape.
This must be corrected, but it does not explain errors logged for other fields (predictedOutputGrid, reasoningItems, saturnImages).
5. Letting undefined reach JSON casts

Your own logs show saturnImages type: undefined. If any $n is undefined and is coerced to the string "undefined" or otherwise hits $n::json(b), you’ll get invalid input syntax for type json.
A DB boundary should never see undefined. Decide: either throw, or coerce to SQL NULL, consistently.
6. Too many moving parts at once

Rewrites, migrations, new wrappers, controller changes, “fixes” to stringify functions—all at once. This guarantees you can’t isolate the actual failing parameter.
What the database is actually doing (so you stop fighting it)

TEXT columns
Accept NULL and any string. They will not raise “invalid input syntax for type json.”
::json / ::jsonb casts or JSON functions (to_json, jsonb_build_object, etc.)
Will raise invalid input syntax for type json if the input is not valid JSON text (e.g., 'undefined', an object that your driver didn’t stringify, or a truncated string).
Will accept SQL NULL and produce NULL json/jsonb without error.
Therefore: your errors are proof that somewhere your SQL or functions are casting to json/jsonb while you’re passing non‑JSON (objects/undefined/“undefined”).
The concrete, minimal, non‑disruptive fix path
Phase 0 — Snapshot reality (10 min)

From the running Node process, log the actual data types for the involved columns once, at startup:
await pool.query(  select column_name, data_type   from information_schema.columns   where table_name = 'explanations'     and column_name in ('predicted_output_grid','reasoning_items','saturn_images','multiple_predicted_outputs','multi_test_results')   order by column_name).then(r => console.info('[schema]', r.rows));

Keep this output in your CI logs and in docs. No more guessing.
Phase 1 — One chokepoint, strict guards (drop-in)

Add a single wrapper around pool.query. It must:
Throw if any parameter is undefined.
Log the $n → typeof mapping and a small preview (not the whole payload).
Apply exactly one of two policies:
Policy A (TEXT columns): stringify objects; pass strings or NULL; do not leave ::json(b) in SQL for those params.
Policy B (JSONB columns): pass JS objects or JSON strings; keep ::jsonb in SQL if you send strings; remove casts if you pass objects. Do not mix per column.
Example wrapper

function toTextJSON(v) {
if (v === undefined) throw new Error('undefined param');
if (v === null) return null;
if (typeof v === 'string') return v;
return JSON.stringify(v);
}

function toJsonbParam(v) {
if (v === undefined) return null; // or throw; choose one convention
return v; // pass object or string, but be consistent with SQL
}

export async function q(pool, text, values, ctx = 'unknown') {
// 1) Assert no undefined
values.forEach((v, i) => { if (v === undefined) throw new Error($${i+1} undefined in ${ctx}); });

// 2) Log mapping
const params = [...text.matchAll(/$(\d+)/g)].map(m => Number(m[1]));
console.debug('[SQL]', ctx, params.map(n => ({ p: $${n}, type: typeof values[n-1] })));

return pool.query(text, values);
}

Phase 2 — Make each statement consistent with schema (30–60 min)

If your snapshot shows TEXT:
Remove ::json/::jsonb casts for these positions in SQL.
Apply toTextJSON(value) to those positions before query.
If your snapshot shows JSONB:
Either pass strings plus ::jsonb casts, or pass native objects and remove the casts. Pick one per column and document it.
Corrected example (assuming snapshot shows TEXT for predicted_output_grid, reasoning_items, saturn_images; JSONB for multi_test_results)

const text =   insert into explanations (     puzzle_id,     predicted_output_grid,         -- TEXT (stores JSON string)     multiple_predicted_outputs,    -- BOOLEAN (boolean flag, see below)     reasoning_items,               -- TEXT (stores JSON string)     saturn_images,                 -- TEXT (stores JSON string)     multi_test_results             -- JSONB (true JSONB)   ) values ($1, $2, $3, $4, $5, $6);

const values = [
puzzleId,
toTextJSON(predictedOutputGrid),     // string | null, never undefined
hasMultiplePredictions,              // boolean only
toTextJSON(reasoningItems),          // string | null
toTextJSON(saturnImages),            // string | null
toJsonbParam(multiTestResults),      // object | string | null (match SQL convention)
];

await q(pool, text, values, 'explanations.insert');

Phase 3 — Fix the field collision (no debate here)

Stop overloading multiplePredictedOutputs. Do one of the following:
Keep multiplePredictedOutputs as a boolean flag (rename to hasMultiplePredictions) and store the arrays in multiplePredictedOutputsData or multiTestPredictionGrids.
If the table already has multi_test_results JSONB, use that for the arrays and keep multiple_predicted_outputs as BOOLEAN.
Update controller:
result.hasMultiplePredictions = result.multiplePredictedOutputs === true;
result.multiTestPredictionGrids = multi.predictedGrids;  // not the same field
// Downstream logic uses hasMultiplePredictions exclusively for the boolean.

Phase 4 — Only then consider a migration to JSONB (optional, later)

Do not run schema migrations inside app startup. Use a proper migration tool (knex, node-pg-migrate, Prisma Migrate, Alembic, etc.).
If/when you migrate TEXT → JSONB:
First ensure all existing TEXT rows are valid JSON or NULL. If not, set invalids to NULL or fix them.
Then run:
alter table explanations
alter column predicted_output_grid type jsonb using nullif(predicted_output_grid, '')::jsonb,
alter column reasoning_items       type jsonb using nullif(reasoning_items, '')::jsonb,
alter column saturn_images         type jsonb using nullif(saturn_images, '')::jsonb;

After migration, simplify code: stop stringifying; pass objects; remove ::json(b) casts for those columns.
Bad recommendations in the current “plan” (do not ship)

Returning the literal string "null" from safeJsonStringify for TEXT columns. It papers over undefined bugs and leaves sentinel strings in your data.
Relying on COALESCE($param, 'null') to fix syntax errors. It doesn’t prevent invalid casts and is often evaluated too late.
Continuing to assume migrations “took” without a schema snapshot.
Running complex ALTER TYPE logic during server startup.
Massive rewrites without isolating the single failing $n.
What your logging already proved (use it)

“[ERROR][database] - predictedOutputGrid type: object … reasoningItems type: object … saturnImages type: undefined”
That means: you passed an object into a position where the SQL later casts or functions expect json/jsonb text, or you passed undefined into a casted json/jsonb param. Fix at the call site or wrapper, not by inventing "null" strings.
Actionable checklist for the junior dev (sequence matters)

Add/keep a single query chokepoint; throw on undefined; log $n → typeof.
Print a one-time schema snapshot at boot and paste it into the PR.
For each statement, align parameter handling with the actual column types; remove stray ::json(b) on TEXT columns.
Split multiplePredictedOutputs into a boolean flag and a separate array field; stop overloading.
Retest one failing insert end-to-end before touching migrations.
Only after green, plan a separate PR to migrate TEXT columns to JSONB (optional).
Files likely monolithic/brittle to refactor next

server/services/dbService.ts (880–1400 lines): split into
db/connection.ts (pool/client),
db/query.ts (chokepoint wrapper),
repo/explanations.ts (pure SQL builders: text + values),
repo/_shared.ts (column lists, helpers).
server/utils/dataTransformers.ts: keep JSON parse/stringify helpers pure and side‑effect free; no logging.
Centralize column arrays so text and values derive from the same ordered list; never push conditionally into values without regenerating SQL.
If you share the exact INSERT text and the values construction for the failing call, I’ll annotate the $n that’s currently taking an object/undefined and give you the minimal one‑line fix for that parameter.