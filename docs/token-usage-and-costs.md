<!--
File: docs/token-usage-and-costs.md
Purpose: Explain exactly how token usage is captured and costs are calculated across providers, with code snippets.
How it works: Documents the centralized cost formula in `server/providers/base.ts` and the per‑provider token mapping logic used to feed it. Also notes routing pass‑through and UI aggregation.
Used by project: As a reference for developers when changing provider implementations or pricing tables.
Author: Cascade
Date: 2025-08-22
-->

# Token Usage and Cost Calculation Guide

This document explains how we capture token usage and compute costs for each provider. It covers:

- Centralized cost formula in `server/providers/base.ts`
- Provider‑specific token usage extraction and cost calculation
- How values flow through `server/routes.ts` to the client
- Where totals are aggregated in the UI store

---

## Centralized Cost Calculation

All providers call a single helper to compute dollar costs from token counts using the model pricing table.

Source: `server/providers/base.ts` `BaseProvider.calculateCost()`

```ts
// server/providers/base.ts
// Converts token usage into costs using per‑million pricing.
calculateCost(modelConfig: ModelConfig, tokenUsage: { input: number; output: number; reasoning?: number }) {
  const inputCost = (tokenUsage.input / 1_000_000) * modelConfig.pricing.inputPerMillion;
  const outputCost = (tokenUsage.output / 1_000_000) * modelConfig.pricing.outputPerMillion;

  let reasoningCost = 0;
  if (tokenUsage.reasoning && modelConfig.pricing.reasoningPerMillion) {
    reasoningCost = (tokenUsage.reasoning / 1_000_000) * modelConfig.pricing.reasoningPerMillion;
  }

  const total = inputCost + outputCost + reasoningCost;

  return {
    input: inputCost,
    output: outputCost,
    reasoning: tokenUsage.reasoning ? reasoningCost : undefined,
    total,
  };
}
```

Inputs required per response:
- `tokenUsage.input` (prompt tokens)
- `tokenUsage.output` (completion tokens)
- Optional `tokenUsage.reasoning` (thinking/CoT tokens if available)

---

## Provider Implementations

Each provider extracts token counts from its SDK/API response, then calls `calculateCost()` with the model’s pricing from its own `models` table.

### OpenAI (Responses API)

File: `server/providers/openai.ts`

Current state: the Responses API call returns text and optional reasoning summary, but we do not yet capture usage or cost because the SDK response we use here does not expose token counts in this path.

```ts
// server/providers/openai.ts (excerpt of return)
return {
  content,
  reasoning: reasoningSummary,
  responseTime: Date.now() - startTime,
  systemPrompt: prompt,
  tokenUsage: undefined,
  cost: undefined,
  modelConfig: modelConfig ? { capabilities: modelConfig.capabilities, pricing: modelConfig.pricing } : undefined,
  responseId: response.id,
} as any;
```

If/when token usage becomes available from the Responses API, implement mapping similar to other providers:

```ts
// Pseudocode: populate once the SDK supports usage fields
const tokenUsage = response.usage ? {
  input: response.usage.input_tokens,
  output: response.usage.output_tokens,
  reasoning: response.usage.reasoning_tokens, // if provided
} : undefined;
const cost = tokenUsage && modelConfig ? this.calculateCost(modelConfig, tokenUsage) : undefined;
```

### Anthropic (Claude Messages API)

File: `server/providers/anthropic.ts`

We read `message.usage.input_tokens` and `message.usage.output_tokens`. For models where we ask for inline reasoning between `<reasoning>...</reasoning>`, we estimate reasoning tokens from the extracted tag content length.

```ts
// server/providers/anthropic.ts (usage + cost)
const tokenUsage = message.usage ? {
  input: message.usage.input_tokens,
  output: message.usage.output_tokens,
  reasoning: reasoningTokens, // estimated when <reasoning>...</reasoning> present
} : undefined;

const cost = tokenUsage && modelConfig ? this.calculateCost(modelConfig, tokenUsage) : undefined;
```

