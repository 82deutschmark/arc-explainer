*
* Author: Codex using GPT-5-high
* Date: 2025-10-10T00:00:00Z
* PURPOSE: Document the Grover iteration panel runtime error observed in the browser console and outline remediation steps for streaming timestamps.
* SRP/DRY check: Pass - single documentation record of one defect.
* shadcn/ui: Pass - no UI components defined here.

# Grover Iteration Panel Error
- Console stack: `IterationCard.tsx:219` attempts to call `event.timestamp.toLocaleString()` while `event.timestamp` is undefined.
- Effect: Grover streaming view crashes whenever a status event lacks a timestamp, breaking the entire panel.
- Root cause: Backend SSE payload omits `timestamp` on certain `stream.status` updates while the UI assumes it exists.
- Remediation plan: Frontend must guard against missing timestamps (display placeholder) and backend should attach a timestamp before emitting the event.
- Owner: Frontend streaming cleanup task in Grover SSE recovery plan.
