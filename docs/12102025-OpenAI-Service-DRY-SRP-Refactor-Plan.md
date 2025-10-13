# OpenAI Service DRY/SRP Refactor Plan
**Author:** Cascade (Claude Sonnet 4)  
**Date:** 2025-10-12  
**Issue:** JSON schema not being sent to GPT-5 models, causing text responses instead of structured JSON

## 🔥 Critical Bug Found

User's OpenAI logs show:
```
Model: gpt-5-nano-2025-08-07
Response: text
Reasoning effort: minimal
Reasoning summary: detailed
Verbosity: low
```

**Problem:** No `json_schema` format parameter is being sent to the API!

## Root Cause Analysis

### Current Architecture Violations

The `openai.ts` file has **THREE SEPARATE METHODS** building the same Responses API request:

1. **`buildResponsesRequestBody()`** (lines 358-455)
   - Used by: Streaming flow
   - Status: ✅ **CORRECT** - Properly merges textConfig + schema format
   - Code: Merges verbosity and format into single `text` object

2. **`callProviderAPI()`** (lines 457-533)
   - Used by: Non-streaming flow  
   - Status: ❌ **BROKEN** - Does NOT include schema at all
   - Code: Only sends `text: textConfig` without format field
   - Line 522: `...(textConfig && { text: textConfig })`

3. **`callResponsesAPI()`** (lines 753-790)
   - Used by: Both flows (called by callProviderAPI)
   - Status: ⚠️ **PARTIALLY BROKEN** - Tries to add schema but overwrites textConfig
   - Code: Line 782: `...(schemaFormat && { text: schemaFormat })`
   - Problem: Overwrites any existing `text` field from requestData

### The Bug Flow

**Non-Streaming Path:**
```
analyzePuzzleWithModel()
  → callProviderAPI() 
      Creates: { text: { verbosity: "low" } }  // NO SCHEMA!
  → callResponsesAPI()
      Overwrites: { text: { format: {...} } }  // LOSES VERBOSITY!
```

**Result:** Request sent to OpenAI has NEITHER verbosity NOR format (or loses one)

**Streaming Path:**
```
analyzePuzzleWithStreaming()
  → buildResponsesRequestBody()
      Creates: { text: { verbosity: "low", format: {...} } }  // CORRECT!
  → Direct API call with properly merged payload
```

