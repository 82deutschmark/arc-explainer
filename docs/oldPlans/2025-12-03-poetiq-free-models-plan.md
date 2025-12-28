# 2025-12-03 – Poetiq Free Models Plan

## Goal
- Surface the new OpenRouter free-tier models (Amazon Nova 2 Lite and Arcee Trinity Mini) inside the Poetiq solver picker so users can run them without providing a BYO key.

## Key Files
- `server/controllers/poetiqController.ts` – extend `OPENROUTER_SERVER_KEY_MODELS` and `/api/poetiq/models` response with the new entries.
- `server/config/models.ts` – reference metadata (names/provider) to keep strings consistent.
- `CHANGELOG.md` – document the addition with a semantic-version bump.

## Tasks
1. Mirror the `models.ts` metadata for `amazon/nova-2-lite-v1:free` and `arcee-ai/trinity-mini:free` when constructing Poetiq model options (id, friendly label, routing, BYO flag).
2. Treat both ids as server-key-friendly inside `OPENROUTER_SERVER_KEY_MODELS` (cover prefixed/unprefixed variants) so backend BYO checks align with the UI.
3. Smoke-check the grouping logic in `PoetiqControlPanel` to ensure the new models fall into the “Other” bucket automatically; no code changes expected.
4. Update `CHANGELOG.md` with a new entry (Version 5.36.9) summarizing the new Poetiq models and files touched.

## Validation
- Rely on existing `/api/poetiq/models` hook – once `poetiqController` returns the new entries, the UI picker will display them automatically.
- No automated tests required; endpoint change is deterministic configuration.
