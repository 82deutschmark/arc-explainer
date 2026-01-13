# 2026-01-13 OpenRouter reasoning defaults plan

## Context
OpenRouter payload builder currently hardcodes `reasoning.effort = "medium"` whenever `captureReasoning` is enabled. Product requirement is to default to **high effort** so ARC Explainer consistently requests the richest reasoning traces from OpenRouter models. Need to adjust server-side defaults while keeping overrides possible.

## Goals
1. Raise default OpenRouter reasoning effort from medium ➜ high without breaking existing override behavior.
2. Ensure documentation + CHANGELOG reflect the behavior change.
3. Verify payloads now advertise the new default in logs/tests.

## Deliverables
- Updated OpenRouter service code that sets reasoning effort to high when not explicitly provided.
- Regression coverage via lightweight unit/inspection (log assertion or payload snapshot) demonstrating high default.
- CHANGELOG entry + any impacted docs referencing reasoning defaults.

## Task Breakdown
1. **Audit current flow**
   - Confirm where `captureReasoning` is toggled and whether other services already set `reasoningEffort`.
   - Identify any shared helpers that should inherit the new default.
2. **Implement default change**
   - Update OpenRouter payload builder so `payload.reasoning.effort` pulls from `serviceOpts.reasoningEffort ?? 'high'`.
   - Ensure logs reflect the resolved effort value.
3. **Verification**
   - Add/adjust unit test or logging assertion around payload construction (e.g., OpenRouter service test or new helper test).
   - Manually inspect representative payload (local run or targeted test) to confirm `effort: 'high'`.
4. **Documentation & bookkeeping**
   - Update this plan status, CHANGELOG.md (top entry, SemVer, what/why/how, author), and any relevant docs referencing reasoning defaults.

## Risks & Mitigations
- **Services already pass `reasoningEffort`**: ensure new default does not override explicit values by respecting `serviceOpts`.
- **Provider constraints**: confirm OpenRouter accepts `high`; if not, fall back gracefully with validation + warning.
- **Testing gaps**: if unit harness absent, rely on targeted integration harness or log inspection to evidence change.

## Approval Checklist
- [x] User approves plan before implementation.
- [x] Update plan status to "done" once work + docs shipped.
