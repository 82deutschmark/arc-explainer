# ARC Explainer ELO System - Revised Implementation Plan
**Date:** September 16, 2025  
**Status:** 🔄 **REVISION IN PROGRESS** - Refocusing on Core Mission  
**Author:** Cascade

## Core Mission Statement
**Primary Goal:** Demonstrate how AI explanations can sound impressively "smart" but be fundamentally wrong, helping users develop critical evaluation skills for AI-generated content.

**Key Insights:**
- Most explanations users will see should be **plausibly wrong** - confident but incorrect
- Good explanations will be rare, making them more valuable when found
- The comparison interface should facilitate deep evaluation, not quick judgments
- User feedback collection is crucial for understanding what makes explanations convincing vs. correct

## Current State Analysis (Post-Refactoring Crisis)

### What Went Wrong
1. **Incomplete Refactoring**: Started converting from `winnerId` to `outcome` enum but left half-completed
2. **Lost Focus**: Got caught in TypeScript compilation errors instead of user experience
3. **Technical Debt**: Multiple breaking changes introduced simultaneously without systematic completion

### What's Actually Working
- ✅ Database schema exists (outcome column added, winner_id nullable)
- ✅ Backend ELO calculation logic handles BOTH_BAD as 0.5 (both get 0 points)
- ✅ Frontend comparison UI shows explanations side-by-side
- ✅ Basic voting infrastructure exists

## Revised Implementation Strategy

### Phase 1: Fix The Foundation (URGENT)
**Goal:** Get the system working again before adding features

#### 1A: Complete the Outcome Refactoring
- [ ] Fix remaining `winnerId` references in frontend
- [ ] Complete TypeScript type conversions
- [ ] Update controller to use `outcome` parameter
- [ ] Test all three outcomes: A_WINS, B_WINS, BOTH_BAD

#### 1B: Fix AnalysisResultCard Issues
- [ ] Fix `multiTestPredictionGrids` property access (exists in types.ts)
- [ ] Enable comparison mode features we actually want:
  - [ ] **Enable user feedback collection** (`showFeedback={true}` in comparison mode)
  - [ ] **Show confidence scores** (helps users evaluate overconfident wrong answers)
  - [ ] Hide correctness indicators (we don't want to bias the user)

### Phase 2: Enhance The User Experience
**Goal:** Make the comparison interface serve our educational mission

#### 2A: Three-Button Voting Interface
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  A is Better    │  │ Both Are Bad    │  │  B is Better    │
│       👍        │  │       👎        │  │       👍        │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

#### 2B: Rich Feedback Collection
- After each vote, show a feedback form asking:
  - "What made you choose this option?"
  - "What specific issues did you notice in the rejected explanation(s)?"
  - "How confident are you in your evaluation? (1-5)"

#### 2C: Educational Context
- Add hints about what to look for:
  - "Does the explanation match the visual pattern you see?"
  - "Are the steps logical and consistent?"
  - "Does the confidence level match the quality?"

### Phase 3: Data Collection & Analysis
**Goal:** Build a dataset of human evaluation patterns

#### 3A: Enhanced Vote Storage
```sql
-- Add to comparison_votes table
ALTER TABLE comparison_votes ADD COLUMN user_feedback TEXT;
ALTER TABLE comparison_votes ADD COLUMN user_confidence INTEGER CHECK (user_confidence BETWEEN 1 AND 5);
ALTER TABLE comparison_votes ADD COLUMN evaluation_time_seconds INTEGER;
```

#### 3B: Pattern Analysis
- Track which "confident but wrong" explanations fool users most often
- Identify common failure patterns in AI explanations
- Measure correlation between AI confidence and human evaluation

## Technical Fixes Required

### Immediate Blockers
1. **AnalysisResultCard.tsx**: Fix `multiTestPredictionGrids` property (line 57, 59, 84)
   - Property exists in `ExplanationData` type as `any | null`
   - Component expects `number[][][]` format
   - Need proper type casting or null checking

2. **EloComparison.tsx**: Complete outcome integration
   - Fix remaining 'B' button to use 'B_WINS'
   - Add 'BOTH_BAD' button
   - Import ComparisonOutcome type

3. **Backend Type Errors**: Fix EloRepository compilation
   - BaseRepository import path
   - Missing query/transaction method signatures
   - Implicit any types in callbacks

### Comparison Mode Features We Want
```typescript
// In EloComparison.tsx
<AnalysisResultCard
  result={explanation}
  comparisonMode={true}        // Hide correctness indicators
  showFeedback={true}          // Enable feedback collection ⭐
  showConfidence={true}        // Show AI confidence score ⭐
  modelKey="hidden"           // Hide model name to prevent bias
/>
```

## Success Metrics

### Short Term (This Week)
- [ ] System compiles without TypeScript errors
- [ ] All three voting outcomes work (A_WINS, B_WINS, BOTH_BAD)
- [ ] User feedback forms appear after votes
- [ ] Confidence scores are visible during comparison

### Medium Term (Next Sprint)
- [ ] 100+ comparison votes collected with feedback
- [ ] Analysis of which explanations are most "convincingly wrong"
- [ ] Documentation of common evaluation patterns
- [ ] User feedback showing increased AI skepticism

### Long Term (Research Goals)
- [ ] Published dataset of human evaluation patterns
- [ ] Identified predictors of "convincing but wrong" AI content
- [ ] Educational materials for AI literacy training
- [ ] Integration with other AI evaluation tools

## Implementation Priority Queue

1. **🔥 CRITICAL**: Fix multiTestPredictionGrids errors (blocks rendering)
2. **🔥 CRITICAL**: Complete outcome enum refactoring (blocks voting)
3. **⚡ HIGH**: Add BOTH_BAD button to UI
4. **⚡ HIGH**: Enable feedback collection in comparison mode
5. **📊 MEDIUM**: Add confidence score display
6. **🔍 LOW**: Advanced analytics and pattern detection

## Key Learnings Applied

1. **Focus on Mission**: Every technical decision should serve the educational goal
2. **Complete Changes**: Don't leave refactoring half-done
3. **User Experience First**: Technical elegance matters less than user insight
4. **Data Collection**: Every interaction should teach us something about human/AI evaluation patterns

---

**Next Action**: Fix the multiTestPredictionGrids issue and complete the outcome refactoring so we can get back to serving our core mission.
