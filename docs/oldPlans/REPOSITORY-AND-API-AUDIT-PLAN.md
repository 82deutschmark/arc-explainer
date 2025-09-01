# Repository Implementation & API Inconsistency Audit Plan
NEEDS REVIEW!!! Aug 30, 2025
## Critical Discovery: API Type Mismatch
**Issue**: OpenRouter log shows `"api_type": "completions"` (Chat Completions) but our code expects Responses API for reasoning capture.
**Evidence**: `"native_tokens_reasoning": 0` in OpenRouter log indicates no reasoning captured.

## Audit Scope

### 1. API Implementation Consistency Check
**Problem**: Mixed API usage across providers breaking reasoning capture

#### Files to Audit:
- `server/services/aiService.ts` - Check which providers use which API
- `server/services/promptBuilder.ts` - Verify prompt handling for both APIs
- `server/controllers/puzzleController.ts` - Check reasoning capture logic

#### Specific Checks:
- [ ] Verify only OpenAI models use Responses API (`/v1/responses`)
- [ ] Confirm all other providers use Chat Completions (`/v1/chat/completions`)
- [ ] Check reasoning extraction logic handles both API types
- [ ] Validate `output_reasoning` vs `choices[0].message.content` parsing
- [ ] Test token accounting differences (`max_output_tokens` vs `max_tokens`)

### 2. Repository Implementation Quality Audit
**Problem**: Sloppy refactoring from monolithic DbService to repository pattern

#### Files to Audit:
- `server/repositories/ExplanationRepository.ts`
- `server/repositories/FeedbackRepository.ts`  
- `server/repositories/interfaces/IExplanationRepository.ts`
- `server/repositories/interfaces/IFeedbackRepository.ts`

#### Specific Checks:
- [ ] Verify all interface methods are implemented (not stubs)
- [ ] Check SQL queries use correct existing database columns
- [ ] Validate field aliases match frontend expectations
- [ ] Test data flow: API → Repository → Frontend component
- [ ] Confirm import/export chains work correctly

### 3. Database Schema Consistency
**Problem**: Previous assumptions about non-existent columns

#### Current Schema (from dbService.ts):
```sql
SELECT 
  id, puzzle_id AS "puzzleId", pattern_description AS "patternDescription",
  solving_strategy AS "solvingStrategy", hints, confidence,
  alien_meaning_confidence AS "alienMeaningConfidence", 
  alien_meaning AS "alienMeaning", model_name AS "modelName",
  api_processing_time_ms AS "apiProcessingTimeMs",
  created_at AS "createdAt", updated_at AS "updatedAt",
  reasoning_log AS "reasoningLog", saturn_images AS "saturnImages",
  saturn_log AS "saturnLog", saturn_events AS "saturnEvents",
  saturn_success AS "saturnSuccess", is_prediction_correct AS "isPredictionCorrect"
```

#### Checks:
- [ ] Verify repository SQL matches this exact pattern
- [ ] No fake columns like `extraction_method`, `all_predictions_correct`
- [ ] All frontend-expected fields have corresponding database columns
- [ ] Column aliases properly convert snake_case to camelCase

### 4. Data Flow Integration Test
**Problem**: `AnalysisResultCard.tsx` not finding expected data

#### Test Path:
1. API endpoint receives request
2. Repository method called with correct parameters  
3. SQL query returns data with proper field names
4. Frontend component receives expected structure
5. All ~40+ fields in AnalysisResultCard are populated

#### Files Involved:
- `client/src/components/puzzle/AnalysisResultCard.tsx` (data consumer)
- `server/controllers/puzzleController.ts` (API layer)
- `server/repositories/ExplanationRepository.ts` (data access)
- `server/services/dbService.ts` (reference implementation)

## Priority Order
1. **API Consistency** - Fix reasoning capture for all providers
2. **Repository Implementation** - Ensure no stub methods remain
3. **Database Schema** - Verify all queries use existing columns
4. **Data Flow** - Test end-to-end functionality

## Success Criteria
- [ ] All providers properly capture reasoning (or explicitly document why not)
- [ ] Repository methods fully implemented with working SQL
- [ ] Frontend components receive all expected data fields
- [ ] No database errors from non-existent columns
- [ ] Import/export chains resolve correctly

## Expected Fixes
- Update aiService.ts to handle Chat Completions vs Responses API properly
- Ensure reasoning extraction works for both API response formats
- Complete any stub repository methods
- Fix any remaining SQL query issues
- Update field mapping if needed for frontend compatibility