# System Prompts + Structured Outputs Migration Plan
**Date**: August 22, 2025  
**Author**: Claude Code  
**Goal**: Refactor prompt architecture to eliminate JSON parsing issues and enable proper reasoning log capture

## Problem Statement

Based on changelog analysis, the current system has persistent JSON parsing issues:
- Version 1.4.6: Markdown JSON response parsing fixes for OpenAI models
- Version 1.4.5: OpenAI reasoning log parsing showing `[object Object]`  
- Version 1.4.4: GPT-5 reasoning parameters not being captured properly
- Version 1.5.0: 587 lines of regex-based grid extraction logic in `responseValidator.ts`

The root cause: **Mixed instructions in user prompts** + **Inconsistent JSON output** = **Complex parsing logic**

## Solution Architecture

### Core Principles
1. **System Prompts**: Define AI role, behavior, and output format requirements
2. **Structured Outputs**: Enforce exact JSON schema compliance (OpenAI)
3. **Clean User Prompts**: Deliver raw puzzle data with minimal formatting
4. **Reasoning Capture**: Structure reasoning in dedicated JSON fields

### New File Structure
```
server/services/
├── prompts/
│   ├── systemPrompts.ts     # System role/behavior definitions
│   └── userTemplates.ts     # Simplified data formatting templates  
├── schemas/
│   ├── solver.ts           # JSON schema for solver mode
│   ├── explanation.ts      # JSON schema for explanation mode
│   └── common.ts           # Shared schema components
├── formatters/
│   └── grids.ts           # Emoji/numeric conversion utilities
└── promptBuilder.ts        # Orchestrates system+user+schema
```

### Benefits
✅ **Eliminates JSON parsing issues** - `JSON.parse(response)` always works  
✅ **Captures OpenAI reasoning logs** - structured in `solvingStrategy` field  
✅ **Modular architecture** - separates concerns properly  
✅ **Backwards compatible** - maintains existing functionality  
✅ **Provider flexibility** - structured outputs where supported, JSON enforcement elsewhere

## Implementation Plan

### Phase 1: Schema Definitions ✅
**Files**: `server/services/schemas/`
- [ ] Create `schemas/common.ts` - shared types and utilities
- [ ] Create `schemas/solver.ts` - JSON schema for solver mode responses
- [ ] Create `schemas/explanation.ts` - JSON schema for explanation mode responses
- [ ] Validate schemas work with OpenAI structured outputs

### Phase 2: System Prompts ✅
**Files**: `server/services/prompts/`  
- [ ] Create `prompts/systemPrompts.ts` - role and behavior definitions
- [ ] Define system prompts for each mode (solver, explanation, alien communication)
- [ ] Include reasoning capture instructions
- [ ] Add JSON output enforcement instructions

### Phase 3: User Prompt Simplification ✅
**Files**: `server/services/formatters/`, `server/services/prompts/`
- [ ] Create `formatters/grids.ts` - extract grid formatting logic
- [ ] Create `prompts/userTemplates.ts` - minimal data presentation templates
- [ ] Remove complex instructions from user prompts
- [ ] Focus on clean puzzle data delivery

### Phase 4: PromptBuilder Refactor ✅
**Files**: `server/services/promptBuilder.ts`
- [ ] Refactor to orchestrate system + user + schema
- [ ] Remove monolithic prompt construction
- [ ] Add schema attachment logic for structured outputs
- [ ] Maintain backwards compatibility with existing templates

### Phase 5: Provider Integration ✅
**Files**: `server/services/openai.ts`, other provider services
- [ ] Update OpenAI service for structured outputs (`response_format`)
- [ ] Add reasoning log extraction from structured fields
- [ ] Update other providers for JSON enforcement where possible
- [ ] Maintain fallback parsing for legacy responses

### Phase 6: Cleanup & Testing ✅
**Files**: Various
- [ ] Remove "Example JSON structure (optional)" from all prompts
- [ ] Remove complex parsing logic from `responseValidator.ts`
- [ ] Test all prompt templates across all providers
- [ ] Verify reasoning log capture works properly
- [ ] Update database schema if needed for new reasoning fields

## Expected Schema Structure

### Solver Mode Response
```typescript
{
  solvingStrategy: string,        // Detailed reasoning (captures OpenAI reasoning log)
  keySteps: string[],            // Step-by-step breadcrumbs
  confidence: number,            // 0-100 integer
  predictedOutput: number[][],   // Single test prediction
  predictedOutputs: number[][][], // Multi-test predictions
  patternDescription: string,    // What was learned from training
  hints: string[]               // Key insights
}
```

### Explanation Mode Response  
```typescript
{
  solvingStrategy: string,        // Detailed reasoning
  keySteps: string[],            // Step-by-step breadcrumbs  
  confidence: number,            // 0-100 integer
  patternDescription: string,    // Rules learned from examples
  hints: string[],              // Key insights
  alienMeaning?: string,        // For alien communication template
  alienMeaningConfidence?: number // For alien communication template
}
```

## Migration Strategy

### Backwards Compatibility
- Existing API endpoints remain unchanged
- Frontend components work with new response structure
- Database fields map to new structured responses
- Legacy parsing remains as fallback

### Rollout Approach
1. **Development**: Implement new architecture alongside existing
2. **Testing**: Validate all providers and templates work
3. **Gradual Migration**: Switch providers one by one
4. **Legacy Cleanup**: Remove old parsing logic after validation

## Success Metrics

### Technical Goals
- [ ] Zero JSON parsing errors in logs
- [ ] OpenAI reasoning logs properly captured in database
- [ ] All AI providers return valid JSON responses
- [ ] `promptBuilder.ts` reduced from 450+ lines to ~200 lines
- [ ] Remove 587 lines of parsing logic from `responseValidator.ts`

### Quality Goals  
- [ ] Consistent response format across all providers
- [ ] Proper reasoning log display in frontend
- [ ] No regression in analysis quality
- [ ] Improved debugging and troubleshooting

## Implementation Notes

### JSON Schema Enforcement
For OpenAI (structured outputs):
```typescript
response_format: {
  type: "json_schema",
  json_schema: {
    name: "arc_analysis",
    strict: true,
    schema: solverSchema
  }
}
```

For other providers (instruction-based):
```
System: Return only valid JSON. No markdown formatting. No extra text.
```

### Reasoning Log Capture
OpenAI reasoning models automatically populate `solvingStrategy` with their reasoning process. Other models put their analysis text in the same field for consistency.

### Error Handling
- Schema validation errors get proper error messages
- Fallback to legacy parsing if structured output fails
- Clear logging for debugging schema mismatches

---

**Status**: Planning Complete ✅  
**Next**: Begin Phase 1 - Schema Definitions