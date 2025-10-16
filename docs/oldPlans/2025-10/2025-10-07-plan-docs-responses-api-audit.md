/**
 * Author: Codex using GPT-4.1
 * Date: 2025-10-07T00:00:00Z
 * PURPOSE: Audit and update critical project documentation after Responses API migration and recent debate/discussion features. Align EXTERNAL_API, HOOKS_REFERENCE, analytics docs, and README schema with code. Add conversation chaining guidance and indexes. Identify inconsistencies and backlog items.
 * SRP/DRY check: Pass — Single document to track the doc-audit plan and outcomes; no duplication of code. Cross-references to existing docs preserved.
 * shadcn/ui: Pass — Not applicable; no custom UI introduced.
 */

# 2025-10-07 — Docs Audit Plan (Responses API + Discussion)

Goals
- Ensure docs reflect Responses API conversion (OpenAI + xAI Grok‑4)
- Document conversation chaining behavior and data model (`providerResponseId` / `previousResponseId`)
- Update hooks and external API docs for new endpoints and parameters
- Capture recommended DB indexes for new queries

Scope (critical docs)
- docs/EXTERNAL_API.md — Add conversation chaining section; clarify analyze body; fix minor mistakes
- docs/HOOKS_REFERENCE.md — Add `useEligibleExplanations`; note chaining usage
- docs/Analytics_Database_Architecture.md — Add chaining + prompt traceability fields + indexes
- docs/Analysis_Data_Flow_Trace.md — Add chaining flow (frontend/backend)
- docs/Responses_API_Chain_Storage_Analysis.md — Mark prior gap as fixed
- docs/xAI-API.md — Note Responses API for Grok‑4
- README.md — Include `provider_response_id` and `custom_prompt_text` in schema

Completed Updates
- EXTERNAL_API.md: Added new Conversation Chaining section; analyze body notes; fixed `accuracyPercentage` typo
- HOOKS_REFERENCE.md: Added `useEligibleExplanations` and chaining note for `useAnalysisResults`
- Analytics_Database_Architecture.md: Added chaining + prompt traceability fields and indexes
- Analysis_Data_Flow_Trace.md: Added chaining flow section
- Responses_API_Chain_Storage_Analysis.md: Inserted “Update” note marking providerResponseId pass-through fixed
- xAI-API.md: Added note on using `/v1/responses` for Grok‑4
- README.md: Added `provider_response_id` and `custom_prompt_text` to schema block

Open Items / Backlog (optional)
- Clean residual mojibake/encoding artefacts (e.g., stray characters in EXTERNAL_API headings and bullets)
- Consider adding DB index: `(created_at DESC)` and `(provider_response_id WHERE NOT NULL)` — recommended text now in docs
- Verify all frontend types expose `providerResponseId` consistently (camelCase mapping)
- Validate `docs/EXTERNAL_API.md` example counts vs actual dataset enumeration; keep generic wording

Verification
- Cross‑checked provider services (`server/services/openai.ts`, `server/services/grok.ts`) and `BaseAIService.ts` for Responses API fields and mapping
- Confirmed `DatabaseSchema.ts` includes prompt traceability + provider fields
- Confirmed `/api/discussion/eligible` controller and hook exist

Next Steps (if desired)
- Run a light doc spell/encoding cleanup pass
- Add a short “Conversation Chaining” snippet to frontend user-facing docs or UI help
- Add an index migration for `provider_response_id` if performance requires it

