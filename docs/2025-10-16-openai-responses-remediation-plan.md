# 2025-10-16 OpenAI Responses Remediation Plan

## Goals
- Repair the OpenAI Responses integration after the 2025-02 refactor regressed streaming and structured parsing.
- Align payload construction and stream handling with the October 2025 API contract.
- Restore changelog accuracy for 2025-10-16 releases.

## Key Questions
- How should we use `instructions` vs `input` when `previous_response_id` is provided?
- Which streaming events are emitted by `openai@5.16` and how do we surface reasoning + JSON deltas?
- What response fields require normalization to avoid incomplete analyses?

## Deliverables
1. Update OpenAI payload builder to follow current API docs (instructions handling, json schema flags, continuation semantics).
2. Expand streaming event coverage for `ResponseStreamEvent` union, ensuring summaries, reasoning text, annotations, and completion states reach clients.
3. Harden response normalization & parsing against missing structured output and propagate reasoning metadata.
4. Refresh CHANGELOG for 2025-10-16 with an entry describing the remedial work.

## Work Log
- [x] Audit payload builder for instruction handling & continuation edge cases.
- [x] Cross-check streaming helper against SDK typings and docs; add missing event branches.
- [x] Re-run parsing validations ensuring incomplete responses flagged.
- [x] Update headers with October 16 timestamps per repository guidance.
- [x] Add changelog entry summarizing fixes.
- [x] Execute `npm run check`.