Notes:
- `reasoningTokens` is an estimate: `Math.floor(reasoningText.length * 0.75)`.
- `reasoning` cost contributes only if both `tokenUsage.reasoning` and `pricing.reasoningPerMillion` are defined.

### Google (Gemini GenAI)

File: `server/providers/google.ts`

We map from `response.usageMetadata` fields.

```ts
// server/providers/google.ts (usage + cost)
const tokenUsage = response.usageMetadata ? {
  input: response.usageMetadata.promptTokenCount || 0,
  output: response.usageMetadata.candidatesTokenCount || 0,
} : undefined;

const cost = tokenUsage && modelConfig ? this.calculateCost(modelConfig, tokenUsage) : undefined;
```

### DeepSeek (OpenAI‑compatible)

File: `server/providers/deepseek.ts`

We map from the OpenAI‑compatible `response.usage` plus a vendor‑specific `reasoning_tokens` field for R1.

```ts
// server/providers/deepseek.ts (usage + cost)
const tokenUsage = response.usage ? {
  input: response.usage.prompt_tokens,
  output: response.usage.completion_tokens,
  reasoning: (response.usage as any).reasoning_tokens, // present for R1
} : undefined;

const cost = tokenUsage && modelConfig ? this.calculateCost(modelConfig, tokenUsage) : undefined;
```

### xAI (Grok, OpenAI‑compatible)

File: `server/providers/xai.ts`

We map from the OpenAI‑compatible `response.usage`.

```ts
// server/providers/xai.ts (usage + cost)
const tokenUsage = response.usage ? {
  input: response.usage.prompt_tokens,
  output: response.usage.completion_tokens,
} : undefined;

const cost = tokenUsage && modelConfig ? this.calculateCost(modelConfig, tokenUsage) : undefined;
```

---

## Request/Response Flow

- Providers return `ModelResponse` with `tokenUsage` and `cost`.
- `server/routes.ts` forwards those fields in API responses:

```ts
// server/routes.ts (examples)
// compare/models/respond/battle endpoints map through tokenUsage and cost
res.json({
  content: result.content,
  reasoning: result.reasoning,
  responseTime: result.responseTime,
  tokenUsage: result.tokenUsage,
  cost: result.cost,
  modelConfig: result.modelConfig,
});

// /api/generate final event applies safe defaults if missing
const message = {
  ...,
  tokenUsage: result.tokenUsage ?? { input: 0, output: 0 },
  cost: result.cost ?? { total: 0, input: 0, output: 0 },
  modelConfig: result.modelConfig,
};
```

---

## UI Aggregation (Totals)

The client summarizes totals across messages for display.

Source: `shared/store.ts` `getTotals()`

```ts
// shared/store.ts
getTotals: (state: AppState) => state.messages.reduce((acc, msg) => ({
  cost: acc.cost + (msg.cost?.total || 0),
  tokens: {
    input: acc.tokens.input + (msg.tokenUsage?.input || 0),
    output: acc.tokens.output + (msg.tokenUsage?.output || 0),
    reasoning: acc.tokens.reasoning + (msg.tokenUsage?.reasoning || 0),
  },
}), { cost: 0, tokens: { input: 0, output: 0, reasoning: 0 } }),
```

---

## Gotchas & Consistency Notes

- Providers expose different usage fields. Always normalize into `{ input, output, reasoning? }`.
- Reasoning tokens are not universally available:
  - DeepSeek R1 provides `reasoning_tokens`.
  - Anthropic: we estimate from explicit `<reasoning>` tags we prompt for.
  - Google/xAI: no reasoning tokens captured currently.
- If `tokenUsage` is missing, `server/routes.ts` supplies zero defaults in `/api/generate` finalization.
- OpenAI (Responses API) currently returns no usage in our path; update when SDK exposes it.

---

## Checklist When Adding/Modifying a Provider

1. Define accurate pricing in the provider’s `models` table.
2. Map SDK response usage to `{ input, output, reasoning? }`.
3. Call `this.calculateCost(modelConfig, tokenUsage)`.
4. Return `tokenUsage` and `cost` on the `ModelResponse`.
5. Verify UI totals in `shared/store.ts` display as expected.
