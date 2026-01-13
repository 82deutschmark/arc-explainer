Author: Cascade (ChatGPT)
Date: 2026-01-09T22:57:00Z
PURPOSE: Hotfix plan to remove the deprecated `:free` suffix from the Olmo 3.1 32B Think model slug so OpenRouter calls target the paid `allenai/olmo-3.1-32b-think` endpoint without failing.
SRP/DRY check: Pass — scoped to catalog + config updates for one model slug.

## Scope
- Identify every reference to `allenai/olmo-3.1-32b-think:free` across configs, catalogs, and solver defaults.
- Update those references to `allenai/olmo-3.1-32b-think` or remove the redundant `:free` catalog entry if the paid slug already exists.
- Ensure downstream helpers (model lists, UI selectors) still build successfully.
- Update changelog once changes are implemented.

## Out of Scope
- Broader OpenRouter catalog sync or pricing adjustments for other models.
- Solver architecture changes unrelated to the slug correction.

## Tasks
1. **Audit & Confirm References**
   - Grep for `olmo-3.1-32b-think` and `:free` near Olmo entries to verify affected files (`server/config/openrouterModels.ts`, `server/config/openrouter-catalog.json`).
2. **Apply Slug Fixes**
   - Remove/rename the `:free` entry in the catalog JSON if duplicated by the paid slug.
   - Update `OPENROUTER_MODEL_KEYS` (and any other lists) to reference only `allenai/olmo-3.1-32b-think`.
   - Ensure no default env or solver references still use the `:free` suffix.
3. **Validation**
   - Run targeted TypeScript type check (or `npm run build` if lightweight enough) to ensure configs compile.
   - Update `CHANGELOG.md` (top entry) describing the slug adjustment with author + SemVer note.

## Risks & Mitigations
- **Catalog mismatch**: Removing the `:free` entry could break build if other code expects it. Mitigation: confirm no remaining references before deletion.
- **Case sensitivity**: Ensure slug casing matches OpenRouter expectation exactly (`allenai/olmo-3.1-32b-think`).

## Success Criteria
- No config or solver references include `:free` for the Olmo 3.1 32B Think slug.
- OpenRouter helper builds and UI renderings succeed using the paid slug.
- CHANGELOG documents the fix.

## Status
- 2026-01-10 – Completed. Removed the `:free` variants from the OpenRouter catalog + key list, leaving only the paid AllenAI slugs and updating metadata headers accordingly.
