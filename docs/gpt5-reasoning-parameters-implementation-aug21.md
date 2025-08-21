# GPT-5 Reasoning Parameters Implementation Plan

**Date**: August 21, 2025  
**Author**: Claude  
**Task**: Add reasoning parameter controls for GPT-5 models in PuzzleExaminer UI

## Overview

This document outlines the implementation plan for adding reasoning parameter controls (effort, verbosity, summary) to the PuzzleExaminer interface. These controls will only be visible when a GPT-5 reasoning model is selected.

## Current Architecture Analysis

### Frontend Flow
```
PuzzleExaminer.tsx → useAnalysisResults.ts → analyzeWithModel() → API /api/puzzle/analyze/${taskId}/${modelKey}
```

### Backend Flow  
```
puzzleController.analyze → aiServiceFactory.getService() → openaiService.analyzePuzzleWithModel()
```

### Current Temperature Implementation
- Frontend: `useAnalysisResults` hook manages temperature state
- UI: Slider control in PuzzleExaminer (lines 383-404)
- Backend: Temperature passed via request body to controller, then to AI service
- OpenAI: Temperature only supported for GPT-5 Chat models, not reasoning models

### Current Reasoning Parameters (Hardcoded)
- **Location**: `server/services/openai.ts` lines 94-108
- **Current values**: effort: 'medium', verbosity: 'medium', summary: 'auto'
- **GPT-5 Models**: "gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"

## Parameter Specifications

### Effort Levels
- `minimal` - Basic reasoning
- `low` - Light reasoning  
- `medium` - Moderate reasoning (current default)
- `high` - Intensive reasoning

### Verbosity Levels
- `low` - Concise reasoning logs
- `medium` - Balanced detail (current default)
- `high` - Detailed reasoning logs

### Summary Options
- `auto` - Automatic summary generation (current default)
- `detailed` - Comprehensive summary

## Implementation Plan

### Phase 1: Backend Updates

#### 1.1 Update OpenAI Service Interface
**File**: `server/services/openai.ts`

- Add reasoning parameters to `analyzePuzzleWithModel` method signature
- Update `serviceOpts` interface to include reasoning parameters
- Modify reasoning config building logic to use provided parameters instead of hardcoded values
- Ensure proper parameter validation

#### 1.2 Update Puzzle Controller  
**File**: `server/controllers/puzzleController.ts`

- Extract reasoning parameters from request body in `analyze` method
- Pass reasoning parameters to AI service calls
- Update request body destructuring to include new parameters
- Add parameter validation

#### 1.3 Update Type Definitions
**File**: `shared/types.ts` (if needed)

- Add reasoning parameter types for consistency across frontend/backend

### Phase 2: Frontend State Management

#### 2.1 Update useAnalysisResults Hook
**File**: `client/src/hooks/useAnalysisResults.ts`

- Add state management for reasoning parameters (effort, verbosity, summary)
- Include reasoning parameters in API request payload
- Add getters/setters for reasoning parameter state
- Set appropriate default values

#### 2.2 Update Model Constants  
**File**: `client/src/constants/models.ts` (verify location)

- Ensure GPT-5 reasoning models are properly flagged for conditional UI rendering

### Phase 3: Frontend UI Components

#### 3.1 Add Reasoning Parameter Controls
**File**: `client/src/pages/PuzzleExaminer.tsx`

Create reasoning parameters control section:
- **Location**: After temperature control (around line 404)
- **Conditional rendering**: Only show when GPT-5 reasoning model selected  
- **Components needed**:
  - Effort level selector (dropdown/radio)
  - Verbosity level selector (dropdown/radio)  
  - Summary option selector (dropdown/radio)
- **Styling**: Match existing temperature control styling

#### 3.2 Conditional Rendering Logic
**Implementation approach**:
```tsx
const isGPT5ReasoningModel = (modelKey: string) => {
  return ["gpt-5-2025-08-07", "gpt-5-mini-2025-08-07", "gpt-5-nano-2025-08-07"].includes(modelKey);
};

// Show reasoning controls only when GPT-5 model is being analyzed or selected
const showReasoningControls = currentModelKey && isGPT5ReasoningModel(currentModelKey);
```

