# 2025-11-22 – Gemini Direct API Migration Plan

**Author:** Cascade  
**Date:** 2025-11-22  
**Goal:** Migrate the internal `GeminiService` to the latest Google GenAI SDK and add first-class support for Gemini 3 Pro via Google’s own API, while keeping the existing OpenRouter-based Gemini 3 Pro path intact.

---

## 1. Context and Current State

### 1.1 Existing providers

- **Direct Gemini API**
  - Implemented in `server/services/gemini.ts` as `GeminiService`.
  - Uses **`@google/generative-ai`** (`GoogleGenerativeAI`) and `getGenerativeModel().generateContent(...)`.
  - Supports these model keys (direct provider):
    - `gemini-2.5-pro`
    - `gemini-2.5-flash`
    - `gemini-2.5-flash-lite`
    - `gemini-2.0-flash`
    - `gemini-2.0-flash-lite`
    - `gemini-1.5-pro`
    - `gemini-1.5-flash`
  - Uses `generationConfig` with:
    - `response_mime_type: 'application/json'` (snake_case)
    - Optional `temperature`, `topP`, `candidateCount`.
    - For 2.5 models: `thinking_config.thinking_budget` (snake_case, REST-style).
  - Response parser:
    - Reads `response.candidates[0].content.parts` and/or `response.text?.()`.
    - Extracts `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `reasoningTokenCount`.
    - Extracts an optional `thoughtSignature` and stores it in `response._thoughtSignatures` but does **not** yet use it for follow-up calls.

- **OpenRouter service**
  - Implemented in `server/services/openrouter.ts` as `OpenRouterService`.
  - Handles all `provider: 'OpenRouter'` models, including:
    - `google/gemini-3-pro-preview` (Gemini 3 Pro via OpenRouter, already configured in `server/config/models.ts`).
  - Uses OpenAI-compatible `chat.completions` style requests.
  - Has its own reasoning and truncation handling; **not** part of this migration.

### 1.2 Routing behavior (`aiServiceFactory.ts`)

- `aiServiceFactory.getService(model)` does:
  - `normalized.startsWith('gemini-')` → **`GeminiService`** (direct Google Gemini API).
  - Model keys that include `'/'` or start with `'google/'`, `'anthropic/'`, `'x-ai/'`, `'qwen/'`, etc. → **`OpenRouterService`**.
- Result:
  - `gemini-2.5-pro` → direct Gemini (`GeminiService`).
  - `google/gemini-3-pro-preview` → OpenRouter path (already working today).

### 1.3 Current mismatches vs latest docs

- SDK:
  - Code still uses the **legacy** `@google/generative-ai` package, while docs recommend `@google/genai` (`GoogleGenAI`).
- Thinking controls:
  - Gemini 2.5: docs use `config.thinkingConfig.thinkingBudget` (camelCase) in JS.
  - Gemini 3: docs use `config.thinkingConfig.thinkingLevel = 'low' | 'high'`.
  - Current service uses `thinking_config.thinking_budget` and has **no explicit support** for Gemini 3 thinking levels.
- Structured output:
  - `GeminiService.getModelInfo` hard-codes `supportsStructuredOutput: true` for all models, but our `ModelConfig` already marks reasoning models like `google/gemini-3-pro-preview` as `supportsStructuredOutput: false` to avoid JSON-mode conflicts.
- Model coverage:
  - No direct `Gemini`-provider 3.x models are defined in `server/config/models.ts`.
  - Direct Gemini path therefore cannot yet call Gemini 3 Pro via Google’s own API.


---

## 2. Goals and Non-Goals

### 2.1 Goals

- **G1 – Direct Gemini 3 Pro support**  
  Add a `provider: 'Gemini'` model configuration for Gemini 3 Pro (initially `gemini-3-pro-preview`, later updatable to GA name) and route it through `GeminiService`.

- **G2 – Migrate to `@google/genai`**  
  Update `GeminiService` to use the new Google GenAI SDK (`@google/genai`, `GoogleGenAI`) and its `ai.models.generateContent(...)` pattern.

- **G3 – Thinking controls parity**  
  Implement **thinking budgets** for 2.5 models and **thinking levels** for 3.x models using the documented `thinkingConfig` structure.

- **G4 – Respect structured output flags**  
  Make `GeminiService` derive `supportsStructuredOutput` and related behavior from `ModelConfig` instead of hard-coding it to `true`.

- **G5 – Keep OpenRouter path untouched**  
  Do **not** change how `google/gemini-3-pro-preview` works via OpenRouter; that remains a separate integration.

### 2.2 Non-goals

- Implementing full multi-turn tool calling with thought-signature round-tripping in this phase.  
  (We will keep a hook point for future work but won’t wire all of it now.)
- Changing any Anthropic / OpenAI / xAI / DeepSeek behavior.
- Changing pricing, context window, or UI grouping for **OpenRouter** models.


---

## 3. Affected Components

- **Backend services**
  - `server/services/gemini.ts`  
    - Switch to `@google/genai`.
    - Update config generation and response parsing.
    - Add thinking-level/budget handling.
  - `server/config/models.ts`  
    - Add new `Gemini`-provider model(s) for Gemini 3 Pro via direct API.
- **Service routing**
  - `server/services/aiServiceFactory.ts`  
    - No logic change, but confirm new keys like `gemini-3-pro-preview` correctly route to `GeminiService`.
- **Docs & Changelog**
  - `CHANGELOG.md`  
    - New version entry for Gemini direct-API migration.
  - This plan file in `docs/plans/`.


---

## 4. Detailed Plan

### Step 1 – Add direct Gemini 3 Pro model config

**Files:**
- `server/config/models.ts`

**Actions:**

1.1. Add a new `ModelConfig` under the existing Gemini block (provider `'Gemini'`), for example:

- **Key:** `gemini-3-pro-preview` (or `gemini-3-pro` when GA name is finalized).
- **Provider:** `'Gemini'` (not `'OpenRouter'`).
- **apiModelName:** `models/gemini-3-pro-preview` (REST-style) or `gemini-3-pro-preview` depending on current direct API convention.
- **isReasoning:** `true`.
- **supportsStructuredOutput:** `false` (to avoid JSON-mode vs reasoning conflicts).
- **supportsTemperature:** `true`.
- **contextWindow, cost, releaseDate:** approximate based on official docs.

1.2. Confirm routing:

- When the user selects `gemini-3-pro-preview` (no provider prefix), `canonicalizeModelKey` will keep it as-is.
- `aiServiceFactory.getService()` sees `normalized.startsWith('gemini-')` and routes to `GeminiService`.


### Step 2 – Switch `GeminiService` to `@google/genai`

**Files:**
- `server/services/gemini.ts`
- `package.json` (already has `"@google/genai": "^1.9.0"`, so no new dependency needed)

**Actions:**

2.1. Update imports and client initialization:

- Replace:

  ```ts
  import { GoogleGenerativeAI } from "@google/generative-ai";
  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  ```

- With:

  ```ts
  import { GoogleGenAI } from "@google/genai";

  const genai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY, // or rely on env implicit if we prefer
  });
  ```

2.2. Update `callProviderAPI` implementation:

- Instead of `genai.getGenerativeModel(...).generateContent(...)`, call:

  ```ts
  const response = await genai.models.generateContent({
    model: apiModelName,
    contents,
    config,
  });
  ```

- Ensure `contents` is shaped per docs:
  - For simple text: `contents: userMessage` or `contents: [{ role: 'user', parts: [{ text: userMessage }]}]`.
  - Preserve current `systemPromptMode` behavior by either:
    - Using `config.systemInstruction` (preferred, matches Python `system_instruction`), or
    - Prepending system prompt to user content when not in ARC mode.

2.3. Align generation-config fields to GenAI vocabulary:

- Use **camelCase** as in docs:
  - `responseMimeType` (not `response_mime_type`).
  - `maxOutputTokens`, `topP`, `candidateCount`.
  - `thinkingConfig`.
- Keep `temperature` only when `modelSupportsTemperature(modelKey)` is true.


### Step 3 – Implement thinking budgets (2.5) and thinking levels (3.x)

**Files:**
- `server/services/gemini.ts`

**Actions:**

3.1. Split thinking behavior by series:

- Use `getApiModelName(modelKey)` or `modelKey` pattern:
  - If apiModelName includes `"gemini-2.5"` → apply **thinking budget** semantics.
  - If apiModelName includes `"gemini-3"` → apply **thinking level** semantics.

3.2. For Gemini 2.5 models:

- In config:

  ```ts
  config.thinkingConfig = {
    thinkingBudget: options?.thinkingBudget ?? -1, // -1 = dynamic per docs
  };
  ```

- Allow advanced callers to set `thinkingBudget` via `PromptOptions` (already partially done, but convert to JS camelCase).

3.3. For Gemini 3 Pro models:

- Map `ServiceOptions.reasoningEffort` to `thinkingLevel`:

  - `"minimal" | "low"` → `thinkingLevel: 'low'`
  - `"medium" | "high"` → `thinkingLevel: 'high'`
  - Default: `'high'` (matches docs for Gemini 3 Pro Preview).

- In config:

  ```ts
  config.thinkingConfig = {
    thinkingLevel: inferredLevel, // 'low' | 'high'
  };
  ```

3.4. Future-proofing:

- Keep the existing `thinking_budget`/`thinking_config` handling only if needed for legacy REST payloads.
- Prefer the documented `thinkingConfig` structure for the GenAI SDK going forward.


### Step 4 – Correct `supportsStructuredOutput` and JSON handling

**Files:**
- `server/services/gemini.ts`

**Actions:**

4.1. Update `getModelInfo(modelKey: string)`:

- Instead of:

  ```ts
  supportsStructuredOutput: true,
  supportsVision: true,
  ```

- Do:

  ```ts
  const modelConfig = MODEL_CONFIGS.find(m => m.key === modelKey);

  return {
    name: modelName,
    isReasoning: modelConfig?.isReasoning ?? modelName.includes('2.5') || modelName.includes('3-pro'),
    supportsTemperature: modelSupportsTemperature(modelKey),
    contextWindow: modelConfig?.contextWindow,
    supportsFunctionCalling: modelConfig?.supportsFunctionCalling ?? true,
    supportsSystemPrompts: modelConfig?.supportsSystemPrompts !== false,
    supportsStructuredOutput: modelConfig?.supportsStructuredOutput !== false,
    supportsVision: modelConfig?.supportsVision ?? true,
  };
  ```

4.2. Keep JSON-mode conservative for reasoning models:

- For Gemini 3 Pro (direct) and any reasoning-configured 2.5 models:
  - Prefer **`responseMimeType: 'application/json'` without `responseSchema/responseJsonSchema`**, so the model can still do rich reasoning internally.
  - Continue to rely on the shared `jsonParser` to extract our domain-specific JSON shape.


### Step 5 – Align response parsing with `@google/genai` response shape

**Files:**
- `server/services/gemini.ts`

**Actions:**

5.1. Confirm `response.text` vs `response.text()` behavior:

- `@google/genai` examples show:

  ```ts
  const response = await ai.models.generateContent(...);
  console.log(response.text);
  ```

- Update `_extractTextAndReasoning` to:
  - Prefer `response.text` if present.
  - Fallback to `response.text?.()` only if needed for backward compatibility.

5.2. Keep existing structured parsing of `candidates[0].content.parts`:

- Continue to:
  - Separate `thought` parts (internal reasoning) from answer parts.
  - Stitch text for answer parts into `textContent`.
  - Preserve reasoning parts into `reasoningParts`.

5.3. Preserve thought signatures:

- Continue to extract `candidate.thoughtSignature` and store it somewhere stable on the response object (e.g. `_thoughtSignatures` array).
- Document in comments that a follow-up phase will read these signatures and embed them into multi-turn requests, per the Thought Signatures guide.


### Step 6 – Testing and validation

**Files:**
- Tests (new or existing):
  - `tests/aiServiceFactory.test.ts`
  - New focused tests for `GeminiService` if needed.

**Actions:**

6.1. Routing tests:

- Add/extend tests to assert:
  - `aiServiceFactory.getService('gemini-2.5-pro')` → `GeminiService`.
  - `aiServiceFactory.getService('gemini-3-pro-preview')` → `GeminiService`.
  - `aiServiceFactory.getService('google/gemini-3-pro-preview')` → `OpenRouterService`.

6.2. Basic smoke tests for direct Gemini:

- Behind an environment guard (e.g., only run if `GEMINI_API_KEY` is set), add minimal integration style tests that:
  - Call `GeminiService.analyzePuzzleWithModel` with a tiny synthetic task and a nonzero temperature.
  - Assert we get a non-empty `result` and reasonable `TokenUsage`.

6.3. Reasoning config tests (unit-level):

- Unit-test `_buildGenerationConfig` (or equivalent) to confirm:
  - 2.5 models get `config.thinkingConfig.thinkingBudget`.
  - 3.x models get `config.thinkingConfig.thinkingLevel`.
  - Non-reasoning models have no `thinkingConfig`.


### Step 7 – Documentation and changelog

**Files:**
- `CHANGELOG.md`
- `docs/reference/api/` (optional)

**Actions:**

7.1. Add a new changelog entry (e.g. `5.18.x`):

- Summarize:
  - Migration of direct Gemini integration to `@google/genai`.
  - Addition of direct Gemini 3 Pro support via Google’s API (separate from OpenRouter Gemini 3 Pro).
  - Reasoning-aware config (thinkingBudget / thinkingLevel) for Gemini 2.5 / 3.x.

7.2. Optional reference doc snippet:

- If needed, update or add a short section under `docs/reference/api/` describing:
  - Which Gemini models are available via OpenRouter vs direct API.
  - How model keys map to each provider (e.g., `gemini-3-pro-preview` vs `google/gemini-3-pro-preview`).


---

## 5. Rollout Strategy

1. Implement changes behind the existing `Gemini` provider, without touching OpenRouter.
2. Deploy to a non-production environment (or local dev) with `GEMINI_API_KEY` configured.
3. Run the new/updated tests plus a few manual ARC puzzle analyses with:
   - `gemini-2.5-pro` (regression check).
   - `gemini-2.5-flash` (thinkingBudget variations: 0, 1024, -1).
   - `gemini-3-pro-preview` (thinkingLevel `low` vs `high`).
4. Monitor logs for:
   - Token usage correctness.
   - Any errors from the GenAI SDK about invalid config fields.
5. Once stable, update any user-facing model labels or documentation that references direct Gemini usage.


---

## 6. Open Questions / Follow-ups

- **OQ1 – Final Gemini 3 model naming**  
  Should we expose `gemini-3-pro-preview`, `gemini-3-pro`, or a `gemini-3-pro-latest` alias once GA is out? Plan assumes `gemini-3-pro-preview` for now.

- **OQ2 – Thought-signature round-tripping**  
  This plan preserves signatures but does not yet wire them into multi-turn prompts. A follow-up plan should:
  - Design a small conversation history representation for Gemini.
  - Ensure function-calling and image-editing flows include signatures per the Thought Signatures doc.

- **OQ3 – Structured output vs. reasoning for Gemini 3**  
  For complex ARC reasoning, we will likely keep `supportsStructuredOutput: false` for Gemini 3 to avoid truncating thinking. If we later want strict JSON schemas, we should document use cases and tradeoffs separately.
