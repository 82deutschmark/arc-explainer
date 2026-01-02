# Council Result Persistence Architecture Plan

**Date:** 2026-01-02
**Status:** COMPLETE (Phases 2-4 implemented)
**Author:** Claude Haiku
**Goal:** Enable LLM Council results to be persisted to database and integrated with ELO/voting system

---

## Problem Statement

The LLM Council feature runs a sophisticated 3-stage deliberation process:
1. Stage 1: Multiple LLMs independently solve/assess the puzzle
2. Stage 2: Each model ranks the other solutions
3. Stage 3: A "chairman" LLM synthesizes all inputs into a final assessment

Currently, these results stream beautifully to the UI and then **disappear entirely**. Nothing is saved to the database. This means:
- No audit trail of what the council decided
- No way to query past council assessments
- Council results can't participate in the ELO voting system
- No persistence of the full 3-stage deliberation data
- Council predictions aren't scored against ground truth

---

## Design Decision: Save as Explanation

**Pattern:** Follow the Beetree ensemble solver approach

**Rationale:**
- Councils produce explanations (pattern descriptions, strategies, confidence)
- These should be voteable in the ELO comparison system
- Existing infrastructure handles scoring, feedback, metrics
- Natural integration point without creating parallel systems
- Reuses well-tested repository patterns

**Architecture:**
```
CouncilAssessmentResult (3-stage data)
         ↓
  transformCouncilResult()
         ↓
 ExplanationData (database-compatible)
         ↓
 ExplanationRepository.saveExplanation()
         ↓
 explanations table (with council columns)
```

---

## Core Data Flow

```
1. User selects puzzle + mode (solve/assess)
   ↓
2. User selects explanations to assess (if assess mode)
   ↓
3. Council runs 3 stages, streams events to UI
   ↓
4. After stage 3 completes:
   - Extract stage3 synthesis (chairman's response)
   - Parse for predicted output grid
   - Derive confidence from aggregate rankings
   - Transform to ExplanationData
   ↓
5. Save to explanations table:
   - Main explanation fields (pattern, strategy, confidence)
   - Council-specific metadata columns
   - Full 3-stage data for audit trail
   ↓
6. Score prediction against ground truth
   ↓
7. Results now queryable and voteable
```

---

## What Gets Stored Where

### Main Explanation Fields (`explanations` table)
```
puzzle_id              ← task_id
model_name             ← "llm-council"
pattern_description    ← stage3.response (chairman's synthesis)
solving_strategy       ← synthesized from stage1 consensus
confidence             ← derived from aggregate rankings
predicted_output_grid  ← extracted from stage3 (if present)
is_prediction_correct  ← scored against ground truth
created_at             ← auto (current timestamp)
```

### Council-Specific Metadata Columns (NEW)
```
council_mode                    ← 'solve' | 'assess'
council_stage1_results          ← JSONB array of all stage 1 responses
council_stage2_rankings         ← JSONB array of all stage 2 rankings
council_stage3_synthesis        ← JSONB full stage 3 object
council_metadata                ← JSONB { label_to_model, aggregate_rankings }
council_assessed_explanation_ids ← INTEGER[] links to assessed explanations
council_aggregate_rankings      ← JSONB parsed rankings
council_prompt_used             ← TEXT full prompt sent to council
```

### Why This Split?
- **Main fields**: Needed for ELO comparison, scoring, normal queries
- **Council fields**: Preserve full deliberation history, enable audit trails, support council-specific analytics

---

## Key Implementation Questions & Decisions

### Q1: How to Extract Predicted Output from Stage 3?

**Challenge:** Stage 3 is free-form text from chairman. Might contain a grid, might not.

**Solution Options:**
- A) Pattern matching + regex for grid-like structures
- B) JSON parsing if chairman follows structured format
- C) Heuristic parsing (look for numbers in grid-like patterns)
- D) Give up gracefully if not found

**Decision:** Multi-step approach
1. Try to extract if chairman explicitly provides grid
2. If found, store in `predicted_output_grid`
3. If not found, set to null
4. Set `is_prediction_correct` = null (no prediction to score)

**Implementation:** Create utility function `extractPredictedGridFromSynthesis(stage3Response): number[][] | null`

---

### Q2: How to Derive Confidence Score?

**Challenge:** Confidence needs numeric value (0-100). Stage 3 is narrative text.

**Options:**
- A) Parse confidence percentage mentions in stage3 text
- B) Use weighted average of model rankings (top-ranked = high confidence)
- C) Count consensus (if all 3 models agree = higher confidence)
- D) Default to 50 (neutral)

**Decision:** Weighted ranking approach
```
confidence = 100 - (average_rank_position * 20)
// If chairman is ranked 1st by all: 100 - (1 * 20) = 80
// If chairman is ranked 2nd by all: 100 - (2 * 20) = 60
// If chairman is ranked 3rd by all: 100 - (3 * 20) = 40
```

**Fallback:** If parsing fails, use 50 (neutral)

---

### Q3: How to Link Assessed Explanations?

**Challenge:** In 'assess' mode, council evaluates existing explanations. Need to track which ones.

**Solution:**
```
council_assessed_explanation_ids = [123, 456, 789]
```

**Benefits:**
- Audit trail: "Council assessed these specific explanations"
- Reverse query: "What did council say about explanation 123?"
- Future: Surface council feedback next to original explanation

**Implementation:**
- Accept `explanationIds` in controller
- Store directly in council column
- Include in council_metadata for display

---

### Q4: How to Ensure Reproducibility?

**Challenge:** Council runs with prompts, configurations, model selections. Need audit trail.

