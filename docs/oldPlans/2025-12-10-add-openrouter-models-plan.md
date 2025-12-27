# 2025-12-10 Add OpenRouter reasoning models plan

## Objective
- Add DeepSeek v3.2 and the two OLMo-3 thinking variants to our OpenRouter model catalog and ensure they participate in the Nova/Kat Worm Arena coverage batch.

## Files & Notes
- `server/config/models.ts`
  - Insert entries for `deepseek/deepseek-v3.2`, `allenai/olmo-3-7b-think`, and `allenai/olmo-3-32b-think:free` directly after the existing DeepSeek OpenRouter block so the new reasoning models appear alongside their peers and advertise the correct pricing, context windows, and notes.
- `scripts/worm-arena-tournaments/run-nova-kat-coverage.ps1`
  - Extend `$opponentModels` with the three new OpenRouter entries so Nova/Kat run against each during coverage batches.

## Todos
1. Add the DeepSeek v3.2 model definition following the current OpenRouter DeepSeek entries.
2. Add the two OLMo-3 Think entries with their specified metadata.
3. Append all three models to the Worm Arena opponent list.
4. Rerun any lint/format hooks if required (most likely none for these JSON-ish edits).

## Verification
- Confirm the new entries load in the client dropdowns (manual check later).
- Ensure the tournament script references the intended models and remains syntactically valid.
