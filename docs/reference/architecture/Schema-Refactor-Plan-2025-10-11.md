# Schema Refactor Plan - October 11, 2025

## Goal
Replace 6 bloated schema files with ONE intelligent schema builder that adapts to test count and provider capabilities.

## Core Principle
The model ONLY needs to output prediction grids. Everything else is optional. The schema should reflect what we KNOW (test count) rather than force the model to handle all cases.

---

## Phase 1: Foundation - Core Schema Builder

### [ ] 1.1 Create `server/services/schemas/core.ts`
- Export `buildCoreSchema(testCount: number)` function
- Single-test: only `predictedOutput` in required array
- Multi-test (2+): only `predictedOutput1`, `predictedOutput2`, etc. in required array (exact count)
- All optional fields: `solvingStrategy`, `patternDescription`, `hints`, `confidence`
- Grid schema definition: 2D array of integers 0-9
- No boolean flags, no empty field forcing

### [ ] 1.2 Validate core schema logic
- Test with testCount=1: should require only `predictedOutput`
- Test with testCount=2: should require `predictedOutput1`, `predictedOutput2`
- Test with testCount=3: should require `predictedOutput1`, `predictedOutput2`, `predictedOutput3`

---

## Phase 2: Provider-Specific Wrappers

### [ ] 2.1 Create `server/services/schemas/providers/openai.ts`
- Export `getOpenAISchema(testCount: number)` 
- Wraps core schema with OpenAI format: `{name, strict, schema}`
- Uses `buildCoreSchema(testCount)` internally
- No hardcoded required arrays

### [ ] 2.2 Create `server/services/schemas/providers/grok.ts`
- Export `getGrokSchema(testCount: number)`
- Wraps core schema with xAI format: `{schema}` (no name/strict)
- Uses `buildCoreSchema(testCount)` internally
- No hardcoded required arrays

### [ ] 2.3 Update `server/services/schemas/arcJsonSchema.ts`
- Replace entire file with thin wrapper
- Import and re-export `getOpenAISchema` from providers/openai
- Add deprecation notice: "Use getOpenAISchema() directly"
- Keep file for backward compatibility during migration

### [ ] 2.4 Update `server/services/schemas/grokJsonSchema.ts`
- Replace entire file with thin wrapper
- Import and re-export `getGrokSchema` from providers/grok
- Add deprecation notice: "Use getGrokSchema() directly"
- Keep file for backward compatibility during migration

---

## Phase 3: Smart Prompt Instructions

### [ ] 3.1 Update `server/services/prompts/components/jsonInstructions.ts`
- Modify `buildJsonInstructions()` signature: `(testCount: number, hasStructuredOutput: boolean)`
- Remove generic multi-test instructions
- If `hasStructuredOutput === true`: return minimal instructions (schema handles it)
- If `hasStructuredOutput === false` and `testCount === 1`: list only `predictedOutput`
- If `hasStructuredOutput === false` and `testCount > 1`: list `predictedOutput1`, `predictedOutput2`, etc. (exact count)
- Remove all references to boolean flags or conditional field logic

### [ ] 3.2 Update prompt builder to pass test count
- Modify `buildSystemPrompt()` in `server/services/prompts/components/promptBuilder.ts`
- Accept optional `testCount` parameter
- Pass to `buildJsonInstructions()` when called

---

## Phase 4: Base Service Integration

### [ ] 4.1 Update `server/services/base/BaseAIService.ts`
- Add `protected getSchemaForModel(modelKey: string, testCount: number)` helper
- Returns appropriate schema based on provider and test count
- OpenAI provider: use `getOpenAISchema(testCount)`
- xAI provider: use `getGrokSchema(testCount)`
- Other providers: return null (prompt-based)

### [ ] 4.2 Update prompt building
- Extract test count early: `const testCount = task.test.length`
- Pass testCount to prompt builder
- Pass testCount to schema getter

---

## Phase 5: OpenAI Service Updates

### [ ] 5.1 Update `server/services/openai.ts` - `buildResponsesRequestBody()`
- Remove hardcoded `ARC_JSON_SCHEMA` constant usage
- Calculate `const testCount = task.test.length` (need to pass task or testCount)
- Call `getOpenAISchema(testCount)` dynamically
- Use dynamic schema in structuredFormat

### [ ] 5.2 Update `server/services/openai.ts` - `callProviderAPI()`
- Same changes as buildResponsesRequestBody
- Ensure continuation requests use same dynamic schema

