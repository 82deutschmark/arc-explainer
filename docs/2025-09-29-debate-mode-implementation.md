# Debate Mode with Custom Challenge Implementation

**Date:** September 29, 2025  
**Author:** Cascade using GPT-4.1  
**Status:** Complete - Ready for Testing

## Overview

This implementation adds full support for "Debate Mode" where users can:
1. Select an existing AI explanation to challenge
2. Choose a challenger AI model
3. Optionally provide a custom challenge prompt to guide the challenger's focus
4. Generate challenge responses that critique and improve the original explanation
5. Preview the exact debate prompt before sending to AI

## Architecture

### End-to-End Data Flow

```
User Input (Frontend)
  ↓
useAnalysisResults Hook (Frontend)
  ↓
/api/puzzle/analyze/:taskId/:model (Backend Controller)
  ↓
puzzleAnalysisService.analyzePuzzle() (Backend Service)
  ↓
promptBuilder.buildAnalysisPrompt() (Prompt Builder)
  ↓
  ├─ systemPrompts.getSystemPrompt('debate') → DEBATE SYSTEM PROMPT
  └─ userTemplates.buildDebateUserPrompt() → PUZZLE DATA + ORIGINAL EXPLANATION + CUSTOM CHALLENGE
  ↓
AI Service (OpenAI/Anthropic/etc.)
  ↓
Response Validation & Database Save
  ↓
Frontend Display in Debate UI
```

## Files Modified

### Frontend Changes (4 files)

1. **`client/src/components/PromptPreviewModal.tsx`**
   - Added `originalExplanation?: any` to `PromptOptions` interface (line 22)
   - Added `customChallenge?: string` to `PromptOptions` interface (line 23)
   - Forward both fields to backend API in prompt preview request (lines 81-82)
   - Updated useEffect dependencies to include new fields (line 106)

2. **`client/src/hooks/useAnalysisResults.ts`**
   - Added `originalExplanation?: any` to `UseAnalysisResultsProps` (line 34)
   - Added `customChallenge?: string` to `UseAnalysisResultsProps` (line 35)
   - Forward both fields in analysis request body (lines 100-101)
   - Enables debate context to flow through analysis pipeline

3. **`client/src/pages/ModelDebate.tsx`**
   - Pass `originalExplanation` and `customChallenge` to `useAnalysisResults` (lines 72-73)
   - Set promptId to 'debate' when debate mode is active (lines 77-83)
   - Build challenge payload with all necessary parameters (lines 96-107)
   - Use `mutateAsync` to capture response and add to debate messages (lines 110-133)
   - Proper error handling with toast notifications

4. **`client/src/components/puzzle/debate/IndividualDebate.tsx`**
   - Added prompt preview button with Eye icon (lines 220-229)
   - Pass `originalExplanation` and `customChallenge` to PromptPreviewModal (lines 300-313)
   - Integrated with debate controls sidebar
   - Full debate UI with message display and challenge controls

### Backend Changes (7 files)

1. **`server/controllers/promptController.ts`**
   - Added `originalExplanation` and `customChallenge` to request body destructuring (line 42)
   - Forward both fields to `buildAnalysisPrompt()` in preview endpoint (lines 61-62)

2. **`server/controllers/puzzleController.ts`**
   - Added `originalExplanation` to analysis options (line 76)
   - Added `customChallenge` to analysis options (line 77)
   - Forward both fields to `puzzleAnalysisService.analyzePuzzle()`

3. **`server/services/puzzleAnalysisService.ts`**
   - Added `originalExplanation?: any` to `AnalysisOptions` interface (line 32)
   - Added `customChallenge?: string` to `AnalysisOptions` interface (line 33)
   - Destructure both fields in `analyzePuzzle()` method (lines 64-65)
   - Forward to `promptOptions` object (lines 89-90)

4. **`server/services/promptBuilder.ts`**
   - Added `originalExplanation?: any` to `PromptOptions` interface (line 43)
   - Added `customChallenge?: string` to `PromptOptions` interface (line 44)
   - Destructure both fields in `buildAnalysisPrompt()` (lines 78-79)
   - Pass to `buildUserPromptForTemplate()` (line 196)

