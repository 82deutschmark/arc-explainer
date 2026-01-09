# 2026-01-08 – Olmo 3.1 32B Pricing & Slug Fix Plan

## Objective
Align all OpenRouter references to `allenai/olmo-3.1-32b-instruct` with its current paid status by removing the obsolete `:free` suffix and ensuring the repository displays the correct per-million token pricing ($0.20 input / $0.60 output).

## Scope
- Update catalog-driven configuration (`server/config/openrouter-catalog.json`, `openrouterModels.ts`) so the slug is correct and pricing metadata is accurate.
- Propagate the refreshed pricing to any derived structures (e.g., `server/config/models.ts`) and verify UI cost displays pick up the change.
- Confirm there are no lingering references to the free variant anywhere else in the repo (env defaults, docs, tests).
- Update `CHANGELOG.md` with the adjustment once changes are implemented.

Out of scope: broader catalog sync work, additional model additions/removals, or UI redesigns.

## Tasks
1. **Catalog & Config Audit** – Search for `olmo-3.1-32b` and `:free` variants to locate every occurrence (catalog JSON, model key lists, docs, envs).
2. **Slug & Pricing Update** – Remove the `:free` suffix from configuration entries and set explicit `pricing.prompt` / `pricing.completion` values that yield $0.20 / $0.60 per million in downstream displays.
3. **Regenerate Model Metadata** – Ensure `buildOpenRouterModels()` consumes the updated catalog entry; adjust any overrides or manual entries in `server/config/models.ts` if required.
4. **Validation Pass** – Confirm no stale references remain (grep) and that cost labels in the UI source now show the expected numbers.
5. **Documentation & Changelog** – Record the change in `CHANGELOG.md` (SemVer bump + what/why/how) and note completion in this plan if necessary.

## Risks / Considerations
- Catalog entry may still advertise `:free`; must ensure the source is correct or document overrides.
- UI caches might rely on build artifacts; confirm any build step uses updated catalog on next run.
- Need to avoid disrupting other OpenRouter entries; double-check arrays after editing.
