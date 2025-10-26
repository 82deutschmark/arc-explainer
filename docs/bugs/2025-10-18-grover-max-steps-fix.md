# Grover max_steps API Error Fix

**Date**: 2025-10-18  
**Author**: Windsurf Cascade  
**Issue**: Grover solver failing with `400 Unknown parameter: 'max_steps'`

## Problem

When running Grover solver with GPT-5 models, the OpenAI API returned:
```
BadRequestError: 400 Unknown parameter: 'max_steps'.
```

## Root Cause

The `max_steps` parameter is **internal to Grover's iteration control logic** (line 76 in `server/services/grover.ts`):
```typescript
const maxIterations = serviceOpts.maxSteps || 5;
```

However, `server/services/openai/payloadBuilder.ts` was including `max_steps` in the OpenAI Responses API payload:
```typescript
const payload = {
  // ...
  max_steps: serviceOpts.maxSteps,  // ❌ NOT a valid Responses API parameter
  // ...
}
```

The OpenAI Responses API only accepts these parameters:
- `model`
- `input`
- `instructions`
- `reasoning`
- `text`
- `temperature` (conditionally)
- `max_output_tokens`
- `store`
- `previous_response_id`
- `stream`
- `parallel_tool_calls`
- `truncation`
- `metadata`

## Fix

Removed `max_steps` from the OpenAI API payload in `server/services/openai/payloadBuilder.ts`:

```typescript
const payload = removeUndefined({
  model: modelName,
  input: messages,
  instructions: promptPackage.systemPrompt || undefined,
  reasoning: reasoningConfig,
  text: textPayload,
  temperature: supportsTemperature ? (temperature ?? 0.2) : undefined,
  top_p: supportsTemperature && isGPT5ChatModel ? 1 : undefined,
  previous_response_id: serviceOpts.previousResponseId,
  store: serviceOpts.store !== false,
  parallel_tool_calls: false,
  truncation: "auto",
  // max_steps is internal to Grover/Saturn services; NOT a valid Responses API parameter
  max_output_tokens: serviceOpts.maxOutputTokens || 128000,
  metadata: taskId ? { taskId } : undefined
});
```

The `maxSteps` parameter remains available in `ServiceOptions` for internal use by Grover/Saturn iteration control.

## Pattern

This follows the same pattern as the `temperature` exclusion for GPT-5 models (CHANGELOG 4.8.30):
- Some parameters are valid for internal service logic
- But not valid for the external API
- They should be filtered out before making API calls

## Verification

Test Grover solver with GPT-5 models:
1. Start the dev server
2. Navigate to Puzzle Examiner
3. Select a puzzle and run Grover with `grover-gpt-5-nano`
4. Confirm no 400 errors appear in logs
5. Verify iteration progress messages appear correctly

## Files Modified

1. `server/services/openai/payloadBuilder.ts` - Removed max_steps from payload
2. `CHANGELOG.md` - Documented fix in version 4.8.31
3. `docs/bugs/2025-10-18-grover-max-steps-fix.md` - This document
