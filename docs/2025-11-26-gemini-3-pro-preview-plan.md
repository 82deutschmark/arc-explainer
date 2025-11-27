# 2025-11-26 – Gemini 3 Pro Preview plan

## Goal
Expose the Google Gemini 3 Pro preview model as a first-class Gemini provider option (in addition to the existing OpenRouter proxy) so AI services can target it directly.

## Files / Components
- `server/services/gemini.ts` – register the new `gemini-3-pro-preview` key so the service routes to the native Google SDK.
- `server/config/models.ts` – add a Gemini-provider model config (key + metadata) that maps to the correct Google API identifier.
- `docs/CHANGELOG.md` – capture the new capability and guidance for selecting direct vs OpenRouter variants.

## Tasks
1. Extend `GeminiService`’s `models` map with `gemini-3-pro-preview` (default temperatures, thinking config, etc.).
2. Add a `Gemini` provider model entry describing context window, pricing, reasoning flags, and API name `models/gemini-3-pro-preview`.
3. Verify no other code paths need updates (e.g., `getApiModelName` already resolves) and document the change.

## Open Questions / Risks
- Monitor whether Google ships a final non-preview identifier (`gemini-3-pro`) and be ready to alias when that happens.
- Reasoning safety: keep structured-output disabled if Gemini 3 behaves like other reasoning models.
