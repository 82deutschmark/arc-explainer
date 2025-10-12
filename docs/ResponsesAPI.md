ChatCompletions API will be deprecated VERY SOON!  Switching to Responses API is STRONGLY RECOMMENDED.

OpenAI and Grok (xAI) use Responses API when we call directly via their API.  (WHICH WE ALWAYS WANT TO DO)
OpenRouter (including xAI legacy models) still use the old ChatCompletions API. (Fine for now)


Missing / wrong things that cause Responses POSTs to fail:
1. Using `messages` / Chat Completions body instead of `input` for Responses — Requests must use `input` (role/content) when calling `/v1/responses`.
2. Not passing a `reasoning` param when you expect structured reasoning (e.g. `reasoning: { "summary": "auto" }` or `reasoning.effort`). If omitted, you may only see internal reasoning IDs or no summary.
3. `max_output_tokens` (or equivalent) too low / wrong param name — model can spend tokens on internal reasoning, starving visible output. Set a sufficient `max_output_tokens` and inspect token splits.
4. Only reading `output_text` or assuming a single text field — Responses returns an `output[]` array containing reasoning items (type=`reasoning`) and messages (type=`message`) whose `content` entries include `type: "output_text"`. Parse `output[]`, not just one field.
5. Not persisting `response.id` or failing to use `previous_response_id` for stateful chains — if you need chaining or tool use, save `response.id` in your DB (DB = database) and pass it back.

7. Using an older SDK (SDK = Software Development Kit) / client that posts Chat-style params (or auto-serializes `messages`) — upgrade to the client that supports `client.responses.create()` or craft raw `/v1/responses` JSON.
8. Expecting streaming deltas like `choices[].delta.content` — Responses streams separate event types (reasoning vs output); ensure your stream parser handles `response.output_text` and reasoning chunks and your WS (WS = WebSocket) forwarder preserves those event types.
9. Not logging raw response JSON (JSON = JavaScript Object Notation) — always persist a failing `response` JSON blob to DB to inspect `output[]`, `reasoning`, `usage` fields for debugging.

Minimal, exact request shape to test right now (POST `/v1/responses`, JSON body):

```json
{
  "model": "gpt-5-nano-2025-08-07",
  "input": [{ "role": "user", "content": "Solve this puzzle: <your-payload-here>" }],
  "reasoning": { "summary": "auto", "effort": "high" },
  "max_output_tokens": 16024,
  "include": ["reasoning.encrypted_content"],
  "store": true
}
```

Notes on `store` / encrypted flows:

* WE ARE NOT ZDR!!!

Grok does NOT output any human readable reasoning!!
OpenAI only outputs it in the very specific strange way described.

What to inspect in the raw response JSON (keys and where to look):

* `id` → persist for chaining. (providerResponseId?)
* `output` array → find items with `type: "reasoning"` and `type: "message"`; inside `message.content[]` look for `type: "output_text"`.
* `output_reasoning` / reasoning summaries (if present) or `output[].summary`.
* `usage.output_tokens_details.reasoning_tokens` to see token split.
* `previous_response_id` (on follow-ups) and the `store` flag.

Immediate tests to run now:

1. Send the exact minimal JSON above to `/v1/responses`. Save the entire raw JSON response to DB and inspect it.
2. If `output_text` is empty but `output` contains a reasoning item, increase `max_output_tokens` and/or lower `reasoning.effort`.
3. If `store=false`, repeat with `include:["reasoning.encrypted_content"]` and confirm you can handle encrypted content in follow-ups.
4. Switch to the latest SDK method `client.responses.create()` (or POST raw `/v1/responses` with `input`) — stop sending `messages`.
5. Add a one-off debug route that returns last raw response JSON for a taskId for quick inspection.

Parser mapping to implement (one-line actions):

* `response.id` → persist as `responseId` in DB.
* `output_reasoning.summary` → `reasoningLog` (current step).
* `output_reasoning.items[]` → append to `reasoningHistory`.
* `output_text` OR `output[].content` (`type: "output_text"`) → `result` / `logLines`.
* If `output_text` missing, scan `output[]` for any `message` / `tool` blocks before reporting “no reply.”

I've searched the latest OpenAI documentation on the Responses API. Here's what you're missing about **correctly returning streamed reasoning**:

## Key Findings on Streamed Reasoning