5. **`server/services/prompts/userTemplates.ts`**
   - Created `buildDebateUserPrompt()` function (lines 175-207)
   - Accepts `originalExplanation` and `customChallenge` parameters
   - Formats original explanation with model name, pattern, strategy, hints, confidence
   - Indicates if original was incorrect with ❌ marker
   - Adds custom challenge with 🎯 marker if provided
   - Updated `buildUserPromptForTemplate()` to handle debate mode (lines 247-250)

6. **`server/services/prompts/systemPrompts.ts`**
   - Added `debate` entry to `SYSTEM_PROMPT_MAP` (line 51)
   - Maps to debate system prompt from basePrompts

7. **`server/services/prompts/components/basePrompts.ts`**
   - Added `debate` task description (lines 96-97)
   - Added `debate` additional instructions (lines 155-174)
   - Comprehensive instructions for critique, analysis, and solution

### Shared Types (1 file)

1. **`shared/types.ts`**
   - **CRITICAL FIX:** Added missing `debate` template to `PROMPT_TEMPLATES` (lines 503-509)
   - Defines debate mode metadata for UI display
   - Includes emoji ⚔️, name, and description

## Key Features

### 1. Original Explanation Context
The challenger AI receives full context about the original explanation:
- Model name
- Pattern description
- Solving strategy
- Hints provided
- Confidence level
- Whether prediction was correct or incorrect

### 2. Custom Challenge Guidance
Users can optionally guide the challenger with specific focus areas:
- "Focus on edge cases"
- "Explain the color transformation logic"
- "Consider rotational symmetry"
- Any other custom guidance

### 3. Prompt Preview
Users can preview the exact prompt before generating:
- Shows full system prompt with debate instructions
- Shows user prompt with puzzle data + original explanation + custom challenge
- Character counts for both prompts
- Copy-to-clipboard functionality

### 4. Complete Integration
- Reuses existing `useAnalysisResults` hook
- Reuses existing `PromptPreviewModal` component
- Follows existing prompt architecture
- Maintains SRP and DRY principles

## Testing Checklist

### Manual Testing Steps

1. **Basic Debate Flow**
   - [ ] Navigate to `/debate/:puzzleId` with existing explanations
   - [ ] Select an explanation to debate
   - [ ] Choose a challenger model
   - [ ] Generate challenge without custom focus
   - [ ] Verify challenge response appears in debate messages

2. **Custom Challenge**
   - [ ] Enter custom challenge text (e.g., "Focus on symmetry")
   - [ ] Preview the prompt to see challenge included
   - [ ] Generate challenge
   - [ ] Verify custom challenge appears in AI response

3. **Prompt Preview**
   - [ ] Click "Preview Challenge Prompt" button
   - [ ] Verify modal shows system and user prompts
   - [ ] Verify original explanation appears in user prompt
   - [ ] Verify custom challenge appears if provided
   - [ ] Test copy-to-clipboard functionality

4. **Error Handling**
   - [ ] Test with invalid model
   - [ ] Test without selecting model
   - [ ] Test network errors
   - [ ] Verify error messages display properly

5. **Edge Cases**
   - [ ] Test with incorrect original explanation
   - [ ] Test with correct original explanation
   - [ ] Test with multi-test puzzles
   - [ ] Test with single-test puzzles
   - [ ] Test rapid successive challenges

## Known Considerations

### 1. Prompt Template Registration
✅ **RESOLVED:** Added `debate` template to `PROMPT_TEMPLATES` in `shared/types.ts`

### 2. Backend Prompt Generation
✅ **VERIFIED:** All prompt generation paths support debate mode:
- `buildDebateUserPrompt()` in `userTemplates.ts`
- `TASK_DESCRIPTIONS.debate` in `basePrompts.ts`
- `ADDITIONAL_INSTRUCTIONS.debate` in `basePrompts.ts`
- System prompt mapping in `systemPrompts.ts`

### 3. Frontend Integration
✅ **VERIFIED:** Complete data flow from UI to backend:
- ModelDebate page orchestrates flow
- useAnalysisResults forwards parameters
- IndividualDebate displays results
- PromptPreviewModal supports preview

### 4. API Compatibility
✅ **VERIFIED:** No breaking changes to existing APIs:
- New fields are optional
- Backward compatible with existing code
- Only used when promptId === 'debate'

