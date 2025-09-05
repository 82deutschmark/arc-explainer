# Investigation and Remediation Plan for Truncated JSON Responses

**Date:** 2025-09-05
**Author:** Cascade

## 1. Executive Summary

The application is suffering from persistent "Unexpected end of JSON input" errors across multiple AI models, particularly those accessed via OpenRouter. This issue stems from truncated API responses, causing the loss of valuable, paid-for data. 

My investigation confirms the user's suspicion: the root cause is a series of hardcoded `maxOutputTokens` limits scattered throughout the codebase. These limits override the centrally defined model capabilities, creating an unreliable and unpredictable system that arbitrarily caps the output of LLMs. 

This document outlines the specific locations of these problematic limits and provides a clear, actionable plan to remove them, ensuring that the application respects the full output potential of every model.

## 2. Key Findings: Sources of Truncation

The investigation identified several key files where token limits are being improperly enforced.

### 2.1. Systemic Default Limit (Primary Culprit)
- **File:** `server/config/models/ModelCapabilities.ts`
- **Issue:** A default fallback of `4000` tokens is applied to any model that does not have `maxOutputTokens` explicitly defined. This is a major systemic risk.

### 2.2. Provider-Specific Hardcoded Limits
Several provider-specific transformers and services contain their own hardcoded fallbacks or caps, which ignore the central model configuration.

- **OpenRouter (`server/services/openrouter.ts`):**
  - **Issue:** A fallback limit of `32768` tokens is used if no other value is found. While generous, it is still an unnecessary and arbitrary cap.

- **Anthropic (`server/config/models/ProviderAdapters.ts`):**
  - **Issue:** The `AnthropicTransformer` enforces a low fallback of `4096` tokens, creating a significant bottleneck for all Claude models.

- **Gemini (`server/config/models/ProviderAdapters.ts`):**
  - **Issue:** The `GeminiTransformer` enforces a fallback of `8192` tokens.

- **DeepSeek (`server/config/models/ProviderAdapters.ts`):**
  - **Issue:** The `DeepSeekTransformer` enforces a hard *maximum* of `8192` tokens, preventing the use of models with larger output capabilities.

## 3. Remediation Plan: Eliminating Token Limits

The following steps must be executed to remove all hardcoded token limits and ensure the application relies solely on the `maxOutputTokens` value defined in `server/config/models.ts` as the single source of truth.

### Step 1: Remove the Systemic Default Limit
- **File:** `server/config/models/ModelCapabilities.ts`
- **Action:** Modify the `createDefaultCapabilities` function. Remove the `?? 4000` fallback for `maxOutputTokens`. The line should be changed to rely only on the model definition. If `modelDef.maxOutputTokens` is not present, it should result in `undefined` so that it is not passed in API calls, allowing the provider's default to be used instead.

### Step 2: Remove OpenRouter Fallback Limit
- **File:** `server/services/openrouter.ts`
- **Action:** Modify the `callProviderAPI` function. Remove the `|| 32768` fallback from the `max_tokens` parameter. The logic should only use `serviceOpts.maxOutputTokens` or the value from `getModelConfig(modelKey)?.maxOutputTokens`.

### Step 3: Remove Provider-Specific Transformer Limits
- **File:** `server/config/models/ProviderAdapters.ts`
- **Action:** Update the following transformers to remove their hardcoded token limits:
  - **`AnthropicTransformer`**: Remove the `|| 4096` fallback.
  - **`GeminiTransformer`**: Remove the `|| 8192` fallback.
  - **`DeepSeekTransformer`**: Remove the `Math.min(...)` logic and the `8192` fallback. The transformer should pass the `request.max_tokens` value directly.

## 4. Validation

After these changes are implemented, the system should be tested with the models that were previously failing (e.g., `openai/gpt-oss-120b`, `x-ai/grok-4`). The expectation is that these models will now return complete, non-truncated JSON responses, resolving the parsing errors.