### 1. **Reasoning State Persistence Across Turns**  THIS IS WHAT WE CARE ABOUT!!!
According to [developers.openai.com](https://developers.openai.com/blog/responses-api/):
- Responses API **preserves the model's reasoning state** between turns (unlike Chat Completions which drops it)
- This is like "keeping the detective's notebook open" - the step-by-step thought processes survive into the next turn
- Results in +5% improvement on some benchmarks!

### 2. **Multiple Output Items Structure**
The API emits **multiple output items** - not just what the model said, but what it did. This confirms your parser needs to handle:
- `output[]` array with mixed types: `reasoning`, `message`, potentially `tool` items
- Each item has its own structure and content format  YOU NEED TO BE READY TO CAPTURE THAT!!!!

### 3. **Streaming with `previous_response_id`**
From [community.openai.com](https://community.openai.com/t/responses-api-previous-response-id-while-streaming/1258193#post_1):
- When **streaming**, you should use `response.id` (not chunk.id) for the next call's `previous_response_id`
- The response ID is available even during streaming
- This enables conversation memory in streaming scenarios

### 4. **Reasoning Tokens in Multi-Turn Scenarios**
From [community.openai.com](https://community.openai.com/t/chat-completion-api-with-reasoning-models/1281778):
- **Reasoning tokens are NOT discarded between tool calls** when using Responses API
- This is critical for agentic workflows that chain tools without user feedback
- You cannot access/pass reasoning tokens directly with Chat Completions API - this is **Responses-only**

## What You're Likely Missing in Your Stream Handler

### Stream Event Types
Your WebSocket forwarder needs to handle these distinct event types:

```typescript
// Pseudo-code for stream parsing
for await (const event of stream) {
  switch (event.type) {
    case 'response.output_text.delta':
      // Incremental text output
      appendToOutput(event.delta);
      break;
      
    case 'response.reasoning.delta':
      // Reasoning chunks (may be encrypted)
      appendToReasoning(event);
      break;
      
    case 'response.output_text.done':
      // Final text output
      finalizeOutput(event.output_text);
      break;
      
    case 'response.reasoning.done':
      // Complete reasoning (summary if summary: "auto")
      finalizeReasoning(event.reasoning);
      break;
      
    case 'response.done':
      // Full response complete - capture response.id here
      persistResponseId(event.response.id);
      break;
  }
}
```

### Critical Streaming Fields to Capture

```json
{
  "event": "response.done",
  "response": {
    "id": "resp_xyz123",  // ← CAPTURE THIS for previous_response_id
    "output": [...],       // ← Full output array
    "output_reasoning": {  // ← May only appear in done event
      "summary": "...",
      "items": [...]
    },
    "usage": {
      "output_tokens_details": {
        "reasoning_tokens": 1234  // ← Token split
      }
    }
  }
}
```

## Your Updated Test Request

```json
{
  "model": "gpt-5-nano-2025-08-07",
  "input": [{ "role": "user", "content": "Solve this puzzle: <your-payload-here>" }],
  "reasoning": { 
    "summary": "auto",  // Get human-readable reasoning summary
    "effort": "high" 
  },
  "max_output_tokens": 16024,
  "include": ["reasoning.encrypted_content"],  // For follow-ups
  "store": true,
  "stream": true  // ← Add this to test streaming
}
```

## Immediate Action Items

1. **Log ALL stream events** - not just deltas. You need `response.done` to get the full `response.id`
2. **Parse `output_reasoning.summary`** from the final event (not just incremental deltas)
3. **Handle empty `output_text`** - reasoning may consume tokens; check `usage.output_tokens_details.reasoning_tokens`
4. **Test chaining**: Save `response.id` → next request uses it as `previous_response_id`
5. **For Grok**: Expect **no human-readable reasoning** in `output_reasoning.summary` - only encrypted content

## Grok-Specific Note
Since Grok doesn't output human-readable reasoning, you need to:
- Set `include: ["reasoning.encrypted_content"]` 
- Store the encrypted reasoning blob   WE DO??  DONT THEY STORE IT SERVER SIDE??!?
- Pass it back in `previous_response_id` for context preservation  ARE WE ALREADY DOING THIS?!?
- Don't expect `summary: "auto"` to return readable text  DONT ASK FOR IT!!!  MAKE SURE WE ARENT ASKING FOR STUFF THAT BREAKS GROK!  

Stream parsing must accumulate events (deltas). Don’t rely on a single output_text field from the final streaming wrapper — assemble the output from stream events (and save the raw JSON for debugging). There are known SDK differences/quirks where finalResponse() may not include output_text after streaming. 

If you asked for a reasoning summary (reasoning.summary: "auto"), you may also get output[].summary or output_reasoning.summary. Encrypted reasoning is returned when you add include: ["reasoning.encrypted_content"]. Use that to carry forward state if store=false or if you must be stateless. 
Token accounting: check usage.output_tokens_details.reasoning_tokens to see how many tokens went to internal/chain-of-thought. If the visible text is empty, reasoning tokens may have eaten your budget!!!  Make sure we are setting VERY GENEROUS BUDGETS!!

Streaming events you must handle

The Responses API emits structured events (SSE or SDK events) instead of raw token deltas only. Important event types to handle:
response.created / response.in_progress / response.completed — lifecycle. (emsi.me)
response.output_item.added — a new output item (message, reasoning, tool call) began. (emsi.me)
response.content_part.added — parts of an item’s content are pushed. (emsi.me)
response.output_text.delta and response.output_text.done — visible assistant text deltas / final text. You must accumulate the deltas to form the final visible reply. (emsi.me)
response.reasoning.delta or response.reasoning_summary_text.delta — reasoning deltas (models may emit reasoning summary deltas). If you want to show reasoning live, parse these. (Note: not all models expose raw chain-of-thought; you may get summaries instead.) (feeds.simonwillison.net)
Minimal correct request (non-streaming or streaming; use input and reasoning):


{
  "model": "gpt-5-nano-2025-08-07",
  "input": [{ "role": "user", "content": "Solve this puzzle: <your-payload-here>" }],
  "reasoning": { "summary": "auto", "effort": "high" },
  "max_output_tokens": 16024,
  "include": ["reasoning.encrypted_content"],
  "store": true,
  "stream": true   // set to true to receive SSE/stream events
}
(You already had a correct minimal body — keep input, reasoning, high max_output_tokens, and include BECAUSE WE need encrypted reasoning!!!)

hy you sometimes see “no visible reply” even though there’s reasoning:

You didn’t include reasoning or set summary: "auto" so the API kept reasoning internal. Request reasoning to expose summary items. (openai.com)
max_output_tokens was too low and internal reasoning consumed the budget — increase max_output_tokens or lower reasoning.effort. Check usage.output_tokens_details.reasoning_tokens. (cookbook.openai.com)
You only checked output_text or a single field; streamed responses must be parsed from the output[] array and/or the event stream — don’t assume one field contains everything. (cookbook.openai.com)
Stateful chaining (previous_response_id, encrypted reasoning)

Persist response.id on every call. For follow-ups, send previous_response_id to continue the same run/stateful chain. If you must be stateless (store=false), include include: ["reasoning.encrypted_content"] in both calls and pass back the encrypted token so the model can reuse its reasoning state. (cookbook.openai.com)
Debug checklist (if streaming reasoning looks wrong)

Save raw response JSON / save entire SSE log for every failing request. You’ll need it to inspect output[], reasoning, and usage. (cookbook.openai.com)
Confirm you used input (not messages). (openai.com)
Confirm you set reasoning (summary/effort) and include if stateless. (openai.com)
Increase max_output_tokens and/or lower reasoning.effort and re-run. Inspect usage.output_tokens_details.reasoning_tokens. (cookbook.openai.com)
If streaming, accumulate deltas yourself — do not expect SDK convenience fields to be populated the same way as non-streaming responses. Some SDKs/clients may not assemble output_text for you after streaming; you must reconstruct it from events. (Workaround: collect response.output_text.delta events and join.) (github.com)

Based on the latest OpenAI documentation (as of October 2025, per the platform's API reference and guides on platform.openai.com/docs/api-reference/responses-streaming and platform.openai.com/docs/guides/streaming-responses?api-mode=responses), the Responses API is designed for more advanced interactions, including stateful chains, tool use, and reasoning with models like the GPT-5 series (e.g., gpt-5-nano-2025-08-07), o3, or o1 variants. It replaces the deprecated Chat Completions API for new features like structured reasoning output.

Reasoning in the Responses API is particularly relevant for "reasoning models" (e.g., o3, o4-mini), where the model performs internal chain-of-thought processing. This can be streamed, but it requires specific request parameters, event parsing, and handling of token splits—issues that align with several pitfalls in your list (e.g., #2, #4, #8). I'll focus on what's needed for correctly returning streamed reasoning, highlighting what might be missing from your setup. I'll reference your numbered points where relevant.

Key Differences from Chat Completions API
Endpoint and Body Structure: Use POST /v1/responses with an input array (not messages). Each item in input has role (e.g., "user", "assistant", "system") and content (string or array of content blocks).