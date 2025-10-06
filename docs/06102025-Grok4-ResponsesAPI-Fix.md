# Grok-4 Responses API Implementation Fix

**Date**: 2025-10-06
**Author**: Claude Code using Sonnet 4.5
**Status**: Planning Phase

## Problem Summary

Current Grok service implementation has critical mismatches with xAI's actual API behavior:

1. **Invalid reasoning configuration** - Sending `{ summary: 'detailed' }` to grok-4, which doesn't support reasoning config
2. **Attempting to extract non-existent reasoning** - grok-4 does NOT return `reasoning_content` per xAI docs
3. **Mixed model support** - grok.ts tries to handle both grok-4 (Responses API) and grok-3 (Chat Completions API)
4. **Model routing confusion** - grok-3 models should use OpenRouter, not direct xAI API

## Confirmed Facts from xAI Documentation

✅ **grok-4 and grok-4-fast support Responses API** (`/v1/responses`)
✅ **grok-3 models do NOT support Responses API** (use Chat Completions only)
✅ **grok-4 does NOT return reasoning_content** (confirmed in docs)
✅ **reasoning_effort parameter is NOT supported by grok-4**
✅ **grok-4-fast is a distinct model** (different from grok-4)

## Architecture Decision

### **Separation of Concerns**

**grok.ts** → Grok-4 family ONLY (Responses API)
- grok-4
- grok-4-fast
- Future grok-4 variants

**openrouter.ts** → Grok-3 family (Chat Completions via OpenRouter)
- x-ai/grok-3
- x-ai/grok-3-mini
- x-ai/grok-3-mini-fast
- x-ai/grok-code-fast-1

### Why This Separation?

1. **API Compatibility**: Grok-4 uses Responses API, Grok-3 uses Chat Completions
2. **Code Clarity**: Different request/response formats require different parsing logic
3. **Future-Proofing**: New grok-4 variants will work automatically
4. **Maintainability**: Each service has single responsibility

## Implementation Plan

### Phase 1: Fix grok.ts for Grok-4 Only

#### File: `server/services/grok.ts`

**Changes Required:**

1. **Update models object** (lines 33-40)
   ```typescript
   protected models = {
     "grok-4": "grok-4",
     "grok-4-fast": "grok-4-fast",
     // Remove grok-3, grok-3-mini, grok-code-fast-1, grok-3-mini-fast
   };
   ```

2. **Fix reasoning configuration** (lines 378-388)
   ```typescript
   // REMOVE this entire block - grok-4 doesn't support reasoning config
   // const isReasoningModel = modelName.includes('grok-4') || modelName.includes('grok-3');
   // if (isReasoningModel) {
   //   reasoningConfig = { summary: serviceOpts.reasoningSummary || 'detailed' };
   // }

   // NEW: Don't send ANY reasoning config to grok-4
   let reasoningConfig = undefined;
   ```

3. **Update callProviderAPI** (lines 360-401)
   ```typescript
   protected async callProviderAPI(
     promptPackage: PromptPackage,
     modelKey: string,
     temperature: number,
     serviceOpts: ServiceOptions,
     taskId?: string
   ): Promise<any> {
     const modelName = getApiModelName(modelKey);
     const systemMessage = promptPackage.systemPrompt;
     const userMessage = promptPackage.userPrompt;

     // Build message array
     const messages: any[] = [];
     if (systemMessage) {
       messages.push({ role: "system", content: systemMessage });
     }
     messages.push({ role: "user", content: userMessage });

     // grok-4 does NOT support reasoning config - don't send it
     const request = {
       model: modelName,
       input: messages,
       // NO reasoning config
       previous_response_id: serviceOpts.previousResponseId,
       ...(modelSupportsTemperature(modelKey) && {
         temperature: temperature || 0.2
       }),
     };

     return await this.callResponsesAPI(request, modelKey);
   }
   ```

4. **Update response parsing** (lines 187-358)
   ```typescript
   protected parseProviderResponse(
     response: any,
     modelKey: string,
     captureReasoning: boolean,
     puzzleId?: string
   ): {
     result: any;
     tokenUsage: TokenUsage;
     reasoningLog?: any;
     reasoningItems?: any[];
     status?: string;
     incomplete?: boolean;
     incompleteReason?: string;
   } {
     // ... existing parsing logic ...

     // Extract reasoning ONLY for future models that support it
     // grok-4 does NOT return reasoning_content per xAI docs
     const supportsReasoning = false; // grok-4 doesn't expose reasoning

     if (captureReasoning && supportsReasoning && response.output_reasoning?.summary) {
       // This won't execute for grok-4, but kept for future grok models
       // ... reasoning extraction logic ...
     }

     // For grok-4, reasoningLog will remain null (as expected)
     return {
       result,
       tokenUsage,
       reasoningLog: null, // grok-4 doesn't provide this
       reasoningItems: [],
       status,
       incomplete,
       incompleteReason
     };
   }
   ```

