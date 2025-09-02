# Comprehensive Reasoning Debug Research Plan - September 2, 2025

**Status:** In Progress  
**Priority:** Critical - Frontend not displaying reasoning for recent database entries

## 🚨 Problem Statement

**Working**: Database entries 608, 600 display "AI Reasoning" perfectly in frontend  
**Broken**: Recent entries 6607, 6606 show no reasoning in frontend  
**Impact**: Users cannot see structured reasoning steps for recent AI analysis

## 📋 Research Phases

### Phase 1: Frontend Analysis (Most Critical) ⏳
**Goal**: Understand exactly how the frontend displays "AI Reasoning"

**Tasks**:
1. **Locate Frontend Reasoning Display Code**
   - Find the "AI Reasoning" component/section
   - Identify which database field(s) it reads from
   - Understand the display logic and data transformations

2. **Check Data Field Dependencies**
   - Does it read from `reasoning_items`? 
   - Does it read from `reasoning_log`?
   - Does it read from `provider_raw_response`?
   - Does it have fallback logic between multiple fields?

**Files to Examine**:
- `AnalysisResultContent.tsx` (likely main reasoning display)
- `AnalysisResultCard.tsx` (reasoning card component)
- Frontend API hooks and data fetching logic

### Phase 2: Database Data Comparison ⏸️
**Goal**: Compare working vs broken entries to find the actual difference

**Tasks**:
1. **Examine Working Entries (608, 600)**
   - Query database to see exact field values
   - Which fields contain reasoning data?
   - What's the structure and format?

2. **Examine Broken Entries (6607, 6606)**  
   - Query same fields for recent entries
   - What's missing or different?
   - Are the fields null, empty, or malformed?

3. **Timeline Analysis**
   - When were 608/600 created vs 6607/6606?
   - What code changes happened between those dates?
   - Which commits might have affected reasoning storage?

### Phase 3: Complete Data Flow Trace ⏸️
**Goal**: Trace reasoning data from AI API response to frontend display

**Tasks**:
1. **API Response Analysis**
   - Verify AI providers are returning reasoning correctly
   - Check console logs for extraction success

2. **Service Layer Flow**
   - Trace through OpenAI/Anthropic/Gemini services
   - Verify BaseAIService handling
   - Check ExplanationService processing

3. **Database Storage Verification**
   - Confirm which fields are actually being populated
   - Check INSERT statement execution
   - Verify data types and JSON formatting

4. **Frontend Retrieval Chain**
   - API endpoint that serves reasoning data
   - Frontend API calls and data processing
   - Component rendering and display logic

### Phase 4: Root Cause Identification ⏸️
**Goal**: Find the exact point where reasoning data is lost

**Tasks**:
1. **Identify the Break Point**
   - At what stage does reasoning data disappear?
   - API extraction? Service processing? Database storage? Frontend retrieval?

2. **Compare Working vs Broken Code**
   - What changed between August 21st (working) and recent entries?
   - Focus on the specific code path that actually matters for frontend display

### Phase 5: Targeted Fix Strategy ⏸️
**Goal**: Fix the actual problem, not assumed problems

**Tasks**:
1. **Address Root Cause**
   - Fix the specific field/logic that frontend actually uses
   - Don't fix unrelated reasoning extraction if it's not the issue

2. **Verify Fix Path**
   - Ensure fix addresses the exact frontend display issue
   - Test with both old and new database entries

## 🤔 Why This Research-First Approach is Critical

### Previous Error Analysis:
**Assumption Made**: Frontend reads from `reasoning_items` field  
**Fix Applied**: Added `reasoning_items` to database INSERT statement  
**Problem**: Never verified which field frontend actually uses

### Evidence of Different Issue:
**Working Entries**: 608, 600 show reasoning perfectly  
**Broken Entries**: 6607, 6606 show no reasoning  
**Implication**: Regression in whatever field/mechanism frontend actually uses

### Key Questions Unanswered:
1. **Frontend Field**: Which database field does "AI Reasoning" section read from?
2. **Data Difference**: What's actually different between working vs broken entries?
3. **Regression Point**: When did the working behavior break?

## 📊 Expected Outcomes

### Immediate Research Results:
1. **Exact Frontend Logic**: Know precisely how reasoning is displayed
2. **Actual Data Issue**: Understand what changed between working/broken entries
3. **Root Cause**: Identify the specific regression point

### Targeted Fix Strategy:
1. **Field-Specific**: Fix the exact field that frontend reads
2. **Regression-Focused**: Address the specific code change that broke functionality
3. **Verified Solution**: Ensure fix restores working behavior for recent entries

## 🔍 Success Criteria

**Research Complete When**:
- [ ] Frontend reasoning display logic fully understood
- [ ] Database field dependencies identified  
- [ ] Working vs broken entries compared
- [ ] Exact regression point found
- [ ] Root cause confirmed

**Fix Successful When**:
- [ ] Recent entries (6607, 6606) show reasoning like older entries (608, 600)
- [ ] All AI providers display structured reasoning in frontend
- [ ] "AI Reasoning" section populated for new analysis requests

## 📝 Notes

**Critical Insight**: Don't assume system architecture - verify each component's actual behavior before implementing fixes.

**User Feedback**: "did you consider what the frontend is doing???" - Correct assessment that backend fixes don't matter if frontend reads different fields.

**Research Priority**: Frontend analysis is most critical since all other fixes are worthless if they don't address what frontend actually displays.