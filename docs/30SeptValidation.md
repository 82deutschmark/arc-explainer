# Validator Adjustments for Simplified Prompt Instructions

**Date:** September 30, 2025
**Author:** Claude Code using Sonnet 4.5
**Status:** Ready for Implementation

## Background

The system prompt instructions in `basePrompts.ts` were simplified to make it easier for LLMs to return valid JSON. Key changes:

1. **JSON_HEADER**: Removed rigid "first field" requirement → Now just says "don't break JSON parsers"
2. **ADDITIONAL_INSTRUCTIONS.solver**: Reduced from verbose paragraph → One line: "Predict the correct output grid"
3. **Field instructions**: Simpler structure, less prescriptive formatting

## Impact

**Benefits:**
- LLMs receive clearer, simpler instructions
- Higher likelihood of valid JSON responses
- Less rigid structure requirements

**Trade-off:**
- LLMs may use field name variations
- May return simpler structures than before
- Validator needs to be MORE flexible to accept valid alternatives

## Task List

### Task 1: Add Field Name Flexibility for Single-Test Cases
**File:** `server/services/schemas/solver.ts`
**Function:** `extractPredictions()`

**What to do:**
- Currently only accepts `predictedOutput` as the field name for single-test predictions
- Add support for common aliases: `output`, `solution`, `answer`, `result`
- Check these aliases in order of preference
- If any alias is found with a valid grid, use it as the prediction
- Log which field name was used for debugging

**Why:** LLMs given simpler instructions may use more natural field names instead of the verbose `predictedOutput`

---

### Task 2: Better Handle Direct Array Responses
**File:** `server/services/schemas/solver.ts`
**Function:** `extractPredictions()`

**What to do:**
- Current code expects `multiplePredictedOutputs: true` plus numbered fields (`predictedOutput1`, `predictedOutput2`, etc.)
- Add fallback: If an LLM returns a field containing a direct array of grids (e.g., `output: [[grid1], [grid2]]`), accept it
- Validate that each item in the array is a valid grid using `validateGrid()`
- If all items are valid grids, treat the array as multiple predictions

**Why:** Simpler instructions may lead LLMs to return arrays directly rather than the complex numbered field structure

---

### Task 3: Add Field Name Validation in validateSolverResponse
**File:** `server/services/schemas/solver.ts`
**Function:** `validateSolverResponse()`

**What to do:**
- Update the validation logic that checks for required prediction fields
- Currently checks: `predictedOutput`, `multiplePredictedOutputs`, `predictedOutputs`
- Expand to also accept the new aliases: `output`, `solution`, `answer`, `result`
- Update error messages to reflect the expanded set of acceptable field names

**Why:** Validation should accept the same field names that extraction supports

---

### Task 4: Update Documentation and Comments
**File:** `server/services/schemas/solver.ts`

**What to do:**
- Find all comments mentioning "first field" requirement (lines 41, 54, 58)
- Update or remove these comments since the prompt no longer enforces field ordering
- Note: JSON parsers don't care about field order, so this was always just a documentation detail
- Add comment explaining the new flexible field name support

**Why:** Keep documentation accurate and prevent future confusion

---

### Task 5: Test Edge Cases in responseValidator.ts
**File:** `server/services/responseValidator.ts`

**What to do:**
- Review the `validateAndEnrichResult()` function
- Check if it has any hard-coded field name references
- If found, ensure it delegates to `extractPredictions()` which now handles field name variations
- Verify it doesn't bypass the flexible extraction logic

**Why:** Ensure the validation pipeline uses the updated extraction logic throughout

---

### Task 6: Add Logging for Field Name Detection
**Files:** `server/services/schemas/solver.ts`, `server/services/responseValidator.ts`

**What to do:**
- Add debug logging when non-standard field names are detected
- Log format: `[EXTRACT] Using alias field '{fieldName}' as prediction`
- This helps identify which LLMs are using which field name conventions
- Useful for monitoring and future prompt optimization

**Why:** Visibility into how LLMs respond to the simplified instructions

---

## Files to Modify

1. **server/services/schemas/solver.ts** (PRIMARY)
   - Function: `extractPredictions()` - Add field name aliases and direct array support
   - Function: `validateSolverResponse()` - Update field validation logic
   - Comments: Update "first field" documentation

2. **server/services/responseValidator.ts** (SECONDARY)
   - Function: `validateAndEnrichResult()` - Verify no hard-coded field names
   - Add logging for field name detection

3. **server/services/prompts/components/basePrompts.ts** (NO CHANGES)
   - Already updated by user - reference only

## Testing Strategy

After implementation:

1. **Test with simplified responses**: Create mock responses using aliases (`output`, `solution`)
2. **Test multi-test cases**: Verify direct array handling works
3. **Test backward compatibility**: Ensure existing `predictedOutput` still works
4. **Run existing puzzles**: Verify no regressions on current database explanations
5. **Monitor logs**: Watch for new field name usage patterns

## Risk Assessment

**Risk Level:** LOW

**Reasoning:**
- These changes make the validator MORE permissive, not less
- Backward compatibility is maintained (still accepts old field names)
- Worst case: We accept more valid formats, which is the intended goal
- No breaking changes to database schema or API contracts

## Success Criteria

✅ Validator accepts `output`, `solution`, `answer`, `result` as prediction field names
✅ Validator handles direct arrays of grids for multi-test cases
✅ All existing tests continue to pass
✅ Documentation accurately reflects flexible field name support
✅ Logging provides visibility into field name usage patterns

## Notes for Next Developer

- The validation logic already supports multiple formats (numbered fields, arrays, old format)
- This change adds MORE flexibility on top of existing logic
- Don't remove existing format support - add new support alongside it
- Test with real LLM responses after deployment to verify the simplified prompts work as expected
- Consider adding metrics to track which field names are most commonly used