### [ ] 5.3 Update `server/services/openai.ts` - prompt building
- Pass testCount to promptPackage builder
- Ensure structured output models get minimal instructions
- Non-structured models get detailed instructions

---

## Phase 6: Grok Service Updates

### [ ] 6.1 Update `server/services/grok.ts` - streaming method
- Remove hardcoded `GROK_JSON_SCHEMA` usage
- Add `const testCount = task.test.length`
- Use `getGrokSchema(testCount)` in response_format
- Apply to all three places: streaming, non-streaming, preview

### [ ] 6.2 Update `server/services/grok.ts` - non-streaming method
- Same changes as streaming method
- Ensure continuation requests work correctly

### [ ] 6.3 Update `server/services/grok.ts` - prompt building
- Pass testCount to promptPackage builder
- Structured models get minimal instructions

---

## Phase 7: Prompt-Based Providers (Anthropic, Gemini, DeepSeek)

### [ ] 7.1 Update `server/services/anthropic.ts`
- Pass testCount to prompt builder
- Set `hasStructuredOutput: false` in jsonInstructions call
- Ensure detailed field-specific instructions are included
- No schema parameter in API call

### [ ] 7.2 Update `server/services/gemini.ts`
- Pass testCount to prompt builder
- Set `hasStructuredOutput: false` in jsonInstructions call
- Ensure detailed field-specific instructions are included
- No schema parameter in API call

### [ ] 7.3 Update `server/services/deepseek.ts`
- Pass testCount to prompt builder
- Check if model supports structured output via config
- If yes: use schema approach
- If no: use prompt-based approach with detailed instructions

---

## Phase 8: OpenRouter Special Handling

### [ ] 8.1 Update `server/services/openrouter.ts` - model capability detection
- OpenRouter routes to different providers with different capabilities
- Add helper: `getOpenRouterModelCapabilities(modelKey)` 
- Check model config for `supportsStructuredOutput`
- Return capability object: `{supportsStructured, provider}`

### [ ] 8.2 Update `server/services/openrouter.ts` - payload construction
- Calculate `const testCount = task.test.length`
- Check capabilities: `const caps = getOpenRouterModelCapabilities(modelKey)`
- If `caps.supportsStructured`: use `{type: "json_object"}` (OpenRouter format, not full schema)
- If not: include detailed prompt instructions

### [ ] 8.3 Update `server/services/openrouter.ts` - prompt building
- Pass testCount and capability info to prompt builder
- Structured models: minimal instructions
- Non-structured models: detailed field-specific instructions with exact test count

### [ ] 8.4 Update `server/services/openrouter.ts` - continuation support
- Ensure continuation requests maintain same schema/instruction approach
- Test count doesn't change during continuation
- Verify accumulated response validation works correctly

---

## Phase 9: Validator Integration

### [ ] 9.1 Review `server/services/responseValidator.ts`
- Confirm `extractPredictions()` handles new dynamic schemas
- Verify it works with numbered fields (predictedOutput1, predictedOutput2, etc.)
- Check backward compatibility with old response formats
- No changes needed if already flexible

### [ ] 9.2 Review `server/services/streamingValidator.ts`
- Confirm it calls `validateSolverResponse()` and `validateSolverResponseMulti()` correctly
- Verify compatibility with new schema approach
- Check that validation works for both single and multi-test
- No changes needed if validator is provider-agnostic

### [ ] 9.3 Update validation if needed
- Only if validators assume specific field names
- Ensure they work with dynamic field counts
- Test with 1, 2, 3 test cases

---

## Phase 10: Schema File Consolidation

### [ ] 10.1 Update `server/services/schemas/solver.ts`
- Keep validation functions: `validateSolverResponse()`, `extractPredictions()`, `validateGrid()`
- Remove hardcoded schema constants: `SINGLE_SOLVER_SCHEMA`, `MULTI_SOLVER_SCHEMA`
- Remove `getSolverSchema()` function (replaced by dynamic core schema)
- Keep utility functions that validators need

### [ ] 10.2 Archive `server/services/schemas/common.ts`
- Move property definitions into `core.ts`
- Add comment: "Merged into core.ts - archived"
- Do not delete yet (ensure no imports break)

### [ ] 10.3 Archive `server/services/schemas/explanation.ts`
- Already marked OLD and rarely used
- Add comment: "Archived - functionality moved to core.ts"
- Do not delete yet (check for imports first)

### [ ] 10.4 Handle `server/services/schemas/gepaSchema.ts`
- Determine if GEPA mode is still used
- If yes: refactor to use core schema with field name variants
- If no: archive with explanation
- Check codebase for GEPA references

---