## Assumptions for User

### Things I Did NOT Implement (Assumptions)

1. **Debate Prompt Template Emoji Display**
   - The `debate` template was added with ⚔️ emoji
   - Should appear in prompt picker if exposed to users
   - Currently only used internally by ModelDebate page

2. **Debate Mode Routing**
   - Assumes `/debate/:puzzleId` route already exists
   - Assumes navigation to debate page is already implemented

3. **Database Schema**
   - Assumes explanations table can store debate-generated responses
   - No special flags or metadata for debate mode results
   - Debate responses are treated as regular explanations

4. **Model Availability**
   - Assumes all models can participate in debates
   - No special model filtering for challenger selection
   - Users can select any available model

5. **Debate Session Persistence**
   - Debate messages stored in frontend state only
   - Not persisted to database
   - Reloading page will reset debate session

6. **Multi-Test Puzzle Debate**
   - Assumes debate mode works with both single and multi-test puzzles
   - No special handling for multi-test correctness display
   - Uses existing correctness logic from original explanation

## Code Quality

### SRP/DRY Check: ✅ PASS

- **Single Responsibility:**
  - PromptPreviewModal: Display prompts
  - useAnalysisResults: Manage analysis state
  - puzzleAnalysisService: Orchestrate analysis
  - promptBuilder: Build prompts
  - Each component has one clear purpose

- **Don't Repeat Yourself:**
  - Reuses existing PromptPreviewModal (no duplication)
  - Reuses existing useAnalysisResults hook (no duplication)
  - Reuses existing prompt architecture (no duplication)
  - Extends existing patterns cleanly

### shadcn/ui: ✅ PASS

- Uses Button, Card, Badge, Alert from shadcn/ui
- Uses Select, Textarea from shadcn/ui
- Uses Dialog for PromptPreviewModal
- No custom UI components

## Git Commit Message

```
feat: Implement debate mode with custom challenge support

Add complete end-to-end support for AI-vs-AI debate mode where users can
challenge existing explanations with superior analysis from different models.

FRONTEND CHANGES:
- PromptPreviewModal: Added originalExplanation and customChallenge to options
- useAnalysisResults: Forward debate context through analysis pipeline
- ModelDebate: Orchestrate debate flow with challenge generation
- IndividualDebate: Display debate messages and challenge controls

BACKEND CHANGES:
- promptController: Accept and forward debate parameters in preview
- puzzleController: Accept and forward debate parameters in analysis
- puzzleAnalysisService: Add originalExplanation and customChallenge to options
- promptBuilder: Pass debate context to template builders
- userTemplates: Create buildDebateUserPrompt() with full context formatting
- systemPrompts: Add debate prompt mapping
- basePrompts: Define debate task description and instructions

SHARED TYPES:
- types.ts: Add debate template to PROMPT_TEMPLATES (CRITICAL FIX)

FEATURES:
- Challenge existing explanations with different AI models
- Optional custom challenge text to guide challenger focus
- Prompt preview shows full debate context
- Original explanation context (pattern, strategy, hints, confidence)
- Incorrect prediction flagging with ❌ marker
- Custom challenge guidance with 🎯 marker
- Full integration with existing analysis pipeline
- Reuses existing UI components (DRY principle)

ARCHITECTURE:
- Maintains SRP: Each component has single responsibility
- Follows DRY: Reuses existing PromptPreviewModal and useAnalysisResults
- Extends modular prompt architecture cleanly
- No breaking changes to existing APIs
- Backward compatible with all existing code

Ready for testing. See docs/2025-09-29-debate-mode-implementation.md for
complete documentation and testing checklist.
```

## Files Changed

- client/src/components/PromptPreviewModal.tsx
- client/src/hooks/useAnalysisResults.ts
- client/src/pages/ModelDebate.tsx
- client/src/components/puzzle/debate/IndividualDebate.tsx
- server/controllers/promptController.ts
- server/controllers/puzzleController.ts
- server/services/puzzleAnalysisService.ts
- server/services/promptBuilder.ts
- server/services/prompts/userTemplates.ts
- server/services/prompts/systemPrompts.ts
- server/services/prompts/components/basePrompts.ts
- shared/types.ts