**Result:** Streaming works correctly (by luck, doesn't use callProviderAPI)

## DRY Violations

1. **Request Building Logic Duplicated 3x**
   - buildResponsesRequestBody() - 98 lines
   - callProviderAPI() - 76 lines  
   - callResponsesAPI() - 38 lines building body

2. **Schema Logic Duplicated 2x**
   - buildResponsesRequestBody() lines 408-422
   - callResponsesAPI() lines 761-777

3. **Model Detection Duplicated 2x**
   - buildResponsesRequestBody() lines 384-406
   - callProviderAPI() lines 491-516

4. **Temperature/Top-P Logic Duplicated 2x**
   - buildResponsesRequestBody() lines 437-441
   - callResponsesAPI() lines 784-785

## SRP Violations

1. **callProviderAPI()** does TWO things:
   - Builds request payload (should be separate)
   - Makes API call decision (correct responsibility)

2. **callResponsesAPI()** does THREE things:
   - Rebuilds/modifies request payload (shouldn't need to!)
   - Manages HTTP connection/timeouts (correct responsibility)
   - Parses response (should be separate)

## Refactor Plan

### Phase 1: Extract Single Request Builder (SRP)

Create ONE canonical request builder:

```typescript
private buildResponsesAPIPayload(
  promptPackage: PromptPackage,
  modelKey: string,
  temperature: number,
  serviceOpts: ServiceOptions,
  testCount: number,
  taskId?: string
): { payload: Record<string, any>, isContinuation: boolean }
```

**Responsibilities:**
- ✅ Build messages array (system/user, continuation handling)
- ✅ Detect model type (GPT-5, O3/O4, GPT-5 Chat)
- ✅ Build reasoning config (effort, summary)
- ✅ Build text config (verbosity)
- ✅ Get and merge JSON schema format
- ✅ Handle temperature/top_p
- ✅ Add metadata, previous_response_id, etc.

**Returns:** Complete payload ready for API

### Phase 2: Simplify API Callers (DRY)

**callProviderAPI()** becomes:
```typescript
protected async callProviderAPI(...): Promise<any> {
  const { payload, isContinuation } = this.buildResponsesAPIPayload(...);
  return await this.callResponsesAPI(payload, modelKey);
}
```

**callResponsesAPI()** becomes:
```typescript
private async callResponsesAPI(payload: any, modelKey: string): Promise<any> {
  // ONLY responsible for:
  // - HTTP connection setup
  // - Timeout management  
  // - Making the API call
  // - Parsing JSON response
  // - Error handling
  // NO request modification!
}
```

**analyzePuzzleWithStreaming()** becomes:
```typescript
async analyzePuzzleWithStreaming(...): Promise<StreamingHarness> {
  const { payload } = this.buildResponsesAPIPayload(...);
  // Use payload directly for streaming
}
```

### Phase 3: Fix Schema Merging Logic

**Critical Fix** in `buildResponsesAPIPayload()`:

```typescript
// 1. Build text config
const baseText = textConfig ? { ...textConfig } : {};

// 2. Get schema if supported
let structuredFormat = undefined;
const supportsStructuredOutput = 
  !modelName.includes("gpt-5-chat-latest") && 
  !modelName.includes("gpt-5-nano");

if (supportsStructuredOutput) {
  const schema = getOpenAISchema(testCount);
  structuredFormat = {
    type: "json_schema",
    name: schema.name,
    strict: schema.strict,
    schema: schema.schema
  };
}

// 3. MERGE both into text field
const textPayload = {
  ...baseText,  // verbosity: "low"
  ...(structuredFormat && { format: structuredFormat })  // format: { json_schema }
};

// 4. Add to payload
const payload = {
  model: modelName,
  input: messages,
  reasoning: reasoningConfig,
  ...(Object.keys(textPayload).length > 0 && { text: textPayload }),
  // ... rest of fields
};
```

### Phase 4: Remove Deprecated ChatCompletions

Search for and remove:
- Any `chat.completions` API calls
- Legacy message format handling
- Old streaming code for ChatCompletions

**Files to check:**
- `openai.ts` (main focus)
- Any other files importing OpenAI SDK

## Implementation Steps

1. ✅ **Create this plan document**
2. ⏳ **Phase 1: Create buildResponsesAPIPayload()**
   - Copy logic from buildResponsesRequestBody (the correct one)
   - Ensure schema + textConfig merging works
   - Add comprehensive logging
3. ⏳ **Phase 2: Refactor callProviderAPI()**
   - Remove request building logic
   - Call buildResponsesAPIPayload()
   - Pass result to callResponsesAPI()
4. ⏳ **Phase 3: Refactor callResponsesAPI()**
   - Remove all request modification
   - Only handle HTTP/timeouts
   - Accept complete payload
5. ⏳ **Phase 4: Refactor streaming flow**
   - Use buildResponsesAPIPayload()
   - Remove buildResponsesRequestBody()
6. ⏳ **Phase 5: Search & destroy ChatCompletions**
   - Remove deprecated API calls
   - Clean up legacy code
7. ⏳ **Testing**
   - Test GPT-5 non-streaming (primary bug)
   - Test GPT-5 streaming  
   - Test O3/O4 models
   - Verify JSON schema appears in logs
   - Verify verbosity preserved

## Success Criteria

1. ✅ Only ONE method builds Responses API payloads
2. ✅ JSON schema format sent to all GPT-5 models (except nano/chat-latest)
3. ✅ Text verbosity preserved when schema present
4. ✅ Both streaming and non-streaming use same builder
5. ✅ No deprecated ChatCompletions code remains
6. ✅ Clear SRP: Each method has single responsibility
7. ✅ User's OpenAI logs show: `Response: json_schema`

## Testing Checklist

- [ ] gpt-5-2025-08-07 non-streaming → json_schema response
- [ ] gpt-5-2025-08-07 streaming → json_schema response
- [ ] gpt-5-mini-2025-08-07 non-streaming → json_schema response
- [ ] gpt-5-nano-2025-08-07 non-streaming → text response (expected, excluded)
- [ ] gpt-5-chat-latest streaming → text response (expected, excluded)
- [ ] o3-mini non-streaming → json_schema response
- [ ] o3-2025-04-16 non-streaming → json_schema response
- [ ] Verify verbosity + format both present in API calls
- [ ] Check OpenAI dashboard logs confirm json_schema format

## Commit Strategy

Each phase gets its own commit:

1. `feat: Extract buildResponsesAPIPayload() - DRY compliance (Phase 1)`
2. `refactor: Simplify callProviderAPI() - use shared builder (Phase 2)`  
3. `refactor: Simplify callResponsesAPI() - remove payload modification (Phase 3)`
4. `refactor: Streaming flow uses shared payload builder (Phase 4)`
5. `cleanup: Remove deprecated ChatCompletions code (Phase 5)`
6. `test: Verify JSON schema enforcement for all GPT-5 models (Phase 6)`

Each commit will include:
- What changed
- Why (DRY/SRP violation fixed)
- Testing performed
- Model: Cascade (Claude Sonnet 4)
