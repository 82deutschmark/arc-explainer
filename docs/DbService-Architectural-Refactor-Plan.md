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