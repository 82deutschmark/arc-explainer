# ARC-AGI Puzzle Explainer - Custom Prompt Default & Provider-Specific Preview

## Overview
Implement two key features:
1. Set the default prompt selection to "Custom Prompt" in the UI
2. Add a provider-specific prompt preview feature to show exactly what will be sent to each AI model

## Requirements Analysis
- **Default Prompt**: Change from "alienCommunication" to "custom" in the frontend state
- **Custom Prompt Textarea**: Leave empty by default (no prefill)
- **Provider-Specific Preview**: Show the exact prompt string as assembled for the selected provider
- **Current Architecture**: Uses centralized `buildAnalysisPrompt()` in `server/services/promptBuilder.ts`
- **Providers**: OpenAI, Anthropic, Gemini, Grok, DeepSeek (each may have different message formatting)

## Task Checklist

### Phase 1: Change Default Prompt Selection
- [x] **Update frontend default**: Change `promptId` initial state from "alienCommunication" to "custom" in `client/src/hooks/useAnalysisResults.ts` (line 35)
- [ ] **Test UI behavior**: Verify that PromptPicker shows "Custom Prompt" selected by default with empty textarea visible

### Phase 2: Implement Provider-Specific Preview Backend
- [x] **Create preview endpoint**: Add `POST /api/prompt/preview/:provider/:puzzleId` in `server/controllers/puzzleController.ts`
- [x] **Provider-specific prompt building**: Extend each provider service to expose their prompt formatting logic:
  - [x] `server/services/openai.ts` - expose message formatting
  - [x] `server/services/anthropic.ts` - expose message formatting  
  - [x] `server/services/gemini.ts` - expose message formatting
  - [x] `server/services/grok.ts` - expose message formatting
  - [x] `server/services/deepseek.ts` - expose message formatting
- [ ] **Preview response format**: Return structured data including:
  - Final prompt string as sent to provider
  - Provider-specific message format
  - Template metadata (name, emoji usage, etc.)
  - Character count and other useful metrics

### Phase 3: Implement Frontend Preview UI
- [x] **Add preview button**: In `client/src/pages/PuzzleExaminer.tsx`, add "Preview Prompt" button near analyze controls
- [x] **Create preview modal**: New component to display provider-specific prompt preview
- [x] **Provider selection**: Allow user to select which provider's format to preview
- [x] **Preview content display**:
  - [x] Monospace text display of exact prompt
  - [x] Provider-specific formatting indicators
  - [x] Character count and metadata
  - [x] Clear indication of emoji usage if applicable

### Phase 4: Documentation & Testing
- [ ] **Update Changelog.md**: Document new default behavior and preview feature
- [ ] **Update README.md**: Add section explaining:
  - New "Custom Prompt" default
  - How to use provider-specific preview
  - Benefits of seeing exact prompt before sending
- [ ] **Add header comments**: Ensure all modified/new files have proper header comments per project rules
- [ ] **Test all providers**: Verify preview accuracy against actual analysis calls for each provider

## Technical Implementation Notes

### Backend Architecture
- Use existing `buildAnalysisPrompt()` from `promptBuilder.ts` as foundation
- Each provider service needs to expose its message formatting logic
- Preview endpoint should mirror the exact logic used in actual analysis calls

### Frontend Integration
- Preview modal should be accessible from PuzzleExaminer where puzzle context exists
- Integrate with existing prompt selection state management
- Maintain consistency with current UI patterns and styling

### Provider Differences to Account For
- **OpenAI**: Uses messages array with system/user roles
- **Anthropic**: Uses messages array with different role structure
- **Gemini**: Uses parts array with text content
- **Grok**: Similar to OpenAI but may have different formatting
- **DeepSeek**: Similar to OpenAI but may have different formatting

## Success Criteria
- [ ] UI defaults to "Custom Prompt" with empty textarea
- [ ] Preview shows exact prompt string for each provider
- [ ] Preview matches what's actually sent during analysis
- [ ] All providers supported in preview
- [ ] Documentation updated
- [ ] No breaking changes to existing functionality

## Files to Modify
- `client/src/hooks/useAnalysisResults.ts` - Change default promptId
- `server/controllers/puzzleController.ts` - Add preview endpoint
- `server/services/*.ts` - Expose provider-specific formatting
- `client/src/pages/PuzzleExaminer.tsx` - Add preview UI
- `Changelog.md` - Document changes
- `README.md` - Update documentation

## Current Status

