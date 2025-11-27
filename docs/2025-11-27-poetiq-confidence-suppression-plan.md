# 2025-11-27 Poetiq Confidence Suppression Plan

## Goal
Ensure Poetiq runs never populate confidence or trustworthiness scores in our database so UI cards stop showing misleading metrics. Confidence must always save as `0`, and trustworthiness must stay unset/null.

## Key References
- `server/services/poetiq/poetiqService.ts` – transforms Poetiq solver results into the standardized explanation object.
- `explanationService.transformRawExplanation` – defaults missing confidence to 50, so Poetiq must explicitly set the desired value before persistence.
- Frontend dashboards pull `confidence` and `trustworthinessScore` directly from explanation records; leaving them non-null causes unwanted rendering.

## Tasks
1. **Audit current transformer**
   - Confirm where `confidence` and `trustworthinessScore` are computed within `transformToExplanationData`.
   - Verify no other Poetiq-specific path overrides those values later.
2. **Enforce zero confidence & null trustworthiness**
   - Update `transformToExplanationData` to hardcode `confidence = 0`.
   - Set `trustworthinessScore` to `null` regardless of Poetiq internal accuracy so UI widgets hide that column.
3. **Document + release note**
   - Update `CHANGELOG.md` with a new semantic version entry describing the suppression.
   - Keep Poetiq plan docs aligned with the new behavior for future audits.

## Validation
- Manual inspection of the transformed object to ensure `confidence: 0` and `trustworthinessScore: null`.
- Optional spot-check via mocked save path to confirm no other layer overwrites the zero value.

