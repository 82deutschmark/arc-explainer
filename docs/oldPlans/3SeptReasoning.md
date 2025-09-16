# Investigation Plan: OpenAI & OpenRouter Reasoning Failures

**Date:** September 3, 2025
**Author:** Cascade

## 1. Problem Statement

Reasoning log capture for models using the OpenAI `Responses API` (both direct OpenAI and via OpenRouter) is failing intermittently. The failures manifest in several ways:

- The `reasoning_log` field in the database contains `[object Object]`.
- The reasoning log is empty.
- The API returns a malformed JSON error that appears to expose the model's internal state.

This issue is specific to providers with dedicated reasoning APIs and does not affect providers like DeepSeek or Anthropic, which rely on prompt-based instructions.

## 2. Core Hypothesis

The primary issue is a **conflict between two different methods of requesting reasoning data from the OpenAI `Responses API`**:

1.  **Prompt-Based Instructions**: We are telling the model to generate a `reasoningItems` field as part of the main JSON output via instructions in `basePrompts.ts`.
2.  **API-Based Parameter**: We are also enabling the API's native reasoning capture by sending a `reasoning: { ... }` object in the request body.

This dual-request system likely confuses the model, causing it to generate reasoning data in an unpredictable format that our parsing logic cannot consistently handle. The `Responses API` is designed to have reasoning captured separately from the main content, and our current approach violates that separation.

## 3. Investigation & Resolution Plan

To resolve this, we must treat the API's `reasoning` parameter as the single source of truth for requesting reasoning from compatible models.

- **Step A: Analyze the Request Logic**
  - **Action**: Review `openai.ts` (`callProviderAPI` and `callResponsesAPI` methods).
  - **Goal**: Confirm that we are sending `reasoningItems` instructions in the text prompt while also using the `reasoning` API parameter. This will validate the core hypothesis.

- **Step B: Decouple Prompt from API Parameter**
  - **Action**: Modify the prompt generation logic. When the target is the OpenAI `Responses API`, the instructions for `reasoningItems` must be dynamically removed from the system prompt.
  - **Goal**: Ensure that the `reasoning` API parameter is the *only* mechanism used to request reasoning, eliminating the conflict.

- **Step C: Investigate and Fix OpenRouter**
  - **Action**: Analyze `openrouter.ts` to understand how it handles reasoning. Many OpenRouter models do not use the `Responses API` format.
  - **Goal**: Implement conditional logic in `openrouter.ts`. If the underlying model is OpenAI-compatible, use the decoupled approach from Step B. Otherwise, fall back to the standard prompt-based instructions. This ensures each model gets instructions in the format it expects.

- **Step D: Final Validation**
  - **Action**: After implementing the fixes, perform end-to-end tests.
  - **Goal**: Confirm that reasoning logs for OpenAI, OpenRouter, and all other providers are captured correctly and consistently, with no `[object Object]` errors or other malformations.