#### 3.3 UI Component Structure
```tsx
{showReasoningControls && (
  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <h5 className="text-sm font-semibold text-blue-800 mb-3">GPT-5 Reasoning Parameters</h5>
    
    {/* Effort Control */}
    <div className="grid grid-cols-3 gap-4">
      <div>
        <Label>Effort Level</Label>
        <Select value={effort} onValueChange={setEffort}>
          <SelectItem value="minimal">Minimal</SelectItem>
          <SelectItem value="low">Low</SelectItem>  
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </Select>
      </div>
      
      {/* Verbosity Control */}
      <div>
        <Label>Verbosity</Label>
        <Select value={verbosity} onValueChange={setVerbosity}>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </Select>
      </div>
      
      {/* Summary Control */}
      <div>
        <Label>Summary</Label>
        <Select value={summary} onValueChange={setSummary}>
          <SelectItem value="auto">Auto</SelectItem>
          <SelectItem value="detailed">Detailed</SelectItem>
        </Select>
      </div>
    </div>
  </div>
)}
```

### Phase 4: Integration Points

#### 4.1 Parameter Flow Verification
1. **Frontend state** → useAnalysisResults hook
2. **Hook state** → API request body  
3. **Controller** → extract from request body
4. **AI Service** → use in reasoning config
5. **OpenAI API** → send to Responses API

#### 4.2 Model Detection Logic
- Implement consistent model detection across frontend/backend
- Ensure GPT-5 reasoning models are properly identified
- Handle edge cases (model not found, unsupported models)

### Phase 5: Testing & Validation

#### 5.1 Unit Testing Areas
- Parameter validation in controller
- State management in useAnalysisResults hook
- Conditional rendering logic in PuzzleExaminer
- OpenAI service reasoning config building

#### 5.2 Integration Testing  
- End-to-end parameter flow from UI to API
- Multiple reasoning models with different parameters
- Fallback behavior for non-reasoning models
- Error handling for invalid parameters

#### 5.3 UI/UX Testing
- Conditional rendering shows/hides appropriately
- Parameter controls are accessible and functional  
- Default values are applied correctly
- Visual consistency with existing controls

## Technical Considerations

### Backward Compatibility
- Existing temperature controls must continue working
- Non-GPT-5 models should not be affected
- Default reasoning parameters should match current hardcoded values

### Error Handling
- Invalid parameter values should use defaults
- Missing parameters should not break analysis
- Clear error messages for validation failures

### Performance
- Minimal impact on existing analysis workflows
- Efficient conditional rendering on frontend
- No unnecessary API calls or re-renders

### Security
- Parameter validation on backend  
- Sanitize user inputs
- Prevent parameter injection attacks

## Dependencies

### Existing Components to Reuse
- `Select`, `SelectContent`, `SelectItem` from shadcn/ui
- `Label` component for form labels
- `Card` layout structure for consistent styling

### New Dependencies
- None required - using existing UI library components

## Deployment Considerations

### Environment Variables
- No new environment variables required
- Existing OpenAI API key continues to work

### Database Changes
- No database schema changes required
- Reasoning parameters stored in existing reasoning log fields

### API Versioning
- Backward compatible API changes
- New optional parameters in existing endpoints

## Success Criteria

1. **Functional Requirements**
   - ✅ Reasoning parameters only visible for GPT-5 models
   - ✅ Parameter values correctly passed to OpenAI API
   - ✅ Default values match current hardcoded behavior
   - ✅ Analysis results show reasoning logs with specified parameters

2. **Technical Requirements**  
   - ✅ No breaking changes to existing functionality
   - ✅ Type safety maintained across frontend/backend
   - ✅ Proper error handling and validation
   - ✅ Performance impact minimal

3. **User Experience**
   - ✅ Intuitive parameter controls
   - ✅ Consistent visual design
   - ✅ Clear parameter descriptions/labels
   - ✅ Responsive design on all screen sizes

## Risk Mitigation

### Primary Risks
1. **Breaking existing temperature controls** - Mitigation: Thorough testing of existing flows
2. **API parameter conflicts** - Mitigation: Careful parameter naming and validation  
3. **UI/UX inconsistency** - Mitigation: Follow existing design patterns strictly
4. **Performance degradation** - Mitigation: Efficient conditional rendering and state management

### Rollback Plan
- Feature can be disabled via conditional rendering flag
- Backend changes are additive and backward compatible
- Database unchanged, so no data migration concerns

## Timeline Estimate

- **Phase 1** (Backend): ~2-3 hours
- **Phase 2** (State Management): ~1-2 hours  
- **Phase 3** (UI Components): ~2-3 hours
- **Phase 4** (Integration): ~1 hour
- **Phase 5** (Testing): ~1-2 hours

**Total Estimate**: 7-11 hours

## Implementation Notes

1. Start with backend changes to establish parameter flow
2. Add frontend state management next for clean separation
3. Build UI components incrementally with frequent testing
4. Test each phase before moving to the next
5. Use existing temperature control as reference implementation
6. Follow established code patterns and conventions throughout

---

**Next Steps**: Begin Phase 1 implementation with OpenAI service updates.