### Phase 2: Move Grok-3 Models to OpenRouter

#### File: `server/config/models.ts`

**Changes Required:**

1. **Update grok-3 model entries** (lines 605-668)
   ```typescript
   // Change from:
   {
     key: 'grok-3',
     provider: 'xAI',  // ❌ Wrong
     modelType: 'grok', // ❌ Wrong
     apiModelName: 'grok-3'
   }

   // Change to:
   {
     key: 'x-ai/grok-3',  // ✅ OpenRouter format
     provider: 'OpenRouter',
     modelType: 'openrouter',
     apiModelName: 'x-ai/grok-3'
   }
   ```

2. **Models to update:**
   - `grok-3` → `x-ai/grok-3`
   - `grok-3-mini` → `x-ai/grok-3-mini`
   - `grok-3-mini-fast` → `x-ai/grok-3-mini-fast`
   - `grok-code-fast-1` → `x-ai/grok-code-fast-1`

3. **Keep ONLY these in direct xAI (grok.ts):**
   - `grok-4`
   - `grok-4-fast`

#### File: `server/services/aiServiceFactory.ts`

**Verify routing logic** (lines 46-83):

```typescript
getService(model: string) {
  console.log(`[Factory] Routing model '${model}' to service:`);

  // xAI Grok-4 models (direct API)
  if (model === 'grok-4' || model === 'grok-4-fast') {
    console.log('   -> Grok service (Responses API)');
    return this.grokService;
  }

  // xAI Grok-3 models (via OpenRouter)
  if (model.startsWith('x-ai/grok-')) {
    console.log('   -> OpenRouter service (Chat Completions)');
    return this.openrouterService;
  }

  // ... rest of routing logic
}
```

### Phase 3: Update Documentation

#### File: `CLAUDE.md` (lines 295-330)

Update endpoint documentation:

```markdown
### Endpoint Differences

**Responses API** (`/v1/responses`):
- Used by: OpenAI models (gpt-5, o3, o4), xAI grok-4, grok-4-fast
- Output location: `output_text`, `output_parsed`, `output[]`
- Reasoning: Available in `output_reasoning` (OpenAI only - NOT grok-4)
- Token accounting: Separate reasoning_tokens tracking
- Structured output: JSON schema support

**Chat Completions API** (`/v1/chat/completions`):
- Used by: OpenRouter, Anthropic, Gemini, DeepSeek, xAI grok-3 models
- Output location: `choices[0].message.content`
- Reasoning: Model-dependent (grok-3-mini has `reasoning_content`)
- Token accounting: Combined in `completion_tokens`
```

#### File: `shared/types.ts`

**No changes needed** - ModelConfig already updated by user.

### Phase 4: Testing Plan

1. **Unit Test**: Verify grok.ts only handles grok-4 variants
2. **Integration Test**: Test both grok-4 and grok-4-fast against real API
3. **Routing Test**: Verify grok-3 models route to OpenRouter
4. **Health Check**: Run updated health check script

## Expected Outcomes

### Before Fix:
- ❌ API returns errors due to invalid reasoning config
- ❌ Responses show HTML instead of JSON (routing issue)
- ❌ Mixed model support causes confusion

### After Fix:
- ✅ grok-4 and grok-4-fast work via Responses API
- ✅ grok-3 models work via OpenRouter
- ✅ Clean separation of concerns
- ✅ No invalid parameters sent to API
- ✅ Proper response parsing (no reasoning extraction for grok-4)

## Files to Modify

1. ✏️ `server/services/grok.ts` - Remove grok-3 support, fix reasoning config
2. ✏️ `server/config/models.ts` - Update grok-3 models to use OpenRouter
3. ✏️ `server/services/aiServiceFactory.ts` - Verify routing logic
4. ✏️ `CLAUDE.md` - Update documentation
5. ✏️ `scripts/test-grok-health.js` - Update to test only grok-4 variants

## Risk Assessment

**Low Risk** - Changes are:
- Well-isolated to specific files
- Based on official xAI documentation
- Backwards compatible (no breaking changes to existing functionality)
- Testable before deployment

## Next Steps

1. ✅ Get user approval of this plan
2. Implement Phase 1 (fix grok.ts)
3. Implement Phase 2 (move grok-3 to OpenRouter)
4. Implement Phase 3 (update docs)
5. Implement Phase 4 (testing)
6. Commit and test in production

## Notes

- Future grok-4 variants (e.g., grok-4.1, grok-4-turbo) will automatically work with grok.ts
- If xAI releases grok-5 with Responses API support, easy to add
- Grok-3 models remain available via OpenRouter (no functionality lost)
- Clear separation makes debugging easier
