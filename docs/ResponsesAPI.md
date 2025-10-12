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