## Phase 11: Import Updates Across Codebase

### [ ] 11.1 Search and replace `ARC_JSON_SCHEMA` imports
- Find all files importing from `schemas/arcJsonSchema`
- Update to import `getOpenAISchema` from `schemas/providers/openai`
- Update usage from constant to function call with testCount

### [ ] 11.2 Search and replace `GROK_JSON_SCHEMA` imports
- Find all files importing from `schemas/grokJsonSchema`
- Update to import `getGrokSchema` from `schemas/providers/grok`
- Update usage from constant to function call with testCount

### [ ] 11.3 Update any remaining schema imports
- Check for imports from `solver.ts`, `common.ts`, `explanation.ts`
- Update to import from `core.ts` or specific provider files
- Ensure no broken imports remain

---

## Phase 12: Verification

### [ ] 12.1 Test single-test puzzle with OpenAI
- Verify schema has only `predictedOutput` in required
- Verify response validation works
- Check database fields are populated correctly

### [ ] 12.2 Test multi-test puzzle (2 tests) with OpenAI
- Verify schema has `predictedOutput1`, `predictedOutput2` in required
- Verify no `predictedOutput3` in schema
- Verify response validation works
- Check database fields are populated correctly

### [ ] 12.3 Test multi-test puzzle (3 tests) with Grok
- Verify schema has all 3 prediction fields
- Verify response validation works
- Check database fields are populated correctly

### [ ] 12.4 Test single-test puzzle with Anthropic
- Verify prompt has field-specific instructions
- Verify no schema sent to API
- Verify response validation works

### [ ] 12.5 Test multi-test puzzle with Gemini
- Verify prompt lists exact fields needed
- Verify no schema sent to API
- Verify response validation works

### [ ] 12.6 Test OpenRouter with structured model
- Verify `json_object` response format used
- Verify prompt has appropriate instructions
- Verify continuation works if response truncated

### [ ] 12.7 Test OpenRouter with non-structured model
- Verify detailed prompt instructions included
- Verify response parsing works
- Verify continuation works if response truncated

### [ ] 12.8 Test continuation/chaining with OpenAI
- Verify previousResponseId flow maintains schema consistency
- Verify validation works on continuation responses
- Check that accumulated responses validate correctly

### [ ] 12.9 Test streaming with Grok
- Verify streaming events parse correctly
- Verify final response uses correct schema
- Verify streamingValidator works with new schema

---

## Critical Success Criteria

- **DRY**: Only ONE place defines prediction field logic (core.ts)
- **SRP**: Core builds schemas, providers wrap them, services consume them
- **Intelligence**: Schema adapts to known test count automatically
- **Provider-Aware**: Structured vs prompt-based handled correctly for each provider
- **Continuation-Safe**: Validation and schema consistent across conversation turns
- **No Empty Fields**: Models never forced to output empty predictedOutput1/2/3 for single-test
- **Backward Compatible**: Existing validators and database schema unchanged
- **OpenRouter Robust**: Handles heterogeneous provider capabilities correctly

---

## Files Changed Summary

**Created:**
- `server/services/schemas/core.ts`
- `server/services/schemas/providers/openai.ts`
- `server/services/schemas/providers/grok.ts`

**Modified:**
- `server/services/schemas/arcJsonSchema.ts` (thin wrapper)
- `server/services/schemas/grokJsonSchema.ts` (thin wrapper)
- `server/services/schemas/solver.ts` (remove schema defs, keep validation)
- `server/services/prompts/components/jsonInstructions.ts` (add test count awareness)
- `server/services/prompts/components/promptBuilder.ts` (pass test count)
- `server/services/base/BaseAIService.ts` (add schema getter)
- `server/services/openai.ts` (use dynamic schema)
- `server/services/grok.ts` (use dynamic schema)
- `server/services/anthropic.ts` (prompt-based with test count)
- `server/services/gemini.ts` (prompt-based with test count)
- `server/services/deepseek.ts` (check capability, adapt)
- `server/services/openrouter.ts` (capability detection, dynamic approach)

**Archived (commented, not deleted):**
- `server/services/schemas/common.ts`
- `server/services/schemas/explanation.ts`
- `server/services/schemas/gepaSchema.ts` (if unused)

**Unchanged (validators already flexible):**
- `server/services/responseValidator.ts`
- `server/services/streamingValidator.ts`

---

## Execution Notes

Work sequentially. Complete each phase before moving to the next. Test after Phase 5, 6, 7, and 8. Do not skip verification steps. OpenRouter requires extra attention due to heterogeneous provider routing.
