Author: Cascade (ChatGPT)
Date: 2026-01-10T23:30:00Z
PURPOSE: Plan automated health-check suite that concurrently pings every OpenRouter catalog model ending in `:free`, reports responses, and flags any errors for pruning.
SRP/DRY check: Pass — scoped to one diagnostic script leveraging existing OpenRouter env configuration.

## Scope
- Enumerate all `:free` slugs directly from `server/config/openrouter-catalog.json` so the test stays aligned with catalog updates.
- Build a Node/TypeScript test script under `scripts/tests/` that concurrently sends `chat.completions` requests with a trivial "hi" payload to each `:free` model using the real `OPENROUTER_API_KEY`.
- Parse each response, capturing either the text reply or any error string, and summarize results to stdout (success/failure per model) with exit code 1 if any failure occurs.

## Tasks
1. **Catalog Parsing Utility**
   - Reuse JSON import or read/parse logic to extract unique model IDs suffixed with `:free`.
2. **Concurrent Ping Runner**
   - Initialize OpenAI client (OpenRouter base URL) with env API key and dispatch all requests via `Promise.allSettled` or controlled concurrency.
   - Payload: simple system/user messages (e.g., "respond with 'pong'"). Keep reasonable timeout and `max_tokens` minimal.
3. **Result Aggregation & Output**
   - For each model, log status (success text snippet or normalized error message). Highlight failures with clear markers and maintain an `errors` array.
   - Exit non-zero if errors exist so CI/manual runs can act.
4. **Docs & CHANGELOG**
   - Note plan completion, describe script addition + usage instructions.

## Risks / Considerations
- **Rate limits**: Simultaneous requests could exceed OpenRouter limits; mitigate with configurable concurrency (default 5-10) and small payloads.
- **Cost**: Even free slugs might incur minimal cost; document that the script is short-lived and uses tiny prompts.
- **Secrets**: Never log the API key; rely on env variables only.

## Success Criteria
- Script reliably enumerates all `:free` slugs and pings them concurrently.
- Output clearly distinguishes success vs. error per model and returns proper exit status.
- Docs/CHANGELOG updated.

## Status
- 2026-01-10 – Completed. Script added under `scripts/testing/openrouter-free-healthcheck.ts` plus npm alias `openrouter:free-healthcheck`.
