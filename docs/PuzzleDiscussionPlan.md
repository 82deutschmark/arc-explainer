# PuzzleDiscussion Page Implementation Plan
*Implementation Guide for Enhanced Puzzle Analysis & Retry System*

August 31, 2025

---

## Executive Summary

Create a focused discussion page showing puzzles with poor analysis results, enabling users to retry analysis with enhanced prompting and full context about previous failures.

## Core Objectives

1. **Problem Identification**: Surface puzzles needing better analysis (incorrect predictions, low confidence, negative feedback)
2. **Enhanced Retry System**: Leverage existing analysis infrastructure with retry-specific prompt enhancements
3. **Performance Tracking**: Show improvement metrics between original and retry attempts
4. **User Experience**: Simple, focused interface reusing existing components

---

## Technical Architecture

### Backend Integration
- **Prompt System**: Use `promptBuilder.buildAnalysisPrompt()` with `retryMode: true`
- **Database Query**: Sort by worst-performing puzzles using composite scoring
- **API Endpoints**: Reuse existing `/api/explain` with enhanced prompt options
- **Context Enhancement**: Include previous analysis data and negative feedback in system prompts

### Frontend Components
- **Base Structure**: Extend `PuzzleBrowser.tsx` with discussion-specific filtering
- **Analysis Display**: Reuse `AnalysisResultCard` with comparison features  
- **Model Selection**: Standard `ModelButton` component with retry indicators
- **Progress Tracking**: Show before/after analysis comparisons

---

## Implementation Details

### 1. Database Scoring Algorithm
Priority queue for worst-performing puzzles:

```sql
-- Composite scoring based on:
-- 1. Incorrect predictions (highest priority)
-- 2. Low accuracy scores  
-- 3. Negative feedback ratio
-- 4. Low confidence scores

SELECT DISTINCT puzzle_id, 
  COUNT(CASE WHEN is_prediction_correct = false THEN 1 END) as wrong_count,
  AVG(prediction_accuracy_score) as avg_accuracy,
  AVG(confidence) as avg_confidence,
  -- Negative feedback ratio from joined feedback table
  COUNT(f.id) FILTER (WHERE f.vote_type = 'not_helpful') as negative_feedback
FROM explanations e
LEFT JOIN feedback f ON e.id = f.explanation_id
GROUP BY puzzle_id
ORDER BY wrong_count DESC, avg_accuracy ASC, negative_feedback DESC
LIMIT 20;
```

### 2. Enhanced Prompting System
Leverage existing `PromptOptions.retryMode` functionality:

```typescript
const retryOptions: PromptOptions = {
  retryMode: true,
  previousAnalysis: originalExplanation, // Full DB record
  badFeedback: negativeFeedback,         // Array of feedback records
  systemPromptMode: 'ARC',              // Use structured prompts
  temperature: 0.7                       // Slightly higher for creativity
};
```

### 3. Page Structure & User Flow

#### Route Setup
- **Path**: `/discussion`
- **Navigation**: Add to main menu after "Browse Puzzles"

#### Core Components

**PuzzleDiscussion.tsx**
```typescript
- Extends PuzzleBrowser structure
- Custom query hook for worst-performing puzzles  
- Grouped display: All analyses for each puzzle_id in expandable cards
- Retry button with model selection dropdown
- Side-by-side comparison of original vs retry results
```

**Enhanced AnalysisResultCard.tsx**
```typescript
- Comparison mode for showing before/after
- Highlight improvements (accuracy, confidence, feedback)
- Performance metrics display
- "This is a retry analysis" indicator
```

### 4. User Workflow
1. **Navigate** to Discussion page (`/discussion`)
2. **Browse** worst-performing puzzles (auto-sorted)
3. **Expand** puzzle card to see all existing analyses
4. **Identify** failed analysis to retry
5. **Click** "Retry Analysis" → model selection modal
6. **Select** model → analysis runs with enhanced prompt context
7. **Compare** new results alongside original using split-view layout
8. **Provide feedback** on improved analysis

---

## Technical Implementation

### Frontend Tasks
- [ ] Copy `PuzzleBrowser.tsx` → `PuzzleDiscussion.tsx`
- [ ] Create custom query hook for worst-performing puzzles
- [ ] Add grouped display logic (multiple analyses per puzzle_id)
- [ ] Implement retry analysis flow with model selection
- [ ] Add comparison UI for before/after results
- [ ] Update main navigation to include Discussion link

### Backend Enhancements  
- [ ] Create database query for worst-performing puzzle scoring
- [ ] Verify `retryMode` functionality in `promptBuilder.ts` (already implemented)
- [ ] Test enhanced prompting with previous analysis context
- [ ] Ensure retry analyses are properly marked in database

### Component Modifications
- [ ] Extend `AnalysisResultCard` with comparison mode
- [ ] Add retry indicators to existing UI components
- [ ] Create side-by-side results display component

---

## Success Metrics

### User Experience
- Reduced time to identify problematic puzzles
- Improved analysis quality on retry attempts
- Clear visibility into analysis improvement

### Technical Performance  
- Reuse of existing infrastructure (no new endpoints)
- Efficient database queries for puzzle scoring
- Proper integration with established prompt system

### Quality Improvements
- Higher accuracy scores on retry analyses
- Reduced negative feedback on retry attempts  
- Better user satisfaction with enhanced prompting

---

## Testing Strategy

### Integration Testing
- Verify enhanced prompts include previous analysis context
- Test retry analysis flow end-to-end
- Validate puzzle scoring algorithm accuracy

### User Experience Testing
- Navigate from worst puzzle identification to successful retry
- Compare analysis quality improvements
- Verify all existing functionality remains intact

### Performance Testing  
- Database query performance for puzzle scoring
- Prompt building performance with enhanced context
- UI responsiveness with comparison displays

---