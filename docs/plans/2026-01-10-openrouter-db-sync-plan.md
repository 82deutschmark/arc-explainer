# 2026-01-10 OpenRouter DB Sync Plan

## Objective
Align the OpenRouter entries in `public.models` with the curated library list in `server/config/openrouterModels.ts`, and collapse GPT-OSS-120B variants so they appear as a single model in Worm Arena.

## Scope
- Source of truth: `server/config/openrouterModels.ts` and the catalog-backed model configs it generates.
- Update `public.models` to match the curated list and deactivate stale slugs.
- Ensure GPT-OSS-120B variants (`:free`, `:exacto`, etc.) no longer appear as separate models.
- Keep Worm Arena model picker and allowlist aligned with the curated list.
- Update `CHANGELOG.md` once behavior changes are in place.

## TODOs
1. Review current OpenRouter model list generation and DB usage paths for Worm Arena (`/api/models`, SnakeBench allowlist).
2. Add a sync script to upsert curated OpenRouter models into `public.models` and deactivate OpenRouter rows not in the curated list.
3. Add GPT-OSS-120B normalization in the sync step (deactivate variant slugs and keep the canonical slug active).
4. Add a guard so new model inserts normalize GPT-OSS-120B variants to the canonical slug (avoid future duplicates).
5. Run a quick DB diff to confirm active OpenRouter models match the curated list.
6. Update `CHANGELOG.md` with what/why/how and the files touched.

## Open Questions
- Do you want to fully merge GPT-OSS-120B historical rows into the canonical model (update `game_participants`), or is hiding variant slugs from active lists enough for now?