**Solution:** Store full prompt
```
council_prompt_used = "[full prompt text]"
```

**Benefits:**
- Can re-run exact same council deliberation
- Debug why council made certain decisions
- Track if prompt changed across runs

---

## Implementation Steps

### Phase 1: Database & Types (DONE)
- ✅ Add schema columns to DatabaseSchema.ts
- ✅ Add interface fields to IExplanationRepository.ts

### Phase 2: Repository Layer (COMPLETE)
- ✅ **ExplanationRepository.saveExplanation()** - Added council columns to INSERT query (8 new columns: council_mode, stage1/2/3, metadata, assessed_ids, aggregate_rankings, prompt_used)
- ✅ **All SELECT queries** - Updated getExplanationForPuzzle(), getExplanationsForPuzzle(), getExplanationById() to include council columns with camelCase aliases
- ✅ **mapRowToExplanation()** - Added JSONB parsing for council fields (stage1/2/3 results, metadata, aggregate rankings)

### Phase 3: Transformation & Saving (COMPLETE)
- ✅ **transformCouncilResult()** - Converts CouncilAssessmentResult → ExplanationData with full 3-stage data and metadata
- ✅ **extractPredictedGridFromSynthesis()** - Regex pattern matching to extract output grids from stage3 text
- ✅ **deriveConfidenceFromRankings()** - Calculates 0-100 confidence using formula: 100 - (avg_rank * 20)
- ✅ **Update councilService.assessPuzzle()** - Auto-saves results via saveCouncilResult() after completion

### Phase 4: Scoring (COMPLETE)
- ✅ **Integrated prediction scorer** - Uses existing JSON.stringify() grid comparison logic
- ✅ **Set is_prediction_correct** - Scores against first test output if prediction extracted

### Phase 5: Frontend Integration
10. **Update LLMCouncil component** - Show "Saved to database" confirmation
11. **Link to explanation** - Show council result in puzzle's explanation list

### Phase 6: Validation & Testing
12. **Test end-to-end** - Create council assessment, verify persistence
13. **Test querying** - Verify council results appear in explanations
14. **Test voting** - Verify council results participate in ELO
15. **Test edge cases** - Assess mode, no prediction, etc.

---

## Critical Edge Cases to Handle

| Case | Handling |
|------|----------|
| **Assess mode without solving** | Council only evaluates existing explanations, no prediction to score. Set `predicted_output_grid = null`, `is_prediction_correct = null` |
| **Stage 3 contains no output grid** | Pattern matching returns null. That's OK, not all councils propose solutions. |
| **Confidence parsing fails** | Default to 50 (neutral confidence) |
| **Assessed explanation IDs empty** | In assess mode, this is validated by controller. Shouldn't reach here. |
| **Large JSONB blobs** | council_stage1/2/3 could be 100KB+. Monitor query performance. Consider storing separately if needed. |
| **Null stage3** | Shouldn't happen, but handle gracefully with error message. |
| **Prediction grid wrong dimensions** | Grid comparison will return false. That's correct. |

---

## Data Size Considerations

**Estimated sizes per council assessment:**
- stage1 (3-5 model responses): ~10-50 KB
- stage2 (3-5 rankings): ~2-10 KB
- stage3 (chairman synthesis): ~2-5 KB
- Total: ~15-65 KB per record

**Total storage (worst case):**
- 1000 council assessments = ~65 MB
- Acceptable for JSONB columns with indexes

---

## Success Criteria (Pass/Fail)

- [ ] Council result saves as explanation immediately after completion
- [ ] Can query `SELECT * FROM explanations WHERE council_mode IS NOT NULL`
- [ ] Council result appears in puzzle's explanation list
- [ ] Prediction is scored and `is_prediction_correct` is set correctly (if prediction extracted)
- [ ] Explanation can be voted on in ELO comparison system
- [ ] Assessed explanation IDs are preserved and queryable
- [ ] Full 3-stage data is retrievable for audit/analysis
- [ ] No TypeScript compilation errors
- [ ] Frontend shows "Assessment saved" confirmation

---

## Future Enhancements

Once persistence is working:

1. **Council Assessment Browser** - Page to browse all past council assessments
2. **Council Analytics** - Track council accuracy, compare against baseline models
3. **Council Vote Tracking** - How often is council solution voted best?
4. **Council History** - Timeline of council decisions on same puzzle
5. **Council Feedback** - Collect human feedback on council quality
6. **ELO Integration** - Council results enter ELO rating system
7. **Reproducibility** - Re-run past councils with same configurations

---

## Files to Modify

```
server/repositories/ExplanationRepository.ts
  - saveExplanation(): add council columns to INSERT
  - getExplanationForPuzzle(): include council columns in SELECT
  - All other SELECT queries: include council columns
  - mapRowToExplanation(): map council columns

server/services/council/councilService.ts
  - transformCouncilResult(): new function
  - extractPredictedGridFromSynthesis(): new function
  - deriveConfidenceFromRankings(): new function
  - assessPuzzle(): call save after completion

client/src/pages/LLMCouncil.tsx
  - Show "Saved to database" message after completion
  - Link to view explanation in list
```

---

## Questions for User

1. Should council results have special model name like "llm-council:solve" to distinguish modes?
2. Should we track council run time / execution duration?
3. Should we limit which users can vote on council results?
4. Do we want a separate "council results only" view/filter?
5. Should council results count toward solver stats/leaderboards?

---

## Related Documents

- `/docs/DEVELOPER_GUIDE.md` - Architecture overview
- `/docs/reference/architecture/` - System design
- `/server/repositories/` - Repository pattern examples
- `/server/controllers/beetreeController.ts` - Similar ensemble pattern (reference)
