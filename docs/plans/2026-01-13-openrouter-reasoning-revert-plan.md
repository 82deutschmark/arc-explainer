# 2026-01-13 OpenRouter reasoning default rollback plan

## Status
- **State:** Done (2026-01-13)
- **Owner:** Cascade (OpenAI o4-preview)
- **Date:** 2026-01-13

## Context
- Earlier today we flipped the OpenRouter default reasoning effort from `medium` to `high` (see `2026-01-13-openrouter-reasoning-plan.md`). Product now wants to revert to `medium` until cost and latency metrics are re-evaluated.
- The change primarily touched the OpenRouter service payload builder (`resolveOpenRouterReasoningOptions`) plus related logging/docs.
- We must restore the previous behavior while keeping override hooks intact and updating docs/CHANGELOG accordingly.

## Goals
1. Default OpenRouter reasoning effort returns to `medium` whenever callers enable `captureReasoning` but omit `serviceOpts.reasoningEffort`.
2. Respect explicit overrides (if a caller passes `reasoningEffort`, do not overwrite).
3. Update documentation + CHANGELOG to reflect the rollback and rationale.
4. Verify via targeted test/log inspection that payloads once again emit `effort: "medium"` by default.

## Deliverables
- Code change updating the default in the OpenRouter service helper. **(Done – `DEFAULT_OPENROUTER_REASONING_EFFORT` reverted to `medium` in `server/services/openrouter.ts`.)**
- Optional defensive guard to ensure only valid values pass through. **(Done – constant typed as `NonNullable` ensuring helper emits concrete effort.)**
- Regression evidence (unit/automated test or deterministic payload snapshot/log). **(Done – unit test updated and re-run to assert medium default.)**
- CHANGELOG entry (SemVer bump, what/why/how, include author). **(Done – see Version 6.36.1 entry.)**
 and plan status update.

## Task Breakdown
1. **Audit current behavior**
   - Inspect `server/services/openrouter.ts` (`DEFAULT_OPENROUTER_REASONING_EFFORT`) to confirm scope.
   - Grep for other hardcoded `'high'` defaults introduced in the prior change (e.g., `resolveOpenRouterReasoningOptions`, logging).
2. **Implement default rollback**
   - Change default constant back to `'medium'`.
   - Ensure any log statements or telemetry referencing the default reflect the updated value.
3. **Verification**
   - Adjust/extend existing unit test (if present) or add lightweight test covering `resolveOpenRouterReasoningOptions`.
   - Alternatively capture a payload snapshot in an existing test harness to assert `effort === 'medium'` when not provided.
4. **Docs & bookkeeping**
   - Update this plan’s Status to “Done” once merged.
   - Add a top CHANGELOG entry describing the rollback, author, what/why/how.
   - Mention impact (reduced cost/latency) in any relevant docs referencing reasoning defaults.

## Risks & Mitigations
- **Missed call sites:** If other services still force `'high'`, we should document reason or adjust separately; scope limited to OpenRouter helper per request.
- **Test brittleness:** If no tests exist, rely on deterministic helper-level unit test for stability.
- **Future oscillations:** Document default in CHANGELOG to avoid confusion across teams.

## Approval Checklist
- [x] User approves this plan before implementation.
- [x] Implementation completed per plan.
- [x] Plan updated to “Done” and CHANGELOG entry added post-shipment.
