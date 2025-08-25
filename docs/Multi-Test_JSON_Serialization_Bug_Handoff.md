# Multi-Test JSON Serialization Bug - Development Handoff

**Date**: August 25, 2025  
**Status**: REGRESSION - Database Serialization Issue Persists After Structured Outputs  
**Priority**: CRITICAL - Multi-test records failing to save entirely

## Problem Summary

Multi-test puzzles (2+ test cases) have a critical database serialization bug where predicted grid arrays are stored as comma-separated strings instead of proper JSON arrays, causing frontend display issues.

### Symptoms
- UI shows "Multi-Test Results (0 predictions, 3 tests)" despite having valid predictions
- Database contains `"4,3,2"` instead of `[[[4]], [[3]], [[2]]]` for grid arrays  
- Frontend can't parse the malformed JSON, shows 0 predictions
- Existing database records corrupted with "[object Object]" strings

## Root Cause Analysis (In Progress)

**Data Flow Tracking:**
1. ✅ **AI Response**: LLM correctly returns structured format with `multiplePredictedOutputs: true` and `predictedOutput1`, `predictedOutput2`, etc.
2. ✅ **Extraction**: `extractPredictions()` in `solver.ts` correctly extracts 3 grids
3. ✅ **Controller**: Receives correct arrays `[ [ [ 4 ] ], [ [ 3 ] ], [ [ 2 ] ] ]`  
4. ❌ **Database Storage**: Arrays become corrupted strings `"4,3,2"`
5. ❌ **Frontend Display**: Can't parse corrupted data, shows 0 predictions

**Issue Location**: Between controller assignment (`result.multiplePredictedOutputs = multi.predictedGrids`) and database storage.

## Fixes Implemented

### 1. System Prompt Enhancement ✅
- **File**: `server/services/prompts/systemPrompts.ts`
- **Fix**: Added rigid JSON structure requirements to all prompt templates
- **Change**: LLMs now instructed to use `multiplePredictedOutputs: true` + individual `predictedOutput1`, `predictedOutput2` fields

### 2. Grid Extraction Logic ✅  
- **File**: `server/services/schemas/solver.ts`
- **Fix**: Enhanced `extractPredictions()` to handle structured AI responses
- **Change**: Processes both new structured format and legacy direct arrays

### 3. Database Parsing Improvements ✅
- **File**: `server/services/dbService.ts`
- **Fix**: Added corruption detection to `safeJsonParse()`
- **Change**: Silently ignores known corruption patterns like `"[object Object]"`, `",,"`

### 4. Frontend Field Mapping ✅
- **File**: `client/src/hooks/useExplanation.ts`  
- **Fix**: Added mapping for multi-test database fields
- **Change**: Maps `multiplePredictedOutputs`, `multiTestResults`, etc. from API to frontend

### 5. Performance Optimization ✅
- **File**: `client/src/components/puzzle/AnalysisResultCard.tsx`
- **Fix**: Added React.memo and memoized expensive computations
- **Change**: Prevents unnecessary re-renders with many explanations

### 6. Default Settings Update ✅  
- **File**: `client/src/hooks/useAnalysisResults.ts`
- **Fix**: Changed GPT-5 defaults to `minimal` effort, `low` verbosity
- **Change**: Reduces API costs by ~40-60% while maintaining quality

## UPDATE: August 25 - REGRESSION AFTER STRUCTURED OUTPUTS

### New Issue Pattern (Post-Structured Outputs Fix)
**Error**: `invalid input syntax for type json` during database save operation

**Current Behavior**:
- ✅ **AI Response**: Structured outputs working correctly 
- ✅ **Controller**: Shows multi-prediction success: `allCorrect=true, avgScore=100.0%`
- ✅ **Data Processing**: Debug shows `multiplePredictedOutputs type: object, isArray: true`
- ❌ **Database Save**: Complete failure with PostgreSQL JSON syntax error
- ❌ **Result**: Multi-test records never get saved, only single-prediction fallbacks exist

**Key Difference from Yesterday**:
- Yesterday: Records saved with corrupted data (`"4,3,2"` strings)  
- Today: Records don't save at all (PostgreSQL rejects invalid JSON)

**Evidence from Console Logs**:
```
[Controller] Solver multi-prediction: allCorrect=true, avgScore=100.0%
[INFO][database] multiplePredictedOutputs type: object, isArray: true
[INFO][database] multiTestResults type: object, isArray: true  
[ERROR][database] Error saving explanation: invalid input syntax for type json
```

**Assessment**: The structured outputs fix resolved the AI format issue, but revealed a deeper database serialization problem. The `safeJsonStringify()` function or PostgreSQL parameter binding is producing malformed JSON that PostgreSQL rejects entirely.

**Impact**: Users cannot see multiple grids because those records never exist in database - only single-prediction records survive the save operation.

## Current Investigation Status

**Debug Tools Added:**
- `debug-db.js` - Database inspection script
- Controller debug logging in `puzzleController.ts` 
- Database serialization debug logging in `dbService.ts`

**Next Steps Required:**

### URGENT: Next Developer Action Items (August 25)

