# ARC-Explainer AI Pipeline Architecture  OLD DOC

## Overview

This document provides a comprehensive analysis of the AI processing pipeline in the ARC-Explainer application. The audit reveals a critical issue: **the system is not using system prompts correctly** and instead sends all instructions as user messages, which contributes to parsing errors and inconsistent responses.

## Executive Summary

**CRITICAL FINDING**: All AI providers in the system receive instructions only as user messages. No system prompts are being used anywhere in the pipeline.

**Impact**: This architectural issue causes:
- Parsing errors when models mix instructions with analysis content
- Inconsistent response formatting across providers
- Suboptimal model behavior due to lack of clear role separation
- Difficulty in maintaining consistent model behavior patterns

## Complete Pipeline Flow

### 1. Frontend User Interaction
**Files**: `client/src/pages/PuzzleExaminer.tsx`, `client/src/components/PromptPicker.tsx`

**Process**:
1. User selects a puzzle to analyze
2. User chooses prompt template (solver, standardExplanation, alienCommunication, custom)
3. User configures options:
   - Temperature setting
   - Emoji display mode (UI only)
   - Send as emojis (affects AI prompt)
   - Omit answer (for research)
   - GPT-5 reasoning parameters
4. User clicks a model button to trigger analysis

### 2. API Request Management
**Files**: `client/src/hooks/useAnalysisResults.ts`

**Process**:
1. `analyzeWithModel()` function is called
2. Request payload is built with:
   - `modelKey`: Target AI model
   - `temperature`: If supported by model
   - `promptId`: Selected template ID
   - `customPrompt`: If using custom template
   - `emojiSetKey`: If "send as emojis" enabled
   - `omitAnswer`: Research option
   - Reasoning parameters for GPT-5 models
3. POST request to `/api/puzzle/analyze/${taskId}/${modelKey}`

### 3. API Route Processing
**Files**: `server/routes.ts`, `server/controllers/puzzleController.ts`

**Process**:
1. Express route `/api/puzzle/analyze/:taskId/:model` handled by `puzzleController.analyze()`
2. Controller extracts request parameters and options
3. Fetches puzzle data via `puzzleService.getPuzzleById()`
4. Gets appropriate AI service via `aiServiceFactory.getService(model)`
5. Builds prompt options object with user preferences
6. Calls AI service for analysis

### 4. AI Service Factory
**Files**: `server/services/aiServiceFactory.ts`

**Process**:
- Routes model keys to appropriate service based on prefix:
  - `claude-*` → Anthropic Service
  - `grok-*` → Grok Service  
  - `gemini-*` → Gemini Service
  - `deepseek-*` → DeepSeek Service
  - All others → OpenAI Service

### 5. Prompt Construction
**Files**: `server/services/promptBuilder.ts`

**Current Architecture (PROBLEMATIC)**:
```typescript
export function buildAnalysisPrompt(
  task: ARCTask,
  promptId: string = "solver",
  customPrompt?: string,
  options?: PromptOptions
): {
  prompt: string;  // ⚠️ SINGLE STRING - NOT SEPARATED
  selectedTemplate: PromptTemplate | null;
}
```

**What happens**:
1. Builds complete prompt as single user message
2. Includes all instructions, context, examples, and data in one text block
3. Returns single `prompt` string containing everything
4. **NO system prompt separation**

### 6. AI Service Implementation
**Files**: All AI service files

**Current Implementation (PROBLEMATIC)**:

#### OpenAI Service (`server/services/openai.ts`)
```typescript
// ❌ PROBLEM: Only user message, no system prompt
const request = {
  model: modelName,
  input: prompt, // Everything as user message
  // NO system prompt field
}
```

#### Anthropic Service (`server/services/anthropic.ts`)
```typescript
// ❌ PROBLEM: Only user message, no system prompt
const requestOptions = {
  model: modelName,
  messages: [{ role: "user", content: prompt }], // Everything as user
  // NO system message
}
```

#### All Other Services
Similar pattern - every service receives the complete prompt as a user message only.

## Files Involved in AI Pipeline

### Core Pipeline Files
- **`server/services/promptBuilder.ts`**: Central prompt construction (NEEDS SYSTEM PROMPT SUPPORT)
- **`server/services/aiServiceFactory.ts`**: Routes to appropriate AI service
- **`server/controllers/puzzleController.ts`**: API endpoint handler

### AI Service Files (ALL NEED SYSTEM PROMPT SUPPORT)
- **`server/services/openai.ts`**: OpenAI/GPT models
- **`server/services/anthropic.ts`**: Claude models  
- **`server/services/gemini.ts`**: Google Gemini models
- **`server/services/grok.ts`**: xAI Grok models
- **`server/services/deepseek.ts`**: DeepSeek models

### Frontend Files
- **`client/src/pages/PuzzleExaminer.tsx`**: Main analysis interface
- **`client/src/components/PromptPicker.tsx`**: Template selection UI
- **`client/src/hooks/useAnalysisResults.ts`**: API call management
- **`client/src/components/puzzle/ModelButton.tsx`**: Model selection buttons

### Supporting Files
- **`server/routes.ts`**: API route definitions
- **`shared/types.ts`**: TypeScript interfaces and prompt templates
- **`server/services/responseValidator.ts`**: Response validation
- **`server/utils/responseFormatter.ts`**: Response formatting

## Current System Prompt Handling Analysis

### ❌ What's Wrong
1. **No System Prompts**: All instructions mixed with user data
2. **Single Message**: Everything in one user message
3. **Parsing Issues**: Models struggle to separate instructions from data
4. **Inconsistent Behavior**: No clear role definition for models

### ✅ What Should Happen
1. **System Prompt**: Clear instructions and role definition
2. **User Message**: Clean puzzle data only
3. **Clear Separation**: Instructions vs. data separation
4. **Consistent Behavior**: All models receive same structure

## Proposed Solution Architecture

### System Prompt Modes
Users should be able to choose between:

**1. {ARC} Mode (Default System Prompt)**
```
System: "You are an expert in solving puzzles. You should output your reply to the user as string such as 'the answer is' followed by the 2D array representing the correct output grid. then give a 0-100% confidence score. then provide a brief explanation of the reasoning and logic you used and what insights you had."
User: [clean puzzle data only]
```

**2. {None} Mode (Current Behavior)**
```
User: [everything mixed together as current]
```

### Implementation Steps Required

1. **Update PromptBuilder** to support system prompt modes
2. **Modify All AI Services** to handle system/user message separation  
3. **Add Frontend UI** for system prompt selection
4. **Update Type Definitions** for new prompt structure
5. **Test Across All Providers** to ensure consistent behavior

## Benefits of System Prompt Implementation

1. **Reduced Parsing Errors**: Clear separation of instructions and data
2. **Consistent Behavior**: All models receive same structure
3. **Better Performance**: Models can focus on task vs. parsing instructions
4. **Easier Maintenance**: Centralized instruction management
5. **User Control**: Choice between structured and current approaches

## Conclusion

The current architecture sends everything as user messages, causing parsing errors and inconsistent behavior. Implementing proper system prompt support with user choice between {ARC} and {None} modes will significantly improve model performance and reduce parsing errors, especially in the OpenAI service which the user specifically mentioned.