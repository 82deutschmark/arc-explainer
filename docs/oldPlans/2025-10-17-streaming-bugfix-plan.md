## Goal
Restore live streaming for puzzle analyses using the OpenAI Responses API so users see reasoning/output deltas in real time.

## Scope
- Server routing/configuration for the existing streaming controller.
- Client-side handshake + SSE subscription for analysis actions surfaced from the puzzle browser.
- Light validation (manual smoke) ensuring chunks arrive for supported GPT-5 models.

## Tasks
1. Confirm shared streaming feature flag defaults and note any toggles needed for local/dev usage.
2. Register `POST /api/stream/analyze`, `GET /api/stream/analyze/:taskId/:modelKey/:sessionId`, and `DELETE /api/stream/analyze/:sessionId` on the Express app.
3. Expose a reusable `useAnalysisStream` hook that wraps the handshake + `EventSource` lifecycle and surfaces reasoning/text buffers.
4. Add a “Stream Analysis” action on puzzle cards (or detail view) that invokes the hook and renders a lightweight viewer.
5. Ensure GPT‑5 payloads include required reasoning/verbosity flags and surface any server errors (STREAMING_DISABLED, STREAMING_UNAVAILABLE) to the UI.

## Open Questions / Assumptions
- Streaming UX will live on the browser page for now; further polish (modal layouts, pause/resume) is future work.
- Routes already protected by auth middleware in the main router.
- Manual verification acceptable; no automated tests for SSE today.