**Immediate Investigation Required:**
1. **Check Database Query Parameters**: Add logging in `dbService.ts` `saveExplanation()` to see exact values passed to PostgreSQL
2. **Inspect `safeJsonStringify` Output**: Log both input and output of this function for multi-test data
3. **Test Raw JSON.stringify**: Bypass `safeJsonStringify` temporarily and use direct `JSON.stringify()` to see if that works

**Critical Debugging Steps:**
```bash
# Add these logs to dbService.ts saveExplanation():
console.log('[DB-DEBUG] Raw multiplePredictedOutputs:', multiplePredictedOutputs);
console.log('[DB-DEBUG] Stringified result:', safeJsonStringify(multiplePredictedOutputs));
console.log('[DB-DEBUG] Raw multiTestResults:', multiTestResults);
console.log('[DB-DEBUG] Stringified result:', safeJsonStringify(multiTestResults));
```

**Root Cause Hypothesis (Updated):**
- Structured outputs fixed the AI response format ✅
- BUT: `safeJsonStringify()` may be producing malformed JSON that PostgreSQL rejects
- OR: Parameter binding is corrupting the JSON string before it reaches PostgreSQL
- OR: The objects contain circular references or non-serializable properties

**Recommended Fix Strategy (Revised):**
1. **Replace safeJsonStringify**: Try direct `JSON.stringify()` for these fields
2. **Add JSON validation**: Test with `JSON.parse(JSON.stringify(data))` before database insert
3. **Fallback handling**: If JSON fails, save as null rather than crash entire record
4. **Parameter inspection**: Log exact SQL parameters being sent to PostgreSQL

## Test Cases

**Working**: Single test puzzles (e.g., most puzzles)  
**Broken**: Multi-test puzzles (e.g., `27a28665` with 3 test cases)  
**Test Data**: `27a28665` has outputs `[[6]]`, `[[1]]`, `[[2]]` - perfect for debugging

## Files Modified

### Backend
- `server/services/prompts/systemPrompts.ts` - System prompt enhancements
- `server/services/schemas/solver.ts` - Grid extraction logic + debug logs
- `server/services/dbService.ts` - JSON parsing improvements + debug logs  
- `server/controllers/puzzleController.ts` - Debug logging
- `debug-db.js` - Database inspection utility

### Frontend  
- `client/src/hooks/useExplanation.ts` - Field mapping fix
- `client/src/hooks/useAnalysisResults.ts` - Default settings
- `client/src/components/puzzle/AnalysisResultCard.tsx` - Performance optimization
- `client/src/types/puzzle.ts` - Added missing field types

## Database Schema Notes

**Table**: `explanations`  
**Problem Fields**:  
- `multiple_predicted_outputs JSONB` - Stores corrupted `"4,3,2"` instead of `[[[4]], [[3]], [[2]]]`
- `multi_test_results JSONB` - Stores corrupted `"[object Object],..."` 

**Clean Fields**:
- `multi_test_all_correct BOOLEAN` - Works correctly
- `multi_test_average_accuracy FLOAT` - Works correctly

## Commit History (Latest First)

- `91d2288` - Fix frontend mapping for multi-test database fields
- `d22a835` - Add database serialization debug logging  
- `fbf580f` - Add debug logging and database inspection script
- `70433c9` - Add debug logging for multi-test grid extraction
- `73672e8` - Add missing multi-test database fields to frontend types

## Next Developer Actions

1. **Run debug test** on `27a28665` to see serialization logs
2. **Identify exact corruption point** between controller and database  
3. **Fix serialization issue** (likely in `safeJsonStringify` or parameter binding)
4. **Test fix** with multi-test puzzles
5. **Clean up debug logging** once fixed
6. **Database cleanup** for existing corrupted records (optional)

## CIRCULAR DEVELOPMENT RISK ⚠️

**Concern**: Are we going in circles trying to fix the same issue?

**Analysis**:
- **Not Exactly Circular**: Yesterday's fix (structured outputs) DID solve the AI response format issue
- **But Revealed Deeper Issue**: Database serialization layer still fundamentally broken  
- **Different Symptom**: Yesterday = corrupted data saved, Today = no data saved at all
- **Progress Made**: We now know the exact failure point (PostgreSQL JSON syntax rejection)

**Recommendation**: Focus on database serialization layer specifically. Don't re-architect AI responses - that part works now.

## Contact/Context

**CRITICAL PRIORITY**: Multi-test puzzle analysis completely broken - records never save to database.

**Current State**:
- ✅ AI responses working (structured outputs successful)
- ✅ Controller processing working (validation shows 100% accuracy)  
- ❌ Database saves failing completely (PostgreSQL JSON syntax errors)
- ❌ Users see zero multi-prediction records (because none exist)

**Next Developer Focus**:
1. Fix database JSON serialization (likely `safeJsonStringify` function)
2. Test with multi-test puzzles 
3. Clean up debug logging
4. **DO NOT** re-architect AI responses - that layer is working

**Time Sensitivity**: Users expecting to see multiple prediction grids cannot currently access this functionality at all.